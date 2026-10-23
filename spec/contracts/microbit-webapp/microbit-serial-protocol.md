# Proposed Bidirectional micro:bit Serial Protocol

This document proposes the micro:bit firmware side of the serial protocol: sending built-in sensor snapshots to the web page and receiving commands that control built-in outputs. It shows a micro:bit V2; a V1 omits V2-only fields and advertises only outputs it supports. External sensors or actuators connected to pins are out of scope. This is a proposed protocol, not an implemented contract.

## Example Snapshot

```json
{"n":1842,"a":0,"b":1,"x":12,"y":-34,"z":998,"t":23,"l":80,"m":12,"q":0}
```

## Field Guidance

The handshake's `deviceInfo` carries `protocolVersion`, board identity, and capabilities. Snapshots omit repeated metadata, the `type` field, and a `sensors` wrapper. After handshake, every JSON line without a `type` field is a complete snapshot. Serialize snapshots as compact JSON without spaces or pretty-printing.

| Key | Reading | Encoding |
|---|---|---|
| `n` | Snapshot sequence | Integer incremented per snapshot; resets on device reboot. |
| `a`, `b` | Button A/B | `0` released, `1` pressed. |
| `x`, `y`, `z` | Accelerometer axes | Signed integer in milligravity (`mg`). |
| `t` | Board temperature estimate | Integer in degrees Celsius; not ambient air temperature. |
| `l` | Light level | Integer in the micro:bit API's range (typically 0–255). |
| `m` | Microphone sound level (V2 only) | Integer in the micro:bit API's range (typically 0–255). |
| `q` | Touch logo (V2 only) | `0` not touched, `1` touched. |

Transmit only keys supported by the board; omit unavailable keys rather than sending `null`. The browser uses `deviceInfo` capabilities to map omitted V2 readings to `null` in the public game state.

The snapshot deliberately omits compass readings, acceleration strength, recognized gestures, and sound-event labels. Compass is excluded from this input contract; acceleration strength can be calculated from `x`, `y`, and `z`, gestures can be derived from the accelerometer stream, and sound-event labels can be derived from `m` if needed. The browser records its own receive timestamp; `n` remains for detecting skipped snapshots.

## Board Differences

Both generations provide buttons A/B, an accelerometer, LED-based light sensing, and an internal temperature reading. Micro:bit V2 adds the built-in microphone and touch-sensitive logo. Although the board has a compass, this protocol intentionally omits it because it is unlikely to be a game input and requires calibration. Neither generation has a built-in gyroscope. Confirm reading availability against the target firmware.

## Tilt Gesture Semantics

Tilt and gestures are derived from the raw accelerometer axes by the browser adapter; they are not transmitted as separate fields. The adapter can calculate normalized tilt and acceleration strength locally. Gesture classification, especially time-dependent gestures such as shake, depends on the received sample rate, so define and test its thresholds in the webapp.

## Message Framing and Startup

Use newline-delimited messages in both directions. `deviceInfo` is typed JSON; each subsequent sensor snapshot is compact JSON without a `type` field. Web-to-micro:bit commands use `C|...` lines and command results use `R|...` lines, both in the fixed ASCII `text-v1` grammar. This prefix distinction lets the browser identify a result line without parsing it as JSON; snapshot lines begin with `{`. Every line ends with `\n`. After opening the serial port, the web page sends `HELLO|1\n`. The firmware and web adapter must buffer until a complete line is available because a serial read may contain a partial message or several messages.

On each connection, the web page initiates the handshake with:

```text
HELLO|1
```

The micro:bit validates the bootstrap version and responds with `deviceInfo` so the page can verify the protocol version and discover board-specific capabilities:

```json
{
  "type": "deviceInfo",
  "protocolVersion": 1,
  "board": "microbit-v2",
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

The firmware starts periodic snapshots only after accepting `HELLO|1`; the web app considers the protocol ready only after receiving and validating `deviceInfo`. Ignore output commands received before the handshake completes. For an unsupported bootstrap version, reply with the plain-text line `ERR|UNSUPPORTED_VERSION` and do not start snapshots.

Protocol version 1 fixes `text-v1` as the command and result grammar. A future syntax change must update the protocol version and handshake contract. The game-facing API remains independent of the wire format. Sensor snapshots and `deviceInfo` remain JSON. A V1 reports only supported capabilities (for example, no built-in microphone, logo touch, or speaker). After the handshake, the firmware sends periodic snapshots as shown above. Snapshot interval is configurable/implementation-defined, and `n` increases for each snapshot.

## Web-to-micro:bit Commands

Every command has a decimal `commandId` so the firmware can acknowledge or reject it. Commands use the fixed `text-v1` encoding and cover the built-in outputs only.

### LED display (V1 and V2)

Show scrolling text:

```text
C|1|101|D|TEXT|READY
```

Show a 5-by-5 image, where each pixel brightness is an integer from 0 (off) to 9 (bright):

```text
C|1|102|D|IMAGE|0090009090900090909000900
```

Clear the display with `C|1|<commandId>|D|CLEAR`.

### Built-in speaker (V2 only)

Play one tone:

```text
C|1|103|S|TONE|440|250|128
```

A `MELODY` command carries volume (0–255) and comma-separated `frequencyHz:durationMs` note pairs. `SOUND` takes a built-in sound name advertised in `capabilities.outputs.builtInSounds` (for example, `happy` or `hello`):

```text
C|1|104|S|SOUND|happy
```

Stop active playback with `C|1|<commandId>|S|STOP`. Commands targeting a capability the board does not advertise are rejected as unsupported.

## Command Responses and Firmware Behavior

The micro:bit replies to every command with a text result line matching its command ID. Results intentionally remain text rather than JSON: the `R|` prefix makes them easy to distinguish from compact JSON snapshot lines (which begin with `{`) and avoids JSON response parsing/extra bytes. `OK` means the command was accepted and applied or started; it does not mean a scroll or sound has finished playing.

```text
R|1|103|OK
R|1|105|ERR|UNSUPPORTED_OUTPUT
```

For invalid commands, use `R|1|<commandId>|ERR|<ERROR_CODE>` when the ID can be recovered. Validate command version, action, ranges, text characters, and board capabilities before acting; malformed input must not stop sensor reporting. Keep snapshots flowing while processing commands, and avoid blocking display/audio playback where the selected firmware API allows it.

## `text-v1` Command Grammar

All web-to-micro:bit commands and command results use this grammar; there is no JSON-command mode. This avoids firmware JSON command parsing while keeping JSON `deviceInfo` and sensor snapshots unchanged. The firmware still needs to generate those JSON messages.

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

`CLEAR` and `STOP` carry no arguments. The receiver must reject malformed lines, unsupported versions/actions, invalid ranges, and commands for unavailable outputs without stopping snapshot reporting. Define a maximum line length and maximum melody length in the implementation. The game-facing browser API remains unchanged; the adapter always uses `text-v1` for commands and results.

## Built-in Output Scope

The built-in 5×5 LED display is controllable on both micro:bit generations. Micro:bit V2 has a built-in speaker; V1 does not have a speaker for standalone audio output. Neither generation has a built-in rumble/vibration motor. Power and microphone indicator LEDs are not general-purpose display outputs. GPIO-connected speakers, motors, or other actuators require external wiring and are outside this built-in protocol.