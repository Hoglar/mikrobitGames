# Datamodell – backend, WBS 1.4

**Status:** Samordnet designrevisjon 2026-10-27 etter [databasekontrakt 1.2](../contracts/backend-database/contract.md) og [API 0.2.0](../../../spec/contracts/webapp-backend/contract.md). Godkjenningen av tidligere modell gjaldt rekordbasert lagring. Ingen migrering er implementert. ER-diagram og JSON-fasit gjengir denne revisjonen.

## Felles regler

Se [ER-diagrammet](database-er.drawio) for en visuell oversikt over tabeller og relasjoner. Feltregler og begrensninger er spesifisert nedenfor.

Tabellene ligger i skjema `app`. Alle felt er `NOT NULL` unntatt eksplisitt nullable felt i `attempts`. ID-er bruker `uuid`. Backend genererer ID-er for spillere, sesjoner, spill og rekorder; forsøks-ID genereres av frontend og er unik per spiller. Tidspunkter bruker `timestamptz`, settes av serveren og utveksles som UTC. `created_at` på rekorder settes etter låsing og validering, slik at det beskriver registreringen.

E-post inngår ikke. Alle avsluttede spillforsøk lagres privat i `attempts`; offentlige rekorder lagres separat i `records`. Ingen tabell lagrer råpassord eller rå sesjonstoken. Datamodellen er autoritativ for felter og begrensninger; kontrakten er autoritativ for operasjonsflyt og tilgangsregler.

## `players`

| Felt | Type | Begrensning / formål |
| --- | --- | --- |
| `id` | `uuid` | Primærnøkkel; stabil spilleridentitet. |
| `username` | `varchar(32)` | 3–32 ASCII-tegn, bare bokstaver, sifre, `_` og `-`. Bevarer valgt bruk av store/små bokstaver for visning. |
| `username_key` | `varchar(32)` | Generert som småbokstavversjonen av `username`; unik. ASCII-begrensningen gjør normaliseringen entydig. |
| `password_hash` | `text` | Ikke tom. Kodet Argon2id-hash med salt og parametere. Lengde og format valideres i backend; databasefeltet har ikke passordet. |
| `created_at` | `timestamptz` | Kontoens opprettelsestidspunkt. |

Databasebegrensninger: primærnøkkel, unik `username_key`, sjekk av tegn/lengde i `username` og ikke-tom `password_hash`. Passordlengde kontrolleres før hashing, ikke av databasen. Brukernavn endres ikke i første versjon.

## `sessions`

| Felt | Type | Begrensning / formål |
| --- | --- | --- |
| `id` | `uuid` | Primærnøkkel. |
| `token_hash` | `bytea` | Unik; nøyaktig 32 byte, SHA-256 av tilfeldig token. |
| `player_id` | `uuid` | Fremmednøkkel til `players.id`, `ON DELETE CASCADE`. |
| `created_at` | `timestamptz` | Tidspunkt for opprettelse etter vellykket innlogging. |
| `renewed_at` | `timestamptz` | Siste servergodkjente fornyelse; lik `created_at` ved opprettelse. |
| `absolute_expires_at` | `timestamptz` | Nøyaktig 2 592 000 sekunder etter `created_at` (30 døgn). Kan ikke flyttes ved fornyelse. |
| `expires_at` | `timestamptz` | Det tidligste av `renewed_at` + 259 200 sekunder og `absolute_expires_at`. |

Tokenets råverdi anbefales generert fra 32 kryptografisk tilfeldige byte. Bare `renewed_at` og `expires_at` oppdateres ved fornyelse; utlogging/passordendring sletter sesjoner. Radbegrensninger håndhever de oppgitte tidsrelasjonene og `created_at <= renewed_at < absolute_expires_at`. Tidsintervallene er sekunder, uavhengig av skifte mellom sommer- og vintertid. Backend håndhever at oppdateringen skjer før gjeldende utløp; en `CHECK` alene kan ikke kontrollere dette forløpet. Oppslag kontrollerer utløpstidspunkt selv om raden finnes. Indekser: unik `token_hash`, `player_id` for opprydding per spiller og `expires_at` for sletting av utløpte sesjoner.

## `games`

| Felt | Type | Begrensning / formål |
| --- | --- | --- |
| `id` | `uuid` | Primærnøkkel; identiteten endres ikke ved navneendring. |
| `name` | `varchar(100)` | Ikke tomt eller bare mellomrom. |
| `score_unit` | `varchar(32)` | Ikke tom; eksempelvis `points` eller `milliseconds`. |
| `ranking_direction` | `varchar(16)` | Bare `higher_is_better` eller `lower_is_better`. |
| `min_value` | `bigint` | Minste tillatte resultat, minst 0. |
| `max_value` | `bigint` | Største tillatte resultat, minst `min_value` og høyst 9 007 199 254 740 991. |
| `is_active` | `boolean` | Om nye resultater kan registreres. |

Resultatgrensen holder heltall innenfor eksakt representasjon i vanlige JavaScript-tall. Spillutvikleren velger enhet og konkrete grenser ved opprettelse. Desimaltid skaleres til heltall i millisekunder. Navn og aktiv-status kan endres. Enhet, retning og intervall kan ikke endres etter første forsøk; administrasjonsoperasjonen låser spillraden og kontrollerer både forsøk og rekordhistorikk før endring. Dette er en operasjonsregel, ikke en radlokal `CHECK` på `games`.

## `records`

| Felt | Type | Begrensning / formål |
| --- | --- | --- |
| `id` | `uuid` | Primærnøkkel. |
| `player_id` | `uuid` | Fremmednøkkel til `players.id`, `ON DELETE CASCADE`. |
| `game_id` | `uuid` | Fremmednøkkel til `games.id`, `ON DELETE RESTRICT`. |
| `value` | `bigint` | Mellom 0 og 9 007 199 254 740 991. Backend kontrollerer i tillegg spillets snevrere intervall. |
| `created_at` | `timestamptz` | Tidspunkt for registrering på serveren. |

Unik kombinasjon av `(player_id, game_id, value)` forhindrer duplisert lagring av samme rekordverdi. Backendens transaksjonsregel kontrollerer at hver ny rad er en forbedring; unikhetsregelen alene håndhever ikke dette. Gjeldende rekord beregnes som beste verdi etter spillets retning, ikke ved bare å velge sist opprettede rad.

Anbefalte indekser: unik `(player_id, game_id, value)`, `(game_id, player_id, value)` for topplister og `(player_id, game_id, created_at, id)` for historikk. Indeksplanen må verifiseres mot målte spørringer; unødvendige ekstra indekser skal ikke legges til uten begrunnelse.

## `attempts` – privat forsøkshistorikk

| Felt | Type | Begrensning / formål |
| --- | --- | --- |
| `player_id` | `uuid` | Del av primærnøkkel; FK til `players.id`, `ON DELETE CASCADE`. Hentes fra sesjonen. |
| `id` | `uuid` | Del av primærnøkkel; frontendens stabile `attempt_id`. |
| `game_id` | `uuid` | FK til `games.id`, `ON DELETE RESTRICT`. |
| `status` | `varchar(16)` | `completed` eller `incomplete`. |
| `value` | `bigint`, nullable | Sluttverdi ved fullføring, eventuell delverdi ved avbrudd. |
| `created_at` | `timestamptz` | Serverens registreringstid etter låsing/validering. Endres ikke ved omforsøk. |
| `record_outcome` | `varchar(16)` | `created`, `already_recorded`, `not_improved` eller `not_eligible` ved første lagring. |
| `record_id` | `uuid`, nullable | FK til `records.id`, `ON DELETE CASCADE`. Opprinnelig tilknyttet rekord, ikke nødvendigvis nåværende beste. |

Primærnøkkelen er `(player_id, id)`. Det finnes ingen unikhetsregel på spiller/spill/verdi for forsøk: ulike spillforsøk kan ha samme verdi. Radlokale sjekker håndhever ikke-negativ verdi høyst 9 007 199 254 740 991 når verdi finnes, og følgende kombinasjoner:

- `completed` krever verdi og `created`/`already_recorded` med ikke-null `record_id`, eller `not_improved` med null `record_id`.
- `incomplete` krever `not_eligible` og null `record_id`; `value` kan være null.

Backend håndhever spillets intervall bare ved fullført forsøk, eierskap og at en eventuell rekordreferanse gjelder samme spiller, spill og verdi. Ny rekord settes inn før forsøksraden i samme transaksjon. Rekordreferansen offentliggjøres aldri som en kobling tilbake til det private forsøket. `current_record` lagres ikke i forsøket; den leses på nytt ved hvert API-kall. Omforsøk kontrollerer innholdet før aktiv-status og endrer ingen lagrede felter.

Indekser: primærnøkkel `(player_id, id)`, `(player_id, created_at DESC, id DESC)` og `(player_id, game_id, created_at DESC, id DESC)` for privat sideinndeling, samt `game_id` og `record_id` for referansekontroll. Bekreft behov og ytelse ved implementering. Backend har bare SELECT/INSERT; AI har ingen tilgang til tabellen eller visning av den.

## Relasjoner og sletting

- Én spiller har null eller flere sesjoner, forsøk og rekordoppføringer.
- Ett spill har null eller flere forsøk og rekordoppføringer fra forskjellige spillere.
- Et forsøk tilhører nøyaktig én spiller og ett spill, og kan vise til én opprinnelig rekord.
- En rekord tilhører nøyaktig én spiller og ett spill.
- Kontosletting kaskaderer til alle spillerens sesjoner, forsøk og rekorder i samme transaksjon.
- Spill med forsøk eller rekorder kan ikke slettes; deaktivering bevarer historikken. Et spill uten forsøk og rekorder kan slettes av utviklernes administrasjonsoperasjon.
- Ingen personlige rekorder kopieres til en separat highscore-tabell i første versjon. Topplister og gjeldende rekorder utledes fra historikken.

## Verifisering

Se kontraktens DB-001–DB-003 og [verifikasjonsplanen](../contracts/backend-database/verification-plan.md). Modelluttrekket skal kontrollere faktiske datatyper, nullbarhet, primær-/fremmednøkler, slettingsregler, generert navnenøkkel, unikhetsregler og sjekkbegrensninger. Forretningsregler som krever flere rader, skal testes gjennom backendens transaksjoner. Fremtidige genererte migreringer skal ikke brukes som sin egen fasit.
