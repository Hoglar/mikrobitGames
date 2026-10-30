# Micro Racer – kjøring og integrasjon

**Implementert lokalt 2026-10-30.** Ett spill med tre baner, drift-/racer-/formelbil, tidskjøring og firebilers AI-løp, én eller tre runder. Tilt styrer relativt til bilen; kameraet følger/roterer med heading. Hold B for gass, A for brems; A+B prioriterer brems. Logo/Escape pauser. Slipp knapper og hold kontrolleren nøytral etter GO før gass brukes.

Start `npm run dev` fra `webapp/`, åpne `http://127.0.0.1:4174/#/play/racing`, koble til Micro:bit V2 og velg oppsett. Lokal øving tilbyr begge løpsformater uten konto/backend. De tre motstanderne er lokal spillogikk, ikke backendens AI-chat. Ingen tastaturkontroll eller simulerte sensorer er lagt inn i produktet.

Pausemenyen tilbyr «Tilbake til banen»: bilen flyttes til siste sikre kontrollpunkt når plassen er fri, står to aktive sekunder og krever ny nøytralitet. De andre bilene og løpsklokken fortsetter. Hele løpet fryses ved vanlig pause/inputtap. Fullskjerm, motorlyd med volum, responsive menyer og toppliste for valgt variant bruker den felles arcade-rammen.

## Moduler og regler

- `config.js`: låst første bil-/inputprofil, 120 Hz og tidsgrense.
- `tracks.js`: tre håndlagde splinebaner, romlige indekser, vegger, gater, startplasser og validering.
- `physics.js`: separat verdenshastighet/heading, grep, underlag, swept sirkel-/segmentkontakt og bounded kontaktløser.
- `progress.js` / `rules.js`: rettet gateorden, runder, delstegstid, plassering og kodede løpsresultater.
- `model.js` / `ai.js`: fire bilers samtidige simulering og lokal 20 Hz-motstanderprofil.
- `index.js`: adapterinput, frisk nøytralitet, motorgrensesnitt, frosset resultat og opprydding.
- `scene.js` / `style.css` / `setup.js`: roterende verden, nordorientert minikart, HUD, baneforhåndsvisning og fire variantvalg.
- `audio.js`: valgfri, sideeid motorstemme uten nettverk eller musikktimer.

Se [spesifikasjonen](../../../spec/games/micro-racer/README.md) og [valideringsrapporten](../../../results/racing-validation.md). Fysisk kjørefølelse og kameraergonomi er fortsatt uprøvd. Første lydprofil har én nettlesermotorstemme; dekk-/kontaktlyd og Micro:bit-tilstandsbilder er ikke implementert. De er valgfrie presentasjonsforslag, ikke endringer i bilreglene.

## 36 katalogoppføringer

`registry.js` inneholder en stabil UUID per `(bane, format, runder, bil)`, sekvens `...000012`–`...000047`. [Katalogtabellen](../../../spec/games/micro-racer/catalog.json) låser alle 36 oppføringer og kontrolleres mot registeret i testene. Faste bane-/biloffset gjør at rekkefølgeendring ikke omnummererer eksisterende rekorder. ID-er skal aldri omnummereres når nye baner legges til.

```sh
node verification/catalog-commands.mjs --family=racing
```

Kommandoen **skriver bare** 36 reviewbare vedlikeholdskommandoer. Den registrerer eller aktiverer ikke spill. Eksisterende backend må få oppføringene med nøyaktige regler før rangert/tilkoblet start er tilgjengelig. Publisering av frontend og backendens AI-scorepresentasjon gjøres separat etter vanlig driftsflyt.

Tidskjøring bruker `milliseconds`, `min=1`, `max=600000`, lavest er best. AI-løp bruker `racing_rank_v1`, `min=1`, `max=3600000`, lavest er best. Verdien `(plass-1)*1000000 + millisekunder` rangerer plassering før tid. UI og AI-verktøy dekoder dette til plass/tid; et pakket gap er ikke en tidsdifferanse. DNF/avbrudd gir `incomplete` og `null`; bare gyldig målgang kan gi rekord. Backendens eksisterende generiske tallgrenser er beholdt, uten ny anti-cheat- eller serverfysikk.

## Verifikasjon

```sh
npm test
npm run build
npx playwright test --config playwright.app.config.js
```

`tests/unit/fixtures/racing-traces.json` inneholder ni frosne, kvantiserte kontrolltracer med trinnantall og målgangstid. De replays uten å kjøre AI-kontrolleren og fullfører alle ni bane-/bilkombinasjonene uten barrieretreff eller avkjøring. Separate tester kjører tre runder med alle fire biler. Endres fysikk/bane, må profil/rekordgrunnlag vurderes før fixturer oppdateres; ikke regenerer dem bare for å skjule en regresjon.

Nettlesertestene bruker ekte adapterkode med Web Serial-mock. Én full runde kjøres av en testpilot som leser den tegnede kameratilstanden og sender serialinput; den går gjennom motor, spillramme og resultatkø uten å injisere målgang. Backend er en kontrollert kontraktmock. Dette er ikke fysisk USB-, produksjonsdatabase- eller modellakseptanse.
