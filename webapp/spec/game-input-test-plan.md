# Webapp Game Input Library Test and Benchmark Plan

## Purpose and Scope

Verify the shared adapter against the [serial contract](../../spec/contracts/microbit-webapp/microbit-serial-protocol.md), [public API](../../spec/contracts/microbit-webapp/web-page-developer-interface.md), and [shared fixtures](../../spec/contracts/microbit-webapp/fixtures/README.md). They own schemas, formulas, bounds, deadlines, error codes, and lifecycle policy. The library and its runner are not implemented yet; tests below specify expected behavior.

Follow the [JavaScript implementation plan](game-input-implementation-plan.md) for module boundaries and delivery order. The component specification's mandatory connection/pause/reconnect/exit flow is verified through the platform example; the library itself does not save scores or results.

## Test Layers

1. **Unit tests, always runnable:** Fixture parsing, exact validation, normalization, counters, gesture/sound history, immutable state, subscriptions, and encoding using a fake clock. No board required.
2. **Transport integration, always runnable:** A fake byte stream exercises framing, paced writes, result correlation, bounded queues, faults, session barriers, recovery, and game disposal.
3. **Browser integration:** Mock Web Serial for automation; manually check a supported secure-context browser before release. Cover permission grant/denial/cancellation, unsupported browser, reader/writer locks, port close, and page lifecycle.
4. **Hardware integration:** Verify messages/outputs on supported V2 hardware only. V1 is an unsupported-identity host fixture, not a required physical device. Without a selected board, skip only hardware cases; software tests still run. Unexpected disconnection fails the active case; intentional disconnect/reset steps are evaluated by expected recovery.

## Test Cases

| ID | Test | Expected result |
|---|---|---|
| GI-01 | Startup and capabilities | Send `HELLO` using protocol settings/pacing. `connect()` resolves only after valid `deviceInfo` and first valid snapshot within the deadline. Verify required board capabilities, interval, sound-name bounds/uniqueness, unknown metadata, and read-only capability exposure. Concurrent connect calls share one operation. |
| GI-02 | Framing | Split each fixture at every byte boundary, batch multiple lines, and test LF/CRLF, empty lines, and partial EOF. Only complete lines parse; strip exactly one final CR. A partial final line is discarded on close, not carried into another session. |
| GI-03 | Invalid input and memory bounds | Reject malformed JSON, duplicate JSON keys, typed/shape errors, nulls, boolean-as-integer values, range errors, and wrong board fields. Unknown keys are ignored. Overlong unterminated data stays bounded; discard through LF, report once, then parse the next valid line. Invalid data never refreshes freshness. |
| GI-04 | Sequence, timestamp, and counters | Exercise modular wrap, forward gaps, duplicates, older frames, invalid forward time, and impossible counter decreases. Ignored/invalid snapshots do not alter baselines. Gaps restore current state and accumulated counts but reset gesture history. Session barriers allow smaller rebooted counters. |
| GI-05 | Mandatory sensors versus unavailable input | All V2 readings are required; missing/null readings invalidate the snapshot. Public nulls represent unavailable startup/recovery/disconnection input, never a V1 fallback. |
| GI-06 | Mapping | Verify every compact key, boolean conversion, units, public shape, and strength rounding against shared examples. State/capabilities cannot be mutated by a game. No compass or gyroscope is synthesized. |
| GI-07 | Tilt and gesture derivation | Verify physical axis fixtures, clamp/dead-zone boundaries, no smoothing, strength, shake thresholds, cooldown, quiet re-arm, sequence gaps, and sample-time wrap. Identical device samples produce identical results when delivered singly or batched with different host callback delays. |
| GI-08 | Counted press events | A press/release between received snapshots survives in cumulative counts while current held state stays false. Cover multiple presses, dropped pressed-state frames, counter wrap, deterministic A/B/logo event order, no first-baseline replay, no cross-session/game replay, and state-before-event delivery. |
| GI-09 | Subscriptions | Immediate state callback, ordered subsequent callbacks, independent duplicate registrations, unsubscribe, exception isolation, immutable nested values, and disposal cleanup. Joining an event subscription never replays history. |
| GI-10 | Disconnect, silence, and reset | With no accepted snapshot for the freshness interval, publish neutral unavailable input, reject old calls, and perform one recovery handshake. Results/invalid/duplicate frames cannot keep input alive. Successful recovery waits for new info plus snapshot and resets baselines. Failure closes/releases resources. Explicit disconnect cancels recovery. |
| GI-11 | Command serialization | All output methods encode the exact wire grammar; omitted API volumes serialize as 128. Test full argument alphabets, min/max lengths/ranges, image order, rests, melody count/total duration, and strict numeric types. Invalid local arguments never write. |
| GI-12 | Results and IDs | Resolve/reject only matching valid results with exact uppercase codes. Ignore/report unknown, out-of-order, late, and duplicate IDs. IDs increase through command errors; they are never reused within the session. Test exhaustion, malformed results, unknown error codes, and late results after timeout/recovery. |
| GI-13 | Writes, queue, and ambiguous execution | Concurrent calls use FIFO, one in-flight command, at most the allowed waiting calls, and paced bounded chunks. Overflow rejects locally. Partial write/result timeout rejects old calls and recovers without replay. Terminate a possibly partial line before recovery `HELLO`; old diagnostics/results before the barrier do not poison recovery. |
| GI-14 | Capabilities and board | Reject V1/unknown identities and missing mandatory V2 sensor/display/speaker capabilities before readiness. Sounds accept only advertised names; an empty catalog is valid and rejects every requested name before writing. |
| GI-15 | Hardware smoke | On supported V2 verify button/counter changes, tilt, microphone/logo, snapshots, display replacement/clear, and speaker/stop through the library. Record physical revision/runtime/artifact identifiers. No V1 run is required. |
| GI-16 | Handshake failure/barrier | Cover unsupported/malformed bootstrap, invalid info, no info, info without snapshot, buffered old lines, repeated `HELLO`, and unexpected info while connected. No outputs are sent before readiness. Failure releases all resources; no old result/output survives a new info barrier. |
| GI-17 | Game switching and disposal | Only one game session is active. Dispose removes callbacks, rejects unsent/new calls, drains a written command without reusing its ID, and acknowledges STOP/CLEAR before the next game starts. Cleanup failure closes the port. New games do not receive old presses or gesture history; port remains open after successful disposal. |
| GI-18 | Playback semantics | Acknowledgement resolves at start, not completion. Successive accepted same-target commands replace active output; clear/stop cancel all relevant modes. Different targets remain independent. Invalid commands leave active output unchanged. Use a firmware model for automation and actual hardware for physical behavior. |
| GI-19 | Microphone classification | Verify first-sample labels, hysteresis boundaries, retained labels, unavailable-state null, and session reset. Batching is equivalent; no lossless clap/event or self-speaker suppression guarantee is inferred. |
| GI-20 | Browser lifecycle/errors | Cover secure-context/support checks, permission denial/cancel, reader/writer cleanup, explicit disconnect during startup/recovery, repeated disconnect, and active-game shutdown. Report error kinds without corrupting sensor state; cleanup always releases resources even when STOP/CLEAR fails. |

Extend GI-03 with escaped/nested duplicate JSON keys and bounded byte decoding; GI-11/13 with mutation of queued argument arrays, hung write promises, and results arriving before write completion; GI-09/17 with callbacks that unsubscribe/dispose while notification is in progress. Extend GI-10/17/20 with a logical game retained across physical reconnect, local disposal after the port is gone, late chooser/open completions, recoverable read errors with stream recreation, and resource cleanup failure reporting. Platform checks must block ordinary game launch before readiness (Testlab may show its connection UI before creating an adapter session), pause immediately on unavailable input, and wait for the player's resume choice after reconnect. Exit/result saving remains platform-owned and is tested separately from the library.

## Benchmarks and Release Gates

Use recorded snapshots plus the protocol's fixed normal profile and a documented stress rate. Record browser/version, host, build mode, fixture revision, subscriber count, queue limits, and clock method. Protocol deadlines/limits are mandatory targets, not measured results.

1. **Parse/normalize throughput:** Report messages/second, invalid lines, CPU time/message, queue growth, and dropped frames at normal/stress rates. Distinguish intended diagnostic rejection from valid-frame loss.
2. **Propagation:** From complete-line receipt to state/event callbacks, report p50/p95/p99/maximum for one and several subscribers. Use `performance.now()` for host timing; device `u` is not directly comparable to that clock.
3. **Sustained processing:** Replay at least 5 minutes, including wrapped counters, gaps, malformed/oversized lines, silence/recovery, output load, and game switching. Verify bounded parser/command queues, no duplicate actions, and no increasing latency/memory trend.
4. **Hardware command round trip:** Measure first-byte-to-result and final-LF-to-result separately, with pacing and timeout/error counts. Acceptance does not establish physical output completion.
5. **Hardware input latency:** Measure physical stimulus to game callback over at least 20 trials; record instrumented versus approximate manual methods. Measure freshness/recovery timing separately with a fake clock and real-device checks.

Apply the public interface's baseline propagation and instrumented end-to-end budgets. Games may specify tighter limits before measurement, but cannot weaken these baselines. Repeat runs to identify timing noise and record uninstrumented physical latency as unassessed, not passed. Test freshness/handshake/result deadlines exactly with fake clocks; browser hardware timing reports include observed scheduling delay. Do not lower requirements after a failing run.

## Reporting

Record case IDs with `PASS`/`FAIL`/`SKIPPED`, reasons, software and fixture revisions, browser/OS, board/runtime/firmware for hardware, benchmark sample counts/percentiles, and instrumentation limitations. All-hardware-skipped runs are not hardware verification; unit/fake-transport/browser-mock tests still run.
