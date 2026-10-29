import { randomGenerator } from '../shared/random.js';
export const encodeSnake = (food, steps) => food * 1000000 + 999999 - steps;
const directions = [[0,-1],[1,0],[0,1],[-1,0]];
export function createSnake({ config = {}, seed = 'snake-v1' } = {}) {
  const walls = [];
  if (config.mode === 'maze') for (const x of [4,14]) for (const y of [4,14]) for (let a=0;a<2;a++) for (let b=0;b<2;b++) walls.push([x+a,y+b]);
  const same = (a,b) => a[0] === b[0] && a[1] === b[1];
  let body = [[10,10],[9,10],[8,10],[7,10]], direction = 1, pending = null, foodCount = 0, steps = 0, ended = false, won = false, elapsed = 0, food;
  const random = randomGenerator(seed);
  function placeFood() {
    const candidates = [];
    for (let y=0;y<20;y++) for (let x=0;x<20;x++) if (!walls.some(w => same(w,[x,y]))) candidates.push([x,y]);
    const rng = config.food === 'competitive' ? randomGenerator(`snake-v1-${config.mode}-${foodCount}`) : random;
    for (let i=candidates.length-1;i>0;i--) { const j=Math.floor(rng()*(i+1)); [candidates[i],candidates[j]]=[candidates[j],candidates[i]]; }
    food = candidates.find(p => !body.some(b => same(b,p))) ?? null;
  }
  placeFood();
  function step() {
    if (ended) return;
    if (pending !== null) direction = (direction + pending + 4) % 4;
    pending = null; steps++;
    const head = body[0].map((v,i) => v + directions[direction][i]), grows = food && same(head,food);
    if (head.some(v => v<0 || v>=20) || walls.some(w=>same(w,head)) || body.slice(0,grows ? undefined : -1).some(b=>same(b,head))) ended = true;
    else {
      body.unshift(head); if (!grows) body.pop();
      else { foodCount++; if (body.length === 400-walls.length) { ended=true; won=true; food=null; } else placeFood(); }
    }
    if (steps >= 999999) ended = true;
  }
  return {
    get state() { return { body: body.map(p=>[...p]), walls, food, foodCount, steps, direction, ended, won }; },
    press({ input }) { if (!ended && pending === null && ['a','b'].includes(input)) pending = input === 'a' ? -1 : 1; },
    releaseControls() { pending = null; },
    tick(dt) {
      elapsed += dt;
      const speed = () => Math.min((config.mode === 'fast' ? 8 : 5) + Math.floor(foodCount/5), config.mode === 'fast' ? 14 : 10);
      while (!ended && elapsed >= 1/speed()) { const interval=1/speed(); elapsed-=interval; step(); }
    },
    step,
    get ended() { return ended; }, get value() { return encodeSnake(foodCount,steps); },
    get label() { return `${foodCount} mat · ${steps} steg`; },
    get resultText() { return won ? 'Brettet er fullt. Du vant!' : steps >= 999999 ? 'Steggrensen er nådd.' : 'Slangen møtte en hindring.'; },
    draw(ctx,w,h) {
      ctx.fillStyle='#101b19';ctx.fillRect(0,0,w,h);
      const size=Math.min(w,h)*.9, cell=size/20, ox=(w-size)/2, oy=(h-size)/2;
      ctx.strokeStyle='#21332b';ctx.lineWidth=1;
      for(let i=0;i<=20;i++){ctx.beginPath();ctx.moveTo(ox+i*cell,oy);ctx.lineTo(ox+i*cell,oy+size);ctx.moveTo(ox,oy+i*cell);ctx.lineTo(ox+size,oy+i*cell);ctx.stroke();}
      const square=(p,color,pad=2)=>{ctx.fillStyle=color;ctx.fillRect(ox+p[0]*cell+pad,oy+p[1]*cell+pad,cell-2*pad,cell-2*pad);};
      walls.forEach(p=>square(p,'#758278')); if(food)square(food,'#ffc66d',4);
      body.forEach((p,i)=>square(p,i===0?'#d7ff90':'#6fbe76'));
      const [hx,hy]=body[0], [dx,dy]=directions[direction];ctx.fillStyle='#101b19';
      for(const s of [-1,1])ctx.fillRect(ox+(hx+.5+dx*.23+dy*.16*s)*cell-2,oy+(hy+.5+dy*.23+dx*.16*s)*cell-2,4,4);
    }
  };
}
