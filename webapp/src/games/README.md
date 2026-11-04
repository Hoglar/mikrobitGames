# Spillmapper

Alle spill oppdages fra undermapper med `game.json`. Et spill har `index.js`, `cover.png` eller `cover.webp`, README og egne ressurser. `index.js` eksporterer `defineGame(...)` fra `@microbit-games/sdk`. Plattformen kompilerer pakken og gir den en isolert spillramme med input/output, pause/fullskjerm og rekorder.

```text
my-game/
├── game.json
├── cover.png
├── index.js
├── README.md
├── assets/       # valgfritt
└── lib/          # valgfritt
```

[Spillguiden](../../spec/game-cartridges/developer-guide.md) viser oppretting, validering og deling. [SDK-referansen](../../spec/game-cartridges/sdk-api.md) beskriver den offentlige importflaten. Kjør `npm run game:new -- my-game` fra `webapp/`. Nytt spill skal ikke kreve endringer i register, router, globale stiler eller backendkode.

De syv medfølgende spillene beholder tidligere spillregler i `engine.js`, med en liten SDK-inngang i `index.js`. Felles eldre hjelpefunksjoner er kopiert inn i de spillmappene som trenger dem, slik at pakken ikke importerer andre spillmapper. `registry.js` er en generell kompatibilitetsfasade over den genererte katalogen, ikke en manuelt vedlikeholdt liste. `shared/` er eldre hjelpefiler og er ikke del av den nye portable importkontrakten.

Hver modus og regelutgave har egen toppliste. `game.json` bevarer de 47 eksisterende backend-ID-ene gjennom legacyfelter; nye spill får deterministiske ID-er automatisk. Lokalspill tilbyr frivillig navn og IndexedDB-rekorder. Hosted online-katalog synkroniseres ved vanlig publisering etter nødvendig backendmigrering.

Ingen ZIP lastes opp gjennom nettstedet. Mottakeren pakker ut en delt spillmappe i sin egen `src/games/` og oppdaterer katalogen. Se [valideringen](../../results/cartridges-validation.md) for gjennomførte kontroller og gjenstående fysisk/driftsmessig akseptanse.
