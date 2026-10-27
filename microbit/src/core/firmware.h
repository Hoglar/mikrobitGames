#pragma once
#include "outputs.h"

namespace mikrobit {
struct Diagnostics {
    uint32_t malformed, oversized, sensorFailures, coalescedSnapshots, staleSnapshots, outputFailures, txStalls;
};

// Externally serialized by the application. Methods never yield or allocate.
class Firmware {
public:
    explicit Firmware(OutputHardware& hardware, Capabilities capabilities = defaultCapabilities());
    bool canReceive() const;
    void receive(uint8_t byte, uint32_t now);
    void publish(const Snapshot& snapshot);
    void serviceOutputs(uint32_t now);
    // A borrowed span remains valid until consumeTx; only one TX owner may use it.
    Span tx(uint32_t now);
    void consumeTx(size_t bytes, uint32_t now);
    void transportFault();
    bool streaming() const { return state_ == Streaming; }
    uint32_t epoch() const { return epoch_; }
    uint32_t highId() const { return highId_; }
    const Diagnostics& diagnostics() const { return diagnostics_; }
private:
    enum State { Waiting, Starting, Streaming };
    enum Kind { Result, Info, Sensor };
    struct Message { char bytes[1026]; size_t size; Kind kind; uint32_t epoch; };
    State state_;
    Capabilities caps_;
    Outputs outputs_;
    LineFramer framer_;
    Message controls_[4], current_;
    size_t head_, count_, txOffset_;
    uint32_t epoch_, highId_, sequence_, lastProgress_;
    bool currentValid_, snapshotPending_;
    Snapshot snapshot_;
    Diagnostics diagnostics_;
    void handle(const Frame& frame, uint32_t now);
    void result(uint32_t id, Error error);
    void beginSession();
    bool stopSession();
};
}
