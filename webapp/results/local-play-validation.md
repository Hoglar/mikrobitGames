# Lokalt spill – verifikasjon 2026-10-29

Lokal øving er implementert for alle seks spillfamilier, inkludert Tetris og alle
seks Snake-varianter. `npm run dev` og `npm run preview` krever ikke konto,
databasekatalog eller session-renew. Fysisk Micro:bit og vanlig adapter er fortsatt
påkrevd for gameplay. Rundeverdier vises bare i minnet; ingen konto, resultatforsøk,
lagringskø eller lokal resultathistorikk opprettes.

Utgangspunkt er `3781f9824a90456763cedb4468810e8bea850137` med lokale endringer,
inkludert den foregående Tetris-leveransen. Dette er en senere kontroll enn
[Tetris-rapporten](tetris-validation.md); dens kildehasher gjelder den daværende
kjøringen. Denne kjøringen brukte Windows x64, Node 24.22.1, npm 11.19.1,
Playwright 1.64.1 og Chromium 156.0.8078.4.

| Kontroll | Faktisk resultat |
| --- | --- |
| Full Node-suite | PASS: 97 tester, ingen feil eller hoppede tester. |
| Statisk bygg | PASS: 43 offentlige filer; ingen ny runtimeavhengighet. |
| Appnettlesertester mot `dist/` | PASS: 27 tester, hvorav ni nye lokale tester. |
| Lokal start for Snake/Viking/Stjernefangst/Reaksjonsjakt/Balanseløypa/Tetris | PASS: ingen konto, én øvingsmodus, sperret Start før input, spilling etter Web Serial-handshake og fungerende pause. Snake viser alle seks valg. |
| Tetris-input/output og livsløp | PASS: seed, hold-bitmap, hard-drop-poeng, inputtap, eksplisitt fortsett, restart og tilbake til meny uten innsending. |
| Naturlig slutt og omstart | PASS: Snake viser completed-resultat, uten konto-/Dashboard-lenker, og kan startes igjen. |
| Ingen backendtrafikk | PASS: nettleserens requestlogg er tom for `/api/` gjennom lokale scenarioer; context har ingen session, tom resultatkø og ingen localStorage-data. |
| Sperrede tjenester | PASS: direkte konto-/Dashboard-/Profil-/toppliste-/AI-ruter viser sperre uten skjema; klientkall avvises med `LOCAL_PLAY_BLOCKED` før fetch; direkte serverkall for konto/katalog/resultat/AI gir 403. |
| Lokal markør og distribusjon | PASS: lokal HTML-respons inneholder markøren; den fysiske `dist/index.html` og vanlig testserverrespons gjør ikke det. Bare loopback med markør aktiverer lokalmodus. |
| Ordinær app | PASS: de 18 tidligere appnettlesertestene beholder konto-/katalog-/renew-/resultatkrav på server uten lokal markør, selv om også den bruker loopback. |

Kjør fra `webapp/` med de låste verktøyversjonene:

```sh
npm test
npm run test:app
```

Faktisk kjøring brukte repoets portable Node-eksekverbar. `verification/build.js`
ble kjørt eksplisitt før Playwright CLI med `--config playwright.app.config.js`,
tilsvarende npm-scriptets prebuild. Testserverne er separate på 4175 (lokal) og
4176 (ordinær UI med kontrollerte API-svar), og berører ikke utviklingsserver på
4174. Den siste supplerende kontrollen kjørte det lokale sperrescenarioet igjen
etter at markør-/artefaktassertionene ble lagt til.

Lokalserveren har ingen proxy, databaseklient eller AI-kobling. Den injiserer bare
en lokal markør i HTML-responsen og blokkerer alle `/api/`-ruter. Appen bruker
bundlet spillregister som katalog og den samme spillrammen/inputadapteren. Den
publiserte HTML-filen inneholder ingen lokalmarkør; publisering får derfor ikke
anonym rangert tilgang eller endrede backendregler.

Nettlesertestene bruker Web Serial-mock med faktiske adapterstrømmer. De beviser
ikke fysisk USB-dialog, styringskvalitet, enhetslyd eller hardwarelatens. Ingen
backend/database/AI ble kontaktet, ingen tjenester ble startet og ingen ekstern
publisering ble utført. Start en allerede kjørende lokalserver på nytt og last
siden på nytt for å ta i bruk endringen.
