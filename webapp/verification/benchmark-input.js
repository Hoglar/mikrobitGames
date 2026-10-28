import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { arch, cpus, platform, release } from 'node:os';
import { createAdapter } from '../src/microbit-input/adapter.js';
import { corpus, FakeClock, FakeTransport, flush } from '../tests/microbit-input/support/fakes.js';

const percentile = (a, p) => a[Math.max(0, Math.ceil(a.length * p) - 1)];
const measurements = [];
for (const rate of [50, 500]) for (const subscribers of [1, 4]) {
  const clock = new FakeClock(), port = new FakeTransport(clock), serial = { requestPort: () => Promise.resolve({}) };
  let receivedAt = 0, measuring = false, callbacks = 0;
  const times = [];
  const adapter = createAdapter({ clock, serial: () => serial, secureContext: () => true, transportFactory: () => port,
    diagnostic: name => { if (name === 'line') receivedAt = performance.now(); } });
  const connected = adapter.connect(); await clock.tick(0); await connected;
  const game = adapter.createGameSession();
  for (let i = 0; i < subscribers; i++) game.inputs.subscribe(() => {
    if (measuring) { callbacks++; times.push(performance.now() - receivedAt); }
  });
  const warmup = 1000, count = rate * 300;
  let began, cpu;
  for (let i = 0; i < warmup + count; i++) {
    if (i === warmup) { measuring = true; began = performance.now(); cpu = process.cpuUsage(); }
    clock.jump(1000 / rate);
    port.sample({ ac: i, x: (i % 3 - 1) * 525, m: i % 256 });
    await flush(4);
  }
  const elapsedMs = performance.now() - began, used = process.cpuUsage(cpu);
  assert.equal(callbacks, count * subscribers); assert.equal(port.buffer.length, 0);
  assert.equal(adapter.context.commands.waiting.length, 0); assert.equal(adapter.context.framer.size, 0);
  const acceptedSequence = adapter.input.previous.n;
  times.sort((a, b) => a - b);
  const latencyMs = { p50: percentile(times, .5), p95: percentile(times, .95), p99: percentile(times, .99), max: times.at(-1) };
  if (rate === 50) assert.ok(latencyMs.p95 <= 5, `Propagation gate failed for ${subscribers} subscribers`);
  measurements.push({ rateHz: rate, subscribers, logicalDurationSeconds: 300, snapshots: count,
    callbacks, elapsedMs, messagesPerSecond: count / elapsedMs * 1000,
    cpuUsPerMessage: (used.user + used.system) / count, propagationMs: latencyMs, pendingFrames: port.buffer.length,
    lastSequence: acceptedSequence, status: 'PASS' });
  measuring = false;
  const closed = adapter.disconnect(); await clock.tick(100); await closed;
  assert.equal(clock.jobs.size, 0);
}
const fixturePath = new URL('../../spec/contracts/microbit-webapp/fixtures/conformance.json', import.meta.url);
const library = new URL('../src/microbit-input/', import.meta.url);
const sourceHashes = Object.fromEntries(readdirSync(library, { recursive: true }).filter(p => p.endsWith('.js')).map(p =>
  [p.replaceAll('\\', '/'), createHash('sha256').update(readFileSync(new URL(p.replaceAll('\\', '/'), library))).digest('hex')]));
const report = { recordedAt: new Date().toISOString(), revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  node: process.version, platform: platform(), release: release(), arch: arch(), cpu: cpus()[0]?.model,
  fixtureSha256: createHash('sha256').update(readFileSync(fixturePath)).digest('hex'),
  protocolVersion: corpus.protocolVersion, sourceHashes, measurements,
  method: 'Production adapter/framer/validation/normalization/subscriptions; fake transport and accelerated host/device time; performance.now from complete-line handling to each callback; 1000 warmup snapshots per case; nearest-rank percentiles.',
  limitations: ['Node measurements are not browser/USB measurements.', 'Five minutes is logical replay time, not a real-time hardware soak.',
    'No physical input/output latency, browser scheduling, continuous heap/stack peak or actual serial command round trip was measured.'] };
writeFileSync(new URL('../results/input-benchmark.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
