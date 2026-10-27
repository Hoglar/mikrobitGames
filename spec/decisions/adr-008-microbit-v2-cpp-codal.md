# C++ firmware on CODAL for micro:bit V2

**Status: Proposed** — C++ and V2-only support are confirmed project constraints. The CODAL implementation, host tests and pinned V2 cross-build now exist; physical hardware and resource acceptance remain pending. See [validation results](../../microbit/results/implementation-validation.md).

## Context and Problem Statement

The controller needs concurrent sensor reporting, serial command handling, and interruptible display/audio output. The current release supports micro:bit V2 only. V1 support, a DAL compatibility build, BLE transport, and GPIO-connected devices are outside this release. The existing [serial contract](../contracts/microbit-webapp/microbit-serial-protocol.md) owns external behavior; firmware technology must not create a second interpretation of that contract.

## Decision Drivers

- Use C++ and the V2 hardware runtime rather than maintaining peripheral drivers.
- Keep the protocol/session core testable on a host without a board.
- Preserve responsive input during display/audio output with bounded memory and queues.
- Make builds reproducible and record dependency/toolchain provenance.
- Avoid unsupported V1 branches in firmware, browser validation, and positive fixtures.

## Considered Options

- **C++ on CODAL:** Use the V2 runtime and isolate driver bindings behind application adapters.
- **C++ with direct peripheral access:** Own device initialization, sensor variants, scheduling, and audio/display drivers.
- **MicroPython or MakeCode application:** Useful reference environments, but outside the selected C++ implementation approach.

## Decision Outcome

Proposed option: **C++ on CODAL**, using the upstream [microbit-v2-samples build integration](https://github.com/lancaster-university/microbit-v2-samples) as the starting point, with our application under `microbit/src`. The [official runtime overview](https://tech.microbit.org/software/runtime/) identifies CODAL as the V2 runtime.

Use C++11 application code without C++ exceptions or RTTI. The integrated target is `codal-microbit-v2` tag `v0.3.5`, whose [locked target manifest](https://github.com/lancaster-university/codal-microbit-v2/blob/v0.3.5/target-locked.json) provides transitive dependency revisions and C++ flags. [The project lock](../../microbit/toolchain/lock.json) records immutable target/bootstrap/transitive/submodule commits; generated provenance records compiler/tool versions and effective configuration. Normal builds use those recorded revisions without developer-mode updates. This is a tested build baseline, not a claim that it is the latest runtime.

Use CODAL cooperative fibers with explicit ownership: one protocol/controller task, one sensor task, one digital-input task, one output-service task, and one TX task. Interrupt handlers only service runtime drivers or publish bounded notifications. All work must yield; spin waits cannot hold up acquisition or reception. Application buffers and work queues are fixed-capacity. Runtime-managed allocation is measured rather than assumed absent.

Use separate protocol-core and CODAL-adapter layers. A host C++ compiler runs fixture/state-machine tests without CODAL; the cross-build verifies actual driver integration. Application display/audio controllers implement replacement and cancellation, including a generation barrier on every `HELLO`. Normal firmware disables radio/BLE services and protocol-port debug printing.

The initial adapter uses direct Nordic TEMP conversion polling because the stock thermometer waits without a deadline. Version-specific accelerometer enable/readiness handling avoids its initial unbounded sample wait. These exceptions are isolated in the [CODAL adapter](../../microbit/src/platform/codal/README.md) and require review when upgrading the runtime. All other sensor/display/serial/audio hardware remains behind CODAL.

### Consequences

- Good, because one V2 target reduces compatibility branches and gives access to the required microphone, logo touch, speaker, and other built-in inputs.
- Good, because the host-testable core can exercise framing, integer bounds, sequence wrap, and session ordering before hardware integration.
- Good, because driver adapters isolate runtime changes from protocol and game code.
- Bad, because the first integration must establish exact API bindings, dependency pins, buffer configuration, and real scheduling/memory behavior.
- Bad, because V1 is rejected by the browser rather than receiving reduced functionality. Supporting it later requires an explicit scope/contract/test revision.
- Bad, because cooperative scheduling and asynchronous runtime objects require careful lifetime, cancellation, and buffer ownership rules.

## Implementation and Verification

Follow the [firmware implementation design](../../microbit/spec/firmware-implementation.md), [build/flash instructions](../../microbit/README.md), and [test plan](../../microbit/spec/test-plan.md). ADRs [002](adr-002-microbit-serial-communication.md) and [004](adr-004-microbit-command-encoding.md) retain ownership of input delivery and command encoding. The first milestone is a reproducible V2 build and simultaneous snapshot/output run; it must record findings before this ADR is marked Accepted.
