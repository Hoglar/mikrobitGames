# Spillkassetter og SDK v1 – lokal validering

**Dato:** 2026-11-04. **Grunnlag:** arbeidstreet over commit `7621c61`, med de nye, ukommitterte SDK-endringene. Ingen produksjonsdatabase, publisert webpakke eller firmware er endret av denne kjøringen.

## Levert

- Alle syv medfølgende spill har selvstendige mapper med `game.json`, 512 × 512 PNG-omslag, SDK-inngang og egne interne motor-/ressursfiler. Samtlige 47 eksisterende spill-ID-er, navn, regelkonfigurasjoner, scoregrenser og retninger er bevart mot en frosset referanse.
- Felles oppdaging, JSON Schema/semantisk validering, Acorn-kontroll av modulprofil, avgrenset esbuild-kompilering og generert katalog. Launcher og spillvert har ingen import-/oppsettsgrener per spill. Ny mappe oppdages ved katalogrefresh; publisering bruker generert katalog.
- SDK og opaque iframe-runtime med MessagePort, avgrenset input/output, livsløp, deklarative moduser/score, lokale assets, editor-typer og generiske lyd-/pausekontroller. Den eksisterende Micro:bit-adapteren eier fortsatt port og protokoll.
- IndexedDB-rekorder med frivillig navn, streng beste-score-oppdatering, normalisering, atomiske transaksjoner, delte plasseringer, fanesynkronisering og separat eksport/import/sletting. Lokale spill gjør ingen konto-/resultat-/AI-kall.
- Kopierbar mal og kjørbare `game:new`, `game:check` og `game:pack`. ZIP deles ved manuell utpakking i mottakerens spillmappe; ingen pakkeimport i nettleseren.
- Backend-migrering 002, betrodd katalogsynkronisering i publiseringsflyten, valgfri API-metadata, dekoding/validering av SDK-scorer og generell AI-presentasjon. Resultatbody og historikkmodell beholdes.

## Kjørte programvarekontroller

Miljø: Windows, Node 24.22.1, npm 11.19.1, Playwright 1.64.1 med installert Chromium; Python 3.14.7 for rene backendkontroller. Ordinært backendmiljø er fortsatt prosjektets Python/PostgreSQL-miljø på driftsmaskinen.

| Kontroll | Resultat |
| --- | --- |
| Native enhets-/inputtester, `tests/unit/*.test.js` og `tests/microbit-input/*.test.js` | **133 bestått.** Inkluderer 47 uendrede katalogkontrakter, leksikografisk score vs heltallskoding, kodingshull, navn, parser/importgrense og eksisterende spillmodeller/protokoll. |
| Statisk app, `playwright.app.config.js` | **46 bestått i samlet kjøring.** Konto/AI/Testlab, menyinput, sesjonstap, lokale spill, alle spill i sandbox, lyd/hold, fullskjerm, rendering og en faktisk fullført racerrunde gjennom adapteren. |
| Mappe-/SDK-suite, `playwright.cartridges.config.js` | **11 bestått i samlet kjøring**, deretter **2 nye kontroller bestått** separat: CSP-/meldingsgrense og lokalspill med fastlåst backend. Ny spillmappe dukker opp uten sentrale endringer; fysisk input/output gjennom mocktransport, navn/lagring, omstart, samtidige faner, eksport/import, fullskjerm og online-ID testes. |
| Felles frontend/backend-scoregrenser | **Bestått:** én integrasjonstest med 47 × 24 = 1128 status-/verdikombinasjoner mot den faktiske Python-validatoren. Ingen fysisk firmwarekjøring inngår. |
| Python: eksisterende `test_score_rules.py` | **12 bestått.** Eksisterende resultat-/rekord-/rangeringsregler. |
| Python: `test_cartridges.py` | **4 bestått.** SDK-koding, alle faktisk genererte katalogdefinisjoner mot backendvalidator, maksimum og ugyldig katalog. |
| Python: `test_racing_scores.py` | **6 bestått.** Både legacy- og metadataformatert poeng/plass/tid; rå pakket differanse fremstilles ikke som varighet. |
| Kjørbare ny/check/pack-kommandoer og ZIP-transport | **Bestått.** Opprettet nytt spill fra malen, validerte, pakket og pakket ut i en separat spillmappe. Hele enhets-/inputsuiten bestod ogs? med det nye spillet installert (8 spill / 48 topplister), inkludert endret rekkef?lge i kassetthjulet. Den nye kopien kompilerte med identisk toppliste-ID og innholdshash. ZIP CRC-/filkontroll bestod. Testmappene er ryddet. |
| Offentlig bygg | **Bestått.** 7 kassetter / 47 topplister. Spillfiler kopieres fra det validerte publiserbare filsettet; tester, SDK-kopi per spill og lokale rekorder inngår ikke i spill-ZIP. |
| Avhengigheter | Låste esbuild/Ajv/Acorn; installasjonens npm-audit rapporterte ingen kjente sårbarheter etter kompatibel Ajv-oppdatering. Bare den pinnede esbuild-installasjonsskriptversjonen er tillatt i prosjektets npm-policy. |

Rå browser-rapporter og skjermbilder ligger under ignorert `webapp/build/`. De 59 browser-scenarioene er 46 appkontroller, 11 SDK-kontroller og to ekstra kontroller, ikke 58 tester av faktisk maskinvare. Tidligere feil i oppstartsaktivering, pauseoverlay og gjenbruk av siste holdte A-trykk ble rettet og de berørte scenarioene kjørt på nytt.

## Praktiske implementasjonsvalg

Gamle motorer er bevart i `engine.js` og brukes gjennom SDK-ets `adaptEngine`. Dette er en migreringshjelper; nye spill trenger bare `defineGame`, `update` og `render`. Spillene eier fortsatt sin fysikk, lyd og spesialhandlinger. Nettleserlyd er nå eid av det isolerte spilldokumentet og ryddes ved rundebytte; en AudioContext deles ikke på tvers av ødelagte sandboxdokumenter.

Backendverktøyet verifiserer både de deklarative reglene og JS-byggerens kanoniske regeltekst/fingeravtrykk, slik at Python-/JavaScript-serialisering av flyttall ikke gir forskjellige identiteter. Regler kan ikke overskrives under en brukt SDK-identitet. Synkronisering sletter/deaktiverer aldri manglende spill automatisk.

## Ikke gjennomført / gjenstående akseptanse

- **Faktisk PostgreSQL-/API-migrering og publisering:** Ikke kjørt. SQL-transaksjoner, rolle-/visningsrettigheter, `runuser` og publiseringsrollback må verifiseres i det konfigurerte backend-testmiljøet før utrulling. Rene Pythonkontroller og mockede HTTP-svar er ikke evidens for en utført databaseendring.
- **Fysisk Micro:bit V2/USB, tillatelsesdialog, ny bro-latens og fem minutters reell spilling:** Ikke målt. Firmware og serialbibliotek er uendret; programvaretestene bruker produksjonsadapter med mocktransport.
- **Lagringskvote-/diskfeil og fullstendig ondsinnet arkiv-/datasettkorpus:** Feilhåndtering er implementert, men alle CART-scenarienes randtilfeller er ikke fysisk fremprovosert. Ingen komplett CART-01–22-produktgodkjenning eller ny FoM-måling påstås.
- **Andre nettlesere / Web Serial på mobil:** Ingen generell kompatibilitetsgaranti. Sandbox/CSP beskytter vertstilgang; det er ikke et anti-cheat-bevis eller en garanti mot ubegrenset CPU-bruk i ondsinnet spillkode.

Før online-utrulling: oppdater backendkode, kjør migrering 002 i vanlig driftsflyt, verifiser i testmiljø og publiser deretter den genererte webpakken. Lokalspill og lokale rekorder krever ingen av disse serveroperasjonene.
