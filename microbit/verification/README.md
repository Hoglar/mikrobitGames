# V2 Hardware Verification Tools

No runner is implemented yet. Implement a host serial harness following the [test plan](../spec/test-plan.md), the [serial contract](../../spec/contracts/microbit-webapp/microbit-serial-protocol.md), and [shared fixtures](../../spec/contracts/microbit-webapp/fixtures/README.md). Document actual install/run commands when the runner exists, rather than advertising placeholder commands.

The runner must explicitly select a port, use the protocol's paced writes, complete startup, validate `microbit-v2`, and record source/build/fixture/board/interface revisions. Do not infer a pass from a port opening or an unchanged reading. Exclude browser/editor/terminal contention on that port.

Provide operator prompts or documented instrumentation for input changes and output checks. Support fault injection for dropped/fragmented/oversized lines, sensor failures, application reset, and output/TX cancellation. Distinguish actual board behavior from a fake transport or fault-build result. Expected disconnections are evaluated by recovery outcomes; unexpected ones fail the current case.

Store reports and benchmark captures under `microbit/results`. Include acquisition/host timing separately, bytes/second, sequence gaps, result latency, callback/service gaps, linker size, heap/stack observations, and all skipped/instrumentation limitations. Normal/conformance firmware never writes debug text to the protocol port.
