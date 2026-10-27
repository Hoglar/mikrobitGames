#pragma once
#include "outputs.h"
#include <string.h>

struct FakeHardware : mikrobit::OutputHardware {
    uint8_t pixels[25];
    uint32_t frequency;
    uint8_t volume;
    unsigned images, tones;
    bool failDisplay, failSound;
    FakeHardware() : frequency(0), volume(0), images(0), tones(0), failDisplay(false), failSound(false) { memset(pixels, 0, 25); }
    bool showPixels(const uint8_t* p) override { ++images; if (failDisplay) return false; memcpy(pixels, p, 25); return true; }
    uint8_t glyphColumn(char c, unsigned column) override { return static_cast<uint8_t>((static_cast<unsigned>(c) + column) & 31); }
    bool setTone(uint32_t hz, uint8_t v) override { ++tones; if (failSound) return false; frequency = hz; volume = v; return true; }
};
