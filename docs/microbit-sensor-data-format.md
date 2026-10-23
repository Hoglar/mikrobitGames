# Proposed micro:bit Sensor Data Format

This document proposes a JSON structure for full snapshots of the micro:bit's built-in sensor readings and user inputs. The example shows a micro:bit V2; a V1 message omits V2-only readings. External sensors connected to pins are not part of this built-in schema. This is a starting point for implementation, not a finalized protocol.

## Example Snapshot

```json
{
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

## Game-Facing Tilt Input

Yes—the micro:bit supports tilt gestures through its accelerometer. The recognized `up`, `down`, `left`, and `right` gestures are useful as discrete actions, but they are coarse classifications rather than smooth controls.

For responsive movement, the browser adapter should expose continuous, normalized tilt values (for example, `tiltX` and `tiltY` in the range `-1.0` to `1.0`) derived from the accelerometer axes. Keep the raw `xMg`, `yMg`, and `zMg` readings available for games that need them. The adapter should document axis orientation, apply a small dead zone to prevent drift, and optionally smooth values. Expose recognized gestures separately as discrete events, such as `onGesture("shake")` or `onGesture("tilt_left")`, rather than requiring each game to parse serial JSON or edge-detect repeated snapshot values.

The micro:bit's native gesture names depend on how the board is oriented. The shared adapter should map them to game-facing names consistently and distinguish a sustained orientation from a one-time gesture event.

A simple, framework-independent game API could expose the latest state and a gesture subscription:

```javascript
const unsubscribeState = microbitInputs.subscribe((inputs) => {
  player.setTilt(inputs.tilt.x, inputs.tilt.y);
  player.setButton("a", inputs.buttons.aPressed);
});

const unsubscribeGesture = microbitInputs.onGesture((gesture) => {
  if (gesture === "shake") player.activateAbility();
});
```

Games use the same normalized controls and button/gesture names, while the shared adapter handles serial parsing, board-specific differences, and gesture detection. A React hook can wrap this API later if the page uses React.

## Serial Framing

Send one JSON object per line, terminated by a newline. The browser adapter should buffer incoming serial data and parse complete lines, because serial reads may split one message or contain several messages.