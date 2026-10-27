#pragma once
#include <stddef.h>
#include <stdint.h>

namespace mikrobit {
template<size_t Capacity> class ByteRing {
public:
    ByteRing() : head_(0), size_(0) {}
    bool push(uint8_t byte) { if (size_ == Capacity) return false; bytes_[(head_ + size_) % Capacity] = byte; ++size_; return true; }
    bool pop(uint8_t& byte) { if (!size_) return false; byte = bytes_[head_]; head_ = (head_ + 1) % Capacity; --size_; return true; }
    void clear() { head_ = size_ = 0; }
    size_t size() const { return size_; }
private:
    uint8_t bytes_[Capacity];
    size_t head_, size_;
};
}
