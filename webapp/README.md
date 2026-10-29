# bit:arcade – Webapp

Statisk spillplattform for micro:bit V2, med felles spillramme, spillvelger, Testlab,
innlogging/registrering, privat Dashboard, Profil, offentlige topplister og AI-chat.
JavaScript ES-moduler og Canvas; ingen eksterne ressurser eller runtimepakker.

## Kjør lokalt og bygg

Node **24.22.1**, npm **11.19.1** og låst Playwright **1.64.1**:

```sh
npm ci
npm run dev
```

Åpne `http://127.0.0.1:4174/`. Lokal forhåndsvisning gir 503 på API-kall;
Testlab bruker faktisk Web Serial og er tilgjengelig uten backend eller konto.
Ordinære spill krever innlogging, aktive katalogoppføringer, klar micro:bit og
vellykket sesjonsfornyelse, også i øving. Ingen falsk produktinnlogging eller
simulerte sensorer er inkludert.

```sh
npm run build
npm run preview
```

`dist/` er hele den offentlige leveransen: HTML, CSS, alle spill, Testlab og det
felles Micro:bit-biblioteket. Bygget rydder bare generert `dist/` og skriver en
SHA-256-filoversikt. `npm run preview` serverer dette bygget på port 4174.
Hashruter (`/#/testlab`, `/#/play/snake`, `/#/dashboard`) fungerer ved direkte
åpning og oppdatering uten SPA-omskriving av API-ruter.

## Spill og registrering i backend

Fem spillfamilier følger med: **Micro Snake**, **Viking Dash**, **Stjernefangst**,
**Reaksjonsjakt** og **Balanseløypa**. Snake har seks separate kombinasjoner av
Standard/Hurtig/Labyrint og Competitive/Random. Felles ramme eier startkrav,
Micro:bit-økt, pause/nedtelling, avslutning og resultatlagring; spillmodulene eier
regler og tegning. Alle bruker adapteren i `src/microbit-input/`.

[Spillregisteret](src/games/registry.js) inneholder ti stabile UUID-er og eksakte
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
kontrolleres databasen før omforsøk. Registrering og publisering er ikke utført.

Snake viser kodet `snake_rank_v1` som «mat · steg» i spillet, Dashboard og
rekordlistene. Viking bruker meter. Stjernefangst varer 60 sekunder, gir 100 poeng
per stjerne og trekker 50 ved treff av en hindring. Reaksjonsjakt bruker snittet av
fem signaler med tillegg for tidlige/feil trykk. Balanseløypa bruker tid gjennom
seks kontrollpunkter, maksimalt ti minutter; tidsavbrudd er ufullført.

Øving sender ingen resultater. Selvvalgte seeds er lokale innstillinger som
aldri sendes til resultat-API-et. Snake/Viking følger sine spillspesifikasjoners
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

`test:app` bygger automatisk og tester bare `dist/` med kontrollerte API-svar og
Web Serial. `test:browser` beholder adapterens eksisterende nettlesertester.
`npm run benchmark` og `npm run benchmark:input` er de eksisterende Node-målingene.
Se [verifikasjonsrapport](results/webapp-validation.md) for faktisk dekning og
begrensninger. Mocktester beviser ikke fysisk USB/tillatelsesdialog, backendens
eierskapskontroll, spillbalanse eller fysisk latens.

Adapterens separate eksempel: `npm run dev:input`, deretter
`http://127.0.0.1:4173/examples/microbit-input/`.
Se [adapterveiledningen](src/microbit-input/README.md),
[komponentspesifikasjonen](spec/Komponentspesifikasjon_webapplikasjon_forklart.md)
og [Testlab-spesifikasjonen](spec/games/microbit-testlab/specification.md).
