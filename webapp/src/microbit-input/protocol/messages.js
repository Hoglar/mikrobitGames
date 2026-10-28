import { CODES, DISPLAY, LIMITS, SENSORS, SPEAKER } from './constants.js';
import { error, freeze } from '../errors.js';

const own = (value, key) => Object.hasOwn(value, key);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const int = (n, low, high) => Number.isInteger(n) && n >= low && n <= high;
const namePattern = /^[a-z][a-z0-9-]{0,23}$/;

/** JSON.parse supplies syntax checking; this bounded walk rejects decoded duplicate keys. */
export function parseObject(text) {
  if (typeof text !== 'string' || text.length > LIMITS.incoming || /[^\x20-\x7e]/.test(text))
    throw error('protocol', 'Invalid JSON wire bytes');
  let parsed;
  try { parsed = JSON.parse(text); } catch (cause) { throw error('protocol', 'Malformed JSON', { cause }); }
  if (!object(parsed)) throw error('protocol', 'Expected a JSON object');
  let i = 0;
  const space = () => { while (text[i] === ' ') i++; };
  const string = () => {
    const start = i++;
    while (text[i] !== '"') { if (text[i] === '\\') i++; i++; }
    return JSON.parse(text.slice(start, ++i));
  };
  const value = () => {
    space();
    if (text[i] === '{') {
      i++; space(); const keys = new Set();
      if (text[i] !== '}') for (;;) {
        space(); const key = string();
        if (keys.has(key)) throw error('protocol', 'Duplicate JSON key');
        keys.add(key); space(); i++; value(); space();
        if (text[i] !== ',') break;
        i++;
      }
      i++;
    } else if (text[i] === '[') {
      i++; space();
      if (text[i] !== ']') for (;;) { value(); space(); if (text[i] !== ',') break; i++; }
      i++;
    } else if (text[i] === '"') string();
    else while (i < text.length && !/[,}\] ]/.test(text[i])) i++;
  };
  value();
  return parsed;
}

export function validateDeviceInfo(info) {
  if (!object(info) || info.type !== 'deviceInfo' || !own(info, 'type')) throw error('protocol', 'Expected deviceInfo');
  if (!own(info, 'board') || info.board !== 'microbit-v2') throw error('connection', 'Unsupported board; micro:bit V2 is required');
  if (!own(info, 'protocolVersion') || info.protocolVersion !== 1 || !own(info, 'snapshotIntervalMs') || info.snapshotIntervalMs !== 20)
    throw error('protocol', 'Unsupported protocol version or snapshot interval');
  if (!own(info, 'capabilities') || !object(info.capabilities) || !own(info.capabilities, 'outputs') || !object(info.capabilities.outputs))
    throw error('capability', 'Missing capabilities');
  const caps = info.capabilities, outputs = caps.outputs;
  function list(owner, key, required) {
    const list = owner[key];
    if (!own(owner, key) || !Array.isArray(list) || !list.every(v => typeof v === 'string') || new Set(list).size !== list.length || !required.every(v => list.includes(v)))
      throw error('capability', `Invalid or incomplete ${key} capabilities`);
    return required.slice(); // Unknown advertised operations are not exposed as supported APIs.
  }
  const sensors = list(caps, 'sensors', SENSORS);
  const ledDisplay = list(outputs, 'ledDisplay', DISPLAY), speaker = list(outputs, 'speaker', SPEAKER);
  const sounds = outputs.builtInSounds;
  if (!own(outputs, 'builtInSounds') || !Array.isArray(sounds) || sounds.length > 16 ||
      !sounds.every(n => typeof n === 'string' && namePattern.test(n)) || new Set(sounds).size !== sounds.length)
    throw error('capability', 'Invalid built-in sound catalog');
  return freeze({ type: 'deviceInfo', protocolVersion: 1, board: 'microbit-v2', snapshotIntervalMs: 20,
    capabilities: { sensors, outputs: { ledDisplay, speaker, builtInSounds: sounds.slice() } } });
}

const ranges = Object.freeze({ n: [0, 4294967295], u: [0, 4294967295], ac: [0, 4294967295], bc: [0, 4294967295], qc: [0, 4294967295],
  a: [0, 1], b: [0, 1], q: [0, 1], x: [-8192, 8192], y: [-8192, 8192], z: [-8192, 8192], t: [-40, 125], l: [0, 255], m: [0, 255] });
export function validateSnapshot(value) {
  if (!object(value) || own(value, 'type')) throw error('protocol', 'Expected an untyped sensor snapshot');
  const snapshot = {};
  for (const [key, [low, high]] of Object.entries(ranges)) {
    if (!own(value, key) || !int(value[key], low, high)) throw error('protocol', `Invalid snapshot field ${key}`);
    snapshot[key] = value[key];
  }
  return Object.freeze(snapshot);
}

export function parseResult(line) {
  const match = /^R\|1\|([1-9][0-9]{0,9})\|(OK|ERR\|([A-Z][A-Z0-9_]*))$/.exec(line);
  if (!match || Number(match[1]) > LIMITS.maxId) throw error('protocol', 'Malformed command result');
  return Object.freeze({ id: Number(match[1]), ok: match[2] === 'OK', protocolCode: match[3],
    known: match[3] === undefined || CODES.includes(match[3]) });
}

/** Copy/encode caller-owned values at enqueue time, before they can be mutated. */
export function encodeAction(action, argument, caps) {
  function invalid(message) { throw error('validation', message); }
  const volume = options => options.volume === undefined ? 128 : options.volume;
  const frequency = n => int(n, 20, 9999) || n === 0;
  const note = n => object(n) && own(n, 'frequencyHz') && own(n, 'durationMs') && frequency(n.frequencyHz) && int(n.durationMs, 1, 10000);
  const speaker = action.startsWith('speaker.');
  const operation = action.split('.')[1];
  if (!caps || !(speaker ? caps.outputs.speaker : caps.outputs.ledDisplay).includes(operation))
    throw error('capability', `Unsupported output ${action}`);
  switch (action) {
    case 'display.showText':
      if (typeof argument !== 'string' || argument.length < 1 || argument.length > 32 || !/^[A-Za-z0-9 .,!?:+\-/()]+$/.test(argument)) invalid('Invalid display text');
      return `D|TEXT|${argument}`;
    case 'display.showImage':
      if (!Array.isArray(argument) || argument.length !== 25 || !Array.from(argument).every(n => int(n, 0, 9))) invalid('Image requires 25 integer pixels in 0..9');
      return `D|IMAGE|${argument.join('')}`;
    case 'display.clear': return 'D|CLEAR';
    case 'speaker.stop': return 'S|STOP';
    case 'speaker.playTone':
      if (!note(argument) || !int(volume(argument), 0, 255)) invalid('Invalid tone frequency, duration or volume');
      return `S|TONE|${argument.frequencyHz}|${argument.durationMs}|${volume(argument)}`;
    case 'speaker.playMelody': {
      if (!object(argument) || !Array.isArray(argument.notes) || argument.notes.length < 1 || argument.notes.length > 16 ||
          !Array.from(argument.notes).every(note) || !int(volume(argument), 0, 255) || argument.notes.reduce((n, v) => n + v.durationMs, 0) > 10000)
        invalid('Invalid melody notes, duration or volume');
      return `S|MELODY|${volume(argument)}|${argument.notes.map(n => `${n.frequencyHz}:${n.durationMs}`).join(',')}`;
    }
    case 'speaker.playBuiltInSound':
      if (typeof argument !== 'string' || !namePattern.test(argument)) invalid('Invalid sound name');
      if (!caps.outputs.builtInSounds.includes(argument)) throw error('capability', 'Sound is not advertised', { protocolCode: 'UNSUPPORTED_SOUND' });
      return `S|SOUND|${argument}`;
    default: invalid('Unknown output method');
  }
}
