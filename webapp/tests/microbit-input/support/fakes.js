import { readFileSync } from 'node:fs';
import { createAdapter } from '../../../src/microbit-input/adapter.js';
import { deferred } from '../../../src/microbit-input/errors.js';

export const corpus = JSON.parse(readFileSync(new URL('../../../../spec/contracts/microbit-webapp/fixtures/conformance.json', import.meta.url), 'utf8'));
export const bytes = text => Uint8Array.from(text, c => c.charCodeAt(0));
export const flush = async (count = 40) => { for (let i = 0; i < count; i++) await Promise.resolve(); };

export class FakeClock {
  constructor() { this.time = 0; this.id = 0; this.jobs = new Map(); }
  now = () => this.time;
  setTimeout = (fn, ms) => { const id = ++this.id; this.jobs.set(id, { at: this.time + Math.max(0, ms), fn }); return id; };
  clearTimeout = id => this.jobs.delete(id);
  async tick(ms) {
    await flush(); const end = this.time + ms;
    for (let count = 0; count < 100000; count++) {
      const first = [...this.jobs].filter(([, j]) => j.at <= end).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!first) { this.time = end; await flush(); if (![...this.jobs.values()].some(j => j.at <= end)) return; }
      else { this.time = first[1].at; this.jobs.delete(first[0]); first[1].fn(); await flush(); }
    }
    throw new Error('Fake clock did not settle');
  }
  // Simulate a blocked/backgrounded browser before overdue timer callbacks run.
  jump(ms) { this.time += ms; }
}

export class FakeTransport {
  constructor(clock, options = {}) {
    this.clock = clock; this.options = options; this.buffer = []; this.pending = null;
    this.writes = []; this.commands = []; this.wire = ''; this.removers = new Set();
    this.n = 0; this.u = 0; this.ac = 0; this.bc = 0; this.qc = 0;
    this.helloCount = 0; this.closed = false; this.closeCalls = 0;
    this.autoAck = options.autoAck !== false; this.connected = true;
  }
  async open() { await this.options.open?.promise; this.opened = true; }
  read() {
    if (this.buffer.length) {
      const value = this.buffer.shift();
      return value instanceof Error ? Promise.reject(value) : Promise.resolve({ value, done: false });
    }
    if (this.closed) return Promise.resolve({ done: true });
    this.pending = deferred(); return this.pending.promise;
  }
  push(value) {
    if (this.closed) return;
    const data = typeof value === 'string' ? bytes(value) : value;
    if (this.pending) { const pending = this.pending; this.pending = null;
      if (data instanceof Error) pending.reject(data); else pending.resolve({ value: data, done: false });
    } else this.buffer.push(data);
  }
  object(value) { this.push(JSON.stringify(value) + '\n'); }
  sample(set = {}) {
    const s = { ...corpus.snapshots.v2, n: this.n, u: this.u, ac: this.ac, bc: this.bc, qc: this.qc, ...set };
    this.n = (s.n + 1) % 4294967296; this.u = (s.u + 20) % 4294967296;
    this.ac = s.ac; this.bc = s.bc; this.qc = s.qc;
    this.object(s); return s;
  }
  async write(data) {
    const index = this.writes.length;
    this.writes.push({ time: this.clock.now(), bytes: data.slice() });
    if (this.failWrite?.(index)) throw new Error('Injected partial-write failure');
    for (const byte of data) {
      if (byte === 10) { const line = this.wire; this.wire = ''; this.receive(line); }
      else this.wire += String.fromCharCode(byte);
    }
    if (this.holdWrite?.(data)) await this.holdWriteDeferred.promise;
  }
  receive(line) {
    if (line === 'HELLO|1') {
      this.helloCount++;
      if (this.options.silent) return;
      this.options.beforeInfo?.(this);
      this.object(this.options.info ?? corpus.deviceInfo.v2);
      if (!this.options.infoOnly) this.sample();
      if (this.options.autoSnapshots && !this.sampleTimer) this.scheduleSample();
    } else if (line.startsWith('C|')) {
      this.commands.push(line);
      if (this.autoAck) this.push(`R|1|${line.split('|')[2]}|${this.result ?? 'OK'}\n`);
    } else if (line && this.options.errorsOnRepair) this.push('ERR|MALFORMED_COMMAND\n');
  }
  scheduleSample() {
    this.sampleTimer = this.clock.setTimeout(() => {
      this.sampleTimer = null;
      if (!this.closed && !this.options.silent) { this.sample(); this.scheduleSample(); }
    }, 20);
  }
  onDisconnect(fn) { this.removers.add(fn); return () => this.removers.delete(fn); }
  remove() { this.connected = false; for (const fn of [...this.removers]) fn(); }
  async replaceReader() { this.replacements = (this.replacements ?? 0) + 1; return this.options.replaceReader !== false; }
  async close() {
    this.closeCalls++;
    await this.options.close?.promise;
    this.closed = true; this.clock.clearTimeout(this.sampleTimer); this.sampleTimer = null;
    this.pending?.resolve({ done: true }); this.pending = null;
  }
}

export function harness(options = {}) {
  const clock = new FakeClock(), errors = [], diagnostics = [], transports = [];
  const port = {}, serial = new EventTarget();
  serial.calls = 0;
  serial.requestPort = () => { serial.calls++; return options.choice?.promise ?? Promise.resolve(port); };
  const adapter = createAdapter({ clock, serial: () => serial, secureContext: () => true,
    transportFactory: () => { const t = new FakeTransport(clock, options); transports.push(t); return t; },
    diagnostic: (name, value) => diagnostics.push({ name, value }) });
  adapter.onError(e => errors.push(e));
  return { adapter, clock, serial, errors, diagnostics, transports,
    get transport() { return transports.at(-1); },
    async start() { const connected = adapter.connect(); await clock.tick(0); await connected; return adapter; },
    async stop() { const done = adapter.disconnect(); await clock.tick(100); await done; } };
}
