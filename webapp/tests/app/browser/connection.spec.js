import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {installSerialMock} from '../../microbit-input/browser/serial-mock.js';
const fixture=JSON.parse(readFileSync(new URL('../../../../spec/contracts/microbit-webapp/fixtures/conformance.json',import.meta.url)));
async function setup(page){
 await page.addInitScript(installSerialMock,{info:fixture.deviceInfo.v2,snapshot:fixture.snapshots.v2});
 await page.goto('http://127.0.0.1:4175/#/play/snake');
 await page.evaluate(async()=>{const {microbit}=await import('/src/microbit-input/index.js');window.connectionErrors=[];microbit.onError(e=>window.connectionErrors.push({kind:e.kind,message:e.message}));});
}
async function start(page){await page.locator('#connect').click();await page.getByRole('button',{name:'Start spill →'}).click();await expect(page.locator('.game-frame')).toHaveAttribute('data-phase','playing',{timeout:8000});}

test('connecting to a streaming micro:bit ignores a partial old JSON record before the handshake',async({page})=>{
 await setup(page);
 await page.evaluate(()=>{
   const port=window.serialMock.port,line=port.line;
   port.line=function(text){if(text==='HELLO|1')this.emit('"y":0,"z":-1000,"t":21,"l":0,"m":0}\n');return line.call(this,text);};
 });
 await page.locator('#connect').click();
 await expect(page.locator('#connection-label')).toHaveText('Micro:bit er tilkoblet');
 expect(await page.evaluate(()=>window.connectionErrors)).toEqual([]);
 expect(await page.evaluate(()=>window.serialMock.port.hellos)).toBe(1);
 await page.getByRole('button',{name:'Start spill →'}).click();
 await expect(page.locator('.game-frame')).toHaveAttribute('data-phase','playing',{timeout:8000});
 expect(await page.evaluate(()=>window.connectionErrors)).toEqual([]);
});

test('a new website connection survives an output command interrupted by the previous page',async({page})=>{
 await setup(page);
 // A page can close between the 16-byte output chunks. The physical board's
 // receive buffer survives the page; opening Web Serial does not clear it.
 await page.evaluate(()=>{window.serialMock.port.pending='C|1|17|D|TEXT|HEL';});
 await page.locator('#connect').click();
 await expect(page.locator('#connection-label')).toHaveText('Micro:bit er tilkoblet');
 expect(await page.evaluate(()=>window.serialMock.port.hellos)).toBe(1);
 expect(await page.evaluate(()=>window.connectionErrors.some(e=>e.message.includes('handshake deadline')))).toBe(false);
});

test('a fast serial recovery pauses the sandbox immediately and requires explicit continuation',async({page})=>{
 await setup(page);await start(page);
 await page.evaluate(()=>window.serialMock.port.readError());
 await expect.poll(()=>page.evaluate(()=>window.serialMock.port.hellos)).toBe(2);
 await expect(page.locator('#connection-label')).toHaveText('Micro:bit er tilkoblet');
 await expect(page.locator('.game-frame')).toHaveAttribute('data-phase','paused');
 expect(await page.evaluate(()=>window.serialMock.choices)).toBe(1);
 await page.getByRole('button',{name:'→ Fortsett',exact:true}).click();
 await expect(page.locator('.game-frame')).toHaveAttribute('data-phase','playing',{timeout:8000});
});

test('a split record across a browser stall recovers once without a false JSON error and leaves the game paused',async({page})=>{
 await setup(page);await start(page);
 await page.evaluate(async()=>{
   const port=window.serialMock.port;clearInterval(port.timer);port.timer=null;
   const line=JSON.stringify({...port.latest,n:port.n,u:port.u,a:1,ac:100})+'\n';
   port.emit(line.slice(0,80));await new Promise(resolve=>setTimeout(resolve,20));
   const end=performance.now()+600;while(performance.now()<end){} // Deliberately model a blocked UI thread.
   port.emit(line.slice(80));
 });
 await expect.poll(()=>page.evaluate(()=>window.serialMock.port.hellos)).toBe(2);
 await expect(page.locator('#connection-label')).toHaveText('Micro:bit er tilkoblet');
 await expect(page.locator('.game-frame')).toHaveAttribute('data-phase','paused');
 const errors=await page.evaluate(()=>window.connectionErrors);
 expect(errors.some(e=>e.message==='Sensor input became stale')).toBe(true);
 expect(errors.some(e=>e.message==='Malformed JSON')).toBe(false);
 expect(await page.evaluate(()=>window.serialMock.choices)).toBe(1);
});

test('Testlab exports freshness timing so a real-device dropout can be investigated',async({page})=>{
 await setup(page);await page.goto('http://127.0.0.1:4175/#/testlab');
 await page.locator('#main').getByRole('button',{name:'Koble til micro:bit',exact:true}).click();
 await expect(page.locator('#connection-label')).toHaveText('Micro:bit er tilkoblet');
 await page.getByRole('button',{name:'Start nytt opptak',exact:true}).click();
 await page.evaluate(()=>{window.serialMock.silent=true;});
 await expect(page.locator('#main')).toContainText('Sensor input became stale');
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Last ned JSON',exact:true}).click();
 const downloaded=await pending,recording=JSON.parse(readFileSync(await downloaded.path(),'utf8'));
 const diagnostic=recording.events.find(e=>e.event.type==='diagnostic'&&e.event.message==='Sensor input became stale')?.event;
 expect(diagnostic.snapshotAgeMs).toBeGreaterThanOrEqual(500);
 expect(diagnostic.freshnessOverrunMs).toBeGreaterThanOrEqual(0);
});

test('taking time to confirm a mid-game switch keeps serial input fresh',async({page})=>{
 await setup(page);await page.goto('http://127.0.0.1:4175/#/play/viking');await start(page);
 let nativeDialogs=0;
 page.on('dialog',async dialog=>{nativeDialogs++;await new Promise(resolve=>setTimeout(resolve,900));await dialog.accept();});
 await page.locator('.game-cartridge[data-game=tetris]').click();
 const confirmation=page.getByRole('dialog');
 await expect(confirmation).toBeVisible();
 const before=await page.evaluate(()=>window.serialMock.port.n);
 await page.waitForTimeout(900);
 expect(await page.evaluate(()=>window.serialMock.port.n)).toBeGreaterThan(before+20);
 await confirmation.getByRole('button',{name:'Ja, fortsett',exact:true}).click();
 await expect(page.locator('.game-frame')).toHaveAttribute('data-phase','ready');
 await expect(page.locator('.cartridge-stage')).toHaveAttribute('aria-label','Micro Tetris spillflate');
 expect(await page.evaluate(()=>window.connectionErrors)).toEqual([]);
 expect(await page.evaluate(()=>window.serialMock.port.hellos)).toBe(1);
 expect(nativeDialogs).toBe(0);
});

test('cancelling a mid-game switch preserves the paused game and connection',async({page})=>{
 await setup(page);await page.goto('http://127.0.0.1:4175/#/play/viking');await start(page);
 await page.locator('.cartridge-runtime').evaluate(node=>{node.dataset.retained='original';});
 await page.locator('.game-cartridge[data-game=tetris]').click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await expect(page.locator('.game-frame')).toHaveAttribute('data-phase','paused');
 await page.evaluate(()=>window.serialMock.port.sample({a:1,b:1,ac:1,bc:1}));
 await page.waitForTimeout(700);
 await expect(page.locator('.game-frame')).toHaveAttribute('data-phase','paused');
 await page.getByRole('dialog').press('Escape');
 await expect(page).toHaveURL(/#\/play\/viking$/);
 await expect(page.locator('.cartridge-runtime')).toHaveAttribute('data-retained','original');
 await page.evaluate(()=>window.serialMock.port.sample({a:0,b:0}));
 await page.getByRole('button',{name:'→ Fortsett',exact:true}).click();
 await expect(page.locator('.game-frame')).toHaveAttribute('data-phase','playing',{timeout:8000});
 expect(await page.evaluate(()=>window.connectionErrors)).toEqual([]);
 expect(await page.evaluate(()=>window.serialMock.port.hellos)).toBe(1);
});

test('cancelling an unsaved-result prompt retains the local name without interrupting input',async({page})=>{
 await setup(page);await start(page);
 const name=page.getByRole('textbox',{name:'Navn på lokal toppliste',exact:true});
 await name.fill('Behold meg');
 await page.locator('.game-cartridge[data-game=tetris]').click();
 await expect(page.getByRole('dialog')).toContainText('uten å lagre');
 await page.waitForTimeout(700);
 await page.getByRole('dialog').getByRole('button',{name:'Avbryt',exact:true}).click();
 await expect(page).toHaveURL(/#\/play\/snake$/);
 await expect(name).toHaveValue('Behold meg');
 expect(await page.evaluate(()=>window.connectionErrors)).toEqual([]);
 expect(await page.evaluate(()=>window.serialMock.port.hellos)).toBe(1);
});
