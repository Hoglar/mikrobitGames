# WBS 1.4 – Backend API og database

**Kortversjon til WBS 1.4, revisjon 1.2 (2026-10-27).** Oppdatert etter brukerens valg om alle spillforsøk. Tidligere godkjenning gjaldt 1.1. [Detaljert kontrakt](contract.md) og [datamodell](../../models/data-model.md) er implementeringsgrunnlaget; ingen database eller produktverifisering er levert.

Oppgave 2 tillater en liten mock-up eller reell database. PostgreSQL, kontofunksjonene og den detaljerte driftsplanleggingen er prosjektets egne valg, ikke uttrykkelige krav fra oppgaveteksten. WBS 1.4 beskriver samspillet; implementasjon, kjørbare tester og faktiske målinger følger i senere issues.

## Funksjonelle krav

Vi lagrer spillere, innloggingssesjoner, spill, alle avsluttede private spillforsøk og offentlige personlige rekorder. Bare fullførte forsøk kan gi rekord, og tidligere rekorder beholdes for progresjon. Ufullførte forsøk kan ha delverdi eller null. Hvert spill angir om høyere eller lavere verdi er best. Like verdier i ulike forsøk lagres hver for seg uten ny rekordrad; spillere med lik rekord deler plassering.

Spillere oppretter konto selv. Ordinær spilling og innsending krever innlogging; Testlab er et lokalt unntak uten resultatlagring. topplister og rekordhistorikk er offentlige. Passord kan endres med gjeldende passord som bekreftelse. Kontosletting fjerner konto, sesjoner, forsøk og rekorder samlet. Utviklerne administrerer spill, og spill med historikk deaktiveres fremfor å slettes.

## Grensesnitt og datastruktur

- **Database:** PostgreSQL på samme Linux-PC som backend.
- **Kommunikasjon:** Anbefalt lokal databaseforbindelse gjennom et etablert bibliotek, med egen databasebruker og begrensede rettigheter.
- **Data:** Fem tabeller, `players`, `sessions`, `games`, `attempts` og `records`, med stabile ID-er og kontrollerte relasjoner. [Felt og begrensninger](../../models/data-model.md).
- **Operasjoner:** Opprette konto, inn-/utlogging, passordendring, kontosletting, registrere forsøk og eventuell rekord atomisk, hente egen privat forsøkshistorikk og offentlige topplister/rekordhistorikk og administrere spill.
- **Feil:** Ugyldige data avvises. Flertrinnslagringer gjennomføres samlet eller rulles tilbake. Databasefeil skal aldri rapporteres som vellykket lagring.
- **Beskyttelse:** Passord lagres som hash. Backend bestemmer spilleridentiteten fra innloggingen.

**Sesjoner:** [Del 8 i kontrakten](contract.md#8-autentisering-og-drift) er fasit for fornyelse, utløp og håndtering under spilling. Reglene brukes i første backend-implementasjon og tester; frontendforløpet følger API-kontrakt 1.3 revisjon 0.2.0. Omforsøk bruker samme spiller/forsøks-ID og identisk innhold; endret innhold gir konflikt.

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

[Kontrakten](contract.md), [datamodellen](../../models/data-model.md), [verifikasjonsplanen](verification-plan.md) og [ADR-005](../../../../spec/decisions/adr-005-postgresql.md) dekker beskrivelsene og planleggingen i issuet. Prosjekteier godkjente den tidligere dokumentpakken som WBS 1.4-leveranse; dette er en funksjonell revisjon med eget oppdatert testgrunnlag. Commit, publisering og lukking av issue #4 håndteres separat.

**Les denne siden først.** Detaljert låsing, tidsavbrudd, indeksvalg og drift er oppslagsmateriale og tekniske anbefalinger. Ikke alt må være ferdig implementert eller bevist for å levere spesifikasjonen i 1.4.
