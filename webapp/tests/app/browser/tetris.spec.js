import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { games } from '../../../src/games/registry.js';
import { installSerialMock } from '../../microbit-input/browser/serial-mock.js';

const fixture=JSON.parse(readFileSync(new URL('../../../../spec/contracts/microbit-webapp/fixtures/conformance.json',import.meta.url)));
const player={id:'11111111-1111-4111-8111-111111111111',username:'Tetris',created_at:'2026-10-01T12:00:00Z'};
const session={player,expires_at:'2026-11-01T12:00:00Z',absolute_expires_at:'2026-11-20T12:00:00Z'};
async function setup(page){
  const calls=[];
  await page.addInitScript(installSerialMock,{info:fixture.deviceInfo.v2,snapshot:fixture.snapshots.v2});
  await page.addInitScript(()=>{
    const Native=globalThis.AudioContext;window.tetrisAudioProbe={contexts:[],sources:0};
    if(Native)globalThis.AudioContext=class extends Native{
      constructor(...args){super(...args);window.tetrisAudioProbe.contexts.push(this);}
      createOscillator(){window.tetrisAudioProbe.sources++;return super.createOscillator();}
    };
  });
  await page.route('**/api/v1/**',async route=>{
    const request=route.request(),path=new URL(request.url()).pathname,body=request.postDataJSON();calls.push({path,method:request.method(),body});
    let data,status=200;
    if(path.endsWith('/auth/session')||path.endsWith('/auth/renew'))data=session;
    else if(path.endsWith('/games'))data={items:games.map(g=>({...g,is_active:true})),page:0,page_size:100,total:games.length};
    else if(path.endsWith('/results')&&request.method()==='POST'){
      status=201;data={attempt:{id:body.attempt_id,player_id:player.id,game_id:path.split('/')[4],status:body.status,value:body.value,
        created_at:'2026-10-29T12:00:00Z',record_outcome:body.status==='completed'?'not_improved':'not_eligible',record_id:null},
        outcome:body.status==='completed'?'not_improved':'not_eligible',record:null,current_record:null};
    }else data={items:[],page:0,page_size:100,total:0};
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto('/#/play/tetris');await expect(page.locator('.tetris-theme')).toBeVisible();
  await page.locator('#connect').click();await expect(page.getByRole('button',{name:'Start spill →'})).toBeEnabled();
  return calls;
}
async function start(page,practice=true){
  if(practice){await page.getByRole('combobox',{name:'Rangert eller øving'}).selectOption('practice');await page.getByRole('textbox',{name:'Seed for øving'}).fill('demo');}
  await page.getByRole('button',{name:'Start spill →'}).click();
  await expect(page.locator('.game-toolbar')).toContainText('SPILLER',{timeout:7000});
}
const commands=page=>page.evaluate(()=>window.serialMock.commands);

test('TT-03/06/13/15/17 Tetris practice accepts real adapter inputs, displays hold and plays separate audio',async({page},testInfo)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));const calls=await setup(page);
  await expect(page.getByRole('checkbox',{name:'Micro:bit-musikk',exact:true})).toBeChecked();
  await expect(page.getByRole('checkbox',{name:'Nettlesereffekter',exact:true})).toBeChecked();
  expect((await commands(page)).some(c=>c.includes('|MELODY|'))).toBe(false);
  expect(await page.evaluate(()=>window.tetrisAudioProbe.contexts.length)).toBe(0);
  await start(page);
  await expect.poll(async()=>(await commands(page)).some(c=>c.includes('|S|MELODY|96|659:667,494:333,523:333'))).toBe(true);
  expect(await page.evaluate(()=>window.tetrisAudioProbe.contexts.at(-1).state)).toBe('running');
  await page.evaluate(()=>window.serialMock.port.sample({q:1,qc:1}));
  await expect.poll(async()=>(await commands(page)).some(c=>c.endsWith('|D|IMAGE|0000009900099000000000000'))).toBe(true);
  await page.evaluate(()=>window.serialMock.port.sample({q:0,b:1,bc:1}));
  await expect.poll(()=>page.evaluate(()=>window.tetrisAudioProbe.sources)).toBeGreaterThan(0);
  await page.evaluate(()=>window.serialMock.port.sample({b:0,a:1,ac:1}));
  await expect(page.locator('.game-toolbar')).toContainText(/[1-9][0-9]* poeng/);
  await page.evaluate(()=>window.serialMock.port.sample({a:0}));
  await page.locator('.game-frame').screenshot({path:testInfo.outputPath('tetris-desktop.png')});
  await page.keyboard.press('Escape');await expect(page.locator('.game-toolbar')).toContainText('PAUSE');
  expect(calls.some(c=>c.path.endsWith('/results')&&c.method==='POST')).toBe(false);expect(errors).toEqual([]);
});

test('TT-14/16 pause, mute, physical reconnect and mobile layout preserve the game and its hold',async({page},testInfo)=>{
  await setup(page);await start(page);
  await page.evaluate(()=>window.serialMock.port.sample({q:1,qc:1}));
  await expect.poll(async()=>(await commands(page)).some(c=>c.endsWith('|D|IMAGE|0000009900099000000000000'))).toBe(true);
  await page.evaluate(()=>{window.serialMock.port.sample({q:0});window.serialMock.port.remove();});
  await expect(page.locator('.game-toolbar')).toContainText('PAUSE');
  await page.locator('#connect').click();await expect(page.locator('#connection-label')).toHaveText('Micro:bit er tilkoblet');
  await expect(page.locator('.game-toolbar')).toContainText('PAUSE');
  await page.getByRole('checkbox',{name:'Micro:bit-musikk',exact:true}).uncheck();
  const melodyCount=(await commands(page)).filter(c=>c.includes('|MELODY|')).length;
  await page.getByRole('button',{name:'→ Fortsett',exact:true}).click();
  await expect(page.locator('.game-toolbar')).toContainText('SPILLER',{timeout:7000});
  expect((await commands(page)).filter(c=>c.includes('|MELODY|')).length).toBe(melodyCount);
  await expect.poll(async()=>(await commands(page)).filter(c=>c.endsWith('|D|IMAGE|0000009900099000000000000')).length).toBeGreaterThan(1);
  await page.getByRole('checkbox',{name:'Micro:bit-musikk',exact:true}).check();
  await expect.poll(async()=>(await commands(page)).filter(c=>c.includes('|MELODY|')).length).toBeGreaterThan(melodyCount);
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect(page.locator('.game-toolbar')).toContainText('SPILLER');
  await page.locator('.game-frame').screenshot({path:testInfo.outputPath('tetris-mobile.png')});
  await page.keyboard.press('Escape');await expect.poll(async()=>(await commands(page)).at(-1)).toMatch(/\|S\|STOP$/);
});

test('TT-18 ranked top-out submits exactly one completed result; restart reuses the page audio context',async({page})=>{
  const calls=await setup(page);await start(page,false);
  for(let i=1;i<=30;i++){
    await page.evaluate(i=>window.serialMock.port.sample({a:1,ac:i}),i);await page.waitForTimeout(55);
    await page.evaluate(()=>window.serialMock.port.sample({a:0}));await page.waitForTimeout(55);
    if(await page.locator('.game-toolbar').textContent().then(s=>s.includes('RESULTAT')))break;
  }
  await expect(page.locator('.game-toolbar')).toContainText('RESULTAT');
  await expect.poll(()=>calls.filter(c=>c.path.endsWith('/results')&&c.method==='POST').length).toBe(1);
  const result=calls.find(c=>c.path.endsWith('/results')&&c.method==='POST');
  expect(result.body.status).toBe('completed');expect(Number.isSafeInteger(result.body.value)).toBe(true);expect(result.path).toContain(games.find(g=>g.key==='tetris').id);
  await page.evaluate(()=>window.serialMock.port.sample({a:1,ac:window.serialMock.port.ac+1}));
  await expect(page.locator('.game-toolbar')).toContainText('NEDTELLING');
  await page.evaluate(()=>window.serialMock.port.sample({a:0}));
  expect(await page.evaluate(()=>window.tetrisAudioProbe.contexts.length)).toBe(1);
  expect(calls.filter(c=>c.path.endsWith('/results')&&c.method==='POST')).toHaveLength(1);
});

test('TT-09/11/12 render gallery shows a normal clear and a perfect-clear celebration without changing simulation',async({page},testInfo)=>{
  await page.goto('/');
  const result=await page.evaluate(async()=>{
    const {createTetris}=await import('/src/games/tetris/index.js'),{emptyBoard}=await import('/src/games/tetris/rules.js');
    const section=document.createElement('section');section.id='tetris-gallery';section.style.cssText='display:flex;gap:16px;background:#101522;padding:16px;color:white';document.body.append(section);
    const results=[];
    for(const lines of [1,4]){
      const board=emptyBoard();for(let y=20-lines;y<20;y++)for(let x=0;x<10;x++)if(x!==5)board[y+20][x]='J';
      let now=0,motionReduced=false;const game=createTetris({initial:{board,active:{type:'I',x:3,y:16,rotation:1}},clock:{now:()=>now},reducedMotion:()=>motionReduced});
      const neutral={inputAvailable:true,tilt:{x:0,y:0},buttons:{aPressed:false,bPressed:false},touch:{logoPressed:false}};
      game.input(neutral);now=100;game.input(neutral);game.setPlaying(true);game.press({input:'a'});game.tick(1/120);game.tick(.08);
      const panel=document.createElement('div'),caption=document.createElement('p'),canvas=document.createElement('canvas');canvas.width=720;canvas.height=480;canvas.style.width='540px';
      caption.textContent=lines===1?'SINGLE':'PERFECT CLEAR';panel.append(caption,canvas);section.append(panel);
      const before=JSON.stringify(game.state),ctx=canvas.getContext('2d'),translations=[],translate=ctx.translate.bind(ctx);
      ctx.translate=(x,y)=>{translations.push([x,y]);translate(x,y);};
      for(let i=0;i<4;i++)game.draw(ctx,720,480);
      const normalMoves=translations.some(([x,y])=>x!==0||y!==0);translations.length=0;motionReduced=true;game.draw(ctx,720,480);
      const reducedStill=translations.every(([x,y])=>x===0&&y===0);motionReduced=false;game.draw(ctx,720,480);
      results.push({score:game.value,lines:game.state.lines,particles:game.state.particles,tier:game.state.lastResult.effectClass,pure:before===JSON.stringify(game.state),normalMoves,reducedStill});game.dispose();
    }return results;
  });
  expect(result[0]).toMatchObject({score:100,lines:1,tier:1,particles:20,pure:true,normalMoves:false,reducedStill:true});expect(result[1]).toMatchObject({score:2800,lines:4,tier:5,particles:150,pure:true,normalMoves:true,reducedStill:true});
  await page.locator('#tetris-gallery').screenshot({path:testInfo.outputPath('tetris-clears.png')});
});
