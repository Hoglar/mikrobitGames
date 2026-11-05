import {createTetris} from './engine.js';
export * from './engine.js';
// Cartridge entry: all integration stays in this game folder.
import {defineGame,adaptEngine} from '@microbit-games/sdk';
import {createTetrisAudio as cartridgeAudio} from './audio.js';
export default defineGame(ctx=>{
  const audio=cartridgeAudio();ctx.audio.onUnlock(()=>audio.unlock());ctx.audio.registerCleanup(()=>audio.configure({effectsEnabled:false}));
  return adaptEngine(ctx,createTetris,{audio,settings(c,engine){
    const apply=()=>{const master=c.audio.getSettings(),enabled=master.enabled&&master.volume>0&&c.round.phase==='playing';audio.configure({effectsEnabled:enabled,effectsVolume:.2*master.volume});engine.setAudioSettings({musicEnabled:enabled,musicVolume:96});};
    c.audio.subscribe(apply);
    c.round.onPhase(apply);
  }});
},{stepHz:120});
