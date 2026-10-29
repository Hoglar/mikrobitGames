import { COLORS, cellsOf, localCells } from './rules.js';

export function clearLabel(r) {
  if(!r)return '';
  const name=r.spin ? `${r.spin==='mini'?'MINI ':''}T-SPIN${r.lines?' '+['','SINGLE','DOUBLE','TRIPLE'][r.lines]:''}` : ['','SINGLE','DOUBLE','TRIPLE','TETRIS'][r.lines];
  return [name,r.b2bBonus?'B2B':'',r.combo>0?`COMBO ${r.combo}`:'',r.perfect?'PERFECT CLEAR':''].filter(Boolean).join(' · ');
}

/** Stateless renderer: world dimensions, score and RNG never depend on Canvas. */
export function drawTetris(ctx,w,h,state,{particles=[],reducedMotion=false,armed=false}={}) {
  const portrait=w/h<1,base=portrait?360:960,scale=w/base,H=h/scale;
  ctx.save();ctx.scale(scale,scale);
  ctx.fillStyle='#101522';ctx.fillRect(0,0,base,H);
  const cell=Math.min(portrait?24:30,(H-(portrait?178:76))/20);
  const ox=portrait?14:(base-cell*10)/2,oy=portrait?128:38,bw=cell*10,bh=cell*20;
  const r=state.lastResult,age=r?state.time-r.at:Infinity;
  const effectLife=[0,180,240,320,400,500][r?.effectClass??0];
  const shake=!reducedMotion && age<effectLife && r?.lines ? [0,0,1,2,4,6][r.effectClass]*(1-age/effectLife) : 0;
  function text(value,x,y,size=14,color='#dce5f4',align='left') {
    ctx.font=`${size>=20?'bold ':''}${size}px ui-monospace, monospace`;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(String(value),x,y);
  }
  function block(x,y,size,color,ghost=false){
    if(ghost){ctx.strokeStyle='#8195b2';ctx.lineWidth=1.5;ctx.strokeRect(x+2,y+2,size-4,size-4);return;}
    ctx.fillStyle=color;ctx.fillRect(x+1,y+1,size-2,size-2);
    ctx.fillStyle='#ffffff45';ctx.fillRect(x+2,y+2,size-4,Math.max(2,size*.12));
    ctx.fillStyle='#00000030';ctx.fillRect(x+2,y+size-size*.16,size-4,size*.12);
  }
  function preview(type,x,y,size){
    if(!type)return;
    const cells=localCells(type),minX=Math.min(...cells.map(p=>p[0])),minY=Math.min(...cells.map(p=>p[1]));
    for(const [px,py]of cells)block(x+(px-minX)*size,y+(py-minY)*size,size,COLORS[type]);
  }
  if(portrait){
    text('MICRO TETRIS',14,25,18,'#d9f0a8');text(`${state.score.toLocaleString('nb-NO')} POENG`,14,49,15);
    text(`NIVÅ ${state.level} · ${state.lines} LINJER`,14,70,12);
    text('HOLD'+(state.holdUsed?' · LÅST':''),14,93,10,'#a0afc5');preview(state.held,118,80,13);
    text(state.held??'—',101,106,12,state.held?COLORS[state.held]:'#a0afc5');
  }else{
    text('MICRO',36,65,26,'#d9f0a8');text('TETRIS',36,101,36);
    text('POENG',36,151,12,'#a0afc5');text(state.score.toLocaleString('nb-NO'),36,185,28);
    text(`NIVÅ ${state.level}`,36,225,20);text(`${state.lines} LINJER`,36,254,14,'#a0afc5');
    text('HOLD'+(state.holdUsed?' · LÅST':''),36,319,13,'#a0afc5');preview(state.held,36,342,24);
    text(state.held??'—',156,363,20,state.held?COLORS[state.held]:'#a0afc5');
    text(state.level===15?'MAKSFART':`NESTE: ${(state.level*5000).toLocaleString('nb-NO')}`,36,440,12,'#d9f0a8');
    text('TILT ← →',36,494,13);text('B: ROTER',36,519,13);text('A: HARD DROP',36,544,13);text('LOGO: HOLD',36,569,13);
  }
  const nx=ox+bw+(portrait?14:46);
  text('NESTE',nx,oy+10,portrait?11:14,'#a0afc5');
  state.next.forEach((type,i)=>{const py=oy+28+i*(portrait?69:91);text(type,nx,py+11,11,COLORS[type]);preview(type,nx,py+18,portrait?14:20);});
  ctx.save();ctx.translate(shake*Math.sin(age*.12),shake*Math.cos(age*.09));
  ctx.fillStyle='#070c15';ctx.fillRect(ox,oy,bw,bh);ctx.strokeStyle='#2a364b';ctx.lineWidth=1;
  for(let x=0;x<=10;x++){ctx.beginPath();ctx.moveTo(ox+x*cell,oy);ctx.lineTo(ox+x*cell,oy+bh);ctx.stroke();}
  for(let y=0;y<=20;y++){ctx.beginPath();ctx.moveTo(ox,oy+y*cell);ctx.lineTo(ox+bw,oy+y*cell);ctx.stroke();}
  ctx.save();ctx.beginPath();ctx.rect(ox,oy,bw,bh);ctx.clip();
  for(let y=0;y<20;y++)for(let x=0;x<10;x++){const type=state.board[y+20][x];if(type)block(ox+x*cell,oy+y*cell,cell,COLORS[type]);}
  if(!state.ended && state.ghost)for(const [x,y]of cellsOf(state.ghost))block(ox+x*cell,oy+y*cell,cell,COLORS[state.ghost.type],true);
  if(state.active)for(const [x,y]of cellsOf(state.active))block(ox+x*cell,oy+y*cell,cell,COLORS[state.active.type]);
  if(!reducedMotion && r?.lines && age<150){ctx.fillStyle=`rgba(217,240,168,${.5*(1-age/150)})`;for(const row of r.rows)if(row>=0)ctx.fillRect(ox,oy+row*cell,bw,cell);}
  if(!reducedMotion)for(const p of particles){const t=(state.time-p.at)/p.life;if(t<0||t>=1)continue;ctx.globalAlpha=1-t;ctx.fillStyle=p.color;
    ctx.fillRect(ox+(p.x+p.vx*t)*bw,oy+(p.y+p.vy*t+t*t*.3)*bh,p.size,p.size);}
  ctx.globalAlpha=1;ctx.restore();ctx.restore();
  if(reducedMotion && r?.lines && age<effectLife){ctx.strokeStyle='#d9f0a8';ctx.lineWidth=2;ctx.strokeRect(ox,oy,bw,bh);}
  const caption=age<1200 && (r?.lines||r?.spin) ? `${clearLabel(r)} +${r.total.toLocaleString('nb-NO')}` :
    !armed && !state.ended ? 'Hold tilt, A/B og logo nøytrale' : state.backToBack ? 'BACK-TO-BACK KLAR' : state.level===15?'MAKSFART':'';
  text(caption,ox,oy+bh+25,portrait?10:13,'#d9f0a8');
  if(portrait)text(state.level===15?'MAKSFART':`Neste nivå: ${state.level*5000} poeng`,14,H-12,11,'#a0afc5');
  ctx.restore();
}
