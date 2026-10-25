# Datamodell – backend, WBS 1.4

**Status:** Ferdigstilt som del av dokumentasjonsleveransen for WBS 1.4, godkjent av prosjekteier 2026-10-23. Modellen utdyper [kontrakten versjon 1.1](../contracts/backend-database/contract.md), inkludert sesjonsreglene som brukes i første implementasjon. Modellen er teknisk design, ikke en implementert migrering. ER-diagram og maskinlesbar modellfasit skal gjengi denne modellen.

## Felles regler

Se [ER-diagrammet](database-er.drawio) for en visuell oversikt over tabeller og relasjoner. Feltregler og begrensninger er spesifisert nedenfor.

Tabellene ligger i skjema `app`. Alle felt nedenfor er obligatoriske (`NOT NULL`). ID-er bruker `uuid`, genereres av backend og er primærnøkler. Tidspunkter bruker `timestamptz`, settes av serveren og utveksles som UTC. `created_at` på rekorder settes etter låsing og validering, slik at det beskriver registreringen.

Ingen felt for e-post eller alle spillforsøk inngår i første versjon. Ingen tabell lagrer råpassord eller rå sesjonstoken. Datamodellen er autoritativ for felter og begrensninger; kontrakten er autoritativ for operasjonsflyt og tilgangsregler.

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

Resultatgrensen holder heltall innenfor eksakt representasjon i vanlige JavaScript-tall. Spillutvikleren velger enhet og konkrete grenser ved opprettelse. Desimaltid skaleres til heltall i millisekunder. Navn og aktiv-status kan endres. Enhet, retning og intervall kan ikke endres etter første rekord; administrasjonsoperasjonen låser spillraden og kontrollerer historikk før endring. Dette er en operasjonsregel, ikke en radlokal `CHECK` på `games`.

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

## Relasjoner og sletting

- Én spiller har null eller flere sesjoner og rekordoppføringer.
- Ett spill har null eller flere rekordoppføringer fra forskjellige spillere.
- En rekord tilhører nøyaktig én spiller og ett spill.
- Kontosletting kaskaderer til alle spillerens sesjoner og rekorder i samme transaksjon.
- Spill med rekorder kan ikke slettes; deaktivering bevarer historikken. Et spill uten rekorder kan slettes av utviklernes administrasjonsoperasjon.
- Ingen personlige rekorder kopieres til en separat highscore-tabell i første versjon. Topplister og gjeldende rekorder utledes fra historikken.

## Verifisering

Se kontraktens DB-001–DB-003 og [verifikasjonsplanen](../contracts/backend-database/verification-plan.md). Modelluttrekket skal kontrollere faktiske datatyper, nullbarhet, primær-/fremmednøkler, slettingsregler, generert navnenøkkel, unikhetsregler og sjekkbegrensninger. Forretningsregler som krever flere rader, skal testes gjennom backendens transaksjoner. Fremtidige genererte migreringer skal ikke brukes som sin egen fasit.
