import test from 'node:test';
import assert from 'node:assert/strict';
import * as rules from '../../src/platform/rules.js';
const game = { id: 'game-id', is_active: true, min_value: 10, max_value: 1000 };
const ready = { connection: 'connected', inputAvailable: true };
const start = { player: { id: 'owner' }, game, moduleRegistered: true, input: ready, renewed: true };
const attempt = (attemptId = 'attempt-id') => rules.createAttempt({ playerId: 'owner', game, attemptId });
test('TWEB-01/10: offentlige og beskyttede ruter', () => {
  for (const route of ['launcher', 'testlab', 'login', 'register']) assert.equal(rules.requiresSession(route), false);
  for (const route of ['game', 'dashboard', 'profile', 'ai', 'unknown']) assert.equal(rules.requiresSession(route), true);
});
test('TWEB-02: samtlige startkrav må være oppfylt', () => {
  assert.equal(rules.canStartGame(start), true);
  for (const change of [{ player: null }, { game: { ...game, is_active: false } }, { moduleRegistered: false },
    { input: null }, { renewed: false }, { input: { ...ready, inputAvailable: false } },
    { input: { ...ready, connection: 'connecting' } }]) assert.equal(rules.canStartGame({ ...start, ...change }), false);
});
test('TWEB-02: fornyelse ved fem minutter krever aktivt spill og input i synlig fane', () => {
  const opts = { active: true, visible: true, hasUserInput: true, elapsedMs: 300000 };
  assert.equal(rules.shouldRenew(opts), true);
  for (const change of [{ elapsedMs: 299999 }, { active: false }, { visible: false }, { hasUserInput: false }])
    assert.equal(rules.shouldRenew({ ...opts, ...change }), false);
});
test('TWEB-03: pause ved brudd og eksplisitt fortsett etter gjenoppkobling', () => {
  assert.equal(rules.afterInputChange('playing', null), 'paused');
  assert.equal(rules.afterInputChange('paused', ready), 'paused');
  assert.equal(rules.resumeGame('paused', ready, false), 'paused');
  assert.equal(rules.resumeGame('paused', null, true), 'paused');
  assert.equal(rules.resumeGame('paused', ready, true), 'playing');
  assert.equal(rules.resumeGame('finished', ready, true), 'finished');
});
test('TWEB-03: delverdier bruker ikke sluttverdigrenser', () => {
  for (const value of [null, 0, 1, 1001, Number.MAX_SAFE_INTEGER])
    assert.equal(rules.finishAttempt(attempt(), 'incomplete', value).value, value);
  for (const value of [undefined, -1, 0.1, true, '10', Infinity, NaN, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => rules.finishAttempt(attempt(), 'incomplete', value));
});
test('TWEB-04: sluttverdier er sikre heltall innen spillets grenser', () => {
  for (const value of [10, 1000]) assert.equal(rules.finishAttempt(attempt(), 'completed', value).value, value);
  for (const value of [null, 9, 1001, true, '10', 10.5, NaN, Infinity])
    assert.throws(() => rules.finishAttempt(attempt(), 'completed', value));
  assert.throws(() => rules.finishAttempt(attempt(), 'aborted', 10));
});
test('TWEB-05/06: retry beholder eier, ID og eksakt body; annen konto sperres', () => {
  const done = rules.finishAttempt(attempt(), 'incomplete', null);
  const request = rules.resultRequest(done, 'owner');
  assert.deepEqual(rules.resultRequest(done, 'owner'), request);
  assert.deepEqual(JSON.parse(request.body), { attempt_id: done.attemptId, status: 'incomplete', value: null });
  assert.equal(request.url, '/api/v1/games/game-id/results');
  assert.equal(request.credentials, 'same-origin');
  assert.deepEqual(request.headers, { 'Content-Type': 'application/json', 'X-MBG-Request': '1' });
  assert.throws(() => rules.resultRequest(done, 'other'), /SAME_PLAYER_REQUIRED/);
  assert.throws(() => rules.resultRequest(attempt(), 'owner'), /NOT_FINISHED/);
  assert.throws(() => { done.value = 200; }, TypeError);
});
test('TWEB-05: ulike forsøk med lik verdi har ulike ID-er', () => {
  const first = rules.finishAttempt(attempt('first'), 'completed', 100);
  const second = rules.finishAttempt(attempt('second'), 'completed', 100);
  assert.notEqual(rules.resultRequest(first, 'owner').body, rules.resultRequest(second, 'owner').body);
});
test('TWEB-04/05/06: bare 200/201 bekrefter lagring, konflikt beholder data', () => {
  for (const code of [200, 201]) assert.equal(rules.submissionState(code), 'saved');
  assert.equal(rules.submissionState(409, 'ATTEMPT_CONFLICT'), 'conflict');
  assert.equal(rules.submissionState(401, 'AUTH_REQUIRED'), 'login-required');
  for (const code of [0, 204, 400, 500, 503]) assert.equal(rules.submissionState(code, 'OUTCOME_UNKNOWN'), 'unconfirmed');
});
test('TWEB-09: AI har trimmet spørsmål, kodepunktgrenser og ingen historikk', () => {
  assert.deepEqual(rules.questionBody(' Hei '), { question: 'Hei' });
  assert.deepEqual(rules.questionBody('Hei', game.id), { question: 'Hei', game_id: game.id });
  assert.equal([...rules.questionBody('😀'.repeat(1000)).question].length, 1000);
  for (const text of ['', ' \n ', '😀'.repeat(1001), null]) assert.throws(() => rules.questionBody(text));
});
