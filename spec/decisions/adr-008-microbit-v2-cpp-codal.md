# C++ firmware on CODAL for micro:bit V2

**Status: Proposed** — C++ and V2-only support are confirmed project constraints. CODAL, build integration, and resource budgets below are the proposed implementation baseline, pending the first successful build and hardware run.

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

Use C++11 application code without C++ exceptions or RTTI. The source-inspected candidate target is `codal-microbit-v2` tag `v0.3.5`, whose [locked target manifest](https://github.com/lancaster-university/codal-microbit-v2/blob/v0.3.5/target-locked.json) provides transitive dependency revisions and C++ flags. This is a candidate version, not a claim that it is the latest or has built successfully here. Before accepting the first build, resolve the tag and bootstrap build tooling to full commit hashes and record the compiler/tool versions as described in the [module README](../../microbit/README.md). Normal builds must use those recorded revisions and the target's locked dependencies, without developer-mode updates.

Use CODAL cooperative fibers with explicit ownership: one protocol/controller task, one sensor task, one digital-input task, one output-service task, and one TX task. Interrupt handlers only service runtime drivers or publish bounded notifications. All work must yield; spin waits cannot hold up acquisition or reception. Application buffers and work queues are fixed-capacity. Runtime-managed allocation is measured rather than assumed absent.

Use separate protocol-core and CODAL-adapter layers. A host C++ compiler runs fixture/state-machine tests without CODAL; the cross-build verifies actual driver integration. Application display/audio controllers implement replacement and cancellation, including a generation barrier on every `HELLO`. Normal firmware disables radio/BLE services and protocol-port debug printing.

### Consequences

- Good, because one V2 target reduces compatibility branches and gives access to the required microphone, logo touch, speaker, and other built-in inputs.
- Good, because the host-testable core can exercise framing, integer bounds, sequence wrap, and session ordering before hardware integration.
- Good, because driver adapters isolate runtime changes from protocol and game code.
- Bad, because the first integration must establish exact API bindings, dependency pins, buffer configuration, and real scheduling/memory behavior.
- Bad, because V1 is rejected by the browser rather than receiving reduced functionality. Supporting it later requires an explicit scope/contract/test revision.
- Bad, because cooperative scheduling and asynchronous runtime objects require careful lifetime, cancellation, and buffer ownership rules.

## Implementation and Verification

Follow the [firmware implementation design](../../microbit/spec/firmware-implementation.md), [build/flash instructions](../../microbit/README.md), and [test plan](../../microbit/spec/test-plan.md). ADRs [002](adr-002-microbit-serial-communication.md) and [004](adr-004-microbit-command-encoding.md) retain ownership of input delivery and command encoding. The first milestone is a reproducible V2 build and simultaneous snapshot/output run; it must record findings before this ADR is marked Accepted.
