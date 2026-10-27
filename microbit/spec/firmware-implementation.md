# V2 C++ Firmware Implementation Design

## Status, Scope, and Sources of Truth

The implementation in `microbit/src` is **C++ on micro:bit V2 only**, using CODAL as proposed in [ADR-008](../../spec/decisions/adr-008-microbit-v2-cpp-codal.md). Host tests and a pinned cross-build pass; [hardware acceptance remains pending](../results/implementation-validation.md). No V1 target or compatibility layer is required. The [serial contract](../../spec/contracts/microbit-webapp/microbit-serial-protocol.md) owns wire constants, fields, validation precedence, deadlines, and output behavior. The [public API](../../spec/contracts/microbit-webapp/web-page-developer-interface.md) owns browser-derived inputs.

Keep all supported sensor readings in every snapshot. Games do not configure sensor masks. Full snapshots, timestamps, and cumulative digital counts keep the browser API independent of games; bandwidth/CPU measurements may motivate a future shared revision.

This design fixes component ownership and initial resource budgets. [Driver bindings](../src/platform/codal/README.md) and generated build provenance record the integrated APIs/flags. Checklist items concerning physical timing, memory and sensor behavior remain acceptance requirements, not measured claims.

## Source Layout and Boundaries

All paths in this table are relative to `microbit/src`. Small related pure components share `protocol.*`; session/mailbox logic lives in `firmware.*`. `main.cpp` constructs one application/device instance, initializes it, starts tasks, and yields to CODAL. It contains no parser or game-specific logic.

| Component | Location | Responsibility and ownership |
|---|---|---|
| Protocol constants/types | `core/protocol.*` | Wire-derived bounds, fixed-width snapshot/command/result records, error enumeration |
| Line framer | `core/protocol.*` | Partial lines, optional final CR, oversized-line discard, recoverable header tracking |
| Command parser | `core/protocol.*` | Bounded token views, canonical integer parsing, argument/alphabet/range validation; no device I/O |
| Session controller | `core/firmware.*` | Waiting/starting/streaming states, ID high-water mark, session epoch, command validation order, result routing |
| Snapshot encoder | `core/protocol.*` | Checked compact ASCII JSON; no JSON input parser is needed |
| Digital input tracker | `core/protocol.*` | Debounced hold states and unsigned cumulative A/B/logo counters; pure clock-driven logic |
| Output controller logic | `core/outputs.*` | Display/audio states, generations, replacement, melody deadlines, cancellation |
| CODAL hardware adapters | `platform/codal/*` | Clock, serial, sensor, display, sound, synchronization, and driver status translation |
| Task orchestration | `app.*` | Task startup, bounded mailboxes, fault handling, session barriers, diagnostics |

Core code includes no `MicroBit.h`, register access, CODAL types, global device instance, or dependency on a runtime scheduler. `OutputHardware` exposes `showPixels`, `glyphColumn` and `setTone`; `CodalBoard` exposes initialization, raw digital levels and complete sensor reads. Return statuses and transfer owned records; never retain pointers into temporary parser or driver storage.

## Build and Language Baseline

Use the pinned build wrapper in the [README](../README.md). Keep target dependencies locked; keep an immutable bootstrap build-system revision and record transitive commits, CMake/Python/compiler versions, build flags, and artifact hash. The reference build host is Linux (native or WSL2); Windows can flash/use Web Serial with the resulting V2 HEX. Do not assume a native Windows build works before verifying it.

Application code uses C++11, fixed-width integer types, and no exceptions or RTTI. Compile project-owned core/adapters with warnings enabled; CI treats new application warnings as failures. Do not modify upstream warning settings globally to hide an application defect. Do not use `std::thread` or unbounded STL containers. Framing/parsing/encoding and interrupt callbacks are allocation-free. CODAL-managed objects may allocate during initialization or driver/output setup; bound their lifetimes and measure the cost during the soak run rather than claiming a heap-free runtime. Initialize adapters/objects explicitly before task startup to avoid races in lazy static initialization.

## Execution Model

CODAL fibers cooperate. The controller owns all protocol/session decisions; workers own their devices and publish bounded records. Do not parse, format JSON, scroll, or wait for audio in an interrupt handler. An ISR only lets its driver run or records a bounded flag/counter using the runtime's synchronization primitives. `volatile` alone does not synchronize a record or make compound operations atomic.

| Task | Work and scheduling rule |
|---|---|
| Digital input | Read A/B/logo raw logical levels at most 5 ms apart; apply the wire debounce rule; publish an atomic copy of all states/counts. It runs while waiting for `HELLO` and during sensor failures. |
| Sensor acquisition | Start from an absolute next-deadline schedule at the wire snapshot interval; acquire/validate one complete record, copy digital state/counts coherently, timestamp it, and publish to a capacity-one mailbox with its current session epoch. |
| Protocol/controller | Drain available RX bytes with asynchronous/non-spinning calls; frame/validate each line in order; own session transitions and command IDs; dispatch bounded output operations and results. Service at least once per 5 ms during normal load. |
| Output service | Advance display/audio deadlines without yielding inside the core. The controller applies/cancels outputs synchronously. Display and speaker are independent; there is no playback FIFO. |
| TX | Sole owner of runtime serial send. Serialize one complete line at a time, preserving bytes until the send is complete. Cooperative waiting is allowed here if RX, acquisition, and outputs remain scheduled; processor spin waits are not. |

The 5 ms service targets must be measured against CODAL's actual tick/event behavior; sleeping for 5 ms does not establish that maximum. Configure driver callbacks/timer events as needed and verify the maximum service gap. If the selected driver cannot expose raw button/logo levels at this cadence, adapt its debounced edge mechanism and prove equivalent pulse/count behavior; do not debounce an already-debounced event again or count both event and polling paths.

For an overrun, skip missed acquisition deadlines, increment an internal overrun counter, and resume the next future deadline. Do not emit a burst of fabricated catch-up snapshots or sleep a full interval after the work, which would accumulate drift. A pending snapshot can be replaced by a newer acquisition before TX starts, with an internal coalescing diagnostic; normal-load verification requires no such losses. `n` is assigned when TX accepts a valid snapshot for emission, not for each skipped acquisition. Its time `u` remains the acquisition timestamp. Never let a queued snapshot age indefinitely to satisfy the freshness checks artificially.

The current adapter applies/starts/cancels output synchronously without yielding, so the controller executes one owned validated command and immediately queues its result. The output-service fiber only advances deadlines; there is no command-to-worker mailbox or asynchronous completion callback. This preserves action/result ordering for batched input without retaining parser views. If a future adapter must yield to start/cancel output, introduce a single-command worker mailbox and applied/started acknowledgement before processing the next command or handshake.

Core calls and digital record copies do not yield; cooperative application fibers cannot interleave them. Short CODAL-supported interrupt protection covers microphone parameter copies and audio source updates. Never hold protection across a yielding driver call, formatting operation or serial transmission. Measure critical-section duration on hardware. Use `uint32_t` wrap arithmetic intentionally and checked decimal conversion/duration sums.

## Session and Framer State Machines

| Session state | Allowed behavior and transitions |
|---|---|
| `WAITING` | Digital tracking continues; outputs are stopped/blank. Only `HELLO` is handled; other input lines are ignored. Valid `HELLO` enters `STARTING`. |
| `STARTING` | Controller advances the internal epoch, invalidates old pending snapshots/work, stops/cancels outputs, waits for cancellation acknowledgement, drains already committed TX bytes, resets command-ID tracking, and submits `deviceInfo`. No new-session snapshot or output command may overtake that info line. |
| `STREAMING` | After TX commits `deviceInfo`, enable the new epoch's snapshots and process subsequent complete commands. A valid `HELLO` re-enters `STARTING`; malformed/unsupported `HELLO` emits its error after ordered cancellation and returns to `WAITING`. |

Completed input lines after a valid `HELLO` remain in the bounded RX ring until `deviceInfo` is committed. Results from previously accepted commands are emitted before new `deviceInfo`; canceled pending snapshots are dropped. Control messages carry an internal epoch; synchronous output cancellation leaves no old playback callbacks. Any future asynchronous work must carry an epoch/generation and cannot change outputs or send a result after its barrier. The epoch is internal, not a wire field; never allow it to wrap while stale work could exist.

The framer has `COLLECTING` and `DISCARDING` states. Store payload and at most one possible final CR within bounds. On LF remove that final CR, validate bytes, and dispatch one line. Once overflow is certain, retain only bounded header/ID metadata, consume through LF, and report the contract's length error. No partial prefix executes. Invalid bytes produce the specified malformed-command outcome; they cannot act as runtime keyboard shortcuts. Reset framing only at a consumed line/session boundary, never halfway through a command already being processed.

## Driver Mapping and Freshness

The hardware adapter's [binding table](../src/platform/codal/README.md) records exact symbols, source revisions, return/error codes and blocking/readiness behavior. Physical freshness observations remain pending. The following table states the required mapping:

| Input/output | CODAL binding area and implementation requirements |
|---|---|
| USB serial | V2 device serial/NRF52 serial driver, internal interface UART; configure wire settings and explicit RX/TX capacities. Never redirect protocol traffic to an edge connector or enable serial debug output. |
| A/B/logo | Device button and capacitive-touch components; choose raw-level polling or one equivalent debounced-edge source. Preserve current levels and cumulative counts, including while no session exists. Record logo calibration/readiness and any driver-level filtering. |
| Accelerometer | V2 accelerometer abstraction; configure 8g range and a sample period compatible with the wire cadence. Read one coherent XYZ sample, confirm physical axis signs, and map to signed mg. Use the board abstraction instead of choosing one specific sensor chip for all V2 revisions. |
| Temperature | Bounded on-chip TEMP conversion adapter; document update period, cached-read semantics, Celsius conversion, and failure status. The stock thermometer's unbounded conversion wait is avoided. |
| Light | Display/light-sensing component; keep light sensing active alongside the LED matrix and map the actual driver scale to the wire scale. Verify during scrolling/image output. |
| Microphone | V2 audio microphone/level-detection pipeline; explicitly activate input and initialize it before first snapshot. Document level scale, update window, readiness, and microphone self-pickup during playback. |
| Display | V2 display/image component; adapter implements the exact wire glyph-cell timing and brightness mapping. Native proportional scrolling is usable only if it meets the required fixed-cell behavior. Own all asynchronously referenced text/images until cancellation/completion. |
| Speaker | V2 audio synthesis/output pipeline; enable built-in speaker and disable auxiliary edge-pin audio. Set requested volume explicitly. One adapter owns every sound source so STOP/replacement can silence them all without disabling microphone input. |
| Time | CODAL monotonic clock; capture acquisition start in boot-relative milliseconds, explicitly reduce to wire `uint32_t`, and use wrap-safe deadline comparisons. Do not use wall-clock time. |

For temperature/light/microphone, a 50 Hz snapshot is not a promise of a new physical conversion every 20 ms. Each acquisition must consult the initialized, healthy driver and use its latest valid measurement. Record the driver's real update interval/readiness and test that stale/failing acquisition is reported, not masked. Reuse of a driver's documented valid cached measurement is allowed; copying the previous encoded snapshot after a failed adapter read is not. Until readiness/freshness can be determined for a mandatory reading, skip snapshots and keep commands responsive; never substitute zero as a fabricated success.

Relevant upstream sources are the [CODAL target](https://github.com/lancaster-university/codal-microbit-v2/tree/v0.3.5), its [headers](https://github.com/lancaster-university/codal-microbit-v2/tree/v0.3.5/inc), and [MicroBitAudio](https://github.com/lancaster-university/codal-microbit-v2/blob/v0.3.5/inc/MicroBitAudio.h). The latter exposes speaker/pin routing and volume controls; record the actual integration rather than copying MicroPython buffer or sound assumptions.

## Output Ownership and Named Sounds

Both output controllers have idle/active state. A validated replacement increments the operation generation, cancels old work, installs owned parameters, and acknowledges only after the new state is applied/started. Deadline advancement cannot resume a canceled frame/note. `CLEAR`, `STOP`, and a handshake use the same cancellation path. Validation errors do not modify active output. On execution failure, stop the affected target where possible, report `INTERNAL_ERROR`, and retain protocol service. A failed handshake cancellation returns an error without starting a session. Later driver failures during playback increment diagnostics; they cannot change an already-issued result.

Tone and melody use a fixed sine-wave synthesis profile at the requested integer frequency/volume; frequency zero schedules silence without stopping microphone capture. One active fixed-capacity note list advances by absolute deadlines and finishes on silence. `SOUND` maps `hello` and `happy` to static project-defined note lists in `core/protocol.cpp`, lasting 350 and 400 ms at volume 128. These are application aliases, not C++ sound-expression identifiers. Host tests verify deadlines/cancellation; physical sound quality, volume and interruption timing remain hardware gates.

## Initial Memory and Backpressure Budget

These capacities are application configuration choices, not changed wire limits. Verify that the selected serial API supports the chosen capacities; configure an application ring above a smaller runtime ring if needed and measure both separately. Buffer storage includes explicitly documented occupancy rules.

| Storage | Initial allocation and overflow behavior |
|---|---|
| Runtime RX ring | Initially request 128 usable bytes and verify the actual API's size/sentinel semantics; it feeds the application ring. A smaller configured runtime buffer requires new service-gap measurements. |
| Application RX ring | 512 bytes usable capacity; account for any ring sentinel separately. On overrun, record a transport fault, discard to LF, and require a fresh handshake before accepting more commands; never execute a possibly truncated line. |
| Command assembly | 258 bytes: at most 256 payload bytes, one optional CR, and one C-string NUL; LF is consumed separately and not stored. Parser uses explicit lengths. |
| Snapshot encoding | Current fixed schema fits within 256 bytes including LF and NUL, checked by host tests. Encoding uses the shared 1026-byte current-message storage; no separate snapshot text buffer. |
| Result encoding | Current results fit within 96 bytes; encoded directly into an owned control slot using checked error-name lookup. No separate result text buffer. |
| `deviceInfo` encoding | 1026 bytes: up to 1024 payload bytes plus LF and NUL. |
| TX driver ring | Initially request 128 usable bytes and verify size/sentinel semantics; send ownership cannot depend on the whole info line fitting in it. |
| TX control mailbox | Four owned entries of at most 1025 wire bytes each; FIFO for results/bootstrap records. When full, pause command consumption while continuing driver RX service; never silently drop results. |
| Snapshot mailbox | One owned snapshot record; TX picks current data between control lines and drops pending data older than 100 ms. An already-started line is never interleaved or replaced. |
| Output storage | One owned 33-byte text buffer, one 25-pixel image, and one 16-note melody record; no pending playback list. |
| Diagnostics | Fixed counters plus at most 16 fault records; overwrite oldest diagnostic only, never protocol state. |

If backpressure persists beyond the command-result deadline, record a transport failure and move to `WAITING` with outputs canceled. If an outgoing line was partially emitted, complete its bounded bytes before sending any new line, or reset the application/transport if completion is impossible; never inject a new JSON/text record into its middle. Browser timeout/freshness recovery handles the resulting session failure. A TX service stall is not allowed to block digital acquisition indefinitely.

Initial application-owned bounded object storage budget is 16 KiB, enforced for `Application` regardless of where it is allocated. It excludes runtime-owned objects, dynamic driver/mixer buffers and fiber stacks; measure those separately. The release artifact must include a linker map, firmware size, peak runtime heap/stack observations, minimum remaining RAM, and any allocations observed during normal traffic/playback. Do not claim a runtime memory budget solely from application array sizes. Do not replace target linker/stack settings without recording and testing the change.

Use checked decimal conversion, bounded token spans, checked format return values, and explicit ASCII validation. No unchecked `atoi`, unbounded `%s`, line-length-driven allocations, or returning views beyond their source lifetime. Use unsigned 32-bit counter subtraction and a wider checked sum for melody duration; do not rely on signed integer overflow or compiler-specific wrap flags.

## Diagnostics, Faults, and Initialization

Initialize the device, explicit buffer settings, disabled protocol-port logs, clock, digital tracking, sensors/audio input, speaker routing, and output controllers before accepting a session. BLE and radio services are not started. Keep the protocol at `WAITING` until adapters are initialized; sensor readiness may delay the first snapshot within the handshake deadline. Record a startup failure rather than advertising hardware that never became usable.

Expose diagnostics through a debugger and host-test hooks, with an optional separate debug transport only when wired/configured explicitly. Disable CODAL/DMESG/printf serial logs on the protocol port in normal and conformance builds. Keep internal counters for RX overflow, malformed/oversized lines, failed reads, scheduling overruns, coalesced snapshots, TX stall, and stale output callbacks. No diagnostic message is a sensor snapshot or command result.

On a recoverable sensor failure skip the complete snapshot and continue digital tracking/commands. On invalid input follow the wire error policy. On an internal fatal invariant failure stop outputs where possible, retain a debugger fault record, and reset/stop the application; do not continue producing apparently valid snapshots. A watchdog is not enabled in the initial design; adding one requires documenting timeout, feed ownership, and reset diagnostics so it cannot hide scheduling faults.

## Verification and First Integration Checklist

Use the [firmware test plan](test-plan.md), [host-test guidance](../tests/README.md), and [shared fixtures](../../spec/contracts/microbit-webapp/fixtures/README.md). Firmware host tests exercise all parser/session/encoder rules; browser-derived tilt/shake/sound-label cases remain browser tests. Cross-builds exercise actual target compilation; hardware runs establish physical behavior.

Before accepting the first integration:

1. Record immutable build-tool/target/dependency revisions and exact tool versions; build a clean V2 HEX twice and retain provenance/size information. Explain any artifact difference instead of assuming byte-for-byte determinism.
2. Compile the adapter binding table, verify actual driver buffer capacities/return values, and complete sensor readiness/update/axis observations. Confirm no duplicate debouncing or event counting.
3. Prove serial framing and session barriers with the shared corpus, including overflow, partial writes, late callbacks, and repeated `HELLO` while output is active.
4. Run the wire cadence/acknowledgement gates during simultaneous microphone input, digital input, LED updates, and audio. Measure time spent in critical sections and maximum RX/digital task service gaps.
5. Verify output replacement/STOP/CLEAR and microphone continuity, inspect RAM/stack/heap behavior, and record the physical V2 revision and interface firmware used.
6. Record results under `microbit/results`; fill any still-unverified toolchain/driver items in the README and binding table before marking ADR-008 Accepted. A written design or a successful cross-build is not hardware verification.
