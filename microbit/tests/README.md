# Firmware Host Tests

The CMake/CTest suite compiles the **same core sources** as the V2 firmware with fake hardware and deterministic clocks. It requires a C++11 compiler, CMake and Python 3, with no CODAL download or board.

```sh
cmake -S microbit -B microbit/build/host -DCMAKE_BUILD_TYPE=Debug -DMIKROBIT_SANITIZERS=ON
cmake --build microbit/build/host
ctest --test-dir microbit/build/host --output-on-failure
```

`cmake -S microbit/tests` is also supported with a separate build directory. Sanitizers apply on GCC/Clang; omit that option for MSVC. The core builds without exceptions or RTTI; the test runner uses exceptions to report assertions.

CTest runs:

- `firmware_core`: framing/chunk splits, LF/CRLF and invalid bytes, canonical numeric syntax and overflow, validation precedence, command IDs and session barriers, partial TX, debounce/time wrap, complete-snapshot validation/coalescing, encoder bounds, output replacement/cancellation/deadlines, execution faults, bounded RX/control queues and backpressure, plus 100,000 deterministic framing-fuzz bytes.
- `shared_fixtures`: Python drives the compiled `firmware_simulator` against the repository's [conformance.json](../../spec/contracts/microbit-webapp/fixtures/conformance.json). It checks every command result, the positive V2 metadata object, valid fixed-schema snapshot encodings and batched CRLF commands. No copied JSON schema or JSON library enters firmware.

The simulator accepts raw protocol bytes on stdin; `--command`, `--info` and `--snapshot` provide fixture entry points. It uses fake outputs, does not run a real-time acquisition loop and is not a browser implementation. JSON rejection, sequence filtering and derived game inputs remain browser tests. Tests cover clock/debounce wrap and maximum encoded counters; natural lifetime counter/sequence wrap and physical timing still need the accelerated hardware tests.

The [CI workflow](../../.github/workflows/microbit-firmware.yml) runs sanitized host tests and a separate pinned V2 cross-build, uploading HEX/ELF/map/provenance. It does not require or claim a connected board. See [validation results](../results/implementation-validation.md) for the local run and remaining hardware gates.
