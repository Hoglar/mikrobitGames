import test from 'node:test';
import assert from 'node:assert/strict';
import { TetrisModel } from '../../src/games/tetris/model.js';
import { createTetris } from '../../src/games/tetris/index.js';
import { SevenBag, cellsOf, emptyBoard, holdPixels, levelOf, gravityMs, musicBpm, scoreLock } from '../../src/games/tetris/rules.js';
import { clearLabel } from '../../src/games/tetris/scene.js';
import { games, formatScore, registeredGame } from '../../src/games/registry.js';

const active=(type='T',x=3,y=17,rotation=0)=>({type,x,y,rotation});
const baseInput={inputAvailable:true,tilt:{x:0,y:0},buttons:{aPressed:false,bPressed:false},touch:{logoPressed:false}};
function controller(options={}) {
  let time=0;const game=createTetris({...options,clock:{now:()=>time}});
  const input=(set={})=>game.input({...baseInput,...set});
  const tick=(seconds)=>{time+=seconds*1000;input();game.tick(seconds);};
  input();time=100;input();game.setPlaying(true);
  return {game,input,tick,setTime:n=>{time=n;}};
}

test('TT-01/02 golden bags, bounds, five previews, ghost and pure snapshots',()=>{
  for(const [seed,expected] of [['demo','O Z J L S I T J I S Z L T O Z L J S T O I'],['practice-1','L Z S I O J T T I J Z S L O T L Z I J S O']]){
    const bag=new SevenBag(seed);assert.equal(Array.from({length:21},()=>bag.take()).join(' '),expected);
  }
  const model=new TetrisModel({seed:'demo'});assert.equal(model.active.type,'O');assert.equal(model.snapshot().next.length,5);
  assert.equal(model.board.length,40);assert.ok(model.board.every(row=>row.length===10));
  const queue=[...model.bag.queue],snapshot=model.snapshot();snapshot.board[39][0]='Z';snapshot.active.x=99;
  for(let i=0;i<100;i++)model.snapshot();assert.deepEqual(model.bag.queue,queue);assert.equal(model.board[39][0],null);
  assert.equal(model.ghost().y,18);assert.equal(model.fits({...model.active,x:-2}),false);assert.equal(model.fits({...model.active,y:-22}),false);
  assert.ok(cellsOf(model.ghost()).every(([,y])=>y<20));
});

// Golden matrices and CW offsets transcribed from the versioned rule profile.
const matrices={
  I:['..../IIII/..../....','..I./..I./..I./..I.','..../..../IIII/....','.I../.I../.I../.I..'],
  J:['J../JJJ/...','.JJ/.J./.J.','.../JJJ/..J','.J./.J./JJ.'],
  L:['..L/LLL/...','.L./.L./.LL','.../LLL/L..','LL./.L./.L.'],
  S:['.SS/SS./...','.S./.SS/..S','.../.SS/SS.','S../SS./.S.'],
  T:['.T./TTT/...','.T./.TT/.T.','.../TTT/.T.','.T./TT./.T.'],
  Z:['ZZ./.ZZ/...','..Z/.ZZ/.Z.','.../ZZ./.ZZ','.Z./ZZ./Z..']
};
const golden=(type,r,x,y)=>matrices[type][r].split('/').flatMap((row,dy)=>[...row].flatMap((v,dx)=>v==='.'?[]:[[x+dx,y+dy]]));
const normal=[[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],[[0,0],[1,0],[1,1],[0,-2],[1,-2]],[[0,0],[1,0],[1,-1],[0,2],[1,2]],[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]]];
const long=[[[0,0],[-2,0],[1,0],[-2,1],[1,-2]],[[0,0],[-1,0],[2,0],[-1,-2],[2,1]],[[0,0],[2,0],[-1,0],[2,-1],[-1,2]],[[0,0],[1,0],[-2,0],[1,2],[-2,-1]]];
const inside=([x,y])=>x>=0&&x<10&&y>=-20&&y<20;

test('TT-04 all CW SRS transitions select each reachable kick in order, with golden geometry',()=>{
  let exercised=0;const unreachable=[];
  for(const type of Object.keys(matrices))for(let r=0;r<4;r++)for(let k=0;k<5;k++){
    const offsets=(type==='I'?long:normal)[r];let fixture=null;
    search:for(let y=5;y<20;y++)for(let x=-3;x<10;x++){
      const before=golden(type,r,x,y),[dx,dy]=offsets[k],target=golden(type,(r+1)%4,x+dx,y+dy);
      if(!before.every(inside)||!target.every(inside))continue;
      const protectedCells=new Set([...before,...target].map(p=>p.join(','))),obstacles=new Set();let possible=true;
      for(let prior=0;prior<k;prior++){
        const [px,py]=offsets[prior],candidate=golden(type,(r+1)%4,x+px,y+py);
        if(!candidate.every(inside)||candidate.some(p=>obstacles.has(p.join(','))))continue;
        const blocker=candidate.find(p=>!protectedCells.has(p.join(',')));
        if(!blocker){possible=false;break;}obstacles.add(blocker.join(','));
      }
      if(possible){fixture={x,y,dx,dy,target,obstacles};break search;}
    }
    if(!fixture){unreachable.push(`${type}:${r}:${k+1}`);continue;}
    const m=new TetrisModel(),{x,y,dx,dy,target,obstacles}=fixture;
    m.active=active(type,x,y,r);for(const point of obstacles){const [px,py]=point.split(',').map(Number);m.board[py+20][px]='O';}
    assert.equal(m.rotate(),true,`${type} ${r} ${k}`);assert.equal(m.lastRotation.kick,k);
    assert.deepEqual(m.active,active(type,x+dx,y+dy,(r+1)%4));
    assert.deepEqual(cellsOf(m.active).map(p=>p.join(',')).sort(),target.map(p=>p.join(',')).sort());exercised++;
  }
  // These two T candidates contain every cell distinguishing test 1 from the
  // original footprint: if they fit, test 1 already fits and takes priority.
  assert.deepEqual(unreachable,['T:0:4','T:2:3']);assert.equal(exercised,118);
  const blocked=new TetrisModel();blocked.active=active('T',3,8);const protectedCells=new Set(cellsOf(blocked.active).map(p=>p.join(',')));
  for(let y=3;y<15;y++)for(let x=0;x<10;x++)if(!protectedCells.has([x,y].join(',')))blocked.board[y+20][x]='J';
  blocked.lastRotation={kick:4};const before={...blocked.active};assert.equal(blocked.rotate(),false);assert.deepEqual(blocked.active,before);assert.deepEqual(blocked.lastRotation,{kick:4});
});

test('TT-05/06 hold consumes next only when empty, resets orientation, and drop locks one piece',()=>{
  const m=new TetrisModel({seed:'demo'});const before=m.bag.next();
  m.rotate();assert.equal(m.hold(),true);assert.equal(m.held,'O');assert.equal(m.active.type,before[0]);assert.equal(m.active.rotation,0);
  const queue=m.bag.next();assert.equal(m.hold(),false);assert.deepEqual(m.bag.next(),queue);
  const distance=m.ghost().y-m.active.y;m.hardDrop();assert.equal(m.score,2*distance);assert.equal(m.lockCount,1);assert.equal(m.holdUsed,false);
  const incoming=m.active.type,after=m.bag.next();assert.equal(m.hold(),true);assert.equal(m.active.type,'O');assert.equal(m.held,incoming);assert.deepEqual(m.bag.next(),after);
  assert.equal(m.active.x,3);assert.equal(m.active.y,-1);assert.equal(m.lastRotation,null);
});

test('TT-01 full lock-out, partial hidden lock and hold/spawn collision freeze a single result',()=>{
  const full=new TetrisModel();full.active=active('I',3,-3,0);full.lock();assert.equal(full.ended,true);assert.equal(full.completed,true);
  const score=full.score;full.step(100,{drop:true});assert.equal(full.score,score);assert.equal(full.lockCount,1);
  const partial=new TetrisModel();partial.active=active('T',0,-1);partial.board[21][0]='J';partial.hardDrop();assert.equal(partial.ended,false);
  const blocked=new TetrisModel({initial:{held:'O'}});blocked.board[20][4]='Z';assert.equal(blocked.hold(),true);assert.equal(blocked.ended,true);
});

test('TT-07 grounded delay, fifteen resets, O no-op and immediate zero-distance drop',()=>{
  const m=new TetrisModel({initial:{active:active('O',3,18)}});
  for(let i=0;i<59;i++)m.step(1000/120);assert.equal(m.lockCount,0);m.step(1000/120);assert.equal(m.lockCount,1);
  const reset=new TetrisModel({initial:{active:active('T',3,18)}});
  for(let i=0;i<14;i++){reset.step(1,{move:i%2?-1:1});assert.equal(reset.lockCount,0);}
  reset.step(1,{move:1});assert.equal(reset.lockCount,1);
  const o=new TetrisModel({initial:{active:active('O',3,18)}});o.step(200,{rotate:true});assert.equal(o.resets,0);o.step(299);assert.equal(o.lockCount,0);o.step(1);assert.equal(o.lockCount,1);
  const zero=new TetrisModel({initial:{active:active('O',3,18)}});zero.hardDrop();assert.equal(zero.lockCount,1);assert.equal(zero.score,0);
});

test('TT-07 non-adjacent rows compact stably and clear phase ignores input for exactly 150 ms',()=>{
  const board=emptyBoard();for(const y of [16,18])for(let x=0;x<10;x++)if(x!==3)board[y+20][x]='J';board[39][3]='L';
  const m=new TetrisModel({initial:{board,active:active('I',1,15,1)}});m.hardDrop();
  assert.equal(m.lines,2);assert.equal(m.score,300);assert.equal(m.phase,'clearing');assert.equal(m.active,null);
  assert.equal(m.board[37][3],'I');assert.equal(m.board[38][3],'I');assert.equal(m.board[39][3],'L');
  for(let i=0;i<17;i++)m.step(1000/120,{hold:true,drop:true});assert.equal(m.active,null);
  m.step(1000/120);assert.equal(m.phase,'falling');assert.ok(m.active);assert.equal(m.held,null);assert.equal(m.lockCount,1);
});

function spinFixture({r=0,mini=false,kick=0,lines=0}={}){
  const board=emptyBoard(),p=active('T',3,17,r),corners=[[3,17],[5,17],[5,19],[3,19]],fronts=[[0,1],[1,2],[2,3],[3,0]][r];
  const omit=mini?fronts[0]:[0,1,2,3].find(n=>!fronts.includes(n));
  corners.forEach(([x,y],i)=>{if(i!==omit)board[y+20][x]='J';});
  const occupied=new Set(golden('T',r,3,17).map(p=>p.join(',')));
  if(lines){board[36][0]='S';for(const y of (lines===1?[18]:lines===2?[17,18]:[17,18,19]))for(let x=0;x<10;x++)if(!occupied.has([x,y].join(',')))board[y+20][x]='L';}
  return new TetrisModel({initial:{board,active:p,lastRotation:{kick}}});
}
test('TT-08 T-spin full/Mini, front corners, kick 5 and movement-history rules',()=>{
  for(let r=0;r<4;r++)for(const mini of [false,true]){
    const m=spinFixture({r,mini});assert.equal(m.spin(0),mini?'mini':'full');
    m.lastRotation.kick=4;assert.equal(m.spin(0),'full');
    m.lastRotation=null;assert.equal(m.spin(0),null);
  }
  for(const [lines,r,base]of [[1,0,800],[2,1,1200],[3,1,1600]]){
    const m=spinFixture({r,lines});m.lock();assert.equal(m.lastResult.spin,'full');assert.equal(m.lines,lines);assert.equal(m.lastResult.clearPoints,base);
  }
  const failed=spinFixture();assert.equal(failed.translate(-1,0),false);assert.equal(failed.spin(0),'full');failed.hardDrop();assert.equal(failed.lastResult.spin,'full');
  const moved=new TetrisModel({initial:{active:active('T',3,8),lastRotation:{kick:0}}});assert.equal(moved.translate(0,1),true);assert.equal(moved.lastRotation,null);
});

test('TT-09/10 score golden vectors, chain transitions, effect classes and progression',()=>{
  const score=(params)=>scoreLock({level:1,...params});
  assert.equal(score({lines:1}).total,100);assert.equal(score({lines:4,dropDistance:20}).total,840);
  assert.equal(score({lines:4,backToBack:true,combo:0,dropDistance:18}).total,1286);
  assert.equal(score({lines:2,spin:'full',level:3,backToBack:true,combo:1}).total,5700);
  assert.equal(score({lines:4,perfect:true}).total,2800);assert.equal(score({lines:4,perfect:true,backToBack:true,combo:0}).total,4450);
  for(const [spin,bases]of [[null,[0,100,300,500,800]],['mini',[100,200,400]],['full',[400,800,1200,1600]]])
    bases.forEach((base,lines)=>assert.equal(score({lines,spin,level:3}).total,base*3));
  const none=score({lines:0,spin:'full',backToBack:true,combo:4});assert.equal(none.combo,-1);assert.equal(none.backToBack,true);assert.equal(none.b2bBonus,false);
  assert.equal(score({lines:2,backToBack:true}).backToBack,false);
  assert.deepEqual([1,2,3,4].map(lines=>score({lines,dropDistance:30}).effectClass),[1,2,3,4]);assert.equal(score({lines:1,perfect:true}).effectClass,5);
  assert.deepEqual([0,4999,5000,35000,69999,70000,1e9].map(levelOf),[1,1,2,8,14,15,15]);
  assert.deepEqual([1,8,15].map(gravityMs),[1000,224,50]);assert.deepEqual([1,8,15].map(musicBpm),[90,135,180]);
  assert.match(clearLabel(score({lines:2,spin:'full',backToBack:true,combo:1})),/T-SPIN DOUBLE.*B2B.*COMBO 2/);
});

test('TT-10/18 old level scores the lock, next piece uses new level; overflow is incomplete',()=>{
  const m=spinFixture({lines:1});m.score=4999;m.lastRotation=null;m.lock();assert.equal(m.score,5099);assert.equal(m.snapshot().level,2);
  const over=spinFixture();over.score=Number.MAX_SAFE_INTEGER-1;over.lock();assert.equal(over.score,Number.MAX_SAFE_INTEGER-1);assert.equal(over.completed,false);assert.equal(over.ended,true);
  const g=games.find(g=>g.key==='tetris');assert.ok(g);assert.equal(registeredGame(g),g);assert.match(formatScore(g,1234),/poeng$/);
});

test('TT-03/05/16 controller neutral arming, hysteresis, DAS and coalesced rotation-before-drop',()=>{
  const c=controller({seed:'demo'});assert.equal(c.game.state.armed,true);
  c.input({tilt:{x:.22,y:0}});c.game.tick(1/120);assert.equal(c.game.state.active.x,4);
  for(let i=0;i<19;i++)c.game.tick(1/120);assert.equal(c.game.state.active.x,4);
  c.game.tick(2/120);assert.equal(c.game.state.active.x,5);
  c.input({tilt:{x:-.15,y:0}});c.game.tick(1/120);assert.equal(c.game.state.active.x,5);
  c.input({tilt:{x:-.22,y:0}});c.game.tick(1/120);assert.equal(c.game.state.active.x,4);
  c.game.press({input:'a',count:99});c.game.press({input:'b',count:99});c.game.press({input:'a'});c.game.tick(1/120);
  assert.equal(c.game.state.lastResult.id,1);
  const frozen=c.game.state;c.game.setPlaying(false);c.game.tick(.25);assert.deepEqual(c.game.state.board,frozen.board);
  c.setTime(1000);c.input({buttons:{aPressed:true,bPressed:false}});c.game.setPlaying(true);assert.equal(c.game.state.armed,false);
  c.input();c.setTime(1100);c.input();assert.equal(c.game.state.armed,true);
  c.game.dispose();
});

test('TT-13 canonical hold images use the specified five-by-five orientation',()=>{
  const expected={I:'0000000000999900000000000',J:'0000009000099900000000000',L:'0000000090099900000000000',O:'0000009900099000000000000',S:'0000000990099000000000000',T:'0000000900099900000000000',Z:'0000009900009900000000000'};
  for(const [type,bits]of Object.entries(expected))assert.equal(holdPixels(type).join(''),bits,type);
  assert.deepEqual(holdPixels(null),Array(25).fill(0));
});

test('TT-05 simultaneous hold/rotation/drop operates on one incoming piece, without historical extra drops',()=>{
  const c=controller({initial:{active:active('T',3,10),held:'I'}});
  c.game.press({input:'a',count:20});c.game.press({input:'b',count:20});c.game.press({input:'logo',count:20});
  c.game.tick(1/120);const state=c.game.state;
  assert.equal(state.held,'T');assert.equal(state.lastResult.id,1);assert.equal(state.score,34);
  const blocks=[];state.board.forEach((row,y)=>row.forEach((type,x)=>{if(type)blocks.push([x,y-20,type]);}));
  assert.deepEqual(blocks,[[5,16,'I'],[5,17,'I'],[5,18,'I'],[5,19,'I']]);
  c.game.tick(1/120);assert.equal(c.game.state.lastResult.id,1);c.game.dispose();
});

test('TT-20 identical fixed-step input at 30/60/144 Hz gives the same board/score',()=>{
  const snapshots=[];
  for(const rate of [30,60,144]){
    const c=controller({seed:'frame-invariance'});
    for(let second=0;second<5;second++){
      c.game.press({input:second%2?'b':'logo'});
      for(let frame=0;frame<rate;frame++)c.tick(1/rate);
      c.game.press({input:'a'});for(let frame=0;frame<rate;frame++)c.tick(1/rate);
    }
    const s=c.game.state;snapshots.push({board:s.board,score:s.score,held:s.held,next:s.next,active:s.active});c.game.dispose();
  }
  assert.deepEqual(snapshots[0],snapshots[1]);assert.deepEqual(snapshots[1],snapshots[2]);
});
