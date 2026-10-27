# WBS 1.4 – Backend API og database

**Kortversjon til [issue #4](https://github.com/Hoglar/mikrobitGames/issues/4).** Dokumentasjonen er ferdigstilt og godkjent av prosjekteier 2026-10-23 som leveranse for WBS 1.4. Den beskriver planlagt oppførsel; ingen kode er implementert og ingen funksjonelle tester er kjørt. [Detaljert kontrakt](contract.md) er fasit ved senere implementasjon.

Oppgave 2 tillater en liten mock-up eller reell database. PostgreSQL, kontofunksjonene og den detaljerte driftsplanleggingen er prosjektets egne valg, ikke uttrykkelige krav fra oppgaveteksten. WBS 1.4 beskriver samspillet; implementasjon, kjørbare tester og faktiske målinger følger i senere issues.

## Funksjonelle krav

Vi lagrer spillere, innloggingssesjoner, spill og personlige rekorder per spiller og spill. Bare nye rekorder lagres, og tidligere rekorder beholdes for progresjon. Hvert spill angir om høyere eller lavere verdi er best. Like personlige resultater lagres ikke på nytt; spillere med lik rekord deler plassering.

Spillere oppretter konto selv. Spilling og innsending krever innlogging; topplister og rekordhistorikk er offentlige. Passord kan endres med gjeldende passord som bekreftelse. Kontosletting fjerner konto, sesjoner og rekorder samlet. Utviklerne administrerer spill, og spill med historikk deaktiveres fremfor å slettes.

## Grensesnitt og datastruktur

- **Database:** PostgreSQL på samme Linux-PC som backend.
- **Kommunikasjon:** Anbefalt lokal databaseforbindelse gjennom et etablert bibliotek, med egen databasebruker og begrensede rettigheter.
- **Data:** Fire tabeller, `players`, `sessions`, `games` og `records`, med stabile ID-er og kontrollerte relasjoner. [Felt og begrensninger](../../models/data-model.md).
- **Operasjoner:** Opprette konto, inn-/utlogging, passordendring, kontosletting, registrere rekord, hente topplister/historikk og administrere spill.
- **Feil:** Ugyldige data avvises. Flertrinnslagringer gjennomføres samlet eller rulles tilbake. Databasefeil skal aldri rapporteres som vellykket lagring.
- **Beskyttelse:** Passord lagres som hash. Backend bestemmer spilleridentiteten fra innloggingen.

**Sesjoner:** [Del 8 i kontrakten](contract.md#8-autentisering-og-drift) er fasit for fornyelse, utløp og håndtering under spilling. Reglene brukes i første backend-implementasjon og tester; frontendforløpet følger den godkjente kontrakten i 1.3.

## Kvalitetskrav

| Prioritet | Viktigste krav |
| --- | --- |
| 1 | Dataintegritet og sikkerhet: riktige spillere/spill, bevart rekordhistorikk og kontrollert tilgang. |
| 2 | Pålitelighet: bekreftede lagringer tåler omstart, og feil gir tydelige utfall. |
| 3 | Ytelse og drift: opptil 30 samtidige spillere; p95 innen 200 ms ved normal testlast og alle kall innen ett sekund ved en topp på 30 samtidige forespørsler. |

Ytelsesmålene gjelder backendens databaseoperasjoner. De er avtalte mål, ikke måleresultater. Forslag til testlast, ressursbudsjett og sikkerhetskopiering finnes i den detaljerte kontrakten og kan vurderes ved gjennomgang.

## Verifisering

| Begrep | Hva vi bruker det til |
| --- | --- |
| Enhetstester | Kontrollere isolert logikk: ny rekord, rangering, validering og tidsregler. Ingen ekte database nødvendig. |
| Integrasjonstester | Kontrollere at virkelig backend og PostgreSQL lagrer, leser, oppdaterer og sletter riktig. |
| Verifisering | Knytte tester og uttrekk av faktisk databaseskjema til krav og datamodell. |
| FoM | Følge utviklingen med samme målemetode. Felles krav-FoM og modell-FoM er valgt i [implementeringsplanen](../../implementation-plan.md); responstid måles fortsatt som benchmark. |

Testfasiten kommer fra kravene. AI kan skrive tester, men forventede resultater skal gjennomgås. [Verifikasjonsplanen](verification-plan.md) beskriver konkrete tester; [arbeidsflyten](../../iterative-development.md) forklarer senere iterativ utvikling.

## Dokumentasjon og ferdigstilling

[Kontrakten](contract.md), [datamodellen](../../models/data-model.md), [verifikasjonsplanen](verification-plan.md) og [ADR-005](../../../../spec/decisions/adr-005-postgresql.md) dekker beskrivelsene og planleggingen i issuet. Prosjekteier har gjennomgått dokumentpakken og erklært WBS 1.4 ferdig. Commit, publisering og lukking av issue #4 håndteres separat.

**Les denne siden først.** Detaljert låsing, tidsavbrudd, indeksvalg og drift er oppslagsmateriale og tekniske anbefalinger. Ikke alt må være ferdig implementert eller bevist for å levere spesifikasjonen i 1.4.
