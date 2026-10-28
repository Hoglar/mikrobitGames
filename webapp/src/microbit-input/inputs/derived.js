import { delta32 } from '../protocol/constants.js';

export function tilt(axisMg) {
  const v = Math.max(-1, Math.min(1, axisMg / 1000));
  return Math.abs(v) <= .05 ? 0 : Math.sign(v) * (Math.abs(v) - .05) / .95;
}
export const strength = (x, y, z) => Math.round(Math.hypot(x, y, z));
export const soundLabel = (level, previous = null) => level >= 180 ? 'loud' : level <= 120 ? 'quiet' : previous ?? 'quiet';

export class ShakeDetector {
  constructor() { this.reset(); }
  reset() { this.previous = null; this.window = []; this.armed = true; this.quietAt = null; this.emittedAt = null; }
  update(sample, gap = false) {
    const prev = this.previous;
    this.previous = sample;
    if (!prev) { this.window = [sample]; return false; }
    if (gap || delta32(sample.u, prev.u) > 100) {
      this.window = []; this.armed = false; this.quietAt = null;
      return false;
    }
    if (!this.armed) {
      const quiet = ['x', 'y', 'z'].every(k => Math.abs(sample[k] - prev[k]) < 300);
      if (!quiet) this.quietAt = null;
      else if (this.quietAt === null) this.quietAt = prev.u;
      if (this.quietAt !== null && delta32(sample.u, this.quietAt) >= 200 &&
          (this.emittedAt === null || delta32(sample.u, this.emittedAt) >= 500)) {
        this.armed = true; this.window = [sample]; this.quietAt = null;
      }
      return false;
    }
    this.window.push(sample);
    if (this.window.length > 4) this.window.shift();
    if (this.window.length !== 4 || delta32(sample.u, this.window[0].u) > 300) return false;
    const matches = ['x', 'y'].some(k => {
      const d = this.window.slice(1).map((s, i) => s[k] - this.window[i][k]);
      return d.every(n => Math.abs(n) >= 1200) && d[0] * d[1] < 0 && d[1] * d[2] < 0;
    });
    if (matches) { this.window = []; this.armed = false; this.quietAt = null; this.emittedAt = sample.u; }
    return matches;
  }
}
