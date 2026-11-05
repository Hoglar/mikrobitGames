import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {installSerialMock} from '../../microbit-input/browser/serial-mock.js';
const fixture=JSON.parse(readFileSync(new URL('../../../../spec/contracts/microbit-webapp/fixtures/conformance.json',import.meta.url)));
async function setup(page){
 await page.addInitScript(installSerialMock,{info:fixture.deviceInfo.v2,snapshot:fixture.snapshots.v2});
 await page.goto('http://127.0.0.1:4175/#/play/tetris');await page.locator('#connect').click();
}
async function pixels(page){return page.frameLocator('.cartridge-runtime').locator('canvas').evaluate(canvas=>{
 const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data,colors=new Set();
 for(let i=0;i<data.length;i+=4*17)if(data[i+3])colors.add((data[i]<<16)|(data[i+1]<<8)|data[i+2]);
 return {width:canvas.width,height:canvas.height,colors:colors.size};
});}

test('Tetris recovers a viewport resized while its game module is still loading',async({page})=>{
 await setup(page);
 await page.route('**/cartridges/*/payload.json',async route=>{
   const response=await route.fetch(),payload=await response.json();
   payload.bundle='await new Promise(resolve=>{globalThis.finishModuleLoad=resolve;});\n'+payload.bundle;
   await route.fulfill({response,json:payload});
 });
 await page.locator('.cartridge-stage').evaluate(node=>{node.style.width='0px';node.style.height='0px';});
 await page.getByRole('button',{name:'Start spill →'}).click();
 await expect(page.locator('.cartridge-runtime')).toHaveCount(1);
 const child=page.frames().find(frame=>frame.parentFrame());
 await child.waitForFunction(()=>typeof globalThis.finishModuleLoad==='function');
 await page.locator('.cartridge-stage').evaluate(node=>{node.style.removeProperty('width');node.style.removeProperty('height');});
 await child.waitForFunction(()=>innerWidth>100&&innerHeight>100);
 await child.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await child.evaluate(()=>globalThis.finishModuleLoad());
 await expect(page.locator('.game-frame')).toHaveAttribute('data-phase','playing',{timeout:8000});
 await expect.poll(async()=>(await pixels(page)).width).toBeGreaterThan(100);
 await expect.poll(async()=>(await pixels(page)).colors).toBeGreaterThan(10);
 expect(await page.evaluate(()=>document.fullscreenElement)).toBe(null);
});

test('repeated active game switches redraw Tetris without needing fullscreen',async({page})=>{
 test.setTimeout(70000);await setup(page);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(let round=0;round<4;round++){
   await page.getByRole('button',{name:'Start spill →'}).click();
   await expect(page.locator('.game-frame')).toHaveAttribute('data-phase','playing',{timeout:8000});
   await expect.poll(async()=>(await pixels(page)).colors).toBeGreaterThan(10);
   await page.locator('.game-cartridge[data-game=viking]').click();
   await page.getByRole('dialog').getByRole('button',{name:'Ja, fortsett',exact:true}).click();
   await page.getByRole('button',{name:'Start spill →'}).click();
   await expect(page.locator('.game-frame')).toHaveAttribute('data-phase','playing',{timeout:8000});
   await page.locator('.game-cartridge[data-game=tetris]').click();
   await page.getByRole('dialog').getByRole('button',{name:'Ja, fortsett',exact:true}).click();
   await expect(page.locator('.game-frame')).toHaveAttribute('data-phase','ready');
   await expect(page.locator('.cartridge-runtime')).toHaveCount(0);
 }
 expect(errors).toEqual([]);expect(await page.evaluate(()=>window.serialMock.port.hellos)).toBe(1);
});

test('Tetris follows iframe layout changes even when a window resize notification is missed',async({page})=>{
 await page.addInitScript(()=>{window.addEventListener('resize',event=>event.stopImmediatePropagation(),true);});
 await setup(page);await page.getByRole('button',{name:'Start spill →'}).click();
 await expect(page.locator('.game-frame')).toHaveAttribute('data-phase','playing',{timeout:8000});
 await page.locator('.cartridge-stage').evaluate(node=>{node.style.width='450px';node.style.height='640px';});
 const child=page.frames().find(frame=>frame.parentFrame());
 await child.waitForFunction(()=>innerWidth===450&&innerHeight===640);
 const expected=await child.evaluate(()=>({width:Math.round(innerWidth*Math.min(2,devicePixelRatio)),height:Math.round(innerHeight*Math.min(2,devicePixelRatio))}));
 await expect.poll(async()=>(await pixels(page)).width).toBe(expected.width);
 await expect.poll(async()=>(await pixels(page)).height).toBe(expected.height);
 await expect.poll(async()=>(await pixels(page)).colors).toBeGreaterThan(10);
 await expect(page.locator('.game-frame')).toHaveAttribute('data-phase','playing');
});
