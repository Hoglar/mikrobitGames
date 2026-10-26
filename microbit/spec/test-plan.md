# Micro:bit Hardware Test Plan

## Purpose and Scope

This plan verifies firmware on real V1/V2 boards against the [serial protocol](../../spec/contracts/microbit-webapp/microbit-serial-protocol.md). It covers capabilities, full snapshots, cumulative presses, commands, recovery, and performance. The protocol owns all schemas, limits, deadlines, and error names; tests must not substitute runtime-specific values.

Run shared [conformance fixtures](../../spec/contracts/microbit-webapp/fixtures/README.md) against firmware parsing/validation in a host-side harness where the chosen runtime permits it. Those checks run without a board and are separate from hardware verification. The plans and fixture corpus are specifications; neither firmware nor its runner exists yet.

## Connection and Skip Rules

- Use the protocol's serial settings and paced host writer. Start each ordinary case with `HELLO|1`, valid `deviceInfo`, and a first valid snapshot within the handshake deadline. Establish baselines before measuring events.
- With no connected/selected board, mark hardware cases **SKIPPED** with `micro:bit not connected`. Never mark them passed or fail solely because hardware is absent. Software fixture checks still run.
- A selected port that opens but fails the handshake is a **FAIL**, not a skip.
- Check mandatory capabilities against the independently recorded physical board generation. A missing required V2 feature fails startup/capability verification; it cannot silently turn its test into a skip. Skip only genuinely unsupported V1 features, retaining V1 speaker-rejection checks.
- An **unexpected** mid-case disconnect fails that case and skips remaining hardware cases. Expected disconnect/reset/recovery steps in HW-15/HW-18 are exempt; pass/fail depends on their specified recovery outcome. Restore a ready connection before continuing the suite.
- Operator movement/touch prompts require an observed corresponding change. Unchanged messages alone cannot pass a physical input test.

## Test Cases

| ID | Test | Procedure and expected result |
|---|---|---|
| HW-01 | Startup and capabilities | Confirm no snapshots before `HELLO`. Validate the real board's mandatory capabilities, interval, and advertised sounds. `deviceInfo` is one compact JSON line followed by a valid first snapshot before the handshake deadline. Pre-handshake commands are ignored without action/results. |
| HW-02 | Snapshot schema | Capture at least 30 seconds. Check every required field, exact wire types/ranges, absence of unavailable V2 fields, and modular `n`/`u` progression. No wrappers, repeated metadata, derived fields, nulls, or debug output. |
| HW-03 | Serial framing | Split `HELLO` and valid commands at each byte boundary, and send several commands in one paced stream. Test LF and CRLF. Incomplete lines do nothing; complete lines produce exactly one appropriate result. Snapshot/result bytes never interleave. |
| HW-04 | Buttons and counters | Hold/release A/B independently and together; inspect state and cumulative counters. Use repeatable pulses meeting the wire minimum, including a press whose pressed snapshot is discarded at the host. Every debounced press increments once; later counters retain it even when latest state is released. Record instrumented versus manual stimulus timing. |
| HW-05 | Accelerometer | Hold flat face-up, then lower each edge and shake. Verify configured range, coherent signed mg axes, and the contract's physical axis signs. Firmware sends no tilt/gesture fields; browser classification is tested separately. |
| HW-06 | Board-specific schema | Validate V1/V2 against the shared fixtures. V1 omits `m`, `q`, `qc`; V2 supplies all three. Counter values are not reset by a repeated handshake. |
| HW-07 | Light | Cover/expose the display under repeatable illumination; `l` changes in the expected direction within the fixed wire range. Repeat while scrolling/showing an image to identify runtime interaction. |
| HW-08 | Temperature | Read after startup and mild normal-operation warming; `t` remains a valid integer estimate. Record values without claiming ambient accuracy. |
| HW-09 | Microphone | On V2, compare quiet and louder stimuli within the fixed wire range. Repeat during speaker playback and document self-pickup; no echo cancellation is required. |
| HW-10 | Logo touch and counter | On V2, touch/release and verify `q`/`qc`. Discard a touched snapshot and verify its press survives in the next counter. Skip on V1. |
| HW-11 | Display and replacement | Send text, then an image before scrolling finishes, then clear. Each gets a correlated `OK`; new output replaces the scroll and clear cancels it permanently. Check brightness mapping, row-major orientation, allowed text, and bounded scroll duration. Invalid commands leave the active display unchanged. |
| HW-12 | Speaker and replacement | On V2 exercise tone, rest, melody, each advertised sound, replacement, and stop during each mode. Check volumes and maximum duration. On V1, a recognized speaker action returns `UNSUPPORTED_OUTPUT` with no sensor interruption. Invalid commands do not stop existing playback. |
| HW-13 | Invalid commands | Run fixture and boundary cases for versions, fields, numeric syntax, IDs, targets/actions, text/images, audio, and sound names. Check exact uppercase errors and precedence; malformed/no-ID commands use uncorrelated errors. Test unsupported/malformed `HELLO` separately: it stops streaming/outputs until valid `HELLO` restarts the session. Other invalid commands leave snapshot streaming active. |
| HW-14 | Concurrent input/output | Stream snapshots while repeatedly replacing display/audio. Verify cadence/result targets, no blocking/hang, and intact JSON/text lines. STOP/CLEAR remain responsive during long output. |
| HW-15 | Disconnect and reconnect | Intentionally unplug/reconnect, then separately close/reopen the host port without rebooting the board. Verify a fresh barrier and baselines; boot counters continue unless the board rebooted. No stale output resumes after `deviceInfo`. Expected disconnection is not an automatic test failure. |
| HW-16 | Overflow and parser recovery | Send an oversized line and an oversized unterminated prefix using paced chunks. Firmware memory remains bounded; no partial action occurs. After LF, receive `LINE_TOO_LONG` (correlated where possible), then send a valid command and verify normal operation. Include invalid bytes/control characters without stopping firmware. |
| HW-17 | Command IDs and session barrier | Send a command twice and an older ID; receive `DUPLICATE_ID` without repeating actions. Invalid commands with recoverable new IDs consume those IDs. Repeat `HELLO` while active and verify output cancellation, new `deviceInfo` ordering, reset ID tracking, and continuing boot counters. |
| HW-18 | Silence and reset recovery | Reset the application while USB remains open where supported; otherwise use a controlled transport that suppresses snapshots. Browser input becomes unavailable at the freshness deadline and recovers using one handshake, or disconnects on handshake failure. Verify new baselines and no replayed presses/commands. Record which parts exercised real reset versus injected silence. |
| HW-19 | Acquisition failure | With a fault-injection firmware build, fail an advertised sensor read. The entire snapshot is skipped, other protocol handling continues, and no null/stale reading is substituted. Extended failure causes freshness recovery/failure. Mark unavailable injection tooling as skipped with a reason, not passed. |

## Benchmarks and Release Gates

Record board generation, runtime, firmware revision, host/browser/OS, serial settings, writer pacing, and instrumentation. The contract's fixed snapshot profile and deadlines are release gates, not performance claims.

1. **Cadence:** Capture at least 60 seconds idle and 5 minutes with outputs active. Report acquisition intervals from modular `u`, host inter-arrival times, p50/p95/p99/maximum, bytes/second, gaps, parse errors, and resets. Check the protocol's fixed cadence and normal-load acquisition gates in both runs. Report injected fault periods separately rather than including them as normal-load successes.
2. **Acknowledgement:** At least 30 commands per supported action. Report first-byte-to-result and final-LF-to-result latency separately, including writer pacing, p50/p95/maximum, errors, and timeouts. Check the firmware result target and browser timeout separately; `OK` is not physical completion.
3. **Input:** Repeat at least 20 controlled button/tilt changes and measure physical stimulus to snapshot receipt. With the browser library, also check the public interface's end-to-end game-callback budget. Manual timing is approximate and cannot establish a latency pass. Snapshot spacing alone is not end-to-end latency.
4. **Output onset/cancellation:** Measure physical LED/audio onset and STOP/CLEAR interruption separately when required. Confirm the protocol's output-duration bounds.
5. **Soak:** At least 5 minutes of snapshots, counted presses, and periodic output commands. Report resets, counter errors, lost lines, disconnects, queue growth, and memory/throughput degradation. Longer runs are needed for rare faults and slow leaks.

Sequence/time/counter wraparound is exercised using fixtures and an accelerated-counter firmware build where available; waiting for natural wrap is not required. Report injected versus naturally observed behavior. Games may set tighter latency targets before a run, but cannot weaken the shared baseline gates or choose thresholds retroactively to pass measurements.

## Results Record

Record date, tester, board/runtime/firmware revisions, host setup, case IDs with `PASS`/`FAIL`/`SKIPPED`, reasons, fixture revision, benchmark sample counts/percentiles, and instrumentation limitations. All-hardware-skipped runs are **not hardware-verified**. Record a separate V1 and V2 result before claiming both supported.
