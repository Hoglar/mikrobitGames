# V2 C++ Firmware Source

No firmware source is implemented yet. Follow the [implementation design](../spec/firmware-implementation.md) for the planned `main.cpp`, hardware-independent `core/`, CODAL adapters in `platform/codal/`, and application/task orchestration. The [module README](../README.md) documents build integration and flashing. Keep host tests outside this directory so CODAL source discovery does not compile a test runner into the firmware.
