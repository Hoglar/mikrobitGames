import { LIMITS } from '../protocol/constants.js';
import { asError, error, within } from '../errors.js';

/** Sole writer. Pacing and partial-line ownership survive command/session barriers. */
export class PacedWriter {
  constructor(transport, clock) {
    this.transport = transport; this.clock = clock; this.tail = Promise.resolve();
    this.nextStart = 0; this.partial = false;
  }
  enqueue(work) {
    const result = this.tail.then(work);
    this.tail = result.catch(() => {});
    return result;
  }
  async wait(valid) {
    while (this.clock.now() < this.nextStart)
      await new Promise(resolve => this.clock.setTimeout(resolve, this.nextStart - this.clock.now()));
    if (!valid()) throw error('disposed', 'Serial operation belongs to an expired session');
  }
  async bytes(text, valid, onStart, alreadyWaited = false) {
    const bytes = Uint8Array.from(text, c => c.charCodeAt(0));
    for (let i = 0; i < bytes.length; i += LIMITS.chunk) {
      if (i || !alreadyWaited) await this.wait(valid);
      if (!valid()) throw error('disposed', 'Serial operation belongs to an expired session');
      this.nextStart = this.clock.now() + LIMITS.pacingMs;
      if (i === 0) onStart?.();
      this.partial = true;
      try { await within(this.transport.write(bytes.slice(i, i + LIMITS.chunk)), this.clock, LIMITS.operationMs, 'Serial write'); }
      catch (cause) { throw asError(cause); }
    }
    if (text.endsWith('\n')) this.partial = false;
  }
  line(line, valid, onStart) {
    return this.enqueue(async () => {
      await this.wait(valid);
      // Construct a command ID only at the actual first-chunk write boundary.
      const payload = typeof line === 'function' ? line() : line;
      if (payload.length > LIMITS.outgoing || /[^\x20-\x7e]/.test(payload)) throw error('validation', 'Invalid command wire payload');
      return this.bytes(payload + '\n', valid, onStart, true);
    });
  }
  hello(valid, onStart) {
    return this.enqueue(async () => {
      if (this.partial) await this.bytes('\n', valid);
      await this.bytes('HELLO|1\n', valid, onStart);
    });
  }
}
