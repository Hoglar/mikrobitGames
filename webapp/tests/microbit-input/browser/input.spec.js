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
  await page.locator('#disconnect').click();
  await expect.poll(() => page.evaluate(() => window.serialMock.port.closeLocked)).toBe(false);
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

test('image editor paints locally, sends row-major brightness values and keeps draft separate from board clear', async ({ page }, testInfo) => {
  const pixel = (row, column) => page.getByRole('button', { name: new RegExp(`^Row ${row}, column ${column},`) });
  await expect(page.locator('#image-grid button')).toHaveCount(25);
  await expect(page.locator('#send-image')).toBeDisabled();
  await pixel(1, 1).click(); await expect(pixel(1, 1)).toHaveAttribute('aria-pressed', 'true');
  await pixel(1, 1).click(); await expect(pixel(1, 1)).toHaveAttribute('aria-pressed', 'false');
  await pixel(1, 1).click();
  const first = await pixel(1, 2).boundingBox(), last = await pixel(1, 4).boundingBox();
  await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2); await page.mouse.down();
  await page.mouse.move(last.x + last.width / 2, last.y + last.height / 2, { steps: 15 }); await page.mouse.up();
  await page.locator('#brush').press('Home');
  for (let i = 0; i < 4; i++) await page.locator('#brush').press('ArrowRight');
  await expect(page.locator('#brush-value')).toHaveText('4');
  await pixel(5, 5).focus(); await page.keyboard.press('Space');
  await expect(pixel(5, 5)).toHaveAttribute('aria-label', 'Row 5, column 5, brightness 4');
  expect(await page.evaluate(() => window.serialMock.commands)).toEqual([]);
  await page.locator('#connect').click(); await expect(page.locator('#counter')).toBeEnabled(); await page.locator('#counter').click();
  await page.locator('#send-image').click();
  const expected = '9999' + '0'.repeat(20) + '4';
  await expect.poll(() => page.evaluate(() => window.serialMock.commands.at(-1))).toMatch(new RegExp(`\\|D\\|IMAGE\\|${expected}$`));
  await page.locator('#clear').click();
  await expect.poll(() => page.evaluate(() => window.serialMock.commands.at(-1))).toMatch(/\|D\|CLEAR$/);
  await expect(pixel(1, 1)).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#reset-image').click(); await expect(page.locator('#image-grid [aria-pressed="true"]')).toHaveCount(0);
  await page.locator('#fill-image').click(); await expect(page.locator('#image-grid [aria-pressed="true"]')).toHaveCount(25);
  await page.locator('#brush').press('Home'); await pixel(1, 1).click();
  await expect(pixel(1, 1)).toHaveAttribute('aria-pressed', 'false');
  await page.locator('[aria-labelledby="output-heading"]').screenshot({ path: testInfo.outputPath('output-editors-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator('[aria-labelledby="output-heading"]').screenshot({ path: testInfo.outputPath('output-editors-mobile.png') });
  await page.locator('#disconnect').click(); await expect(page.locator('#send-image')).toBeDisabled();
});

test('piano and tone controls send selected frequencies, octave, duration and volume', async ({ page }) => {
  await expect(page.locator('#piano button')).toHaveCount(13);
  await expect(page.getByRole('button', { name: 'Play C4', exact: true })).toBeDisabled();
  await page.locator('#connect').click(); await expect(page.locator('#counter')).toBeEnabled(); await page.locator('#counter').click();
  await page.locator('#note-duration').fill('250'); await page.locator('#volume').press('End');
  await expect(page.locator('#volume-value')).toHaveText('255');
  await page.getByRole('button', { name: 'Play C4', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.serialMock.commands.at(-1))).toMatch(/\|S\|TONE\|262\|250\|255$/);
  await expect(page.locator('#last-note')).toHaveText('C4 · 262 Hz · 250 ms · volume 255');
  await page.getByRole('button', { name: 'Play C♯4', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.serialMock.commands.at(-1))).toMatch(/\|S\|TONE\|277\|250\|255$/);
  await page.locator('#octave').selectOption('3'); await page.getByRole('button', { name: 'Play A3', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.serialMock.commands.at(-1))).toMatch(/\|S\|TONE\|220\|250\|255$/);
  await page.locator('#frequency').fill('3333'); await page.locator('#tone').click();
  await expect.poll(() => page.evaluate(() => window.serialMock.commands.at(-1))).toMatch(/\|S\|TONE\|3333\|250\|255$/);
  await page.locator('#stop').click();
  await expect.poll(() => page.evaluate(() => window.serialMock.commands.at(-1))).toMatch(/\|S\|STOP$/);
  await page.locator('#disconnect').click(); await expect(page.getByRole('button', { name: 'Play A3', exact: true })).toBeDisabled();
});

test('melodies and advertised sounds can be selected; invalid settings never send commands', async ({ page }) => {
  await page.locator('#connect').click(); await expect(page.locator('#counter')).toBeEnabled(); await page.locator('#counter').click();
  await page.locator('#sound-choice').selectOption('happy'); await page.locator('#sound').click();
  await expect.poll(() => page.evaluate(() => window.serialMock.commands.at(-1))).toMatch(/\|S\|SOUND\|happy$/);
  await page.locator('#melody-choice').selectOption('arpeggio'); await page.locator('#note-duration').fill('100');
  await page.locator('#melody').click();
  await expect.poll(() => page.evaluate(() => window.serialMock.commands.at(-1))).toMatch(/\|S\|MELODY\|128\|262:100,330:100,392:100,523:100,392:100,330:100,262:100$/);
  const count = await page.evaluate(() => window.serialMock.commands.length);
  await page.locator('#note-duration').fill('10000'); await page.locator('#melody').click();
  await expect(page.locator('#error')).toContainText('1428 ms or less');
  expect(await page.evaluate(() => window.serialMock.commands.length)).toBe(count);
  await page.locator('#frequency').fill('17'); await page.locator('#tone').click();
  await expect(page.locator('#error')).toContainText('20 to 9999');
  expect(await page.evaluate(() => window.serialMock.commands.length)).toBe(count);
  await page.locator('#disconnect').click();
  await page.evaluate(() => { window.serialMock.info.capabilities.outputs.builtInSounds = []; });
  await page.locator('#connect').click(); await expect(page.locator('#counter')).toBeEnabled(); await page.locator('#counter').click();
  await expect(page.locator('#sound-choice')).toBeDisabled(); await expect(page.locator('#sound')).toBeDisabled();
  await expect(page.locator('#sound-choice')).toHaveText('No named sounds available'); await expect(page.locator('#tone')).toBeEnabled();
  await page.locator('#disconnect').click();
});
