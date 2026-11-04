# Spillkassetter og felles spillbibliotek

**Status:** Publisert fra `2c209f2` 2026-11-04 med automatisk mappeoppdaging, SDK/sandbox, lokale rekorder og migrering 002. Se [lokal validering](../../results/cartridges-validation.md) og [utrullingskontrollen med kjent Viking-testavvik](../../../results/verification/sdk-publication-2026-11-04.md). Fysisk Micro:bit-akseptanse gjenstår.

Målet er at en utvikler lager én spillmappe, tester den, og deler den som ZIP. Mottakeren pakker den ut i spillmappen. Plattformen skal oppdage spillet, vise omslaget, håndtere Micro:bit, pause/fullskjerm og rekorder uten at utvikleren endrer launcheren, registeret, CSS-importer eller backendkode. Biblioteket heter foreløpig **Micro:bit Games SDK**, med importnavnet `@microbit-games/sdk`.

## Avklarte produktvalg

| Tema | Beslutning |
| --- | --- |
| Installasjon | Bare mappe i `webapp/src/games/`. ZIP er et delingsformat som mottakeren pakker ut selv; ingen ZIP-import gjennom nettsiden. |
| Kjøring | Importerte spill isoleres fra vertssiden; Micro:bit og rekorder formidles gjennom SDK-et. |
| Online | Spill installert på det hostede nettstedet får automatisk online-topplister gjennom bygge-/utrullingsflyten. Ingen manuell registrering per spill og ingen offentlig opplastings-/registreringsrute. |
| Lokalt | Spilling og lokale rekorder krever verken konto, backend eller registrering på server. |
| Navn | Frivillig navnefelt etter fullført spill. Uten navn lagres ingen lokal rekord. |
| Personlig rekord | Én beste rekord per normalisert navn og konkurransevariant. Bare strengt bedre score erstatter den gamle. Lavere tid kan være bedre. |
| Deling på server | Spillkode og ressurser publiseres med nettstedet fra installerte mapper. Bare den som har tilgang til nettstedets filer/utrulling kan installere spill der. Besøkende kan ikke laste opp spill. |

Filnavn, omslagsformat, størrelsesgrenser og versjonering nedenfor er kontrakten for SDK v1. Endringer må følge manifest-/SDK-versjoneringen.

## Leserekkefølge

1. [Spesifikasjon](specification.md): krav WEB-093–WEB-124 og brukerforløp.
2. [Lag og del et spill](developer-guide.md): kort, menneskelesbar målguide med komplett eksempel.
3. [Pakkekontrakt](package-format.md): mapper, manifest, konkurransevarianter og identitet. [JSON Schema](game.schema.json) og [eksempelmanifest](example.game.json) konkretiserer kontrakten.
4. [SDK-kontrakt](sdk-api.md): livsløp, input/output, score og hostfunksjoner.
5. [Automatiske online-topplister](online-leaderboards.md): nødvendige backendendringer, registrering og kompatibilitet.
6. [Refaktoreringsplan](refactoring-plan.md): dagens koblinger, målarkitektur, migrering og leveranserekkefølge.
7. [Testplan](test-plan.md): akseptanse og regresjonskontroller.

## Forholdet til dagens kontrakter

Dette er den implementerte SDK-utvidelsen. Den tidligere lokale øvingsmodusen uten lagring er dokumentert historisk; [implementasjonsnotatet](../webapp-implementation.md#lokalt-spill--unntak-for-utvikling-2026-10-29) beskriver dette. Dagens [API 0.3.0](../../../spec/contracts/webapp-backend/contract.md) krever forhåndsregistrerte spill med heltallsscore. SDK-et skjuler heltallstransporten. Backendens valgfrie metadata er beskrevet som et lokalt implementert tillegg til API 0.3.0; eksisterende ID-er og resultatbody beholdes.

[Micro:bit-biblioteket](../../src/microbit-input/README.md) og [seriellkontrakten](../../../spec/contracts/microbit-webapp/README.md) beholdes som kilder til sensor-/outputsemantikk. Nytt SDK eksponerer denne funksjonaliteten gjennom en spillavgrenset bro; det innfører ingen ny firmwareprotokoll eller egen serialforbindelse per spill. Refaktoreringen skal bevare de eksisterende spillenes regler, stabile backend-ID-er og rekordhistorikk.
