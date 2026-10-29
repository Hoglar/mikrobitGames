import { randomGenerator, clamp } from '../shared/random.js';
import { drawGrid, drawCircle } from '../shared/canvas.js';

export function createStars({ seed = 'arcade-v1' } = {}) {
  const rng = randomGenerator(seed);
  rng(); // Preserve the initial seed sequence from the original arcade module.
  let target = { x: .15 + rng() * .7, y: .15 + rng() * .7 };
  const hazards = [{ x: .3, y: .4 }, { x: .7, y: .7 }];
  let time = 0, x = .5, y = .5, tilt = { x: 0, y: 0 }, ended = false, points = 0;

  return {
    input(state) { tilt = state.tilt; },
    releaseControls() { tilt = { x: 0, y: 0 }; },
    press() {},
    tick(dt) {
      if (ended) return;
      time += dt;
      x = clamp(x + tilt.x * dt * .55, .025, .975);
      y = clamp(y + tilt.y * dt * .55, .04, .96);
      if (Math.hypot(x - target.x, y - target.y) < .06) {
        points += 100; target = { x: .1 + rng() * .8, y: .1 + rng() * .8 };
      }
      for (const hazard of hazards) {
        if (Math.hypot(x - hazard.x, y - hazard.y) < .055) { points = Math.max(0, points - 50); x = .5; y = .9; }
      }
      if (time >= 60) ended = true;
    },
    get ended() { return ended; },
    get value() { return points; },
    get label() { return `${points} poeng · ${Math.max(0, Math.ceil(60 - time))} s`; },
    get resultText() { return 'Godt spilt! Prøv igjen og utfordre rekorden din.'; },
    get completed() { return true; },
    draw(ctx, width, height) {
      drawGrid(ctx, width, height);
      drawCircle(ctx, target, 15, '#ffd481', width, height);
      for (const hazard of hazards) drawCircle(ctx, hazard, 15, '#f59696', width, height);
      drawCircle(ctx, { x, y }, 12, '#e5fff8', width, height);
      drawCircle(ctx, { x: x - .004, y: y - .008 }, 4, '#fff', width, height);
    }
  };
}
