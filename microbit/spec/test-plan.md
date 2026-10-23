# Micro:bit Hardware Test Plan

## Purpose and Scope

This plan defines connected-device tests for the micro:bit firmware and its bidirectional serial protocol. It covers startup/capabilities, sensor snapshots, commands for built-in outputs, recovery, and performance. Test messages and expected fields must follow the [micro:bit–webapp serial protocol](../../spec/contracts/microbit-webapp/microbit-serial-protocol.md).

These are hardware-in-the-loop tests: they are run with a physical micro:bit connected to the test device. Pure host-side unit tests for JSON helpers may run separately and are not covered here.

## Connection and Skip Rules

- Before running a hardware test, the test harness checks that a micro:bit serial device is connected and selected, then opens the port and waits for a valid `deviceInfo` message with a supported `protocolVersion`.
- If no micro:bit is connected or selected, mark every hardware test **SKIPPED** with the reason `micro:bit not connected`. Do not mark skipped tests as passed, and do not fail the test run solely because the board is absent.
- If a serial port opens but the device does not send a valid `deviceInfo` within the configured startup timeout, report a **FAIL**: the board is connected but did not complete protocol startup.
- Run version-specific tests only when `deviceInfo.capabilities` advertises the needed feature. For example, skip V2 microphone/logo/speaker tests on V1; separately verify that a V1 speaker command returns `unsupported_output`.
- If the board disconnects after a test starts, fail the active test, mark remaining hardware tests **SKIPPED** due to disconnection, and include the disconnect reason in the report.
- Sensor movement and touch tests require an operator to follow the test prompt. Do not infer pass from receiving an unchanged snapshot.

## Test Cases

| ID | Test | Procedure | Expected result |
|---|---|---|---|
| HW-01 | Startup and capabilities | Connect/restart the board and read `deviceInfo`. | One valid message arrives with the supported protocol version, board identifier, and accurate sensor/output capabilities. `commandEncoding` is either supported (`json-v1` or `text-v1`) or absent for legacy JSON mode. Unsupported hardware is not advertised. |
| HW-02 | Snapshot schema | Collect snapshots for at least 30 seconds. | Every complete line parses as JSON; each message has `type: sensorSnapshot`, required fields, correct types/units, increasing `sequence`, and non-decreasing `uptimeMs` for the current boot. V1 omits V2-only fields. |
| HW-03 | Serial framing | Have the host send commands in the advertised encoding, split across writes and as multiple newline-delimited commands in one write. Observe the incoming snapshot stream at the same time. | Firmware waits for a complete line, handles each command exactly once, emits one result per command, and continues producing parseable snapshots. |
| HW-04 | Buttons | Press and release buttons A and B separately while snapshots are collected. | The matching `buttons.a` / `buttons.b` value changes to `true` on press and back to `false` on release; the other button remains independent. |
| HW-05 | Accelerometer and gestures | Hold the board level, then place it in each supported orientation and perform shake. | `xMg`, `yMg`, and `zMg` change with orientation; values remain numeric; recognized gestures match the documented native names. The browser-side test may separately verify normalized tilt and event de-duplication. |
| HW-06 | Compass | Calibrate if needed, then rotate the board through a full turn away from strong magnetic interference. | Heading is numeric and within the documented range; readings change with rotation. Raw field axes/magnitude are numeric. Do not require exact compass direction in an uncontrolled environment. |
| HW-07 | Light | Record the reading, cover the LED display, then expose it to brighter light. | `lightLevel` changes in the expected direction and remains within the selected firmware API's range. |
| HW-08 | Temperature | Collect readings after startup and again after the board has warmed slightly. | `temperatureC` is numeric and reasonably stable; it represents the board's internal estimate, not room temperature. Record values rather than asserting ambient accuracy. |
| HW-09 | Microphone (V2) | Record in a quiet setting, then make a loud sound near the microphone. | `soundLevel` changes; `soundEvent` reports only supported values such as `quiet`/`loud`. Skip when microphone capability is absent. |
| HW-10 | Logo touch (V2) | Touch and release the logo. | `touch.logoPressed` changes on touch and release. Skip when logo-touch capability is absent. |
| HW-11 | LED display | Send `showText`, a valid 5×5 `showImage` with brightness 0–9, and `clear`. | Each command receives a matching successful `commandResult`; the requested text/image appears and clear turns all pixels off. |
| HW-12 | Speaker | On V2, send a tone, melody, advertised built-in sound, and stop. On V1, send a speaker command. | V2 acknowledges and produces the requested sound; stop halts playback. V1 returns `unsupported_output` and does not stop sensor reporting. Skip physical playback checks when capability is absent, but retain the V1 rejection check when V1 is the target. |
| HW-13 | Invalid commands | Send malformed JSON in `json-v1` or malformed fields in `text-v1`, plus unknown message/action, unsupported protocol version, invalid image dimensions/brightness, and invalid audio parameters. | Invalid complete messages are rejected safely (with an error result when a command ID is available); valid commands still work afterward; sensor reporting continues without reset. |
| HW-14 | Concurrent input/output | Run snapshot streaming while scrolling text and playing audio on V2. | Sensor snapshots continue during output. Record any cadence degradation; there is no firmware hang or malformed output. |
| HW-15 | Disconnect and reconnect | Unplug the board during streaming, reconnect it, and restart if needed. | The host detects disconnection. After reconnection the board sends fresh `deviceInfo` and snapshots; sequence/uptime restart is handled as a new boot. |

## Benchmarks

Run benchmarks on a real connected board and record board version, firmware revision, host OS, serial configuration, and configured snapshot interval.

1. **Snapshot cadence:** Collect at least 60 seconds at idle and 5 minutes while display/audio output is active. Report observed snapshot rate and p50/p95/p99/maximum inter-arrival time, sequence gaps, malformed lines, and resets. Compare against an agreed target for the configured interval.
2. **Command acknowledgement latency:** Send at least 30 commands per supported output action. Measure host write-to-`commandResult` latency and report p50/p95/maximum and timeout/error counts. An `ok` result means the command was accepted or started, not that playback or scrolling finished.
3. **Input latency:** For a button or tilt change, timestamp the test stimulus and the host's first corresponding snapshot. Repeat at least 20 times and report p50/p95/maximum. Use a repeatable stimulus; if stimulus time is only manually estimated, label the result approximate. Snapshot arrival intervals alone are not an end-to-end latency measurement.
4. **Output response (optional):** If physical completion latency matters, measure LED or audio onset separately using a camera/light sensor or microphone. Do not use command acknowledgement as a proxy for output completion.
5. **Soak:** Run for 5 minutes with continuous snapshots and periodic valid output commands. Report resets, missed sequence numbers, parse failures, disconnects, and any observed memory/throughput degradation. This is a short soak check; it is less likely than a longer run to reveal slow memory leaks or rare intermittent failures.

Before treating benchmarks as pass/fail, set numerical gameplay requirements for snapshot interval and p95 input latency. Report measured values even when no threshold is set; do not invent thresholds after observing results.

## Results Record

For each run, record: date, tester, board generation, firmware revision, host/OS, connected port, test IDs with `PASS`/`FAIL`/`SKIPPED`, skip/failure reasons, benchmark measurements, and any calibration or environmental notes. A run where all hardware tests are skipped is **not hardware-verified**.