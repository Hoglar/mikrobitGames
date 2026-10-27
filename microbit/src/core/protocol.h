#pragma once

#include <stddef.h>
#include <stdint.h>

namespace mikrobit {

static const size_t MaxCommandBytes = 256;
static const size_t MaxDeviceBytes = 1024;
static const uint32_t SnapshotIntervalMs = 20;
static const uint32_t DebounceMs = 20;
static const uint32_t MaxCommandId = 2147483647u;

enum class Error {
    None, LineTooLong, DuplicateId, UnsupportedVersion, MalformedCommand,
    UnsupportedAction, UnsupportedOutput, OutOfRange, InvalidText,
    UnsupportedSound, InternalError
};
const char* errorName(Error error);

struct Span {
    const char* data;
    size_t size;
    bool equals(const char* literal) const;
};

struct Note { uint32_t frequency; uint32_t duration; };
enum class Action { Text, Image, Clear, Tone, Melody, Sound, Stop };
struct Command {
    uint32_t id;
    Action action;
    char text[33];
    uint8_t pixels[25];
    Note notes[16];
    size_t noteCount;
    uint8_t volume;
    char sound[25];
};

struct Capabilities {
    bool display;
    bool speaker;
    const char* const* sounds;
    size_t soundCount;
    bool hasSound(Span name) const;
};
Capabilities defaultCapabilities();
const Note* builtInNotes(const char* name, size_t& count);

struct Frame {
    Span line;
    bool tooLong;
    bool invalidBytes;
};

// Returned frames refer to this bounded buffer until the next push/reset.
class LineFramer {
public:
    LineFramer();
    bool push(uint8_t byte, Frame& completed);
    void reset();
    size_t bufferedBytes() const { return size_; }
private:
    char bytes_[MaxCommandBytes + 2];
    size_t size_;
    bool dropping_;
    bool invalid_;
    bool completed_;
};

struct Header {
    bool recovered;
    uint32_t id;
    Span version;
};
Header recoverHeader(Span line);
Error parseCommand(Span line, const Capabilities& caps, Command& command);
bool parseHello(Span line, Error& error);

struct Snapshot {
    uint32_t n, u, ac, bc, qc;
    int32_t x, y, z, temperature;
    uint16_t light, microphone;
    uint8_t a, b, q;
};
bool validSnapshot(const Snapshot& snapshot);
size_t encodeSnapshot(const Snapshot& snapshot, char* out, size_t capacity);
size_t encodeDeviceInfo(const Capabilities& caps, char* out, size_t capacity);
size_t encodeResult(uint32_t id, Error error, char* out, size_t capacity);

class DigitalInput {
public:
    DigitalInput();
    void update(bool raw, uint32_t now);
    bool pressed() const { return stable_; }
    uint32_t presses() const { return count_; }
private:
    bool raw_, stable_, initialized_;
    uint32_t changedAt_, count_;
};

class PeriodicDeadline {
public:
    explicit PeriodicDeadline(uint32_t interval = SnapshotIntervalMs);
    bool due(uint32_t now);
    uint32_t missed() const { return missed_; }
private:
    uint32_t interval_, next_, missed_;
    bool initialized_;
};

} // namespace mikrobit
