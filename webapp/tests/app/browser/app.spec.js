import { test,expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { installSerialMock } from '../../microbit-input/browser/serial-mock.js';
import { games, families } from '../../../src/games/registry.js';
const fixture=JSON.parse(readFileSync(new URL('../../../../spec/contracts/microbit-webapp/fixtures/conformance.json',import.meta.url)));
const player={id:'11111111-1111-4111-8111-111111111111',username:'Spiller',created_at:'2026-10-01T12:00:00Z'},session={player,expires_at:'2026-11-01T12:00:00Z',absolute_expires_at:'2026-11-20T12:00:00Z'};
async function setup(page,{signedIn=true,catalogFailure=false}={}){
 const calls=[];await page.addInitScript(installSerialMock,{info:fixture.deviceInfo.v2,snapshot:fixture.snapshots.v2});
 await page.route('**/api/v1/**',async route=>{const req=route.request(),url=new URL(req.url()),path=url.pathname.replace('/api/v1','');calls.push({path,method:req.method(),body:req.postDataJSON(),headers:req.headers()});
 let data={},status=200;
 if(path==='/auth/session'){data=signedIn?session:{error:{code:'AUTH_REQUIRED',message:'Logg inn.'}};status=signedIn?200:401;}
 else if(path==='/auth/login'){data=session;signedIn=true;}
 else if(path==='/auth/register'){data=player;status=201;}
 else if(path==='/games'){data={items:games.map(g=>({...g,is_active:true})),page:0,page_size:100,total:games.length};if(catalogFailure){await route.fulfill({status:502,contentType:'text/html',body:'proxy failed'});return;}}
 else if(path.startsWith('/players/'))data={items:[],page:0,page_size:100,total:0};
 else if(path==='/auth/renew')data=session;
 else if(path==='/account/results')data={items:[],page:0,page_size:30,total:0};
 else if(path==='/ai/questions')data={request_id:crypto.randomUUID(),status:'ok',answer:'<img src=x onerror=alert(1)> Ren tekst.',notices:[]};
 else if(path==='/ai/conversation/reset'||path==='/auth/logout'){status=204;}
 else if(path.endsWith('/results')&&req.method()==='POST'){const b=req.postDataJSON(),gameId=path.split('/')[2];data={attempt:{id:b.attempt_id,player_id:player.id,game_id:gameId,status:b.status,value:b.value,created_at:'2026-10-29T12:00:00Z',record_outcome:b.status==='incomplete'?'not_eligible':'not_improved',record_id:null},outcome:b.status==='incomplete'?'not_eligible':'not_improved',record:null,current_record:null};status=201;}
 await route.fulfill({status,contentType:'application/json',body:status===204?'':JSON.stringify(data)});
 });return calls;
}
test('launcher loads all bundled games; public Testlab works during API failure and never renews or saves',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));const calls=await setup(page,{signedIn:false,catalogFailure:true});await page.goto('/');await expect(page.getByRole('heading',{name:'Velg ditt neste eventyr.'})).toBeVisible();await expect(page.locator('.game-card')).toHaveCount(families.length);await page.screenshot({path:'build/app-desktop.png',fullPage:true});await page.getByRole('navigation').getByRole('link',{name:'Testlab',exact:true}).click();await expect(page.getByRole('heading',{name:'En liten lab. Store muligheter.'})).toBeVisible();await expect(page.getByText('Ingen gyldige data ennå',{exact:false})).toBeVisible();expect(calls.filter(c=>c.path.includes('renew')||c.path.includes('results'))).toEqual([]);expect(errors).toEqual([]);
});
test('Testlab receives sensors, counts recovered presses, edits without sending, sends image and resets',async({page})=>{
 const calls=await setup(page,{signedIn:false});await page.goto('/#/testlab');await page.locator('#main').getByRole('button',{name:'Koble til micro:bit',exact:true}).click();await expect(page.locator('#connection-label')).toHaveText('Micro:bit er tilkoblet');await page.waitForTimeout(100);
 await page.evaluate(()=>window.serialMock.port.sample({ac:3,x:525,t:25,l:90,m:181}));await expect(page.getByText('A: 3 · B: 0 · Logo: 0 · Rist: 0')).toBeVisible();await expect(page.getByText('0.50',{exact:true})).toBeVisible();
 const before=await page.evaluate(()=>window.serialMock.commands.length);await page.getByRole('button',{name:'Piksel 1, 1',exact:true}).click();expect(await page.evaluate(()=>window.serialMock.commands.length)).toBe(before);await page.getByRole('button',{name:'Send bilde',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.serialMock.commands.some(x=>x.endsWith('D|IMAGE|9000000000000000000000000')))).toBe(true);
 await page.getByRole('button',{name:'Start nytt opptak'}).click();await expect(page.getByText('TAR OPP',{exact:true})).toBeVisible();await page.waitForTimeout(200);await page.getByRole('button',{name:'Pause opptak',exact:true}).click();await page.getByRole('button',{name:'Fortsett opptak',exact:true}).click();
 await page.getByRole('button',{name:'Nullstill test'}).click();await expect(page.getByText('A: 0 · B: 0 · Logo: 0 · Rist: 0')).toBeVisible();await expect.poll(()=>page.evaluate(()=>window.serialMock.commands.some(x=>x.endsWith('S|STOP')))).toBe(true);expect(calls.filter(c=>c.path.includes('renew')||c.path.includes('results'))).toEqual([]);
});
test('game start requires connection and renew; physical loss freezes, recovery requires continuation and exit keeps attempt',async({page})=>{
 const calls=await setup(page);await page.goto('/#/play/viking');await expect(page.getByRole('button',{name:'Start spill →'})).toBeDisabled();await page.locator('#connect').click();await expect(page.getByRole('button',{name:'Start spill →'})).toBeEnabled();await page.getByRole('button',{name:'Start spill →'}).click();await expect(page.locator('.game-toolbar')).toContainText('NEDTELLING');expect(calls.some(c=>c.path==='/auth/renew')).toBe(true);
 await page.evaluate(()=>window.serialMock.port.remove());await expect(page.locator('.game-overlay')).toContainText('Micro:bit-input er utilgjengelig');await page.waitForTimeout(100);await page.locator('#connect').click();await expect(page.locator('#connection-label')).toHaveText('Micro:bit er tilkoblet');await expect(page.locator('.game-toolbar')).toContainText('PAUSE');await page.getByRole('button',{name:'→ Fortsett',exact:true}).click();await expect(page.locator('.game-toolbar')).toContainText('NEDTELLING');
 await page.getByRole('button',{name:'Pause',exact:true}).click();await page.getByRole('button',{name:'Restart',exact:true}).click();await page.getByRole('button',{name:'Ja, avslutt',exact:false}).click();await expect.poll(()=>calls.filter(c=>c.path.endsWith('/results')&&c.method==='POST').length).toBe(1);const submitted=calls.find(c=>c.path.endsWith('/results')&&c.method==='POST');expect(submitted.body.status).toBe('incomplete');expect(submitted.headers['x-mbg-request']).toBe('1');expect(submitted.body.attempt_id).toMatch(/^[\da-f-]{36}$/);
});
test('protected routes require login; registration does not log in; AI renders text and reset calls backend',async({page})=>{
 const calls=await setup(page,{signedIn:false});await page.goto('/#/dashboard');await expect(page.getByRole('heading',{name:'Logg inn for å fortsette'})).toBeVisible();await page.goto('/#/register');await page.getByLabel('Brukernavn',{exact:true}).fill('Spiller');await page.getByLabel('Passord · 12–128 tegn').fill('langtnokpassord123');await page.getByRole('button',{name:'Opprett konto',exact:true}).click();await expect(page).toHaveURL(/#\/login/);expect(calls.some(c=>c.path==='/auth/login')).toBe(false);
 await page.getByLabel('Brukernavn',{exact:true}).fill('Spiller');await page.getByLabel('Passord · 12–128 tegn').fill('langtnokpassord123');await page.getByRole('button',{name:'Logg inn',exact:true}).click();await page.getByRole('link',{name:'AI-chat',exact:true}).click();await page.getByRole('textbox',{name:'Ditt spørsmål'}).fill('Hei');await page.getByRole('button',{name:'Send spørsmål ↗'}).click();await expect(page.locator('.chat-message.assistant')).toContainText('<img');await expect(page.locator('.chat-message img')).toHaveCount(0);await page.getByRole('button',{name:'Ny samtale',exact:true}).click();await expect(page.locator('.chat-message')).toHaveCount(0);expect(calls.some(c=>c.path==='/ai/conversation/reset')).toBe(true);
});
test('mobile layout stays within viewport and all assets load from this build',async({page})=>{
 await setup(page);await page.setViewportSize({width:390,height:844});const failures=[];page.on('response',r=>{if(!r.url().includes('/api/')&&r.status()>=400)failures.push(r.url());});await page.goto('/');await expect(page.locator('.game-card')).toHaveCount(families.length);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await page.screenshot({path:'build/app-mobile.png',fullPage:true});await page.getByRole('navigation').getByRole('link',{name:'Testlab',exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);expect(failures).toEqual([]);
});
test('snake completes exactly once, shows decoded score, confirms record and restarts without replay',async({page})=>{
 const calls=await setup(page);const saved=[];
 await page.route('**/api/v1/games/*/results',async route=>{const body=route.request().postDataJSON();saved.push(body);const gameId=new URL(route.request().url()).pathname.split('/')[4],record={id:crypto.randomUUID(),player_id:player.id,game_id:gameId,value:body.value,created_at:'2026-10-29T12:00:00Z'};await route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({attempt:{id:body.attempt_id,player_id:player.id,game_id:gameId,status:body.status,value:body.value,created_at:record.created_at,record_outcome:'created',record_id:record.id},outcome:'created',record,current_record:record})});});
 await page.goto('/#/play/snake');await page.locator('#connect').click();await page.getByRole('button',{name:'Start spill →'}).click();await expect(page.locator('.game-toolbar')).toContainText('SPILLER',{timeout:7000});await expect(page.locator('.game-overlay')).toContainText('Godt spilt!',{timeout:7000});await expect(page.locator('.game-overlay')).toContainText('Lagret · ny personlig rekord!');expect(saved).toHaveLength(1);expect(saved[0].status).toBe('completed');expect(saved[0].value).toBe(999989);await expect.poll(()=>page.evaluate(()=>window.serialMock.commands.some(x=>x.endsWith('D|IMAGE|9000999999099900090009990')))).toBe(true);
 await page.getByRole('button',{name:'Spill igjen →'}).click();await expect(page.locator('.game-toolbar')).toContainText('NEDTELLING');expect(saved).toHaveLength(1);expect(calls.filter(c=>c.path==='/auth/renew')).toHaveLength(2);
});
test('dashboard separates private incomplete attempts and public records, and highlights exact attempt',async({page})=>{
 await setup(page);const game=games.find(g=>g.key==='snake'),a={id:crypto.randomUUID(),player_id:player.id,game_id:game.id,status:'incomplete',value:null,created_at:'2026-10-29T12:00:00Z',record_outcome:'not_eligible',record_id:null};
 await page.route('**/api/v1/account/results**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(new URL(route.request().url()).pathname.endsWith(a.id)?a:{items:[a],page:0,page_size:30,total:1})}));
 await page.goto(`/#/dashboard?attempt=${a.id}`);await expect(page.getByText('Ditt siste forsøk',{exact:true})).toBeVisible();await expect(page.locator('table')).toContainText('Ufullført');await expect(page.locator('table')).toContainText('Ingen delverdi');await expect(page.getByText('Du har ingen personlige rekorder ennå.')).toBeVisible();
});
test('profile changes password with exact fields and returns to login without retaining password',async({page})=>{
 const calls=await setup(page);await page.route('**/api/v1/account/password',route=>route.fulfill({status:204}));await page.goto('/#/profile');const form=page.locator('form').filter({has:page.getByRole('heading',{name:'Nytt passord'})});await form.getByLabel('Gjeldende passord',{exact:true}).fill('gammeltpassord123');await form.getByLabel('Nytt passord · 12–128 tegn').fill('nyttlangtpassord123');await form.getByRole('button',{name:'Endre passord'}).click();await expect(page).toHaveURL(/#\/login/);
 // The overriding route records its own body separately from setup's fallback.
 expect(await page.evaluate(()=>Object.keys(localStorage))).toEqual([]);await expect(page.getByRole('heading',{name:'Velkommen tilbake.'})).toBeVisible();
});
test('each bundled game opens in the same frame and custom seed practice never submits results',async({page})=>{
 const calls=await setup(page);await page.goto('/#/play/stars');await page.locator('#connect').click();for(const key of ['stars','reaction','balance','viking','snake','tetris']){await page.goto(`/#/play/${key}`);await expect(page.locator('.game-frame canvas')).toBeVisible();await expect(page.getByRole('button',{name:'Start spill →'})).toBeEnabled();}
 await page.getByRole('combobox',{name:'Rangert eller øving'}).selectOption('practice');await page.getByRole('textbox',{name:'Seed for øving'}).fill('min-seed');await page.getByRole('button',{name:'Start spill →'}).click();await expect(page.locator('.game-overlay')).toContainText('Øving');await page.getByRole('button',{name:'Pause',exact:true}).click();await page.getByRole('button',{name:'Restart',exact:true}).click();await page.getByRole('button',{name:'Ja, avslutt',exact:false}).click();expect(calls.filter(c=>c.path.endsWith('/results')&&c.method==='POST')).toEqual([]);
});
test('pending backend requests cannot delay access to local Testlab',async({page})=>{
 await setup(page,{signedIn:false});let release;const gate=new Promise(resolve=>{release=resolve;});
 await page.route('**/api/v1/games?**',async route=>{await gate;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'SERVICE_UNAVAILABLE',message:'Unavailable'}})});});
 await page.goto('/');await page.getByRole('navigation').getByRole('link',{name:'Testlab',exact:true}).click();await expect(page.getByRole('heading',{name:'En liten lab. Store muligheter.'})).toBeVisible({timeout:2000});release();await expect(page.getByRole('heading',{name:'En liten lab. Store muligheter.'})).toBeVisible();
});
test('public top list formats snake food and steps and opens player record history without login',async({page})=>{
 await setup(page,{signedIn:false});const game=games[0],record={id:crypto.randomUUID(),player_id:player.id,game_id:game.id,value:120999149,created_at:'2026-10-29T12:00:00Z'};
 await page.route('**/api/v1/games/*/leaderboard?**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({game,items:[{rank:1,player,record}],page:0,page_size:30,total:1})}));
 await page.route('**/api/v1/players/*/games/*/records?**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({game,player,items:[record],page:0,page_size:30,total:1})}));
 await page.goto(`/#/leaderboard/${game.id}`);await expect(page.locator('table')).toContainText('120 mat · 850 steg');await page.getByRole('link',{name:player.username,exact:true}).click();await expect(page.getByRole('heading',{name:'Veien til rekorden.'})).toBeVisible();await expect(page.locator('table')).toContainText('120 mat · 850 steg');
});

test('top lists are discoverable without login and include every Snake variant',async({page})=>{
 await setup(page,{signedIn:false});
 await page.goto('/');
 await page.getByRole('navigation').getByRole('link',{name:'Topplister',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Topplister',exact:true})).toBeVisible();
 await expect(page.getByRole('link',{name:'Åpne toppliste →'})).toHaveCount(games.length);
 const game=games.find(g=>g.key==='viking');
 await page.route(`**/api/v1/games/${game.id}/leaderboard?**`,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({game,items:[],page:0,page_size:30,total:0})}));
 await page.locator('.stat').filter({has:page.getByRole('heading',{name:'Viking Dash',exact:true})}).getByRole('link').click();
 await expect(page).toHaveURL(new RegExp(game.id));
 await expect(page.getByText('Ingen rekorder ennå.')).toBeVisible();
 await page.getByRole('link',{name:'← Alle topplister',exact:true}).click();
 await expect(page.getByRole('link',{name:'Åpne toppliste →'})).toHaveCount(games.length);
});

test('game top list follows the selected Snake variant',async({page})=>{
 await setup(page);
 await page.goto('/#/play/snake');
 const link=page.getByRole('link',{name:'Toppliste for valgt variant',exact:true});
 await expect(link).toHaveAttribute('href',`#/leaderboard/${games[0].id}`);
 const alternative=games.find(g=>g.key==='snake'&&g.config.mode==='maze'&&g.config.food==='random');
 await page.getByRole('combobox',{name:'Spillmodus',exact:true}).selectOption(alternative.id);
 await expect(link).toHaveAttribute('href',`#/leaderboard/${alternative.id}`);
});
