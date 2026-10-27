#include "firmware.h"
#include "fake_hardware.h"
#include <cstdlib>
#include <iostream>
#include <string>

using namespace mikrobit;
static void drain(Firmware& firmware, bool print) {
    for (;;) {
        Span bytes = firmware.tx(0);
        if (!bytes.size) break;
        if (print) std::cout.write(bytes.data, static_cast<std::streamsize>(bytes.size));
        firmware.consumeTx(bytes.size, 0);
    }
}
static void feed(Firmware& firmware, const std::string& line, bool print) {
    for (unsigned char byte : line) { drain(firmware, print); firmware.receive(byte, 0); }
    drain(firmware, print);
}
int main(int argc, char** argv) {
    FakeHardware hardware;
    Firmware firmware(hardware);
    char buffer[1026];
    if (argc == 2 && std::string(argv[1]) == "--info") {
        const size_t n = encodeDeviceInfo(defaultCapabilities(), buffer, sizeof(buffer));
        std::cout.write(buffer, static_cast<std::streamsize>(n)); return n ? 0 : 1;
    }
    if (argc == 16 && std::string(argv[1]) == "--snapshot") {
        Snapshot s = {};
        s.n = static_cast<uint32_t>(std::strtoull(argv[2], NULL, 10)); s.u = static_cast<uint32_t>(std::strtoull(argv[3], NULL, 10));
        s.a = static_cast<uint8_t>(std::strtoul(argv[4], NULL, 10)); s.b = static_cast<uint8_t>(std::strtoul(argv[5], NULL, 10));
        s.ac = static_cast<uint32_t>(std::strtoull(argv[6], NULL, 10)); s.bc = static_cast<uint32_t>(std::strtoull(argv[7], NULL, 10));
        s.x = static_cast<int32_t>(std::strtol(argv[8], NULL, 10)); s.y = static_cast<int32_t>(std::strtol(argv[9], NULL, 10));
        s.z = static_cast<int32_t>(std::strtol(argv[10], NULL, 10)); s.temperature = static_cast<int32_t>(std::strtol(argv[11], NULL, 10));
        s.light = static_cast<uint16_t>(std::strtoul(argv[12], NULL, 10)); s.microphone = static_cast<uint16_t>(std::strtoul(argv[13], NULL, 10));
        s.q = static_cast<uint8_t>(std::strtoul(argv[14], NULL, 10)); s.qc = static_cast<uint32_t>(std::strtoull(argv[15], NULL, 10));
        const size_t n = encodeSnapshot(s, buffer, sizeof(buffer)); std::cout.write(buffer, static_cast<std::streamsize>(n)); return n ? 0 : 1;
    }
    if (argc == 4 && std::string(argv[1]) == "--command") {
        feed(firmware, "HELLO|1\n", false);
        if (std::string(argv[2]) != "0") feed(firmware, "C|1|" + std::string(argv[2]) + "|D|CLEAR\n", false);
        feed(firmware, std::string(argv[3]) + "\n", true); return 0;
    }
    // Raw serial harness: stdin bytes in, only firmware wire bytes out.
    char byte;
    while (std::cin.get(byte)) { drain(firmware, true); firmware.receive(static_cast<uint8_t>(byte), 0); drain(firmware, true); }
    return 0;
}
