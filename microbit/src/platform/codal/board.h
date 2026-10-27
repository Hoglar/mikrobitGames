#pragma once
#include "MicroBit.h"
#include "core/outputs.h"

namespace mikrobit {
// Two preallocated sample buffers; no per-pull allocation or queued sound expression.
class SineSource : public codal::DataSource {
public:
    SineSource();
    void initialize(codal::MicroBitAudio& audio);
    void set(uint32_t frequency, uint8_t volume);
    void connect(codal::DataSink& sink) override;
    codal::ManagedBuffer pull() override;
    int getFormat() override;
    float getSampleRate() override;
private:
    codal::DataSink* sink_;
    codal::ManagedBuffer buffers_[2];
    int16_t sine_[256];
    uint32_t phase_, increment_;
    uint8_t volume_, bufferIndex_;
};

class MicrophoneLevel : public codal::LevelDetectorSPL {
public:
    explicit MicrophoneLevel(codal::DataSource& source);
    int pullRequest() override;
    void periodicCallback() override;
    bool read(uint32_t now, uint16_t& level);
private:
    uint32_t lastSample_;
};

class CodalBoard : public OutputHardware {
public:
    explicit CodalBoard(codal::MicroBit& device);
    bool initialize();
    bool readSensors(Snapshot& snapshot);
    bool rawA();
    bool rawB();
    bool rawLogo();
    void onAcceleration(codal::Event);
    bool showPixels(const uint8_t* pixels) override;
    uint8_t glyphColumn(char character, unsigned column) override;
    bool setTone(uint32_t frequency, uint8_t volume) override;
private:
    codal::MicroBit& device_;
    SineSource sine_;
    MicrophoneLevel* microphone_;
    uint32_t accelerationAt_, temperatureAt_;
    int32_t temperature_;
    bool accelerationReady_, temperatureReady_, temperaturePending_;
    bool readTemperature(uint32_t now, int32_t& value);
};
}
