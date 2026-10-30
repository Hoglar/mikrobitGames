export const PROFILE = 'micro-racer-v1';
export const STEP = 1 / 120;
export const LIMIT_MS = 600000;
export const RADIUS = 1.2;
export const cars = Object.freeze([
  Object.freeze({ id: 'drift', name: 'Driftbil', acceleration: 8, topSpeed: 30, grip: 4, brake: 12, color: '#ffad66' }),
  Object.freeze({ id: 'race', name: 'Racerbil', acceleration: 10, topSpeed: 36, grip: 8, brake: 16, color: '#64e5d0' }),
  Object.freeze({ id: 'formula', name: 'Formelbil', acceleration: 13, topSpeed: 44, grip: 12, brake: 20, color: '#ec728c' })
]);
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const wrapAngle = value => Math.atan2(Math.sin(value), Math.cos(value));
export const steeringTarget = x => Math.sign(x) * clamp((Math.abs(x) - .08) / .67, 0, 1);
export const heading = (x, y) => Math.atan2(x, -y);
export const forward = angle => ({ x: Math.sin(angle), y: -Math.cos(angle) });
export const right = angle => ({ x: Math.cos(angle), y: Math.sin(angle) });
export const carProfile = id => cars.find(car => car.id === id) ?? cars[1];
