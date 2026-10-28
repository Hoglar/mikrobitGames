# Game input library validation — 2026-10-28

The production ES-module library, two-game example, automated tests and replay benchmarks are implemented. This record covers software validation on Windows 11 x64 (10.0.26200), Intel i7-1260P. Physical browser/V2 interoperability has not been tested in this delivery.

This is the initial implementation record. The later [sensor follow-up](input-sensor-follow-up.md) records subsequent user hardware observations, the revised shake rule/fixtures, 56 Node tests and 7 browser tests. The source/fixture hashes and test totals below describe the earlier run.

## Reproducible checks

From `webapp/`, using Node 24.22.1 and npm 11.19.1:

```sh
npm ci
npm test
npx playwright install chromium
npm run test:browser
npm run benchmark:input
npm run dev:input
```

The example is at `http://127.0.0.1:4173/examples/microbit-input/`. Playwright 1.64.1 uses Chromium 156.0.8078.4, revision 1248. Browser tests install a Web Serial mock before importing the production singleton; native Streams still perform the reads/writes and lock operations.

| Check | Local outcome | Evidence / scope |
|---|---|---|
| `npm test` | PASS: 54 tests, no skipped tests | 37 input-library tests plus 17 existing platform/recorder tests |
| `npm run test:browser` | PASS: 6 tests | Two games, output encoding/cleanup, freshness/recovery, suspended facade reconnect, recreated readable stream, denied chooser/unsupported board, browser benchmark |
| `npm run benchmark:input` | PASS: four profiles | Production framing, validation, normalization and delivery; bounded framing and expected callback totals |
| CI workflow | Added, remote run unassessed | `.github/workflows/webapp-input.yml` runs the software checks and retains reports/failure traces |
| Physical browser/V2 (GI-15) | UNASSESSED | No real permission chooser, USB device or firmware exercised by these mocks |
| Instrumented physical input latency | UNASSESSED | Requires at least 20 physical input-to-callback trials and p95 ≤ 100 ms |
| Real-time soak / memory trend | UNASSESSED | Accelerated replay is not a five-minute real-time USB run or continuous heap/stack measurement |

## Coverage and source identity

`tests/microbit-input/protocol.test.js` exercises every shared metadata/snapshot/result wire fixture at every byte split, LF/CRLF, malformed bytes, bounded overflow/resynchronization, decoded duplicate keys (including nested/escaped keys), own-property normalization, counter/time wraps, tilt/shake/sound mapping, golden output encodings and local argument validation.

`lifecycle.test.js` exercises GI-01–14/16–20 software behavior: exact deadlines, freshness despite invalid/result traffic, callbacks and immutable state, paced FIFO/queue limits, early results, timeout/partial-line repair, ID exhaustion, disposal/draining/STOP/CLEAR, recovery/reconnect, cancellation and late/hung native operations. A 15,000-frame accelerated five-minute replay mixes wrap, invalid/oversized input, silence/recovery, output and game switching. `native-streams.test.js` additionally checks real Streams lock/cancel/drain ordering. These checks target the implementation, not a separate reference adapter.

Shared fixture SHA-256: `3a1c3cbc695f4e83be937e667c97dfbc4111eb82e2b21f246cad0fe85da5229a`. The working tree was based on `6ad793bbfedca80b50b083ce553503238b09f478`; library changes were uncommitted during verification. The [Node report](input-benchmark.json) records SHA-256 values for the actual production source files; HEAD alone does not identify those changes.

## Benchmark interpretation

The [Node report](input-benchmark.json) and [Chromium report](input-browser-benchmark.json) each contain 50/500 Hz profiles with one/four subscribers: 15,000/150,000 measured snapshots per profile, following 1,000 warmup snapshots. Each represents 300 seconds of device/logical time, replayed faster than real time. Host `performance.now()` measures complete-line handling to subscription callback; these numbers exclude USB transmission and physical sensor latency. Normal-rate p95 is below the existing 5 ms budget in both runtimes (approximately 0.015 ms or less in Node and 0.1 ms in Chromium on this run). Browser timer resolution makes zero/sub-millisecond percentile values coarse, not instantaneous processing.

The final software suites and both benchmarks were run concurrently on the same host; CPU contention can affect tails and throughput. These local results are evidence for the stated gate, not a universal performance guarantee.

Software tests verify one in-flight plus sixteen waiting commands, ≤16-byte chunks and ≥5 ms chunk-start spacing with injected clocks. They do not establish physical serial timing, actual firmware command round trips or peak memory. Full launcher/authentication/backend/Testlab UI integration remains separate from this library and local example.
