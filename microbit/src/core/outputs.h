#pragma once
#include "protocol.h"

namespace mikrobit {
class OutputHardware {
public:
    virtual ~OutputHardware() {}
    virtual bool showPixels(const uint8_t* pixels) = 0;
    virtual uint8_t glyphColumn(char character, unsigned column) = 0;
    virtual bool setTone(uint32_t frequency, uint8_t volume) = 0;
};

// All playback is advanced by deadlines; no sleeping or completion callbacks.
class Outputs {
public:
    explicit Outputs(OutputHardware& hardware);
    bool apply(const Command& command, uint32_t now);
    bool tick(uint32_t now);
    bool reset();
    uint32_t generation() const { return generation_; }
private:
    OutputHardware& hardware_;
    char text_[33];
    uint8_t image_[25];
    Note notes_[16];
    size_t textLength_, noteCount_, noteIndex_;
    uint8_t volume_;
    bool scrolling_, sounding_;
    int scrollColumn_;
    uint32_t lastColumnAt_, noteStart_, generation_;
    bool renderScroll();
    bool clearDisplay();
    bool stopSound();
};
}
