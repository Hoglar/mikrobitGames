// spec/contracts/microbit-webapp/microbit-serial-protocol.md, version 1.
export const LIMITS = Object.freeze({ incoming: 1024, outgoing: 256, chunk: 16,
  pacingMs: 5, handshakeMs: 3000, freshnessMs: 500, resultMs: 1000,
  operationMs: 3000, waiting: 16, maxId: 2147483647 });
export const SERIAL_OPTIONS = Object.freeze({ baudRate: 115200, dataBits: 8,
  stopBits: 1, parity: 'none', flowControl: 'none', bufferSize: 16384 });
export const SENSORS = Object.freeze(['buttons', 'accelerometer', 'temperature', 'light', 'microphone', 'logoTouch']);
export const DISPLAY = Object.freeze(['showText', 'showImage', 'clear']);
export const SPEAKER = Object.freeze(['playTone', 'playMelody', 'playBuiltInSound', 'stop']);
export const CODES = Object.freeze(['LINE_TOO_LONG', 'DUPLICATE_ID', 'UNSUPPORTED_VERSION',
  'MALFORMED_COMMAND', 'UNSUPPORTED_ACTION', 'UNSUPPORTED_OUTPUT', 'OUT_OF_RANGE',
  'INVALID_TEXT', 'UNSUPPORTED_SOUND', 'INTERNAL_ERROR']);
export const delta32 = (next, previous) => (next - previous + 4294967296) % 4294967296;
export const forward = n => n > 0 && n < 2147483648;
