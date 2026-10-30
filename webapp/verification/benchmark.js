import { performance } from 'node:perf_hooks';
import { cpus, platform, release, arch } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createRecorder } from '../src/testlab/recorder.js';
import { canStartGame, resultRequest, finishAttempt, createAttempt } from '../src/platform/rules.js';

const percentile = (values, p) => values[Math.max(0, Math.ceil(values.length * p) - 1)];
function measure(name, count, callback) {
  for (let i = 0; i < 1000; i++) callback(i); // JIT-oppvarming utenfor målingen.
  const times = []; const before = process.cpuUsage(); const started = performance.now();
  for (let i = 0; i < count; i++) { const t = performance.now(); callback(i); times.push(performance.now() - t); }
  const elapsedMs = performance.now() - started, cpu = process.cpuUsage(before);
  times.sort((a, b) => a - b);
  return { name, count, elapsedMs, operationsPerSecond: count / elapsedMs * 1000,
    cpuUsPerOperation: (cpu.user + cpu.system) / count,
    latencyMs: { p50: percentile(times, .5), p95: percentile(times, .95), p99: percentile(times, .99), max: times.at(-1) } };
}
const input = { connection: 'connected', inputAvailable: true };
const game = { id: '00000000-0000-4000-8000-000000000001', is_active: true, min_value: 0, max_value: 1000 };
const attempt = finishAttempt(createAttempt({ playerId: 'owner', game, attemptId: '00000000-0000-4000-8000-000000000002' }), 'completed', 100);
const measurements = [measure('platform-start-and-retry', 50000, () => {
  assert.equal(canStartGame({ player: { id: 'owner' }, game, moduleRegistered: true, input, renewed: true }), true);
  assert.equal(resultRequest(attempt, 'owner').body, resultRequest(attempt, 'owner').body);
})];
for (const rate of [50, 500]) {
  const recorder = createRecorder(); recorder.start(); let tick = 0;
  const sensors = { aPressed: false, bPressed: true, logoPressed: false, tiltX: 0, tiltY: 0,
    xMg: 12, yMg: -34, zMg: -998, strengthMg: 999, temperatureC: 23, lightLevel: 80, soundLevel: 12, soundEvent: 'quiet' };
  measurements.push(measure(`recorder-${rate}Hz-600s-logical-time`, rate * 600, () => {
    const t = tick++ * 1000 / rate;
    recorder.sample(t, sensors); recorder.event(t, { type: 'press', count: 1 });
  }));
  const data = recorder.snapshot();
  assert.equal(data.samples.length, 3000); assert.equal(data.events.length, 1000);
  const t = performance.now(); const json = recorder.exportJSON(); const csv = recorder.exportCSV();
  measurements.push({ name: `export-${rate}Hz`, elapsedMs: performance.now() - t,
    jsonBytes: Buffer.byteLength(json), csvBytes: Buffer.byteLength(csv), retainedSamples: data.samples.length,
    retainedEvents: data.events.length, dropped: data.dropped });
}
const sourcePaths = ['src/platform/rules.js', 'src/testlab/recorder.js', 'verification/benchmark.js'];
const report = { version: 1, timestamp: new Date().toISOString(),
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sourceHashes: Object.fromEntries(sourcePaths.map(p => [p, createHash('sha256').update(readFileSync(p)).digest('hex')])),
  environment: { node: process.version, platform: platform(), release: release(), arch: arch(), cpu: cpus()[0]?.model },
  method: 'Node performance.now; nearest-rank percentiles; 1000 warmup operations; accelerated logical time; assertions included; no forced GC',
  status: 'MEASURED', correctness: 'PASS', measurements,
  limitations: ['No latency threshold is specified for these pure platform/recorder helpers; measurements are baselines only.',
    'No serial parsing, callbacks, browser rendering, real-time soak or heap trend measured.',
    'GI propagation budget p95 <=5ms at 50Hz for 1/4 subscribers remains BLOCKED until adapter exists.',
    'Physical input budget p95 <=100ms over >=20 instrumented trials remains BLOCKED without V2/instrumentation.'] };
writeFileSync(process.env.UNIT_BENCHMARK_REPORT ?? new URL('../results/unit-benchmark.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
