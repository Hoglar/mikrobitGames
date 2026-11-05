import {createRacing} from './engine.js';
export * from './engine.js';
// Cartridge entry: all integration stays in this game folder.
import {defineGame,adaptEngine} from '@microbit-games/sdk';
import {createRacingAudio as cartridgeAudio} from './audio.js';
export default defineGame(ctx=>{
  const audio=cartridgeAudio();
  const apply=()=>{const master=ctx.audio.getSettings();audio.setVolume(.2*master.volume);audio.setEnabled(master.enabled&&master.volume>0);};
  ctx.audio.subscribe(apply);ctx.audio.registerCleanup(()=>audio.stop());
  ctx.audio.onUnlock(()=>audio.unlock());
  return adaptEngine(ctx,createRacing,{logoPause:true,recovery:true,audio});
},{stepHz:120});
