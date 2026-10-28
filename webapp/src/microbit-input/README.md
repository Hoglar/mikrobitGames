# micro:bit game input library — developer guide

JavaScript ES modules for **micro:bit V2** with this project's firmware (protocol v1). One page-owned connection serves every game through the same input/output API. No framework, backend, runtime packages or per-game sensor configuration is required.

[Quick start](#quick-start) · [Page API](#page-api) · [Inputs](#reading-inputs) · [Outputs](#sending-outputs) · [Lifecycle](#recovery-and-game-lifecycle) · [Errors](#handling-errors) · [Example](#example-and-verification)

## Quick start

Serve the complete `microbit-input/` directory as JavaScript modules over HTTPS or localhost; use `<script type="module">` or import it from your application. Opening an HTML file directly is insufficient. The browser must expose `navigator.serial` in a secure context, and the board needs a USB data cable. Importing the module does not prompt or open a port. Node/npm are only development tools.

This example assumes page buttons with IDs `connect`, `continue` and `disconnect`. Adjust the import URL to your deployed layout. The page owns the session; game modules receive `game.inputs` and `game.outputs`.

```js
import { microbit } from '/src/microbit-input/index.js';

const report = error => console.error(error.kind, error.message);
const offError = microbit.onError(report);
let game = null, paused = true;

document.querySelector('#connect').onclick = async () => {
  try {
    await microbit.connect(); // Call directly from this user action.
    if (game) return;        // Reconnect keeps the existing paused game.
    game = microbit.createGameSession();
    game.inputs.subscribe(state => {
      if (!state.inputAvailable) paused = true;
      // Read hold/tilt controls here; simulate only while !paused.
      console.log(state.buttons.aPressed, state.tilt.x, state.tilt.y);
    });
    game.inputs.onPress(({ input, count }) => {
      if (!paused) console.log(`${input}: ${count} press(es)`);
    });
    game.inputs.onGesture(name => {
      if (!paused && name === 'shake') console.log('Shake action');
    });
    paused = false;
  } catch (error) { report(error); }
};
document.querySelector('#continue').onclick = () => {
  if (game && microbit.getState().inputAvailable) paused = false;
};
document.querySelector('#disconnect').onclick = async () => {
  try { await microbit.disconnect(); } catch (error) { report(error); }
  finally { game = null; paused = true; }
};
// Call offError() when the page/controller owning this listener is torn down.
```

## Page API

| Member | Return / behavior |
|---|---|
| `microbit.connect()` | `Promise<void>`; opens the chooser and resolves after valid metadata **and the first valid sensor snapshot**. Ready calls are idempotent; concurrent startup calls share the operation. |
| `microbit.disconnect()` | `Promise<void>`; cancels startup/recovery, disposes the game, cleans up outputs and releases the port. Concurrent calls share the operation; already-disconnected calls are safe. Handle cleanup rejection. |
| `microbit.createGameSession()` | Synchronously returns `{ inputs, outputs, dispose }`. Throws unless input is ready and no other game is active or being disposed. |
| `microbit.getState()` | Synchronously returns the current deeply frozen state, including before a game exists. It does not subscribe. |
| `microbit.capabilities` | Read-only capabilities object, or `null` before discovery/after full disconnect. Retained during recovery. |
| `microbit.onError(callback)` | Returns an unsubscribe function for page-level diagnostics. This listener survives game disposal/disconnection until removed. |

Capabilities contain `sensors` (`buttons`, `accelerometer`, `temperature`, `light`, `microphone`, `logoTouch`) and `outputs.ledDisplay`, `outputs.speaker` (the method names below), plus `outputs.builtInSounds` (advertised sound names). Required V2 capabilities are checked during connection; the sound catalog may be empty. Read it rather than assuming names:

```js
const names = microbit.capabilities?.outputs.builtInSounds ?? [];
if (names.length) await game.outputs.speaker.playBuiltInSound(names[0]);
```

## Reading inputs

| Method on `game.inputs` | Callback |
|---|---|
| `subscribe(callback)` | `callback(state)` immediately, then for each accepted snapshot/lifecycle update. Use for held controls and sensor values. |
| `onPress(callback)` | `callback({ input, count })`; `input` is `'a'`, `'b'` or `'logo'`, and `count` is a positive integer. Use for one-shot actions. |
| `onGesture(callback)` | `callback('shake')` when a shake is detected. No other gesture names are currently emitted. |

All three return an unsubscribe function. Duplicate registrations are independent; event subscriptions do not replay history. State callbacks precede press callbacks (A, B, logo order), then gesture callbacks. Keep callbacks short and synchronous; thrown exceptions are reported as `callback` errors without stopping other subscribers. Catch rejected asynchronous work yourself, e.g. `void doAsyncWork().catch(report)`.

```js
const unsubscribe = game.inputs.subscribe(state => console.log(state.inputAvailable));
unsubscribe(); // Removes only this listener; game.dispose() removes all game listeners.
```

### State reference

Snapshots normally arrive at **50 Hz**; temperature/light/microphone conversions can update more slowly. All fields below exist in each state. Nested objects are immutable. Check `inputAvailable` before using readings for gameplay.

| Field | Available input | Unavailable input |
|---|---|---|
| `connection` | `'connected'` | `'connecting'` (startup/recovery) or `'disconnected'` |
| `inputAvailable` | `true` | `false` |
| `board` | `'microbit-v2'` | Validated identity during recovery; otherwise `null` until discovered/after disconnect |
| `buttons.aPressed`, `buttons.bPressed` | Held-state booleans; A+B means both are true | Both `false` |
| `tilt.x`, `tilt.y` | Numbers in `[-1, 1]`; positive X = right, positive Y = down toward gold connectors, with USB at the top | Both `0` |
| `accelerometer` | `{ xMg, yMg, zMg, strengthMg, gesture }`; axes are integer mg in `[-8192, 8192]` | `null` |
| `temperatureC` | Integer board temperature estimate, `-40..125` °C; not ambient temperature | `null` |
| `lightLevel` | Integer `0..255`, not lux; V2 senses through the top LED row | `null` |
| `microphone` | `{ soundLevel, soundEvent }`; level is integer `0..255`, label is `'quiet'` or `'loud'` | `null` |
| `touch.logoPressed` | Held-state boolean for the gold logo | `null` |

`buttons`, `tilt` and `touch` always exist. Use optional chaining for unavailable objects: `state.microphone?.soundLevel`, `state.accelerometer?.xMg`. A valid reading of `0` differs from unavailable `null`.

- **Tilt:** Per axis, `v = clamp(axisMg / 1000, -1, 1)`. Return 0 when `abs(v) <= 0.05`; otherwise `sign(v) * (abs(v) - 0.05) / 0.95`. No smoothing; raw axes are unchanged. Flat, LEDs-up Z is approximately `-1000` mg.
- **Strength:** `strengthMg = Math.round(Math.hypot(xMg, yMg, zMg))`, including gravity.
- **Presses:** Cumulative firmware counts preserve debounced presses whose held-state samples were missed. Apply `count`, not just one action per callback. They do not reconstruct releases, exact timing or physical A/B/logo ordering. First connection/recovery and first post-game-creation snapshots establish baselines without historical events.
- **Shake:** Three alternating excursions of at least 1200 mg on X or Y within 600 ms, allowing intermediate samples. After detection, re-arming requires 500 ms cooldown and 200 ms continuous quiet; quiet means adjacent changes under 300 mg on every axis. Sequence gaps or sample intervals over 100 ms clear/disarm history until 200 ms of fresh quiet, plus any remaining cooldown. `accelerometer.gesture` is `'shake'` for **one snapshot**, otherwise `null`; use `onGesture` rather than polling the pulse. Not every physical shake is guaranteed to be recognized.
- **Sound label:** First sample is loud at level ≥180, otherwise quiet. Subsequently, ≥180 switches to loud, ≤120 switches to quiet, and intermediate values retain the label. This is a level classification, not a clap event. The microphone can hear the board's speaker.

There is no raw serial/snapshot subscription, sequence/timestamp field, compass or gyroscope in the public game API. All supported sensors are supplied together; games do not request sensor subsets.

## Sending outputs

Use `const { display, speaker } = game.outputs`. **Every output method returns `Promise<void>`** and requires the current game and ready input. Handle every rejection. Numbers must be integers; strings/booleans are not coerced. Arrays are copied/encoded at submission, so later edits cannot change queued commands.

| Method | Arguments, limits and effect |
|---|---|
| `display.showText(text)` | Scroll 1–32 characters. Exact alphabet: `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,!?:+-/()`. Fixed 50 ms/column, six columns/character; ends blank within 10000 ms. No newline, emoji or escaping. |
| `display.showImage(pixels)` | Flat array of **25 integers, 0..9** (0 off, 9 full brightness), row-major from top-left with USB at the top. Holds until replaced/cleared. |
| `display.clear()` | Cancel scrolling and blank the display. |
| `speaker.playTone({ frequencyHz, durationMs, volume = 128 })` | Frequency **0** for silence or **20..9999 Hz**; duration **1..10000 ms**; volume **0..255**. Frequency and duration are required. |
| `speaker.playMelody({ notes, volume = 128 })` | **1–16** `{ frequencyHz, durationMs }` notes with tone bounds; total duration **≤10000 ms**. Use frequency 0 for a rest. |
| `speaker.playBuiltInSound(name)` | Exact advertised name from `microbit.capabilities.outputs.builtInSounds`; fixed volume 128, firmware-defined duration ≤10000 ms. Empty catalogs offer none. |
| `speaker.stop()` | Stop all speaker playback modes. |

An image and a composed melody can run independently:

```js
await game.outputs.display.showImage([
  0, 9, 0, 9, 0,
  9, 9, 9, 9, 9,
  9, 9, 9, 9, 9,
  0, 9, 9, 9, 0,
  0, 0, 9, 0, 0,
]);
await game.outputs.speaker.playMelody({
  volume: 96,
  notes: [
    { frequencyHz: 440, durationMs: 200 },
    { frequencyHz: 0, durationMs: 100 }, // Rest.
    { frequencyHz: 660, durationMs: 300 },
  ],
});
```

**Resolved means applied/started, not playback finished.** A later command replaces active output on the same target; `await playTone(...); await playTone(...)` can interrupt the first tone. Use one `playMelody` call for consecutive notes. There is no playback-completion callback/Promise. Display and speaker are independent; invalid commands leave active outputs unchanged.

Calls are FIFO with one command in flight and at most **16 waiting**; excess calls reject with `queue-full`. Avoid sending outputs for every 50 Hz input update. A missing result after **1000 ms from the completed write**, or a failed/partial write, makes execution uncertain: old calls reject and the connection recovers or closes. Commands are never automatically replayed; do not blindly retry uncertain actions.

## Recovery and game lifecycle

After **500 ms without a newly accepted snapshot**, controls become unavailable/neutral and the adapter attempts one handshake on the existing port. Startup/recovery requires metadata plus a new snapshot within **3000 ms after the handshake write**. Invalid/duplicate/older data cannot keep input alive. Failure or physical removal leaves the adapter disconnected; reconnect through a user-triggered `microbit.connect()`.

Unexpected loss retains the current game facade/subscriptions. Recovery resets input/event baselines and does not resume gameplay: pause on unavailable input and require the player's continuation choice. Read status with `getState()` before a game exists; there is no separate page-level state subscription. Explicit `disconnect()` disposes the game, so create a new session after a later connection.

Switch games by awaiting disposal while keeping the shared port:

```js
await game.dispose();                 // Removes all game subscriptions immediately.
game = microbit.createGameSession();  // Only after disposal succeeds and input is ready.
```

`dispose(): Promise<void>` immediately blocks new calls/subscriptions (`disposed`), rejects unsent work and drains written commands, then acknowledges speaker STOP and display CLEAR. It resolves after cleanup; failure closes the connection and rejects. Repeated disposal shares its result. An already-disconnected game disposes locally without device commands. Page error listeners are separate: call their unsubscribe functions when no longer needed.

Await `microbit.disconnect()` when leaving the page/controller. Abrupt tab closure/unplugging cannot guarantee cleanup, and firmware has no host heartbeat; finite playback ends within its duration bounds, while a held image may remain. Native chooser UI cannot be forcibly dismissed: logical cancellation fences its result and prevents another chooser until it settles. Native open/write/close operations have a separate 3000 ms watchdog; incomplete cleanup reports failure and blocks new connections while resources remain owned.

## Handling errors

```js
import { MicrobitError } from '/src/microbit-input/index.js';
try {
  await game.outputs.display.showText('READY');
} catch (error) {
  if (error instanceof MicrobitError) {
    console.error(error.kind, error.message, error.protocolCode, error.commandId);
  } else { throw error; }
}
```

| `error.kind` | Meaning / handling |
|---|---|
| `connection` | Unsupported environment/board, denied permission, lost/not-ready port or pending cleanup; inspect state and offer a suitable connect action. |
| `protocol` | Invalid incoming data, sequence gaps or unknown device error codes; inspect diagnostics/availability. Not every diagnostic closes the connection. |
| `capability` | Missing required capability or unadvertised sound; inspect the catalog. |
| `validation` | Invalid local argument/callback; correct it before retrying. No command was sent. |
| `command` | Device rejection (`INTERNAL_ERROR` may follow side effects), or command-ID exhaustion requiring a fresh session; inspect code/message. |
| `timeout` | Handshake, freshness, result or native-operation deadline; inspect state and treat output execution as uncertain. |
| `queue-full` | Sixteen calls already waiting; reduce output rate. This call was not sent. |
| `disposed` | Old game facade or another game still active/disposing; await cleanup and use the current session. |
| `callback` | A synchronous subscriber threw; fix the callback. Other subscribers continue. |

`message` is always present; `protocolCode` and `commandId` are optional. Device codes: `LINE_TOO_LONG`, `DUPLICATE_ID`, `UNSUPPORTED_VERSION`, `MALFORMED_COMMAND`, `UNSUPPORTED_ACTION`, `UNSUPPORTED_OUTPUT`, `OUT_OF_RANGE`, `INVALID_TEXT`, `UNSUPPORTED_SOUND`, `INTERNAL_ERROR`; meanings are in the [serial contract](../../../spec/contracts/microbit-webapp/microbit-serial-protocol.md#output-scheduling-and-results). A rejected call may also reach `onError`; handle rejections for individual calls and use `onError` for page-wide diagnostics. Synchronous session creation/subscription argument errors must be caught directly.

## Example and verification

From `webapp/`, run `npm ci` and `npm run dev:input`, then open `http://127.0.0.1:4173/examples/microbit-input/`. Start either game to activate its subscriptions/outputs. The example includes a 5×5 brightness editor with explicit Send image, a clickable piano, tone/melody/named-sound controls, light range and persistent shake count. Edits stay local until sent; changing the draft and clearing the device are separate actions.

Software checks: `npm test`; install Chromium once with `npx playwright install chromium`, then `npm run test:browser`. Benchmarks: `npm run benchmark:input`. See [verification tools](../../verification/README.md), [initial validation](../../results/game-input-validation.md) and [sensor follow-up](../../results/input-sensor-follow-up.md) for recorded environments and hardware/latency limits.

The [public API contract](../../../spec/contracts/microbit-webapp/web-page-developer-interface.md) owns exact behavior/derivation details. [Implementation notes](../../spec/game-input-implementation-plan.md) and [JSDoc types](types.js) are for maintainers; game code imports only `index.js`.
