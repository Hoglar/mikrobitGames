# ADR-005: PostgreSQL for spillerdata og rekordhistorikk

**Status:** Godkjent av prosjekteier som del av den ferdigstilte dokumentasjonsleveransen for WBS 1.4, 2026-10-23.

**Dato:** 2026-10-23.

## Kontekst og problemstilling

Backend skal lagre spillerkontoer, innloggingssesjoner, spill og personlige rekorder med historikk. Forventet bruk er opptil 30 samtidige spillere. Backend og database skal kjøre på en eksisterende Parrot Linux-PC med 16 GB RAM.

Valget gjelder databaseteknologien i [WBS 1.4](https://github.com/Hoglar/mikrobitGames/issues/4). Det velger ikke backend-språk, rammeverk eller databasebibliotek. Krav og tilkoblingsforslag finnes i [API–database-kontrakten](../../backend/spec/contracts/backend-database/contract.md).

## Beslutningsdrivere

- Dataintegritet og sikkerhet har høyest prioritet: gyldige relasjoner, unike kontoer, konsistent rekordhistorikk og avgrensede rettigheter.
- Bekreftede lagringer skal tåle omstart, og flertrinnsoperasjoner skal kunne gjennomføres atomisk.
- Responstidsmålene skal kunne testes med en reproduserbar arbeidslast for opptil 30 samtidige spillere.
- Løsningen skal kunne driftes på én eksisterende Linux-PC og ha dokumentert oppsett og sikkerhetskopiering.

## Vurderte alternativer

| Alternativ | Vurdering |
| --- | --- |
| PostgreSQL | En relasjonsdatabase med transaksjoner, integritetsbegrensninger og egne roller med avgrensede rettigheter. Krever at en databasetjeneste settes opp og driftes. |
| SQLite | Enkel lokal databasefil med lite administrasjon og støtte for transaksjoner. Har ikke PostgreSQL-lignende databasebrukere med `GRANT`/`REVOKE`; tilgangsgrenser må i større grad håndteres i applikasjonen og gjennom filrettigheter. |

Begge kan være aktuelle for et lite prosjekt. PostgreSQL velges for kombinasjonen av relasjonsmodell, samtidige transaksjoner og tilgangskontroll i selve databasen. Valget bygger ikke på en påstand om at SQLite er for treg ved 30 spillere.

## Beslutning

Vi bruker **PostgreSQL**. Prosjekteier har valgt denne databasen i arbeidet med kontrakten. Konkrete datatyper, rettigheter og transaksjonsregler skal dokumenteres i kontrakten, og implementasjonen skal senere verifiseres mot kravene.

## Konsekvenser

- DB-001–DB-002 kan støttes med integritetsbegrensninger og transaksjoner. Valg av PostgreSQL alene sikrer ikke korrekt samtidig rekordregistrering; kontrakten beskriver en anbefalt låsestrategi som må testes ved implementasjon.
- DB-003 kan støttes med en egen driftsrolle for backend og separat rolle for skjemaendringer.
- DB-004–DB-005 krever fortsatt riktig oppsett, commit-håndtering og tester av omstart og forbindelsesbrudd.
- DB-006–DB-007 må verifiseres på den faktiske serveren. Det foreligger ingen målinger som viser at ytelsesmålene er oppfylt.
- En egen databasetjeneste medfører oppsett, vedlikehold og sikkerhetskopiering. Dette inngår i DB-008.
- Hovedversjon, bibliotek og detaljert driftskonfigurasjon dokumenteres før implementasjon. Denne beslutningen installerer eller konfigurerer ingen programvare.

## Kilder

- [PostgreSQL: Transaksjoner](https://www.postgresql.org/docs/current/tutorial-transactions.html).
- [PostgreSQL: Roller og rettigheter](https://www.postgresql.org/docs/current/user-manag.html).
- [SQLite: Manglende støtte for GRANT og REVOKE](https://www.sqlite.org/omitted.html).
