# V2 Firmware Specifications

- [Implementation design](firmware-implementation.md): proposed C++/CODAL components, scheduling, storage, driver bindings, and failure handling.
- [Test plan](test-plan.md): host conformance, physical V2 behavior, fault injection, and performance gates.
- [Build and flash guide](../README.md): integration recipe, version-lock requirements, and current implementation status.
- [Shared serial contract](../../spec/contracts/microbit-webapp/microbit-serial-protocol.md): authoritative wire schema and behavior.
- [ADR-008](../../spec/decisions/adr-008-microbit-v2-cpp-codal.md): runtime, language, and V2-only scope.

Models belong in [models/](models/README.md); the existing component diagram remains a placeholder. Additional requirements should reference shared contracts instead of duplicating schemas or numerical limits. Firmware/build tooling is not implemented yet.
