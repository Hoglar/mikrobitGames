# Proposed Bidirectional micro:bit Serial Protocol

This is the shared specification for built-in **micro:bit V2** inputs and outputs. V1 boards are outside this release's support; the browser rejects their board identity during startup. Firmware is C++ with the CODAL design in [ADR-008](../../decisions/adr-008-microbit-v2-cpp-codal.md) and the [implementation guide](../../../microbit/spec/firmware-implementation.md). This is a draft, not hardware verification. GPIO-connected hardware is out of scope. The [browser interface](web-page-developer-interface.md) defines the public game API; [shared fixtures](fixtures/README.md) provide conformance examples.

Protocol version 1 is still unimplemented. These additions complete that draft; deployed versions must increment the protocol version for incompatible changes. ADRs [002](../../decisions/adr-002-microbit-serial-communication.md) and [004](../../decisions/adr-004-microbit-command-encoding.md) record the architecture.

## Transport and Shared Limits

USB serial uses **115200 baud, 8 data bits, no parity, 1 stop bit, no flow control**. All messages are ASCII. JSON must be an object with unique keys, serialized compactly on one line. Multiline examples below are formatted for readability only.

Senders terminate lines with LF (byte `0x0A`). Receivers also accept CRLF by removing exactly one CR immediately before LF. CR elsewhere is invalid. Buffer partial reads and process complete lines in order; a read is not a message boundary. Firmware serializes all outbound messages through one writer so snapshot and result bytes cannot interleave.

| Limit or deadline | Version 1 requirement |
|---|---|
| Host-to-device line payload | At most 256 bytes |
| Device-to-host line payload | At most 1024 bytes, including `deviceInfo` |
| Length counting | Excludes LF and one optional final CR |
| Snapshot interval | 20 ms (50 Hz), advertised as `snapshotIntervalMs: 20`; fixed in this version |
| Normal-load acquisition gate | p95 inter-acquisition interval at most 25 ms; maximum at most 100 ms; no missing emitted snapshots on a fault-free link |
| Handshake deadline | Valid `deviceInfo` and first valid snapshot received within 3000 ms of completing the `HELLO` write |
| Input freshness | 500 ms without a newly accepted snapshot triggers recovery |
| Command result deadline | Browser times out 1000 ms after completing the command's LF write |
| Firmware result target | Result emitted within 100 ms of receiving a complete command |
| Browser output queue | At most 16 waiting calls, plus one command awaiting its result |
| Host write pacing | At most 16 bytes per chunk; chunk starts at least 5 ms apart, including across commands |

These are proposed interoperability requirements and release gates, to be validated on supported V2 hardware. A firmware that cannot meet them is not conformant; revise the shared draft and tests together before adopting another profile. Do not silently choose different limits in each implementation.

On overflow, retain at most the incoming limit plus one possible final CR, discard through the next LF, then resume at the next line. Firmware reports `LINE_TOO_LONG` after discarding, correlated if a valid command header/ID was recovered; otherwise it returns `ERR|LINE_TOO_LONG`. The browser reports/discards oversized incoming lines without updating input freshness. Empty lines are ignored and never refresh liveness. Invalid bytes/lines must not execute partial commands or stop snapshots. Runtime control characters must not interrupt firmware execution.

Firmware must drain serial input frequently enough for its configured CODAL receive buffers, including during output. The [implementation guide](../../../microbit/spec/firmware-implementation.md) specifies application buffers, task ownership, and overflow handling; the actual runtime capacities must be configured and measured. Host chunking does not replace timely firmware reads. Processor spin waits are prohibited; cooperative waiting in a dedicated worker is allowed only when acquisition and RX service continue. Record the pinned runtime and firmware revision in results. MicroPython buffer/control-character behavior is not an implementation assumption for this C++ firmware.

## Startup, Sessions, and Recovery

On reboot, firmware stops outputs, clears the display, initializes counters to zero, and waits without sending snapshots. The host starts a session with:

```text
HELLO|1
```

Every valid `HELLO|1`, including one while streaming, is a session barrier. Firmware stops audio/scrolling, clears the display, resets command-ID tracking, and sends exactly one `deviceInfo` before the first new-session snapshot. It does not reset boot-relative time, snapshot sequence, or press counters. Previously accepted commands/results finish processing before this `deviceInfo`; no previous-session result or output work may follow it. Firmware has no playback queue.

```json
{
  "type": "deviceInfo",
  "protocolVersion": 1,
  "board": "microbit-v2",
  "snapshotIntervalMs": 20,
  "capabilities": {
    "sensors": ["buttons", "accelerometer", "temperature", "light", "microphone", "logoTouch"],
    "outputs": {
      "ledDisplay": ["showText", "showImage", "clear"],
      "speaker": ["playTone", "playMelody", "playBuiltInSound", "stop"],
      "builtInSounds": ["hello", "happy"]
    }
  }
}
```

`type` and `board` are strings; `protocolVersion` and `snapshotIntervalMs` are integers, not booleans or numeric strings. `capabilities`/`outputs` are objects and each shown capability list is an array of strings. All shown metadata keys are required. The only supported board identity is `microbit-v2`. It must advertise all six shown sensors, all three display actions, and all four speaker actions. Built-in sound availability depends on firmware; advertise 0–16 unique names matching `[a-z][a-z0-9-]{0,23}`. The example names are illustrative, not a required sound catalog. Advertise only implemented sounds; an empty `builtInSounds` list is legal. Unknown capability names are ignored; missing required capabilities, duplicate entries, an unsupported board (including V1), unsupported version, or an interval other than 20 reject startup. Unknown JSON metadata keys are ignored. Firmware V1 compatibility is not required.

An unsupported numeric bootstrap version returns `ERR|UNSUPPORTED_VERSION`. A malformed `HELLO` returns `ERR|MALFORMED_COMMAND`. Either ends any active session, stops/clears outputs, and returns firmware to waiting for a valid `HELLO`; no snapshots follow until then. Non-HELLO lines before a session are ignored without results. After `deviceInfo` is emitted, commands with recoverable IDs receive results as specified below.

The browser stays `connecting` until it accepts both `deviceInfo` and the first valid snapshot. During handshake it discards buffered snapshots/results preceding `deviceInfo`. The first snapshot following it establishes sequence/time/press baselines without historical press or gesture events. Invalid/unsupported `deviceInfo` or the 3000 ms deadline rejects startup and releases serial resources. During initial startup, uncorrelated device errors reject startup; during recovery they are reported and ignored before the new `deviceInfo` barrier, since they may belong to a discarded partial command. `ERR|UNSUPPORTED_VERSION` always fails the handshake.

While connected, 500 ms without a newly accepted snapshot immediately marks input unavailable, rejects pending/queued commands, clears derived histories, and performs one fresh `HELLO|1` handshake on the open port. An unexpected `deviceInfo` or invalid forward timestamp also triggers recovery. Recovery has the same 3000 ms deadline; failure closes the port and leaves `disconnected`. Physical removal or fatal transport failure closes immediately; reconnect then requires a page `connect()` call. Invalid lines, duplicate/older snapshots, and command results never refresh input freshness.

A reset that leaves the USB port open is detected by missing snapshots: rebooted firmware waits for `HELLO`. Each session boundary clears adapter baselines, so smaller post-reboot counters are valid. Commands and historical inputs are never replayed across sessions.

## Full Sensor Snapshots

```json
{"n":1842,"u":36840,"a":0,"b":1,"ac":7,"bc":3,"x":12,"y":-34,"z":-998,"t":23,"l":80,"m":12,"q":0,"qc":2}
```

Snapshots have no `type` or wrapper. An object without `type` is only a snapshot candidate: validate every required field after discovering a supported V2 board. All fields below are mandatory on every snapshot; there is no game-selected sensor mask. Booleans, strings, fractions, `null`, and non-finite values are invalid for integer fields. Unknown keys are ignored for forward compatibility.

| Key | Required when | Encoding and range |
|---|---|---|
| `n` | Always | Unsigned 32-bit sequence; first emitted snapshot after reboot is 0; increments per emitted snapshot |
| `u` | Always | Unsigned 32-bit milliseconds since boot, captured at snapshot acquisition |
| `a`, `b` | Always | Current debounced button state: `0` released, `1` pressed |
| `ac`, `bc` | Always | Unsigned 32-bit cumulative debounced A/B press counts since boot |
| `x`, `y`, `z` | Always | Signed integer mg in `[-8192, 8192]`; configure an 8g acquisition range |
| `t` | Always | Integer board temperature estimate in `[-40, 125]` Celsius, not ambient temperature |
| `l` | Always | Light level normalized by firmware to integer `[0, 255]` |
| `m` | Always | Sound level normalized by firmware to integer `[0, 255]` |
| `q`, `qc` | Always | Debounced touch state `0`/`1` and unsigned 32-bit cumulative touch-press count |

All unsigned 32-bit fields wrap modulo `2^32`. Read all accelerometer axes as one acquisition. Wire axes use this project convention: with the LED face viewed upright and USB at the top, lowering the right edge gives positive `x`, lowering the bottom/gold-connector edge gives positive `y`, and lying still with LEDs facing up gives approximately `z = -1000`. Firmware maps runtime coordinates to this convention. There is no compass or gyroscope input.

Debounce digital inputs for 20 ms of stable state before committing either transition; increment a press counter only on a committed released-to-pressed transition. Use runtime/hardware edge tracking or poll at least every 5 ms, independently of snapshot transmission, including while waiting for `HELLO` or skipping failed sensor acquisitions. Pulses stable for at least 25 ms in both states must be counted even when their pressed snapshots are missed. Shorter pulses are not guaranteed. Counters preserve counts, not exact event times, release history, or A-versus-B ordering between snapshots. Never latch current-state fields to simulate missed presses.

Each acquisition must consult initialized, healthy drivers and use their latest valid measurements. Temperature/light/microphone drivers may update independently of the snapshot interval; documented valid driver caches are allowed and their native update/readiness behavior must be recorded and verified in the firmware binding table. A failed/not-ready read must not be omitted, replaced by `null`, clamped into apparent validity, or hidden by copying the previous encoded snapshot. Skip the whole snapshot, continue commands/digital tracking, and record diagnostics outside the protocol stream. Extended failures trigger freshness recovery. Indicator LEDs and external actuators are outside this contract.

For successive accepted snapshots in one session, compute modular deltas `(new - previous + 2^32) % 2^32`. Accept `n` only when its delta is in `[1, 2^31 - 1]`; ignore duplicate/older sequences without changing state or baselines. Report `deltaN - 1` gaps. A forward snapshot requires `deltaU` in `[1, 2^31 - 1]`; otherwise recover. Press deltas must be in `[0, 2^31 - 1]`; a larger delta invalidates the whole snapshot without updating baselines. Later valid full snapshots restore current values and accumulated press counts. First snapshots after any handshake establish baselines without past actions.

The adapter derives tilt, strength, shake, and sound labels using the [public interface](web-page-developer-interface.md). It uses `u` for sample timing and host monotonic receive time for freshness. Snapshot timing cannot preserve every transient sound/motion; only debounced digital counts have the recovery guarantee above. Firmware audio may be heard by its own microphone; no echo cancellation or event suppression is implied.

## `text-v1` Commands

Field order is exactly `C|version|commandId|target|action|arguments`. Tokens are case-sensitive; do not trim fields. Numeric command tokens use canonical unsigned decimal (`0` or a nonzero digit followed by digits), without signs, spaces, leading zeroes, or exponents. Version 1 fixes this grammar; there is no JSON-command mode.

`commandId` is in `[1, 2147483647]`. The host assigns strictly increasing IDs when writes start and never reuses one within the session, even after errors. Firmware consumes each recoverable new ID before validating the remaining command; IDs at or below its highest consumed ID return `DUPLICATE_ID` without repeating actions. Gaps are allowed. Exhaustion requires a fresh handshake. A recoverable header is `C|<canonical version>|<in-range canonical commandId>|`; other headers have no recoverable ID.

| Action | Exact line example | Argument requirements |
|---|---|---|
| Scrolling text | `C\|1\|101\|D\|TEXT\|READY` | 1–32 characters from `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,!?:+-/()`; no escaping |
| Image | `C\|1\|102\|D\|IMAGE\|0090009090900090909000900` | Exactly 25 digits `0`–`9`, row-major, top left to bottom right |
| Clear display | `C\|1\|103\|D\|CLEAR` | No arguments or trailing separator |
| Tone | `C\|1\|104\|S\|TONE\|440\|250\|128` | Frequency `0` for silence or `[20, 9999]` Hz; duration `[1, 10000]` ms; volume `[0, 255]` |
| Melody | `C\|1\|105\|S\|MELODY\|128\|440:200,660:300` | Volume `[0, 255]`; 1–16 comma-separated `frequencyHz:durationMs` notes using tone bounds; total duration at most 10000 ms |
| Built-in sound | `C\|1\|106\|S\|SOUND\|happy` | Exactly one advertised name |
| Stop speaker | `C\|1\|107\|S\|STOP` | No arguments or trailing separator |

Use `0:durationMs` notes for rests. Display brightness is a protocol scale of 0–9, mapped to the runtime by firmware. Text uses six columns per character (five glyph columns plus a gap), 50 ms per column, ends on a blank display, and must finish within 10000 ms. Built-in sounds use volume 128 and must finish within 10000 ms. Firmware must implement all advertised actions without blocking acquisition or serial input.

## Output Scheduling and Results

Display and speaker operate independently. On each target, a successfully validated command cancels the active operation and applies/starts immediately; there is no firmware playback queue. `CLEAR` cancels scrolling and blanks all pixels. `STOP` cancels tones, melodies, and built-in sounds. Invalid commands leave outputs unchanged. Acceptance/cancellation cannot wait for playback completion.

```text
R|1|104|OK
R|1|108|ERR|UNSUPPORTED_OUTPUT
```

After startup, each complete command with a recoverable ID receives exactly one result. Overlong lines receive a result only after their LF has been discarded. Result version is always `1`, including errors for other command versions. `OK` means applied/started, not finished. Awaiting successive playback calls can replace the first while it plays. Version 1 has no completion events.

| Error code | Meaning |
|---|---|
| `LINE_TOO_LONG` | Payload exceeds incoming line limit |
| `DUPLICATE_ID` | ID already consumed or below session high-water mark |
| `UNSUPPORTED_VERSION` | Unsupported command version |
| `MALFORMED_COMMAND` | Invalid framing, tokens, argument count, or numeric syntax |
| `UNSUPPORTED_ACTION` | Unknown target/action pair |
| `UNSUPPORTED_OUTPUT` | Recognized action requires a capability not advertised by this board |
| `OUT_OF_RANGE` | Valid syntax outside an allowed range/length, including image size or melody total duration |
| `INVALID_TEXT` | Text or image contains a character outside its alphabet |
| `UNSUPPORTED_SOUND` | Well-formed sound name is not advertised |
| `INTERNAL_ERROR` | Execution failed; side effects may already have occurred |

Validation precedence is line length, recoverable header, ID ordering, version, target/action, capability, argument count/syntax, character alphabet, then ranges/name membership. An overlong line consumes a recoverable new ID but returns `LINE_TOO_LONG` even if its ID was already used. With no recoverable ID return `ERR|MALFORMED_COMMAND` (or `ERR|LINE_TOO_LONG` for overflow); while connected, these uncorrelated errors trigger browser recovery. A `SOUND` token that does not match the name alphabet is malformed. Do not emit debug logs onto the protocol stream.

The browser allows one command awaiting a result and serializes calls in FIFO order. It rejects a call when 16 calls are already waiting, with a local queue-full error before writing. Validate arguments/capabilities before enqueueing. Matching valid `R|1|<id>|OK` resolves; matching known errors reject with that code. Unknown/duplicate/late IDs are diagnostics and cannot settle another call. Malformed results leave the call pending until a valid result, session failure, or timeout. Unknown error codes reject matching calls as protocol errors.

After a result timeout or write failure, stop command writes, reject pending/queued calls, and recover (close immediately on fatal transport failure). Timeout/partial write means execution is unknown; never automatically retry. If a partial outbound line may exist, write one LF using the same pacing before `HELLO`, then ignore old diagnostics until the new `deviceInfo` barrier. Clear framing buffers and derived histories at a session boundary. Output calls are rejected while connecting or disconnected.

## Verification

Use the [shared fixtures](fixtures/README.md), [firmware test plan](../../../microbit/spec/test-plan.md), and [browser test plan](../../../webapp/spec/game-input-test-plan.md). Measure acquisition cadence, latency, replacement, and recovery on supported V2 revisions. V1 is tested only as an unsupported identity in host fixtures; no V1 hardware run is required. Thresholds above are requirements, not measured results; record failures rather than weakening limits after a run.
