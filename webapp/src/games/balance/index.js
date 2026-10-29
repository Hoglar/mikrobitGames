import { clamp } from '../shared/random.js';
import { drawGrid, drawCircle } from '../shared/canvas.js';

export function createBalance() {
  const checkpoints = [
    { x: .15, y: .8 }, { x: .15, y: .2 }, { x: .5, y: .2 },
    { x: .5, y: .75 }, { x: .85, y: .75 }, { x: .85, y: .2 }
  ];
  let time = 0, x = .5, y = .5, tilt = { x: 0, y: 0 }, checkpoint = 0, ended = false;

  return {
    input(state) { tilt = state.tilt; },
    releaseControls() { tilt = { x: 0, y: 0 }; },
    press() {},
    tick(dt) {
      if (ended) return;
      time += dt;
      x = clamp(x + tilt.x * dt * .55, .025, .975);
      y = clamp(y + tilt.y * dt * .55, .04, .96);
      const target = checkpoints[checkpoint];
      if (target && Math.hypot(x - target.x, y - target.y) < .05) checkpoint++;
      if (checkpoint === checkpoints.length || time >= 600) ended = true;
    },
    get ended() { return ended; },
    get value() { return Math.min(600000, Math.ceil(time * 1000)); },
    get label() { return `${checkpoint}/6 kontrollpunkter · ${time.toFixed(1)} s`; },
    get resultText() { return checkpoint < 6 ? 'Tiden er ute. Forsøket er ufullført.' : 'Godt spilt! Prøv igjen og utfordre rekorden din.'; },
    get completed() { return checkpoint === 6; },
    draw(ctx, width, height) {
      drawGrid(ctx, width, height);
      ctx.beginPath(); ctx.strokeStyle = '#486a61'; ctx.lineWidth = 16;
      checkpoints.forEach(point => ctx.lineTo(point.x * width, point.y * height)); ctx.stroke();
      checkpoints.forEach((point, index) => {
        drawCircle(ctx, point, 18, index < checkpoint ? '#d6f59b' : '#557d7c', width, height);
        ctx.fillStyle = '#122321'; ctx.font = 'bold 14px monospace'; ctx.fillText(index + 1, point.x * width - 4, point.y * height + 5);
      });
      drawCircle(ctx, { x, y }, 12, '#e5fff8', width, height);
      drawCircle(ctx, { x: x - .004, y: y - .008 }, 4, '#fff', width, height);
    }
  };
}
