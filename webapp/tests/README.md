# Lokale tester

Enhetstester og tester av samspillet mellom interne komponenter. Følg [testplanen](../spec/game-input-test-plan.md) og referer til relevante krav. Kun tester som krever fysisk micro:bit skal hoppes over når kortet ikke er tilkoblet; enhetstester og tester med fake transport skal fortsatt kjøres. Tester mellom hoveddelene ligger under tests i repositoryets rot. Ingen kjørbare tester er implementert ennå.

## Planlagt Micro:bit-teststruktur

[Implementeringsplanen](../spec/game-input-implementation-plan.md) definerer `microbit-input/unit/`, `transport/`, `browser/` og `support/` under denne katalogen. Bruk Node sin testkjører for enhetstester/fake transport og Playwright for nettlesertester. Fake klokke og transport injiseres i bibliotekets interne fabrikk; tester skal ikke bruke en fysisk port eller virkelige ventetider for å bevise tidsavbrudd.

Gjenbruk [felles fixtures](../../spec/contracts/microbit-webapp/fixtures/README.md), med rå JSON-tilfeller for duplikatnøkler og genererte grense-/livssyklustester. Test ny tilkobling, bortfall, brukerbestemt fortsettelse, avslutning uten port og bytte mellom to spill. Nettlesermock installeres før biblioteket importeres; en mock-test beviser ikke at faktisk USB eller operativsystemets tillatelsesdialog fungerer.

Ingen npm-skript er opprettet ennå. Dokumenter kjørbare kommandoer og låste verktøyversjoner når første testoppsett implementeres. Manglende maskinvare skal aldri hoppe over programvaretestene.
