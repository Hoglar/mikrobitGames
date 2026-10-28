import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { installSerialMock } from './serial-mock.js';

const fixture = JSON.parse(readFileSync(new URL('../../../../spec/contracts/microbit-webapp/fixtures/conformance.json', import.meta.url), 'utf8'));
test.beforeEach(async ({ page }) => {
  await page.addInitScript(installSerialMock, { info: fixture.deviceInfo.v2, snapshot: fixture.snapshots.v2 });
  await page.goto('/examples/microbit-input/');
});

test('GI-01/17/20 real browser streams, two games, output encoding and unlocked cleanup', async ({ page }) => {
  const failures = []; page.on('pageerror', e => failures.push(e.message));
  await expect(page.locator('#counter')).toBeDisabled();
  await page.locator('#connect').click(); await expect(page.locator('#connection')).toHaveText('Connected · input ready');
  await page.locator('#counter').click(); await expect(page.locator('#game-status')).toHaveText('Button counter · playing');
  // Let the first post-creation sample establish the game's baseline.
  await page.waitForTimeout(50);
  await page.evaluate(() => window.serialMock.port.sample({ ac: 3 })); await expect(page.locator('#score')).toHaveText('3');
  await page.locator('#tone').click();
  await expect.poll(() => page.evaluate(() => window.serialMock.commands.some(s => s.endsWith('S|TONE|440|500|128')))).toBe(true);
  await page.locator('#cursor').click(); await expect(page.locator('#game-status')).toHaveText('Tilt cursor · playing');
  expect(await page.evaluate(() => window.serialMock.commands.slice(-2).map(s => s.split('|')[4]))).toEqual(['STOP', 'CLEAR']);
  await page.evaluate(() => window.serialMock.port.sample({ x: 525, y: -525 }));
  await expect.poll(() => page.locator('#cursor-dot').evaluate(el => el.style.left)).toBe('71.5%');
  await page.locator('#exit').click(); await expect(page.locator('#game-status')).toHaveText('No game running');
  await page.locator('#disconnect').click(); await expect(page.locator('#connection')).toHaveText('Disconnected');
  expect(await page.evaluate(() => window.serialMock.port.closeLocked)).toBe(false);
  expect(await page.evaluate(() => window.serialMock.port.closeCalls)).toBe(1);
  expect(failures).toEqual([]);
});

test('GI-10/16 silence neutralizes controls, recovery retains game and waits for explicit continuation', async ({ page }) => {
  await page.locator('#connect').click(); await expect(page.locator('#connection')).toHaveText('Connected · input ready');
  await page.locator('#counter').click();
  await page.evaluate(() => { window.serialMock.silent = true; });
  await expect(page.locator('#game-status')).toHaveText('Button counter · paused');
  await expect(page.locator('#connection')).toHaveText('Connecting · input unavailable');
  expect(await page.evaluate(async () => (await import('/src/microbit-input/index.js')).microbit.getState().buttons.aPressed)).toBe(false);
  await page.evaluate(() => { window.serialMock.silent = false; });
  await expect(page.locator('#connection')).toHaveText('Connected · input ready');
  await expect(page.locator('#game-status')).toHaveText('Button counter · paused');
  await page.locator('#resume').click(); await expect(page.locator('#game-status')).toHaveText('Button counter · playing');
  expect(await page.evaluate(() => window.serialMock.choices)).toBe(1);
  await page.locator('#disconnect').click();
});

test('GI-10/20 physical reconnect uses the same game facade and does not replay old counts', async ({ page }) => {
  await page.locator('#connect').click(); await expect(page.locator('#counter')).toBeEnabled(); await page.locator('#counter').click();
  await page.waitForTimeout(50); await page.evaluate(() => window.serialMock.port.sample({ ac: 2 })); await expect(page.locator('#score')).toHaveText('2');
  await page.evaluate(() => window.serialMock.port.remove()); await expect(page.locator('#connection')).toHaveText('Disconnected');
  await expect(page.locator('#game-status')).toHaveText('Button counter · paused');
  await page.locator('#connect').click(); await expect(page.locator('#connection')).toHaveText('Connected · input ready');
  await expect(page.locator('#score')).toHaveText('2'); await expect(page.locator('#game-status')).toHaveText('Button counter · paused');
  await page.locator('#resume').click(); await page.evaluate(() => window.serialMock.port.sample({ ac: 3 })); await expect(page.locator('#score')).toHaveText('3');
  await page.locator('#disconnect').click();
});

test('GI-20 a native readable stream replacement recovers without another chooser', async ({ page }) => {
  await page.locator('#connect').click(); await expect(page.locator('#connection')).toHaveText('Connected · input ready');
  await page.evaluate(() => window.serialMock.port.readError());
  await expect.poll(() => page.evaluate(() => window.serialMock.port.hellos)).toBe(2);
  await expect(page.locator('#connection')).toHaveText('Connected · input ready');
  expect(await page.evaluate(() => window.serialMock.choices)).toBe(1);
  await page.locator('#disconnect').click(); expect(await page.evaluate(() => window.serialMock.port.closeLocked)).toBe(false);
});

test('GI-14/20 unsupported board and denied chooser produce a usable error and no game', async ({ page }) => {
  await page.evaluate(() => { window.serialMock.deny = true; }); await page.locator('#connect').click();
  await expect(page.locator('#error')).toContainText('Permission denied'); await expect(page.locator('#counter')).toBeDisabled();
  await page.evaluate(() => { window.serialMock.deny = false; window.serialMock.info.board = 'microbit-v1'; });
  await page.locator('#connect').click(); await expect(page.locator('#error')).toContainText('Unsupported board');
  await expect(page.locator('#connection')).toHaveText('Disconnected');
  expect(await page.evaluate(() => window.serialMock.port.closeLocked)).toBe(false);
});

test('sensor checks retain a one-snapshot shake and distinguish zero light from unavailable input', async ({ page }) => {
  await expect(page.locator('#light-value')).toHaveText('Unavailable');
  await page.locator('#connect').click(); await expect(page.locator('#counter')).toBeEnabled();
  await page.locator('#counter').click();
  await page.evaluate(() => {
    const port = window.serialMock.port; clearInterval(port.timer); port.timer = null;
    // Establish a baseline, then three alternating >=1200 mg changes on X.
    for (const x of [-800, 800, -800, 800]) port.sample({ x, y: 0, z: -1000, l: 0 });
    port.sample({ x: 800, l: 0 }); // The public gesture pulse is already over.
    port.timer = setInterval(() => port.sample(), 20);
  });
  await expect(page.locator('#shake-count')).toHaveText('1');
  await expect(page.locator('#shake-check')).toHaveAttribute('data-recent', 'true');
  await expect(page.locator('#shake-status')).toHaveText('Shake detected!');
  await expect(page.locator('#light-value')).toHaveText('0 / 255');
  expect(await page.evaluate(async () => (await import('/src/microbit-input/index.js')).microbit.getState().accelerometer.gesture)).toBe(null);
  await page.evaluate(() => window.serialMock.port.sample({ l: 255 }));
  await expect(page.locator('#light-value')).toHaveText('255 / 255');
  await expect(page.locator('#light-range')).toHaveText('Observed since reset: 0–255');
  await expect(page.locator('#shake-check')).toHaveAttribute('data-recent', 'false');
  await expect(page.locator('#shake-count')).toHaveText('1');
  await expect(page.locator('#events')).toContainText('shake');
  await page.locator('#reset-readings').click(); await expect(page.locator('#shake-count')).toHaveText('0');
  await expect(page.locator('#light-range')).toHaveText('Observed since reset: 255–255');
  await page.locator('#disconnect').click(); await expect(page.locator('#light-value')).toHaveText('Unavailable');
});
