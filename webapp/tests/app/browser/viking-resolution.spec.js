import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });

test('Viking HUD is drawn at native display resolution with readable text on desktop and mobile', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Velg ditt neste eventyr.' })).toBeVisible();
  const frames = await page.evaluate(async () => {
    const { createVikingRenderer } = await import('/src/games/viking-dash/scene.js');
    const results = [];
    for (const [name, width] of [['desktop', 960], ['mobile', 340]]) {
      const frame = document.createElement('section');
      frame.id = `viking-native-${name}`; frame.className = 'game-frame viking-theme';
      frame.style.cssText = `width:${width}px;margin:20px;background:#172b2e`;
      const canvas = document.createElement('canvas');
      canvas.width = width * 2; canvas.height = Math.round(width * 9 / 16 * 2);
      canvas.style.cssText = `width:${width}px;height:${width * 9 / 16}px`;
      frame.append(canvas); document.body.append(frame);
      const ctx = canvas.getContext('2d'), text = [];
      const originalText = ctx.fillText.bind(ctx), originalImage = ctx.drawImage.bind(ctx);
      const imageCopies = [];
      ctx.fillText = function (value, x, y, ...args) {
        text.push({ value, x, y, fontSize: Number(this.font.match(/([\d.]+)px/)[1]),
          width: this.measureText(value).width, align: this.textAlign,
          transformX: this.getTransform().a, transformY: this.getTransform().d });
        originalText(value, x, y, ...args);
      };
      ctx.drawImage = (source, ...args) => {
        imageCopies.push({ width: source.width, height: source.height });
        originalImage(source, ...args);
      };
      const state = { distance: 1300, section: 2, time: 12, y: 0, duck: false, ended: false,
        environment: 3, transition: 1, speed: 24, viewMeters: 40,
        event: { name: 'Odin', start: 11, until: 21 }, objects: [] };
      const before = JSON.stringify(state);
      createVikingRenderer()(ctx, canvas.width, canvas.height, state);
      const bounds = canvas.getBoundingClientRect();
      results.push({ name, text, imageCopies, backingWidth: canvas.width, backingHeight: canvas.height,
        width: bounds.width, height: bounds.height,
        imageRendering: getComputedStyle(canvas).imageRendering, unchanged: before === JSON.stringify(state) });
    }
    return results;
  });
  for (const frame of frames) {
    for (const copy of frame.imageCopies) {
      expect(copy.width).toBeGreaterThanOrEqual(frame.backingWidth);
      expect(copy.height).toBeGreaterThanOrEqual(frame.backingHeight);
    }
    expect(frame.imageRendering).toBe('auto');
    expect(frame.unchanged).toBe(true);
    for (const line of frame.text) {
      expect(line.fontSize).toBeGreaterThanOrEqual(11);
      expect(line.transformX).toBeCloseTo(2, 2);
      expect(line.transformY).toBeCloseTo(2, 2);
      expect(line.y + line.fontSize).toBeLessThan(frame.height);
      const left = line.align === 'right' ? line.x - line.width : line.x;
      expect(left).toBeGreaterThanOrEqual(0);
      expect(left + line.width).toBeLessThanOrEqual(frame.width);
    }
    const place = frame.text.find(line => line.value === 'NORDLYSNATT');
    const event = frame.text.find(line => line.value === 'VARSEL: ODIN');
    expect(place).toBeTruthy(); expect(event).toBeTruthy();
    if (frame.name === 'mobile') expect(event.y).toBeGreaterThan(place.y + 30);
    else expect(event.y).toBe(place.y);
  }
  await page.locator('#viking-native-desktop').screenshot({ path: 'build/viking-native-desktop.png' });
  await page.locator('#viking-native-mobile').screenshot({ path: 'build/viking-native-mobile.png' });
});
