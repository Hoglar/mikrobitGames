import {decodeScore,formatScoreObject,boardKey} from './score.js';
export async function readPersonalBest(ctx,game){
  if(!ctx.session||ctx.localPlay)return null;
  const owner=ctx.session.player;
  for(let page=0;page<100;page++){
    const data=(await ctx.api(`/players/${owner.id}/records?page=${page}&page_size=100`)).data;
    if(!Array.isArray(data.items)||!Number.isInteger(data.total))throw new Error('Ugyldig personlig rekordliste.');
    const row=data.items.find(r=>r.game.id===game.id);
    if(row){const score=decodeScore(game.mode.score,row.record.value);return {name:owner.username,score,formattedScore:formatScoreObject(game.mode.score,score),recordedAt:row.record.created_at,isCurrentPlayer:true};}
    if(!data.items.length||(page+1)*100>=data.total)break;
  }
  return null;
}
export async function readLeaderboard(ctx,game,{scope=ctx.localPlay?'local':'online',page=0,pageSize=10}={}){
  if(scope==='local')return ctx.records.leaderboard(game,{page,pageSize});
  if(ctx.localPlay)throw new Error('Online-topplister er frakoblet lokalt.');
  const data=(await ctx.api(`/games/${game.id}/leaderboard?page=${page}&page_size=${pageSize}`)).data;
  if(!Array.isArray(data.items)||!Number.isInteger(data.total))throw new Error('Ugyldig toppliste.');
  return {scope,boardKey:boardKey(game),items:data.items.map(r=>({rank:r.rank,name:r.player.username,playerId:r.player.id,score:decodeScore(game.mode.score,r.record.value),formattedScore:formatScoreObject(game.mode.score,decodeScore(game.mode.score,r.record.value)),recordedAt:r.record.created_at,isCurrentPlayer:r.player.id===ctx.session?.player.id})),page,pageSize,total:data.total};
}
