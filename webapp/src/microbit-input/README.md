# Shared micro:bit game input library

Framework-independent JavaScript ES modules for the version 1 V2 serial protocol. There are no runtime packages, backend calls or game-specific wire messages. The page owns the exported singleton; each game receives one disposable facade. Importing the library performs no browser I/O.

```js
import { microbit } from './microbit-input/index.js';

// Invoke from a page button's user-gesture handler.
await microbit.connect();
const game = microbit.createGameSession();

const unsubscribe = game.inputs.subscribe(state => {
  player.setControlsEnabled(state.inputAvailable);
  player.setTilt(state.tilt.x, state.tilt.y);
  player.setButton('a', state.buttons.aPressed);
});
game.inputs.onPress(({ input, count }) => {
  if (input === 'a') player.jump(count);
});
game.inputs.onGesture(name => {
  if (name === 'shake') player.activateAbility();
});

await game.outputs.display.showText('READY');
await game.outputs.speaker.playTone({ frequencyHz: 440, durationMs: 250 });
// Acknowledged means applied/started; another sound can replace this one.

unsubscribe();
await game.dispose(); // Reject old work, drain an already-written ID, STOP, CLEAR.
await microbit.disconnect(); // Page-level exit; releases the shared port.
```

Use the [developer interface](../../../spec/contracts/microbit-webapp/web-page-developer-interface.md) for the complete public API, state shape, arguments/defaults and event rules. All output methods return Promises; handle their rejections. `getState()` and `capabilities` expose frozen data. `onError(callback)` returns an unsubscribe function and reports connection/protocol/device diagnostics and isolated callback failures (`kind: "callback"`). Joining an event subscription does not replay events. Callback exceptions do not stop other subscriptions.

The adapter requires a secure-context browser with Web Serial. It selects a port only when the page calls `connect()`; it validates V2 identity/capabilities through `deviceInfo`, then waits for the first valid snapshot. Missing/invalid snapshots cannot keep input alive. A 500 ms freshness loss publishes safe unavailable state and attempts one handshake on the open port; failed recovery/physical removal closes the connection. Unexpected loss retains the current game facade for a later explicit reconnect. The platform must pause and require the player's continuation choice after recovery; the library never starts/resumes game simulation or saves results.

One command can be in flight, with sixteen waiting calls. Commands are validated and encoded into owned strings before enqueueing. IDs are assigned at first write; writes use at most 16 ASCII bytes per chunk, at least 5 ms between chunk starts. A missing result after 1000 ms or a partial write rejects old calls and recovers without replay. A possibly partial line is terminated before the new HELLO. Unknown result IDs cannot settle another command.

Explicit disposal is awaited before starting another game. A disposed facade cannot subscribe or send more outputs. Disconnect/dispose attempts device cleanup when usable; an already-removed board can only be disposed locally. No device heartbeat stops outputs on abrupt browser exit; firmware output-duration bounds still apply.

Native chooser promises cannot be canceled. Logical cancellation rejects startup immediately and fences the chooser's eventual result; only one native chooser can remain outstanding. Selected-port open/write/close operations have a separate 3000 ms local watchdog. Hung cleanup reports failure and retains ownership of late native operations; a new connection is blocked while those resources are still closing. This prevents late cleanup closing a newer connection.

## Modules and verification

`adapter.js` composes the state machine; `transport/` owns native Streams and paced writes; `protocol/` owns bounded framing/strict validation/encoding; `inputs/` owns mapping and device-time derivation; `outputs/` owns the FIFO and correlation; `sessions.js` fences game callbacks. JSDoc records live in `types.js`. `createAdapter` in `adapter.js` is the internal test seam for injected clocks/transports/diagnostics; games use `index.js`.

From `webapp/`:

```sh
npm ci
npm test
npx playwright install chromium
npm run test:browser
npm run benchmark:input
npm run dev:input
```

Open `http://127.0.0.1:4173/examples/microbit-input/` for the two-game example. It uses the production singleton; browser tests install their serial mocks before import. The example is a local developer tool, separate from the production launcher/authentication/Testlab UI.

Outputs include a 5×5 drawing editor and a clickable piano. Click pixels to toggle them, or drag to paint/erase at the selected brightness (0..9). Send image transfers the drawing; Clear drawing edits only the local draft, while Clear display affects only the board. The USB marker indicates the top edge. Drawings can be prepared before connecting; sending outputs requires a ready connection and either example game.

Piano keys play one note per click using the selected octave, note length and volume; the micro:bit plays one sound at a time, so a later note replaces the previous one. Tone frequency is adjustable separately. Rising/falling scales, an arpeggio and Twinkle, twinkle use the octave and note settings; melodies exceeding 10000 ms are rejected locally. The named-sound selector lists the board's advertised catalog; those sounds retain their own fixed volume/duration. Stop sound interrupts playback. The example adds no wire commands or browser-generated audio.

The example's Sensor checks show the current light level and its observed range, plus a persistent shake count, last detection time and two-second highlight. Start either game to activate gesture subscriptions. `accelerometer.gesture` itself remains a one-snapshot pulse; use `onGesture` for actions rather than polling that field. Reset readings clears the example's counters/range without resetting the library's classifier. Light values are the firmware's raw 0..255 scale, not lux; the V2 senses through the top LED row. A direct phone flashlight produced 246–248 in the 2026-10-28 check even when ambient lighting read zero. See [follow-up results](../../results/input-sensor-follow-up.md).

See [validation results](../../results/game-input-validation.md). Automated Streams/browser mocks do not prove real permission dialogs, USB behavior, physical V2 interoperability or instrumented input latency.
