import test from 'node:test';
import assert from 'node:assert/strict';
import { createViking } from '../../src/games/viking.js';

function advance(game, target, observe = () => {}) {
  while (!game.ended && game.state.distance < target) {
    const s = game.state, speed = 8 + 8 * Math.min(s.distance / 1500, 1);
    const next = s.objects.find(o => o.x + o.width + .3 >= s.distance);
    const near = next && (next.x - s.distance) / speed < .32;
    game.input({ buttons: { bPressed: Boolean(next?.type === 'branch' && near) } });
    if (near && next.type !== 'branch' && s.y === 0) game.press({ input: 'a', count: 1 });
    game.tick(1 / 120); observe(game.state);
  }
  assert.equal(game.ended, false, `Autopilot collided at ${game.state.distance}`);
}

test('only a new near-landing press buffers a jump; holding or early mid-air presses do not repeat', () => {
  const game = createViking();
  game.press({ input: 'a', count: 8 }); game.tick(.3);
  game.press({ input: 'a', count: 1 }); game.tick(.6);
  assert.equal(game.state.y, 0);

  game.press({ input: 'a' }); game.tick(.71);
  game.press({ input: 'a' }); game.tick(.12);
  assert.ok(game.state.y > 0, 'pre-landing input should start the next jump');
});

test('B cancels a buffered jump and cannot shorten an airborne jump', () => {
  const a = createViking(), b = createViking();
  for (const game of [a, b]) { game.press({ input: 'a' }); game.tick(.71); }
  a.press({ input: 'a' }); a.input({ buttons: { bPressed: true } });
  for (const game of [a, b]) game.tick(.04);
  assert.equal(a.state.y, b.state.y);
  a.input({ buttons: { bPressed: false } });
  for (const game of [a, b]) game.tick(.15);
  assert.equal(a.state.y, 0); assert.equal(b.state.y, 0);
});

test('seed streams repeat the complete journey; unlocks, transitions and event gaps follow design', () => {
  const first = createViking({ seed: 'midgard' }), second = createViking({ seed: 'midgard' });
  let lastEvent = null, previousEvent = null, lastSection = 0, sawTransition = false;
  const eventNames = new Set();
  advance(first, 1700, s => {
    for (const o of s.objects) {
      if (o.type === 'branch') assert.ok(o.x >= 100);
      if (o.type === 'pit') assert.ok(o.x >= 200);
      assert.ok(o.skin);
    }
    if (s.section !== lastSection) { assert.ok(s.transition < .01); lastSection = s.section; }
    if (s.transition > 0 && s.transition < 1) sawTransition = true;
    if (s.event?.start !== lastEvent && s.event) {
      assert.notEqual(s.event.name, previousEvent);
      if (previousEvent === null) assert.ok(['Nordlys', 'Stjerneskudd', 'Solnedgang'].includes(s.event.name));
      previousEvent = s.event.name; lastEvent = s.event.start; eventNames.add(s.event.name);
    }
  });
  advance(second, 1700);
  assert.deepEqual(first.state, second.state);
  assert.ok(sawTransition); assert.ok(eventNames.size > 2);
});

test('public state snapshots cannot mutate the world and stopped simulations keep their result', () => {
  const game = createViking({ seed: 'state' }); game.tick(.1);
  const view = game.state; view.objects[0].x = -1;
  assert.notEqual(game.state.objects[0].x, -1);
  while (!game.ended) game.tick(.1);
  const result = game.state; game.tick(10); game.press({ input: 'a' });
  assert.deepEqual(game.state, result);
});
