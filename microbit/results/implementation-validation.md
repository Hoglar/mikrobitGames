# Firmware Implementation Validation — 2026-10-27

Software implementation and V2 cross-build passed. **No physical micro:bit was connected; this is not hardware verification.** ADR-008 remains Proposed pending hardware acceptance.

Source baseline: repository commit `3a5a2be2fdb761bbf110944ee3aa5a1c538f7b25` plus the uncommitted firmware/test/documentation changes. Generated `microbit/build/v2/provenance.json` records the exact source hashes, dependency pins, configuration and dirty state for this build. [lock.json](../toolchain/lock.json) records all runtime/bootstrap/submodule commits.

| Check | Result | Evidence and limits |
|---|---|---|
| Host C++ core | PASS | 12 test groups, including 100,000 deterministic framing-fuzz bytes; AddressSanitizer and UndefinedBehaviorSanitizer enabled |
| Shared corpus | PASS | All 24 command-result cases, positive V2 metadata, two accepted fixed-schema snapshot variants, and batched CRLF commands; four Python test methods |
| Standalone test project | PASS | Independently configured/built/tested with `cmake -S microbit/tests`; the root `microbit` entry point also passes |
| V2 firmware | PASS | Actual Arm cross-compilation/linking of the application and pinned CODAL libraries, application warnings treated as errors; HEX/ELF/map produced |
| Python tools | PASS | Syntax compilation of build wrapper, fixture runner and serial smoke tool |
| No-board smoke path | SKIPPED | Windows Python invocation without a port wrote `micro:bit not connected`; no serial dependency or board pass was inferred |
| Physical HW-01–HW-22 | SKIPPED | micro:bit not connected; sensor/output/pulse/timing/memory acceptance remains pending |
| GitHub Actions | NOT RUN | Workflow added; local equivalents passed, remote CI has not been invoked |

Fixture SHA-256: `3a1c3cbc695f4e83be937e667c97dfbc4111eb82e2b21f246cad0fe85da5229a`.

## Environment and Artifacts

Build host: x86-64 Linux under WSL2, kernel `6.18.33.2-microsoft-standard-WSL2`, glibc 2.43. Host compiler GNU C++ 15.2.0; cross compiler `arm-none-eabi-g++ 14.2.1 20241119` (Ubuntu package `15:14.2.rel1-1`); CMake 4.2.3; Python 3.14.4. The no-board smoke path also ran with Windows Python 3.14 on Windows 11.

The pinned upstream build emits CMake compatibility/policy warnings with CMake 4.2.3. Application compilation passes `-Wall -Wextra -Werror`; upstream warning policy was not changed. Effective application compile commands and generated CODAL definitions are staged beside the artifacts. BLE/SoftDevice and serial debug logs are disabled, and the scheduler tick is configured to 1000 µs.

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| `microbit/build/v2/MICROBIT.hex` | 279733 | `cbbe075b82fee819e1e903bd89e36ec8d162938d6860fcb44a58fd88da616d1f` |
| `microbit/build/v2/MICROBIT` (ELF) | 2473388 | `1a00d233bdfdcca17ad9a4792764c4a6e96135902e4a94aa037bcaecc32c00b3` |
| `microbit/build/v2/MICROBIT.map` | 665058 | `84d62a30aba76c1acca96c2a18a0dcd3e8329f95a038dd3cf298fa6c14d094d3` |

The linker reports 99184 bytes in FLASH (19.07% of its 508 KiB region), plus the UICR configuration. Its RAM percentage includes the linker-reserved heap: `.bss` symbols span 6364 bytes, `.data` symbols span 228 bytes, and the range from `__end__` to the reserved 2048-byte main stack leaves 122148 bytes for the initial heap arena. That arena must also serve the application instance, CODAL objects, driver/mixer buffers and fiber stacks. Neither the reported 98.44% RAM allocation nor the arena size establishes runtime free memory. Peak heap/stack use and minimum remaining RAM are unmeasured.

An initial full cross-build and subsequent incremental builds passed. Two independent clean final builds and byte-for-byte reproducibility have not been established. Dependency pins are fixed; compiler/tool packages are recorded, not supplied by a hermetic toolchain image. Generated artifacts remain ignored by Git.

## Remaining Acceptance

Run the [hardware plan](../spec/test-plan.md) on recorded V2/interface revisions. In particular verify physical axes, raw pulse detection/debounce, logo calibration, microphone/light behavior during output, sine audio/brightness/cancellation timing, normal-load cadence and acknowledgement gates, bounded sensor-failure recovery, maximum service/critical-section gaps, accelerated lifetime-counter wrap, and heap/stack soak. The [serial smoke tool](../verification/README.md) covers a subset of wire checks; it cannot replace instrumented physical testing.
