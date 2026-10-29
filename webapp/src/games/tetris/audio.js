/** One lazy AudioContext per page; round tokens isolate restarts and late cleanup. */
export function createTetrisAudio({ createContext=()=>{
  const Audio=globalThis.AudioContext ?? globalThis.webkitAudioContext;return Audio ? new Audio() : null;
} }={}) {
  let context=null, enabled=true, volume=.2, token=0, disposed=false, failed=false;
  const voices=new Set();
  function remove(voice){if(!voices.delete(voice))return;voice.source.onended=null;voice.source.disconnect();voice.gain.disconnect();}
  function stop(){for(const voice of [...voices]){try{voice.source.stop();}catch{}remove(voice);}}
  function unlock(){
    if(disposed || !enabled)return;
    try{context??=createContext();if(!context){failed=true;return;}
      Promise.resolve(context.resume()).then(()=>{failed=false;},()=>{failed=true;});
    }catch{failed=true;}
  }
  function tone(hz,endHz,duration,delay=0) {
    if(disposed || !enabled || !volume || context?.state!=='running')return;
    while(voices.size>=8){const oldest=voices.values().next().value;try{oldest.source.stop();}catch{}remove(oldest);}
    const source=context.createOscillator(),gain=context.createGain(),at=context.currentTime+delay;
    source.type='square';source.frequency.setValueAtTime(hz,at);source.frequency.exponentialRampToValueAtTime(endHz,at+duration);
    gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(volume*.3,at+.004);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
    source.connect(gain);gain.connect(context.destination);const voice={source,gain};voices.add(voice);
    source.onended=()=>remove(voice);source.start(at);source.stop(at+duration+.01);
  }
  return {
    unlock,
    configure({effectsEnabled=enabled,effectsVolume=volume}={}){
      enabled=!!effectsEnabled;volume=Math.max(0,Math.min(1,effectsVolume));if(!enabled||!volume)stop();else unlock();
    },
    beginRound(){
      stop();const round=++token;
      return {
        play(event){if(disposed || round!==token)return;
          if(event.type==='rotate')tone(800,550,.035);
          if(event.type==='drop')tone(180,45,.08);
          if(event.type==='lock' && event.result.lines){const tier=event.result.effectClass;
            [523,659,784].slice(0,tier>=3?3:2).forEach((hz,i)=>tone(hz*(1+tier*.08),hz*(1+tier*.16),.12+tier*.05,i*.025));}
        },
        stop(){if(round===token)stop();},
        dispose(){if(round===token){stop();token++;}}
      };
    },
    get status(){return !enabled||!volume?'off':failed?'unavailable':context?.state==='running'?'on':'waiting';},
    get activeVoices(){return voices.size;},
    dispose(){if(disposed)return;disposed=true;stop();token++;if(context)Promise.resolve(context.close()).catch(()=>{});}
  };
}
