# Input sensor follow-up — 2026-10-28

The operator tested the example with the V2.21 board and reported that browser inputs worked, but light remained zero and shake detection was difficult to observe. This follow-up separates raw device readings, classifier behavior and display visibility.

## Light investigation

COM3 was released by the browser before direct capture. A paced `HELLO|1` and schema validation preceded each serial run; all readings below are the firmware's raw `l` field, before browser mapping.

| Condition | Snapshots | Light range |
|---|---:|---:|
| Operator-reported bright light, before reset | 202 | 0–0 |
| Before reset, blank display, follow-up capture | 101 | 0–0 |
| After reset, blank display | 101 | 0–0 |
| Full-brightness image | 101 | 0–0 |
| Image cleared | 101 | 0–0 |
| Phone flashlight approximately 5 cm from unobstructed top LED row | 152 | **246–248** |

The board responds to direct illumination. The browser maps `l` directly to `lightLevel`, so no mapping/scaling correction was needed. Zero is a valid lower-bound measurement, distinct from unavailable input (`null`). These observations do not establish a calibrated lux response or explain the exact illumination threshold under the earlier conditions. On V2, light sensing uses the top LED row, as described by the [micro:bit Foundation](https://support.microbit.org/support/solutions/articles/19000024023-how-does-the-light-sensing-feature-on-the-micro-bit-work-).

Brief SWD inspection found the display enabled in greyscale/light-sensing mode with the light-ready flag set and a cached zero reading. Light-strobe registers showed an enabled capture path. Debugger pauses perturb timing; they are not performance evidence. The bulk USB debug attempt timed out; inspection succeeded with the HID interface. Selected flash-segment boundary bytes matched the local ELF; a full image comparison did not complete. The application was reset during diagnosis, then resumed; no firmware image was flashed. Diagnostic JSON files are retained locally under ignored `microbit/build/light-*-diagnostic.json` / `light-diagnostic.json`.

## Shake rule and visibility

Replaying the earlier V2.21 operator shake interval (1,692 samples, original sequences 52499–54190) through the old classifier emitted zero shakes despite adjacent X/Y changes reaching 3,296 mg. Requiring three large alternating differences in four consecutive 20 ms samples was too restrictive for that motion.

With operator approval, the public-interface rule now tracks three alternating **1200 mg excursions from extrema within 600 ms**, allowing intermediate samples. Quiet re-arming, cooldown, gap handling, device-time arithmetic and the `onGesture('shake')` API remain unchanged. The revised classifier emits three events in the full historical interval. A 31-snapshot excerpt is committed in `conformance.json` as `recorded-hand-shake-v2-21`; it emits once at index 24. This is a recorded physical-motion regression, not a new instrumented end-to-end latency measurement.

The example now shows a persistent shake count, last detection time, a two-second highlight, current light meter and observed light range. Start either game to activate gesture subscriptions. The public `accelerometer.gesture` still lasts only one snapshot; the example retains event history separately. Reset readings clears the example's observations without altering classifier state.

## Verification

- Node: **56 tests passed** (39 input-library tests and 17 existing platform/recorder tests).
- Playwright/Chromium: **7 tests passed**, including the persistent shake display after its one-snapshot pulse, zero/255 light readings, reset and unavailable input.
- Firmware host suites: **2/2 passed**, including shared fixture checks; firmware source is unchanged.
- Revised fixtures cover gradual motion, exact 600 ms boundary, slow motion, a single jolt, independent axes, Z-only motion and the recorded hand shake. Lifecycle tests replay the recording both individually and batched.
- New [Node benchmark](input-sensor-benchmark.json) and [browser benchmark](input-sensor-browser-benchmark.json) pass the existing 50 Hz p95 ≤ 5 ms gate with one/four subscribers. Runs used the same pinned Node/Playwright/Chromium tools as the initial record and ran concurrently. They remain accelerated replay, not USB soak or physical latency measurements.

The working tree is based on `eba4fdc320cb1add3937cfe31be84180600661eb` plus these uncommitted changes. Updated fixture SHA-256: `ee530fbd678dd530b278466167ec98647adbee79e9e899b01fcb2dfe04654de2`; production source hashes are in the new Node report. The pre-existing modified `input-benchmark.json` was preserved; these follow-up runs wrote separate files. Full hardware acceptance and instrumented input latency remain outstanding.
