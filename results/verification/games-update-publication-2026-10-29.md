# Tetris og Viking Dash rev. 3 – publisering 2026-10-29

Frontend fra commit `852e43db544004812d36fc6b7871c08bec53f6b2` er publisert på
https://parrot.tail106c62.ts.net. Arbeidsmappen var ren da pakken ble bygget og
publisert. Denne rapporten og oppdatert veiledning er skrevet etter kontrollen.

- Ny webpakke: `/var/www/mikrobit-games/releases/20261029T203201259102Z`.
- Forrige pakke beholdt: `/var/www/mikrobit-games/releases/20261029T140034785852Z`.
- 43 offentlige byggfiler; alle filhasher og manifest samsvarer med lokalt bygg.
- Seks spillfamilier og elleve registrerte, aktive spillvarianter. To tidligere
  demospill er beholdt, slik at API-katalogen har tretten oppføringer.
- Tetris-ID: `6a990001-165b-4e1d-8a20-000000000011`, enhet `tetris_score_v1`,
  høyere er bedre, verdier 0–9007199254740991.

Brukeren kjørte det forberedte publiseringsskriptet med sudo. Skriptet kontrollerer
commit, ren arbeidsmappe, byggfiler og eksisterende katalog før endring. Det tar
databasebackup før registrering med eksisterende administrasjonsverktøy, og
publiserer med `backend/ops/runtime/publish-web.py`. Eksisterende spillregler,
kontoer og rekorder endres ikke av disse operasjonene. Ingen backendoppdatering
eller omstart av datatjenestene inngikk.

## Kontroller etter publisering

Kontrollert via offentlig HTTPS og Chromium 2026-10-29 kl. 20:33 UTC:

| Kontroll | Resultat |
| --- | --- |
| `/api/v1/health` | PASS: `status: ok` |
| Katalog mot frontendregister | PASS: alle elleve ID-er, regler og aktivstatus samsvarer |
| Offentlig byggmanifest mot lokalt bygg | PASS |
| Spillvelger, inkludert Micro Tetris | PASS: seks spillfamilier |
| Offentlig topplisteoversikt | PASS: elleve lenker uten innlogging |
| Tetris-toppliste | PASS: siden åpner og API svarer HTTP 200 med riktig enhet |
| Spillstart uten konto | PASS: Tetris-ruten krever innlogging |
| JavaScript-feil i besøkte sider | Ingen observert |

[Maskinlesbare observasjoner og SHA-256-manifest](games-update-publication-2026-10-29.json).
Kontrollene var skrivebeskyttede og opprettet ingen kontoer eller spillresultater.

## Begrensninger og tidligere kontroller

Før synkronisering besto 97 enhetstester og 26 av 27 nettlesertester for
`2d313be` i en separat kopi. Én lokal Tetris-starttest ble stående på «KLAR»
etter Start i stedet for «SPILLER» innen sju sekunder. Årsaken er uavklart;
andre Tetris-tester, inkludert innsending av rangert resultat mot simulert API,
besto. Dette avviket ble ikke rettet eller omdefinert som del av publiseringen.

Etter innfletting av de lokale topplisterettelsene besto bygget og tre målrettede
nettlesertester: topplisteoversikt, lenke for valgt Snake-variant og sperring av
konto/database/AI i lokalmodus. Bygg og tester ble kjørt med vertens Node 20.19.2,
som avviker fra prosjektets anbefalte Node 24.22.1.

Ingen ny full backendtest, benchmark eller FoM-måling er kjørt. Fysisk Tetris-spill,
USB, musikk og lagring fra en skole-PC er ikke kontrollert i denne publiseringen.
Viking Dash rev. 3 bruker fortsatt samme spill-ID og toppliste som før; rekorder
fra ulike vanskelighetsgrader blandes derfor. Ingen rekorder er nullstilt.

Spillere bør avslutte pågående runde før de oppdaterer nettsiden. Prøv deretter
Micro Tetris med innlogging og fysisk micro:bit, og se etter lagringsbekreftelse
etter en fullført rangert runde.
