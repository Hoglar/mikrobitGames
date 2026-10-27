# V2 C++ Firmware Source

`main.cpp` initializes one CODAL device and application. Five cooperative fibers in `app.cpp` handle digital polling, sensor acquisition, protocol RX, output deadlines and serial TX.

| Source | Responsibility |
|---|---|
| `core/protocol.*` | Wire bounds/types, line framing, command parsing, checked ASCII encoders, debounce, absolute deadlines and named-sound definitions |
| `core/firmware.*` | Sessions, ID consumption, handshake barriers, ordered control FIFO, latest snapshot mailbox, partial TX and transport faults |
| `core/outputs.*` | Owned text/image/melody state, fixed scroll timing, independent output replacement, cancellation and failure handling |
| `core/ring-buffer.h` | Fixed-capacity application RX ring |
| `platform/codal/board.*` | Serial/sensor setup, raw inputs, matrix rendering, microphone readiness and sine-wave synthesis |
| `app.*` | Scheduling, bounded driver service, coherent digital copies, RX overflow recovery and debugger statistics |

The core depends only on standard C/C++ headers and has no runtime allocations or scheduler calls. Core entry points execute without yielding. The application serializes access through CODAL's cooperative fibers; only driver flags and audio parameters cross interrupt boundaries. Output hardware calls used by the core are nonblocking. Interrupt code does not parse commands or encode messages.

Only the TX fiber sends protocol bytes. Results/bootstrap records have priority between complete lines; an already-started snapshot finishes before the next handshake metadata. A pending snapshot older than 100 ms is discarded before transmission. RX pauses command consumption when control storage is full while continuing to drain the driver into the 512-byte ring. Overflow discards to LF and requires another handshake. Three accumulated one-second TX-progress stalls request a reset; successful handshake does not erase stall diagnostics.

The application owns one board adapter, firmware controller, three digital trackers and one RX ring. `static_assert` limits application storage to 16 KiB, excluding CODAL allocations/fiber stacks. Driver and mixer allocations still require physical memory/soak measurements. See [CODAL bindings](platform/codal/README.md) for version-specific details and [build instructions](../README.md).
