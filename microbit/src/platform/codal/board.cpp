#include "board.h"
#include <cmath>
#include "LSM303Accelerometer.h"

using namespace codal;
namespace mikrobit {
SineSource::SineSource() : sink_(NULL), phase_(0), increment_(0), volume_(0), bufferIndex_(0) {}
void SineSource::initialize(MicroBitAudio& audio) {
    buffers_[0] = ManagedBuffer(128); buffers_[1] = ManagedBuffer(128);
    for (unsigned i = 0; i < 256; ++i) sine_[i] = static_cast<int16_t>(32767.0f * sinf(6.28318530718f * i / 256.0f));
    MixerChannel* channel = audio.mixer.addChannel(*this, 44100.0f, 65535.0f);
    connect(*channel);
    sink_->pullRequest();
}
void SineSource::connect(DataSink& sink) { sink_ = &sink; }
int SineSource::getFormat() { return DATASTREAM_FORMAT_16BIT_SIGNED; }
float SineSource::getSampleRate() { return 44100.0f; }
void SineSource::set(uint32_t hz, uint8_t volume) {
    const uint32_t increment = static_cast<uint32_t>((static_cast<uint64_t>(hz) << 32) / 44100);
    target_disable_irq();
    increment_ = increment; volume_ = hz ? volume : 0; phase_ = 0;
    target_enable_irq();
}
ManagedBuffer SineSource::pull() {
    ManagedBuffer result = buffers_[bufferIndex_]; bufferIndex_ ^= 1;
    int16_t* samples = reinterpret_cast<int16_t*>(result.getBytes());
    // Audio callbacks and setters cannot interleave updates of the small parameter record.
    target_disable_irq();
    const uint32_t increment = increment_; const uint8_t volume = volume_;
    uint32_t phase = phase_;
    for (unsigned i = 0; i < 64; ++i) { samples[i] = static_cast<int16_t>(static_cast<int32_t>(sine_[phase >> 24]) * volume / 255); phase += increment; }
    phase_ = phase;
    target_enable_irq();
    if (sink_) sink_->pullRequest();
    return result;
}

MicrophoneLevel::MicrophoneLevel(DataSource& source) : LevelDetectorSPL(source, 85.0f, 65.0f, 16.0f, 35.0f, 2900), lastSample_(0) {
    // listenerAdded() calls blocking getValue(), even at a valid quiet level.
    // Demand this channel directly and override idle timeout instead.
    upstream.dataWanted(DATASTREAM_WANTED);
}
void MicrophoneLevel::periodicCallback() {}
int MicrophoneLevel::pullRequest() {
    const int result = LevelDetectorSPL::pullRequest();
    if (status & LEVEL_DETECTOR_SPL_DATA_VALID) lastSample_ = static_cast<uint32_t>(system_timer_current_time());
    return result;
}
bool MicrophoneLevel::read(uint32_t now, uint16_t& value) {
    target_disable_irq();
    const bool ready = (status & LEVEL_DETECTOR_SPL_DATA_VALID) != 0;
    const uint32_t sampledAt = lastSample_; const float sampledLevel = level;
    target_enable_irq();
    if (!ready || static_cast<uint32_t>(now - sampledAt) > 100 || !std::isfinite(sampledLevel)) return false;
    float scaled = (sampledLevel - LEVEL_DETECTOR_SPL_8BIT_000_POINT) * LEVEL_DETECTOR_SPL_8BIT_CONVERSION;
    // This is the documented SPL-to-wire normalization, not hiding a failed sensor read.
    if (scaled < 0) scaled = 0;
    if (scaled > 255) scaled = 255;
    value = static_cast<uint16_t>(scaled + 0.5f); return true;
}

CodalBoard::CodalBoard(MicroBit& device) : device_(device), microphone_(NULL), accelerationAt_(0), temperatureAt_(0),
    temperature_(0), accelerationReady_(false), temperatureReady_(false), temperaturePending_(false) {}
bool CodalBoard::initialize() {
    if (device_.serial.setBaud(115200) != DEVICE_OK) return false;
    if (device_.serial.setRxBufferSize(128) != DEVICE_OK || device_.serial.setTxBufferSize(128) != DEVICE_OK) return false;
    // The pinned target auto-detects LSM303. Its lazy requestUpdate() otherwise
    // spin-waits without a deadline for the very first DRDY. Enable explicitly,
    // then require a data-update event before publishing a cached sample.
    device_.accelerometer.status |= LSM303_A_STATUS_ENABLED;
    device_.messageBus.listen(device_.accelerometer.id, ACCELEROMETER_EVT_DATA_UPDATE, this, &CodalBoard::onAcceleration, MESSAGE_BUS_LISTENER_IMMEDIATE);
    if (device_.accelerometer.setRange(8) != DEVICE_OK || device_.accelerometer.setPeriod(20) != DEVICE_OK) return false;
    device_.display.setDisplayMode(DISPLAY_MODE_GREYSCALE_LIGHT_SENSE);
    device_.display.image.clear();
    device_.logo.calibrate();
    if (device_.audio.enable() != DEVICE_OK) return false;
    device_.audio.setPinEnabled(false);
    device_.audio.setSpeakerEnabled(true);
    device_.audio.setVolume(255);
    device_.audio.activateMic();
    microphone_ = new MicrophoneLevel(*device_.audio.rawSplitter->createChannel());
    sine_.initialize(device_.audio);
    return true;
}
bool CodalBoard::rawA() {
    device_.buttonA.setPinLock(true); const bool pressed = device_.io.buttonA.getDigitalValue() == 0;
    device_.buttonA.setPinLock(false); return pressed;
}
bool CodalBoard::rawB() {
    device_.buttonB.setPinLock(true); const bool pressed = device_.io.buttonB.getDigitalValue() == 0;
    device_.buttonB.setPinLock(false); return pressed;
}
bool CodalBoard::rawLogo() { return device_.logo.buttonActive() != 0; }
void CodalBoard::onAcceleration(Event) {
    accelerationAt_ = static_cast<uint32_t>(system_timer_current_time()); accelerationReady_ = true;
}
bool CodalBoard::readTemperature(uint32_t now, int32_t& value) {
    // DEVICE_BLE=0 gives this adapter exclusive ownership of the on-chip TEMP.
    // CODAL's thermometer uses an unbounded DATARDY spin; poll across acquisitions instead.
    if (temperaturePending_) {
        if (static_cast<uint32_t>(now - temperatureAt_) >= 100) {
            NRF_TEMP->TASKS_STOP = 1; temperaturePending_ = false; temperatureReady_ = false;
        } else if (NRF_TEMP->EVENTS_DATARDY) {
            temperature_ = static_cast<int32_t>(NRF_TEMP->TEMP) / 4;
            NRF_TEMP->TASKS_STOP = 1; NRF_TEMP->EVENTS_DATARDY = 0;
            temperatureReady_ = true; temperaturePending_ = false; temperatureAt_ = now;
        }
    }
    if (!temperaturePending_ && (!temperatureReady_ || static_cast<uint32_t>(now - temperatureAt_) >= 1000)) {
        // A recovery after other sensors failed must not re-age an old cached value.
        if (static_cast<uint32_t>(now - temperatureAt_) > 1100) temperatureReady_ = false;
        NRF_TEMP->EVENTS_DATARDY = 0; NRF_TEMP->TASKS_START = 1;
        temperaturePending_ = true; temperatureAt_ = now;
    }
    if (!temperatureReady_) return false;
    value = temperature_; return true;
}
bool CodalBoard::readSensors(Snapshot& s) {
    if (!microphone_ || (device_.logo.status & TOUCH_BUTTON_CALIBRATING) || !device_.audio.isMicrophoneEnabled()) return false;
    if (device_.accelerometer.requestUpdate() != DEVICE_OK) return false;
    const uint32_t now = static_cast<uint32_t>(system_timer_current_time());
    if (!accelerationReady_ || static_cast<uint32_t>(now - accelerationAt_) > 100) return false;
    const Sample3D axes = device_.accelerometer.getSample(SIMPLE_CARTESIAN);
    s.x = axes.x; s.y = axes.y; s.z = axes.z;
    if (!readTemperature(now, s.temperature)) return false;
    if (!(device_.display.NRF52LEDMatrix::status & NRF52_LEDMATRIX_STATUS_LIGHTREADY)) return false;
    const int light = device_.display.readLightLevel(); // Ready mode: never enters its initial fiber_sleep.
    if (light < 0 || light > 255) return false;
    s.light = static_cast<uint16_t>(light);
    if (!microphone_->read(static_cast<uint32_t>(system_timer_current_time()), s.microphone)) return false;
    return validSnapshot(s);
}
bool CodalBoard::showPixels(const uint8_t* pixels) {
    for (unsigned y = 0; y < 5; ++y) for (unsigned x = 0; x < 5; ++x) {
        if (pixels[y * 5 + x] > 9) return false;
        device_.display.image.setPixelValue(x, y, static_cast<uint8_t>((pixels[y * 5 + x] * 255u + 4) / 9));
    }
    return true;
}
uint8_t CodalBoard::glyphColumn(char character, unsigned column) {
    if (column >= 5) return 0;
    BitmapFont font = BitmapFont::getSystemFont();
    const uint8_t* rows = font.get(character);
    if (!rows) return 0;
    uint8_t bits = 0;
    for (unsigned y = 0; y < 5; ++y) if (rows[y] & (1u << (4 - column))) bits |= static_cast<uint8_t>(1u << y);
    return bits;
}
bool CodalBoard::setTone(uint32_t hz, uint8_t volume) { sine_.set(hz, volume); return true; }
}
