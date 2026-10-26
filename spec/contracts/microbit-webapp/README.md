# Micro:bit–webapp

Shared draft contract for the built-in micro:bit game controller, associated with [WBS 1.2](https://github.com/Hoglar/mikrobitGames/issues/2). Firmware and browser implementations are not present yet; numerical requirements have not been verified on hardware.

- [Serial protocol](microbit-serial-protocol.md): authoritative wire schema, transport settings, limits, session/recovery rules, and command semantics.
- [Game developer interface](web-page-developer-interface.md): page/game ownership, public state, counted presses, derivation rules, and output API.
- [Shared fixtures](fixtures/README.md): machine-readable examples for both implementations and instructions for extending the corpus.
- [Firmware tests](../../../microbit/spec/test-plan.md) and [browser tests](../../../webapp/spec/test-plan.md): conformance checks, recovery scenarios, and measurement requirements.
- ADRs [002](../../decisions/adr-002-microbit-serial-communication.md) and [004](../../decisions/adr-004-microbit-command-encoding.md): architecture and command-encoding rationale.

The serial protocol owns wire constants; the public interface owns game-facing behavior. Test plans reference those definitions. Revise these documents and the fixtures together when changing the draft. Incompatible changes after deployment require a protocol-version increment.
