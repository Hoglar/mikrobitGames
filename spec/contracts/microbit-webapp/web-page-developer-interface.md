# Web-Page Developer Interface for micro:bit Inputs and Outputs

This document proposes the game-facing browser API and explains how a shared adapter handles the bidirectional newline-delimited serial protocol. Games should use this interface rather than parsing serial messages or depending on board-specific details.

## Public API

A framework-independent facade can expose connection lifecycle, current input state, subscriptions, and output commands:

```javascript
await microbit.connect();

const unsubscribeState = microbit.inputs.subscribe((state) => {
  player.setTilt(state.tilt.x, state.tilt.y);
  player.setButton("a", state.buttons.aPressed);
});

const unsubscribeGesture = microbit.inputs.onGesture((gesture) => {
  if (gesture === "shake") player.activateAbility();
});

await microbit.outputs.display.showText("READY");
await microbit.outputs.speaker.playTone({ frequencyHz: 440, durationMs: 250 });
await microbit.outputs.speaker.playBuiltInSound("happy");

// When the game is closed:
unsubscribeState();
unsubscribeGesture();
await microbit.disconnect();
```

The interface names are proposals. `connect()` should resolve only after the `HELLO|1` handshake returns a valid `deviceInfo`; a handshake timeout or unsupported version rejects with a connection/protocol error. A React hook can wrap this facade if the page uses React, while keeping the underlying service independent of the framework.

## Game-Facing Input State

The adapter converts each `sensorSnapshot` into a stable state shape. Missing hardware-specific readings become `null` in the browser API, even though the micro:bit omits unsupported fields on the wire.

```javascript
{
  connection: "connected",
  board: "microbit-v2",
  buttons: { aPressed: false, bPressed: true },
  tilt: { x: 0.02, y: -0.41 },
  accelerometer: {
    xMg: 12, yMg: -34, zMg: 998, strengthMg: 999, gesture: "left"
  },
  temperatureC: 23,
  lightLevel: 80,
  microphone: { soundLevel: 12, soundEvent: "quiet" },
  touch: { logoPressed: false }
}
```

The adapter maps compact wire keys to the stable game API:

| Wire key | Public field |
|---|---|
| `a`, `b` | `buttons.aPressed`, `buttons.bPressed` (wire values `0`/`1` become booleans) |
| `x`, `y`, `z` | `accelerometer.xMg`, `.yMg`, `.zMg` |
| `t` | `temperatureC` |
| `l` | `lightLevel` |
| `m` | `microphone.soundLevel` (V2 only) |
| `q` | `touch.logoPressed` (V2 only) |
| `n` | Internal sequence tracking for dropped-snapshot diagnostics; not required by games |

The adapter derives normalized `tilt`, `strengthMg`, and gesture classifications from accelerometer samples. It may derive a sound-event label from `microphone.soundLevel` if the game API needs one. The protocol omits compass readings. Unsupported V2-only readings are absent on the wire and become `null` in the public state.

- `tilt.x` and `tilt.y` are normalized to `-1.0` through `1.0`; the adapter defines and documents axis orientation, applies a small dead zone, and may smooth noisy values. Raw accelerometer fields remain available.
- `buttons` are the latest pressed states. Games may use state for hold controls and detect edges for one-shot actions such as jump.
- `accelerometer.gesture` is classified by the adapter from the sequence of raw axes using stable game-facing names. It emits `onGesture` on a new recognized gesture rather than on every repeated snapshot. Gestures are coarse; normalized tilt is preferred for continuous movement.
- V1 reports `microphone` and `touch.logo` as `null`; V2 provides those readings. Compass is intentionally omitted from the game API. Neither built-in board has a gyroscope.
- `connection` can be `disconnected`, `connecting`, or `connected`. Input state should be reset or marked unavailable when the connection is lost so games do not keep using stale button/tilt values.

## Serial Message Handling

The adapter owns the serial connection and is the only component that reads or writes the serial stream. It should:

1. Request a connection in response to an explicit user action, open the serial port, and send the fixed bootstrap line `HELLO|1\n`. Wait for a valid `deviceInfo` before marking the protocol ready or sending output commands. Browser serial support and permissions are browser-dependent.
2. Buffer partial reads and split at newline boundaries; a read can contain part of a message or several complete messages.
3. Parse each complete line according to protocol state: expect JSON `deviceInfo` after `HELLO|1`, handle `ERR|UNSUPPORTED_VERSION` during bootstrap, then parse compact JSON snapshot objects (without a `type` field) and text result lines (`R|...`). Validate the snapshot shape and report malformed/unknown lines without crashing games.
4. Treat each valid full snapshot as authoritative current state. Use the compact `n` counter to notice skipped snapshots for diagnostics; a later full snapshot resynchronizes state.
5. Normalize fields and units, update the shared input state, and notify subscribers. Never let an individual game mutate adapter-owned sensor state.
6. Validate the protocol version from `deviceInfo`; serialize commands as ASCII `text-v1` lines and correlate `R|...` results by `commandId` with the pending Promise. Sensor snapshots and `deviceInfo` remain JSON.

A `deviceInfo` message supplies the protocol version, board generation, and supported sensor/output capabilities. Reject unsupported protocol versions. The facade should expose capabilities so the UI can hide or disable unsupported features (for example, speaker controls on V1). The wire encoding is fixed by the protocol; games continue using the same output methods.

## Output Commands

The game API maps friendly methods to the protocol commands described in [the micro:bit serial protocol](./microbit-serial-protocol.md):

- `outputs.display.showText(text)`, `showImage(pixels)`, and `clear()` are supported by both board generations.
- `outputs.speaker.playTone(...)`, `playMelody(...)`, `playBuiltInSound(name)`, and `stop()` require the built-in V2 speaker. Built-in sound names are advertised by the device. Calls on boards without the requested capability should reject with a clear unsupported-capability error rather than silently doing nothing.
- The built-in micro:bit has no rumble motor. GPIO-connected motors or speakers require extra hardware and are not exposed by the built-in output API.

Each command resolves only after a matching `R|1|<commandId>|OK` line; an `R|1|<commandId>|ERR|...` line rejects with a typed error including its protocol error code. The adapter should handle timeouts and reject pending commands if the serial connection closes.

## Input Validation and Errors

Expose connection, parsing, unsupported-capability, command, and timeout errors to the page through rejected Promises and/or an error subscription. Do not pass raw serial parsing errors into games as sensor values. Reset input state on disconnect, and keep transport and protocol errors separate from ordinary sensor readings.