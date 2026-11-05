import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {families} from '../../../src/games/registry.js';
import {installSerialMock} from '../../microbit-input/browser/serial-mock.js';
const fixture=JSON.parse(readFileSync(new URL('../../../../spec/contracts/microbit-webapp/fixtures/conformance.json',import.meta.url)));
async function setup(page,key='snake'){
 await page.addInitScript(installSerialMock,{info:fixture.deviceInfo.v2,snapshot:fixture.snapshots.v2});
 await page.goto(`http://127.0.0.1:4175/#/play/${key}`);
}
async function start(page){if(await page.locator('#connection-label').textContent()!=='Micro:bit er tilkoblet')await page.locator('#connect').click();await expect(page.getByRole('button',{name:'Start spill →'})).toBeEnabled();await page.getByRole('button',{name:'Start spill →'}).click();await expect(page.locator('.game-frame')).toHaveAttribute('data-phase','playing',{timeout:8000});}

test('every game has one toolbar audio control and an unobstructed canvas; preference survives game changes',async({page})=>{
 test.setTimeout(65000);await setup(page);
 await page.getByRole('slider',{name:'Spillvolum'}).fill('0.35');
 let played=false;for(const family of families){
   await page.goto(`http://127.0.0.1:4175/#/play/${family.key}`);
   if(played)await page.getByRole('dialog').getByRole('button',{name:'Ja, fortsett',exact:true}).click();
   await expect(page.locator('.game-frame')).toHaveAttribute('data-phase','ready');
   await expect(page.getByRole('slider')).toHaveCount(1);
   await expect(page.getByRole('slider',{name:'Spillvolum'})).toHaveValue('0.35');
   await expect(page.getByRole('button',{name:'Lyd: av',exact:true})).toHaveAttribute('aria-pressed','false');
   await start(page);played=true;
   await expect(page.frameLocator('.cartridge-runtime').locator('input,button')).toHaveCount(0);
   await expect(page.locator('.game-settings')).toBeEmpty();
   const toolbar=await page.locator('.game-toolbar').boundingBox(),stage=await page.locator('.cartridge-stage').boundingBox(),controls=await page.locator('.game-audio').boundingBox();
   expect(controls.y).toBeGreaterThanOrEqual(toolbar.y);expect(controls.y+controls.height).toBeLessThanOrEqual(stage.y);
 }
 await page.getByRole('button',{name:'Lyd: av',exact:true}).click();
 await page.reload();await expect(page.getByRole('button',{name:'Lyd: på',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByRole('slider',{name:'Spillvolum'})).toHaveValue('0.35');
});

test('shared volume changes Tetris speaker output, mute stops it, and zero volume stays silent through resume',async({page})=>{
 await setup(page,'tetris');await start(page);
 await page.getByRole('slider',{name:'Spillvolum'}).fill('0.5');await page.getByRole('button',{name:'Lyd: av',exact:true}).click();
 const melodies=()=>page.evaluate(()=>window.serialMock.commands.filter(c=>c.includes('|S|MELODY|')));
 await expect.poll(melodies).toContainEqual(expect.stringContaining('|S|MELODY|48|'));
 await page.getByRole('slider',{name:'Spillvolum'}).fill('0');
 await expect.poll(()=>page.evaluate(()=>window.serialMock.commands.at(-1))).toMatch(/\|S\|STOP$/);
 const count=(await melodies()).length;
 await page.getByRole('button',{name:'Pause',exact:true}).click();await page.getByRole('button',{name:'→ Fortsett',exact:true}).click();
 await expect(page.locator('.game-frame')).toHaveAttribute('data-phase','playing',{timeout:8000});
 expect((await melodies()).length).toBe(count);
 await page.getByRole('slider',{name:'Spillvolum'}).fill('0.25');
 await expect.poll(melodies).toContainEqual(expect.stringContaining('|S|MELODY|24|'));
 await page.getByRole('button',{name:'Lyd: på',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.serialMock.commands.at(-1))).toMatch(/\|S\|STOP$/);
});

test('toolbar audio stays above the canvas on narrow screens and in fullscreen',async({page},testInfo)=>{
 await page.setViewportSize({width:390,height:844});await setup(page,'racing');await start(page);
 for(const width of [390,320,1440]){
   await page.setViewportSize({width,height:900});
   await page.getByRole('button',{name:'Fullskjerm ⛶',exact:true}).click();
   await expect(page.getByRole('button',{name:'Avslutt fullskjerm ⛶',exact:true})).toHaveAttribute('aria-pressed','true');
   const controls=await page.locator('.game-audio').boundingBox(),stage=await page.locator('.cartridge-stage').boundingBox();
   expect(controls.x).toBeGreaterThanOrEqual(0);expect(controls.x+controls.width).toBeLessThanOrEqual(width);
   expect(controls.y+controls.height).toBeLessThanOrEqual(stage.y);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
   if(width===390||width===1440)await page.locator('.game-frame').screenshot({path:testInfo.outputPath(`shared-audio-fullscreen-${width}.png`)});
   await page.getByRole('button',{name:'Avslutt fullskjerm ⛶',exact:true}).click();
 }
});

test('Racer uses the toolbar volume for its browser motor voice without an extra sound switch',async({page})=>{
 await page.addInitScript(()=>{
   const Native=globalThis.AudioContext;window.motorAudio={contexts:[],gains:[]};
   if(Native)globalThis.AudioContext=class extends Native{
     constructor(...args){super(...args);window.motorAudio.contexts.push(this);}
     createGain(){const node=super.createGain();window.motorAudio.gains.push(node.gain);return node;}
   };
 });
 await setup(page,'racing');await start(page);
 expect(await page.frames().find(f=>f.parentFrame()).evaluate(()=>window.motorAudio.contexts.length)).toBe(0);
 await page.getByRole('button',{name:'Lyd: av',exact:true}).click();
 const child=page.frames().find(f=>f.parentFrame());
 await expect.poll(()=>child.evaluate(()=>window.motorAudio.contexts.at(-1)?.state)).toBe('running');
 await expect.poll(()=>child.evaluate(()=>window.motorAudio.gains.at(-1)?.value)).toBeCloseTo(.036,3);
 await page.getByRole('slider',{name:'Spillvolum'}).fill('0.5');
 await expect.poll(()=>child.evaluate(()=>window.motorAudio.gains.at(-1)?.value)).toBeCloseTo(.018,3);
 await expect(child.locator('input,button')).toHaveCount(0);
});
