import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi,validateResult } from '../../src/app/api.js';
import { createSubmissionQueue } from '../../src/platform/submissions.js';
import { createSnake,encodeSnake } from '../../src/games/snake.js';
import { createViking } from '../../src/games/viking.js';
import { games,registeredGame,formatScore } from '../../src/games/registry.js';
import { createAttempt,finishAttempt } from '../../src/platform/rules.js';
const owner='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
const attempt=finishAttempt(createAttempt({playerId:owner,game:games.find(g=>g.key==='stars'),attemptId:id}),'completed',100);
function saved(a=attempt){const record={id:'33333333-3333-4333-8333-333333333333',player_id:a.playerId,game_id:a.gameId,value:a.value,created_at:'2026-10-29T10:00:00Z'};return {attempt:{id:a.attemptId,player_id:a.playerId,game_id:a.gameId,status:a.status,value:a.value,created_at:record.created_at,record_outcome:'created',record_id:record.id},outcome:'created',record,current_record:record};}
test('API sends same-origin cookies and exact POST header/body; handles 204 and non-JSON proxy errors',async()=>{
 const calls=[],api=createApi(async(...args)=>{calls.push(args);return new Response(null,{status:204});});
 await api('/auth/logout',{method:'POST'});assert.equal(calls[0][0],'/api/v1/auth/logout');assert.equal(calls[0][1].credentials,'same-origin');assert.equal(calls[0][1].headers['X-MBG-Request'],'1');assert.equal(calls[0][1].body,'{}');
 await assert.rejects(createApi(async()=>new Response('<html>broken</html>',{status:502}))('/games'),{code:'HTTP_ERROR'});
 await assert.rejects(createApi(async()=>new Response('<html>broken</html>',{status:200}))('/games'),{code:'INVALID_RESPONSE'});
 await assert.rejects(api('//evil.example'),TypeError);
});
test('submission queue retains exact request after lost acknowledgement and blocks another owner',async()=>{
 let player={id:owner},calls=[],fail=true;const queue=createSubmissionQueue({getPlayer:()=>player,api:async(path,options)=>{calls.push({path,body:JSON.stringify(options.body)});if(fail)throw new Error('Lost response');return {status:200,data:saved()};}});
 const entry=queue.add(attempt);await assert.rejects(queue.send(id));assert.equal(entry.state,'unconfirmed');
 player={id:'other'};await assert.rejects(queue.send(id),/samme konto/);assert.equal(calls.length,1);
 player={id:owner};fail=false;await queue.send(id);assert.deepEqual(calls[0],calls[1]);assert.equal(entry.state,'saved');
 await queue.send(id);assert.equal(calls.length,2);
});
test('invalid result identity or contradictory record data never confirms saving',()=>{
 for(const mutate of [x=>x.attempt.player_id='other',x=>x.attempt.value=999,x=>x.outcome='not_improved',x=>x.record.value=99,x=>x.current_record=null]){const data=structuredClone(saved());mutate(data);assert.throws(()=>validateResult(data,attempt));}
 assert.equal(validateResult(saved(),attempt).outcome,'created');
});
test('registry requires exact ID and scoring rules; snake score shows food before steps',()=>{
 assert.equal(registeredGame({...games[0],is_active:true}),games[0]);assert.equal(registeredGame({...games[0],max_value:1}),null);assert.equal(registeredGame({...games[0],id:crypto.randomUUID()}),null);
 assert.ok(encodeSnake(12,500)>encodeSnake(11,1));assert.ok(encodeSnake(12,500)>encodeSnake(12,501));assert.equal(formatScore(games[0],encodeSnake(12,500)),'12 mat · 500 steg');
});
test('snake relative steering accepts only first counted action; tail motion, walls and deterministic food',()=>{
 const a=createSnake({config:{mode:'standard',food:'competitive'}}),b=createSnake({config:{mode:'standard',food:'competitive'}});assert.deepEqual(a.state.food,b.state.food);
 a.press({input:'a',count:5});a.press({input:'b',count:1});a.step();assert.equal(a.state.direction,0);assert.deepEqual(a.state.body[0],[10,9]);assert.equal(a.state.steps,1);
 const original=a.state.body;a.state.body[0][0]=99;assert.deepEqual(a.state.body,original);
 const straight=createSnake();for(let i=0;i<10;i++)straight.step();assert.equal(straight.ended,true);assert.equal(straight.state.steps,10);assert.equal(straight.state.body[0][0],19);
 const maze=createSnake({config:{mode:'maze',food:'competitive'}});assert.equal(maze.state.walls.length,16);assert.ok(!maze.state.walls.some(p=>p[0]===maze.state.food[0]&&p[1]===maze.state.food[1]));
});
test('viking fixed simulation repeats seeded obstacles independently of rendering; B blocks jump',()=>{
 const a=createViking({seed:'repeat'}),b=createViking({seed:'repeat'});a.tick(1);for(let i=0;i<120;i++)b.tick(1/120);assert.deepEqual(a.state,b.state);
 const jump=createViking();jump.input({buttons:{bPressed:false}});jump.press({input:'a'});jump.tick(.1);assert.ok(jump.state.y>0);jump.press({input:'a'});jump.tick(.4);assert.ok(jump.state.y<1.7);
 const duck=createViking();duck.input({buttons:{bPressed:true}});duck.press({input:'a'});duck.tick(.1);assert.equal(duck.state.y,0);
});
