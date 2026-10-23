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

Use newline-delimited messages in both directions. `deviceInfo` and `sensorSnapshot` are always JSON objects followed by `\n`. Commands and their results use JSON by default (`commandEncoding: "json-v1"`); in the compact `text-v1` fallback, both commands and results use the text grammar below. The firmware and web adapter must buffer until a complete line is available because a serial read may contain a partial message or several messages.

On startup or connection, the micro:bit sends a `deviceInfo` message so the page can discover board-specific capabilities:

```json
{
  "type": "deviceInfo",
  "protocolVersion": 1,
  "commandEncoding": "json-v1",
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

`commandEncoding` identifies the web-to-micro:bit command and result syntax. Use `json-v1` by default; use `text-v1` only when the chosen firmware cannot parse JSON commands reliably or measurements show a real resource problem. If this field is absent in an older `deviceInfo`, the browser assumes `json-v1`; `text-v1` must always be advertised explicitly. Sensor snapshots and `deviceInfo` remain JSON in either mode. A V1 reports only supported capabilities (for example, no built-in microphone, logo touch, or speaker). The firmware then sends periodic `sensorSnapshot` messages as shown above. Snapshot interval is configurable/implementation-defined, and sequence numbers increase for each snapshot.

## Web-to-micro:bit Commands

Every command has a `commandId` so the firmware can acknowledge or reject it. The examples below define the built-in outputs only and use the default JSON command encoding (`json-v1`).

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

With `json-v1`, the micro:bit replies to each command with a JSON result message. `status: "ok"` means the command was accepted and applied or started; it does not mean a scroll or sound has finished playing.

```json
{
  "type": "commandResult",
  "protocolVersion": 1,
  "commandId": "web-103",
  "status": "ok"
}
```

For invalid or unsupported `json-v1` commands, use `"status":"error"` and an `errorCode` such as `invalid_command`, `invalid_argument`, or `unsupported_output`. The firmware should validate message type, protocol version, action, ranges, and capabilities before acting; malformed input must not stop sensor reporting. Keep sensor snapshots flowing while processing commands, and avoid blocking display/audio playback where the selected firmware API allows it.

## Fallback Command Encoding: `text-v1`

Use this format only if the selected micro:bit runtime lacks a usable JSON parser or target-device measurements show that JSON command parsing is unreliable or too costly. It is an alternative to the JSON commands above, not a second format used simultaneously. This fallback avoids parsing JSON commands but does not remove the need to generate JSON `deviceInfo` and sensor snapshots. `deviceInfo.commandEncoding` must be `text-v1` so the browser selects the matching encoder and result parser. `deviceInfo`, sensor snapshots, and their schemas remain JSON.

Each command is one ASCII line with fields separated by `|`:

```text
C|1|42|D|TEXT|READY
C|1|43|D|IMAGE|<25 brightness digits, row-major, each 0-9>
C|1|44|D|CLEAR
C|1|45|S|TONE|440|250|128
C|1|46|S|MELODY|128|440:200,660:300
C|1|47|S|SOUND|happy
C|1|48|S|STOP
```

Field order is `C|version|commandId|target|action|arguments`. `D` means LED display and `S` means speaker. `commandId` is a decimal integer unique among outstanding commands. `TEXT` accepts only supported printable display characters; the text must not contain `|`, carriage return, or newline. If arbitrary text is needed, define and test an escaping or length-prefixed encoding before enabling it. `IMAGE` carries exactly 25 brightness digits in row-major order. `TONE` arguments are frequency in Hz, duration in ms, and volume 0–255. `MELODY` carries volume followed by comma-separated `frequencyHz:durationMs` notes. `SOUND` names must be advertised by the device.

Results are one line, matching the request ID:

```text
R|1|42|OK
R|1|45|ERR|UNSUPPORTED_OUTPUT
```

The receiver must reject malformed lines, unsupported versions/actions, invalid ranges, and commands for unavailable outputs without stopping snapshot reporting. Define a maximum line length and maximum melody length in the implementation. The browser API remains unchanged; only its transport encoder and result parser vary by `commandEncoding`.

## Built-in Output Scope

The built-in 5×5 LED display is controllable on both micro:bit generations. Micro:bit V2 has a built-in speaker; V1 does not have a speaker for standalone audio output. Neither generation has a built-in rumble/vibration motor. Power and microphone indicator LEDs are not general-purpose display outputs. GPIO-connected speakers, motors, or other actuators require external wiring and are outside this built-in protocol.