import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,cp,writeFile,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {games} from '../../src/games/registry.js';
import {scoreContract,encodeScore,decodeScore,compareScores,normalizeName} from '../../src/leaderboards/score.js';
import {inspectGame,validateModule} from '../../verification/cartridges.mjs';
import {readPersonalBest} from '../../src/leaderboards/provider.js';
const root=new URL('../../',import.meta.url);
test('SDK personal best remains discoverable beyond the first hundred recorded game modes',async()=>{const game=games.find(game=>game.key==='snake'),calls=[];const ctx={session:{player:{id:'owner',username:'Spiller'}},async api(path){calls.push(path);return {data:calls.length===1?{items:Array.from({length:100},(_,i)=>({game:{id:'other-'+i}})),total:101}:{items:[{game:{id:game.id},record:{value:encodeScore(game.mode.score,{food:12,steps:500})}}],total:101}};}};const best=await readPersonalBest(ctx,game);assert.equal(calls.length,2);assert.deepEqual(best.score,{food:12,steps:500});});
test('module parser rejects dynamic imports including computed expressions before game execution',()=>{assert.doesNotThrow(()=>validateModule("import {defineGame} from '@microbit-games/sdk'; export const x=1;"));for(const source of ["import('./game.js')","const f=p=>import(p)","eval('1')","new Function('return 1')","new Worker('./worker.js')"])assert.throws(()=>validateModule(source),/støttes ikke/);});
test('all 47 original game IDs, names, configuration and score contracts survive discovery',async()=>{
 const old=JSON.parse(await readFile(new URL('tests/unit/fixtures/legacy-game-catalog.json',root)));
 assert.ok(games.length>=47);for(const expected of old){const found=games.find(g=>g.id===expected.id);assert.ok(found);assert.deepEqual(Object.fromEntries(Object.keys(expected).map(k=>[k,found[k]])),expected);}
});
test('declarative compound ranking agrees with scalar transport in either direction',()=>{
 for(const direction of ['higher_is_better','lower_is_better']){const def={fields:[{key:'points',label:'Poeng',min:3,max:12,direction,format:'integer'},{key:'timeMs',label:'Tid',min:1,max:8,direction:'lower_is_better',format:'duration-ms'}]};scoreContract(def);const rows=[];for(let p=3;p<=12;p++)for(let t=1;t<=8;t++){const score={points:p,timeMs:t};assert.deepEqual(decodeScore(def,encodeScore(def,score)),score);rows.push(score);}for(const a of rows)for(const b of rows){const scalar=Math.sign(encodeScore(def,a)-encodeScore(def,b))*(direction==='lower_is_better'?1:-1);assert.equal(compareScores(def,a,b)||0,scalar||0);}}
 const race=games.find(g=>g.score_unit==='racing_rank_v1');assert.equal(encodeScore(race.mode.score,{position:2,timeMs:83456}),1083456);assert.throws(()=>decodeScore(race.mode.score,1000000));assert.throws(()=>decodeScore(race.mode.score,3600001));
});
test('score and local names reject coercion and normalize case/NFC without merging internal spaces',()=>{
 const def=games.find(game=>game.key==='snake').mode.score;assert.throws(()=>encodeScore(def,{food:'1',steps:2}));assert.throws(()=>encodeScore(def,{food:1,steps:2,extra:3}));assert.deepEqual(normalizeName(' Ole '),{nameKey:'ole',displayName:'Ole'});assert.equal(normalizeName('OLE').nameKey,'ole');assert.equal(normalizeName('A\u030Ase').nameKey,normalizeName('Åse').nameKey);assert.notEqual(normalizeName('Anne  Marie').nameKey,normalizeName('Anne Marie').nameKey);assert.throws(()=>normalizeName('\u202Eole'));assert.throws(()=>normalizeName(' '.repeat(10)));assert.throws(()=>normalizeName('a'.repeat(33)));
});
test('a portable game folder validates without importing host or another game',async()=>{
 const folder=new URL('build/cartridge-unit-fixture/',root);await mkdir(folder,{recursive:true});try{await cp(new URL('templates/game/',root),folder,{recursive:true});const first=await inspectGame(fileURLToPath(folder));const json=JSON.parse(await readFile(new URL('game.json',folder)));json.description='Kosmetisk endring';await writeFile(new URL('game.json',folder),JSON.stringify(json));const second=await inspectGame(fileURLToPath(folder));assert.equal(first.modeRecords[0].id,second.modeRecords[0].id);assert.equal(first.modeRecords[0].rulesFingerprint,second.modeRecords[0].rulesFingerprint);assert.notEqual(first.contentHash,second.contentHash);await writeFile(new URL('index.js',folder),"import '../../src/app/main.js';");await assert.rejects(inspectGame(fileURLToPath(folder)),/utenfor|outside|Build failed/);}finally{await rm(folder,{recursive:true,force:true});}
});
