# Proposed Bidirectional micro:bit Serial Protocol

This document proposes the micro:bit firmware side of the serial protocol: sending built-in sensor snapshots to the web page and receiving commands that control built-in outputs. It shows a micro:bit V2; a V1 omits V2-only fields and advertises only outputs it supports. External sensors or actuators connected to pins are out of scope. This is a proposed protocol, not an implemented contract.

## Example Snapshot

```json
{
  "type": "sensorSnapshot",
  "protocolVersion": 1,
  "sequence": 1842,
  "uptimeMs": 92100,
  "board": "microbit-v2",
  "sensors": {
    "buttons": {
      "a": false,
      "b": true
    },
    "accelerometer": {
      "xMg": 12,
      "yMg": -34,
      "zMg": 998,
      "strengthMg": 999,
      "gesture": "left"
    },
    "compass": {
      "headingDegrees": 271,
      "xNanoTesla": 18000,
      "yNanoTesla": -7000,
      "zNanoTesla": 42000,
      "fieldStrengthNanoTesla": 46500
    },
    "temperatureC": 23,
    "lightLevel": 80,
    "microphone": {
      "soundLevel": 12,
      "soundEvent": "quiet"
    },
    "touch": {
      "logoPressed": false
    }
  }
}
```

## Field Guidance

- `protocolVersion` identifies the schema version so the browser adapter can handle incompatible changes.
- `sequence` increments for each snapshot, helping detect skipped messages.
- `uptimeMs` is elapsed time since the micro:bit started; it avoids relying on synchronized clocks.
- `board` identifies the board generation, such as `microbit-v1` or `microbit-v2`.
- `sensors` contains the latest readings. Include only fields supported by the detected board/API; do not send placeholder fields for hardware the board does not have.
- Accelerometer axes and strength use milligravity (`mg`). Compass heading is in degrees; raw magnetic-field axes and magnitude are in nanotesla. Temperature is the micro:bit's internal temperature estimate in degrees Celsius, not ambient air temperature. Light and sound levels use the API scale (commonly 0–255).
- `gesture` is a value recognized from accelerometer data, not a separate sensor. Common gestures include `up`, `down`, `left`, `right`, `face_up`, `face_down`, `freefall`, `3g`, `6g`, `8g`, and `shake`.
- For external sensors connected to pins, define a separate extension schema rather than treating the pins themselves as built-in sensors.

## Board Differences

Both generations have buttons A/B, an accelerometer, a compass, an LED display that can be used to sense light, and an internal temperature reading. Micro:bit V2 adds the built-in microphone and touch-sensitive logo. The built-in micro:bit has no gyroscope, so there is no gyroscope reading in this schema. Exact API availability can depend on firmware; confirm it for the implementation target.

## Tilt Gesture Semantics

Tilt gestures are derived from the accelerometer, not a separate physical sensor. The firmware reports the latest recognized native gesture (for example `up`, `down`, `left`, `right`, `face_up`, `face_down`, or `shake`) as part of each snapshot. These are coarse classifications; the raw axes are also sent so the web adapter can calculate smooth tilt controls. Gesture names and axis orientation must be interpreted consistently by the web adapter.

## Message Framing and Startup

Use newline-delimited JSON in both directions: each message is one JSON object followed by `\n`. The firmware must buffer incoming bytes until a full line is available; one serial read may contain a partial message or several messages. The web adapter uses the same rule for incoming micro:bit messages.

On startup or connection, the micro:bit sends a `deviceInfo` message so the page can discover board-specific capabilities:

```json
{
  "type": "deviceInfo",
  "protocolVersion": 1,
  "board": "microbit-v2",
  "capabilities": {
    "sensors": ["buttons", "accelerometer", "compass", "temperature", "light", "microphone", "logoTouch"],
    "outputs": {
      "ledDisplay": ["showText", "showImage", "clear"],
      "speaker": ["playTone", "playMelody", "playBuiltInSound", "stop"],
      "builtInSounds": ["hello", "happy"]
    }
  }
}
```

A V1 reports only supported capabilities (for example, no built-in microphone, logo touch, or speaker). The firmware then sends periodic `sensorSnapshot` messages as shown above. Snapshot interval is configurable/implementation-defined, and sequence numbers increase for each snapshot.

## Web-to-micro:bit Commands

Every command has a `commandId` so the firmware can acknowledge or reject it. The examples below define the built-in outputs only.

### LED display (V1 and V2)

Show scrolling text:

```json
{
  "type": "command",
  "protocolVersion": 1,
  "commandId": "web-101",
  "target": "ledDisplay",
  "action": "showText",
  "text": "READY"
}
```

Show a 5-by-5 image, where each pixel brightness is an integer from 0 (off) to 9 (bright):

```json
{
  "type": "command",
  "protocolVersion": 1,
  "commandId": "web-102",
  "target": "ledDisplay",
  "action": "showImage",
  "pixels": [[0,0,9,0,0],[0,9,0,9,0],[9,0,0,0,9],[0,9,0,9,0],[0,0,9,0,0]]
}
```

Clear the display with `"target":"ledDisplay"` and `"action":"clear"`.

### Built-in speaker (V2 only)

Play one tone:

```json
{
  "type": "command",
  "protocolVersion": 1,
  "commandId": "web-103",
  "target": "speaker",
  "action": "playTone",
  "frequencyHz": 440,
  "durationMs": 250,
  "volume": 128
}
```

A `playMelody` command can carry an array of `{ "frequencyHz": ..., "durationMs": ... }` notes and an optional volume (0–255). `playBuiltInSound` takes a `name` advertised in `capabilities.outputs.builtInSounds` (for example, `happy` or `hello`):

```json
{
  "type": "command",
  "protocolVersion": 1,
  "commandId": "web-104",
  "target": "speaker",
  "action": "playBuiltInSound",
  "name": "happy"
}
```

`stop` stops active playback. Commands targeting a capability the board does not advertise are rejected as unsupported.

## Command Responses and Firmware Behavior

The micro:bit replies to each command with a result message. `status: "ok"` means the command was accepted and applied or started; it does not mean a scroll or sound has finished playing.

```json
{
  "type": "commandResult",
  "protocolVersion": 1,
  "commandId": "web-103",
  "status": "ok"
}
```

For invalid or unsupported commands, use `"status":"error"` and an `errorCode` such as `invalid_command`, `invalid_argument`, or `unsupported_output`. The firmware should validate message type, protocol version, action, ranges, and capabilities before acting; malformed input must not stop sensor reporting. Keep sensor snapshots flowing while processing commands, and avoid blocking display/audio playback where the selected firmware API allows it.

## Built-in Output Scope

The built-in 5×5 LED display is controllable on both micro:bit generations. Micro:bit V2 has a built-in speaker; V1 does not have a speaker for standalone audio output. Neither generation has a built-in rumble/vibration motor. Power and microphone indicator LEDs are not general-purpose display outputs. GPIO-connected speakers, motors, or other actuators require external wiring and are outside this built-in protocol.