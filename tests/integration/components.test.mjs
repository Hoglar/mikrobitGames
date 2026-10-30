import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LineFramer } from '../../webapp/src/microbit-input/protocol/line-framer.js';
import { encodeAction, parseObject, parseResult, validateDeviceInfo, validateSnapshot } from '../../webapp/src/microbit-input/protocol/messages.js';
import { InputState } from '../../webapp/src/microbit-input/inputs/state.js';
import { games } from '../../webapp/src/games/registry.js';
import { createAttempt, finishAttempt, resultRequest } from '../../webapp/src/platform/rules.js';

const simulator = process.env.FIRMWARE_SIMULATOR;
const corpus = JSON.parse(readFileSync(new URL('../../spec/contracts/microbit-webapp/fixtures/conformance.json', import.meta.url)));
function firmware(args = [], input) {
  assert.ok(simulator, 'FIRMWARE_SIMULATOR must point to the compiled production core');
  return execFileSync(simulator, args, { input, encoding: 'utf8', timeout: 10000 });
}

test('SYS: firmware metadata and snapshot bytes become webapp state and counted input', () => {
  const info = validateDeviceInfo(parseObject(firmware(['--info']).trim()));
  assert.equal(info.board, 'microbit-v2');
  const state = new InputState(), received = [];
  const framer = new LineFramer(line => received.push(state.accept(validateSnapshot(parseObject(line)))), error => { throw error; });
  const keys = 'n u a b ac bc x y z t l m q qc'.split(' ');
  for (const patch of [{ n: 1, u: 20, ac: 0 }, { n: 2, u: 40, ac: 3, x: 525, a: 1 }]) {
    const snapshot = { ...corpus.snapshots.v2, ...patch };
    const wire = Buffer.from(firmware(['--snapshot', ...keys.map(k => String(snapshot[k]))]));
    // Serial transport may split at any byte, including JSON tokens.
    for (const byte of wire) framer.push(Uint8Array.of(byte));
  }
  assert.equal(received.length, 2);
  assert.deepEqual(received[1].presses, [{ input: 'a', count: 3 }]);
  assert.equal(received[1].state.buttons.aPressed, true);
  assert.ok(Math.abs(received[1].state.tilt.x - .5) < 1e-12);
});

test('SYS: webapp output encoders execute in firmware and acknowledgements parse back', () => {
  const caps = validateDeviceInfo(parseObject(firmware(['--info']).trim())).capabilities;
  const actions = [['display.showText', 'READY'], ['display.showImage', Array(25).fill(9)],
    ['display.clear'], ['speaker.playTone', { frequencyHz: 440, durationMs: 250 }],
    ['speaker.playMelody', { notes: [{ frequencyHz: 440, durationMs: 200 }] }],
    ['speaker.playBuiltInSound', 'happy'], ['speaker.stop']];
  for (const [index, [name, arg]] of actions.entries()) {
    const id = index + 1, line = `C|1|${id}|${encodeAction(name, arg, caps)}`;
    const response = firmware([], `HELLO|1\r\n${line}\r\n`).trim().split('\n');
    assert.equal(response.at(-1), `R|1|${id}|OK`);
    assert.equal(parseResult(response.at(-1)).id, id);
  }
  assert.match(firmware([], 'HELLO|1\nC|1|1|S|TONE|1|250|128\n'), /R\|1\|1\|ERR\|/);
});

test('SYS: every registered game has matching frontend/backend result boundaries', () => {
  const cases = [], actual = [];
  for (const game of games) for (const status of ['completed', 'incomplete', 'invalid']) {
    for (const value of [null, -1, 0, game.max_value, game.max_value + 1, 1.5, '1', true]) {
      cases.push({ status, value, min: game.min_value, max: game.max_value });
      try {
        const attempt = finishAttempt(createAttempt({ playerId: 'owner', game, attemptId: 'id' }), status, value);
        const request = resultRequest(attempt, 'owner');
        assert.deepEqual(JSON.parse(request.body), { attempt_id: 'id', status, value });
        actual.push(true);
      } catch (error) {
        if (!(error instanceof TypeError || error instanceof RangeError)) throw error;
        actual.push(false);
      }
    }
  }
  const expected = JSON.parse(execFileSync(process.env.EVALUATION_PYTHON ?? 'python3',
    [fileURLToPath(new URL('./score-oracle.py', import.meta.url))],
    { input: JSON.stringify(cases), encoding: 'utf8', timeout: 10000 }));
  assert.equal(actual.length, games.length * 24);
  cases.forEach((item, index) => assert.equal(actual[index], expected[index], JSON.stringify(item)));
});
