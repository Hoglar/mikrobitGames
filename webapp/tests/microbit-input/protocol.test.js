import test from 'node:test';
import assert from 'node:assert/strict';
import { LineFramer } from '../../src/microbit-input/protocol/line-framer.js';
import { encodeAction, parseObject, parseResult, validateDeviceInfo, validateSnapshot } from '../../src/microbit-input/protocol/messages.js';
import { InputState } from '../../src/microbit-input/inputs/state.js';
import { ShakeDetector, soundLabel, strength, tilt } from '../../src/microbit-input/inputs/derived.js';
import { corpus, bytes } from './support/fakes.js';

test('GI-02/03 every fixture at every split, LF/CRLF, overflow, invalid bytes and recovery', () => {
  const lines = [JSON.stringify(corpus.deviceInfo.v2), ...corpus.snapshotCases.map(c => JSON.stringify({ ...corpus.snapshots[c.base], ...c.set })), ...corpus.resultCases.map(c => c.line)];
  for (const line of lines) for (const ending of ['\n', '\r\n']) {
    const wire = bytes(line + ending);
    for (let split = 0; split <= wire.length; split++) {
      const found = [], failures = []; const f = new LineFramer(s => found.push(s), e => failures.push(e));
      f.push(wire.slice(0, split)); f.push(wire.slice(split));
      assert.deepEqual(found, [line]); assert.equal(failures.length, 0);
    }
  }
  const found = [], failures = [], f = new LineFramer(s => found.push(s), e => failures.push(e));
  f.push(bytes('A'.repeat(1024) + '\r\n')); assert.equal(found[0].length, 1024);
  f.push(bytes('A'.repeat(100000))); assert.equal(f.size, 1025); assert.equal(failures.length, 1);
  f.push(bytes('\nOK\nA\rB\nA\0B\n\n\r\n')); assert.equal(failures.length, 3); assert.equal(found.at(-1), 'OK');
  f.push(bytes('partial')); f.reset(); f.push(bytes('fresh\n')); assert.equal(found.at(-1), 'fresh');
});

test('GI-03 duplicate decoded keys rejected at every nesting level; unknown keys never pollute objects', () => {
  for (const line of ['{"n":1,"n":2}', '{"a":{"v":1,"v":2}}', '{"a":1,"\\u0061":2}', '{"x":[{"a":0,"\\u0061":1}]}', '[]', 'null', '{"a":Infinity}', '{"a":1}\t'])
    assert.throws(() => parseObject(line), { kind: 'protocol' }, line);
  assert.deepEqual(parseObject('{"a":[{"x":1},{"x":2}],"quote":"\\\"hi\\\"","back":"\\\\"}').a, [{ x: 1 }, { x: 2 }]);
  const raw = JSON.stringify(corpus.snapshots.v2).slice(0, -1) + ',"__proto__":{"polluted":true}}';
  assert.equal(validateSnapshot(parseObject(raw)).polluted, undefined); assert.equal({}.polluted, undefined);
});

test('GI-01/05/06/14 all shared metadata and snapshot validation cases', () => {
  for (const c of corpus.deviceInfoCases) {
    const value = structuredClone(corpus.deviceInfo[c.base]); Object.assign(value, c.set);
    for (const key of c.omit ?? []) delete value[key];
    if (c.accepted) assert.equal(validateDeviceInfo(value).board, 'microbit-v2');
    else assert.throws(() => validateDeviceInfo(value), c.errorKind ? { kind: c.errorKind } : undefined, c.id);
  }
  const info = structuredClone(corpus.deviceInfo.v2);
  info.capabilities.sensors.push('future'); info.capabilities.outputs.speaker.push('future');
  assert.equal(validateDeviceInfo(info).capabilities.sensors.includes('future'), false);
  info.capabilities.sensors.push('buttons'); assert.throws(() => validateDeviceInfo(info));
  for (const names of [Array(17).fill('hello'), ['hello', 'hello'], ['Bad'], [true], ['a'.repeat(25)]]) {
    const v = structuredClone(corpus.deviceInfo.v2); v.capabilities.outputs.builtInSounds = names;
    assert.throws(() => validateDeviceInfo(v));
  }
  for (const c of corpus.snapshotCases) {
    const value = { ...corpus.snapshots[c.base], ...c.set }; for (const k of c.omit ?? []) delete value[k];
    if (c.accepted) assert.equal(validateSnapshot(value).n, value.n); else assert.throws(() => validateSnapshot(value), undefined, c.id);
  }
  const inherited = Object.create(corpus.snapshots.v2); assert.throws(() => validateSnapshot(inherited));
});

test('GI-04/08 shared wrap/gap/counted-press sequences commit atomically', () => {
  for (const c of corpus.sequenceCases) {
    const input = new InputState(), presses = [], gaps = [];
    c.samples.forEach((set, index) => {
      const result = input.accept(validateSnapshot({ ...corpus.snapshots.v2, ...set }));
      for (const p of result.presses) presses.push({ index, ...p });
      if (result.gaps) gaps.push({ index, count: result.gaps });
    });
    assert.deepEqual(presses, c.expectedPresses); assert.deepEqual(gaps, c.expectedGaps);
  }
  const input = new InputState(); const base = corpus.snapshots.v2;
  input.accept(base);
  assert.equal(input.accept({ ...base, n: 0, u: 20, ac: 1 }).status, 'ignored');
  assert.equal(input.accept({ ...base, n: 1, u: 0 }).status, 'recover');
  assert.equal(input.accept({ ...base, n: 2, u: 40, ac: 4294967295 }).status, 'invalid');
  assert.deepEqual(input.accept({ ...base, n: 3, u: 60, ac: 2, bc: 1, qc: 1 }).presses,
    [{ input: 'a', count: 2 }, { input: 'b', count: 1 }, { input: 'logo', count: 1 }]);
});

test('GI-07/19 shared tilt/shake corpus, device-time batching, strength and sound hysteresis', () => {
  for (const c of corpus.tiltCases) assert.ok(Math.abs(tilt(c.axisMg) - c.expected) < 1e-12);
  assert.equal(strength(12, -34, -998), 999);
  for (const c of corpus.shakeCases) {
    const input = new InputState(), emitted = [];
    c.samples.forEach((set, i) => { if (input.accept({ ...corpus.snapshots.v2, ...set }).gesture) emitted.push(i); });
    assert.deepEqual(emitted, c.emissionIndices, c.id);
  }
  let label;
  assert.deepEqual([179, 180, 150, 121, 120, 150].map(v => label = soundLabel(v, label)), ['quiet', 'loud', 'loud', 'loud', 'quiet', 'quiet']);
  const shake = new ShakeDetector();
  const s = (n, x = 0) => ({ n, u: n * 20, x, y: 0, z: -1000 });
  [s(0), s(1, 1600), s(2)].forEach(v => shake.update(v)); assert.equal(shake.update(s(3, 1600)), true);
  // Time alone never re-arms: gaps first require a new continuous quiet run.
  assert.equal(shake.update(s(40, 1600)), false);
  for (let n = 41; n <= 50; n++) shake.update(s(n, 1600));
  assert.equal(shake.armed, true);
  assert.equal(shake.update(s(51)), false); assert.equal(shake.update(s(52, 1600)), false); assert.equal(shake.update(s(53)), true);
});

test('GI-11 every command action/default encodes golden firmware lines and owns its values', () => {
  const caps = validateDeviceInfo(corpus.deviceInfo.v2).capabilities;
  const actions = [
    ['display.showText', 'READY', 'D|TEXT|READY'],
    ['display.showImage', [...'0090009090900090909000900'].map(Number), 'D|IMAGE|0090009090900090909000900'],
    ['display.clear', undefined, 'D|CLEAR'],
    ['speaker.playTone', { frequencyHz: 440, durationMs: 250 }, 'S|TONE|440|250|128'],
    ['speaker.playMelody', { notes: [{ frequencyHz: 440, durationMs: 200 }, { frequencyHz: 0, durationMs: 100 }, { frequencyHz: 660, durationMs: 300 }] }, 'S|MELODY|128|440:200,0:100,660:300'],
    ['speaker.playBuiltInSound', 'happy', 'S|SOUND|happy'], ['speaker.stop', undefined, 'S|STOP']];
  actions.forEach(([name, arg, expected], index) => {
    assert.equal(encodeAction(name, arg, caps), expected);
    assert.equal(`C|1|${index + 1}|${expected}`, corpus.commandCases[index].line);
  });
  for (const [action, arg] of [['display.showText', ''], ['display.showText', 'A'.repeat(33)], ['display.showText', 'Hi@'],
    ['display.showImage', Array(25)], ['display.showImage', Array(25).fill(true)], ['display.showImage', Array(24).fill(0)],
    ['speaker.playTone', { frequencyHz: '440', durationMs: 20 }], ['speaker.playTone', { frequencyHz: 19, durationMs: 20 }],
    ['speaker.playTone', { frequencyHz: 0, durationMs: 0 }], ['speaker.playTone', { frequencyHz: 440, durationMs: 1, volume: 256 }],
    ['speaker.playMelody', { notes: [] }], ['speaker.playMelody', { notes: Array(17).fill({ frequencyHz: 440, durationMs: 1 }) }],
    ['speaker.playMelody', { notes: [{ frequencyHz: 440, durationMs: 6000 }, { frequencyHz: 660, durationMs: 6000 }] }]])
    assert.throws(() => encodeAction(action, arg, caps), { kind: 'validation' });
  assert.throws(() => encodeAction('speaker.playBuiltInSound', 'sad', caps), { kind: 'capability' });
  assert.equal(encodeAction('speaker.playTone', { frequencyHz: 9999, durationMs: 10000, volume: 255 }, caps), 'S|TONE|9999|10000|255');
  assert.equal(encodeAction('display.showText', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ012345', caps).length, 39);
});

test('GI-12 strict results retain unknown uppercase protocol errors for matching-call rejection', () => {
  for (const c of corpus.resultCases) {
    if (c.id === 'malformed') assert.throws(() => parseResult(c.line));
    else { const r = parseResult(c.line); assert.equal(r.id, c.id === 'late-id' ? 42 : c.pendingId); if (c.errorKind) assert.equal(r.known, false); }
  }
  for (const s of ['R|1|01|OK', 'R|2|1|OK', 'R|1|2147483648|OK', 'R|1|1|ERR|lowercase', 'R|1|0|OK']) assert.throws(() => parseResult(s));
});
