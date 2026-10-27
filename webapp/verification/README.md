# Verifikasjonsverktøy

Skript for automatisert modelluttrekk, deterministisk sammenligning og benchmarks. Dokumenter forutsetninger og kjørekommando sammen med hvert verktøy. Resultater lagres under modulens results. Ingen verktøy er implementert ennå.

For Micro:bit-biblioteket følger verifikasjonen [implementeringsplanen](../spec/game-input-implementation-plan.md) og [testplanen](../spec/game-input-test-plan.md). Planlagte leveranser er en lokal ES-modul-eksempelside, fixture-baserte målinger og separate manuelle V2-/nettleserkontroller. Eksempel og verktøy er ennå ikke implementert.

Rapporter programvarerevisjon, fixture-revisjon, Node-/nettleser-/verktøyversjoner og fysisk V2-/firmwareoppsett der det brukes. Skill mock-resultater fra ekte tillatelsesdialog, USB, fysiske stimuli og output. Kontroller at tap av input pauser spillet og at gjenopprettet forbindelse venter på spillerens valg om å fortsette. Resultater og begrensninger lagres under `webapp/results`; uinstrumentert fysisk latenstid kan ikke føres som bestått.
