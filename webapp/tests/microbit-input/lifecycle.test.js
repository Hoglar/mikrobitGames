import test from 'node:test';
import assert from 'node:assert/strict';
import { corpus, flush, harness } from './support/fakes.js';
import { createAdapter } from '../../src/microbit-input/adapter.js';
import { deferred } from '../../src/microbit-input/errors.js';
import { LIMITS } from '../../src/microbit-input/protocol/constants.js';

test('GI-01/20 import is inert, unsupported contexts reject, connect is shared and waits for a snapshot', async () => {
  const { microbit } = await import('../../src/microbit-input/index.js');
  assert.equal(microbit.getState().connection, 'disconnected');
  await assert.rejects(microbit.connect(), { kind: 'connection' });
  const h = harness({ infoOnly: true }); const a = h.adapter;
  const first = a.connect(); assert.equal(a.connect(), first);
  await h.clock.tick(0); assert.equal(a.getState().inputAvailable, false); assert.equal(a.capabilities.sensors.length, 6);
  assert.throws(() => a.createGameSession(), { kind: 'connection' });
  h.transport.sample(); await flush(); await first;
  assert.equal(a.getState().inputAvailable, true); assert.equal(h.serial.calls, 1);
  await a.connect(); assert.equal(h.serial.calls, 1);
  assert.throws(() => a.capabilities.outputs.builtInSounds.push('evil'), TypeError);
  assert.throws(() => { a.getState().buttons.aPressed = true; }, TypeError);
  await h.stop(); assert.equal(h.clock.jobs.size, 0);
});

test('GI-16 info without a sample times out at exactly 3000 ms and closes', async () => {
  const h = harness({ infoOnly: true }); const connecting = h.adapter.connect();
  const failure = assert.rejects(connecting, { kind: 'timeout' });
  await h.clock.tick(2999); assert.equal(h.adapter.getState().connection, 'connecting');
  await h.clock.tick(1); await failure;
  assert.equal(h.adapter.getState().connection, 'disconnected'); assert.equal(h.transport.closeCalls, 1); assert.equal(h.clock.jobs.size, 0);
});

test('GI-14/16 unsupported board and duplicate-key metadata reject startup and release resources', async () => {
  for (const info of [{ ...corpus.deviceInfo.v2, board: 'microbit-v1' }, { ...corpus.deviceInfo.v2, snapshotIntervalMs: 40 }]) {
    const h = harness({ info }); const rejected = assert.rejects(h.adapter.connect()); await h.clock.tick(0); await rejected;
    assert.equal(h.adapter.capabilities, null); assert.equal(h.transport.closed, true);
  }
  const h = harness({ beforeInfo: t => t.push(JSON.stringify(corpus.deviceInfo.v2).slice(0, -1) + ',"board":"microbit-v2"}\n') });
  const rejected = assert.rejects(h.adapter.connect(), { kind: 'protocol' }); await h.clock.tick(0); await rejected;
  assert.equal(h.transport.closed, true);
});

test('GI-08/09 subscriptions are independent, immutable and state-before-A/B/logo events', async () => {
  const h = harness(); await h.start(); const game = h.adapter.createGameSession(); const log = [];
  let calls = 0; const cb = () => calls++;
  const off1 = game.inputs.subscribe(cb), off2 = game.inputs.subscribe(cb);
  game.inputs.subscribe(s => log.push(['state', s.buttons.aPressed]));
  game.inputs.onPress(e => log.push([e.input, e.count]));
  game.inputs.subscribe(() => { throw new Error('subscriber failure'); });
  h.transport.sample({ ac: 50, bc: 40, qc: 30 }); await flush(); assert.equal(log.length, 2);
  log.length = 0; off1();
  h.transport.sample({ ac: 52, bc: 41, qc: 33, a: 1 }); await flush();
  assert.deepEqual(log, [['state', true], ['a', 2], ['b', 1], ['logo', 3]]);
  assert.equal(calls, 5); assert.ok(h.errors.some(e => e.kind === 'callback'));
  off2(); await h.stop(); assert.equal(h.clock.jobs.size, 0);
});

test('GI-09/17 unsubscribing/disposal during notification fences remaining callbacks and events', async () => {
  const h = harness(); await h.start(); const g = h.adapter.createGameSession(); let dispose, later = 0, events = 0;
  g.inputs.subscribe(s => { if (s.buttons.aPressed) dispose = g.dispose(); });
  g.inputs.subscribe(() => later++); g.inputs.onPress(() => events++);
  h.transport.sample(); await flush(); const before = later;
  h.transport.sample({ a: 1, ac: 1 }); await h.clock.tick(100); await dispose;
  assert.equal(later, before); assert.equal(events, 0);
  assert.throws(() => g.inputs.subscribe(() => {}), { kind: 'disposed' });
  const next = h.adapter.createGameSession(); assert.equal(h.transport.closed, false);
  const done = next.dispose(); await h.clock.tick(100); await done; await h.stop();
});

test('GI-10 500 ms freshness ignores results/invalid/duplicate data and attempts one recovery', async () => {
  const h = harness(); await h.start(); const a = h.adapter, game = a.createGameSession(), states = [];
  game.inputs.subscribe(s => states.push(s));
  h.transport.sample({ a: 1, ac: 1 }); await flush();
  h.transport.options.silent = true;
  await h.clock.tick(499); assert.equal(a.getState().inputAvailable, true);
  h.transport.push('R|1|999|OK\nnot json\n'); h.transport.object({ ...corpus.snapshots.v2, n: 0, u: 0 }); await flush();
  await h.clock.tick(1);
  const state = a.getState(); assert.equal(state.connection, 'connecting'); assert.equal(state.buttons.aPressed, false);
  assert.equal(state.accelerometer, null); assert.equal(state.microphone, null); assert.equal(state.touch.logoPressed, null);
  assert.equal(a.capabilities.sensors.length, 6); assert.equal(h.transport.helloCount, 2);
  await assert.rejects(game.outputs.display.clear(), { kind: 'connection' });
  await h.clock.tick(2999); assert.equal(a.getState().connection, 'connecting');
  await h.clock.tick(1); assert.equal(a.getState().connection, 'disconnected'); assert.equal(a.capabilities, null);
  assert.equal(h.transport.helloCount, 2); assert.equal(states.at(-1).inputAvailable, false);
  await game.dispose(); assert.equal(h.clock.jobs.size, 0);
});

test('GI-10 background suspension neutralizes before delivering the next game callback', async () => {
  const h = harness(); await h.start(); const game = h.adapter.createGameSession(); const states = [], presses = [];
  game.inputs.subscribe(s => states.push(s)); game.inputs.onPress(p => presses.push(p));
  h.transport.sample({ ac: 1 }); await flush();
  h.clock.jump(600); h.transport.sample({ a: 1, ac: 10 }); await flush();
  assert.ok(states.some(s => s.connection === 'connecting' && !s.inputAvailable)); assert.equal(presses.length, 0);
  assert.equal(h.transport.helloCount, 2);
  h.transport.sample({ ac: 11 }); await flush(); assert.deepEqual(presses, [{ input: 'a', count: 1 }]);
  await h.stop();
});

test('GI-10 unexpected metadata, forward-time errors and uncorrelated errors establish fresh barriers', async () => {
  const h = harness(); await h.start();
  h.transport.object(corpus.deviceInfo.v2); await h.clock.tick(10); assert.equal(h.transport.helloCount, 2);
  const current = h.adapter.input.previous;
  h.transport.sample({ n: current.n + 1, u: current.u }); await h.clock.tick(10); assert.equal(h.transport.helloCount, 3);
  h.transport.push('ERR|MALFORMED_COMMAND\n'); await h.clock.tick(10); assert.equal(h.transport.helloCount, 4);
  await h.stop();
});

test('GI-11/13 FIFO, bounded waiting queue, owned mutable arguments and cross-command pacing', async () => {
  const h = harness({ autoAck: false, autoSnapshots: true }); await h.start(); const g = h.adapter.createGameSession();
  const pixels = Array(25).fill(9), melody = { notes: [{ frequencyHz: 440, durationMs: 200 }] };
  const calls = [g.outputs.display.clear(), g.outputs.display.showImage(pixels), g.outputs.speaker.playMelody(melody),
    ...Array.from({ length: 14 }, () => g.outputs.display.clear())];
  const settled = Promise.all(calls);
  pixels.fill(0); melody.notes[0].frequencyHz = 660;
  await assert.rejects(g.outputs.display.clear(), { kind: 'queue-full' });
  for (let id = 1; id <= 17; id++) { await h.clock.tick(20); h.transport.push(`R|1|${id}|OK\n`); await flush(); }
  await settled;
  assert.equal(h.transport.commands[1], 'C|1|2|D|IMAGE|' + '9'.repeat(25));
  assert.equal(h.transport.commands[2], 'C|1|3|S|MELODY|128|440:200');
  assert.equal(h.transport.commands.length, 17);
  h.transport.writes.forEach((w, i, all) => { assert.ok(w.bytes.length <= 16); if (i) assert.ok(w.time - all[i - 1].time >= 5); });
  h.transport.autoAck = true; await h.stop(); assert.equal(h.clock.jobs.size, 0);
});

test('GI-12 result fixtures settle only matching IDs, unknown codes reject as protocol errors', async () => {
  for (const c of corpus.resultCases) {
    const h = harness({ autoAck: false, autoSnapshots: true }); await h.start();
    h.adapter.context.commands.nextId = c.pendingId; // Internal seam; public API never sets IDs.
    const g = h.adapter.createGameSession(); const pending = g.outputs.display.clear();
    let outcome = 'pending'; const observed = pending.then(() => { outcome = 'resolve'; }, e => { outcome = 'reject'; return e; });
    await h.clock.tick(20); h.transport.push(c.line + '\n'); await flush();
    assert.equal(outcome, c.settlement, c.id);
    if (c.settlement === 'reject') { const e = await observed; if (c.protocolCode) assert.equal(e.protocolCode, c.protocolCode); if (c.errorKind) assert.equal(e.kind, c.errorKind); }
    if (c.settlement === 'pending') { await h.clock.tick(1000); assert.equal(outcome, 'reject'); }
    h.transport.autoAck = true; await h.stop();
  }
});

test('GI-12/13 acknowledgement before LF write resolves is retained without a spurious timer', async () => {
  const h = harness(); await h.start(); const g = h.adapter.createGameSession();
  h.transport.holdWriteDeferred = deferred(); h.transport.holdWrite = data => String.fromCharCode(...data).includes('CLEAR');
  const pending = g.outputs.display.clear(); await h.clock.tick(5); await pending;
  assert.ok(h.adapter.context.commands.current); assert.equal(h.adapter.context.commands.current.timer, null);
  h.transport.holdWrite = null; h.transport.holdWriteDeferred.resolve(); await flush();
  assert.equal(h.adapter.context.commands.current, null); await h.stop();
});

test('GI-13 command timeout never retries the action; recovery repairs a partial outbound line', async () => {
  const h = harness({ autoAck: false, autoSnapshots: true, errorsOnRepair: true }); await h.start();
  const g = h.adapter.createGameSession();
  const timed = assert.rejects(g.outputs.display.clear(), { kind: 'timeout' });
  await h.clock.tick(1010); await timed; assert.equal(h.transport.commands.length, 1); assert.equal(h.transport.helloCount, 2);
  h.transport.autoAck = true;
  let failed = false;
  h.transport.failWrite = index => { if (!failed && index === h.transport.writes.length - 1 && h.transport.wire.startsWith('C|')) { failed = true; return true; } return false; };
  const partial = assert.rejects(g.outputs.display.showText('ABCDEFGHIJKLMNOPQRSTUVWXYZ012345'));
  await h.clock.tick(50); await partial;
  assert.equal(h.transport.helloCount, 3);
  // Terminating a partial TEXT line can itself execute a shortened command;
  // execution is unknown, and the original full action must never be replayed.
  assert.equal(h.transport.commands.filter(s => s.includes('ABCDEFGHIJKLMNOPQRSTUVWXYZ012345')).length, 0);
  assert.equal(h.transport.commands.filter(s => s.endsWith('|D|CLEAR')).length, 1);
  assert.equal(h.adapter.getState().inputAvailable, true);
  h.transport.failWrite = null; await h.stop();
});

test('GI-12 ID exhaustion rejects old work and requires a handshake before fresh IDs', async () => {
  const h = harness(); await h.start(); const g = h.adapter.createGameSession();
  h.adapter.context.commands.nextId = LIMITS.maxId;
  const max = g.outputs.display.clear(); await h.clock.tick(20); await max;
  assert.ok(h.transport.commands[0].startsWith(`C|1|${LIMITS.maxId}|`));
  const exhausted = assert.rejects(g.outputs.display.clear(), { kind: 'command' }); await h.clock.tick(20); await exhausted;
  assert.equal(h.transport.helloCount, 2);
  const next = g.outputs.display.clear(); await h.clock.tick(20); await next;
  assert.equal(h.transport.commands.at(-1), 'C|1|1|D|CLEAR'); await h.stop();
});

test('GI-17 disposal rejects unsent work, drains a written ID, then STOP/CLEAR before switching', async () => {
  const h = harness({ autoAck: false }); await h.start(); const g = h.adapter.createGameSession();
  const p = g.outputs.speaker.playTone({ frequencyHz: 440, durationMs: 10000 }); const rejected = assert.rejects(p, { kind: 'disposed' });
  await h.clock.tick(20);
  const queued = assert.rejects(g.outputs.display.showText('OLD'), { kind: 'disposed' });
  const dispose = g.dispose(); assert.equal(g.dispose(), dispose);
  await rejected; await queued; assert.throws(() => h.adapter.createGameSession());
  await assert.rejects(g.outputs.display.clear(), { kind: 'disposed' });
  h.transport.autoAck = true; h.transport.push('R|1|1|OK\n'); await h.clock.tick(100); await dispose;
  assert.deepEqual(h.transport.commands.map(s => s.split('|').slice(3).join('|')), ['S|TONE|440|10000|128', 'S|STOP', 'D|CLEAR']);
  const next = h.adapter.createGameSession(), events = []; next.inputs.onPress(p => events.push(p));
  h.transport.sample({ ac: 20 }); await flush(); assert.equal(events.length, 0);
  h.transport.sample({ ac: 21 }); await flush(); assert.equal(events[0].count, 1);
  await h.stop();
});

test('GI-17 disposal before first write never sends the old command', async () => {
  const h = harness(); await h.start(); const g = h.adapter.createGameSession();
  const rejected = assert.rejects(g.outputs.display.showText('MUST NOT SEND'), { kind: 'disposed' });
  const done = g.dispose(); await h.clock.tick(100); await rejected; await done;
  assert.deepEqual(h.transport.commands.map(s => s.split('|')[4]), ['STOP', 'CLEAR']); await h.stop();
});

test('GI-17 cleanup rejection closes the connection and reports failure after releasing resources', async () => {
  const h = harness(); await h.start(); const g = h.adapter.createGameSession();
  h.transport.result = 'ERR|INTERNAL_ERROR'; const rejected = assert.rejects(g.dispose(), { protocolCode: 'INTERNAL_ERROR' });
  await h.clock.tick(20); await rejected;
  assert.equal(h.adapter.getState().connection, 'disconnected'); assert.equal(h.transport.closed, true);
});

test('GI-10/20 physical loss retains the logical facade; reconnect resets baselines', async () => {
  const h = harness(); await h.start(); const g = h.adapter.createGameSession(); const events = [], states = [];
  g.inputs.subscribe(s => states.push(s)); g.inputs.onPress(e => events.push(e));
  h.transport.sample({ ac: 10 }); await flush(); h.transport.sample({ ac: 11 }); await flush(); assert.equal(events.length, 1);
  h.transport.remove(); await flush(); assert.equal(h.adapter.getState().inputAvailable, false);
  await assert.rejects(g.outputs.display.clear(), { kind: 'connection' });
  const reconnected = h.adapter.connect(); await h.clock.tick(0); await reconnected;
  assert.equal(h.serial.calls, 2); assert.equal(events.length, 1); assert.equal(states.at(-1).inputAvailable, true);
  h.transport.sample({ ac: 1 }); await flush(); assert.equal(events.at(-1).count, 1);
  await h.stop();
});

test('GI-17 disposal while physically disconnected resolves locally without cleanup writes', async () => {
  const h = harness(); await h.start(); const g = h.adapter.createGameSession(); const transport = h.transport;
  transport.remove(); await flush(); const count = transport.writes.length; await g.dispose();
  assert.equal(transport.writes.length, count); await h.stop();
});

test('GI-20 recoverable read errors recreate the reader before another HELLO; unrecoverable errors close', async () => {
  for (const replaceReader of [true, false]) {
    const h = harness({ replaceReader }); await h.start();
    h.transport.push(new Error('recoverable read error')); await h.clock.tick(10);
    assert.equal(h.transport.replacements, 1);
    assert.equal(h.adapter.getState().connection, replaceReader ? 'connected' : 'disconnected');
    if (replaceReader) assert.equal(h.transport.helloCount, 2);
    await h.stop();
  }
});

test('GI-20 canceled chooser is fenced and no second chooser opens until the native one settles', async () => {
  const choice = deferred(), h = harness({ choice });
  const connect = assert.rejects(h.adapter.connect(), { kind: 'connection' });
  const disconnect = h.adapter.disconnect(); await h.clock.tick(0); await disconnect; await connect;
  await assert.rejects(h.adapter.connect(), { kind: 'connection' }); assert.equal(h.serial.calls, 1);
  choice.resolve({}); await flush(); assert.equal(h.transports.length, 0);
  assert.equal(h.adapter.getState().connection, 'disconnected');
});

test('GI-20 open/write/close watchdogs bound hung native operations without losing late cleanup', async () => {
  const open = deferred(), close = deferred(), h = harness({ open, close });
  const connecting = assert.rejects(h.adapter.connect(), { kind: 'connection' }); await h.clock.tick(0);
  const ending = assert.rejects(h.adapter.disconnect(), { kind: 'timeout' }); await h.clock.tick(3000); await ending; await connecting;
  await assert.rejects(h.adapter.connect(), { kind: 'connection' });
  open.resolve(); close.resolve(); await flush(); assert.equal(h.transport.closed, true);
  // A stalled write has unknown execution; its transport is closed rather than replayed.
  const w = harness({ autoAck: false }); await w.start(); const game = w.adapter.createGameSession();
  w.transport.options.autoSnapshots = true; w.transport.scheduleSample();
  w.transport.holdWriteDeferred = deferred(); w.transport.holdWrite = () => true;
  const stalled = assert.rejects(game.outputs.display.clear(), { kind: 'timeout' }); await w.clock.tick(3005); await stalled;
  assert.equal(w.adapter.getState().connection, 'disconnected'); assert.equal(w.transport.commands.length, 1);
  w.transport.holdWriteDeferred.resolve(); await flush(); await game.dispose();
});

test('GI-20 missing Web Serial/permission errors do not create resources', async () => {
  const adapter = createAdapter({ serial: () => null, secureContext: () => true });
  await assert.rejects(adapter.connect(), { kind: 'connection' }); assert.equal(adapter.getState().connection, 'disconnected');
  const choice = deferred(), h = harness({ choice }); const rejected = assert.rejects(h.adapter.connect(), { kind: 'connection' });
  choice.reject(new Error('Permission denied')); await flush(); await rejected; assert.equal(h.transports.length, 0);
});

test('GI-09/10 a blocking callback cannot deliver stale input to subsequent callbacks', async () => {
  const h = harness(); await h.start(); const g = h.adapter.createGameSession(), later = [], presses = [];
  g.inputs.subscribe(s => { if (s.buttons.aPressed) h.clock.jump(600); });
  g.inputs.subscribe(s => later.push(s)); g.inputs.onPress(e => presses.push(e));
  h.transport.sample(); await flush(); later.length = 0;
  h.transport.sample({ a: 1, ac: 1 }); await flush();
  assert.ok(later.some(s => !s.inputAvailable)); assert.equal(later.some(s => s.buttons.aPressed), false);
  // No stale held state or old-session press reaches the remaining subscribers.
  assert.equal(presses.length, 0); assert.equal(h.transport.helloCount, 2);
  await h.stop();
});

test('GI-20 removal during selected-port open rejects immediately without opening another chooser', async () => {
  const open = deferred(), h = harness({ open }); const rejected = assert.rejects(h.adapter.connect(), { kind: 'connection' });
  await h.clock.tick(0); h.transport.remove(); await flush(); await rejected;
  assert.equal(h.adapter.getState().connection, 'disconnected'); assert.equal(h.serial.calls, 1);
  open.resolve(); await flush();
});

test('GI-10/20 staleness during reconnect readiness cannot strand or resolve the wrong connect operation', async () => {
  const h = harness(); await h.start(); const game = h.adapter.createGameSession();
  let block = false, replacement, replacementResolved = false;
  game.inputs.subscribe(state => {
    if (block && state.inputAvailable) {
      block = false; h.transport.options.silent = true; h.clock.jump(600);
      assert.equal(h.adapter.getState().inputAvailable, false);
      replacement = h.adapter.connect().then(() => { replacementResolved = true; });
    }
  });
  h.transport.remove(); await flush(); block = true;
  const startup = assert.rejects(h.adapter.connect(), { kind: 'timeout' });
  await flush(); await startup;
  assert.ok(replacement); assert.equal(replacementResolved, false);
  assert.equal(h.adapter.getState().connection, 'connecting');
  h.transport.options.silent = false; h.transport.object(corpus.deviceInfo.v2); h.transport.sample();
  await flush(); await replacement;
  assert.equal(h.adapter.getState().inputAvailable, true); assert.equal(h.transport.helloCount, 2);
  await h.stop(); assert.equal(h.clock.jobs.size, 0);
});

test('GI-20 disconnect after a fatal loss reports outstanding hung resource cleanup', async () => {
  const close = deferred(), h = harness({ close }); await h.start(); h.transport.remove(); await flush();
  const ending = assert.rejects(h.adapter.disconnect(), { kind: 'timeout' }); await h.clock.tick(3000); await ending;
  assert.equal(h.adapter.getState().connection, 'disconnected');
  await assert.rejects(h.adapter.connect(), { kind: 'connection' });
  close.resolve(); await flush(); assert.equal(h.transport.closed, true); await h.adapter.disconnect();
});

test('GI-03/04/08/10/17 accelerated five-minute replay mixes wraps, bad frames, recovery and game switching', async () => {
  const h = harness({ beforeInfo: t => { if (t.helloCount === 1) { t.n = 4294967294; t.u = 4294967256; t.ac = 4294967245; } } });
  await h.start(); let game = h.adapter.createGameSession(), observed = 0, expected = 0, baseline = false;
  const watch = () => game.inputs.onPress(e => { if (e.input === 'a') observed += e.count; }); watch();
  for (let i = 0; i < 15000; i++) {
    if (i === 5000) {
      h.transport.options.silent = true; await h.clock.tick(500);
      h.transport.options.silent = false; h.transport.object(corpus.deviceInfo.v2); h.transport.sample({ n: 0, u: 0, ac: 0 });
      await flush(); baseline = true;
    }
    if (i === 10000) {
      const old = game, disposed = old.dispose(); await h.clock.tick(50); await disposed;
      game = h.adapter.createGameSession(); watch(); baseline = false;
    }
    if (i && i % 50 === 0) { h.transport.ac = (h.transport.ac + 1) % 4294967296; if (baseline) expected++; }
    if (i % 701 === 0) h.transport.push('{broken}\n');
    if (i === 7000) h.transport.push('X'.repeat(5000) + '\n');
    h.transport.sample(); await h.clock.tick(20); baseline = true;
    if (i % 1000 === 0) { const output = game.outputs.speaker.playTone({ frequencyHz: 440, durationMs: 20 }); await h.clock.tick(20); await output; }
  }
  assert.equal(observed, expected); assert.equal(h.transport.helloCount, 2);
  assert.equal(h.transport.buffer.length, 0); assert.ok(h.adapter.context.framer.size <= 1025);
  await h.stop(); assert.equal(h.clock.jobs.size, 0);
});
