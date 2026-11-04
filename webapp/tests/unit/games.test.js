import test from 'node:test';
import assert from 'node:assert/strict';
import { families, loadGame } from '../../src/games/registry.js';

test('the bundled legacy engines retain their playable interface after SDK migration', async () => {
  // Never execute newly installed cartridge code in Node. It belongs in the
  // browser sandbox; build-time validation only parses and bundles that code.
  const legacyKeys=new Set(['snake','viking','stars','reaction','balance','tetris','racing']);
  for (const family of families.filter(f=>legacyKeys.has(f.key))) {
    const create = await loadGame(family.key);
    const game = create({ seed: 'module-loading', config: {} });
    for (const method of ['tick', 'draw', 'press']) assert.equal(typeof game[method], 'function', `${family.key}.${method}`);
    assert.equal(game.ended, false);
    if(family.key==='racing')assert.equal(game.value,null);
    else assert.ok(Number.isSafeInteger(game.value));
    assert.equal(typeof game.label, 'string');
    game.tick(.01);
    game.dispose?.();
  }
  await assert.rejects(loadGame('missing-game'), RangeError);
});

test('extracted arcade modules retain round limits and completion semantics', async () => {
  const stars = (await loadGame('stars'))({ seed: 'round-limits' });
  stars.tick(60); assert.equal(stars.ended, true); assert.equal(stars.completed, true);
  const starScore = stars.value; stars.tick(60); assert.equal(stars.value, starScore);

  const balance = (await loadGame('balance'))();
  balance.tick(600); assert.equal(balance.ended, true); assert.equal(balance.completed, false);
  assert.equal(balance.value, 600000);

  const reaction = (await loadGame('reaction'))({ seed: 'round-limits' });
  for (let i = 0; i < 5; i++) { reaction.tick(3); reaction.tick(10); }
  assert.equal(reaction.ended, true); assert.equal(reaction.completed, true);
  assert.equal(reaction.value, 10000);
});
