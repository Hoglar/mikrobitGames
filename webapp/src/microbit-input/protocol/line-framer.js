import { LIMITS } from './constants.js';
import { error } from '../errors.js';

/** Fixed byte storage; callbacks run in wire order, with no read-history queue. */
export class LineFramer {
  constructor(onLine, onError) {
    this.onLine = onLine; this.onError = onError;
    this.bytes = new Uint8Array(LIMITS.incoming + 1);
    this.reset();
  }
  reset() { this.size = 0; this.dropping = false; this.invalid = false; }
  push(chunk) {
    if (!(chunk instanceof Uint8Array)) throw new TypeError('Serial reads must contain bytes');
    for (const byte of chunk) {
      if (byte === 10) {
        let size = this.size;
        if (size && this.bytes[size - 1] === 13) size--;
        const tooLong = this.dropping || size > LIMITS.incoming;
        let invalid = this.invalid;
        for (let i = 0; i < size; i++) if (this.bytes[i] === 13) invalid = true;
        const line = !tooLong && !invalid && size ? String.fromCharCode(...this.bytes.subarray(0, size)) : null;
        this.reset(); // A callback may establish another session boundary.
        if (tooLong) {
          // Overflow was already reported on entering discard mode.
        } else if (invalid) this.onError(error('protocol', 'Invalid ASCII serial line'));
        else if (line !== null) this.onLine(line);
        continue;
      }
      if (this.dropping) continue;
      if (byte !== 13 && (byte < 32 || byte > 126)) this.invalid = true;
      if (this.size === this.bytes.length) {
        this.dropping = true;
        this.onError(error('protocol', 'Incoming line exceeds 1024 bytes', { protocolCode: 'LINE_TOO_LONG' }));
      } else {
        this.bytes[this.size++] = byte;
        if (this.size > LIMITS.incoming && byte !== 13) {
          this.dropping = true;
          this.onError(error('protocol', 'Incoming line exceeds 1024 bytes', { protocolCode: 'LINE_TOO_LONG' }));
        }
      }
    }
  }
}
