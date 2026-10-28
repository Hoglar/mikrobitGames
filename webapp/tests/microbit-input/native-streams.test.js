import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdapter } from '../../src/microbit-input/adapter.js';
import { deferred } from '../../src/microbit-input/errors.js';
import { bytes, corpus, FakeClock, flush } from './support/fakes.js';

function nativeHarness() {
  const clock = new FakeClock(), serial = new EventTarget(), ports = [];
  class Port extends EventTarget {
    constructor() { super(); this.records = []; this.closeCalls = 0; this.n = 0; this.u = 0; }
    async open(settings) {
      this.settings = settings; await this.openWait?.promise;
      this.readable = new ReadableStream({ start: c => { this.controller = c; }, cancel: () => { this.canceled = true; } });
      let pending = '';
      this.writable = new WritableStream({ write: async data => {
        this.records.push(String.fromCharCode(...data));
        pending += String.fromCharCode(...data);
        if (pending.includes('\n')) {
          const line = pending.slice(0, pending.indexOf('\n')); pending = '';
          if (line === 'HELLO|1') { this.object(corpus.deviceInfo.v2); this.sample(); }
          else if (!this.writeWait) this.send(`R|1|${line.split('|')[2]}|OK\n`);
        }
        if (this.writeWait) await this.writeWait.promise;
      } });
    }
    send(text) { if (!this.canceled) this.controller.enqueue(bytes(text)); }
    object(v) { this.send(JSON.stringify(v) + '\n'); }
    sample() { this.object({ ...corpus.snapshots.v2, n: this.n++, u: this.u }); this.u += 20; }
    async close() {
      this.closeCalls++;
      assert.equal(this.readable.locked, false); assert.equal(this.writable.locked, false);
      this.readable = null; this.writable = null;
    }
  }
  const port = new Port(); ports.push(port);
  serial.requestPort = () => Promise.resolve(ports.at(-1));
  const adapter = createAdapter({ clock, serial: () => serial, secureContext: () => true });
  return { clock, adapter, port, ports, Port };
}

test('GI-20 native Streams cancellation releases the reader/writer before port.close', async () => {
  const h = nativeHarness(); const connecting = h.adapter.connect(); await h.clock.tick(0); await connecting;
  assert.equal(h.port.settings.baudRate, 115200); assert.equal(h.port.readable.locked, true); assert.equal(h.port.writable.locked, true);
  const close = h.adapter.disconnect(); await h.clock.tick(100); await close;
  assert.equal(h.port.canceled, true); assert.equal(h.port.closeCalls, 1); assert.equal(h.clock.jobs.size, 0);
});

test('GI-20 native open completion after cancellation still closes its own late-acquired writer', async () => {
  const h = nativeHarness(); h.port.openWait = deferred();
  const canceled = assert.rejects(h.adapter.connect(), { kind: 'connection' }); await h.clock.tick(0);
  const ending = assert.rejects(h.adapter.disconnect(), { kind: 'timeout' }); await h.clock.tick(3000); await ending; await canceled;
  await assert.rejects(h.adapter.connect(), { kind: 'connection' });
  h.port.openWait.resolve(); await flush(100); assert.equal(h.port.closeCalls, 1); assert.equal(h.port.records.length, 0);
  const replacement = new h.Port(); h.ports.push(replacement);
  const connected = h.adapter.connect(); await h.clock.tick(0); await connected;
  assert.equal(replacement.closeCalls, 0); assert.equal(h.adapter.getState().inputAvailable, true);
  const closed = h.adapter.disconnect(); await h.clock.tick(100); await closed;
});

test('GI-13/20 native hung write has bounded caller failure and retains locks until abort/drain completes', async () => {
  const h = nativeHarness(); const connected = h.adapter.connect(); await h.clock.tick(0); await connected;
  const game = h.adapter.createGameSession(); h.port.writeWait = deferred();
  let sampleTimer;
  const sample = () => { if (!h.port.canceled) { h.port.sample(); sampleTimer = h.clock.setTimeout(sample, 20); } };
  sampleTimer = h.clock.setTimeout(sample, 20);
  const output = assert.rejects(game.outputs.display.clear(), { kind: 'timeout' });
  await h.clock.tick(3010); await output; assert.equal(h.adapter.getState().connection, 'disconnected');
  assert.equal(h.port.writable.locked, true); assert.equal(h.port.closeCalls, 0);
  await assert.rejects(h.adapter.connect(), { kind: 'connection' });
  h.port.writeWait.resolve(); await flush(100);
  assert.equal(h.port.closeCalls, 1); h.clock.clearTimeout(sampleTimer); await game.dispose();
  assert.equal(h.clock.jobs.size, 0);
});
