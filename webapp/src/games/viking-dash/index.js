import {createViking} from './engine.js';
export * from './engine.js';
// Cartridge entry: all integration stays in this game folder.
import {defineGame,adaptEngine} from '@microbit-games/sdk';
export default defineGame(ctx=>adaptEngine(ctx,createViking,{settings(c,engine){
  const apply=()=>{const master=c.audio.getSettings();engine.setSoundVolume(master.volume);engine.setSoundEnabled(master.enabled&&master.volume>0&&c.round.phase==='playing');engine.setPlaying(c.round.phase==='playing');};
  c.audio.subscribe(apply);c.audio.registerCleanup(()=>engine.setSoundEnabled(false));
  c.round.onPhase(apply);c.audio.onUnlock(apply);
}}),{stepHz:120});
