// One optional page-owned motor voice; no timer, assets or network calls.
export function createRacingAudio({AudioContext=globalThis.AudioContext??globalThis.webkitAudioContext}={}){
  let context=null,oscillator=null,gain=null,enabled=false,disposed=false,volume=.2;
  function unlock(){if(disposed||!enabled||!AudioContext)return;try{context??=new AudioContext();void context.resume().catch(()=>{});}catch{}}
  function stop(){try{oscillator?.stop();oscillator?.disconnect();gain?.disconnect();}catch{}oscillator=null;gain=null;}
  return {
    unlock,
    setEnabled(value){enabled=!!value;if(enabled)unlock();else stop();return enabled;},
    setVolume(value){if(!Number.isFinite(value))return;volume=Math.max(0,Math.min(1,value));if(gain&&context)gain.gain.setTargetAtTime(volume*.18,context.currentTime,.03);if(!volume)stop();},
    update(speed,topSpeed,playing){
      if(disposed||!enabled||!volume||!playing||!context||context.state!=='running'){stop();return;}
      try{
        if(!oscillator){oscillator=context.createOscillator();gain=context.createGain();oscillator.type='triangle';gain.gain.value=volume*.18;oscillator.connect(gain).connect(context.destination);oscillator.start();}
        oscillator.frequency.setTargetAtTime(48+Math.min(1,speed/topSpeed)*140,context.currentTime,.06);
      }catch{stop();}
    },
    stop,
    get enabled(){return enabled;},
    dispose(){if(disposed)return;disposed=true;stop();if(context)void context.close().catch(()=>{});context=null;}
  };
}
