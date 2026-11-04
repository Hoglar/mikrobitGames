import {createStars} from './engine.js';
export * from './engine.js';
// Cartridge entry: all integration stays in this game folder.
import {defineGame,adaptEngine} from '@microbit-games/sdk';
export default defineGame(ctx=>{return adaptEngine(ctx,createStars,{logoPause:false,recovery:false});},{stepHz:120});
