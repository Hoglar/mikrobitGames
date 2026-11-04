import {createTetris} from './engine.js';
export * from './engine.js';
// Cartridge entry: all integration stays in this game folder.
import {defineGame,adaptEngine} from '@microbit-games/sdk';
import {createTetrisAudio as cartridgeAudio} from './audio.js';
export default defineGame(ctx=>{
  const audio=cartridgeAudio();document.addEventListener('game-audio-unlock',()=>audio.unlock());ctx.audio.registerCleanup(()=>audio.configure({effectsEnabled:false}));
  return adaptEngine(ctx,createTetris,{audio,settings(c,engine){
    const settings={musicEnabled:true,musicVolume:96,effectsEnabled:true,effectsVolume:.2};
    const apply=()=>{const master=c.audio.getSettings();audio.configure({...settings,effectsEnabled:settings.effectsEnabled&&master.enabled,effectsVolume:settings.effectsVolume*master.volume});engine.setAudioSettings(settings);};
    c.audio.subscribe(apply);
    c.round.onPhase(phase=>{if(phase==='playing')apply();});
    for(const [id,label,type,min,max,step]of [['musicEnabled','Micro:bit-musikk','toggle'],['musicVolume','Musikkvolum','range',0,255,1],['effectsEnabled','Nettlesereffekter','toggle'],['effectsVolume','Effektvolum','range',0,1,.01]])
      c.ui.addSetting({id:id.replace(/[A-Z]/g,x=>'-'+x.toLowerCase()),label,type,defaultValue:settings[id],...(type==='range'?{min,max,step}:{})},v=>{settings[id]=v;apply();});
  }});
},{stepHz:120});
