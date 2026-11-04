import { normalizeName, compareScores, validateScore, formatScoreObject, boardKey, canonical,scoreContract } from './score.js';
const request=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
const complete=tx=>new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(tx.error??new Error('Lagringen ble avbrutt.'));});
export function createLocalRecords({indexedDB=globalThis.indexedDB,notify=()=>{},database='microbit-games-records'}={}){
  let opening;
  async function db(){if(!indexedDB)throw new Error('Lokal lagring er ikke tilgjengelig.');if(!opening)opening=new Promise((resolve,reject)=>{const r=indexedDB.open(database,1);r.onupgradeneeded=()=>{const store=r.result.createObjectStore('records',{keyPath:['boardKey','nameKey']});store.createIndex('board','boardKey');};r.onsuccess=()=>{r.result.onversionchange=()=>{r.result.close();opening=null;};resolve(r.result);};r.onerror=()=>{opening=null;reject(r.error);};});return opening;}
  function record(game,name,score,attemptId){const n=normalizeName(name);validateScore(game.mode.score,score);return {...n,boardKey:boardKey(game),fingerprint:game.rulesFingerprint,score:structuredClone(score),definition:game.mode.score,attemptId,recordedAt:new Date().toISOString()};}
  async function merge(rows){const d=await db(),tx=d.transaction('records','readwrite'),done=complete(tx),store=tx.objectStore('records'),results=[];
    // Keep all IndexedDB operations in request callbacks: no unrelated async work inside the transaction.
    for(const row of rows){const r=store.get([row.boardKey,row.nameKey]);r.onsuccess=()=>{const old=r.result;if(old&&old.fingerprint!==row.fingerprint){tx.abort();return;}const cmp=old?compareScores(row.definition,row.score,old.score):-1;const outcome=!old?'created':cmp<0?'improved':cmp===0?'equal':'not-improved';if(cmp<0)store.put(row);results.push({outcome,currentRecord:cmp<0?row:old});};}
    await done;notify();return results;
  }
  return {
    async save(game,name,score,attemptId){return (await merge([record(game,name,score,attemptId)]))[0];},
    async get(game,name){const d=await db(),tx=d.transaction('records'),done=complete(tx),row=await request(tx.objectStore('records').get([boardKey(game),normalizeName(name).nameKey]));await done;return row??null;},
    async leaderboard(game,{page=0,pageSize=10}={}){const d=await db(),tx=d.transaction('records'),done=complete(tx),rows=await request(tx.objectStore('records').index('board').getAll(boardKey(game)));await done;let rank=0,previous;const items=rows.filter(r=>r.fingerprint===game.rulesFingerprint).sort((a,b)=>compareScores(game.mode.score,a.score,b.score)||(a.nameKey<b.nameKey?-1:a.nameKey>b.nameKey?1:0)).map((row,i)=>{if(!previous||compareScores(game.mode.score,row.score,previous.score)!==0)rank=i+1;previous=row;return {...row,rank,name:row.displayName,formattedScore:formatScoreObject(game.mode.score,row.score)};});return {scope:'local',boardKey:boardKey(game),items:items.slice(page*pageSize,(page+1)*pageSize),page,pageSize,total:items.length};},
    async export(){const d=await db(),tx=d.transaction('records'),done=complete(tx),records=await request(tx.objectStore('records').getAll());await done;return {formatVersion:1,records};},
    async import(data){if(data?.formatVersion!==1||!Array.isArray(data.records)||data.records.length>10000)throw new TypeError('Ugyldig rekordfil.');const keys=new Set();for(const r of data.records){if(!r||typeof r.boardKey!=='string'||!/^([0-9a-f-]{36})\/[a-z0-9-]+\/[1-9][0-9]*$/.test(r.boardKey)||!/^[a-f0-9]{64}$/.test(r.fingerprint)||!Number.isFinite(Date.parse(r.recordedAt))||typeof r.attemptId!=='string'||!r.definition)throw new TypeError('Ugyldig rekordrad.');scoreContract(r.definition);validateScore(r.definition,r.score);if(canonical(normalizeName(r.displayName))!==canonical({displayName:r.displayName,nameKey:r.nameKey}))throw new TypeError('Ugyldig navn.');const key=r.boardKey+'/'+r.nameKey;if(keys.has(key))throw new TypeError('Duplikat i rekordfil.');keys.add(key);}await merge(data.records);},
    async clear(){const d=await db(),tx=d.transaction('records','readwrite'),done=complete(tx);tx.objectStore('records').clear();await done;notify();},
    async close(){if(opening)(await opening).close();opening=null;}
  };
}
