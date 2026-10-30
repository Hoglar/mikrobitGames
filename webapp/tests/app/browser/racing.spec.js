import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { games } from '../../../src/games/registry.js';
import { installSerialMock } from '../../microbit-input/browser/serial-mock.js';
const fixture=JSON.parse(readFileSync(new URL('../../../../spec/contracts/microbit-webapp/fixtures/conformance.json',import.meta.url)));
const player={id:'11111111-1111-4111-8111-111111111111',username:'Racer',created_at:'2026-10-01T12:00:00Z'};
const session={player,expires_at:'2026-11-01T12:00:00Z',absolute_expires_at:'2026-11-20T12:00:00Z'};
async function setup(page,{local=false}={}){
  const calls=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(installSerialMock,{info:fixture.deviceInfo.v2,snapshot:fixture.snapshots.v2});
  if(!local)await page.route('**/api/v1/**',async route=>{
    const req=route.request(),path=new URL(req.url()).pathname.replace('/api/v1',''),body=req.postDataJSON();calls.push({path,method:req.method(),body});let data={},status=200;
    if(path==='/auth/session'||path==='/auth/renew')data=session;
    else if(path==='/games')data={items:games.map(g=>({...g,is_active:true})),page:0,page_size:100,total:games.length};
    else if(path.endsWith('/leaderboard')){const game=games.find(g=>path.includes(g.id));data={game,items:game?.key==='racing'?[{rank:1,player,record:{value:game.score_unit==='racing_rank_v1'?1083456:83456}}]:[],page:0,page_size:10,total:game?.key==='racing'?1:0};}
    else if(path.endsWith('/results')&&req.method()==='POST'){
      status=201;const gameId=path.split('/')[2],record=body.status==='completed'?{id:'33333333-3333-4333-8333-333333333333',player_id:player.id,game_id:gameId,value:body.value,created_at:'2026-10-30T12:00:00Z'}:null;
      data={attempt:{id:body.attempt_id,player_id:player.id,game_id:gameId,status:body.status,value:body.value,created_at:'2026-10-30T12:00:00Z',record_outcome:record?'created':'not_eligible',record_id:record?.id??null},outcome:record?'created':'not_eligible',record,current_record:record};
    }else data={items:[],page:0,page_size:100,total:0};
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  });
  else page.on('request',request=>{if(new URL(request.url()).pathname.startsWith('/api/'))calls.push(request.url());});
  await page.goto(`${local?'http://127.0.0.1:4175':''}/#/play/racing`);
  await expect(page.getByRole('combobox',{name:'Racingbane'})).toBeVisible();
  return {calls,errors};
}
const status=page=>page.locator('.racing-live');
async function start(page){await page.locator('#connect').click();await expect(page.getByRole('button',{name:'Start spill →'})).toBeEnabled();await page.getByRole('button',{name:'Start spill →'}).click();await expect(page.locator('.game-frame')).toHaveAttribute('data-phase','playing',{timeout:7000});}
const sample=(page,fields)=>page.evaluate(fields=>window.serialMock.port.sample(fields),fields);

test('MR-02/16 all four choices update the preview and exact mode leaderboard',async({page})=>{
  const observed=await setup(page);
  await page.getByRole('combobox',{name:'Racingbane'}).selectOption('pine-valley');
  await page.getByRole('combobox',{name:'Løpsformat',exact:true}).selectOption('race');
  await page.getByRole('combobox',{name:'Antall runder'}).selectOption('3');
  await page.getByRole('combobox',{name:'Bilklasse'}).selectOption('formula');
  const selected=games.find(g=>g.key==='racing'&&g.config.track==='pine-valley'&&g.config.format==='race'&&g.config.laps===3&&g.config.car==='formula');
  await expect(page.locator('.arcade-leaderboard')).toHaveAttribute('data-game-id',selected.id);
  await expect(page.locator('.arcade-leaderboard')).toContainText('2. plass · 01:23.456');
  await expect(page.getByRole('link',{name:'Toppliste for valgt variant'})).toHaveAttribute('href',`#/leaderboard/${selected.id}`);
  await expect(page.locator('.racing-car-stats')).toContainText('158 km/t');
  await page.locator('#connect').click();await expect(page.getByRole('button',{name:'Start spill →'})).toBeEnabled();
  await page.screenshot({path:'build/racing-selection-desktop.png',fullPage:true});
  expect(observed.errors).toEqual([]);
});

test('MR-05/06/17 local real-adapter controls arm safely, steer, brake and freeze on reconnect',async({page})=>{
  const observed=await setup(page,{local:true});await page.getByRole('combobox',{name:'Løpsformat',exact:true}).selectOption('race');
  await page.locator('#connect').click();await sample(page,{b:1,bc:1});await page.getByRole('button',{name:'Start spill →'}).click();
  await expect(page.locator('.game-frame')).toHaveAttribute('data-phase','playing',{timeout:7000});
  await expect(status(page)).toContainText('Fart: 0 km/t.');
  await sample(page,{b:0});await expect(status(page)).toContainText('Kontroller klare.');
  await sample(page,{b:1,bc:2});await expect(status(page)).not.toContainText('Fart: 0 km/t.');
  await sample(page,{x:550});await expect(status(page)).toContainText('Ratt: høyre');
  await sample(page,{a:1,ac:1});await expect(status(page)).toContainText('Fart: 0 km/t.');
  await sample(page,{q:1,qc:1});await expect(page.locator('.game-frame')).toHaveAttribute('data-phase','paused');
  const frozen=await status(page).textContent();await page.waitForTimeout(250);expect(await status(page).textContent()).toBe(frozen);
  await page.evaluate(()=>window.serialMock.port.remove());await page.locator('#connect').click();
  await expect(page.locator('#connection-label')).toHaveText('Micro:bit er tilkoblet');await expect(page.locator('.game-frame')).toHaveAttribute('data-phase','paused');
  await sample(page,{a:0,b:0,q:0,x:0});await page.getByRole('button',{name:'→ Fortsett',exact:true}).click();
  await expect(page.locator('.game-frame')).toHaveAttribute('data-phase','playing',{timeout:7000});
  expect(observed.calls).toEqual([]);expect(observed.errors).toEqual([]);
});

test('MR-19 a ranked restart stores exactly one DNF with null instead of a false record time',async({page})=>{
  const observed=await setup(page);await page.getByRole('combobox',{name:'Løpsformat',exact:true}).selectOption('race');await start(page);
  await page.getByRole('button',{name:'Pause',exact:true}).click();await page.getByRole('button',{name:'Restart',exact:true}).click();
  await page.getByRole('button',{name:'Ja, avslutt',exact:false}).click();
  await expect.poll(()=>observed.calls.filter(c=>c.method==='POST'&&c.path.endsWith('/results')).length).toBe(1);
  const saved=observed.calls.find(c=>c.method==='POST'&&c.path.endsWith('/results'));
  expect(saved.body.status).toBe('incomplete');expect(saved.body.value).toBe(null);
  const selected=games.find(g=>g.key==='racing'&&g.config.track==='harbor-ring'&&g.config.format==='race'&&g.config.laps===1&&g.config.car==='race');
  expect(saved.path).toBe(`/games/${selected.id}/results`);await expect(page.locator('.game-frame')).toHaveAttribute('data-phase','countdown');expect(observed.errors).toEqual([]);
});

test('MR-09/21 recovery, mobile presentation, sound and fullscreen remain inside the arcade',async({page})=>{
  await page.setViewportSize({width:390,height:844});const observed=await setup(page,{local:true});
  await expect(page.getByRole('button',{name:'Motorlyd: av'})).toBeVisible();await page.getByRole('button',{name:'Motorlyd: av'}).click();
  await page.getByRole('slider',{name:'Motorvolum'}).fill('0');await start(page);
  await page.getByRole('button',{name:'Pause',exact:true}).click();await page.getByRole('button',{name:'Tilbake til banen',exact:true}).click();
  await page.getByRole('button',{name:'Ja, tilbake til banen',exact:true}).click();
  await expect(page.locator('.game-frame')).toHaveAttribute('data-phase','playing',{timeout:7000});
  await page.getByRole('button',{name:'Fullskjerm ⛶',exact:true}).click();await expect(page.getByRole('button',{name:'Avslutt fullskjerm ⛶',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.locator('.game-frame').screenshot({path:'build/racing-fullscreen-mobile.png'});
  await page.getByRole('button',{name:'Avslutt fullskjerm ⛶',exact:true}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(observed.errors).toEqual([]);expect(observed.calls).toEqual([]);
});

test('MR-10/14/19 a full driven lap through Web Serial submits a real completed result once',async({page})=>{
  test.setTimeout(90000);
  // Observe the rendered camera transform, as a player observes the screen.
  // The pilot never accesses the mounted engine or injects a finish/result.
  await page.addInitScript(()=>{
    const translate=CanvasRenderingContext2D.prototype.translate;
    CanvasRenderingContext2D.prototype.translate=function(x,y){
      const t=this.getTransform(),canvas=this.canvas;
      if(canvas.getAttribute('aria-label')==='Micro Racer spillflate'&&Math.abs(t.e-canvas.width/2)<.1&&Math.abs(t.f-canvas.height*.7)<.1&&Math.abs(Math.hypot(t.a,t.b)-canvas.height/110)<.01)
        window.racingPose={x:-x,y:-y,angle:-Math.atan2(t.b,t.a),time:performance.now()};
      return translate.call(this,x,y);
    };
  });
  await page.clock.install({time:new Date('2026-10-30T12:00:00Z')});const observed=await setup(page);
  await page.getByRole('combobox',{name:'Bilklasse'}).selectOption('race');
  await page.locator('#connect').click();await expect(page.getByRole('button',{name:'Start spill →'})).toBeEnabled();
  await page.clock.pauseAt(await page.evaluate(()=>Date.now()+500));
  await page.getByRole('button',{name:'Start spill →'}).click();
  for(let i=0;i<20&&(await page.locator('.game-frame').getAttribute('data-phase'))!=='countdown';i++)await page.clock.runFor(100);
  await page.clock.runFor(3400);await expect(page.locator('.game-frame')).toHaveAttribute('data-phase','playing');
  await sample(page,{x:0,a:0,b:0,q:0});await page.clock.runFor(200);
  await expect(status(page)).toContainText('Kontroller klare.');
  await page.evaluate(async()=>{
    const {driveAI}=await import('/src/games/micro-racer/ai.js'),{getTrack}=await import('/src/games/micro-racer/tracks.js'),{carProfile}=await import('/src/games/micro-racer/config.js');
    let previous=window.racingPose,vx=0,vy=0,a=false,b=false;
    const timer=setInterval(()=>{
      if(document.querySelector('.game-frame').dataset.phase!=='playing'){clearInterval(timer);return;}
      const pose=window.racingPose;if(!pose)return;
      if(previous&&pose.time>previous.time){const dt=(pose.time-previous.time)/1000;vx=(pose.x-previous.x)/dt;vy=(pose.y-previous.y)/dt;}
      previous=pose;const control=driveAI({id:'player',...pose,vx,vy},getTrack('harbor-ring'),carProfile('race'));
      const x=Math.sign(control.steer)*(.08+.67*Math.abs(control.steer)),raw=Math.round(Math.sign(x)*(50+Math.abs(x)*950));
      const port=window.serialMock.port;port.sample({x:raw,a:control.brake?1:0,b:control.throttle?1:0,ac:port.ac+(!a&&control.brake?1:0),bc:port.bc+(!b&&control.throttle?1:0)});a=control.brake;b=control.throttle;
    },50);
  });
  await page.clock.runFor(50000);
  await expect(page.locator('.game-frame')).toHaveAttribute('data-phase','result');
  await expect.poll(()=>observed.calls.filter(c=>c.method==='POST'&&c.path.endsWith('/results')).length).toBe(1);
  const result=observed.calls.find(c=>c.method==='POST'&&c.path.endsWith('/results'));
  expect(result.body.status).toBe('completed');expect(result.body.value).toBeGreaterThan(30000);expect(result.body.value).toBeLessThan(50000);
  await expect(page.locator('.game-overlay')).toContainText('Lagret · ny personlig rekord!');expect(observed.errors).toEqual([]);
});
