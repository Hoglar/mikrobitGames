import test from 'node:test';
import assert from 'node:assert/strict';
import { createViking } from '../../src/games/viking-dash/index.js';
import { VIKING_TUNING as tuning, speedAtDistance } from '../../src/games/viking-dash/config.js';

function advance(game, target, observe = () => {}) {
  while (!game.ended && game.state.distance < target) {
    const s = game.state, speed = s.speed;
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
      if (o.type === 'branch') assert.ok(o.x >= tuning.duckMeters);
      if (o.type === 'pit') assert.ok(o.x >= tuning.pitMeters);
      assert.ok(o.skin);
    }
    if (s.section !== lastSection) { assert.ok(s.transition < .01); lastSection = s.section; }
    if (s.transition > 0 && s.transition < 1) sawTransition = true;
    if (s.event?.start !== lastEvent && s.event) {
      assert.notEqual(s.event.name, previousEvent);
      if (previousEvent === null) {
        assert.ok(['Nordlys', 'Stjerneskudd', 'Solnedgang'].includes(s.event.name));
        assert.ok(s.event.start >= tuning.firstEvent[0] && s.event.start <= tuning.firstEvent[1] + 1 / 120);
      }
      previousEvent = s.event.name; lastEvent = s.event.start; eventNames.add(s.event.name);
    }
  });
  advance(second, 1700);
  assert.deepEqual(first.state, second.state);
  assert.ok(sawTransition); assert.ok(eventNames.size > 2);
});

test('faster pacing retains reaction distance and safe action gaps through maximum speed', () => {
  assert.equal(speedAtDistance(0), 12);
  assert.equal(speedAtDistance(600), 18);
  assert.equal(speedAtDistance(1200), 24);
  assert.equal(speedAtDistance(5000), 24);
  // At full speed there is still at least a second to react before a typical jump lead.
  assert.ok(tuning.viewMeters * .82 / tuning.maxSpeed - .3 >= 1);
  for (const seed of ['midgard', 'ragnarok', 'fjorden', 'speed-check']) {
    const game = createViking({ seed });
    let count = 0, lastStart = -Infinity, previousEnd = null, previousIntense = false;
    advance(game, 2400, s => {
      for (let i = 1; i < s.objects.length; i++) {
        const gap = s.objects[i].x - s.objects[i - 1].x;
        assert.ok(gap / tuning.maxSpeed >= tuning.minimumActionSeconds);
      }
      if (s.event && s.event.start !== lastStart) {
        count++;
        if (previousEnd !== null) {
          const bounds = previousIntense ? tuning.intenseGap : tuning.visualGap;
          assert.ok(s.event.start - previousEnd >= bounds[0]);
          assert.ok(s.event.start - previousEnd <= bounds[1] + .02);
        }
        const duration = s.event.until - s.event.start;
        previousIntense = ['Odin', 'Ragnarok'].includes(s.event.name);
        const bounds = previousIntense ? tuning.intenseDuration : tuning.visualDuration;
        assert.ok(duration >= bounds[0] && duration <= bounds[1]);
        lastStart = s.event.start; previousEnd = s.event.until;
      }
    });
    assert.ok(count >= 10, `Expected frequent events for ${seed}, got ${count}`);
  }
});

test('public state snapshots cannot mutate the world and stopped simulations keep their result', () => {
  const game = createViking({ seed: 'state' }); game.tick(.1);
  const view = game.state; view.objects[0].x = -1;
  assert.notEqual(game.state.objects[0].x, -1);
  while (!game.ended) game.tick(.1);
  const result = game.state; game.tick(10); game.press({ input: 'a' });
  assert.deepEqual(game.state, result);
});
