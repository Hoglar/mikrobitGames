import { delta32 } from '../protocol/constants.js';

export function tilt(axisMg) {
  const v = Math.max(-1, Math.min(1, axisMg / 1000));
  return Math.abs(v) <= .05 ? 0 : Math.sign(v) * (Math.abs(v) - .05) / .95;
}
export const strength = (x, y, z) => Math.round(Math.hypot(x, y, z));
export const soundLabel = (level, previous = null) => level >= 180 ? 'loud' : level <= 120 ? 'quiet' : previous ?? 'quiet';

const EXCURSION_MG = 1200, SHAKE_WINDOW_MS = 600;

/** Four alternating extrema; intermediate samples need not reverse direction. */
class AxisExcursions {
  update(sample, axis) {
    const point = { value: sample[axis], u: sample.u };
    if (!this.low) { this.low = this.high = point; this.points = []; this.direction = 0; return false; }
    if (!this.direction) {
      if (delta32(point.u, this.low.u) > SHAKE_WINDOW_MS || point.value <= this.low.value) this.low = point;
      if (delta32(point.u, this.high.u) > SHAKE_WINDOW_MS || point.value >= this.high.value) this.high = point;
      if (point.value - this.low.value >= EXCURSION_MG) { this.points = [this.low, point]; this.direction = 1; }
      else if (this.high.value - point.value >= EXCURSION_MG) { this.points = [this.high, point]; this.direction = -1; }
      else return false;
    } else {
      const last = this.points.at(-1);
      if ((point.value - last.value) * this.direction >= 0) this.points[this.points.length - 1] = point;
      else if ((last.value - point.value) * this.direction >= EXCURSION_MG) {
        this.direction *= -1; this.points.push(point);
        if (this.points.length > 4) this.points.shift();
      }
    }
    return this.points.length === 4 && delta32(point.u, this.points[0].u) <= SHAKE_WINDOW_MS;
  }
}

export class ShakeDetector {
  constructor() { this.reset(); }
  clearExcursions() { this.axes = [new AxisExcursions(), new AxisExcursions()]; }
  reset() { this.previous = null; this.clearExcursions(); this.armed = true; this.quietAt = null; this.emittedAt = null; }
  update(sample, gap = false) {
    const prev = this.previous;
    this.previous = sample;
    if (!prev) { this.axes[0].update(sample, 'x'); this.axes[1].update(sample, 'y'); return false; }
    if (gap || delta32(sample.u, prev.u) > 100) {
      this.clearExcursions(); this.armed = false; this.quietAt = null;
      return false;
    }
    if (!this.armed) {
      const quiet = ['x', 'y', 'z'].every(k => Math.abs(sample[k] - prev[k]) < 300);
      if (!quiet) this.quietAt = null;
      else if (this.quietAt === null) this.quietAt = prev.u;
      if (this.quietAt !== null && delta32(sample.u, this.quietAt) >= 200 &&
          (this.emittedAt === null || delta32(sample.u, this.emittedAt) >= 500)) {
        this.armed = true; this.clearExcursions(); this.quietAt = null;
        this.axes[0].update(sample, 'x'); this.axes[1].update(sample, 'y');
      }
      return false;
    }
    const matches = this.axes[0].update(sample, 'x') || this.axes[1].update(sample, 'y');
    if (matches) { this.clearExcursions(); this.armed = false; this.quietAt = null; this.emittedAt = sample.u; }
    return matches;
  }
}
