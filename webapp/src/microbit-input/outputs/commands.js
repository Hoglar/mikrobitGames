import { LIMITS } from '../protocol/constants.js';
import { asError, deferred, error } from '../errors.js';

/** FIFO: one reserved ID in flight, plus sixteen waiting owned payloads. */
export class CommandQueue {
  constructor({ writer, clock, ready, report, recover, initialId = 1 }) {
    Object.assign(this, { writer, clock, ready, report, recover });
    this.nextId = initialId; this.generation = 0; this.waiting = []; this.current = null;
  }
  submit(payload, owner, internal = false) {
    if (!this.ready(owner, internal)) return Promise.reject(error('connection', 'Input connection is not ready'));
    if (this.current && this.waiting.length >= LIMITS.waiting) return Promise.reject(error('queue-full', 'Sixteen output calls are already waiting'));
    const call = { payload, owner, internal, public: deferred(), drained: deferred(), publicDone: false, result: null, written: false, timer: null };
    this.waiting.push(call); this.pump();
    return call.public.promise;
  }
  settle(call, failure) {
    if (call.publicDone) return;
    call.publicDone = true;
    if (failure) call.public.reject(failure); else call.public.resolve();
  }
  pump() {
    if (this.current || !this.waiting.length) return;
    if (this.nextId > LIMITS.maxId) { this.recover(error('command', 'Command IDs exhausted; starting a fresh session')); return; }
    const call = this.waiting.shift(); this.current = call;
    const generation = this.generation;
    const valid = () => this.current === call && this.generation === generation;
    this.writer.line(() => { call.id = this.nextId++; return `C|1|${call.id}|${call.payload}`; }, valid, () => { call.started = true; }).then(() => {
      if (!valid()) return;
      call.written = true;
      if (call.result) this.finish(call);
      else {
        call.completedAt = this.clock.now();
        const tick = () => {
          if (!valid() || call.result) return;
          const remaining = LIMITS.resultMs - (this.clock.now() - call.completedAt);
          if (remaining > 0) call.timer = this.clock.setTimeout(tick, remaining);
          else this.recover(error('timeout', 'Command result timed out; execution is unknown', { commandId: call.id }));
        };
        call.timer = this.clock.setTimeout(tick, LIMITS.resultMs);
      }
    }, cause => { if (valid()) this.recover(asError(cause)); });
  }
  handle(result) {
    const call = this.current;
    if (!call || result.id !== call.id || call.result) {
      this.report(error('protocol', 'Unknown, late or duplicate command result', { commandId: result.id })); return;
    }
    call.result = result; this.clock.clearTimeout(call.timer);
    const failure = result.ok ? null : error(result.known ? 'command' : 'protocol',
      `Device rejected command: ${result.protocolCode}`, { commandId: call.id, protocolCode: result.protocolCode });
    this.settle(call, failure);
    if (failure) this.report(failure);
    if (call.written) this.finish(call);
  }
  finish(call) {
    if (this.current !== call) return;
    this.clock.clearTimeout(call.timer); this.current = null; call.drained.resolve(); this.pump();
  }
  cancelOwner(owner) {
    const failure = error('disposed', 'Game session was disposed');
    this.waiting = this.waiting.filter(call => {
      if (call.owner !== owner) return true;
      this.settle(call, failure); call.drained.resolve(); return false;
    });
    if (this.current?.owner === owner) {
      const call = this.current; this.settle(call, failure);
      if (!call.started) { this.current = null; call.drained.resolve(); }
      return call.drained.promise;
    }
    return Promise.resolve();
  }
  invalidate(failure) {
    this.generation++;
    const old = [...this.waiting, ...(this.current ? [this.current] : [])];
    this.waiting = []; this.current = null;
    for (const call of old) { this.clock.clearTimeout(call.timer); this.settle(call, failure); call.drained.resolve(); }
  }
  reset() { this.nextId = 1; }
}
