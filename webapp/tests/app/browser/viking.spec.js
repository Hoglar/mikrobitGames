import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { installSerialMock } from '../../microbit-input/browser/serial-mock.js';
import { games } from '../../../src/games/registry.js';

test('Viking Dash draws five distinct environments and every event without changing the simulation', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Velg ditt neste eventyr.' })).toBeVisible();
  const result = await page.evaluate(async () => {
    const { createVikingRenderer, environmentNames } = await import('/src/games/viking-dash/scene.js');
    const { createViking, events } = await import('/src/games/viking-dash/index.js');
    const gallery = document.createElement('section'); gallery.id = 'viking-gallery';
    gallery.style.cssText = 'position:relative;background:#182d30;padding:20px;display:grid;grid-template-columns:repeat(2,480px);gap:16px;width:1016px;color:#e8dfc4;font:14px monospace';
    document.body.append(gallery);
    const draw = createVikingRenderer();
    const objects = [
      { x: 809, type: 'rock', width: 1, height: .7, skin: 'rune' },
      { x: 815, type: 'pit', width: 2.5, height: 0, skin: 'pit' },
      { x: 822, type: 'branch', width: 1.5, height: 0, skin: 'raven' }
    ];
    function tile(label, s) {
      const panel = document.createElement('div'), title = document.createElement('div'), canvas = document.createElement('canvas');
      title.textContent = label; title.style.marginBottom = '8px'; canvas.width = 480; canvas.height = 270;
      panel.append(title, canvas); gallery.append(panel); const ctx = canvas.getContext('2d'); draw(ctx, 480, 270, s);
      const bytes = ctx.getImageData(0, 0, 480, 270).data;
      let hash = 0; for (let i = 0; i < bytes.length; i += 4) hash = Math.imul(hash ^ bytes[i] ^ bytes[i + 1] << 8 ^ bytes[i + 2] << 16, 16777619);
      return hash;
    }
    const scene = { distance: 800, section: 1, time: 8, y: 0, duck: false, ended: false, transition: 1, objects };
    const environments = environmentNames.map((name, environment) => tile(name, { ...scene, environment }));
    gallery.dataset.environmentCount = String(environments.length);
    const eventHashes = events.map(([name]) => tile(name, { ...scene, environment: 3, event: { name, start: 0, until: 18 } }));
    const game = createViking({ seed: 'render-is-pure' }); game.tick(1);
    const before = JSON.stringify(game.state), canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 540;
    for (let i = 0; i < 8; i++) game.draw(canvas.getContext('2d'), 960, 540);
    return { environments, eventHashes, unchanged: before === JSON.stringify(game.state) };
  });
  expect(new Set(result.environments).size).toBe(5);
  expect(new Set(result.eventHashes).size).toBe(15);
  expect(result.unchanged).toBe(true); expect(errors).toEqual([]);
  await page.locator('#viking-gallery').screenshot({ path: 'build/viking-scenes.png' });
});

test('Viking stage keeps its scenery visible and supports optional sound through start and pause', async ({ page }) => {
  const errors = [], requests = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const NativeAudio = globalThis.AudioContext;
    globalThis.vikingAudioProbe = { sources: 0, contexts: [] };
    if (!NativeAudio) return;
    globalThis.AudioContext = class extends NativeAudio {
      constructor(...args) { super(...args); globalThis.vikingAudioProbe.contexts.push(this); }
      createOscillator() { globalThis.vikingAudioProbe.sources++; return super.createOscillator(); }
      createBufferSource() { globalThis.vikingAudioProbe.sources++; return super.createBufferSource(); }
    };
  });
  const fixture = JSON.parse(readFileSync(new URL('../../../../spec/contracts/microbit-webapp/fixtures/conformance.json', import.meta.url)));
  const session = { player: { id: '11111111-1111-4111-8111-111111111111', username: 'Viking', created_at: '2026-10-01T12:00:00Z' }, expires_at: '2026-11-01T12:00:00Z', absolute_expires_at: '2026-11-20T12:00:00Z' };
  await page.addInitScript(installSerialMock, { info: fixture.deviceInfo.v2, snapshot: fixture.snapshots.v2 });
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname; requests.push(path);
    const data = path.endsWith('/auth/session') || path.endsWith('/auth/renew') ? session : path.endsWith('/games') ?
      { items: games.map(g => ({ ...g, is_active: true })), page: 0, page_size: 100, total: games.length } :
      { items: [], page: 0, page_size: 100, total: 0 };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.goto('/#/play/viking');
  await expect(page.locator('.viking-theme')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'En ny ferd venter.' })).toBeVisible();
  await expect(page.locator('.game-overlay')).not.toContainText('null');
  await page.locator('#connect').click();
  await expect(page.getByRole('button', { name: 'Start spill →' })).toBeEnabled();
  await page.getByRole('combobox', { name: 'Rangert eller øving' }).selectOption('practice');
  await page.getByRole('textbox', { name: 'Seed for øving' }).fill('midgard');
  await page.locator('.game-frame').screenshot({ path: 'build/viking-ready.png' });
  await page.getByRole('button', { name: 'Musikk og lyd: av', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Musikk og lyd: på', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Start spill →' }).click();
  await expect(page.locator('.game-toolbar')).toContainText('SPILLER', { timeout: 6000 });
  await expect.poll(() => page.evaluate(() => globalThis.vikingAudioProbe.sources)).toBeGreaterThan(5);
  expect(await page.evaluate(() => globalThis.vikingAudioProbe.contexts.at(-1).state)).toBe('running');
  await page.evaluate(() => window.serialMock.port.sample({ a: 1, ac: 1 }));
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.locator('.game-toolbar')).toContainText('PAUSE');
  const pausedSources = await page.evaluate(() => globalThis.vikingAudioProbe.sources);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => globalThis.vikingAudioProbe.sources)).toBe(pausedSources);
  await page.locator('.game-frame').screenshot({ path: 'build/viking-gameplay.png' });
  await page.getByRole('button', { name: 'Musikk og lyd: på', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Musikk og lyd: av', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: '→ Fortsett', exact: true }).click();
  await expect(page.locator('.game-toolbar')).toContainText('NEDTELLING');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('.game-frame').screenshot({ path: 'build/viking-mobile.png' });
  expect(requests.some(path => path.endsWith('/results'))).toBe(false);
  expect(errors).toEqual([]);
});
