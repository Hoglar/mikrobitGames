# Web-Page Developer Interface for micro:bit Inputs and Outputs

This document proposes the game-facing browser API and explains how a shared adapter handles the bidirectional newline-delimited JSON serial protocol. Games should use this interface rather than parsing serial messages or depending on board-specific details.

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

The interface names are proposals. A React hook can wrap this facade if the page uses React, while keeping the underlying service independent of the framework.

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
  compass: {
    headingDegrees: 271,
    xNanoTesla: 18000, yNanoTesla: -7000, zNanoTesla: 42000,
    fieldStrengthNanoTesla: 46500
  },
  temperatureC: 23,
  lightLevel: 80,
  microphone: { soundLevel: 12, soundEvent: "quiet" },
  touch: { logoPressed: false }
}
```

- `tilt.x` and `tilt.y` are normalized to `-1.0` through `1.0`; the adapter defines and documents axis orientation, applies a small dead zone, and may smooth noisy values. Raw accelerometer fields remain available.
- `buttons` are the latest pressed states. Games may use state for hold controls and detect edges for one-shot actions such as jump.
- `accelerometer.gesture` is the latest gesture classification. The adapter maps board-native names to stable names and emits `onGesture` when a new gesture is detected, rather than once for every repeated snapshot. Gestures are coarse; normalized tilt is preferred for continuous movement.
- V1 reports `microphone` and `touch.logo` as `null`; V2 provides those readings. The API has no gyroscope field because neither built-in board has a gyroscope.
- `connection` can be `disconnected`, `connecting`, or `connected`. Input state should be reset or marked unavailable when the connection is lost so games do not keep using stale button/tilt values.

## Serial Message Handling

The adapter owns the serial connection and is the only component that reads or writes the serial stream. It should:

1. Request a connection in response to an explicit user action, then read newline-terminated UTF-8 messages. Browser serial support and permissions are browser-dependent.
2. Buffer partial reads and split at newline boundaries; a read can contain part of a JSON object or several complete objects.
3. Parse each complete line according to the advertised command encoding: `deviceInfo` and `sensorSnapshot` are JSON; command results are JSON `commandResult` messages in `json-v1` or `R|...` lines in `text-v1`. Validate versions/types and report malformed/unknown lines without crashing games.
4. Treat each valid full snapshot as authoritative current state. Use `sequence` to notice skipped snapshots for diagnostics; a later full snapshot resynchronizes state.
5. Normalize fields and units, update the shared input state, and notify subscribers. Never let an individual game mutate adapter-owned sensor state.
6. Read `deviceInfo.commandEncoding` and serialize commands/results using the advertised encoding; default to `json-v1` if the field is absent, and use `text-v1` only when explicitly advertised. Correlate responses by `commandId` with the pending Promise; sensor snapshots and `deviceInfo` remain JSON in either mode.

A `deviceInfo` message supplies the board generation, supported sensor/output capabilities, and `commandEncoding`. The facade should expose capabilities so the UI can hide or disable unsupported features (for example, speaker controls on V1). The wire encoding is an adapter detail; games continue using the same output methods.

## Output Commands

The game API maps friendly methods to the protocol commands described in [the micro:bit serial protocol](./microbit-serial-protocol.md):

- `outputs.display.showText(text)`, `showImage(pixels)`, and `clear()` are supported by both board generations.
- `outputs.speaker.playTone(...)`, `playMelody(...)`, `playBuiltInSound(name)`, and `stop()` require the built-in V2 speaker. Built-in sound names are advertised by the device. Calls on boards without the requested capability should reject with a clear unsupported-capability error rather than silently doing nothing.
- The built-in micro:bit has no rumble motor. GPIO-connected motors or speakers require extra hardware and are not exposed by the built-in output API.

Each command resolves only after a successful result in the selected encoding; an error result rejects with a typed error including its protocol error code. The adapter should handle timeouts and reject pending commands if the serial connection closes.

## Input Validation and Errors

Expose connection, parsing, unsupported-capability, command, and timeout errors to the page through rejected Promises and/or an error subscription. Do not pass raw serial parsing errors into games as sensor values. Reset input state on disconnect, and keep transport and protocol errors separate from ordinary sensor readings.