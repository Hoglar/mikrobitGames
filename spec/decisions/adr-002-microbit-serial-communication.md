# Defining the micro:bit serial communication protocol

## Context and Problem Statement

The micro:bit sensors will provide input to multiple games running on a web page. The page will use a shared browser-side adapter to receive sensor data, maintain the current sensor state, expose a consistent interface to each game, and send output commands back to the micro:bit.

This decision defines the sensor update strategy and overall serial framing. The micro:bit sends JSON sensor snapshots; after a `HELLO|1` handshake, the page sends `text-v1` commands for supported built-in outputs. The command encoding is recorded in ADR-004. The protocol should keep inputs responsive, be straightforward to parse and debug, and provide a consistent current state for the browser adapter and games.

## Decision Drivers

* Keep input latency low enough for responsive gameplay.
* Make the protocol simple to parse and debug in the browser.
* Provide a consistent current sensor state to all games.
* Keep the browser adapter independent of individual games.

## Considered Options

Sensor delivery uses newline-delimited JSON snapshots. Web-to-micro:bit commands and their results use newline-delimited `text-v1` lines; the page starts each connection with the fixed `HELLO|1` line.

* **Periodic full snapshots:** Send the selected game-input readings together in one JSON object at a fixed transmission interval.
* **Per-sensor change events:** Send an event for an individual sensor only when its value changes. The browser adapter must combine events into the current sensor state.
* **Hybrid updates:** Send per-sensor change events and periodically send a full snapshot to initialize or resynchronize the browser adapter.

## Decision Outcome

Chosen option: **Periodic full snapshots for sensor input.** The micro:bit sends the selected readings together in compact JSON at the shared protocol's fixed interval. Snapshots use short keys and omit handshake metadata, derived values, and compass readings. They include boot-relative sample time and cumulative debounced press counters as well as current held states. These counters preserve one-shot presses across missing snapshots without introducing a separate event stream. They do not reconstruct release history, exact press times, or ordering between different buttons.

The unimplemented version 1 draft specifies a 20 ms interval over 115200-baud USB serial for V2 boards only. [ADR-008](adr-008-microbit-v2-cpp-codal.md) proposes C++/CODAL implementation. These are requirements to validate on supported V2 revisions, not measured claims. All built-in contract readings are mandatory; games do not negotiate sensor subsets. A healthy driver's documented valid cached measurement is allowed, but sensor failure skips the snapshot rather than being hidden by an old encoded snapshot. The shared contract defines ranges, framing bounds, deadlines, and wraparound policies; implementations cannot choose conflicting profiles independently.

Each `HELLO|1` creates a session barrier and cancels active outputs. The browser becomes ready only after validated `deviceInfo` and a first valid snapshot. Missing fresh snapshots triggers bounded recovery and immediate unavailable input, including when USB stays open during a firmware reset. Counter baselines reset at session boundaries, so past presses are not replayed. Device timestamps drive gesture timing; host monotonic time drives freshness.

The page owns one adapter/serial port and gives the active game a disposable facade. Switching games cancels old work and clears outputs while retaining the connection. Web-to-micro:bit output remains `text-v1` with correlated results, as recorded in ADR-004.

### Consequences

* Good, because each message contains a complete view of the sensor state, so the browser adapter does not need to merge independent sensor events.
* Good, because the shared adapter can provide the same current-state interface to every game, keeping games independent of the serial protocol.
* Good, because a subsequent snapshot restores current state and cumulative press counts after a missed message within the same session. Session recovery deliberately establishes a fresh baseline instead of replaying historical actions.
* Bad, because unchanged readings are retransmitted, increasing message volume compared with change-only events.
* Bad, because sampling can still miss transient motions or sounds; digital counters only guarantee debounced press counts. The selected cadence and game latency budgets must be verified on hardware.
* Bad, because timestamps and press counters increase snapshot size, and unavailable sensors cause full-snapshot loss until recovery.
* The browser exposes stable null/neutral unavailable state, counted press events, and deterministic tilt/shake/sound derivation. Both implementations use shared conformance fixtures and parse complete lines rather than serial read boundaries.

## Protocol Documentation

The protocol and firmware responsibilities are documented in [micro:bit Serial Protocol](../contracts/microbit-webapp/microbit-serial-protocol.md). The game-facing browser API is documented in [Web-Page Developer Interface](../contracts/microbit-webapp/web-page-developer-interface.md). The fixed text command encoding is recorded in [ADR-004](adr-004-microbit-command-encoding.md).
