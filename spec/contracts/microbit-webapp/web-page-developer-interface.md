# Web-Page Developer Interface for micro:bit Inputs and Outputs

This draft defines one framework-independent adapter shared by the page's games, supporting **micro:bit V2 only**. Games use this API; only the adapter reads/writes the [serial protocol](microbit-serial-protocol.md). V1/other board identities reject startup with an unsupported-board connection error; there is no reduced V1 state shape. The [JavaScript implementation](../../../webapp/src/microbit-input/README.md) has software/browser-mock verification; real USB and instrumented physical latency remain unverified. Defaults, formulas, lifecycle, and event semantics below remain authoritative requirements.

## Page and Game Ownership

The page owns `microbit.connect()`, `disconnect()`, connection status, capabilities, and error reporting. Call `connect()` from an explicit user action in a supported secure-context browser. It resolves only after valid `deviceInfo` **and the first valid snapshot**; errors/timeouts release serial resources. A connected call is idempotent; concurrent connecting calls share one operation. Explicit disconnect cancels startup/recovery and prevents automatic reconnection.

Unexpected physical loss retains the active logical game facade/subscriptions with unavailable input. A later page-level `connect()` may attach a fresh supported device session to that paused game; reconnect resets event/gesture baselines without replaying old actions. The platform decides when to resume game simulation after readiness, with the player's explicit choice. Library readiness does not automatically resume the game. Explicit page `disconnect()` still disposes the game as described below.

Only one game session may be active. `createGameSession()` requires a connected adapter and rejects until any previous game session has finished disposal. Games receive session-bound `inputs`/`outputs`, not ownership of the port. Connection lifetime is independent of game switching.

```javascript
// Page connection button:
await microbit.connect();
const game = microbit.createGameSession();

game.inputs.subscribe((state) => {
  player.setTilt(state.tilt.x, state.tilt.y);
  player.setButton("a", state.buttons.aPressed);
  player.setControlsEnabled(state.inputAvailable);
});
game.inputs.onPress(({ input, count }) => {
  if (input === "a") player.jump(count);
});
game.inputs.onGesture((gesture) => {
  if (gesture === "shake") player.activateAbility();
});

await game.outputs.display.showText("READY"); // Accepted/started, not finished.
if (microbit.capabilities.outputs.speaker.includes("playTone")) {
  await game.outputs.speaker.playTone({ frequencyHz: 440, durationMs: 250 });
}

// Page launcher, before mounting the next game:
await game.dispose(); // Unsubscribe, cancel old work, stop sound, clear display.
// Keep the shared port connected for the next game.

// Page disconnect button or page shutdown:
await microbit.disconnect();
```

`microbit.getState()` returns current read-only state. `microbit.onError(callback)` returns an unsubscribe function. Errors carry `kind`, message, and optional `protocolCode`/`commandId`; kinds include `connection`, `protocol`, `capability`, `validation`, `command`, `timeout`, `queue-full`, and `disposed`. Rejections/error subscriptions must not expose parsing failures as sensor values.

Every `subscribe`, `onPress`, and `onGesture` call returns an unsubscribe function. State subscriptions immediately receive current state, then one callback per accepted snapshot or lifecycle change, in order. Duplicate registrations are independent; callback exceptions are reported without preventing other subscribers. State, nested objects, and capabilities are immutable to callers. Events are not replayed when a subscriber joins.

`dispose()` immediately removes the game's subscriptions, rejects unsent calls, and prevents new calls on its facade with `disposed`. It drains any already-written command, then sends supported speaker `STOP` and display `CLEAR` using the shared writer. An already-written call whose game was disposed rejects locally, but its ID stays reserved until its result is drained or the adapter recovers. Disposal resolves only after cleanup acknowledgements; on cleanup failure it closes the connection and rejects. A later game cannot start until disposal completes. Repeated disposal shares the same operation/result. Commands/events from a disposed game cannot leak into the next one.

If the port is already disconnected, `dispose()` releases local state/subscriptions and resolves without device cleanup commands; pending calls reject and old IDs/operations remain fenced to their closed connection. This cannot guarantee the removed board's outputs stopped. If a connected port fails during cleanup, close/reject as above. A new game still requires a ready connection and a fresh event baseline.

Page `disconnect()` disposes an active game, attempts the same output cleanup when ready, and always releases reader, writer, and port even if cleanup fails. It suppresses automatic recovery while closing, rejects on cleanup failure after releasing resources, and is idempotent when already disconnected; concurrent calls share the operation. Abrupt removal/page termination cannot guarantee cleanup; firmware outputs are individually bounded to 10000 ms. Version 1 has no device-side host-liveness heartbeat.

## Public Input State

This example corresponds to the V2 snapshot in the serial contract, using the derivation rules below:

```javascript
{
  connection: "connected",
  inputAvailable: true,
  board: "microbit-v2",
  buttons: { aPressed: false, bPressed: true },
  tilt: { x: 0, y: 0 },
  accelerometer: {
    xMg: 12, yMg: -34, zMg: -998, strengthMg: 999, gesture: null
  },
  temperatureC: 23,
  lightLevel: 80,
  microphone: { soundLevel: 12, soundEvent: "quiet" },
  touch: { logoPressed: false }
}
```

| Wire keys | Public fields or behavior |
|---|---|
| `a`, `b` | Boolean `buttons.aPressed`, `buttons.bPressed` for hold controls |
| `ac`, `bc` | Adapter baselines and counted `onPress` events for one-shot actions |
| `x`, `y`, `z` | `accelerometer.xMg`, `.yMg`, `.zMg`; derived tilt/strength/shake |
| `t`, `l` | `temperatureC`, `lightLevel` |
| `m` | `microphone.soundLevel`, derived `.soundEvent` |
| `q`, `qc` | Boolean `touch.logoPressed` and counted logo-press events |
| `n`, `u` | Internal sequence diagnostics and device sample timing |

Every supported connected board has the V2 objects shown above. All wire readings are mandatory; a missing reading invalidates the whole snapshot rather than becoming an unsupported-hardware null. Nulls below represent unavailable connection/input state only. No compass or synthetic gyroscope is exposed.

`connection` is `disconnected`, `connecting`, or `connected`. Only `connected` has `inputAvailable: true`. During startup, recovery, disconnect, or staleness, publish neutral buttons (`false`), neutral tilt (`0`), `accelerometer: null`, `temperatureC: null`, `lightLevel: null`, `microphone: null`, and `touch: { logoPressed: null }`. Retain validated board/capability metadata during recovery; clear it on full disconnect. Games gate actions on `inputAvailable`; neutral values do not imply valid readings. This preserves safe button/tilt access in the example and prevents stuck controls.

## Counted Press Events

Use `onPress` for one-shot actions instead of relying exclusively on sampled hold-state edges. Emit at most one event per input per accepted snapshot: `{ input: "a" | "b" | "logo", count: positiveInteger }`. `count` is the modular increase in that input's cumulative counter, including presses whose pressed-state snapshots were lost. Update state first, then emit A, B, logo events in that deterministic order, then any gesture event. This is not a claim about physical ordering between inputs.

The first snapshot of a connection/recovery establishes baselines without events. Creating a game clears event/gesture history and the public gesture pulse. Its first subsequent valid snapshot establishes event baselines without events; presses between creation and that snapshot are intentionally not replayed. The immediate subscription callback can still expose current hold/tilt state. Duplicate/older/invalid snapshots do not change baselines or emit events. Events across a session boundary/game switch are not replayed. Current-state fields always reflect latest held states; counters cannot reconstruct release events, exact timestamps, or cross-button combinations. The wire contract's debounce/minimum pulse requirements bound which physical presses are guaranteed.

## Tilt, Strength, and Gesture Rules

Wire axes use the orientation in the serial contract. Positive `tilt.x` means right; positive `tilt.y` means down toward the gold-connector edge in screen coordinates. For each axis compute `v = clamp(axisMg / 1000, -1, 1)`, then return `0` if `abs(v) <= 0.05`, otherwise `sign(v) * (abs(v) - 0.05) / 0.95`. Version 1 applies no smoothing. Raw fields are unchanged. `strengthMg = round(sqrt(xMg*xMg + yMg*yMg + zMg*zMg))`, rounding positive halves upward.

The only version 1 gesture name is `"shake"`; directional movement uses tilt. `accelerometer.gesture` is `"shake"` only on a snapshot that emits the event, otherwise `null`. Use device timestamps, never browser callback spacing:

1. Begin armed after the session's first snapshot. Independently track alternating excursions on `x` and `y`. An excursion is a change of at least **1200 mg from the preceding extreme**, allowing intermediate samples; it is not a required change between adjacent 20 ms samples. Three alternating excursions on one axis, represented by four retained points spanning at most **600 ms**, emit one shake on the sample that meets the rule. `z` does not initiate a shake. Adjacent accepted sample intervals must remain at most 100 ms.
2. After emission, clear the window and disarm. Re-arm only after at least 500 ms since emission **and** 200 ms of continuous quiet samples. Quiet means every successive difference on all three axes has magnitude less than 300 mg. Count quiet time from the first sample of the quiet run. Timers without new samples cannot re-arm or emit events.
3. Any sequence gap or sample interval over 100 ms clears the window/quiet history and disarms. Require a fresh 200 ms quiet run before arming again, plus any remaining post-shake cooldown. Invalid samples never enter the classifier. Session boundaries clear all gesture history.

For deterministic excursion tracking, initialize each axis with low/high candidates at the baseline. Before the first excursion, replace a low/high candidate if it is older than 600 ms or the current value is respectively less/equal or greater/equal. A rise of at least 1200 mg from the low candidate starts an upward excursion; otherwise a fall of at least 1200 mg from the high starts a downward one. Retain that anchor and the current point. While moving in the same direction (including equality), replace the last retained point with the current value/time. A reversal of at least 1200 mg from that extreme appends a point and reverses direction; smaller reversals leave the extreme unchanged. Keep only the latest four points per axis, and emit when four exist within 600 ms. After re-arming, use that sample as the new baseline. All elapsed-time comparisons use unsigned modular `u` deltas.

This rule was revised on 2026-10-28 after a recorded hand-shaking trace produced no events under the earlier four-consecutive-sample rule. At 50 Hz, that rule required large direction reversals every 20 ms. The wire format and `onGesture` API are unchanged. The [shared fixtures](fixtures/README.md) include gradual excursions, timing limits and a captured V2 hand-shaking sequence.

Use modular device-time arithmetic from the wire contract. Samples delivered in one read are processed individually in wire order with their original `u` values. Snapshot sampling cannot guarantee every motion is recognized; digital counters provide the stronger press guarantee only.

## Microphone Labels

`soundEvent` is a level classification, `"quiet"` or `"loud"`, not a lossless clap event. On the first snapshot choose loud when `m >= 180`, otherwise quiet. Subsequently switch to loud at `m >= 180`, to quiet at `m <= 120`, and retain the preceding label between thresholds. Session boundaries reset history. The board can hear its own speaker; no suppression/echo cancellation is provided.

## Connection and Protocol Handling

The adapter owns one reader and one paced writer. It follows the serial contract's bootstrap barrier, validation, 3000 ms startup deadline, 500 ms freshness timeout, one-attempt recovery, sequence/wrap policies, and bounded buffers. Unsupported browser/permission failures reject as connection errors before startup. Recovery retains the active game facade/subscriptions but publishes unavailable input, rejects old calls, and blocks outputs until ready again. Fresh baselines suppress historical events.

Expose validated, read-only `microbit.capabilities`; before discovery/full disconnect it is `null`. Invalid/duplicate/older snapshots preserve last valid state only until its freshness deadline. They cannot keep it alive. Fatal transport failure immediately publishes unavailable input and rejects pending calls.

## Output API and Errors

| Method | Arguments and defaults |
|---|---|
| `outputs.display.showText(text)` | String meeting wire alphabet/length limits |
| `outputs.display.showImage(pixels)` | Flat row-major array of exactly 25 integer brightness values in `[0, 9]` |
| `outputs.display.clear()` | No arguments |
| `outputs.speaker.playTone({ frequencyHz, durationMs, volume = 128 })` | Required integer frequency/duration; optional integer volume |
| `outputs.speaker.playMelody({ notes, volume = 128 })` | Required array of `{ frequencyHz, durationMs }` objects; optional integer volume |
| `outputs.speaker.playBuiltInSound(name)` | Advertised string name; fixed volume 128 |
| `outputs.speaker.stop()` | No arguments |

All methods return Promises. Check types, bounds, capabilities, active session, and readiness before enqueueing; no implicit coercion. Wire bounds, melody count/total duration, text alphabet, and exact protocol error codes come from the serial contract. Missing mandatory V2 output capabilities fail startup; invalid arguments reject as validation errors. Unadvertised sound names reject before sending, including every name when the advertised list is empty.

Allow one command in flight and at most 16 waiting calls. Write once in FIFO order using wire pacing; assign increasing IDs only at write start. Resolve only on matching `R|1|<id>|OK`; device errors reject with exact uppercase `protocolCode`. Unknown/late/duplicate IDs cannot settle any current call. Errors/queue-full do not repeat commands. Timeout/write failure makes execution unknown, rejects old calls, and triggers recovery; a game must deliberately decide whether to issue another action afterward.

Commands replace active playback on the same target; speaker/display are independent. `clear()` cancels scrolling, and `stop()` cancels every speaker mode. An acknowledgement is not completion: `await playTone(...); await playBuiltInSound(...)` can interrupt the tone. Version 1 has no completion-wait API. Use one `playMelody` call for a composed melody.

## Verification

The [browser test plan](../../../webapp/spec/game-input-test-plan.md) covers state, counted presses, derivation, scheduling, disposal, and recovery. Both sides use the [shared fixtures](fixtures/README.md). Check real browser permissions/cleanup and supported V2 revisions before claiming support. V1 rejection is a host fixture, not a required hardware run. Responsiveness thresholds are unverified requirements until recorded measurements meet them.

The [JavaScript implementation plan](../../../webapp/spec/game-input-implementation-plan.md) defines module responsibilities, development tooling, delivery phases, and platform integration. It implements this facade without introducing game-specific protocol behavior.

The baseline release budget at the normal 50 Hz rate is p95 at most 5 ms from complete-line receipt to state/event callbacks with one and four subscribers, and p95 at most 100 ms from an instrumented physical button/tilt stimulus to the game callback. At least 20 trials are required for the physical measurement. Approximate manual timing cannot establish a latency pass. A game needing a tighter budget must specify it before testing; it cannot weaken these baseline requirements.
