# Shared Protocol Conformance Fixtures

[conformance.json](conformance.json) is a language-independent corpus for the firmware parser and browser adapter. It contains examples and expected outcomes, not a test runner or a hardware-verification result. The [serial contract](../microbit-serial-protocol.md) and [public interface](../web-page-developer-interface.md) remain authoritative. Change the corpus and affected test-plan cases with any contract revision.

## Harness Interpretation

- `deviceInfo` and `snapshots` contain the supported V2 objects to serialize as compact ASCII JSON plus LF. `v2` is a fixture reference, not a wire field. V1 appears only as a rejected identity; no V1 image, positive fixture, or hardware run is required.
- `deviceInfoCases` start from metadata `base`, apply top-level `set`, remove keys in `omit`, and test browser startup validation. `accepted` states the outcome. Missing mandatory V2 capabilities and unsupported identities must fail startup.
- Each `commandCases` entry starts a separate active session for `board` (default `v2`), with highest consumed ID `highestId` (default 0). Append LF to `line`; compare the complete response without its LF to `result`. `actionApplied` describes whether an output action starts/applies. Errors must leave outputs unchanged. Do not carry IDs from one case to the next.
- `snapshotCases` start from `base`, apply `set`, remove keys in `omit`, and serialize the resulting object. `accepted` describes schema validity against that board, before sequence history. Keys in `set` can add unknown fields. Use exact JSON types; booleans are not integers.
- `sequenceCases` use `board` and merge every entry of `samples` into that board's base snapshot. Feed them in order in one ready session. The first establishes baselines. `expectedPresses` lists subsequent counted events and their zero-based sample index; `expectedGaps` gives sequence-gap counts by index. These cases test wrap and missed pressed-state snapshots.
- `tiltCases` apply the public formula to a single axis and compare numbers with absolute tolerance `1e-12`.
- `shakeCases` merge sample entries into the V2 base. Feed the first as the session baseline. `emissionIndices` gives zero-based samples that emit `shake`. Replay once with individual reads and again in a single read; device timestamps must produce identical outcomes.
- `resultCases` start with the specified pending ID and consume one result line. `settlement` is `resolve`, `reject`, or `pending`; unknown IDs never settle another call. Fixtures with invalid results must also exercise the subsequent timeout using a fake clock.

## Generated Boundary and Lifecycle Cases

Alongside the literal corpus, generate exact-minimum, exact-maximum, and one-past-maximum tests from the contract, including maximum IDs, text/image/melody sizes, JSON fields, and counter/time wrap. Do not infer a hardware minimum input pulse from host timing alone.

For every wire fixture, split at every byte boundary, use LF and CRLF, and batch multiple complete messages. Add an unterminated line larger than the relevant receiver limit, then LF and a known valid fixture: memory stays bounded and parsing resumes. Include duplicate JSON keys as raw JSON text; serializing an object cannot generate that case.

Use fake-clock/session tests for startup without a first snapshot, repeated `HELLO`, old buffered snapshots/results, freshness timeout despite continuing results/invalid lines, late acknowledgements, ID exhaustion, command timeout/partial writes, queue overload, quiet re-arm/cooldown, sensor failure, and disposal during an in-flight command. Assert that no historical input or output crosses a new `deviceInfo` barrier or game boundary. Re-arm tests must include continuous quiet samples, not just elapsed host time.

Route sections by direction: firmware consumes command/framing cases and compares encoders with positive metadata/snapshot examples; the browser validates incoming metadata/snapshots/results and runs sequence/derivation cases. Firmware does not parse incoming sensor JSON. Cross-component sessions use modeled clocks/transports as appropriate rather than claiming firmware-only tests prove browser behavior.

Hardware checks establish physical axis signs, debounce behavior, output replacement, serial-buffer handling, and achievable cadence on V2. Pure fixture passes do not establish those properties. Both [firmware](../../../../microbit/spec/test-plan.md) and [browser](../../../../webapp/spec/game-input-test-plan.md) runners should report the fixture revision used.
