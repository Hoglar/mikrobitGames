# Micro Tetris

Local ES-module/Canvas game using the shared Micro:bit input library. Rules are
versioned as `micro-tetris-v1`; see the [specification](../../../spec/games/tetris/README.md)
and [validation report](../../../results/tetris-validation.md).

## Play

Open `/#/play/tetris` in the webapp. With `npm run dev` or `npm run preview`,
connect a Micro:bit V2 with the project firmware, optionally enter a practice
seed, then click Start. Local play needs no account or backend; database and AI
access are blocked, and results are never saved.

On the deployed site, sign in, connect the board, choose ranked or practice, then
click Start. Both modes there require an active matching backend catalog entry.
Practice accepts an optional seed and never submits a result. Keep tilt, A, B
and logo neutral during the countdown.

| Control | Action |
| --- | --- |
| Tilt left/right | Move one column, then repeat while tilted. |
| B | Rotate 90° clockwise with SRS kicks. |
| A | Hard drop and lock; after Game Over, a new press restarts. |
| Gold logo | Hold/swap once per locked piece. |
| Pause button / Escape | Pause; click Continue for a new countdown. |

Seven-bag pieces, five next previews, ghost, T-spins/Mini, combos, back-to-back
and perfect clears use the exact score tables in the design. Every 5,000 points
increases gravity and music tempo, capped at level 15 (50 ms/row, 180 BPM).
The 5×5 display shows the held piece. Micro:bit Korobeiniki music and local browser
effects have separate toggles and volumes, enabled by default. Settings survive
restart within the page. Click a sound control if the browser blocks Web Audio.
Pause stops sound and retains hold; ending the round clears hold. Input loss
pauses the game and requires explicit Continue after reconnecting.

Music is sent one bar at a time using the existing melody API. The next bar waits
for ACK plus the calculated duration. That API has no playback-completion event;
small gaps are possible. Actual speaker gaps, physical tilt ergonomics and
hardware latency still require the physical acceptance tests.

## Modules and lifecycle

| Module | Responsibility |
| --- | --- |
| `rules.js` | Geometry, CW kicks, seeded seven-bag, score, levels, held-piece pixels. |
| `model.js` | Pure board simulation, hold/drop, lock delay, spin detection and top-out. |
| `index.js` | 120 Hz fixed steps, input arming/hysteresis/DAS, events and game-frame API. |
| `scene.js`, `style.css` | Responsive retro Canvas, HUD, previews and bounded clear effects. |
| `audio.js` | Lazy page-owned Web Audio context; round-owned effects, at most eight voices. |
| `device-output.js` | Coalesced hold images, eight-bar melody, STOP and stale-callback fences. |

`createTetris({seed, outputs, browserAudio, reportOutputError})` receives the
current `session.outputs`; it never opens a serial port or calls the backend.
`clock`, `outputClock`, `reducedMotion` and `initial` are internal test seams;
`initial` is never exposed as a page setting or ranked option.

The app calls `input(state)`, `press({input,count})`, `tick(seconds)` and
`draw(context,width,height)`. `releaseControls()` discards pending actions;
`setPlaying(boolean)` starts/stops playback only on phase transitions.
`setAudioSettings({musicEnabled,musicVolume})` controls device music.
`finishRound()` stops output and clears hold once for completed or abandoned
rounds. `dispose()` fences callbacks and frees round resources. The page then
awaits the shared input session's disposal for authoritative device STOP/CLEAR.
The page owns the browser-audio context across restarts and closes it on exit.

Read-only getters expose `ended`, `completed`, `value`, `label`, `resultText`,
copied diagnostic `state` and `outputStatus`. Rendering changes no simulation or
RNG state. Normal output is bounded to one pending display call, one pending
melody call and one timer; interruption can additionally issue STOP. Failed output
is reported without changing the score. Toggle music off/on or explicitly
continue after a pause to retry; failures never cause per-frame retries.

## Catalog and deployment

The working tree contains six game families and eleven catalog variants. The
previously published build contains ten variants. Tetris requires the updated
frontend and this additional catalog record for deployed play; local practice
uses the bundled registry. Neither rollout step has been performed by this
implementation. An operator can review and run the following from the repo root
on the backend host, using its normal maintenance-role `MBG_ADMIN_DSN`:

```sh
python3 backend/database/manage-game.py create --id 6a990001-165b-4e1d-8a20-000000000011 --name 'Micro Tetris' --unit tetris_score_v1 --direction higher_is_better --min 0 --max 9007199254740991
```

Check whether this UUID already exists before running `create`, including after
an uncertain outcome. `npm run catalog:commands` prints all eleven commands;
the ten previously registered variants must not be created again.
Publish `npm run build`'s complete `dist/` using the existing deployment process.
No backend migration, new API field, firmware change or runtime dependency is
required. See the [webapp deployment notes](../../../README.md#backend-og-publisering).

## Verify

From `webapp/` with the pinned Node/npm versions:

```sh
npm test
npx playwright install chromium
npm run test:app
```

The normal suites discover all Tetris tests. To run only the new tests:

```sh
node --test tests/unit/tetris.test.js tests/unit/tetris-output.test.js
npm run test:app -- tetris.spec.js
```

Unit fixtures cover rules, scoring, timing and output failures. Browser tests run
the built app with the production input adapter and controlled Web Serial/API
data. They save desktop, mobile and clear-effect screenshots under the ignored
`build/app-browser-results/`. These do not replace [physical acceptance](../../../spec/games/tetris/test-plan.md#fysisk-akseptanse-og-rapportering).
