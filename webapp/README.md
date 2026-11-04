# bit:arcade – Webapp

Statisk spillplattform for micro:bit V2, med felles spillramme, spillvelger, Testlab,
innlogging/registrering, privat Dashboard, Profil, offentlige topplister og AI-chat.
JavaScript ES-moduler og Canvas; ingen eksterne ressurser eller runtimepakker.

Appen er samlet på én side som en retro spillmaskin: spillhyllen øverst kan blas
med musehjul, styreflate, berøring, piltaster eller knappene ved hyllen. Velg en
kassett for å laste den animert inn i spillrammen. Ved redusert bevegelse lastes
spillet direkte. Topplisten står til høyre på desktop og under spillet på mindre
skjermer; den følger valgt spillvariant, også når Snake-modusen endres med
micro:bit. AI-chatten ligger nederst og beholder utkast og samtale ved spillbytte.
Konto, Dashboard og rekordhistorikk åpnes i et panel på samme side. Testlab bruker
spillrammen og avslutter en eventuell aktiv spilløkt på vanlig måte. Åpne Testlab
fra hovedmenyen. Knappen «Fullskjerm» i spillverktøylinjen fyller skjermen med
spillet og kontrollene; bruk «Avslutt fullskjerm» eller Escape for å gå tilbake.

**Publisert 2026-11-04:** https://parrot.tail106c62.ts.net, frontend/backend fra `2c209f2`, migrering 002 og 47 synkroniserte spillvarianter. Se [spill fra skolen](../docs/play-at-school.md) og [publiseringskontrollen med kjent Viking-testavvik](../results/verification/sdk-publication-2026-11-04.md). Fysisk spillrunde med micro:bit fra skolen gjenstår å dokumentere.

## Kjør lokalt og bygg

Node **24.22.1**, npm **11.19.1** og låste utviklingsavhengigheter (Playwright **1.64.1**, esbuild og Ajv):

Nettsidens «Last ned firmware (HEX)» ligger ved tilkoblingsknappen. Ferdigbygd V2-firmware følger med under [`src/microbit-input/firmware/`](src/microbit-input/firmware/README.md); verken lokal spilling eller hosting krever egen firmwarebygging. Webbygget kontrollerer SHA-256 og publiserer HEX-filen uten logger, ELF eller byggmetadata. Utviklingsserveren tilbyr samme nedlasting. Bare vedlikeholdere som endrer firmwaren trenger [firmwareverktøyet](../microbit/README.md#build-and-test), etterfulgt av `npm run firmware:update`. Nettsiden viser ingen instruksjoner for installasjon på enheten.

```sh
npm ci
npm run dev
```

Åpne `http://127.0.0.1:4174/`. `dev` og `preview` tilbyr **lokale rekorder** og øving uten konto eller backend. Koble til en fysisk micro:bit V2 og velg Start. Etter en fullført lokal runde kan spilleren skrive navn og velge «Lagre lokalt», eller hoppe over. Bare bedre score erstatter samme navns gamle rekord; store/små bokstaver og mellomrom i endene påvirker ikke identiteten. Navn er lokale aliaser, ikke kontoer.

Lokale rekorder ligger i IndexedDB for denne nettleserprofilen og nettadressen/porten. «Lokale rekorder» i menyen tilbyr eksport, import og sletting. Rekorddata følger ikke med spillpakker og lastes ikke automatisk opp. «Øving · uten lagring» er fortsatt tilgjengelig som eget valg.

Innlogging, online-resultater, Dashboard, Profil og AI er deaktivert i lokalmodus. Appen sender ingen API-kall; lokalserveren avviser `/api/` med 403. Den tilkoblede appen tilbyr online-rekorder for innlogget spiller samt lokale rekorder/øving. Sandboxen eier spillkode, Canvas og nettleserlyd; siden eier én fysisk Micro:bit-forbindelse og lagringen.

## Legg til eller lag et spill

Hvert spill har sin egen mappe under `src/games/` med `game.json`, `cover.png` (eller WebP), `index.js`, README og lokale ressurser. Ingen sentral spillregistrering eller CSS-import er nødvendig. Oppdater spilloversikten etter filkopiering; statisk hosting krever vanlig build/publisering.

```sh
npm run game:new -- my-game
npm run game:check -- src/games/my-game
npm run game:pack -- src/games/my-game
```

[Spillguiden](spec/game-cartridges/developer-guide.md) viser et komplett eksempel. [SDK-referansen](spec/game-cartridges/sdk-api.md) og editor-typene i `src/game-sdk/index.d.ts` beskriver input/output, resultater og rekorder. Del ZIP-en fra `build/game-packages/`; mottakeren pakker ut spillmappen i sin lokale `src/games/`. Nettstedet har ingen spillopplastings- eller ZIP-importfunksjon.

```sh
npm run build
npm run preview
```

`dist/` er hele den offentlige leveransen: HTML, CSS, alle spill, Testlab og det
felles Micro:bit-biblioteket. Bygget rydder bare generert `dist/` og skriver en
SHA-256-filoversikt og automatisk spill-/topplistekatalog. `publish-web.py` synkroniserer katalogen med backend før aktivering; migrering 002 må være innført i driftsmiljøet. Se [katalogdesignet](spec/game-cartridges/online-leaderboards.md). `npm run preview` serverer dette bygget på port 4174.
Hashruter (`/#/testlab`, `/#/play/snake`, `/#/dashboard`) fungerer ved direkte
åpning og oppdatering uten SPA-omskriving av API-ruter.

Local-play-markøren settes bare i HTML-responsen fra utviklingsserveren på
loopback-adressen, ikke i filene i `dist/`. Et publisert bygg beholder derfor
kravene om innlogging, aktiv backendkatalog, klar micro:bit og sesjonsfornyelse,
også i øving. Lokalmodus endrer ikke backendens tilgangskontroll.

## Spill og registrering i backend

Sju spillfamilier følger med i arbeidskopien: **Micro Snake**, **Viking Dash**, **Stjernefangst**,
**Reaksjonsjakt**, **Balanseløypa**, **Micro Tetris** og **Micro Racer**. Snake har seks separate kombinasjoner av
Standard/Hurtig/Labyrint og Competitive/Random. Felles ramme eier startkrav,
Micro:bit-økt, pause/nedtelling, avslutning og resultatlagring; spillmodulene eier
regler og tegning. Alle bruker adapteren i `src/microbit-input/`.

[Spillregisteret](src/games/registry.js) inneholder 47 stabile UUID-er og eksakte
resultatregler. Navn er aldri koblingsnøkkel. Ukjente ID-er, inaktive spill eller
avvikende poengregler kan ikke startes. Dagens backend-demospill blir ikke koblet
til andre regler. Disse nye oppføringene må registreres av driftsansvarlig:

```sh
npm run catalog:commands
```

Dette **skriver bare kommandoene** for eksisterende
`backend/database/manage-game.py`; det kontakter ikke serveren eller databasen.
Kommandoene kjøres fra repo-roten på backendverten med vedlikeholdsrollens
`MBG_ADMIN_DSN`. Kontroller eksisterende spill før kjøring; ved ukjent utfall
kontrolleres databasen før omforsøk. Alle 47 varianter i `177131d`, inkludert
Tetris og 36 Micro Racer-varianter, er registrert og publisert. Ikke kjør de
samme `create`-kommandoene på nytt. Lokal øving bruker det innebygde registeret.

Snake viser kodet `snake_rank_v1` som «mat · steg» i spillet, Dashboard og
rekordlistene. Viking bruker meter. Stjernefangst varer 60 sekunder, gir 100 poeng
per stjerne og trekker 50 ved treff av en hindring. Reaksjonsjakt bruker snittet av
fem signaler med tillegg for tidlige/feil trykk. Balanseløypa bruker tid gjennom
seks kontrollpunkter, maksimalt ti minutter; tidsavbrudd er ufullført.

Micro Tetris har SRS-rotasjon, hold, T-spins, combo/B2B/perfect clear og økende
poengstyrt fart. Vipp flytter, B roterer, A hard-dropper og logo bytter hold.
Micro:bit viser hold og spiller nivåstyrt musikk; nettleseren spiller separate
handlingseffekter. Begge lydkanalene har egne valg og volum. Pause/Escape stanser
lyden. Se [reglene](spec/games/tetris/game-design.md) og [testresultatene](results/tetris-validation.md).

Micro Racer har tre baner, tre bilklasser, tidskjøring og løp mot tre lokale
AI-biler, med én eller tre runder. Tilt styrer relativt; kameraet følger/roterer
med bilen, B gir gass og A bremser. De 36 variantene har egne topplister. De er
klare i lokal øving, men må registreres før de kan startes rangert i tilkoblet
modus. `node verification/catalog-commands.mjs --family=racing` skriver bare
de nye kommandoene. Se [kjøreveiledningen](src/games/micro-racer/README.md) og
[valideringen](results/racing-validation.md).

Øving sender ingen resultater. Selvvalgte seeds er lokale innstillinger som
aldri sendes til resultat-API-et. Snake/Viking/Tetris følger sine spillspesifikasjoners
unntak med direkte restart og lokal øving. Se [implementasjonsnotatet](spec/webapp-implementation.md)
for valg, ansvar og gjenstående akseptanse.

## Backend og publisering

Bruk [API 0.3.0](../spec/contracts/webapp-backend/contract.md),
[OpenAPI](../spec/contracts/webapp-backend/openapi.yaml) og
[backendens quickstart](../spec/contracts/webapp-backend/quickstart.md).
Alle kall bruker relativ `/api/v1`, cookie, JSON og avtalt CSRF-header.
AI følger 0.3.0 med serverstyrt samtaleminne og «Ny samtale».

Backend-/driftsgruppen publiserer hele `dist/` via eksisterende
[publiseringsskript](../backend/ops/runtime/README.md#4-publiser-frontendpakken)
på samme HTTPS-adresse som API-et. Ingen utviklingsserver trengs i drift.
Ikke bruk lokal proxy som omskriver Origin eller fjerner cookieflagg.

Resultater beholder opprinnelig eier og forsøks-ID gjennom omforsøk. Ubekreftede
forsøk er bare i minnet og kan gå tapt ved lukking/oppdatering. Passord og tokens
lagres ikke i localStorage. Kontosletting krever bekreftelse og gjeldende passord.

## Verifikasjon

```sh
npm test
npx playwright install chromium
npm run test:app
npm run test:browser
```

`test:app` bygger automatisk og tester bare `dist/`. De vanlige testene bruker
kontrollerte API-svar og Web Serial; lokale spilltester bruker ekte lokalmodus
uten mock-backend og kontrollerer at ingen API-kall sendes. Testserverne bruker
4175/4176 slik at utviklingsserveren på 4174 kan fortsette å kjøre.
`test:browser` beholder adapterens eksisterende nettlesertester.
`npm run benchmark` og `npm run benchmark:input` er de eksisterende Node-målingene.
Se [verifikasjonsrapport](results/webapp-validation.md) for faktisk dekning og
begrensninger. Mocktester beviser ikke fysisk USB/tillatelsesdialog, backendens
eierskapskontroll, spillbalanse eller fysisk latens.

Se også [lokalspill-valideringen](results/local-play-validation.md) for den nye
øvingstilgangen og sperrene mot database/AI.

Adapterens separate eksempel: `npm run dev:input`, deretter
`http://127.0.0.1:4173/examples/microbit-input/`.
Se [adapterveiledningen](src/microbit-input/README.md),
[komponentspesifikasjonen](spec/Komponentspesifikasjon_webapplikasjon_forklart.md)
og [Testlab-spesifikasjonen](spec/games/microbit-testlab/specification.md).
