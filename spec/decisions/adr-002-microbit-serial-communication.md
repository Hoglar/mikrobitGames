# Defining the micro:bit serial communication protocol

## Context and Problem Statement

The micro:bit sensors will provide input to multiple games running on a web page. The page will use a shared browser-side adapter to receive sensor data, maintain the current sensor state, expose a consistent interface to each game, and send output commands back to the micro:bit.

This decision defines the sensor update strategy. The bidirectional protocol uses JSON messages over the serial connection, with the micro:bit sending sensor snapshots and the page sending commands for supported built-in outputs. It should keep inputs responsive, be straightforward to parse and debug, and provide a consistent current state for the browser adapter and games.

## Decision Drivers

* Keep input latency low enough for responsive gameplay.
* Make the protocol simple to parse and debug in the browser.
* Provide a consistent current sensor state to all games.
* Keep the browser adapter independent of individual games.

## Considered Options

Sensor delivery options use JSON messages, with one JSON object per line to provide message boundaries over the serial stream. Web-to-micro:bit output commands and their results use the same framing.

* **Periodic full snapshots:** Send all current sensor readings together in one JSON object at a fixed transmission interval.
* **Per-sensor change events:** Send an event for an individual sensor only when its value changes. The browser adapter must combine events into the current sensor state.
* **Hybrid updates:** Send per-sensor change events and periodically send a full snapshot to initialize or resynchronize the browser adapter.

## Decision Outcome

Chosen option: **Periodic full snapshots for sensor input.** The micro:bit will send all current sensor readings together as one JSON object per line at a fixed transmission interval. Web-to-micro:bit output uses individual JSON command messages with correlated results. This keeps browser-side sensor state management simple and gives games a coherent view of current inputs. The interval will be selected and validated during implementation to balance responsiveness and message volume.

### Consequences

* Good, because each message contains a complete view of the sensor state, so the browser adapter does not need to merge independent sensor events.
* Good, because the shared adapter can provide the same current-state interface to every game, keeping games independent of the serial protocol.
* Good, because a subsequent snapshot restores the current state if an earlier message was missed or the connection resumes.
* Bad, because unchanged readings are retransmitted, increasing message volume compared with change-only events.
* Bad, because responsiveness depends on the chosen transmission interval; the interval must be tested with the games.
* The message schema must define stable field names, units, and how unavailable or invalid readings are represented. The adapter will parse complete newline-terminated messages rather than assuming each serial read contains exactly one message.

## Protocol Documentation

The proposed protocol and firmware responsibilities are documented in [micro:bit Serial Protocol](../contracts/microbit-webapp/microbit-serial-protocol.md). The game-facing browser API and JSON handling are documented in [Web-Page Developer Interface](../contracts/microbit-webapp/web-page-developer-interface.md).