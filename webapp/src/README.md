# Kildekode

Implementasjonen av denne systemdelen. Organiser filer etter ansvar og valgt teknologi. Språk, verktøy og kommandoer for bygging og kjøring dokumenteres i modulens README når de er valgt.

Det felles Micro:bit-biblioteket planlegges som JavaScript ES-moduler under `microbit-input/`, med offentlig import fra `microbit-input/index.js`. Følg [implementeringsplanen](../spec/game-input-implementation-plan.md) for modulansvar og testbare grenser. Katalogene og biblioteket er ikke opprettet ennå; transport, protokoll, input og kommandoer skal være uavhengige av individuelle spill og frontendrammeverk.
