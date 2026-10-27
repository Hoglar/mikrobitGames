#include "outputs.h"
#include <string.h>

namespace mikrobit {
Outputs::Outputs(OutputHardware& hardware) : hardware_(hardware), textLength_(0), noteCount_(0), noteIndex_(0), volume_(0),
    scrolling_(false), sounding_(false), scrollColumn_(0), lastColumnAt_(0), noteStart_(0), generation_(0) {
    memset(text_, 0, sizeof(text_)); memset(image_, 0, sizeof(image_)); memset(notes_, 0, sizeof(notes_));
}
bool Outputs::clearDisplay() { scrolling_ = false; memset(image_, 0, sizeof(image_)); return hardware_.showPixels(image_); }
bool Outputs::stopSound() { sounding_ = false; noteCount_ = 0; return hardware_.setTone(0, 0); }
bool Outputs::reset() { ++generation_; const bool display = clearDisplay(); const bool sound = stopSound(); return display && sound; }
bool Outputs::renderScroll() {
    memset(image_, 0, sizeof(image_));
    for (int x = 0; x < 5; ++x) {
        const int source = scrollColumn_ + x;
        if (source < 0 || static_cast<size_t>(source) >= textLength_ * 6) continue;
        const unsigned column = static_cast<unsigned>(source % 6);
        const uint8_t bits = column == 5 ? 0 : hardware_.glyphColumn(text_[source / 6], column);
        for (int y = 0; y < 5; ++y) image_[y * 5 + x] = (bits & (1u << y)) ? 9 : 0;
    }
    return hardware_.showPixels(image_);
}
bool Outputs::apply(const Command& c, uint32_t now) {
    ++generation_;
    if (c.action == Action::Clear) return clearDisplay();
    if (c.action == Action::Image) {
        scrolling_ = false; memcpy(image_, c.pixels, 25);
        if (!hardware_.showPixels(image_)) { clearDisplay(); return false; }
        return true;
    }
    if (c.action == Action::Text) {
        memcpy(text_, c.text, sizeof(text_)); textLength_ = strlen(text_);
        scrolling_ = true; scrollColumn_ = -5; lastColumnAt_ = now;
        if (!renderScroll()) { clearDisplay(); return false; }
        return true;
    }
    if (c.action == Action::Stop) return stopSound();
    if (!stopSound()) return false;
    const Note* notes = c.notes; size_t count = c.noteCount;
    if (c.action == Action::Sound) notes = builtInNotes(c.sound, count);
    if (!notes || count == 0 || count > 16) return false;
    memcpy(notes_, notes, count * sizeof(Note)); noteCount_ = count; noteIndex_ = 0;
    noteStart_ = now; volume_ = c.volume; sounding_ = true;
    if (!hardware_.setTone(notes_[0].frequency, volume_)) { stopSound(); return false; }
    return true;
}
bool Outputs::tick(uint32_t now) {
    bool ok = true;
    if (scrolling_) {
        const uint32_t columns = static_cast<uint32_t>(now - lastColumnAt_) / 50;
        if (columns) {
            if (columns >= textLength_ * 6 + 5 || scrollColumn_ + static_cast<int>(columns) >= static_cast<int>(textLength_ * 6)) ok = clearDisplay();
            else { scrollColumn_ += static_cast<int>(columns); lastColumnAt_ += columns * 50; ok = renderScroll(); }
            if (!ok) clearDisplay();
        }
    }
    if (sounding_) {
        const size_t oldIndex = noteIndex_;
        while (noteIndex_ < noteCount_ && static_cast<uint32_t>(now - noteStart_) >= notes_[noteIndex_].duration) {
            noteStart_ += notes_[noteIndex_].duration; ++noteIndex_;
        }
        if (noteIndex_ == noteCount_) { if (!stopSound()) ok = false; }
        else if (noteIndex_ != oldIndex && !hardware_.setTone(notes_[noteIndex_].frequency, volume_)) { stopSound(); ok = false; }
    }
    return ok;
}
}
