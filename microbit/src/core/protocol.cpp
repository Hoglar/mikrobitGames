#include "protocol.h"

#include <inttypes.h>
#include <stdio.h>
#include <string.h>

namespace mikrobit {
namespace {
struct Number { bool syntax, overflow; uint32_t value; };
Number number(Span s) {
    Number n = {s.size != 0, false, 0};
    if (s.size > 1 && s.data[0] == '0') n.syntax = false;
    for (size_t i = 0; i < s.size; ++i) {
        if (s.data[i] < '0' || s.data[i] > '9') { n.syntax = false; continue; }
        const uint32_t digit = static_cast<uint32_t>(s.data[i] - '0');
        if (n.value > (UINT32_MAX - digit) / 10) n.overflow = true;
        if (!n.overflow) n.value = n.value * 10 + digit;
    }
    return n;
}
size_t split(Span s, char separator, Span* fields, size_t capacity) {
    size_t count = 0, start = 0;
    for (size_t i = 0; i <= s.size; ++i) {
        if (i == s.size || s.data[i] == separator) {
            if (count == capacity) return capacity + 1;
            fields[count++] = Span{s.data + start, i - start};
            start = i + 1;
        }
    }
    return count;
}
bool frequency(uint32_t hz) { return hz == 0 || (hz >= 20 && hz <= 9999); }
bool soundName(Span name) {
    if (name.size == 0 || name.size > 24 || name.data[0] < 'a' || name.data[0] > 'z') return false;
    for (size_t i = 1; i < name.size; ++i) {
        const char c = name.data[i];
        if (!(c >= 'a' && c <= 'z') && !(c >= '0' && c <= '9') && c != '-') return false;
    }
    return true;
}
bool textChar(char c) {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
           (c >= '0' && c <= '9') || strchr(" .,!?:+-/()", c) != NULL;
}
void copy(Span s, char* out) { memcpy(out, s.data, s.size); out[s.size] = '\0'; }
size_t checked(int written, char* out, size_t capacity) {
    if (written < 0 || static_cast<size_t>(written) >= capacity) {
        if (capacity) out[0] = '\0';
        return 0;
    }
    return static_cast<size_t>(written);
}
class Builder {
public:
    Builder(char* out, size_t cap) : out_(out), cap_(cap), size_(0), ok_(cap != 0) { if (cap) out[0] = 0; }
    void add(const char* text) {
        const size_t n = strlen(text);
        if (!ok_ || n >= cap_ - size_) { ok_ = false; return; }
        memcpy(out_ + size_, text, n); size_ += n; out_[size_] = 0;
    }
    size_t finish() { if (!ok_) { if (cap_) out_[0] = 0; return 0; } return size_; }
private:
    char* out_; size_t cap_, size_; bool ok_;
};
const char* const SoundNames[] = {"hello", "happy"};
const Note Hello[] = {{440, 100}, {660, 100}, {880, 150}};
const Note Happy[] = {{523, 100}, {659, 100}, {784, 200}};
}

const char* errorName(Error e) {
    switch (e) {
    case Error::None: return "OK";
    case Error::LineTooLong: return "LINE_TOO_LONG";
    case Error::DuplicateId: return "DUPLICATE_ID";
    case Error::UnsupportedVersion: return "UNSUPPORTED_VERSION";
    case Error::MalformedCommand: return "MALFORMED_COMMAND";
    case Error::UnsupportedAction: return "UNSUPPORTED_ACTION";
    case Error::UnsupportedOutput: return "UNSUPPORTED_OUTPUT";
    case Error::OutOfRange: return "OUT_OF_RANGE";
    case Error::InvalidText: return "INVALID_TEXT";
    case Error::UnsupportedSound: return "UNSUPPORTED_SOUND";
    case Error::InternalError: return "INTERNAL_ERROR";
    }
    return "INTERNAL_ERROR";
}
bool Span::equals(const char* literal) const { return strlen(literal) == size && memcmp(data, literal, size) == 0; }
bool Capabilities::hasSound(Span name) const {
    if (soundCount > 16 || (!sounds && soundCount)) return false;
    for (size_t i = 0; i < soundCount; ++i) if (sounds[i] && name.equals(sounds[i])) return true;
    return false;
}
Capabilities defaultCapabilities() { return Capabilities{true, true, SoundNames, 2}; }
const Note* builtInNotes(const char* name, size_t& count) {
    count = 3;
    if (strcmp(name, "hello") == 0) return Hello;
    if (strcmp(name, "happy") == 0) return Happy;
    count = 0; return NULL;
}

LineFramer::LineFramer() { reset(); }
void LineFramer::reset() { size_ = 0; dropping_ = invalid_ = completed_ = false; bytes_[0] = 0; }
bool LineFramer::push(uint8_t byte, Frame& frame) {
    if (completed_) reset();
    if (byte == '\n') {
        size_t payload = size_;
        if (payload && bytes_[payload - 1] == '\r') --payload;
        if (payload > MaxCommandBytes) dropping_ = true;
        for (size_t i = 0; i < payload; ++i) if (bytes_[i] == '\r') invalid_ = true;
        bytes_[payload] = 0;
        frame = Frame{Span{bytes_, payload}, dropping_, invalid_};
        completed_ = true;
        return payload != 0 || dropping_ || invalid_;
    }
    if (byte < 32 && byte != '\r') invalid_ = true;
    if (byte > 126) invalid_ = true;
    if (!dropping_) {
        if (size_ < MaxCommandBytes + 1) bytes_[size_++] = static_cast<char>(byte);
        else dropping_ = true;
        if (size_ == MaxCommandBytes + 1 && bytes_[size_ - 1] != '\r') dropping_ = true;
    }
    return false;
}

Header recoverHeader(Span line) {
    Header h = {false, 0, Span{NULL, 0}};
    if (line.size < 6 || line.data[0] != 'C' || line.data[1] != '|') return h;
    size_t separator = 2;
    while (separator < line.size && line.data[separator] != '|') ++separator;
    if (separator == line.size) return h;
    h.version = Span{line.data + 2, separator - 2};
    // Version tokens need not fit a machine integer to be recognized as unsupported.
    if (!number(h.version).syntax) return h;
    const size_t start = ++separator;
    while (separator < line.size && line.data[separator] != '|') ++separator;
    if (separator == line.size) return h;
    const Number id = number(Span{line.data + start, separator - start});
    if (!id.syntax || id.overflow || id.value == 0 || id.value > MaxCommandId) return h;
    h.recovered = true; h.id = id.value; return h;
}

bool parseHello(Span line, Error& e) {
    if (line.size < 5 || memcmp(line.data, "HELLO", 5) != 0) return false;
    e = Error::MalformedCommand;
    Span fields[2];
    if (split(line, '|', fields, 2) != 2 || !fields[0].equals("HELLO") || !number(fields[1]).syntax) return true;
    e = fields[1].equals("1") ? Error::None : Error::UnsupportedVersion;
    return true;
}

Error parseCommand(Span line, const Capabilities& caps, Command& c) {
    const Header h = recoverHeader(line);
    if (!h.recovered) return Error::MalformedCommand;
    c = Command{}; c.id = h.id;
    if (!h.version.equals("1")) return Error::UnsupportedVersion;
    for (size_t i = 0; i < line.size; ++i) if (line.data[i] < 32 || static_cast<unsigned char>(line.data[i]) > 126) return Error::MalformedCommand;
    Span fields[9]; const size_t n = split(line, '|', fields, 9);
    if (n < 5) return Error::MalformedCommand;
    const bool display = fields[3].equals("D"), speaker = fields[3].equals("S");
    size_t args = 0;
    if (display && fields[4].equals("TEXT")) { c.action = Action::Text; args = 1; }
    else if (display && fields[4].equals("IMAGE")) { c.action = Action::Image; args = 1; }
    else if (display && fields[4].equals("CLEAR")) c.action = Action::Clear;
    else if (speaker && fields[4].equals("TONE")) { c.action = Action::Tone; args = 3; }
    else if (speaker && fields[4].equals("MELODY")) { c.action = Action::Melody; args = 2; }
    else if (speaker && fields[4].equals("SOUND")) { c.action = Action::Sound; args = 1; }
    else if (speaker && fields[4].equals("STOP")) c.action = Action::Stop;
    else return Error::UnsupportedAction;
    if ((display && !caps.display) || (speaker && !caps.speaker)) return Error::UnsupportedOutput;
    if (n != 5 + args) return Error::MalformedCommand;
    if (!args) return Error::None;
    if (c.action == Action::Text || c.action == Action::Image) {
        const Span value = fields[5];
        for (size_t i = 0; i < value.size; ++i) {
            if (c.action == Action::Text ? !textChar(value.data[i]) : (value.data[i] < '0' || value.data[i] > '9')) return Error::InvalidText;
        }
        if (c.action == Action::Text) {
            if (value.size == 0 || value.size > 32) return Error::OutOfRange;
            copy(value, c.text);
        } else {
            if (value.size != 25) return Error::OutOfRange;
            for (size_t i = 0; i < 25; ++i) c.pixels[i] = static_cast<uint8_t>(value.data[i] - '0');
        }
        return Error::None;
    }
    if (c.action == Action::Sound) {
        if (!soundName(fields[5])) return Error::MalformedCommand;
        if (!caps.hasSound(fields[5])) return Error::UnsupportedSound;
        copy(fields[5], c.sound); c.volume = 128; return Error::None;
    }
    bool range = false;
    if (c.action == Action::Tone) {
        const Number hz = number(fields[5]), ms = number(fields[6]), volume = number(fields[7]);
        if (!hz.syntax || !ms.syntax || !volume.syntax) return Error::MalformedCommand;
        if (hz.overflow || ms.overflow || volume.overflow || !frequency(hz.value) || ms.value < 1 || ms.value > 10000 || volume.value > 255) return Error::OutOfRange;
        c.notes[0] = Note{hz.value, ms.value}; c.noteCount = 1; c.volume = static_cast<uint8_t>(volume.value);
        return Error::None;
    }
    const Number volume = number(fields[5]);
    if (!volume.syntax) return Error::MalformedCommand;
    range = volume.overflow || volume.value > 255;
    // Parse every note's syntax, even beyond the allowed note count, before ranges.
    Span rest = fields[6]; size_t start = 0, notes = 0; uint64_t total = 0;
    for (size_t i = 0; i <= rest.size; ++i) {
        if (i != rest.size && rest.data[i] != ',') continue;
        Span pair[2];
        if (split(Span{rest.data + start, i - start}, ':', pair, 2) != 2) return Error::MalformedCommand;
        const Number hz = number(pair[0]), ms = number(pair[1]);
        if (!hz.syntax || !ms.syntax) return Error::MalformedCommand;
        if (hz.overflow || ms.overflow || !frequency(hz.value) || ms.value < 1 || ms.value > 10000) range = true;
        total += ms.value;
        if (notes < 16) c.notes[notes] = Note{hz.value, ms.value};
        ++notes; start = i + 1;
    }
    if (range || notes > 16 || total > 10000) return Error::OutOfRange;
    c.noteCount = notes; c.volume = static_cast<uint8_t>(volume.value); return Error::None;
}

bool validSnapshot(const Snapshot& s) {
    return s.a <= 1 && s.b <= 1 && s.q <= 1 && s.x >= -8192 && s.x <= 8192 &&
        s.y >= -8192 && s.y <= 8192 && s.z >= -8192 && s.z <= 8192 &&
        s.temperature >= -40 && s.temperature <= 125 && s.light <= 255 && s.microphone <= 255;
}
size_t encodeSnapshot(const Snapshot& s, char* out, size_t capacity) {
    if (!validSnapshot(s)) { if (capacity) out[0] = 0; return 0; }
    return checked(snprintf(out, capacity,
        "{\"n\":%" PRIu32 ",\"u\":%" PRIu32 ",\"a\":%u,\"b\":%u,\"ac\":%" PRIu32 ",\"bc\":%" PRIu32
        ",\"x\":%" PRId32 ",\"y\":%" PRId32 ",\"z\":%" PRId32 ",\"t\":%" PRId32
        ",\"l\":%u,\"m\":%u,\"q\":%u,\"qc\":%" PRIu32 "}\n",
        s.n, s.u, static_cast<unsigned>(s.a), static_cast<unsigned>(s.b), s.ac, s.bc,
        s.x, s.y, s.z, s.temperature, static_cast<unsigned>(s.light), static_cast<unsigned>(s.microphone), static_cast<unsigned>(s.q), s.qc), out, capacity);
}
size_t encodeDeviceInfo(const Capabilities& caps, char* out, size_t capacity) {
    if (!caps.display || !caps.speaker || caps.soundCount > 16 || (caps.soundCount && !caps.sounds)) { if (capacity) out[0] = 0; return 0; }
    Builder b(out, capacity);
    b.add("{\"type\":\"deviceInfo\",\"protocolVersion\":1,\"board\":\"microbit-v2\",\"snapshotIntervalMs\":20,\"capabilities\":{\"sensors\":[\"buttons\",\"accelerometer\",\"temperature\",\"light\",\"microphone\",\"logoTouch\"],\"outputs\":{\"ledDisplay\":[\"showText\",\"showImage\",\"clear\"],\"speaker\":[\"playTone\",\"playMelody\",\"playBuiltInSound\",\"stop\"],\"builtInSounds\":[");
    for (size_t i = 0; i < caps.soundCount; ++i) {
        if (!caps.sounds[i] || !soundName(Span{caps.sounds[i], strlen(caps.sounds[i])})) { if (capacity) out[0] = 0; return 0; }
        for (size_t j = 0; j < i; ++j) if (strcmp(caps.sounds[i], caps.sounds[j]) == 0) { if (capacity) out[0] = 0; return 0; }
        if (i) b.add(",");
        b.add("\""); b.add(caps.sounds[i]); b.add("\"");
    }
    b.add("]}}}\n"); const size_t n = b.finish();
    if (n > MaxDeviceBytes + 1) { if (capacity) out[0] = 0; return 0; }
    return n;
}
size_t encodeResult(uint32_t id, Error e, char* out, size_t capacity) {
    if (id) return checked(e == Error::None ? snprintf(out, capacity, "R|1|%" PRIu32 "|OK\n", id) :
        snprintf(out, capacity, "R|1|%" PRIu32 "|ERR|%s\n", id, errorName(e)), out, capacity);
    return checked(snprintf(out, capacity, "ERR|%s\n", errorName(e)), out, capacity);
}

DigitalInput::DigitalInput() : raw_(false), stable_(false), initialized_(false), changedAt_(0), count_(0) {}
void DigitalInput::update(bool raw, uint32_t now) {
    if (!initialized_ || raw != raw_) { raw_ = raw; changedAt_ = now; initialized_ = true; }
    if (stable_ != raw_ && static_cast<uint32_t>(now - changedAt_) >= DebounceMs) {
        stable_ = raw_; if (stable_) ++count_;
    }
}
PeriodicDeadline::PeriodicDeadline(uint32_t interval) : interval_(interval), next_(0), missed_(0), initialized_(false) {}
bool PeriodicDeadline::due(uint32_t now) {
    if (!interval_) return false;
    if (!initialized_) { next_ = now; initialized_ = true; }
    const uint32_t late = now - next_;
    if (late >= 0x80000000u) return false;
    const uint32_t skipped = late / interval_;
    missed_ += skipped; next_ += (skipped + 1) * interval_; return true;
}
} // namespace mikrobit
