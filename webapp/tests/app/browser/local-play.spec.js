import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { families } from '../../../src/games/registry.js';
import { installSerialMock } from '../../microbit-input/browser/serial-mock.js';

const fixture=JSON.parse(readFileSync(new URL('../../../../spec/contracts/microbit-webapp/fixtures/conformance.json',import.meta.url)));
test.use({baseURL:'http://127.0.0.1:4175'});

async function setup(page,key='tetris'){
  const requests=[],errors=[];
  page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))requests.push(r.url());});
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(installSerialMock,{info:fixture.deviceInfo.v2,snapshot:fixture.snapshots.v2});
  await page.goto(`/#/play/${key}`);
  await expect(page.locator('#navigation')).toContainText('LOKALT · UTEN LAGRING');
  return {requests,errors};
}
async function connectAndStart(page){
  await page.locator('#connect').click();
  await expect(page.getByRole('button',{name:'Start spill →'})).toBeEnabled();
  await page.getByRole('button',{name:'Start spill →'}).click();
  await expect(page.locator('.game-toolbar')).toContainText('SPILLER',{timeout:7000});
}
async function assertLocalOnly(page,observed){
  const state=await page.evaluate(async()=>{
    const {context}=await import('/src/app/main.js');
    return {local:context.localPlay,session:context.session,queued:context.queue.list().length,stored:Object.keys(localStorage)};
  });
  expect(state).toEqual({local:true,session:null,queued:0,stored:[]});
  expect(observed.requests).toEqual([]);expect(observed.errors).toEqual([]);
}

for(const family of families)test(`local ${family.key} starts without an account or backend, using the production input adapter`,async({page})=>{
  const observed=await setup(page,family.key);
  await expect(page.locator('.game-frame canvas')).toBeVisible();
  await expect(page.getByRole('button',{name:'Start spill →'})).toBeDisabled();
  const mode=page.getByRole('combobox',{name:'Rangert eller øving'});
  await expect(mode).toBeDisabled();await expect(mode).toHaveValue('practice');await expect(mode.locator('option')).toHaveCount(1);
  if(family.key==='snake')await expect(page.getByRole('combobox',{name:'Spillmodus'}).locator('option')).toHaveCount(6);
  await connectAndStart(page);
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  await expect(page.locator('.game-toolbar')).toContainText('PAUSE');
  await expect(page.getByRole('button',{name:'Logg inn med samme konto'})).toHaveCount(0);
  await assertLocalOnly(page,observed);
});

test('local Tetris processes inputs/output, reconnects, resumes and restarts without saving',async({page})=>{
  const observed=await setup(page);
  await page.getByRole('textbox',{name:'Seed for øving'}).fill('demo');
  await connectAndStart(page);
  await page.evaluate(()=>window.serialMock.port.sample({q:1,qc:1}));
  await expect.poll(()=>page.evaluate(()=>window.serialMock.commands.some(c=>c.endsWith('|D|IMAGE|0000009900099000000000000')))).toBe(true);
  await page.evaluate(()=>window.serialMock.port.sample({q:0,a:1,ac:1}));
  await expect(page.locator('.game-toolbar')).toContainText(/[1-9][0-9]* poeng/);
  await page.evaluate(()=>{window.serialMock.port.sample({a:0});window.serialMock.port.remove();});
  await expect(page.locator('.game-toolbar')).toContainText('PAUSE');
  await page.locator('#connect').click();
  await expect(page.locator('#connection-label')).toHaveText('Micro:bit er tilkoblet');
  await page.getByRole('button',{name:'→ Fortsett',exact:true}).click();
  await expect(page.locator('.game-toolbar')).toContainText('SPILLER',{timeout:7000});
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Restart',exact:true}).click();
  await page.getByRole('button',{name:'Ja, avslutt',exact:false}).click();
  await expect(page.locator('.game-toolbar')).toContainText('NEDTELLING');
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  await page.getByRole('button',{name:'Hovedmeny',exact:true}).click();
  await page.getByRole('button',{name:'Ja, avslutt',exact:false}).click();
  await expect(page.getByRole('button',{name:'Start spill →'})).toBeEnabled();
  await assertLocalOnly(page,observed);
});

test('local completed round shows its score and can restart without account/results links',async({page})=>{
  const observed=await setup(page,'snake');await connectAndStart(page);
  await expect(page.locator('.game-toolbar')).toContainText('RESULTAT',{timeout:7000});
  await expect(page.locator('.game-overlay')).toContainText('Godt spilt!');
  await expect(page.locator('.game-overlay')).toContainText('Øving · resultatet lagres ikke i backend.');
  await expect(page.getByRole('link',{name:'Se Dashboard'})).toHaveCount(0);
  await page.getByRole('button',{name:'Spill igjen →'}).click();
  await expect(page.locator('.game-toolbar')).toContainText('NEDTELLING');
  await assertLocalOnly(page,observed);
});

test('local account, database and AI routes are blocked in the UI, API client and server',async({page,request})=>{
  const observed=await setup(page);
  expect(readFileSync(new URL('../../../dist/index.html',import.meta.url),'utf8')).not.toContain('microbit-local-play');
  expect(await (await request.get('/index.html')).text()).toContain('name="microbit-local-play" content="true"');
  expect(await (await request.get('http://127.0.0.1:4176/index.html')).text()).not.toContain('microbit-local-play');
  for(const route of ['login','register','dashboard','profile','leaderboard/anything','history/anything']){
    await page.goto(`/#/${route}`);await expect(page.getByRole('heading',{name:'Bare lokalt spill'})).toBeVisible();
    await expect(page.locator('form')).toHaveCount(0);
  }
  await page.goto('/#/ai');
  await expect(page.locator('.arcade-chat')).toContainText('AI-chat er deaktivert i lokal øving.');
  await expect(page.locator('.arcade-chat textarea')).toBeDisabled();
  await expect(page.locator('form')).toHaveCount(0);
  const codes=await page.evaluate(async()=>{
    const {context}=await import('/src/app/main.js'),codes=[];
    for(const path of ['/auth/session','/games','/ai/questions'])try{await context.api(path,{method:'POST'});}catch(e){codes.push(e.code);}
    return codes;
  });
  expect(codes).toEqual(['LOCAL_PLAY_BLOCKED','LOCAL_PLAY_BLOCKED','LOCAL_PLAY_BLOCKED']);
  for(const path of ['/api/v1/auth/session','/api/v1/games','/api/v1/games/anything/results','/api/v1/ai/questions']){
    const response=await request.post(path,{data:{}});expect(response.status()).toBe(403);
    expect((await response.json()).error.code).toBe('LOCAL_PLAY_BLOCKED');
  }
  await assertLocalOnly(page,observed);
});
