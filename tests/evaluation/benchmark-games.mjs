import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
import { createSnake } from '../../webapp/src/games/snake/index.js';
import { createViking } from '../../webapp/src/games/viking-dash/index.js';
import { createStars } from '../../webapp/src/games/stars/index.js';
import { createReaction } from '../../webapp/src/games/reaction/index.js';
import { createBalance } from '../../webapp/src/games/balance/index.js';
import { TetrisModel } from '../../webapp/src/games/tetris/model.js';

const jobs = [
  ['snake', () => { const g = createSnake(); for (let i = 0; i < 5; i++) g.step(); assert.equal(g.ended, false); }],
  ...[['viking', createViking], ['stars', createStars], ['reaction', createReaction], ['balance', createBalance]]
    .map(([name, create]) => [name, () => { const g = create({ seed: 'fom-v1' }); for (let i = 0; i < 60; i++) g.tick(1 / 120); assert.equal(g.ended, false); g.dispose?.(); }]),
  ['tetris', () => { const g = new TetrisModel({ seed: 'fom-v1' }); for (let i = 0; i < 60; i++) g.step(1000 / 120); assert.equal(g.ended, false); }]
];
const measurements = jobs.map(([name, job]) => {
  for (let i = 0; i < 100; i++) job();
  const samples = [];
  for (let i = 0; i < 1000; i++) { const start = performance.now(); job(); samples.push(performance.now() - start); }
  const sorted = [...samples].sort((a, b) => a - b);
  return { name, samples, count: samples.length, p50Ms: sorted[499], p95Ms: sorted[949], p99Ms: sorted[989], maxMs: sorted.at(-1) };
});
writeFileSync(process.argv[2], JSON.stringify({ measurements,
  method: '100 warmups + 1000 samples per game; fixed seed; construction and 60 simulation steps at 120 Hz (Snake: 5 steps); assertions included. No rendering, USB or network.' }, null, 2) + '\n');
console.log('Measured all six game simulations.');
