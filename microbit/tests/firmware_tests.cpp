#include "firmware.h"
#include "fake_hardware.h"
#include "ring-buffer.h"
#include <cstring>
#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>

using namespace mikrobit;
#define REQUIRE(condition) do { if (!(condition)) throw std::runtime_error(std::string(__func__) + ":" + std::to_string(__LINE__) + " " #condition); } while (false)
static Span span(const std::string& s) { return Span{s.data(), s.size()}; }
static Snapshot sample(uint32_t time = 0) { Snapshot s = {}; s.u = time; s.z = -1000; s.temperature = 23; s.light = 80; s.microphone = 12; return s; }
static std::string drain(Firmware& f, uint32_t now = 0, size_t chunk = 1024) {
    std::string out;
    for (unsigned i = 0; i < 10000; ++i) {
        Span bytes = f.tx(now); if (!bytes.size) return out;
        const size_t n = bytes.size < chunk ? bytes.size : chunk;
        out.append(bytes.data, n); f.consumeTx(n, now);
    }
    throw std::runtime_error("TX did not drain");
}
static std::string feed(Firmware& f, const std::string& wire, uint32_t now = 0) {
    std::string out;
    for (unsigned char b : wire) { if (!f.canReceive()) out += drain(f, now); f.receive(b, now); }
    return out + drain(f, now);
}
static void connect(Firmware& f) { REQUIRE(feed(f, "HELLO|1\n").find("\"deviceInfo\"") != std::string::npos); REQUIRE(f.streaming()); }
static Command command(const std::string& wire) { Command c; REQUIRE(parseCommand(span(wire), defaultCapabilities(), c) == Error::None); return c; }

static void framing_boundaries() {
    const std::string wire = "C|1|1|D|TEXT|READY\r\n";
    for (size_t cut = 0; cut <= wire.size(); ++cut) {
        LineFramer f; Frame frame; unsigned frames = 0;
        for (const std::string& chunk : {wire.substr(0, cut), wire.substr(cut)})
            for (unsigned char b : chunk) if (f.push(b, frame)) { ++frames; REQUIRE(!frame.tooLong); REQUIRE(!frame.invalidBytes); REQUIRE(frame.line.equals("C|1|1|D|TEXT|READY")); }
        REQUIRE(frames == 1);
    }
    for (size_t length : {size_t(255), size_t(256), size_t(257), size_t(10000)}) {
        LineFramer f; Frame frame; const std::string input(length, 'A');
        for (unsigned char b : input) { REQUIRE(!f.push(b, frame)); REQUIRE(f.bufferedBytes() <= 257); }
        REQUIRE(f.push('\n', frame)); REQUIRE(frame.tooLong == (length > 256));
        for (unsigned char b : std::string("OK\n")) if (f.push(b, frame)) { REQUIRE(frame.line.equals("OK")); REQUIRE(!frame.tooLong); }
    }
    LineFramer f; Frame frame;
    for (unsigned char b : std::string(256, 'x') + "\r\n") if (f.push(b, frame)) REQUIRE(!frame.tooLong);
    REQUIRE(!f.push('\n', frame));
    const std::string invalid("C|1|1|D|TEXT|A\0B\n", 17);
    for (unsigned char b : invalid) if (f.push(b, frame)) REQUIRE(frame.invalidBytes);
}

static void parser_boundaries_and_precedence() {
    Command c;
    REQUIRE(parseCommand(span("C|999999999999999999999999|1|D|CLEAR"), defaultCapabilities(), c) == Error::UnsupportedVersion);
    REQUIRE(!recoverHeader(span("C|1|2147483648|D|CLEAR")).recovered);
    REQUIRE(!recoverHeader(span("C|01|1|D|CLEAR")).recovered);
    REQUIRE(parseCommand(span("C|1|1|S|TONE|440|99999999999999999999|128"), defaultCapabilities(), c) == Error::OutOfRange);
    REQUIRE(parseCommand(span("C|1|1|S|TONE|99999999999999|01|128"), defaultCapabilities(), c) == Error::MalformedCommand);
    Capabilities absent = defaultCapabilities(); absent.speaker = false;
    REQUIRE(parseCommand(span("C|1|1|S|TONE|bad"), absent, c) == Error::UnsupportedOutput);
    REQUIRE(parseCommand(span("C|1|1|X|TEXT|bad"), absent, c) == Error::UnsupportedAction);
    REQUIRE(parseCommand(span("C|1|1|D|TEXT|" + std::string(32, 'A')), defaultCapabilities(), c) == Error::None);
    REQUIRE(parseCommand(span("C|1|1|D|TEXT|" + std::string(33, 'A')), defaultCapabilities(), c) == Error::OutOfRange);
    REQUIRE(parseCommand(span("C|1|1|D|IMAGE|X"), defaultCapabilities(), c) == Error::InvalidText);
    REQUIRE(parseCommand(span("C|1|1|D|TEXT|A|B"), defaultCapabilities(), c) == Error::MalformedCommand);
    std::string melody = "C|1|1|S|MELODY|255|";
    for (int i = 0; i < 16; ++i) { if (i) melody += ','; melody += "20:1"; }
    REQUIRE(parseCommand(span(melody), defaultCapabilities(), c) == Error::None); REQUIRE(c.noteCount == 16);
    REQUIRE(parseCommand(span(melody + ",20:1"), defaultCapabilities(), c) == Error::OutOfRange);
    REQUIRE(parseCommand(span(melody + ",bad"), defaultCapabilities(), c) == Error::MalformedCommand);
    REQUIRE(parseCommand(span("C|1|1|S|MELODY|128|0:10000"), defaultCapabilities(), c) == Error::None);
    REQUIRE(parseCommand(span("C|1|1|S|TONE|0|1|0"), defaultCapabilities(), c) == Error::None);
    for (const std::string& token : {"-1", "+1", " 1", "1.0", "1e2", "", "00"})
        REQUIRE(parseCommand(span("C|1|1|S|TONE|440|" + token + "|128"), defaultCapabilities(), c) == Error::MalformedCommand);
}

static void handshake_and_ids() {
    FakeHardware h; Firmware f(h);
    REQUIRE(feed(f, "C|1|1|D|CLEAR\n").empty());
    f.publish(sample()); REQUIRE(drain(f).empty());
    REQUIRE(feed(f, "HELLO|2\n") == "ERR|UNSUPPORTED_VERSION\n"); REQUIRE(!f.streaming());
    REQUIRE(feed(f, "HELLO|01\n") == "ERR|MALFORMED_COMMAND\n");
    connect(f);
    REQUIRE(feed(f, "C|1|1|S|TONE|440|250|128\n") == "R|1|1|OK\n"); REQUIRE(h.frequency == 440);
    const unsigned tones = h.tones;
    REQUIRE(feed(f, "C|1|1|S|STOP\n") == "R|1|1|ERR|DUPLICATE_ID\n"); REQUIRE(h.tones == tones);
    REQUIRE(feed(f, "C|2|2|S|STOP\n") == "R|1|2|ERR|UNSUPPORTED_VERSION\n"); REQUIRE(h.frequency == 440);
    REQUIRE(feed(f, "C|1|2|S|STOP\n") == "R|1|2|ERR|DUPLICATE_ID\n");
    REQUIRE(feed(f, "C|1|2147483647|S|STOP\n") == "R|1|2147483647|OK\n");
    REQUIRE(feed(f, "C|1|3|D|CLEAR\n") == "R|1|3|ERR|DUPLICATE_ID\n");
    connect(f); REQUIRE(f.highId() == 0); REQUIRE(feed(f, "C|1|1|D|CLEAR\n") == "R|1|1|OK\n");
    REQUIRE(feed(f, "HELLO|9\n") == "ERR|UNSUPPORTED_VERSION\n"); REQUIRE(!f.streaming()); REQUIRE(h.frequency == 0);
}

static void malformed_and_overflow_recovery() {
    FakeHardware h; Firmware f(h); connect(f);
    std::string longLine = "C|1|22|D|TEXT|" + std::string(10000, 'A') + "\n";
    REQUIRE(feed(f, longLine) == "R|1|22|ERR|LINE_TOO_LONG\n");
    REQUIRE(feed(f, "C|1|22|D|CLEAR\n") == "R|1|22|ERR|DUPLICATE_ID\n");
    REQUIRE(feed(f, longLine) == "R|1|22|ERR|LINE_TOO_LONG\n");
    REQUIRE(feed(f, std::string(500, 'Z') + "\n") == "ERR|LINE_TOO_LONG\n");
    REQUIRE(feed(f, "unknown\n") == "ERR|MALFORMED_COMMAND\n");
    std::string control = "C|1|23|D|TEXT|A"; control.push_back(3); control += "B\n";
    REQUIRE(feed(f, control) == "R|1|23|ERR|MALFORMED_COMMAND\n"); REQUIRE(f.streaming());
    REQUIRE(feed(f, "C|1|24|D|CLEAR\n") == "R|1|24|OK\n");
    f.publish(sample()); REQUIRE(drain(f).find("\"n\":0") != std::string::npos);
    REQUIRE(f.diagnostics().oversized == 3);
}

static void partial_tx_and_session_barrier() {
    FakeHardware h; Firmware f(h); connect(f);
    REQUIRE(feed(f, "C|1|1|S|TONE|440|10000|128\n").find("OK") != std::string::npos);
    f.publish(sample(20)); Span partial = f.tx(0); REQUIRE(partial.size > 10);
    std::string wire(partial.data, 10); f.consumeTx(10, 0);
    for (unsigned char b : std::string("HELLO|1\n")) f.receive(b, 1);
    REQUIRE(!f.streaming()); REQUIRE(h.frequency == 0);
    wire += drain(f, 1, 3);
    const size_t boundary = wire.find('\n'); REQUIRE(boundary != std::string::npos);
    REQUIRE(wire.substr(boundary + 1).find("{\"type\":\"deviceInfo\"") == 0);
    REQUIRE(f.streaming()); REQUIRE(drain(f, 1).empty());
    f.publish(sample(40)); REQUIRE(drain(f, 1).find("\"n\":1") != std::string::npos);
}

static void snapshots_and_failure() {
    FakeHardware h; Firmware f(h); connect(f);
    Snapshot s = sample(20); s.ac = 1; f.publish(s); s.u = 40; s.ac = 2; f.publish(s);
    const std::string wire = drain(f); REQUIRE(wire.find("\"n\":0") != std::string::npos); REQUIRE(wire.find("\"ac\":2") != std::string::npos);
    REQUIRE(f.diagnostics().coalescedSnapshots == 1);
    s.microphone = 256; f.publish(s); REQUIRE(drain(f).empty()); REQUIRE(f.diagnostics().sensorFailures == 1);
    f.publish(sample(20)); REQUIRE(drain(f, 121).empty()); REQUIRE(f.diagnostics().staleSnapshots == 1);
    f.publish(sample(140)); REQUIRE(drain(f, 140).find("\"n\":1") != std::string::npos);
    char buffer[256]; s = sample(); s.n = s.u = s.ac = s.bc = s.qc = UINT32_MAX; s.x = -8192; s.y = 8192;
    const size_t n = encodeSnapshot(s, buffer, sizeof(buffer)); REQUIRE(n > 100 && n < 256); REQUIRE(buffer[n - 1] == '\n');
    char tiny[4] = {'x', 'x', 'x', 'x'}; REQUIRE(encodeSnapshot(s, tiny, sizeof(tiny)) == 0); REQUIRE(tiny[0] == 0);
    s.a = 2; REQUIRE(!validSnapshot(s));
    Capabilities caps = defaultCapabilities(); caps.soundCount = 0; caps.sounds = NULL;
    char info[1026]; REQUIRE(encodeDeviceInfo(caps, info, sizeof(info)) > 0); REQUIRE(std::string(info).find("\"builtInSounds\":[]") != std::string::npos);
    const char* names[] = {"bad\"name"}; caps.sounds = names; caps.soundCount = 1; REQUIRE(encodeDeviceInfo(caps, info, sizeof(info)) == 0);
    const char* duplicates[] = {"hello", "hello"}; caps.sounds = duplicates; caps.soundCount = 2; REQUIRE(encodeDeviceInfo(caps, info, sizeof(info)) == 0);
}

static void debounce_and_deadlines() {
    DigitalInput d;
    d.update(false, 0); d.update(true, 5); d.update(false, 10); d.update(true, 15);
    d.update(true, 34); REQUIRE(!d.pressed()); d.update(true, 35); REQUIRE(d.pressed()); REQUIRE(d.presses() == 1);
    d.update(false, 40); d.update(false, 60); REQUIRE(!d.pressed()); REQUIRE(d.presses() == 1);
    d.update(true, 65); d.update(true, 85); d.update(false, 90); d.update(false, 110); REQUIRE(d.presses() == 2);
    DigitalInput wrapped; wrapped.update(false, UINT32_MAX - 50); wrapped.update(true, UINT32_MAX - 10); wrapped.update(true, 9);
    REQUIRE(wrapped.pressed()); REQUIRE(wrapped.presses() == 1);
    PeriodicDeadline timer; REQUIRE(timer.due(0)); REQUIRE(!timer.due(0)); REQUIRE(!timer.due(19)); REQUIRE(timer.due(20));
    REQUIRE(timer.due(100)); REQUIRE(timer.missed() == 3); REQUIRE(!timer.due(100)); REQUIRE(timer.due(120));
    PeriodicDeadline wrap; REQUIRE(wrap.due(UINT32_MAX - 9)); REQUIRE(!wrap.due(0)); REQUIRE(wrap.due(10));
}

static void output_replacement_and_cancellation() {
    FakeHardware h; Outputs out(h);
    Command text = command("C|1|1|D|TEXT|READY"); REQUIRE(out.apply(text, 0)); REQUIRE(out.tick(50)); const unsigned frames = h.images;
    Command image = command("C|1|2|D|IMAGE|1234567890123456789012345"); REQUIRE(out.apply(image, 51));
    REQUIRE(out.tick(500)); REQUIRE(h.images == frames + 1); REQUIRE(h.pixels[0] == 1 && h.pixels[24] == 5);
    REQUIRE(out.apply(command("C|1|3|D|CLEAR"), 501)); REQUIRE(out.tick(1000)); for (uint8_t pixel : h.pixels) REQUIRE(pixel == 0);
    REQUIRE(out.apply(command("C|1|4|S|TONE|440|250|128"), UINT32_MAX - 100)); REQUIRE(h.frequency == 440);
    REQUIRE(out.tick(148)); REQUIRE(h.frequency == 440); REQUIRE(out.tick(149)); REQUIRE(h.frequency == 0);
    REQUIRE(out.apply(command("C|1|5|S|MELODY|70|440:100,0:100,660:100"), 0));
    REQUIRE(out.tick(100)); REQUIRE(h.frequency == 0); REQUIRE(out.tick(200)); REQUIRE(h.frequency == 660);
    REQUIRE(out.apply(command("C|1|6|S|STOP"), 201)); const unsigned tones = h.tones; REQUIRE(out.tick(500)); REQUIRE(h.tones == tones);
    REQUIRE(out.apply(command("C|1|7|S|SOUND|happy"), 1000)); REQUIRE(h.frequency == 523 && h.volume == 128); REQUIRE(out.tick(1400)); REQUIRE(h.frequency == 0);
    REQUIRE(out.apply(command("C|1|9|S|SOUND|hello"), 2000)); REQUIRE(h.frequency == 440 && h.volume == 128); REQUIRE(out.tick(2350)); REQUIRE(h.frequency == 0);
    REQUIRE(out.apply(command("C|1|8|D|TEXT|" + std::string(32, 'A')), 0)); REQUIRE(out.tick(9850)); for (uint8_t pixel : h.pixels) REQUIRE(pixel == 0);
    REQUIRE(out.reset()); REQUIRE(out.tick(50000)); REQUIRE(h.frequency == 0);
}

static void invalid_commands_preserve_outputs_and_faults() {
    FakeHardware h; Firmware f(h); connect(f);
    REQUIRE(feed(f, "C|1|1|S|TONE|440|1000|128\n").find("OK") != std::string::npos);
    REQUIRE(feed(f, "C|1|2|S|TONE|1|100|128\n").find("OUT_OF_RANGE") != std::string::npos); REQUIRE(h.frequency == 440);
    h.failSound = true; REQUIRE(feed(f, "C|1|3|S|TONE|660|100|128\n").find("INTERNAL_ERROR") != std::string::npos); h.failSound = false;
    f.publish(sample()); Span pending = f.tx(0); REQUIRE(pending.size); f.consumeTx(1, 0);
    REQUIRE(f.tx(1000).size); REQUIRE(!f.streaming()); REQUIRE(f.diagnostics().txStalls == 1);
    drain(f, 1000); connect(f); f.transportFault(); REQUIRE(!f.streaming()); REQUIRE(h.frequency == 0);
}

static void deterministic_framing_fuzz() {
    LineFramer f; Frame frame; uint32_t random = 123;
    for (unsigned i = 0; i < 100000; ++i) {
        random = random * 1664525u + 1013904223u;
        const uint8_t byte = static_cast<uint8_t>(random >> 24);
        if (f.push(byte, frame)) { REQUIRE(frame.line.size <= 257); Header h = recoverHeader(frame.line); if (h.recovered) REQUIRE(h.id <= MaxCommandId); }
        REQUIRE(f.bufferedBytes() <= 257);
    }
}

static void bounded_backpressure_and_ordering() {
    ByteRing<512> ring; uint8_t byte = 0;
    for (unsigned i = 0; i < 512; ++i) REQUIRE(ring.push(static_cast<uint8_t>(i)));
    REQUIRE(!ring.push(99)); REQUIRE(ring.size() == 512);
    for (unsigned i = 0; i < 256; ++i) { REQUIRE(ring.pop(byte)); REQUIRE(byte == static_cast<uint8_t>(i)); }
    for (unsigned i = 0; i < 256; ++i) REQUIRE(ring.push(static_cast<uint8_t>(i)));
    for (unsigned i = 0; i < 512; ++i) { REQUIRE(ring.pop(byte)); REQUIRE(byte == static_cast<uint8_t>(i)); }
    REQUIRE(!ring.pop(byte)); ring.push(1); ring.clear(); REQUIRE(!ring.pop(byte));

    FakeHardware h; Firmware f(h); connect(f);
    for (unsigned id = 1; id <= 4; ++id) {
        REQUIRE(f.canReceive());
        for (unsigned char b : "C|1|" + std::to_string(id) + "|D|CLEAR\n") f.receive(b, 0);
    }
    REQUIRE(!f.canReceive()); // Caller leaves further input in its RX ring.
    std::string first;
    Span bytes = f.tx(0); first.assign(bytes.data, bytes.size); f.consumeTx(bytes.size, 0);
    REQUIRE(first == "R|1|1|OK\n"); REQUIRE(f.canReceive());
    for (unsigned char b : std::string("HELLO|1\n")) f.receive(b, 0);
    REQUIRE(!f.canReceive());
    const std::string rest = drain(f, 0, 1);
    REQUIRE(rest.find("R|1|2|OK\nR|1|3|OK\nR|1|4|OK\n{\"type\":\"deviceInfo\"") == 0);
    REQUIRE(f.streaming()); REQUIRE(feed(f, "C|1|1|D|CLEAR\n") == "R|1|1|OK\n");
}

static void output_deadlines_and_failed_replacement() {
    FakeHardware h; Outputs out(h);
    REQUIRE(out.apply(command("C|1|1|S|MELODY|255|440:100,660:100,880:100"), 0));
    const unsigned tones = h.tones;
    REQUIRE(out.tick(250)); REQUIRE(h.frequency == 880); REQUIRE(h.tones == tones + 1);
    REQUIRE(out.tick(10000)); REQUIRE(h.frequency == 0); REQUIRE(h.tones == tones + 2);
    REQUIRE(out.apply(command("C|1|2|D|TEXT|A"), UINT32_MAX - 24));
    REQUIRE(out.tick(25)); REQUIRE(out.tick(525)); for (uint8_t pixel : h.pixels) REQUIRE(pixel == 0);
    REQUIRE(out.apply(command("C|1|3|D|TEXT|READY"), 0));
    h.failDisplay = true;
    REQUIRE(!out.apply(command("C|1|4|D|IMAGE|9999999999999999999999999"), 1));
    const unsigned images = h.images; h.failDisplay = false;
    REQUIRE(out.tick(5000)); REQUIRE(h.images == images); // Canceled scroll cannot resume after a driver failure.
    REQUIRE(out.apply(command("C|1|5|D|CLEAR"), 5001));
    for (uint8_t pixel : h.pixels) REQUIRE(pixel == 0);
    Firmware f(h); h.failSound = true;
    REQUIRE(feed(f, "HELLO|1\n") == "ERR|INTERNAL_ERROR\n"); REQUIRE(!f.streaming());
    h.failSound = false; connect(f);
}

int main() {
    const std::vector<std::pair<const char*, void(*)()> > tests = {
        {"framing_boundaries", framing_boundaries}, {"parser_boundaries_and_precedence", parser_boundaries_and_precedence},
        {"handshake_and_ids", handshake_and_ids}, {"malformed_and_overflow_recovery", malformed_and_overflow_recovery},
        {"partial_tx_and_session_barrier", partial_tx_and_session_barrier}, {"snapshots_and_failure", snapshots_and_failure},
        {"debounce_and_deadlines", debounce_and_deadlines}, {"output_replacement_and_cancellation", output_replacement_and_cancellation},
        {"invalid_commands_preserve_outputs_and_faults", invalid_commands_preserve_outputs_and_faults}, {"deterministic_framing_fuzz", deterministic_framing_fuzz},
        {"bounded_backpressure_and_ordering", bounded_backpressure_and_ordering}, {"output_deadlines_and_failed_replacement", output_deadlines_and_failed_replacement}
    };
    unsigned failures = 0;
    for (const auto& test : tests) { try { test.second(); std::cout << "PASS " << test.first << '\n'; }
        catch (const std::exception& e) { ++failures; std::cerr << "FAIL " << test.first << ": " << e.what() << '\n'; } }
    return failures ? 1 : 0;
}
