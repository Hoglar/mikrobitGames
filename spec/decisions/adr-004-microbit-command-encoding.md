# Selecting the web-to-micro:bit command encoding

**Status: Accepted**

## Context and Problem Statement

The web page sends commands for the micro:bit's built-in outputs, including the LED display and (on V2) speaker. To prioritize low latency, reliability, and readability—and avoid requiring a JSON command parser in whichever firmware runtime is selected—the command channel uses a small line-oriented text grammar. The runtime and performance measurements remain to be established during implementation.

This decision applies to web-to-micro:bit output commands and their results. `deviceInfo` and snapshots remain newline-delimited JSON. The page sends `HELLO|1`; firmware emits `deviceInfo` before snapshots, and the adapter waits for both valid info and a first snapshot before sending output commands. A repeated handshake is a session barrier, as defined in ADR-002 and the shared contract.

## Decision Drivers

* Minimize command-processing latency and avoid parser-related failures on the micro:bit.
* Keep the grammar small, deterministic, readable, and easy to validate.
* Support all built-in display and speaker commands with bounded message sizes.
* Keep the game-facing output API independent of the wire encoding.

## Considered Options

* **JSON commands and results:** Use newline-delimited JSON for web-to-micro:bit commands and command results; keep sensor telemetry in JSON.
* **Text commands and JSON results:** Use a compact text grammar for commands but JSON objects for command results and sensor telemetry.
* **Text commands and text results (`text-v1`):** Use a fixed line-oriented text grammar for both commands and results; keep sensor telemetry in JSON.
* **Binary command protocol:** Encode commands in compact binary packets with explicit framing and field definitions.

## Decision Outcome

Chosen option: **Text commands and text results (`text-v1`).** Each command is a newline-terminated ASCII line with a version, command ID, target, action, and bounded arguments. The micro:bit returns a matching `R|...` text result line. `deviceInfo` and sensor snapshots remain JSON. The browser starts each connection with `HELLO|1` and validates the protocol version in `deviceInfo` before sending commands. The `C|` command and `R|` result prefixes distinguish text control lines from JSON sensor snapshots; protocol version 1 fixes the command grammar for every device.

The browser's game-facing API remains independent of the wire encoding. The detailed `text-v1` grammar is documented in the [micro:bit–webapp serial protocol](../contracts/microbit-webapp/microbit-serial-protocol.md).

That contract owns exact serial settings, ASCII alphabets, argument/line/queue bounds, uppercase error codes, and validation precedence. IDs increase strictly and are never reused within a session; duplicate/older IDs cannot execute an action again. The browser uses paced chunks and one command awaiting a result to bound pressure on small firmware receive buffers. Timeout or partial write means execution is unknown: recovery establishes a new session without automatically retrying actions.

Valid commands replace active output on the same target; display and speaker are independent and have no firmware playback queues. `STOP` and `CLEAR` interrupt active work. Results acknowledge acceptance/start, not completion; nonblocking playback is required to preserve input cadence. The page controls game disposal and output cleanup, rather than allowing a closing game to close the shared port.

### Consequences

* Good, because the micro:bit parses a small fixed grammar instead of allocating and parsing arbitrary JSON command objects.
* Good, because command lines are compact, human-readable, and easy to inspect in serial logs.
* Good, because one fixed command format avoids per-device format negotiation; the protocol version covers future syntax changes.
* Good, because `R|` result lines are directly distinguishable from `{`-prefixed JSON snapshot lines.
* Bad, because text fields and variable-length melodies require strict character, length, and range limits.
* Bad, because paced writes and a single in-flight command limit command throughput; bounded queues reject overload rather than accumulating stale game output.
* Bad, because acknowledgement timeouts cannot establish whether a side effect happened; automatic retry is intentionally excluded.
* Bad, because extending the command set requires coordinating parser changes on the micro:bit and browser.
* Bad, because `deviceInfo` and sensor snapshots still require JSON generation on the micro:bit; this decision removes JSON parsing only from the command path.
