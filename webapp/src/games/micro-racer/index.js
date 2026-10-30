import { RaceModel } from './model.js';
import { STEP, steeringTarget } from './config.js';
import { formatTime } from './rules.js';
import { drawRacing } from './scene.js';

export function createRacing({config={},browserAudio,clock={now:()=>performance.now()}}={}){
  const model=new RaceModel(config);
  let playing=false,disposed=false,finished=false,remainder=0,latest=null,lastInput=-Infinity,neutralSince=null,armed=false,hasPlayed=false;
  function release(){armed=false;neutralSince=null;latest=null;lastInput=-Infinity;model.player.steer=0;}
  function stop(){playing=false;release();browserAudio?.stop();}
  function arm(){if(!armed&&neutralSince!==null&&clock.now()-neutralSince>=100&&clock.now()-lastInput<=100)armed=true;}
  return {
    input(state){
      if(disposed)return;
      if(!state.inputAvailable){release();return;}
      const now=clock.now();if(now-lastInput>100)neutralSince=null;latest=state;lastInput=now;
      if(!playing){neutralSince=null;return;}
      const neutral=Math.abs(state.tilt.x)<=.08&&!state.buttons.aPressed&&!state.buttons.bPressed&&!state.touch.logoPressed;
      if(!neutral)neutralSince=null;else neutralSince??=now;
      arm();
    },
    press(){},
    releaseControls:release,
    setPlaying(value){const next=!!value&&!model.ended&&!finished&&!disposed;if(next===playing)return;playing=next;if(playing){hasPlayed=true;release();}else{release();browserAudio?.stop();}},
    requestRecovery(){if(disposed||finished||model.ended)return;model.requestRecovery();release();},
    finishRound(){finished=true;stop();},
    tick(seconds){
      if(!playing||disposed||!Number.isFinite(seconds)||seconds<0||seconds>.25)return;
      remainder+=seconds;
      while(remainder+1e-9>=STEP&&!model.ended){
        remainder-=STEP;arm();
        const recovering=model.player.recoverPending||model.player.recoverRemaining>0;
        if(recovering){armed=false;neutralSince=null;}
        const usable=armed&&latest&&clock.now()-lastInput<=100;
        const control=usable?{steer:steeringTarget(latest.tilt.x),throttle:latest.buttons.bPressed,brake:latest.buttons.aPressed}:{};
        model.step(control);
      }
      const p=model.player;browserAudio?.update(Math.hypot(p.vx,p.vy),model.profile.topSpeed,playing&&!model.ended);
      if(model.ended){finished=true;stop();}
    },
    draw(ctx,width,height){drawRacing(ctx,model,width,height,{preview:!hasPlayed,armed});},
    get state(){return {...model.snapshot(),armed,playing};},
    get ended(){return model.ended;},
    get completed(){return model.completed;},
    get value(){return model.value;},
    get accessibleStatus(){const p=model.player;return `Fart: ${Math.round(Math.hypot(p.vx,p.vy)*3.6)} km/t. Runde ${Math.min(p.laps+1,model.config.laps)} av ${model.config.laps}. ${model.config.format==='race'?`Plass ${model.place??model.livePlace} av 4. `:''}Ratt: ${p.steer>.05?'høyre':p.steer<-.05?'venstre':'nøytralt'}. ${p.recoverPending||p.recoverRemaining>0?'Tilbake til banen.':armed?'Kontroller klare.':'Slipp A/B og hold kontrolleren rett.'}`;},
    get label(){return `${formatTime(model.player.finishedMs??model.elapsedMs)} · Runde ${Math.min(model.player.laps+1,model.config.laps)}/${model.config.laps}${model.config.format==='race'?` · ${model.place??model.livePlace}. plass`:''}`;},
    get resultText(){
      if(!model.completed)return model.reason||'Løpet er ikke fullført. Prøv igjen.';
      const splits=model.player.splits.map((time,i)=>`Runde ${i+1}: ${formatTime(time)}`).join(' · ');
      return `${model.config.format==='race'?`${model.place}. plass · `:''}Totalt ${formatTime(model.player.finishedMs)}. ${splits}`;
    },
    dispose(){if(disposed)return;disposed=true;stop();}
  };
}
