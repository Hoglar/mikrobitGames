import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { games, families } from '../../../src/games/registry.js';
import { installSerialMock } from '../../microbit-input/browser/serial-mock.js';

const player={id:'11111111-1111-4111-8111-111111111111',username:'Arcadespiller',created_at:'2026-10-01T12:00:00Z'};
const session={player,expires_at:'2026-11-01T12:00:00Z',absolute_expires_at:'2026-11-20T12:00:00Z'};
const fixture=JSON.parse(readFileSync(new URL('../../../../spec/contracts/microbit-webapp/fixtures/conformance.json',import.meta.url)));

function board(game,username='Rekordholder'){
  return {game,items:[{rank:1,player:{...player,username},record:{id:'22222222-2222-4222-8222-222222222222',player_id:player.id,game_id:game.id,value:game.key==='snake'?120999149:1250,created_at:'2026-10-29T12:00:00Z'}}],page:0,page_size:10,total:1};
}

async function setup(page,{signedIn=true}={}){
  const calls=[];
  await page.route('**/api/v1/**',async route=>{
    const request=route.request(),url=new URL(request.url()),path=url.pathname.replace('/api/v1','');calls.push(path);
    let data={},status=200;
    if(path==='/auth/session'){status=signedIn?200:401;data=signedIn?session:{error:{code:'AUTH_REQUIRED',message:'Logg inn.'}};}
    else if(path==='/auth/login'){signedIn=true;data=session;}
    else if(path==='/auth/logout'){signedIn=false;status=204;}
    else if(path==='/auth/renew')data=session;
    else if(path==='/games')data={items:games.map(game=>({...game,is_active:true})),page:0,page_size:100,total:games.length};
    else if(path.endsWith('/leaderboard'))data=board(games.find(game=>path.includes(game.id)));
    else if(path.startsWith('/players/'))data={items:[],page:0,page_size:100,total:0};
    else if(path==='/ai/questions')data={request_id:crypto.randomUUID(),status:'ok',answer:'Rekorden finnes i topplisten ved siden av spillet.',notices:[]};
    await route.fulfill({status,contentType:'application/json',body:status===204?'':JSON.stringify(data)});
  });
  return calls;
}

test('cartridges switch inside the same cabinet and preserve the chat draft',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));await setup(page);
  await page.goto('/');await expect(page.locator('.game-cartridge')).toHaveCount(6);
  await expect(page.locator('.arcade-chat textarea')).toBeEnabled();
  await page.locator('.arcade-chat textarea').fill('Hvem har rekorden?');
  await page.locator('.arcade-shell').evaluate(node=>{node.dataset.persistentCheck='same-shell';});
  for(const key of ['viking','tetris']){
    await page.locator(`.game-cartridge[data-game="${key}"]`).click();
    await expect(page.locator(`.game-cartridge[data-game="${key}"]`)).toHaveAttribute('aria-pressed','true');
    await expect(page.locator('.cabinet-screen .game-frame canvas')).toBeVisible();
    await expect(page.locator('.cabinet-screen .game-frame canvas')).toHaveAttribute('aria-label',`${families.find(family=>family.key===key).title} spillflate`);
    await expect(page.locator('.loading-cartridge')).toHaveCount(0);
    await expect(page.locator('.arcade-shell')).toHaveAttribute('data-persistent-check','same-shell');
    await expect(page.locator('.arcade-chat textarea')).toHaveValue('Hvem har rekorden?');
    await expect(page.locator('.game-frame')).toHaveCount(1);
  }
  await page.locator('.arcade-chat').getByRole('button',{name:'Send spørsmål ↗'}).click();
  await expect(page.locator('.arcade-chat .chat-message.assistant')).toContainText('ved siden av spillet');
  await page.locator('.skip').press('Enter');
  await expect(page.locator('#main')).toBeFocused();
  await expect(page.locator('.arcade-account')).toBeHidden();
  expect(errors).toEqual([]);
});

test('the selected cartridge loads with an animation and desktop leaderboard sits beside the game',async({page})=>{
  await page.setViewportSize({width:1440,height:1000});await setup(page);await page.goto('/#/play/snake');
  await expect(page.locator('.cabinet-screen .game-frame')).toBeVisible();
  await page.locator('.game-cartridge[data-game="viking"]').click();
  await expect(page.locator('.loading-cartridge')).toBeVisible();
  await expect(page.locator('.loading-cartridge')).toHaveCount(0);
  await expect(page.locator('.arcade-leaderboard')).toContainText('Rekordholder');
  const cabinet=await page.locator('.cabinet').boundingBox(),leaderboard=await page.locator('.arcade-leaderboard').boundingBox(),chat=await page.locator('.arcade-chat').boundingBox();
  expect(leaderboard.x).toBeGreaterThanOrEqual(cabinet.x+cabinet.width);
  expect(Math.abs(leaderboard.y-cabinet.y)).toBeLessThan(10);
  expect(chat.y).toBeGreaterThanOrEqual(Math.max(cabinet.y+cabinet.height,leaderboard.y+leaderboard.height));
});

test('Snake leaderboard follows mode selection and ignores a late response for an older mode',async({page})=>{
  await setup(page);const old=games.find(game=>game.key==='snake'&&game.config.mode==='fast'&&game.config.food==='competitive'),latest=games.find(game=>game.key==='snake'&&game.config.mode==='maze'&&game.config.food==='random');
  let releaseOld,oldRequested=false;const gate=new Promise(resolve=>{releaseOld=resolve;});
  await page.route(`**/api/v1/games/${old.id}/leaderboard?**`,async route=>{oldRequested=true;await gate;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(board(old,'Gammel modus'))});});
  await page.route(`**/api/v1/games/${latest.id}/leaderboard?**`,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(board(latest,'Riktig modus'))}));
  await page.goto('/#/play/snake');
  await expect(page.locator('.arcade-leaderboard')).toContainText('Rekordholder');
  await page.getByRole('combobox',{name:'Spillmodus',exact:true}).selectOption(old.id);
  await expect.poll(()=>oldRequested).toBe(true);
  await page.getByRole('combobox',{name:'Spillmodus',exact:true}).selectOption(latest.id);
  await expect(page.locator('.arcade-leaderboard')).toContainText('Riktig modus');
  await expect(page.locator('.arcade-leaderboard')).toContainText('120 mat · 850 steg');
  releaseOld();await page.waitForTimeout(150);
  await expect(page.locator('.arcade-leaderboard')).toContainText('Riktig modus');
  await expect(page.locator('.arcade-leaderboard')).not.toContainText('Gammel modus');
});

test('mobile rack scrolls horizontally without overflowing the page and reduced motion skips loading flight',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await setup(page);await page.goto('/');
  await expect(page.locator('.game-cartridge')).toHaveCount(6);
  const track=page.locator('.cartridge-track');
  expect(await track.evaluate(node=>node.scrollWidth>node.clientWidth)).toBe(true);
  await track.dispatchEvent('wheel',{deltaY:240,deltaX:0,bubbles:true,cancelable:true});
  await expect.poll(()=>track.evaluate(node=>node.scrollLeft)).toBeGreaterThan(0);
  await page.locator('.game-cartridge[data-game="balance"]').click();
  await expect(page.locator('.game-cartridge[data-game="balance"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.loading-cartridge')).toHaveCount(0);
  await expect(page.locator('.cabinet-screen .game-frame')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const cabinet=await page.locator('.cabinet').boundingBox(),leaderboard=await page.locator('.arcade-leaderboard').boundingBox();
  expect(leaderboard.y).toBeGreaterThanOrEqual(cabinet.y+cabinet.height);
  await page.locator('.game-cartridge[data-game="snake"]').focus();await page.keyboard.press('ArrowRight');
  await expect(page.locator('.game-cartridge[data-game="viking"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.game-cartridge[data-game="viking"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.loading-cartridge')).toHaveCount(0);
});

test('public arcade shows the leaderboard and explains sign-in inside the bottom chat',async({page})=>{
  await setup(page,{signedIn:false});await page.goto('/');
  await expect(page.locator('.game-cartridge')).toHaveCount(6);
  await page.locator('.game-cartridge[data-game="snake"]').click();
  await expect(page.locator('.arcade-leaderboard')).toContainText('Rekordholder');
  await expect(page.locator('.arcade-chat')).toContainText(/Logg inn/i);
  await expect(page.locator('.arcade-chat textarea')).toBeDisabled();
});

test('the micro:bit mode selector updates the same leaderboard and chat navigation retains the game',async({page})=>{
  await setup(page);await page.addInitScript(installSerialMock,{info:fixture.deviceInfo.v2,snapshot:fixture.snapshots.v2});await page.goto('/#/play/snake');
  await page.locator('#connect').click();
  await expect(page.getByRole('button',{name:'Start spill →'})).toBeEnabled();
  await page.evaluate(()=>window.serialMock.port.sample({b:1,bc:1}));
  await page.waitForTimeout(100);await page.evaluate(()=>window.serialMock.port.sample({b:0}));
  await expect(page.getByRole('combobox',{name:'Spillmodus',exact:true})).toHaveValue(games[1].id);
  await expect(page.locator('.arcade-leaderboard')).toHaveAttribute('data-game-id',games[1].id);
  await page.locator('.game-frame').evaluate(node=>{node.dataset.persistentCheck='same-game';});
  await page.getByRole('navigation').getByRole('link',{name:'AI-chat',exact:true}).click();
  await expect(page.locator('.game-frame')).toHaveAttribute('data-persistent-check','same-game');
  await expect(page.getByRole('combobox',{name:'Spillmodus',exact:true})).toHaveValue(games[1].id);
  await expect(page.locator('.arcade-chat textarea')).toBeInViewport();
});

test('logout pauses the mounted round and the same account can restore it without losing the game',async({page})=>{
  const calls=await setup(page);await page.addInitScript(installSerialMock,{info:fixture.deviceInfo.v2,snapshot:fixture.snapshots.v2});await page.goto('/#/play/snake');
  await page.locator('#connect').click();await page.getByRole('button',{name:'Start spill →'}).click();
  await expect(page.locator('.game-toolbar')).toContainText('NEDTELLING');
  await page.locator('.game-frame canvas').evaluate(node=>{node.dataset.persistentCheck='same-round';});
  await page.getByRole('navigation').getByRole('button',{name:'Logg ut',exact:true}).click();
  await expect(page.locator('.game-toolbar')).toContainText('PAUSE');
  await expect(page.locator('.game-frame canvas')).toHaveAttribute('data-persistent-check','same-round');
  await expect(page.locator('.arcade-chat textarea')).toBeDisabled();
  await page.getByRole('textbox',{name:'Brukernavn for å fortsette'}).fill(player.username);
  await page.getByRole('textbox',{name:'Passord for å fortsette'}).fill('langtnokpassord123');
  await page.getByRole('button',{name:'Logg inn med samme konto',exact:true}).click();
  await expect(page.locator('.arcade-chat textarea')).toBeEnabled();
  await expect(page.locator('.game-toolbar')).toContainText('PAUSE');
  await page.getByRole('button',{name:'→ Fortsett',exact:true}).click();
  await expect(page.locator('.game-toolbar')).toContainText('NEDTELLING');
  await expect(page.locator('.game-frame canvas')).toHaveAttribute('data-persistent-check','same-round');
  expect(calls.filter(path=>path.endsWith('/results'))).toEqual([]);
});

test('every game supports native fullscreen without replacing its canvas or clipping controls',async({page})=>{
  await page.setViewportSize({width:1440,height:1000});await setup(page);await page.goto('/');
  await expect(page.locator('.arcade-tools')).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Prøv Testlab ↗'})).toHaveCount(0);
  await expect(page.getByRole('navigation').getByRole('link',{name:'Testlab',exact:true})).toBeVisible();
  for(const {key} of families){
    await page.locator(`.cartridge-track [data-game="${key}"]`).click();
    const frame=page.locator('.game-frame'),toggle=frame.getByRole('button',{name:'Fullskjerm ⛶',exact:true});
    await expect(frame.locator('canvas')).toHaveAttribute('aria-label',`${families.find(family=>family.key===key).title} spillflate`);
    await expect(page.locator('.loading-cartridge')).toHaveCount(0);
    await frame.locator('canvas').evaluate(canvas=>{canvas.dataset.persistentCheck='same-canvas';});
    await expect(page.locator('.cabinet-screen').getByRole('link',{name:'← Spillvelgeren',exact:true})).toHaveCount(0);
    await toggle.click();
    await expect(frame.getByRole('button',{name:'Avslutt fullskjerm ⛶',exact:true})).toHaveAttribute('aria-pressed','true');
    expect(await frame.evaluate(node=>document.fullscreenElement===node)).toBe(true);
    const fits=await frame.evaluate(node=>{
      const bounds=node.getBoundingClientRect(),canvas=node.querySelector('canvas').getBoundingClientRect(),start=[...node.querySelectorAll('button')].find(button=>button.textContent==='Start spill →').getBoundingClientRect();
      return {full:Math.abs(bounds.width-innerWidth)<2&&Math.abs(bounds.height-innerHeight)<2,canvas:canvas.width>0&&canvas.height>0,start:start.top>=0&&start.bottom<=innerHeight};
    });
    expect(fits).toEqual({full:true,canvas:true,start:true});
    if(key==='snake')await page.evaluate(()=>document.exitFullscreen());
    else await frame.getByRole('button',{name:'Avslutt fullskjerm ⛶',exact:true}).click();
    await expect(toggle).toHaveAttribute('aria-pressed','false');
    await expect(frame.locator('canvas')).toHaveAttribute('data-persistent-check','same-canvas');
  }
});

test('fullscreen preserves an active round and exits cleanly when another game is loaded',async({page})=>{
  const calls=await setup(page);await page.addInitScript(installSerialMock,{info:fixture.deviceInfo.v2,snapshot:fixture.snapshots.v2});
  await page.goto('/#/play/viking');await page.locator('#connect').click();
  await page.getByRole('button',{name:'Start spill →'}).click();
  await expect(page.locator('.game-toolbar')).toContainText('SPILLER',{timeout:7000});
  await page.getByRole('button',{name:'Fullskjerm ⛶',exact:true}).click();
  await expect(page.locator('.game-toolbar')).toContainText('SPILLER');
  await page.getByRole('button',{name:'Avslutt fullskjerm ⛶',exact:true}).click();
  await expect(page.locator('.game-toolbar')).toContainText('SPILLER');
  expect(calls.filter(path=>path.endsWith('/results'))).toEqual([]);
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  await page.getByRole('button',{name:'Fullskjerm ⛶',exact:true}).click();
  page.once('dialog',dialog=>dialog.accept());
  await page.evaluate(()=>{location.hash='#/play/stars';});
  await expect(page.locator('.game-frame canvas')).toHaveAttribute('aria-label','Stjernefangst spillflate');
  expect(await page.evaluate(()=>document.fullscreenElement)).toBe(null);
});

test('a rejected fullscreen request shows a recoverable message inside the frame',async({page})=>{
  await setup(page);await page.addInitScript(()=>{Element.prototype.requestFullscreen=()=>Promise.reject(new Error('Denied'));});
  await page.goto('/#/play/snake');
  const toggle=page.getByRole('button',{name:'Fullskjerm ⛶',exact:true});await toggle.click();
  await expect(page.locator('.fullscreen-status')).toContainText('Prøv igjen.');
  await expect(toggle).toBeEnabled();await expect(toggle).toHaveAttribute('aria-pressed','false');
  await expect(page.getByRole('combobox',{name:'Spillmodus',exact:true})).toBeVisible();
});

test('fullscreen fits mobile Tetris and Viking menus and keeps the exit control visible',async({page})=>{
  await page.setViewportSize({width:390,height:844});await setup(page);await page.goto('/');
  for(const key of ['tetris','viking']){
    await page.locator(`.cartridge-track [data-game="${key}"]`).click();
    await expect(page.locator('.game-frame canvas')).toHaveAttribute('aria-label',`${families.find(family=>family.key===key).title} spillflate`);
    await expect(page.locator('.loading-cartridge')).toHaveCount(0);
    await page.getByRole('button',{name:'Fullskjerm ⛶',exact:true}).click();
    const exit=page.getByRole('button',{name:'Avslutt fullskjerm ⛶',exact:true});
    await expect(exit).toBeInViewport();await expect(page.getByRole('button',{name:'Start spill →'})).toBeInViewport();
    expect(await page.locator('.game-frame').evaluate(node=>node.scrollWidth<=innerWidth&&node.scrollHeight<=innerHeight)).toBe(true);
    await exit.click();
  }
});
