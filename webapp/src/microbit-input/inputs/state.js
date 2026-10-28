import { delta32, forward } from '../protocol/constants.js';
import { freeze } from '../errors.js';
import { ShakeDetector, soundLabel, strength, tilt } from './derived.js';

export const unavailable = (connection = 'disconnected', board = null) => freeze({ connection, inputAvailable: false, board,
  buttons: { aPressed: false, bPressed: false }, tilt: { x: 0, y: 0 }, accelerometer: null,
  temperatureC: null, lightLevel: null, microphone: null, touch: { logoPressed: null } });

/** A valid snapshot is committed atomically before notifications are delivered. */
export class InputState {
  constructor() { this.shake = new ShakeDetector(); this.reset(); }
  reset() { this.previous = null; this.eventBaseline = false; this.sound = null; this.shake.reset(); }
  resetGame() { this.eventBaseline = false; this.shake.reset(); }
  accept(s) {
    const previous = this.previous;
    const dn = previous ? delta32(s.n, previous.n) : 1;
    if (previous && !forward(dn)) return { status: 'ignored' };
    if (previous && !forward(delta32(s.u, previous.u))) return { status: 'recover' };
    const counts = previous ? ['ac', 'bc', 'qc'].map(k => delta32(s[k], previous[k])) : [0, 0, 0];
    if (counts.some(n => n >= 2147483648)) return { status: 'invalid' };
    const presses = this.eventBaseline ? counts.flatMap((count, i) => count ? [freeze({ input: ['a', 'b', 'logo'][i], count })] : []) : [];
    const gesture = this.shake.update(s, dn > 1) ? 'shake' : null;
    this.sound = soundLabel(s.m, this.sound);
    this.previous = s; this.eventBaseline = true;
    const state = freeze({ connection: 'connected', inputAvailable: true, board: 'microbit-v2',
      buttons: { aPressed: s.a === 1, bPressed: s.b === 1 }, tilt: { x: tilt(s.x), y: tilt(s.y) },
      accelerometer: { xMg: s.x, yMg: s.y, zMg: s.z, strengthMg: strength(s.x, s.y, s.z), gesture },
      temperatureC: s.t, lightLevel: s.l, microphone: { soundLevel: s.m, soundEvent: this.sound }, touch: { logoPressed: s.q === 1 } });
    return { status: 'accepted', state, presses, gesture, gaps: previous ? dn - 1 : 0 };
  }
}
