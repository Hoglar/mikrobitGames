# Firmware Host Tests

The planned tests compile the hardware-independent C++ core on Linux with native GCC or Clang, without CODAL or a physical board. They are not implemented yet. Use the [shared corpus](../../spec/contracts/microbit-webapp/fixtures/README.md) and [firmware test plan](../spec/test-plan.md); do not copy a separate protocol schema into the runner.

## Planned Test Project

Create a standalone `CMakeLists.txt` here, enable CTest, and build the same core sources used by firmware with fake clock, transport, sensors, and outputs. Any host JSON fixture loader is test-only and must not become a firmware dependency. Fixture interpretation for firmware covers parsing, encoding, metadata, sequences, and session behavior; browser-only tilt/shake/sound-label expectations are tested by the webapp runner.

After that test project exists, run from the repository root:

```sh
cmake -S microbit/tests -B microbit/build/host -DCMAKE_BUILD_TYPE=Debug
cmake --build microbit/build/host
ctest --test-dir microbit/build/host --output-on-failure
```

These are intended commands, not currently runnable targets. Add an AddressSanitizer/UndefinedBehaviorSanitizer configuration on a supported host compiler, retaining C++11 semantics and unsigned wrap tests. Record compiler/version and fixture revision in results.

## Required Coverage

- Every command action, error precedence, checked decimal overflow, boundaries, unsupported board metadata, and exact wire encoding.
- LF/CRLF, all chunk splits, unknown/invalid bytes, bounded unterminated overflow, and resynchronization without partial execution.
- Digital debounce/counts, coherent snapshots, sensor failure, deadline overrun, and unsigned counter/time wrap.
- Repeated handshakes during active TX/output, ID consumption/rejection, generation-tagged stale callbacks, and ordering around `deviceInfo`.
- Bounded mailboxes, asynchronous object lifetime, playback replacement/STOP/CLEAR, audio-input continuity, and backpressure failures.

CI must run these tests and a pinned V2 cross-build without requiring hardware. Use a separate optional hardware job for the physical checks. Missing hardware skips only hardware cases, never host tests. A host pass does not establish actual sensor/API timing or resource use.
