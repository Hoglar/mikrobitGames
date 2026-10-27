#include "app.h"

using namespace codal;
namespace mikrobit {
static_assert(sizeof(Application) < 16 * 1024, "Application exceeds its bounded storage budget");
Application::Application(MicroBit& device) : board_(device), stats(), firmware(board_), device_(device), rxFault_(false), discardRx_(false) {}
bool Application::initialize() {
    if (!board_.initialize()) return false;
    device_.messageBus.listen(device_.serial.id, CODAL_SERIAL_EVT_RX_FULL, this, &Application::onRxOverflow, MESSAGE_BUS_LISTENER_IMMEDIATE);
    return true;
}
void Application::onRxOverflow(Event) { rxFault_ = true; }
void Application::run() {
    create_fiber(digitalTask, this); create_fiber(sensorTask, this); create_fiber(protocolTask, this);
    create_fiber(outputTask, this); create_fiber(txTask, this);
}
void Application::digitalTask(void* self) {
    Application& app = *static_cast<Application*>(self); uint32_t last = static_cast<uint32_t>(system_timer_current_time());
    for (;;) {
        const uint32_t now = static_cast<uint32_t>(system_timer_current_time());
        const uint32_t gap = now - last; if (gap > app.stats.maxDigitalGapMs) app.stats.maxDigitalGapMs = gap; last = now;
        app.a_.update(app.board_.rawA(), now); app.b_.update(app.board_.rawB(), now); app.logo_.update(app.board_.rawLogo(), now);
        fiber_sleep(1);
    }
}
void Application::sensorTask(void* self) {
    Application& app = *static_cast<Application*>(self); PeriodicDeadline schedule;
    for (;;) {
        const uint32_t now = static_cast<uint32_t>(system_timer_current_time());
        if (schedule.due(now)) {
            Snapshot s = {}; s.u = now;
            if (app.board_.readSensors(s)) {
                // No yield while copying this record; digital tracking is another cooperative fiber.
                s.a = app.a_.pressed(); s.b = app.b_.pressed(); s.q = app.logo_.pressed();
                s.ac = app.a_.presses(); s.bc = app.b_.presses(); s.qc = app.logo_.presses();
                app.firmware.publish(s);
            } else ++app.stats.failedAcquisitions;
            const uint32_t elapsed = static_cast<uint32_t>(system_timer_current_time()) - now;
            if (elapsed > app.stats.maxAcquisitionMs) app.stats.maxAcquisitionMs = elapsed;
            app.stats.missedAcquisitions = schedule.missed();
        }
        fiber_sleep(1);
    }
}
void Application::protocolTask(void* self) {
    Application& app = *static_cast<Application*>(self); uint32_t last = static_cast<uint32_t>(system_timer_current_time());
    for (;;) {
        const uint32_t now = static_cast<uint32_t>(system_timer_current_time());
        const uint32_t gap = now - last; if (gap > app.stats.maxRxGapMs) app.stats.maxRxGapMs = gap; last = now;
        if (app.rxFault_) { app.rxFault_ = false; ++app.stats.rxOverflows; app.rx_.clear(); app.discardRx_ = true; app.firmware.transportFault(); }
        for (unsigned count = 0; count < 256; ++count) {
            const int value = app.device_.serial.read(ASYNC);
            if (value < 0) break;
            const uint8_t byte = static_cast<uint8_t>(value);
            if (app.discardRx_) { if (byte == '\n') app.discardRx_ = false; continue; }
            if (!app.rx_.push(byte)) { ++app.stats.rxOverflows; app.rx_.clear(); app.discardRx_ = byte != '\n'; app.firmware.transportFault(); }
        }
        uint8_t byte;
        while (!app.rxFault_ && app.firmware.canReceive() && app.rx_.pop(byte)) app.firmware.receive(byte, now);
        fiber_sleep(1);
    }
}
void Application::outputTask(void* self) {
    Application& app = *static_cast<Application*>(self);
    for (;;) { app.firmware.serviceOutputs(static_cast<uint32_t>(system_timer_current_time())); fiber_sleep(1); }
}
void Application::txTask(void* self) {
    Application& app = *static_cast<Application*>(self);
    for (;;) {
        const uint32_t now = static_cast<uint32_t>(system_timer_current_time());
        const Span bytes = app.firmware.tx(now);
        if (bytes.size) {
            const size_t amount = bytes.size > 32 ? 32 : bytes.size;
            const int sent = app.device_.serial.send(reinterpret_cast<uint8_t*>(const_cast<char*>(bytes.data)), static_cast<int>(amount), ASYNC);
            if (sent > 0) app.firmware.consumeTx(static_cast<size_t>(sent), now);
            else if (sent < 0) app.firmware.transportFault();
        }
        if (app.firmware.diagnostics().txStalls >= 3) microbit_reset();
        fiber_sleep(1);
    }
}
}
