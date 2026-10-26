# micro:bit V2 C++ Firmware

Firmware for the built-in sensors, LED display, and speaker used by web games. **Only micro:bit V2 is supported.** Application code will be C++ on CODAL, as proposed in [ADR-008](../spec/decisions/adr-008-microbit-v2-cpp-codal.md). There is no V1 target or browser compatibility path in this release.

Firmware, build scaffolding, host tests, and verification scripts are **not implemented yet**. Commands below are an integration recipe and the intended workflow after those files exist, not evidence this checkout builds. An upstream sample is not this project's protocol firmware.

## Documentation

- [Implementation design](spec/firmware-implementation.md): components, tasks, buffers, drivers, cancellation, faults, and first integration checklist.
- [Serial contract](../spec/contracts/microbit-webapp/microbit-serial-protocol.md): authoritative wire behavior and numerical requirements.
- [Game API](../spec/contracts/microbit-webapp/web-page-developer-interface.md): browser-facing behavior.
- [Test plan](spec/test-plan.md), [host tests](tests/README.md), [verification tools](verification/README.md), and [results](results/README.md).

The [component diagram](spec/models/c4-component.drawio) remains an empty placeholder; use the design's component table until a diagram is authored.

## Reference Environment and Version Record

The initial reference host is Linux, native or WSL2. Windows can flash and use the resulting V2 HEX. A native Windows cross-build is not yet verified. Upstream documents GNU Arm Embedded tooling, Git, CMake, and Python 3, with `python build.py` producing `MICROBIT.hex`; see [upstream instructions](https://github.com/lancaster-university/microbit-v2-samples#building).

| Item | Baseline or required first-build record |
|---|---|
| Application | C++11, no exceptions or RTTI |
| Runtime | Candidate `codal-microbit-v2` tag `v0.3.5`; record its resolved full commit before acceptance |
| Dependencies | Use that target's `target-locked.json`; record every repository/commit |
| Build integration | Upstream `microbit-v2-samples`; record a reviewed immutable commit; floating `master` is discovery only |
| Cross compiler | `arm-none-eabi-gcc`/`arm-none-eabi-g++`; exact distribution/version/archive checksum to be established by a successful build |
| Other tools | Record Python 3, CMake, build tool, Git, and host OS/architecture versions |
| Host-test compiler | Record native GCC/Clang version; it does not produce firmware |

Do not call the environment reproducible until those unresolved versions have tested values. At first integration commit the bootstrap/configuration files and a lock/provenance record beside them; ignore generated dependencies/outputs. Normal builds use recorded pins without `--dev`, `--update`, or moving branches. Dependency upgrades require new fixture, cross-build, and hardware results.

## First Build Integration Recipe

Use this when implementing the scaffold, after adding a real `microbit/src/main.cpp` and components. These shell commands run from the repository root on Linux. Replace the placeholder with the reviewed immutable commit; do not execute it literally.

```sh
git clone https://github.com/lancaster-university/microbit-v2-samples.git microbit/.build/codal
git -C microbit/.build/codal checkout --detach <reviewed-bootstrap-commit>
```

Configure the bootstrap to compile our `microbit/src`, not its sample `source`. For working directory `microbit/.build/codal`, the upstream configuration has this shape. Commit the effective configuration/pins and verify generated compiler flags:

```json
{
  "target": {
    "name": "codal-microbit-v2",
    "url": "https://github.com/lancaster-university/codal-microbit-v2",
    "branch": "v0.3.5",
    "type": "git"
  },
  "application": "../../src",
  "config": {
    "MICROBIT_BLE_ENABLED": 0,
    "MICROBIT_BLE_PAIRING_MODE": 0,
    "CODAL_DEBUG": "CODAL_DEBUG_DISABLED",
    "DMESG_SERIAL_DEBUG": 0
  }
}
```

The tag identifies the candidate; accepted integration replaces it with its recorded immutable target commit. Disable developer-mode serial logs. Do not start radio services; route audio only to the built-in speaker.

Once the integration, configuration, and application exist:

```sh
cd microbit/.build/codal
python3 build.py
```

The upstream artifact is expected at `microbit/.build/codal/MICROBIT.hex`. The eventual wrapper must stage it at `microbit/build/v2/MICROBIT.hex`, with ELF/map/provenance. Clean builds use a fresh generated build tree with the same pins, not an update command. No project wrapper exists yet, so no wrapper command is advertised as runnable.

Record tool versions, project revision/dirty state, bootstrap/target/transitive hashes, configuration, build type/flags, flash/RAM sizes, and artifact SHA-256 values. Preserve provenance with results. Inspect the first build to establish actual ELF/map filenames before documenting commands that depend on them.

## Flash and Connect

1. Identify a physical V2 and connect a USB data cable. Close other tools/tabs holding its serial port.
2. Copy the built V2 HEX to its mounted `MICROBIT` drive. Wait for flashing; investigate `FAIL.TXT` instead of testing an older image. On Windows use Explorer or `Copy-Item` with the actual drive path.
3. Record printed board revision and interface firmware information. WSL2 may build while Windows copies/flashes the artifact; this workflow does not require forwarding USB into WSL.
4. Open the page in a supported secure-context browser, select the device from its connection button, and let the adapter handshake. Startup is silent until `HELLO|1`; unsolicited snapshots are not expected.
5. Verify `deviceInfo` and first snapshot, then run the hardware tests. Do not open another serial terminal alongside the browser.

V1 is outside support. Do not generate a V1 image or Universal HEX for this release. Unsupported board identities received by the browser fail startup explicitly.

## Tests and Diagnostics

The planned host C++ test project is described in [tests/README.md](tests/README.md). It runs fixtures without hardware; the cross-build checks CODAL integration. Real-device tests establish physical timing, detection, sound, display/light interaction, and memory behavior.

Normal/conformance firmware must not print debug output onto the protocol port. Use a debugger and bounded diagnostic records; a separate debug transport needs explicit configuration. Exclude debugger pauses from benchmarks. Save results under `microbit/results` with exact source/toolchain/artifact identifiers. No hardware verification or tested V2 revision matrix is claimed until those records exist.
