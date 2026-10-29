import { TetrisModel } from './model.js';
import { levelOf } from './rules.js';
import { createDeviceOutput } from './device-output.js';
import { drawTetris } from './scene.js';

const STEP=1000/120;
export function createTetris({ seed='tetris', outputs, browserAudio, reportOutputError=()=>{}, clock={now:()=>performance.now()},
  outputClock, reducedMotion=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false, initial }={}) {
  const model=new TetrisModel({seed,initial}),device=createDeviceOutput({outputs,clock:outputClock,report:reportOutputError});
  const effects=browserAudio?.beginRound();
  let playing=false,disposed=false,finished=false,remainder=0,pending={},latest=null,lastInput=-Infinity,neutralSince=null,armed=false;
  let direction=0,nextMove=0,pieceId=model.pieceId,particles=[];
  const report=e=>{try{reportOutputError(e);}catch{}};
  function release(){pending={};armed=false;direction=0;nextMove=0;}
  function finishRound(){if(finished||disposed)return;finished=true;playing=false;release();effects?.stop();device.end();}
  function arm(){if(!armed && latest && clock.now()-lastInput<=100 && neutralSince!==null && clock.now()-neutralSince>=100)armed=true;}
  function moveDirection(x){
    if(direction<0 && x>=-.12 || direction>0 && x<=.12)direction=0;
    if(x<=-.22)return -1;if(x>=.22)return 1;return direction;
  }
  function consume(events){
    for(const event of events){
      try{effects?.play(event);}catch(e){report(e);}
      if(event.type==='hold')device.hold(event.held);
      if(event.type==='lock'){
        device.setLevel(levelOf(model.score));
        const r=event.result;
        if(r.lines && !reducedMotion()){
          const count=[0,20,40,70,110,150][r.effectClass],life=[0,180,240,320,400,500][r.effectClass];
          for(let i=0;i<count;i++){
            const n=(Math.imul(r.id*131+i+1,2654435761)>>>0)/4294967296;
            particles.push({x:(i+.5)/count,y:(r.rows.filter(y=>y>=0).at(-1)??19)/20,vx:(n-.5)*.65,vy:-.15-n*.25,
              at:model.time,life,size:2+Math.floor(n*4),color:['#d9f0a8','#43d9e6','#c67aff'][i%3]});
          }
          particles=particles.slice(-150);
        }
      }
      if(event.type==='end')finishRound();
    }
  }
  device.hold(model.held);device.setLevel(levelOf(model.score));
  return {
    input(state){
      if(disposed)return;
      const now=clock.now();
      if(!state.inputAvailable){latest=null;neutralSince=null;release();return;}
      if(now-lastInput>100)neutralSince=null;
      latest=state;lastInput=now;
      const neutral=Math.abs(state.tilt.x)<=.12 && !state.buttons.aPressed && !state.buttons.bPressed && !state.touch.logoPressed;
      if(!neutral)neutralSince=null;else neutralSince??=now;
      if(playing)arm();
    },
    press({input,count=1}){if(!disposed && playing && armed && model.phase==='falling' && count>0){
      const action={a:'drop',b:'rotate',logo:'hold'}[input];if(action)pending[action]=true;
    }},
    releaseControls:release,
    finishRound,
    setPlaying(value){
      value=!!value && !model.ended && !finished && !disposed;
      if(playing===value)return;
      playing=value;if(!playing){release();effects?.stop();}else arm();device.setPlaying(value);
    },
    setAudioSettings(settings){device.configure(settings);},
    get outputStatus(){return device.status;},
    tick(seconds){
      if(!playing || disposed || !Number.isFinite(seconds) || seconds<0 || seconds>.25)return;
      remainder+=seconds*1000;
      while(remainder+1e-7>=STEP && !model.ended){
        remainder-=STEP;arm();
        if(pieceId!==model.pieceId || pending.hold && !model.holdUsed){pieceId=model.pieceId;direction=0;nextMove=0;}
        const actions=pending;pending={};
        if(!armed || model.phase!=='falling'){actions.hold=actions.rotate=actions.drop=false;direction=0;}
        else {
          const oldDirection=direction,desired=moveDirection(latest?.tilt.x??0);
          if(desired!==oldDirection){direction=desired;if(desired){actions.move=direction;nextMove=model.time+170;}}
          else if(desired && model.time+1e-7>=nextMove){actions.move=desired;nextMove+=70;}
        }
        consume(model.step(STEP,actions));
        particles=particles.filter(p=>model.time-p.at<p.life);
      }
    },
    draw(ctx,w,h){drawTetris(ctx,w,h,model.snapshot(),{particles,reducedMotion:reducedMotion(),armed});},
    get state(){return {...model.snapshot(),armed,particles:particles.length,outputStatus:device.status};},
    get ended(){return model.ended;},get completed(){return model.completed;},get value(){return model.score;},
    get label(){return `${model.score.toLocaleString('nb-NO')} poeng · Nivå ${levelOf(model.score)} · ${model.lines} linjer`;},
    get resultText(){return model.reason;},
    dispose(){if(disposed)return;disposed=true;playing=false;release();particles=[];device.dispose();effects?.dispose();}
  };
}
