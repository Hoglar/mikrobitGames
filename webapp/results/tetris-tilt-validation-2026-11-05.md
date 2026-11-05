# Micro Tetris: mer presis tiltstyring

**Dato:** 2026-11-05. Brukeren beskrev overskyting ved sideflytting og utilsiktet
kolonnebytte idet A ble trykket. Kontrolleren kunne tidligere utføre både
sideflytting og hard drop i samme simuleringssteg, med sideflytting først.

## Endring

- Engasjeringsgrensen økes fra ±0.22 til ±0.32. En ny retning må holdes over
  grensen i 60 ms; korte rykk blir ikke hengende som ventende flytting.
- Slippgrensen økes fra ±0.12 til ±0.20, slik at det blir lettere å stoppe.
  Start/fortsett krever fortsatt 100 ms nøytralitet, nå innenfor ±0.18.
- Første repetisjon kommer etter 300 ms i stedet for 170 ms. Videre repetisjon
  har minst 120 ms intervall i stedet for 70 ms, kvantisert til 120 Hz-steg.
- Drop og holdt A undertrykker sideflytting, også hvis A-nivået kommer et steg
  før press-hendelsen. Etter drop gjelder en 120 ms sperre før ny tilt kan
  stabiliseres. Ny brikke og gyldig hold nullstiller tilt/repetisjon.

Endringen ligger i [Tetris-kontrolleren](../src/games/tetris/engine.js).
Det delte inputbiblioteket, firmware, poengregler og leaderboard-identitet er
uendret. Eksakte regler står i [implementasjonsdesignet](../spec/games/tetris/implementation-design.md#input-og-simuleringsrekkefølge).

## Kontroll

Webbygget bestod. **29 Tetris-spesifikke Node-tester og fem Playwright-tester
bestod.** Nye regresjoner dekker små vinkler, korte rykk, stabilisering og
retningsbytte, repetisjonstider, drop ved forfalt siderepetisjon, A-nivå før
press, holdt A og raskt slipp med sperre for neste brikke. Eksisterende tester
for regler, score, hold/rotasjon/drop, lyd, pause/gjenoppkobling og restart bestod.

Den nye browser-testen bruker faktisk SDK-sandbox og produksjonsadapter med
Web Serial-mock. Den holder en liten rå tilt på 300 mg, sender deretter 900 mg
sammen med A, og leser brikkefargene i canvas: O-brikken låses i kolonne 4–5
(nullbasert), og neste Z-brikke står stille mens A holdes.

Fra `webapp/`:

```sh
node --test tests/unit/tetris.test.js tests/unit/tetris-output.test.js
npm run test:app -- tetris.spec.js
```

Fysisk spillefølelse og presisjon ved maksfart er ikke målt med en fysisk
micro:bit. Verdiene er et roligere utgangspunkt som må vurderes gjennom spilling.
