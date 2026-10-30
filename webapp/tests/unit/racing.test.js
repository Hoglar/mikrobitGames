import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RaceModel } from '../../src/games/micro-racer/model.js';
import { createRacing } from '../../src/games/micro-racer/index.js';
import { createRacingAudio } from '../../src/games/micro-racer/audio.js';
import { cars, STEP, steeringTarget, RADIUS } from '../../src/games/micro-racer/config.js';
import { tracks, validateTrack, closestTrack } from '../../src/games/micro-racer/tracks.js';
import { driveAI } from '../../src/games/micro-racer/ai.js';
import { encodeRace, decodeRace, formatTime, finishingPlace } from '../../src/games/micro-racer/rules.js';
import { gateIntersection, advanceProgress } from '../../src/games/micro-racer/progress.js';
import { updateVelocity, moveCars } from '../../src/games/micro-racer/physics.js';
import { games, registeredGame, formatScore } from '../../src/games/registry.js';
import { createAttempt, finishAttempt } from '../../src/platform/rules.js';
const fixtures=JSON.parse(readFileSync(new URL('./fixtures/racing-traces.json',import.meta.url)));
const emptyTrack={gates:[],walls:[],wallIndex:{size:24,grid:new Map()}};
const physicalCar=(id,x,y,vx=0,vy=0)=>({id,x,y,vx,vy,angle:0,steer:0,finishedMs:null,recoverRemaining:0,contacts:0});

test('MR-01/02/16 all 36 variants have stable unique IDs and exact scoring metadata',()=>{
  const variants=games.filter(game=>game.key==='racing');assert.equal(variants.length,36);assert.equal(new Set(variants.map(g=>g.id)).size,36);
  const published=JSON.parse(readFileSync(new URL('../../spec/games/micro-racer/catalog.json',import.meta.url)));
  assert.deepEqual(variants,published.games);
  for(const track of tracks)for(const format of ['time-trial','race'])for(const laps of [1,3])for(const car of cars){
    const matching=variants.filter(g=>g.config.track===track.id&&g.config.format===format&&g.config.laps===laps&&g.config.car===car.id);assert.equal(matching.length,1);
    const game=matching[0];assert.equal(game.min_value,1);assert.equal(game.max_value,format==='race'?3600000:600000);assert.equal(game.ranking_direction,'lower_is_better');assert.equal(registeredGame({...game,is_active:true}),game);
    const model=new RaceModel(game.config);assert.equal(model.cars.length,format==='race'?4:1);assert.equal(model.config.laps,laps);
  }
  for(const config of [{car:'unknown'},{track:'unknown'},{format:'daily'},{laps:2},{trackVersion:2},{profile:'v2'}])assert.throws(()=>new RaceModel(config),RangeError);
});

test('MR-15 race encoding prioritises place, rejects holes and formats without raw score leakage',()=>{
  for(const [place,time,value] of [[1,83456,83456],[2,70000,1070000],[3,40000,2040000],[4,600000,3600000]]){assert.equal(encodeRace(place,time),value);assert.deepEqual(decodeRace(value),{place,time});}
  for(const value of [null,0,-1,1.5,700000,1000000,1600001,4600000,Number.MAX_SAFE_INTEGER])assert.throws(()=>decodeRace(value));
  assert.ok(encodeRace(1,600000)<encodeRace(2,1));assert.equal(formatTime(83456),'01:23.456');
  const game=games.find(g=>g.score_unit==='racing_rank_v1');assert.equal(formatScore(game,1083456),'2. plass · 01:23.456');
  assert.equal(formatScore(games.find(g=>g.key==='racing'&&g.config.format==='time-trial'),83456),'01:23.456');
});

test('MR-02/09 tracks are finite, their grids are safe and barriers surround both road edges',()=>{
  for(const track of tracks){assert.equal(validateTrack(track),true);assert.equal(track.walls.length,track.points.length*2);assert.ok(track.length>500);assert.equal(track.gates.length,20);
    for(const spawn of track.grid)assert.ok(closestTrack(track,spawn.x,spawn.y).distance<track.width/2-RADIUS);
  }
});

test('MR-03/05 vehicle profiles actually differ and braking takes precedence over throttle',()=>{
  const speeds=[];
  for(const profile of cars){const m=new RaceModel({car:profile.id});for(let i=0;i<120;i++)m.step({throttle:true});speeds.push(Math.hypot(m.player.vx,m.player.vy));}
  assert.ok(speeds[0]<speeds[1]&&speeds[1]<speeds[2]);
  const a=new RaceModel({car:'race'}),b=new RaceModel({car:'race'});
  for(let i=0;i<120;i++){a.step({throttle:true});b.step({throttle:true});}
  for(let i=0;i<120;i++){a.step({throttle:true,brake:true});b.step({brake:true});}
  assert.deepEqual(a.snapshot(),b.snapshot());assert.ok(Math.hypot(a.player.vx,a.player.vy)<.01);
  const sideways=cars.map(profile=>{const m=new RaceModel({car:profile.id});m.player.vx=8;m.player.vy=-10;updateVelocity(m.player,{},profile,m.track,STEP);return m.player.vx;});
  assert.ok(sideways[0]>sideways[1]&&sideways[1]>sideways[2]);
});

test('MR-04 tilt has a continuous dead zone, signed saturation and relative turning',()=>{
  for(const x of [-.08,0,.08])assert.equal(Math.abs(steeringTarget(x)),0);
  assert.equal(steeringTarget(.75),1);assert.equal(steeringTarget(-1),-1);assert.ok(steeringTarget(.1)>0);
  for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2]){
    const m=new RaceModel();m.player.angle=angle;m.player.vx=Math.sin(angle)*10;m.player.vy=-Math.cos(angle)*10;
    const before=angle;updateVelocity(m.player,{steer:1},m.profile,m.track,STEP);
    assert.ok(Math.sin(m.player.angle-before)>0);
  }
});

test('MR-06/17 held controls never arm from countdown, unavailable values or reconnect',()=>{
  let now=0;const engine=createRacing({clock:{now:()=>now}});
  const sample=(b=false,available=true,x=0)=>({inputAvailable:available,tilt:{x,y:0},buttons:{aPressed:false,bPressed:b},touch:{logoPressed:false}});
  engine.input(sample());now=1000;engine.setPlaying(true);
  for(let i=0;i<15;i++){now+=20;engine.input(sample(true));engine.tick(.02);}assert.equal(engine.state.armed,false);assert.equal(Math.hypot(engine.state.cars[0].vx,engine.state.cars[0].vy),0);
  for(let i=0;i<10;i++){now+=20;engine.input(sample());engine.tick(.02);}assert.equal(engine.state.armed,true);
  for(let i=0;i<20;i++){now+=20;engine.input(sample(true));engine.tick(.02);}assert.ok(Math.hypot(engine.state.cars[0].vx,engine.state.cars[0].vy)>1);
  engine.setPlaying(false);const frozen=engine.state;now+=30000;engine.tick(.2);assert.equal(engine.state.time,frozen.time);assert.deepEqual(engine.state.cars,frozen.cars);
  engine.input(sample(false,false));engine.setPlaying(true);now+=20;engine.input(sample(true));engine.tick(.02);assert.equal(engine.state.armed,false);
  engine.dispose();const end=engine.state;engine.tick(.2);assert.deepEqual(engine.state,end);
});

test('MR-10 ordered finite gates reject backward crossings, false starts and shortcuts',()=>{
  const gate={x:0,y:0,tx:0,ty:-1,halfWidth:5};
  assert.equal(gateIntersection(gate,{x:0,y:4},{x:0,y:-4}),.5);
  assert.equal(gateIntersection(gate,{x:0,y:-4},{x:0,y:4}),null);
  assert.equal(gateIntersection(gate,{x:6,y:4},{x:6,y:-4}),null);
  assert.equal(gateIntersection(gate,{x:0,y:0},{x:0,y:-4}),null);
  const track={gates:[gate,{...gate,y:-20}]},car={...new RaceModel().player};
  advanceProgress(car,track,{x:0,y:4},{x:0,y:-4},0,1,1);assert.equal(car.laps,0);assert.equal(car.nextGate,1);
  advanceProgress(car,track,{x:0,y:4},{x:0,y:-4},1,1,1);assert.equal(car.laps,0);
  advanceProgress(car,track,{x:0,y:-16},{x:0,y:-24},2,1,1);assert.equal(car.nextGate,0);
  advanceProgress(car,track,{x:0,y:4},{x:0,y:-4},3,1,1);assert.equal(car.laps,1);assert.equal(car.finishedMs,3500);assert.deepEqual(car.splits,[3500]);
});

test('MR-12 swept barriers and opposing cars cannot tunnel or generate collision energy',()=>{
  const wallTrack={...emptyTrack,walls:[{a:{x:-20,y:0},b:{x:20,y:0}}],wallIndex:{size:24,grid:new Map([['0,0',[0]],['-1,0',[0]]])}};
  const car=physicalCar('player',0,5,0,-1200);moveCars([car],wallTrack,STEP,0,1);assert.ok(car.y>=RADIUS);assert.ok(car.vy>=0);assert.ok(Math.hypot(car.vx,car.vy)<=1200);
  const a=physicalCar('a',-10,10,2400,0),b=physicalCar('b',10,10,-2400,0),energy=a.vx**2+b.vx**2;
  assert.ok(moveCars([a,b],emptyTrack,STEP,0,1)<=4);assert.ok(a.x<b.x);assert.ok(a.vx**2+b.vx**2<=energy+1e-6);
  const c=physicalCar('c',0,0),d=physicalCar('d',0,0);moveCars([c,d],emptyTrack,STEP,0,1);assert.ok(Math.hypot(c.x-d.x,c.y-d.y)>=RADIUS*2-1e-6);
});

test('MR-09/14 recovery waits for a clear spawn and consumes exactly two active seconds',()=>{
  const m=new RaceModel({format:'race'}),p=m.player;const progress={next:p.nextGate,laps:p.laps,gates:p.gatesPassed};
  p.safe={...m.cars[1].safe};m.requestRecovery();m.step({});assert.equal(p.recoverPending,true);
  m.cars[1].x+=10;m.cars[1].y+=10;m.step({});assert.equal(p.recoverPending,false);assert.ok(p.recoverRemaining>1.9);
  for(let i=0;i<239;i++)m.step({});assert.ok(p.recoverRemaining<1e-6);assert.equal(m.elapsedMs,2008);
  assert.deepEqual({next:p.nextGate,laps:p.laps,gates:p.gatesPassed},progress);
});

test('MR-13/14/15 ties, timeout and incomplete attempts obey the contract',()=>{
  const p={id:'player',finishedMs:62000};assert.equal(finishingPlace(p,[p,{id:'a',finishedMs:61000},{id:'b',finishedMs:62000},{id:'c',finishedMs:null}]),2);
  assert.equal(finishingPlace(p,[p,{id:'a',finishedMs:62000}]),1);
  const m=new RaceModel();m.ticks=72000-1;m.step({});assert.equal(m.ended,true);assert.equal(m.completed,false);assert.equal(m.value,null);
  const game=games.find(g=>g.key==='racing'),attempt=finishAttempt(createAttempt({playerId:'owner',game,attemptId:'id'}),'incomplete',m.value);assert.equal(attempt.value,null);
});

for(const fixture of fixtures.traces)test(`MR-02/08/10 frozen trace: ${fixture.config.track}/${fixture.config.car}`,()=>{
  const m=new RaceModel(fixture.config);let offroad=0;
  for(const [steps,steer,buttons] of fixture.runs)for(let i=0;i<steps;i++){m.step({steer:steer/10000,throttle:!!(buttons&1),brake:!!(buttons&2)});offroad+=m.player.offroad?1:0;}
  assert.equal(m.completed,true);assert.equal(m.player.laps,1);assert.equal(m.player.finishedMs,fixture.expected.timeMs);assert.equal(m.ticks,fixture.expected.steps);assert.equal(m.player.contacts,0);assert.equal(offroad,0);
  const snapshot=m.snapshot();m.step({throttle:true});assert.deepEqual(m.snapshot(),snapshot);
});

for(const track of tracks)for(const profile of cars)test(`MR-01/11/12 three-lap pack can finish: ${track.id}/${profile.id}`,()=>{
  const m=new RaceModel({track:track.id,car:profile.id,format:'race',laps:3});let input={};
  for(let i=0;i<72000&&!m.ended;i++){if(i%6===0)input=driveAI(m.player,m.track,m.profile,m.cars);m.step(input);}
  assert.equal(m.completed,true);assert.equal(m.player.laps,3);assert.equal(m.player.splits.length,3);assert.ok(m.maxContacts<=4);assert.ok(m.place>=1&&m.place<=4);assert.ok(m.cars.slice(1).every(car=>car.gatesPassed>40));
});

test('MR-08 rendering cadence does not change a step-based control trace',()=>{
  const fixture=fixtures.traces[0],controls=fixture.runs.flatMap(([steps,steer,bits])=>Array.from({length:steps},()=>({steer:steer/10000,throttle:!!(bits&1),brake:!!(bits&2)})));
  const results=[];
  for(const fps of [30,60,144]){const m=new RaceModel(fixture.config);let accumulator=0,index=0;while(!m.ended&&index<controls.length){accumulator+=1/fps;while(accumulator+1e-9>=STEP&&index<controls.length){accumulator-=STEP;m.step(controls[index++]);}}results.push(m.snapshot());}
  assert.deepEqual(results[0],results[1]);assert.deepEqual(results[1],results[2]);
});

test('MR-22/23 motor audio is opt-in, volume-controlled, bounded and released on pause/disposal',()=>{
  let contexts=0,voices=0,stopped=0,closed=0;
  class FakeAudio {
    constructor(){contexts++;this.state='running';this.currentTime=0;this.destination={};}
    resume(){return Promise.resolve();}
    close(){closed++;this.state='closed';return Promise.resolve();}
    createOscillator(){voices++;return {frequency:{setTargetAtTime(){}},connect(node){return node;},start(){},stop(){stopped++;},disconnect(){}};}
    createGain(){return {gain:{value:0,setTargetAtTime(){}},connect(){return {};},disconnect(){}};}
  }
  const audio=createRacingAudio({AudioContext:FakeAudio});audio.update(10,36,true);assert.equal(contexts,0);
  audio.setEnabled(true);for(let i=0;i<100;i++)audio.update(i%36,36,true);assert.equal(contexts,1);assert.equal(voices,1);
  audio.setVolume(0);assert.equal(stopped,1);audio.update(10,36,true);assert.equal(voices,1);
  audio.setVolume(.5);audio.update(10,36,true);assert.equal(voices,2);audio.update(10,36,false);assert.equal(stopped,2);
  audio.dispose();audio.dispose();audio.update(10,36,true);assert.equal(closed,1);assert.equal(voices,2);
});

test('MR-22 absent/denied audio cannot interrupt gameplay',()=>{
  for(const AudioContext of [null,class{constructor(){throw new Error('Unavailable');}}]){
    const audio=createRacingAudio({AudioContext});assert.doesNotThrow(()=>{audio.setEnabled(true);audio.update(30,36,true);audio.stop();audio.dispose();});
  }
});
