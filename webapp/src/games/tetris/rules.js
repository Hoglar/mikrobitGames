import { randomGenerator } from '../shared/random.js';

export const VERSION = 'micro-tetris-v1';
export const TYPES = Object.freeze(['I', 'J', 'L', 'O', 'S', 'T', 'Z']);
export const COLORS = Object.freeze({ I: '#43d9e6', J: '#4e73ff', L: '#ffad42', O: '#f6db4d', S: '#63d86a', T: '#c67aff', Z: '#f26b6b' });
const spawn = {
  I: [[0,1],[1,1],[2,1],[3,1]], J: [[0,0],[0,1],[1,1],[2,1]], L: [[2,0],[0,1],[1,1],[2,1]],
  O: [[1,0],[2,0],[1,1],[2,1]], S: [[1,0],[2,0],[0,1],[1,1]],
  T: [[1,0],[0,1],[1,1],[2,1]], Z: [[0,0],[1,0],[1,1],[2,1]]
};
const normalKicks = [
  [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]], [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
  [[0,0],[1,0],[1,-1],[0,2],[1,2]], [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]]
];
const iKicks = [
  [[0,0],[-2,0],[1,0],[-2,1],[1,-2]], [[0,0],[-1,0],[2,0],[-1,-2],[2,1]],
  [[0,0],[2,0],[-1,0],[2,-1],[-1,2]], [[0,0],[1,0],[-2,0],[1,2],[-2,-1]]
];
export function localCells(type, rotation = 0) {
  let cells = spawn[type].map(p => [...p]);
  if (type === 'O') return cells;
  const center = type === 'I' ? 1.5 : 1;
  for (let n = 0; n < rotation; n++) cells = cells.map(([x,y]) => [center - (y-center), center + (x-center)]);
  return cells;
}
export const cellsOf = piece => localCells(piece.type, piece.rotation).map(([x,y]) => [x+piece.x,y+piece.y]);
export const kicksFor = (type, rotation) => (type === 'O' ? [[0,0]] : (type === 'I' ? iKicks : normalKicks)[rotation]).map(p => [...p]);
export const levelOf = score => Math.min(15, 1 + Math.floor(score / 5000));
export const gravityMs = level => Math.round(1000 * .05 ** ((level-1)/14));
export const musicBpm = level => 90 + Math.round(90 * (level-1)/14);
export const emptyBoard = () => Array.from({length:40}, () => Array(10).fill(null));

export class SevenBag {
  constructor(seed) { this.random = randomGenerator(`${VERSION}:${seed}`); this.queue = []; this.refill(); }
  refill() {
    if (this.queue.length >= 6) return;
    const bag = [...TYPES];
    for (let i=6;i>0;i--) { const j=Math.floor(this.random()*(i+1)); [bag[i],bag[j]]=[bag[j],bag[i]]; }
    this.queue.push(...bag);
  }
  take() { this.refill(); const type=this.queue.shift(); this.refill(); return type; }
  next() { return this.queue.slice(0,5); }
}

export function holdPixels(type) {
  const pixels=Array(25).fill(0); if (!type) return pixels;
  const cells=localCells(type), minX=Math.min(...cells.map(p=>p[0])), minY=Math.min(...cells.map(p=>p[1]));
  const width=Math.max(...cells.map(p=>p[0]))-minX+1, height=Math.max(...cells.map(p=>p[1]))-minY+1;
  for (const [x,y] of cells) pixels[(y-minY+Math.floor((5-height)/2))*5+x-minX+Math.floor((5-width)/2)]=9;
  return pixels;
}

export function scoreLock({ lines, spin = null, level, combo = -1, backToBack = false, perfect = false, dropDistance = 0 }) {
  const base=(spin==='full' ? [400,800,1200,1600] : spin==='mini' ? [100,200,400] : [0,100,300,500,800])[lines];
  if (base === undefined) throw new RangeError('Invalid line/spin combination');
  const difficult=lines===4 || !!spin && lines>0, b2bBonus=backToBack && difficult;
  const nextCombo=lines ? combo+1 : -1;
  const perfectBase=perfect && lines ? (lines===4 && b2bBonus ? 3200 : [0,800,1200,1800,2000][lines]) : 0;
  const clearPoints=(base*(b2bBonus ? 1.5 : 1)+50*Math.max(0,nextCombo)+perfectBase)*level;
  const worth=clearPoints/level;
  const effectClass=!lines ? 0 : perfect || worth>=1600 ? 5 : Math.max(lines, worth>=800 ? 4 : worth>=500 ? 3 : worth>=300 ? 2 : 1);
  return Object.freeze({ lines, spin, level, combo:nextCombo, backToBack:lines ? difficult : backToBack, b2bBonus,
    perfect:perfect && lines>0, clearPoints, dropPoints:2*dropDistance, total:clearPoints+2*dropDistance, effectClass });
}
