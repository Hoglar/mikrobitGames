import { LIMIT_MS } from './config.js';
const BASE = 1000000;
export function encodeRace(place, time) {
  if (!Number.isInteger(place) || place < 1 || place > 4 || !Number.isSafeInteger(time) || time < 1 || time > LIMIT_MS) throw new RangeError('Ugyldig løpsresultat.');
  return (place - 1) * BASE + time;
}
export function decodeRace(value) {
  if (!Number.isSafeInteger(value)) throw new RangeError('Ugyldig løpsresultat.');
  const place = Math.floor(value / BASE) + 1, time = value % BASE;
  if (encodeRace(place, time) !== value) throw new RangeError('Ugyldig løpsresultat.');
  return { place, time };
}
export function formatTime(value) {
  if (!Number.isFinite(value)) return '--:--.---';
  const ms = Math.max(0, Math.floor(value));
  return `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
}
export function finishingPlace(player, drivers) {
  return 1 + drivers.filter(car => car.id !== player.id && car.finishedMs !== null && car.finishedMs < player.finishedMs).length;
}
