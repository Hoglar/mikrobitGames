# Webapp Game Input Library Test and Benchmark Plan

## Purpose and Scope

This plan covers the shared browser-side micro:bit input library used by all games. It validates serial message parsing, sensor-state normalization, stable game-facing inputs/events, connection lifecycle, and output-command handling. Follow the shared [micro:bit serial protocol](../../spec/contracts/microbit-webapp/microbit-serial-protocol.md) and [web-page developer interface](../../spec/contracts/microbit-webapp/web-page-developer-interface.md); do not duplicate their schemas here.

The library is not implemented yet, so test tooling and numerical performance targets remain to be selected during implementation. Prefer deterministic tests with a fake serial transport for most cases, plus a small number of browser and connected-device checks.

## Test Layers

1. **Unit tests (always runnable):** Test parsing, validation, normalization, state updates, gesture/button behavior, subscriptions, and command encoding with fixture data and a fake clock/transport. These must not require a physical micro:bit.
2. **Transport integration tests (always runnable):** Drive the library with a fake serial stream to exercise byte chunking, connection and disconnection, queued writes, and response correlation.
3. **Browser integration tests:** Verify Web Serial permission/connect behavior, stream reader/writer cleanup, and browser lifecycle. Use a mocked Web Serial implementation for automation; do a manual browser check on a supported browser before release.
4. **Hardware-in-the-loop tests:** Verify actual micro:bit messages and outputs. If no micro:bit is connected/selected, mark only these hardware-dependent cases **SKIPPED** with a reason; do not mark them passed. If disconnection occurs mid-test, fail the active case and skip remaining hardware cases.

## Test Cases

| ID | Test | Expected result |
|---|---|---|
| GI-01 | Parse valid `deviceInfo` and `sensorSnapshot` fixtures | Valid messages are accepted only for supported protocol versions and known message types. Board identity and capabilities are exposed to callers. |
| GI-02 | Stream framing | Parse a message split at every possible byte boundary, several messages in one read, CRLF, and a partial final line. Parse only complete newline-terminated lines; retain incomplete data for the next read. |
| GI-03 | Invalid input resilience | Malformed JSON, empty lines, unknown types, invalid field types/ranges, and unsupported versions produce a protocol error/diagnostic without crashing or corrupting the last valid state. Enforce and test a documented maximum line size. |
| GI-04 | Snapshot state and sequence | A valid full snapshot replaces current values; increasing sequence is accepted; gaps are observable for diagnostics; duplicates/older snapshots follow a documented policy. A later full snapshot restores current state. |
| GI-05 | Board-specific fields | Missing V1-only-inapplicable fields become `null` in the public state; no synthetic gyroscope reading is exposed. V2 microphone/logo fields are mapped when supplied. |
| GI-06 | Sensor normalization | Buttons, raw accelerometer, compass, temperature, light, sound, and touch map to the documented public types and units. Boundary values, nulls, and unknown optional fields are handled predictably. |
| GI-07 | Tilt mapping | Axis orientation and normalization to `[-1, 1]` are correct for fixtures. Dead-zone and smoothing behavior are deterministic with a fake clock and documented parameters; raw axes remain available. |
| GI-08 | Button and gesture events | Press/release state is retained; one-shot events are emitted according to documented edge rules. Repeated snapshots do not repeatedly emit the same gesture; a gesture can be emitted again after the documented re-arm condition. |
| GI-09 | Subscribers | Every active subscriber receives state updates in order. Unsubscribing prevents later callbacks; duplicate subscriptions, callback exceptions, and cleanup do not affect other games. |
| GI-10 | Disconnect and reconnect | Connection state transitions are correct; stale buttons/tilt are reset or marked unavailable; pending commands reject; a new `deviceInfo` and snapshot initialize state after reconnect. |
| GI-11 | Command serialization | Display and speaker API calls encode valid newline-delimited commands with unique command IDs and valid argument bounds. Unsupported capabilities fail before sending or surface the protocol error. |
| GI-12 | Command results | Matching successful results resolve the right promise; error results reject with typed errors; unknown IDs are ignored/reported; timeout and disconnect reject pending calls. Out-of-order results do not resolve the wrong command. |
| GI-13 | Write behavior | Concurrent game calls are serialized safely; each command is written once and a partial write/error is handled without silently losing or duplicating a command. |
| GI-14 | Capability-dependent API | Display methods are available on V1/V2; speaker methods require the advertised speaker capability; built-in sounds are limited to names advertised by the device. |
| GI-15 | Hardware smoke test | With a connected board, verify one button change, one tilt change, snapshot delivery, display output, and (on V2) speaker output via the library API. Skip V2-only checks on boards without those capabilities. |

## Benchmarks

Use deterministic, recorded snapshot fixtures for repeatable software benchmarks; do not require a physical micro:bit for these. Record browser/version, host, fixture size, message rate, subscriber count, and build mode.

1. **Parse and normalize throughput:** Replay representative sensor snapshots at the expected rate and at a stress rate. Report messages/second, invalid lines, and CPU time per message.
2. **Input propagation latency:** Measure from receipt of a complete line to state update and subscriber callback using `performance.now()`. Report p50/p95/p99/maximum for one and multiple subscribers.
3. **Sustained processing:** Replay a 5-minute stream at expected load. Verify no growing queue, duplicate callbacks, unbounded memory growth, or increasing processing latency.
4. **Output command round trip (hardware):** When a board is connected, measure host write-to-`commandResult` latency and timeout/error counts per output command. The acknowledgement indicates accepted/started, not physical display/audio completion.
5. **End-to-end input latency (hardware):** Measure physical button/tilt stimulus to game-facing callback over repeated trials. Report the measurement method and distinguish approximate manual timing from instrumented timing.

Set target latency and throughput thresholds before using the benchmarks as pass/fail gates. Start by confirming that normal operation meets the game’s responsiveness budget; stress results should document the point at which messages queue, latency exceeds budget, or errors appear. Avoid rejecting a change solely on timing noise—use repeated runs and compare with a recorded baseline.

## Reporting

Record test IDs and `PASS`/`FAIL`/`SKIPPED`, skip/failure reason, software revision, browser/OS, board version and firmware for hardware runs, and benchmark sample counts plus p50/p95/p99/maximum. A run with all hardware cases skipped is not a hardware verification; unit, fake-transport, and browser-mock tests should still run.