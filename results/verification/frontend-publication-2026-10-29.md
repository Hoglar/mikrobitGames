# Publisering av frontend og spillkatalog, 2026-10-29

**Publisert:** https://parrot.tail106c62.ts.net. Brukeren bekrefter at gruppen kommer inn fra skolen. Frontendcommit er `fdfdbca1ffbd2c5c7abb6703400e706308f7123a`, kontrollert mot GitHubs `main`. Frontend er installert under `/var/www/mikrobit-games/releases/20261029T131308514015Z`; forrige webutslipp er beholdt. Backendens kode/tjenester er uendret.

## Gjennomføring

`npm run build` fra `webapp/` laget 35 offentlige filer og SHA-256-manifest. Kopieringsbygget bruker bare Nodes standardbibliotek og ble kjørt med eksisterende Node 20.19.2 / npm 9.2.0 på Parrot. Frontendens anbefalte utviklings-/testmiljø er Node 24.22.1 / npm 11.19.1; ingen ny kjøring av den fullstendige testpakken i dette miljøet hevdes her.

Ti manglende spilloppføringer ble hentet fra `webapp/src/games/registry.js`. Brukeren kjørte et gjennomgått engangsskript med eksisterende `manage-game.py`, som Linux-bruker `mbg-db` via privat PostgreSQL-socket, etterfulgt av `publish-web.py webapp/dist`. Ingen passord var nødvendige i kommandoene. Eksisterende kontoer, rekorder og begge demospillene er beholdt. Engangsskriptet ligger lokalt i ignorert `webapp/build/`; [driftsveiledningen](../../backend/ops/runtime/README.md#4-publiser-frontendpakken) beskriver senere publisering.

## Kontroller

| Kontroll | Resultat |
| --- | --- |
| Bygg, filoversikt og JavaScript-syntaks | PASS: 35 offentlige filer; syntakskontroll av 32 JavaScript-moduler. |
| Offentlig HTTPS og statiske ressurser | PASS: manifest og SHA-256 for alle 35 publiserte filer samsvarer med bygget. JavaScript/CSS har riktige MIME-typer. |
| Spillregister mot faktisk API-katalog | PASS: alle ti forventede UUID-er er aktive med eksakte navn, enheter, retninger og grenser. Tolv oppføringer totalt, inkludert eldre demoer. |
| Registrering, innlogging, sesjon og fornyelse gjennom frontendens API-klient | PASS mot virkelig HTTPS/API. |
| Frontendens lagringskø og svarvalidering | PASS: syntetiske fullførte forsøk for Snake, Viking og Reaksjonsjakt ble godkjent av frontendens faktiske kode. Dette dekker kodet Snake-verdi, meter og lavest-tid-rangering. |
| Omforsøk, toppliste og privat historikk | PASS: identiske omforsøk ga 200, verdiene var synlige, og historikken inneholdt nøyaktig tre forsøk. |
| Utlogging og opprydding | PASS: sesjon avvist etter utlogging; kontrollkonto og tilhørende forsøk/rekorder slettet etterpå. |
| Tilgang fra skolen | Bekreftet av brukeren: «de kommer inn». Dette alene bekrefter ikke fysisk spillstyring eller fullført spillrunde. |

[Gjennomgåtte råobservasjoner](frontend-publication-2026-10-29.json) og [byggets filhasher](frontend-publication-2026-10-29-manifest.json) er lagret uten passord, cookies eller ekte brukerdata.

API-kontrollen importerte frontendens bygde `api.js`, `submissions.js`, `rules.js` og `registry.js` i Node og brukte faktiske HTTPS-kall med cookie i minnet. Dette var ingen mock av backend, men heller ingen automatisert nettleser-/USB-prøve. Ingen ny FoM, benchmark, full backendtest eller rettingsrunde ble startet. Ingen spillregler, krav eller testforventninger ble endret.

## Gjenstår ved skoleprøven

Fysisk micro:bit V2 med riktig firmware, nettleserens USB-tillatelse, sensor-/knappereaksjon og en fullført spillrunde med bekreftet lagring må prøves på skole-PC-en. Følg [den korte skoleveiledningen](../../docs/play-at-school.md). AI er fortsatt samme løsning som før publisering; ingen ny AI-faktakontroll eller tolkning av Snake-kodingen er utført her. Automatisk oppstart etter fysisk maskinreboot er heller ikke prøvd i denne runden.
