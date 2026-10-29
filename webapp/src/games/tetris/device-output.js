import { holdPixels, musicBpm } from './rules.js';

// Project transcription: eight four-beat bars of the Korobeiniki main melody.
export const MUSIC = [
  [[76,1],[71,.5],[72,.5],[74,1],[72,.5],[71,.5]],
  [[69,1],[69,.5],[72,.5],[76,1],[74,.5],[72,.5]],
  [[71,1.5],[72,.5],[74,1],[76,1]], [[72,1],[69,1],[69,1],[null,1]],
  [[74,1.5],[77,.5],[81,1],[79,.5],[77,.5]],
  [[76,1.5],[72,.5],[76,1],[74,.5],[72,.5]],
  [[71,1],[71,.5],[72,.5],[74,1],[76,1]], [[72,1],[69,1],[69,1],[null,1]]
].map(bar=>Object.freeze(bar.map(note=>Object.freeze(note))));
export const melodyBar = (index,level) => MUSIC[index].map(([midi,beats])=>({
  frequencyHz:midi===null ? 0 : Math.round(440*2**((midi-69)/12)), durationMs:Math.round(beats*60000/musicBpm(level))
}));
const systemClock={now:()=>performance.now(),setTimeout:(f,ms)=>setTimeout(f,ms),clearTimeout:id=>clearTimeout(id)};

/** Owns at most one melody and one display call, plus STOP when interrupted. */
export function createDeviceOutput({ outputs, clock = systemClock, report = () => {} } = {}) {
  let disposed=false, playing=false, enabled=true, volume=96, level=1, bar=0, generation=0;
  let musicPending=null, stopPending=null, timer=null, audible=false, musicFailed=false, hasPlayed=false;
  let desired=null, confirmed=undefined, displayEpoch=0, displayPending=false, displayFailed=false;
  const notify=(channel,cause)=>{if(!disposed && cause?.kind!=='disposed')try{report(new Error(`${channel}: ${cause.message ?? cause}`,{cause}));}catch{}};
  const call=work=>{try{return Promise.resolve(work());}catch(e){return Promise.reject(e);}};
  const wantsMusic=()=>!disposed && playing && enabled && volume>0 && !!outputs && !musicFailed;

  function display() {
    if (disposed || !outputs || displayPending || displayFailed || desired===confirmed) return;
    const type=desired, epoch=displayEpoch; displayPending=true;
    call(()=>type ? outputs.display.showImage(holdPixels(type)) : outputs.display.clear()).then(()=>{
      if(!disposed && epoch===displayEpoch)confirmed=type;
    },e=>{if(!disposed && epoch===displayEpoch){displayFailed=true;notify('Hold-display',e);}}).finally(()=>{
      displayPending=false;if(!disposed)display();
    });
  }
  function pump() {
    if(!wantsMusic() || musicPending || stopPending || timer!==null)return;
    const token=generation,notes=melodyBar(bar,level),duration=notes.reduce((sum,n)=>sum+n.durationMs,0);
    const pending=call(()=>outputs.speaker.playMelody({notes,volume}));musicPending=pending;
    pending.then(()=>{
      if(disposed || token!==generation || !wantsMusic())return;
      audible=true;
      const end=clock.now()+duration;
      const finished=()=>{
        if(disposed || token!==generation || !wantsMusic())return;
        const remaining=end-clock.now();
        if(remaining>0){timer=clock.setTimeout(finished,remaining);return;}
        timer=null;bar=(bar+1)%MUSIC.length;pump();
      };
      timer=clock.setTimeout(finished,duration);
    },e=>{if(!disposed && token===generation){musicFailed=true;notify('Micro:bit-musikk',e);}}).finally(()=>{
      if(musicPending===pending)musicPending=null;pump();
    });
  }
  function stopMusic() {
    const shouldStop=audible || musicPending || timer!==null;
    generation++; clock.clearTimeout(timer); timer=null;audible=false;
    if(!outputs || !shouldStop || stopPending)return;
    const pending=call(()=>outputs.speaker.stop());stopPending=pending;
    pending.catch(e=>notify('Stopp musikk',e)).finally(()=>{if(stopPending===pending)stopPending=null;pump();});
  }
  return {
    hold(type,force=false){desired=type;if(force){displayEpoch++;confirmed=undefined;displayFailed=false;}display();},
    setLevel(value){level=value;},
    configure({musicEnabled=enabled,musicVolume=volume}={}) {
      const was=wantsMusic();enabled=!!musicEnabled;volume=Math.max(0,Math.min(255,Math.round(musicVolume)));
      if(was && (!enabled || !volume))stopMusic();
      if(!was && enabled && volume){musicFailed=false;pump();}
    },
    setPlaying(value){
      if(disposed || playing===value)return;
      playing=value;
      if(!playing)stopMusic();
      else {musicFailed=false;if(hasPlayed){displayEpoch++;confirmed=undefined;displayFailed=false;}hasPlayed=true;display();pump();}
    },
    end(){playing=false;stopMusic();desired=null;displayEpoch++;confirmed=undefined;displayFailed=false;display();},
    dispose(){if(disposed)return;playing=false;stopMusic();disposed=true;displayEpoch++;},
    get status(){return Object.freeze({music:!outputs?'unavailable':musicFailed?'error':!enabled||!volume?'off':playing?'playing':'paused',
      display:displayFailed?'error':confirmed===desired?'confirmed':'pending',bar,pending:Number(!!musicPending)+Number(displayPending),timer:timer!==null});}
  };
}
