# Micro Tetris validation — 2026-10-29

Implemented locally against `micro-tetris-v1`, with source base
`3781f9824a90456763cedb4468810e8bea850137` plus uncommitted changes.
[Source SHA-256 manifest](tetris-source-manifest.json) identifies the actual
implementation, integration and test files; HEAD alone does not identify this
delivery. Environment: Windows x64, Node 24.22.1, npm 11.19.1, Playwright 1.64.1,
Chromium 156.0.8078.4 (Playwright revision 1248).

## Executed checks

| Check | Result |
| --- | --- |
| Full Node suite (`npm test` equivalent) | PASS: 97 tests, including 23 Tetris tests and the existing input/platform/game tests. |
| Tetris unit/output tests | PASS: 13 rule/controller tests and 10 device/browser-audio/lifecycle tests. |
| Static build (`npm run build` equivalent) | PASS: 43 public files, with local Tetris modules/CSS and no new runtime packages. |
| Full application browser suite (`npm run test:app` equivalent) | PASS: 18 tests against built `dist/`, including four Tetris tests. |
| Catalog command generation | PASS: eleven reviewable commands, including the new stable Tetris UUID. No database command executed. |
| Desktop/mobile/clear screenshots | Inspected: retro board, distinct piece colors, ghost, hold/next, HUD, controls and stronger four-line/PC effects. Mobile viewport 390×844; no horizontal document overflow. |
| Whitespace and local documentation links | PASS for changed/new files. |
| Remote CI | Not executed here. Workflow now includes the full application browser suite and its artifacts. |

Commands were run from the repository using its portable Node executable
`webapp/build/tools/node-v24.22.1-win-x64/node.exe`. The browser command was
`node node_modules/playwright/cli.js test --config playwright.app.config.js`
from `webapp/`, after explicitly building; this is equivalent to the pinned npm
script and its prebuild hook. The Node command was
`node --test --test-timeout=10000 webapp/tests/unit/*.test.js webapp/tests/microbit-input/*.test.js`
from the repository root. No dependency or lockfile update was needed.

The existing launcher tests were updated from five to six cards and now visit
Tetris in their bundled-game check. A rerun initially caught the stale five-card
expectation; the final run uses the corrected assertions.

## Software coverage

These are executed checks within the [TT acceptance groups](../spec/games/tetris/test-plan.md),
not a claim that every subcase in every group has passed.

| Groups | Evidence |
| --- | --- |
| TT-01/02 | Board bounds, seeded golden bags, pure snapshots/previews/ghost, full/partial hidden lock, spawn and held-piece spawn blocking. |
| TT-03/05/06/07 | Neutral arming, hysteresis/DAS, coalesced actions, hold restrictions/respawn, drop distances, simultaneous hold→rotate→drop, 500 ms lock delay, 15 resets, O behavior, stable multirow compaction and 150 ms clear phase. |
| TT-04 | Independent golden geometry and kicks for every CW transition, 118 reachable first-valid kick configurations, blocked rotation preserving history. Two redundant T candidates cannot precede candidate 1; explicitly checked as expected exceptions. |
| TT-08/09/10 | Full/Mini corner classification in all four orientations, fifth-kick promotion, positive movement invalidation, concrete spin/score boards, every base-score row, combo/B2B/PC vectors, old-level scoring, speed/BPM boundaries and safe-integer overflow. |
| TT-11/12 | Desktop/mobile and clear-effect render gallery; single = 100/tier 1/20 particles, four-line PC = 2,800/tier 5/150 particles. Repeated drawing leaves simulation unchanged. Browser Canvas instrumentation confirms PC shake and its absence with reduced motion; reduced mode uses a steady frame/text rather than particles/flashes. User perception is not measured. |
| TT-13/14 | All held-piece bitmaps, coalesced display writes/recovery, ACK-before-duration music timing, eight four-beat bars within wire limits at all 15 levels, tempo at the next boundary and bounded scheduling. |
| TT-15/16/19 | Lazy browser audio, independent mute/volume, eight-voice limit, blocked/unsupported audio, pause/mute STOP, interrupted-bar resume, late ACKs, explicit retry after failure, disposal and frozen results. Blocked hold top-out and menu completion clear display; pause retains it. |
| TT-17/18 | Browser practice sends no result; ranked top-out posts one completed result for the new UUID. A restarts after release without duplicating the old result or creating another AudioContext. Shared platform tests retain incomplete results and exact retry identity. |
| TT-20 | Identical fixed-step input traces at 30/60/144 Hz; repeated scheduler/hold activity never exceeds one timer/two normal pending calls. This uses simulated time, not a physical soak. |

Browser tests use the production input adapter with controlled Web Serial data
and API responses. They observe actual Canvas/Web Audio creation and emitted
device commands, rather than substituting a different game controller.
Screenshots are generated under ignored `webapp/build/app-browser-results/`:
`tetris-desktop.png`, `tetris-mobile.png`, `tetris-clears.png`. CI uploads that
directory. Existing adapter browser benchmarks were not rerun or relabeled as
Tetris performance measurements.

## Remaining acceptance and rollout

Physical Tetris checks are **NOT RUN**: no connected device was used in this
implementation turn. This includes actual hold-image orientation, audible
melody/SFX quality, tempo changes, speaker STOP latency and real reconnects.
The eight-bar transcription and generated commands pass software checks; that
does not prove playback timing or that the melody sounds satisfactory on V2.

The current melody API has no playback-completion event. The scheduler waits
for ACK plus calculated note duration before sending the next bar. Actual
90/180 BPM recordings with concurrent hold traffic, p95 unintended bar gap
≤150 ms, effective loop time and STOP response still need measurement.

Five minutes of actual UI/USB activity with memory trend, at least 20 instrumented
physical input trials, input latency targets and control ergonomics at low/mid/
maximum speed remain open. Tests do not establish balance, all hardware/browser
combinations, native permission dialogs, or live backend/cookie integration.

No firmware change, backend registration or publication was performed. The
previously published ten-variant build remains a separate release. Tetris needs
its new catalog record and the updated frontend before play is enabled there;
the [source guide](../src/games/tetris/README.md#catalog-and-deployment) contains
the exact command and normal build/deployment instructions.
