# Viking Dash – oppløsning, lyd og tempo

**Dato:** 2026-10-29. Utgangspunkt: `a0a56ea`, med lokale endringer.

Revisjonen bruker `viking-v3` og [felles balanseverdier](../src/games/viking-dash/config.js):
12 m/s ved start, 24 m/s fra 1 200 meter, 40 meters synsfelt og fartsavhengige
hinderavstander. Første hendelse kommer etter 3–5 sekunder; senere pauser er
2–3,5 sekunder, eller 3–5 etter intense hendelser. Miljø velges hver 250. meter.

Canvas tilpasses faktisk størrelse og pikseltetthet, med skarp tekst tegnet
direkte i aktuell oppløsning. Valgfri musikk med melodi, bass og slagverk samt
hopp-, landings-, dukke-, kollisjons- og hendelseseffekter spilles i nettleseren.
Musikken følger aktiv spilling og stopper ved pause, nedtelling og avslutning.

| Kontroll | Resultat |
| --- | --- |
| Enhetstester | PASS, 74 tester. Inkluderer flere seed ved maksimal fart, hinderavstander, hendelsesrytme og fem tester av musikkens levetid og ressursgrenser. |
| Bygg | PASS, 36 offentlige filer; ingen nye avhengigheter. |
| Nettlesertester | PASS, 14 tester mot `dist/`. Dekker DPI 2, mobiltekst, oppstart, pause/gjenopptakelse og native Web Audio-kilder under spilling. |
| Visuell kontroll | Desktop-/mobilbilder gjennomgått; skarp HUD uten oppskalering fra 480×270. |
| Dokumentasjon og diff | Relative lenker kontrollert; `git diff --check` uten feil. |

Miljø: Windows, Node 22.20.0, npm 10.9.3, Playwright 1.64.1 og installert Microsoft
Edge. Prosjektets låste Node/npm 24.22.1/11.19.1 er ikke brukt i denne kjøringen.
Edge-konfigurasjon og skjermbilder ligger lokalt i ignorert `build/`.

Kontrollerte API-/Web Serial-data brukes i nettlesertestene. Musikksyntese og
pause/mute/opprydding testes både med styrt lydklokke og native nettleser-API;
lydopplevelse på brukerens faktiske høyttalere er ikke vurdert. Fysisk Micro:bit,
instrumentert latens og endelig balanse må prøves separat. Tidligere seed gir
ikke samme bane med denne balanseversjonen. Ingen database eller publisering
er endret.
