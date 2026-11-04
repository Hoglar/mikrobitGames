import {createRacing} from './engine.js';
export * from './engine.js';
// Cartridge entry: all integration stays in this game folder.
import {defineGame,adaptEngine} from '@microbit-games/sdk';
import {createRacingAudio as cartridgeAudio} from './audio.js';
export default defineGame(ctx=>{
  const audio=cartridgeAudio();let enabled=false,volume=.2;
  const apply=()=>{const master=ctx.audio.getSettings();audio.setEnabled(enabled&&master.enabled);audio.setVolume(volume*master.volume);};
  ctx.audio.subscribe(apply);ctx.audio.registerCleanup(()=>audio.stop());
  document.addEventListener('game-audio-unlock',()=>audio.unlock());
  return adaptEngine(ctx,createRacing,{logoPause:true,recovery:true,audio,settings(c){
    c.ui.addSetting({id:'motor',label:'Motorlyd',type:'toggle',defaultValue:false},v=>{enabled=v;apply();});
    c.ui.addSetting({id:'volume',label:'Motorvolum',type:'range',defaultValue:.2,min:0,max:1,step:.05},v=>{volume=v;apply();});
  }});
},{stepHz:120});
