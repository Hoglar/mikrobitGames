# Tetris: blank spillflate etter spillbytte

**Dato:** 2026-11-05. **Grunnlag:** `c12e1dc` og lokal retting i SDK-runtime. Brukeren beskrev blank Tetris-flate etter Start, med synlig verktøylinje; fullskjerm av/på gjenopprettet bildet. Feilen dukket opp ved gjentatte bytter mellom aktive spill.

## Årsak og reproduksjon

Runtime målte canvas før asynkron modul-/factorylasting, men registrerte `resize`-lytteren først etterpå. En viewport-endring i mellomtiden kunne derfor bli borte. Særlig en innledende 0 × 0-layout ga en canvas på 1 × 1 backing-piksel som ikke ble oppdatert etter at iframen fikk normal størrelse. Fullskjerm fremkalte et nytt resize-varsel og rettet bildet, i tråd med brukerens observasjon.

Regresjonstesten bruker den faktiske Tetris-payloaden og SDK-runtime. Testen holder modulimporten igjen, monterer iframen med 0 × 0-layout, gir den normal størrelse og lar resize-varslet passere før importen fullføres. Før rettingen kom spillet til `playing`, men canvas forble 1 piksel bred og bildet var tomt. Testen feilet på forventet bredde større enn 100 piksler. Etter rettingen får den normal størrelse og mer enn ti ulike synlige farger, uten fullskjerm.

Dette er en deterministisk reproduksjon av lastings-/resize-racen. Den gjør ikke krav på å måle hvor ofte nettleseren til brukeren velger akkurat denne layoutrekkefølgen.

## Retting

- Lytt til resize før modul/factory lastes, og synkroniser på nytt når controlleren er opprettet.
- Kontroller faktisk iframe-størrelse og pikselratio før hvert bilde, slik at tapte varsler ikke etterlater en gammel canvas.
- Hopp over tegning/simulering ved 0 × 0-layout, uten å ta igjen skjult tid senere.
- Endre backing-dimensjonene bare når de faktisk endres; uendrede dimensjoner skal ikke tømme canvas hver frame.
- Gi controlleren første gyldige `onResize` etter opprettelse, og deretter faktiske størrelsesendringer.

Rettingen ligger i felles [`runtime.js`](../src/game-sdk/runtime.js), ikke i Tetris-reglene. Spill-ID, score, fysikk, firmware og serial-adapter er uendret.

## Kontroll

Webbygget bestod. **Ni målrettede browser-scenarier bestod** med produksjonskode og Web Serial-mock:

- Lastingsrace med endret viewport før modulen er ferdig.
- Fire komplette Tetris → aktiv Viking → Tetris-bytter, med aktive runder og pikselkontroll for hver Tetris-oppstart; bare én micro:bit-handshake.
- Endret iframe-layout mens window-resize-varsler bevisst blokkeres; canvas og bilde følger fortsatt ny størrelse.
- Eksisterende fire Tetris-scenarier for input/hold/lyd, pause/reconnect/mobil, top-out/restart og rendergalleri.
- Oppstart/spillbytte for alle syv medfølgende spill gjennom samme SDK.
- Aktivt spill i mobil-/desktop-fullskjerm med verktøylinjen over spillflaten.

Fra `webapp/`:

```sh
npm run test:app -- canvas-resize.spec.js tetris.spec.js
```

Testene omfatter nettleser, canvas og transportmock. De krever ingen fysisk enhet og er ikke en fysisk USB-test.
