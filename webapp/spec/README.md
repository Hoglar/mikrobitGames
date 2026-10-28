# Krav, modeller og testplan

[Komponentspesifikasjonen](Komponentspesifikasjon_webapplikasjon_forklart.md) beskriver frontendkrav og ansvar, samordnet med [API 0.2.0](../../spec/contracts/webapp-backend/README.md). [Plattformtestplanen](platform-test-plan.md) dekker konto, private forsøk, offentlige rekorder og AI. En eventuell separat requirements.md skal gjengi disse kravene fremfor å innføre andre regler. [Testplanen](game-input-test-plan.md) beskriver testing og benchmarking av det felles spillinput-biblioteket. Modeller lagres under [models/](models/README.md). Referer til relevante felles kontrakter fremfor å kopiere dem.

[Spillspesifikasjoner](games/README.md) samles i `games/<game-name>/`. Første spill er [Micro:bit Testlab](games/microbit-testlab/README.md).

[Implementeringsplanen for JavaScript-biblioteket](game-input-implementation-plan.md) beskriver modulstruktur, tester og integrasjon med spillplattformen. Bibliotek, lokaleksempel, fake-transport-/nettlesertester og replay-benchmarks er implementert som V2-only ES-moduler uten kjøretidsavhengigheter. Fysisk V2-/USB- og latensakseptanse gjenstår; se [valideringsrapporten](../results/game-input-validation.md).

[Samlet implementasjonsplan](implementation-plan.md) dekker leveranserekkefølge, avhengigheter, kjørbare enhetstester, benchmarks og gjenstående produktverifikasjon.
