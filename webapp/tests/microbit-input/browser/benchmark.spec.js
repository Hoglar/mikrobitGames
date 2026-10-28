import { test } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { platform, release } from 'node:os';
import { installSerialMock } from './serial-mock.js';

const fixtureBytes = readFileSync(new URL('../../../../spec/contracts/microbit-webapp/fixtures/conformance.json', import.meta.url));
const corpus = JSON.parse(fixtureBytes);
test('GI benchmark browser propagation at 50/500 Hz with one/four subscribers', async ({ page, browser }, testInfo) => {
  test.setTimeout(90000);
  await page.addInitScript(installSerialMock, { info: corpus.deviceInfo.v2, snapshot: corpus.snapshots.v2 });
  await page.goto('/examples/microbit-input/');
  const measurements = await page.evaluate(async () => {
    const { createAdapter } = await import('/src/microbit-input/adapter.js');
    const measurements = [];
    for (const rate of [50, 500]) for (const subscribers of [1, 4]) {
      let lineAt = 0, measuring = false, callbacks = 0;
      const times = [];
      const adapter = createAdapter({ diagnostic: name => { if (name === 'line') lineAt = performance.now(); } });
      await adapter.connect();
      const port = window.serialMock.port; clearInterval(port.timer); port.timer = null;
      const game = adapter.createGameSession();
      for (let i = 0; i < subscribers; i++) game.inputs.subscribe(() => {
        if (measuring) { callbacks++; times.push(performance.now() - lineAt); }
      });
      const count = rate * 300, warmup = 1000, baseTime = port.u, baseCount = port.ac;
      let began;
      for (let i = 0; i < count + warmup; i++) {
        if (i === warmup) { measuring = true; began = performance.now(); }
        port.sample({ u: baseTime + (i + 1) * 1000 / rate, ac: baseCount + Math.floor(i / 100), x: (i % 3 - 1) * 525 });
        // Drain native stream continuations before submitting the next sample.
        for (let turn = 0; turn < 6; turn++) await Promise.resolve();
      }
      const elapsedMs = performance.now() - began;
      times.sort((a, b) => a - b);
      const p = n => times[Math.max(0, Math.ceil(times.length * n) - 1)];
      measurements.push({ rateHz: rate, subscribers, logicalDurationSeconds: 300, snapshots: count, callbacks,
        elapsedMs, messagesPerSecond: count / elapsedMs * 1000,
        propagationMs: { p50: p(.5), p95: p(.95), p99: p(.99), max: times.at(-1) } });
      measuring = false; await adapter.disconnect();
    }
    return measurements;
  });
  for (const m of measurements) {
    assert.equal(m.callbacks, m.snapshots * m.subscribers);
    if (m.rateHz === 50) assert.ok(m.propagationMs.p95 <= 5, 'Browser propagation exceeds the fixed 5 ms p95 gate');
  }
  const report = { recordedAt: new Date().toISOString(), browser: browser.version(), playwright: '1.64.1',
    platform: platform(), release: release(), fixtureSha256: createHash('sha256').update(fixtureBytes).digest('hex'), measurements,
    method: 'Production library with native browser Streams and a Web Serial mock; accelerated device timestamps; performance.now from complete-line handling to callbacks; 1000 warmup frames; nearest-rank percentiles.',
    limitations: ['Logical replay time is not real-time USB soak.', 'No real permission dialog, USB hardware, physical end-to-end latency or continuous memory peak measured.'] };
  writeFileSync(testInfo.outputPath('browser-benchmark.json'), JSON.stringify(report, null, 2));
  writeFileSync(process.env.INPUT_BROWSER_BENCHMARK_REPORT ?? new URL('../../../results/input-browser-benchmark.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
});
