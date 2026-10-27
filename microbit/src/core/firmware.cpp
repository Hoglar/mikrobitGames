#include "firmware.h"
#include <string.h>

namespace mikrobit {
Firmware::Firmware(OutputHardware& hardware, Capabilities caps) : state_(Waiting), caps_(caps), outputs_(hardware),
    head_(0), count_(0), txOffset_(0), epoch_(0), highId_(0), sequence_(0), lastProgress_(0),
    currentValid_(false), snapshotPending_(false), snapshot_(), diagnostics_() {
    memset(controls_, 0, sizeof(controls_)); memset(&current_, 0, sizeof(current_));
}
bool Firmware::canReceive() const { return state_ != Starting && count_ < 4; }
void Firmware::receive(uint8_t byte, uint32_t now) {
    if (!canReceive()) return;
    Frame frame;
    if (framer_.push(byte, frame)) handle(frame, now);
}
void Firmware::result(uint32_t id, Error error) {
    if (count_ == 4) { transportFault(); return; }
    Message& m = controls_[(head_ + count_) % 4];
    m.size = encodeResult(id, error, m.bytes, sizeof(m.bytes)); m.kind = Result; m.epoch = epoch_; ++count_;
}
bool Firmware::stopSession() {
    state_ = Waiting; ++epoch_; snapshotPending_ = false; highId_ = 0;
    if (!outputs_.reset()) { ++diagnostics_.outputFailures; return false; }
    return true;
}
void Firmware::beginSession() {
    if (!stopSession()) { result(0, Error::InternalError); return; }
    Message& m = controls_[(head_ + count_) % 4];
    m.size = encodeDeviceInfo(caps_, m.bytes, sizeof(m.bytes));
    if (!m.size) { result(0, Error::InternalError); return; }
    m.kind = Info; m.epoch = epoch_; ++count_; state_ = Starting;
}
void Firmware::handle(const Frame& f, uint32_t now) {
    Error helloError;
    if (parseHello(f.line, helloError)) {
        if (f.tooLong) helloError = Error::LineTooLong;
        else if (f.invalidBytes) helloError = Error::MalformedCommand;
        if (helloError == Error::None) beginSession();
        else { stopSession(); result(0, helloError); }
        return;
    }
    if (state_ != Streaming) return;
    const Header h = recoverHeader(f.line);
    if (f.tooLong) {
        ++diagnostics_.oversized;
        if (h.recovered && h.id > highId_) highId_ = h.id;
        result(h.recovered ? h.id : 0, Error::LineTooLong); return;
    }
    if (!h.recovered) { ++diagnostics_.malformed; result(0, Error::MalformedCommand); return; }
    if (h.id <= highId_) { result(h.id, Error::DuplicateId); return; }
    highId_ = h.id;
    Command c;
    Error error = parseCommand(f.line, caps_, c);
    if (error == Error::None && !outputs_.apply(c, now)) { ++diagnostics_.outputFailures; error = Error::InternalError; }
    if (error == Error::MalformedCommand) ++diagnostics_.malformed;
    result(h.id, error);
}
void Firmware::publish(const Snapshot& s) {
    if (!validSnapshot(s)) { ++diagnostics_.sensorFailures; return; }
    if (state_ != Streaming) return;
    if (snapshotPending_) ++diagnostics_.coalescedSnapshots;
    snapshot_ = s; snapshotPending_ = true;
}
void Firmware::serviceOutputs(uint32_t now) { if (!outputs_.tick(now)) ++diagnostics_.outputFailures; }
Span Firmware::tx(uint32_t now) {
    if (currentValid_ && static_cast<uint32_t>(now - lastProgress_) >= 1000) {
        ++diagnostics_.txStalls; stopSession(); lastProgress_ = now;
        // Keep ownership of already-started bytes: never splice another line into them.
    }
    if (!currentValid_) {
        if (count_) {
            current_ = controls_[head_]; head_ = (head_ + 1) % 4; --count_;
        } else if (state_ == Streaming && snapshotPending_) {
            const uint32_t age = now - snapshot_.u;
            if (age < 0x80000000u && age > 100) {
                snapshotPending_ = false; ++diagnostics_.staleSnapshots; return Span{NULL, 0};
            }
            snapshot_.n = sequence_++;
            current_.size = encodeSnapshot(snapshot_, current_.bytes, sizeof(current_.bytes));
            current_.kind = Sensor; current_.epoch = epoch_; snapshotPending_ = false;
        } else return Span{NULL, 0};
        currentValid_ = true; txOffset_ = 0; lastProgress_ = now;
    }
    return Span{current_.bytes + txOffset_, current_.size - txOffset_};
}
void Firmware::consumeTx(size_t bytes, uint32_t now) {
    if (!currentValid_ || bytes > current_.size - txOffset_) return;
    txOffset_ += bytes; if (bytes) lastProgress_ = now;
    if (txOffset_ == current_.size) {
        if (current_.kind == Info && current_.epoch == epoch_ && state_ == Starting) state_ = Streaming;
        currentValid_ = false;
    }
}
void Firmware::transportFault() { stopSession(); framer_.reset(); }
static_assert(sizeof(Firmware) < 16 * 1024, "Firmware core exceeds its static storage budget");
}
