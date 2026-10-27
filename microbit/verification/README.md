# V2 Hardware Verification

`serial_smoke.py` checks a flashed V2 over an explicitly selected serial port. It checks the handshake/capabilities, snapshot schema/progression/idle cadence, shared command results, oversized-line recovery and batched commands. It records acquisition versus host-arrival intervals, sequence gaps, throughput and host-observed result latency. It does not certify physical inputs/outputs, cold-boot silence, firmware-internal acknowledgement latency, concurrent-load gates or RAM headroom.

Run with the same Python installation that can access the port (usually Windows Python when building in WSL):

```sh
python -m pip install -r microbit/verification/requirements.txt
python microbit/verification/serial_smoke.py --port COM5 --board-revision V2.2 --interface-version <actual-version> --provenance microbit/build/v2/provenance.json --duration 60 --report microbit/results/my-board-smoke.json
```

Replace the port/revisions with observed values. Close the browser/editor/terminal using that port. The tool sends display/speaker commands, including tones. It uses 115200 8N1, no flow control, and at most 16 bytes per write with chunk starts at least 5 ms apart. A selected port failing to open, handshake, or complete checks is a failure. Unexpected disconnects fail the run. Reports preserve build/fixture identity and board/interface revisions.

Without `--port`, it writes **SKIPPED: micro:bit not connected** and exits successfully; no serial package is needed for that path. This is never a hardware pass.

Complete the [HW-01 through HW-22 test plan](../spec/test-plan.md) separately, including operator-observed movement/touch/light/audio/display checks, simultaneous output load, startup/recovery, injected mandatory-sensor failures, 5 ms service-gap measurements, accelerated counter wrap and heap/stack soak. Attach instrumentation and stimulus descriptions. Unperformed checks remain skipped/pending, with reasons. Never infer physical changes from unchanged messages or silently substitute host timings for instrumented firmware/physical latency.

Normal firmware exposes bounded debugger statistics without writing diagnostic text to the protocol port. See [CODAL bindings](../src/platform/codal/README.md) and [local validation results](../results/implementation-validation.md).
