# Selecting the web-to-micro:bit command encoding

**Status: Proposed**

## Context and Problem Statement

The web page sends commands for the micro:bit's built-in outputs, including the LED display and (on V2) speaker. The protocol currently represents these commands as newline-delimited JSON, but the JSON parser available in the eventual micro:bit firmware/runtime has not yet been confirmed. Should commands remain JSON, use a compact text grammar, or use a more compact binary format?

This decision applies only to web-to-micro:bit commands and their acknowledgements. Micro:bit-to-web `deviceInfo` and sensor snapshots remain newline-delimited JSON.

## Decision Drivers

* Work reliably with the selected micro:bit board, firmware, and runtime.
* Keep command parsing, memory use, and implementation risk low.
* Keep messages inspectable and straightforward to debug.
* Avoid changing the game-facing output API when the wire encoding changes.

## Considered Options

* **JSON in both directions:** Use newline-delimited JSON for commands and command results, matching the sensor protocol.
* **JSON telemetry with compact text commands:** Keep JSON snapshots and use a fixed, newline-delimited command grammar for web-to-micro:bit commands and their results.
* **Binary command protocol:** Encode commands in compact binary packets with explicit framing and field definitions.

## Decision Outcome

Chosen option: **Use JSON commands by default, with the compact `text-v1` command format as a fallback.** First verify JSON parser availability and measure parsing reliability and resource use on the selected micro:bit runtime. Keep `json-v1` when it works within the device's memory and responsiveness budgets. If the runtime lacks a suitable JSON parser or measurements show a real reliability/resource problem, use `text-v1` for commands and results while retaining JSON for `deviceInfo` and sensor snapshots. The device advertises the selected encoding in `deviceInfo.commandEncoding`.

The browser's game-facing API remains independent of the wire encoding. The detailed fallback grammar is documented in the [micro:bit–webapp serial protocol](../contracts/microbit-webapp/microbit-serial-protocol.md).

### Consequences

* Good, because JSON remains the simple default and avoids maintaining an unnecessary custom grammar before the firmware/runtime is selected.
* Good, because the fallback limits firmware parsing to a small set of commands and numeric fields if JSON parsing proves unsuitable.
* Good, because advertising `commandEncoding` lets the browser select the correct encoder/parser without changing game code.
* Bad, because supporting both encodings requires additional firmware and browser tests and a clear compatibility policy.
* Bad, because `text-v1` needs strict limits and escaping rules for display text and variable-length melodies; it is less extensible than JSON.
* Bad, because a binary format could be more compact, but would be harder to inspect and is not justified for the small command payloads at this stage.
