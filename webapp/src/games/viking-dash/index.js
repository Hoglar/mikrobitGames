import {createViking} from './engine.js';
export * from './engine.js';
// Cartridge entry: all integration stays in this game folder.
import {defineGame,adaptEngine} from '@microbit-games/sdk';
export default defineGame(ctx=>adaptEngine(ctx,createViking,{settings(c,engine){
  let enabled=false;const apply=()=>{engine.setSoundEnabled(enabled&&c.audio.getSettings().enabled);engine.setPlaying(c.round.phase==='playing');};
  c.audio.subscribe(apply);c.audio.registerCleanup(()=>engine.setSoundEnabled(false));
  c.round.onPhase(phase=>{if(phase==='playing')apply();});
  c.ui.addSetting({id:'sound',label:'Musikk og lyd',type:'toggle',defaultValue:false},v=>{enabled=v;apply();});
  document.addEventListener('game-audio-unlock',apply);
}}),{stepHz:120});
