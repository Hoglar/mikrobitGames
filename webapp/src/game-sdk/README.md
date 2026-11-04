# Micro:bit Games SDK v1

Den eneste plattformimporten et spill trenger:

```js
import { defineGame } from '@microbit-games/sdk';
```

Spill kjøres i en sandbox med egne Canvas/DOM-ressurser. Context gir input fra den eksisterende Micro:bit-adapteren, avgrenset device-output, valgte moduser, rekorder og resultatavslutning. Konto, serialport og lagring eies av verten. Typebeskrivelser for editoren ligger i `index.d.ts`.

Start med [spillguiden](../../spec/game-cartridges/developer-guide.md), eller les [API-referansen](../../spec/game-cartridges/sdk-api.md). Fra `webapp/`: `npm run game:new -- my-game`, `npm run game:check -- src/games/my-game`, og `npm run dev`. Del mappen med `npm run game:pack -- src/games/my-game`; mottakeren pakker ut i sin egen spillmappe. Ingen spillimport foregår gjennom nettstedet.

`adaptEngine` er et kompatibilitetshjelpemiddel for de medfølgende, tidligere motorene. Nye spill kan implementere `update`/`render` direkte. Ingen spill får en kopi av SDK-runtime eller lager egen Web Serial-forbindelse.
