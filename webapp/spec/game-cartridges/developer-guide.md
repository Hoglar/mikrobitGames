# Lag og del ditt eget spill

**SDK v1 er implementert lokalt.** Kommandoene nedenfor kjøres fra `webapp/` med Node 24.22.1 og npm 11.19.1 etter `npm ci`. [Valideringsrapporten](../../results/cartridges-validation.md) beskriver testdekning og det som gjenstår av fysisk akseptanse og utrulling.

Du lager én mappe med spillinformasjon, omslag og JavaScript. Plattformen ordner spillvelger, Micro:bit-forbindelse, pause, fullskjerm og topplister. Du trenger ikke skrive kode for innlogging, HTTP eller databasen.

## 1. Opprett mappen

Opprett et spill fra malen:

```sh
npm run game:new -- tilt-target
```

Dette kopierer malen til `src/games/tilt-target/`, lage en ny spill-UUID og inkludere et gyldig standardomslag. Alternativt kopierer du malen selv. Bytt UUID når du lager et **nytt** spill; behold den når du deler eller oppdaterer samme spill.

```text
tilt-target/
├── game.json
├── cover.png
├── index.js
└── README.md
```

`cover.png` er 512 × 512 piksler og vises på kassetten. WebP er også tillatt, da heter filen `cover.webp`. Skriv kort styring/spillmål og lisens i README. Bilder, lyd og egne moduler kan ligge i `assets/` og `lib/` i samme mappe.

## 2. Beskriv spillet i game.json

Kopier [eksempelmanifestet](example.game.json). Det viser navn, utvikler, omslag, minimum spillstørrelse og én modus med poeng fra 0 til 1000. `direction: "higher_is_better"` betyr at flest poeng vinner. For tid bruker du `lower_is_better` og `format: "duration-ms"`.

Legg til en modus for hver konkurranse som trenger egen rekordliste. Et racingspill kan for eksempel ha én modus for hver bane/bil/rundetype. Ikke endre betydningen av en eksisterende modus etter at folk har satt rekorder; øk `rulesVersion` når reglene endres. Vanlig pakkeversjon `version` kan endres ved kosmetiske oppdateringer uten å nullstille rekorder.

## 3. Skriv spillet i index.js

Dette lille spillet bruker tilt til å flytte en markør. B avslutter; nær midten gir høyere poeng. Eksemplet passer til manifestet og trenger ingen andre imports:

```js
import { defineGame } from '@microbit-games/sdk';

export default defineGame(({ input, scores, ui }) => {
  let tiltX = 0, tiltY = 0, x = 0, y = 0, finished = false;

  const offState = input.subscribe(state => {
    tiltX = state.inputAvailable ? state.tilt.x : 0;
    tiltY = state.inputAvailable ? state.tilt.y : 0;
  });

  const offPress = input.onPress(({ input: key }) => {
    if (key !== 'b' || finished) return;
    finished = true;
    const distance = Math.min(1, Math.hypot(x, y) / Math.SQRT2);
    const points = Math.round(1000 * (1 - distance));
    void scores.finish({
      status: 'completed',
      score: { points },
      resultText: 'Nærmere midten gir flere poeng!'
    }).catch(error => ui.setStatus(error.message));
  });

  ui.setHelp('Vipp for å sikte. Trykk B for å avslutte.');

  return {
    update() { x = tiltX; y = tiltY; },
    render(ctx, { width, height }) {
      ctx.fillStyle = '#101426';
      ctx.fillRect(0, 0, width, height);
      const radius = Math.min(width, height) * 0.4;
      ctx.strokeStyle = '#fff0a8';
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#8dffb0';
      ctx.beginPath();
      ctx.arc(width / 2 + x * radius, height / 2 + y * radius,
        10, 0, Math.PI * 2);
      ctx.fill();
    },
    dispose() { offState(); offPress(); }
  };
});
```

`input.subscribe` gir sensorverdier og holdte knapper. `input.onPress` er for engangshandlinger og inneholder også antall trykk. Bruk `count` hvis hver handling må telles, som rotasjon. `update(dt)` får simuleringstid i sekunder; `render` tegner bare. SDK-et stopper simulering og engangshendelser når spillet er pauset. Se [API-referansen](sdk-api.md) for fysisk output, lyd, assets og mer avansert livsløp.

`scores.finish` avslutter runden. Ved lokalspill viser **plattformen** deretter navnefeltet; ved online-spill sender den resultatet for riktig konto. Du skal ikke lage ditt eget navneskjema eller kalle backend direkte. En finish-kvittering betyr at runden er avsluttet; lagringsstatus kommer separat. Trenger du en rekord i spillets HUD, bruk `scores.getLeaderboard()` eller `scores.getPersonalBest()`.

## 4. Test

Fra `webapp/`:

```sh
npm run game:check -- src/games/tilt-target
npm run dev
```

Åpne utviklingsserverens adresse, oppdater spilloversikten og velg spillet. Koble til en Micro:bit V2 med prosjektets firmware. Velg lokal rekordrunde eller øving. Du trenger ikke konto eller backend lokalt. Direkte åpning av HTML fra filsystemet er ikke støttet.

Fullfør en runde, skriv et navn og lagre lokalt. Prøv samme navn med bedre/dårligere score og ulik bruk av store bokstaver. Kontroller pause, USB-brudd, fullskjerm og bytte av modus. Uten navn eller ved «Hopp over» opprettes ingen rekord. Ved tidtaking skal kortere tid forbedre rekorden.

## 5. Del

Pakk spillet:

```sh
npm run game:pack -- src/games/tilt-target
```

Verktøyet validerer og lager en ZIP under ignorert `build/game-packages/`. ZIP-en inneholder én rotmappe med manifest, kode og ressurser. SDK, kontoopplysninger, lokale rekorder og `node_modules` følger ikke med.

Mottakeren pakker ut rotmappen til **sin** `webapp/src/games/`, kjører/oppdaterer den lokale serveren og velger spillet. Det finnes ingen ZIP-importknapp på nettsiden. Mottakeren trenger en kompatibel versjon av plattformen, men skal ikke redigere register, launcher, CSS eller backend for å bruke spillet lokalt.

Hvis mottakeren driver et hostet nettsted, bygger og publiserer vedkommende på vanlig måte. Den felles utrullingsflyten publiserer spillfilene og oppretter topplistene automatisk. Det er ikke nok å legge spillet på egen PC for å endre noen andres nettsted.

## Lokale rekorder og oppdateringer

Lokale rekorder er lagret i denne nettleseren for denne nettadressen/porten. De deles ikke mellom maskiner eller automatisk med online-kontoen. Bruk rekordeksport hvis du vil ta sikkerhetskopi eller flytte data; den funksjonen er separat fra spillpakken. Ikke send personers rekorddata med spill-ZIP-en uten et eget, bevisst valg.

Når du deler en oppdatering, behold spill-ID/modus-ID. Endre `version`, og øk `rulesVersion` for moduser der konkurransen er endret. Ny regelutgave starter ny toppliste; gammel historikk beholdes. Flytting/omdøping av mappen gir ikke et nytt spill. To kopier med samme ID i samme spillmappe gir en tydelig konflikt som må ryddes opp.

## Vanlige feil

| Problem | Hva du kontrollerer |
| --- | --- |
| Spillet vises ikke | `game.json` ligger direkte i spillmappen, ikke én ekstra mappe ned. Kjør validering og oppdater katalogen. |
| Ustøttet SDK | Oppdater plattformen eller bruk SDK-hovedversjonen den støtter. Ikke kopier interne hostfiler inn i spillet. |
| Import utenfor pakken | Flytt hjelpefilen inn i spillet eller bruk dokumentert SDK-funksjon. `../shared/` er ikke del av den portable kontrakten. |
| Score avvises | Send et objekt med nøyaktig de deklarerte feltene og heltall innen min/maks. Ikke pakk tid/plassering manuelt. |
| Online er ikke klar | Nettstedets utrullingsjobb må ha synkronisert katalogen med en tilgjengelig backend. Lokalspill fungerer uten dette. |
| Lyd er stille | Bruk den felles lydknappen og volumvalget i spillrammens topplinje. Koble nettleserlyd til `audio.subscribe`/`audio.onUnlock`, og håndter autoplay-/outputfeil. Ikke lag egne lydkontroller; spillet skal fungere uten lyd. |
