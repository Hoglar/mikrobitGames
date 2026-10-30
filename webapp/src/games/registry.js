import { tracks as racingTracks } from './micro-racer/tracks.js';
import { cars as racingCars } from './micro-racer/config.js';
import { decodeRace, formatTime } from './micro-racer/rules.js';
// Versioned local module registry. Register these IDs using catalog-commands.mjs.
const definition = (id, key, name, unit, direction, max, config = {}, min = 0) => Object.freeze({ id, key, name, score_unit: unit, ranking_direction: direction, min_value: min, max_value: max, config: Object.freeze(config) });
// Explicit ID ranges: reordering tracks/cars must never renumber old records.
const racingBases=Object.freeze({'harbor-ring':12,'pine-valley':24,'neon-docks':36});
const racingCarIds=Object.freeze({drift:0,race:1,formula:2});
const racingId=(track,format,laps,car)=>{
  const number=racingBases[track.id]+(format==='race'?6:0)+(laps===3?3:0)+racingCarIds[car.id];
  if(!Number.isInteger(number))throw new Error('Racingvarianten mangler en tildelt katalog-ID.');
  return `6a990001-165b-4e1d-8a20-${String(number).padStart(12,'0')}`;
};
const racingGames=racingTracks.flatMap(track=>['time-trial','race'].flatMap(format=>[1,3].flatMap(laps=>racingCars.map(car=>definition(
  racingId(track,format,laps,car),'racing',
  `Micro Racer · ${track.name} · ${format==='race'?'AI-løp':'Tidskjøring'} · ${laps} ${laps===1?'runde':'runder'} · ${car.name}`,
  format==='race'?'racing_rank_v1':'milliseconds','lower_is_better',format==='race'?3600000:600000,
  {track:track.id,trackVersion:1,format,laps,car:car.id,profile:'micro-racer-v1'},1
)))));
export const games = Object.freeze([
  definition('6a990001-165b-4e1d-8a20-000000000001', 'snake', 'Micro Snake · Standard Competitive', 'snake_rank_v1', 'higher_is_better', 396999999, { mode: 'standard', food: 'competitive' }),
  definition('6a990001-165b-4e1d-8a20-000000000002', 'snake', 'Micro Snake · Standard Random', 'snake_rank_v1', 'higher_is_better', 396999999, { mode: 'standard', food: 'random' }),
  definition('6a990001-165b-4e1d-8a20-000000000003', 'snake', 'Micro Snake · Hurtig Competitive', 'snake_rank_v1', 'higher_is_better', 396999999, { mode: 'fast', food: 'competitive' }),
  definition('6a990001-165b-4e1d-8a20-000000000004', 'snake', 'Micro Snake · Hurtig Random', 'snake_rank_v1', 'higher_is_better', 396999999, { mode: 'fast', food: 'random' }),
  definition('6a990001-165b-4e1d-8a20-000000000005', 'snake', 'Micro Snake · Labyrint Competitive', 'snake_rank_v1', 'higher_is_better', 380999999, { mode: 'maze', food: 'competitive' }),
  definition('6a990001-165b-4e1d-8a20-000000000006', 'snake', 'Micro Snake · Labyrint Random', 'snake_rank_v1', 'higher_is_better', 380999999, { mode: 'maze', food: 'random' }),
  definition('6a990001-165b-4e1d-8a20-000000000007', 'viking', 'Viking Dash', 'meters', 'higher_is_better', Number.MAX_SAFE_INTEGER),
  definition('6a990001-165b-4e1d-8a20-000000000008', 'stars', 'Stjernefangst', 'points', 'higher_is_better', 100000),
  definition('6a990001-165b-4e1d-8a20-000000000009', 'reaction', 'Reaksjonsjakt', 'milliseconds', 'lower_is_better', 100000),
  definition('6a990001-165b-4e1d-8a20-000000000010', 'balance', 'Balanseløypa', 'milliseconds', 'lower_is_better', 600000),
  definition('6a990001-165b-4e1d-8a20-000000000011', 'tetris', 'Micro Tetris', 'tetris_score_v1', 'higher_is_better', Number.MAX_SAFE_INTEGER),
  ...racingGames
]);
export const families = [
  { key: 'snake', title: 'Micro Snake', genre: 'KLASSIKER', control: 'A / B', color: 'green', description: 'En klassiker med en ny vri. Hvor lang kan slangen din bli?', number: '01' },
  { key: 'viking', title: 'Viking Dash', genre: 'EVENTYR', control: 'A / B', color: 'purple', description: 'Hopp over grøfter, dukk under greiner og finn din indre viking.', number: '02' },
  { key: 'stars', title: 'Stjernefangst', genre: 'ARKADE', control: 'VIPP', color: 'yellow', description: 'Sikt mot stjernene. Fang lyspunktene og styr unna det røde.', number: '03' },
  { key: 'reaction', title: 'Reaksjonsjakt', genre: 'REAKSJON', control: 'A / B', color: 'pink', description: 'Følg signalet. Fem runder. Hvor rask er du egentlig?', number: '04' },
  { key: 'balance', title: 'Balanseløypa', genre: 'PRESISJON', control: 'VIPP', color: 'blue', description: 'Finn balansen og før kula trygt gjennom alle kontrollpunktene.', number: '05' },
  { key: 'tetris', title: 'Micro Tetris', genre: 'PUZZLE', control: 'VIPP / A / B / LOGO', color: 'purple', description: 'Bygg, roter og rydd linjer. Hold favorittbrikken mens tempoet stiger.', number: '06' },
  { key: 'racing', title: 'Micro Racer', genre: 'RACING', control: 'VIPP / A / B', color: 'yellow', description: 'Finn bremsepunktet. Velg bane og bil, kjør mot klokka eller møt tre rivaler.', number: '07' }
];
export function registeredGame(remote) {
  const local = games.find(g => g.id === remote?.id);
  return local && ['score_unit', 'ranking_direction', 'min_value', 'max_value'].every(k => local[k] === remote[k]) ? local : null;
}
export function formatScore(game, value) {
  if (value === null || value === undefined) return 'Ingen delverdi';
  if (game?.score_unit === 'racing_rank_v1') { try { const result=decodeRace(value);return `${result.place}. plass · ${formatTime(result.time)}`; } catch { return 'Ugyldig løpsresultat'; } }
  if (game?.score_unit === 'milliseconds' && (game.key === 'racing' || games.some(g=>g.id===game.id&&g.key==='racing'))) return formatTime(value);
  if (game?.score_unit === 'snake_rank_v1') return `${Math.floor(value / 1e6)} mat · ${999999 - value % 1e6} steg`;
  if (game?.score_unit === 'milliseconds') return `${(value / 1000).toLocaleString('nb-NO', { maximumFractionDigits: 3 })} s`;
  return `${value.toLocaleString('nb-NO')} ${game?.score_unit === 'meters' ? 'm' : ['points','tetris_score_v1'].includes(game?.score_unit) ? 'poeng' : game?.score_unit ?? ''}`;
}
export async function loadGame(key) {
  if (key === 'snake') return (await import('./snake/index.js')).createSnake;
  if (key === 'viking') return (await import('./viking-dash/index.js')).createViking;
  if (key === 'stars') return (await import('./stars/index.js')).createStars;
  if (key === 'reaction') return (await import('./reaction/index.js')).createReaction;
  if (key === 'balance') return (await import('./balance/index.js')).createBalance;
  if (key === 'tetris') return (await import('./tetris/index.js')).createTetris;
  if (key === 'racing') return (await import('./micro-racer/index.js')).createRacing;
  throw new RangeError(`Ukjent spill: ${key}`);
}
