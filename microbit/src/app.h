#pragma once
#include "platform/codal/board.h"
#include "core/firmware.h"
#include "core/ring-buffer.h"

namespace mikrobit {
// Debugger-visible measurements; all values are boot-relative, not protocol messages.
struct RuntimeStats {
    uint32_t rxOverflows, failedAcquisitions, missedAcquisitions;
    uint32_t maxDigitalGapMs, maxRxGapMs, maxAcquisitionMs;
};
class Application {
private:
    CodalBoard board_;
public:
    explicit Application(codal::MicroBit& device);
    bool initialize();
    void run();
    void onRxOverflow(codal::Event);
    RuntimeStats stats;
    Firmware firmware;
private:
    codal::MicroBit& device_;
    DigitalInput a_, b_, logo_;
    ByteRing<512> rx_;
    volatile bool rxFault_;
    bool discardRx_;
    static void digitalTask(void* self);
    static void sensorTask(void* self);
    static void protocolTask(void* self);
    static void outputTask(void* self);
    static void txTask(void* self);
};
}
