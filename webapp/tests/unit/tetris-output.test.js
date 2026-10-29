import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeviceOutput, melodyBar, MUSIC } from '../../src/games/tetris/device-output.js';
import { createTetrisAudio } from '../../src/games/tetris/audio.js';
import { createTetris } from '../../src/games/tetris/index.js';
import { emptyBoard } from '../../src/games/tetris/rules.js';
import { FakeClock, flush } from '../microbit-input/support/fakes.js';
import { deferred } from '../../src/microbit-input/errors.js';

function device(options={}) {
  const clock=new FakeClock(),calls=[],errors=[];
  const invoke=(type,value)=>{calls.push({type,value,at:clock.now()});return options[type]?.(value) ?? Promise.resolve();};
  const outputs={display:{showImage:p=>invoke('image',p),clear:()=>invoke('clear')},speaker:{playMelody:p=>invoke('melody',p),stop:()=>invoke('stop')}};
  return {clock,calls,errors,outputs,device:createDeviceOutput({outputs,clock,report:e=>errors.push(e)})};
}

test('TT-14 all eight bars preserve four beats and remain within wire limits at every level',()=>{
  assert.equal(MUSIC.length,8);
  for(let level=1;level<=15;level++)for(let bar=0;bar<8;bar++){
    assert.equal(MUSIC[bar].reduce((s,n)=>s+n[1],0),4);
    const notes=melodyBar(bar,level);assert.ok(notes.length>=4&&notes.length<=16);
    assert.ok(notes.reduce((s,n)=>s+n.durationMs,0)<=10000);
    assert.ok(notes.every(n=>Number.isInteger(n.frequencyHz)&&Number.isInteger(n.durationMs)&&n.durationMs>0&&(n.frequencyHz===0||n.frequencyHz>=20&&n.frequencyHz<=9999)));
  }
  assert.deepEqual(melodyBar(0,1).slice(0,3),[{frequencyHz:659,durationMs:667},{frequencyHz:494,durationMs:333},{frequencyHz:523,durationMs:333}]);
  assert.equal(melodyBar(3,15).at(-1).frequencyHz,0);
});

test('TT-14 ACK starts a duration timer, not the next bar; tempo changes at the following boundary',async()=>{
  const ack=deferred(),h=device({melody:()=>h.calls.filter(c=>c.type==='melody').length===1?ack.promise:Promise.resolve()});
  h.device.setPlaying(true);await flush();await h.clock.tick(5000);
  assert.equal(h.calls.filter(c=>c.type==='melody').length,1);assert.equal(h.clock.jobs.size,0);
  ack.resolve();await flush();const duration=melodyBar(0,1).reduce((s,n)=>s+n.durationMs,0);
  h.device.setLevel(15);await h.clock.tick(duration-1);assert.equal(h.calls.filter(c=>c.type==='melody').length,1);
  await h.clock.tick(1);const played=h.calls.filter(c=>c.type==='melody');assert.equal(played.length,2);assert.deepEqual(played[1].value.notes,melodyBar(1,15));
  h.device.setPlaying(false);await flush();assert.equal(h.clock.jobs.size,0);assert.equal(h.calls.at(-1).type,'stop');
  const count=h.calls.length;await h.clock.tick(10000);assert.equal(h.calls.length,count);
});

test('TT-13 hold images coalesce during writes and obsolete recovery acknowledgements cannot confirm a new image',async()=>{
  const ack=deferred(),h=device({image:()=>h.calls.filter(c=>c.type==='image').length===1?ack.promise:Promise.resolve()});
  h.device.hold('T');h.device.hold('I');h.device.hold('O');assert.equal(h.calls.length,1);
  h.device.hold('O',true);ack.resolve();await flush();
  assert.equal(h.calls.length,2);assert.equal(h.calls[1].value.join(''),'0000009900099000000000000');assert.equal(h.device.status.display,'confirmed');
  h.device.end();await flush();assert.equal(h.calls.at(-1).type,'clear');h.device.dispose();
});

test('TT-14/16 pause/mute stops promptly, resumes the interrupted bar and fences a late melody ACK',async()=>{
  const ack=deferred(),h=device({melody:()=>h.calls.filter(c=>c.type==='melody').length===1?ack.promise:Promise.resolve()});
  h.device.setPlaying(true);h.device.setPlaying(false);h.device.setPlaying(true);
  assert.equal(h.calls.filter(c=>c.type==='stop').length,1);await flush();assert.equal(h.calls.filter(c=>c.type==='melody').length,1);
  ack.resolve();await flush();assert.equal(h.calls.filter(c=>c.type==='melody').length,2);assert.equal(h.device.status.bar,0);
  h.device.configure({musicVolume:0});await flush();assert.equal(h.clock.jobs.size,0);assert.equal(h.device.status.music,'off');
  h.device.configure({musicVolume:96});await flush();assert.equal(h.calls.filter(c=>c.type==='melody').length,3);
  h.device.dispose();await flush();assert.equal(h.clock.jobs.size,0);const count=h.calls.length;await h.clock.tick(20000);assert.equal(h.calls.length,count);
});

test('TT-19 output failures stop automatic retries, stay bounded and allow explicit recovery',async()=>{
  let fail=true;const h=device({melody:()=>fail?Promise.reject(new Error('injected')):Promise.resolve(),image:()=>fail?Promise.reject(new Error('image failed')):Promise.resolve()});
  h.device.hold('J');h.device.setPlaying(true);await flush();assert.equal(h.device.status.music,'error');assert.equal(h.device.status.display,'error');
  const count=h.calls.length;h.device.setPlaying(true);h.device.hold('T');await h.clock.tick(10000);assert.equal(h.calls.length,count);
  fail=false;h.device.setPlaying(false);h.device.setPlaying(true);await flush();assert.equal(h.device.status.display,'confirmed');assert.equal(h.device.status.music,'playing');
  assert.equal(h.errors.length,2);h.device.dispose();await flush();assert.equal(h.clock.jobs.size,0);
});

test('TT-14/20 many loops/holds never exceed one timer or two normal calls; disposal clears ownership',async()=>{
  const h=device();h.device.hold(null);h.device.setPlaying(true);await flush();
  for(let i=0;i<80;i++){
    h.device.hold(['I','J','L','O','S','T','Z'][i%7]);h.device.setLevel(Math.min(15,i+1));await flush();
    assert.ok(h.device.status.pending<=2);assert.equal(h.clock.jobs.size,1);await h.clock.tick(2700);
  }
  assert.ok(h.calls.filter(c=>c.type==='melody').length>80);h.device.dispose();await flush();assert.equal(h.clock.jobs.size,0);
});

function audioContext(){
  const context={state:'suspended',currentTime:0,destination:{},started:[],stopped:0,closed:0,
    resume(){this.state='running';return Promise.resolve();},close(){this.closed++;this.state='closed';return Promise.resolve();},
    createGain(){return{gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};},
    createOscillator(){const source={type:'',frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){},
      start(){context.started.push(source);},stop(){context.stopped++;},onended:null};return source;}
  };return context;
}
test('TT-15 browser effects are lazy, bounded, independently muted, and isolated across round tokens',async()=>{
  const context=audioContext();let created=0;const audio=createTetrisAudio({createContext:()=>{created++;return context;}}),old=audio.beginRound();
  old.play({type:'drop'});assert.equal(created,0);audio.unlock();await flush();assert.equal(created,1);
  for(let i=0;i<20;i++)old.play({type:'lock',result:{lines:4,effectClass:5}});assert.equal(audio.activeVoices,8);
  const next=audio.beginRound();assert.equal(audio.activeVoices,0);next.play({type:'rotate'});assert.equal(audio.activeVoices,1);
  old.dispose();old.stop();old.play({type:'drop'});assert.equal(audio.activeVoices,1);
  audio.configure({effectsEnabled:false});assert.equal(audio.activeVoices,0);assert.equal(audio.status,'off');
  audio.configure({effectsEnabled:true,effectsVolume:.5});await flush();next.play({type:'drop'});assert.equal(audio.activeVoices,1);
  context.started.at(-1).onended();assert.equal(audio.activeVoices,0);audio.dispose();audio.dispose();assert.equal(context.closed,1);
});

test('TT-15 unavailable or denied audio does not throw or create voices',async()=>{
  for(const createContext of [()=>null,()=>{throw new Error('blocked');},()=>({...audioContext(),resume:()=>Promise.reject(new Error('denied'))})]){
    const audio=createTetrisAudio({createContext});audio.unlock();await flush();assert.equal(audio.status,'unavailable');
    audio.beginRound().play({type:'drop'});assert.equal(audio.activeVoices,0);audio.dispose();
  }
});

test('TT-19 game disposal fences late display/music promises and never mutates a frozen result',async()=>{
  const pending=deferred(),clock=new FakeClock(),calls=[];
  const outputs={display:{clear:()=>pending.promise,showImage:()=>{calls.push('image');return pending.promise;}},
    speaker:{playMelody:()=>{calls.push('melody');return pending.promise;},stop:()=>{calls.push('stop');return Promise.resolve();}}};
  const game=createTetris({outputs,clock,outputClock:clock});game.setPlaying(true);game.dispose();const score=game.value;
  pending.resolve();await flush();await clock.tick(20000);assert.equal(game.value,score);assert.equal(clock.jobs.size,0);assert.deepEqual(calls,['melody','stop']);
});

test('TT-01/13/16 hold top-out and explicit round completion clear the display; pause preserves hold',async()=>{
  const input={inputAvailable:true,tilt:{x:0},buttons:{aPressed:false,bPressed:false},touch:{logoPressed:false}};
  for(const blocked of [false,true]){
    const h=device(),board=emptyBoard();if(blocked)board[20][4]='Z';
    const game=createTetris({outputs:h.outputs,clock:h.clock,outputClock:h.clock,
      initial:{board,held:blocked?'O':'T',active:{type:'I',x:3,y:5,rotation:0}}});
    game.input(input);await h.clock.tick(100);game.input(input);game.setPlaying(true);await flush();
    if(blocked){game.press({input:'logo'});game.tick(1/120);assert.equal(game.ended,true);}
    else {
      game.setPlaying(false);await flush();assert.equal(h.calls.filter(c=>c.type==='clear').length,0);
      game.finishRound();game.finishRound();game.setPlaying(true);
    }
    await flush();assert.equal(h.calls.at(-1).type,'clear');assert.equal(h.clock.jobs.size,0);
    const count=h.calls.length;await h.clock.tick(20000);assert.equal(h.calls.length,count);game.dispose();
  }
});
