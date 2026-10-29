import { randomGenerator } from '../shared/random.js';
import { drawGrid } from '../shared/canvas.js';

export function createReaction({ seed = 'arcade-v1' } = {}) {
  const rng = randomGenerator(seed);
  let wait = 1 + rng() * 2;
  rng(); rng(); // Preserve signal ordering from the original arcade seed sequence.
  let time = 0, ended = false, signal = null, signalTime = 0, penalty = 0;
  const reactions = [];

  function nextReaction(value) {
    reactions.push(value); penalty = 0; signal = null; wait = time + 1 + rng() * 2;
    if (reactions.length === 5) ended = true;
  }

  return {
    input() {},
    releaseControls() {},
    press({ input }) {
      if (ended || !['a', 'b'].includes(input)) return;
      if (!signal) { penalty += 500; return; }
      nextReaction(Math.round((time - signalTime) * 1000) + (input === signal ? 0 : 1000) + penalty);
    },
    tick(dt) {
      if (ended) return;
      time += dt;
      if (!signal && time >= wait) { signal = rng() < .5 ? 'a' : 'b'; signalTime = time; }
      if (signal && time - signalTime >= 10) nextReaction(10000 + penalty);
    },
    get ended() { return ended; },
    get value() { return Math.round(reactions.reduce((sum, value) => sum + value, 0) / Math.max(1, reactions.length)); },
    get label() { return `${reactions.length}/5 signaler · ${penalty ? '+500 ms ved for tidlig trykk' : ''}`; },
    get resultText() { return 'Godt spilt! Prøv igjen og utfordre rekorden din.'; },
    get completed() { return true; },
    draw(ctx, width, height) {
      drawGrid(ctx, width, height);
      ctx.textAlign = 'center'; ctx.fillStyle = signal ? '#d6f59b' : '#9aaca1';
      ctx.font = 'bold 100px monospace'; ctx.fillText(signal ? signal.toUpperCase() : '···', width / 2, height / 2);
      ctx.font = '19px monospace'; ctx.fillText(signal ? 'TRYKK NÅ' : 'VENT PÅ SIGNALET', width / 2, height / 2 + 50);
      ctx.textAlign = 'start';
    }
  };
}
