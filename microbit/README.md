# micro:bit V2 C++ Firmware

C++11/CODAL firmware implements the shared web-game input protocol on **V2 boards only**. It streams full sensor snapshots after `HELLO|1`, tracks debounced A/B/logo presses, and handles display/speaker commands without waiting for playback to complete. No game-specific configuration is required.

Host tests and the pinned V2 cross-build run successfully. Physical board verification is still required; see [validation results](results/implementation-validation.md). ADR-008 remains Proposed until its hardware acceptance gates pass.

## Build and Test

Run from the repository root on Linux or WSL. Install Git, Python 3, CMake, a native C++ compiler, Make/Ninja and the GNU Arm embedded compiler with newlib/C++ libraries. For Ubuntu:

```sh
sudo apt-get update
sudo apt-get install -y build-essential cmake ninja-build git python3 gcc-arm-none-eabi libnewlib-arm-none-eabi libstdc++-arm-none-eabi-newlib
cmake -S microbit -B microbit/build/host -G Ninja -DCMAKE_BUILD_TYPE=Debug -DMIKROBIT_SANITIZERS=ON
cmake --build microbit/build/host
ctest --test-dir microbit/build/host --output-on-failure
python3 microbit/toolchain/build.py
```

The wrapper fetches immutable revisions from [toolchain/lock.json](toolchain/lock.json), initializes pinned submodules, checks runtime sources for local changes, and builds our `src/` with the upstream bootstrap. First use requires network access. `--prepare-only` fetches/configures without compiling. Later builds reuse generated dependencies under `.build/`; they do not update branches. Application warnings are errors. BLE/SoftDevice and serial diagnostics are disabled; scheduler tick is 1 ms. Radio services are never started.

`toolchain/compiler-compat.cmake` corrects the pinned bootstrap's obsolete dependency-file placeholder. This is required for reliable incremental header rebuilds with modern CMake. Before this correction, a hardware run exposed stale objects with inconsistent application layouts despite a successful link. Rebuild with the current wrapper; do not flash images from that older build setup. The optional [ELF layout audit](verification/README.md) also checks for inconsistent compiled project types.

Artifacts are staged in `microbit/build/v2/`:

- `MICROBIT.hex`: flash this V2 image.
- `MICROBIT`: ELF with debug symbols; `MICROBIT.map`: linker map.
- `compile_commands.json` and `codal_extra_definitions.h`: effective application build configuration.
- `provenance.json`: dependency/submodule pins, tool versions, source/artifact hashes, repository dirty state, size and linker symbols.

The upstream raw BIN includes a large address gap to UICR and is not staged. Generated files are ignored by Git. Preserve provenance beside any image used for verification. Build dependencies are pinned; host tools are recorded rather than supplied in a hermetic image. Different compiler versions or source paths can change artifacts. A native Windows cross-build is not verified; Windows can flash an image built with WSL.

To rebuild every object without deleting dependencies, run `cmake --build microbit/.build/codal/build --target clean`, then the wrapper. Dependency upgrades require new software and hardware results.

## Flash and Verify

1. Connect a physical V2 using a USB data cable. Close other applications holding its serial port.
2. Copy `microbit/build/v2/MICROBIT.hex` to its mounted `MICROBIT` drive. Wait for flashing and check for `FAIL.TXT`.
3. Use the browser adapter or the [serial smoke tool](verification/README.md), with 115200 baud, 8N1 and no flow control. The firmware is silent until a valid handshake.
4. Record the board/interface revisions and run the [hardware test plan](spec/test-plan.md). Host tests and a successful cross-build do not establish physical axis signs, cadence, audio quality, pulse detection or runtime memory headroom.

No V1 image or Universal HEX is produced.

## Implementation and Specifications

- [Source layout](src/README.md), [CODAL bindings](src/platform/codal/README.md), and [implementation design](spec/firmware-implementation.md).
- [Authoritative serial contract](../spec/contracts/microbit-webapp/microbit-serial-protocol.md) and [game-facing interface](../spec/contracts/microbit-webapp/web-page-developer-interface.md).
- [Host tests](tests/README.md), [hardware verification](verification/README.md), and [results](results/README.md).

`mikrobit::Application* application` is debugger-visible. Inspect `application->stats` and `application->firmware.diagnostics()` for service gaps, acquisition failures/overruns, RX overflow, coalesced snapshots, malformed input, output failures and TX stalls. Normal firmware never prints diagnostics on the protocol port. The component diagram remains a placeholder; the implementation design describes component ownership.
