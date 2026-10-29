# Viking Dash – grafisk revisjon 2026-10-29

Utgangspunkt: `24e649b`, med lokale endringer i Viking-motoren, Canvas-visningen,
spillrammen og valgfri nettleserlyd. [Implementasjonsnotatet](../spec/webapp-implementation.md)
beskriver ansvar og seedversjon. Ingen publisering eller databaseendring er utført.

Miljø: Windows, Node 22.20.0, npm 10.9.3, Playwright 1.64.1 og installert Microsoft
Edge. Tilgjengelig Node/npm avviker fra prosjektets låste 24.22.1/11.19.1; kjøring
med det låste miljøet inngår ikke i denne rapporten. Edge ble valgt gjennom en
lokal, ignorert Playwright-konfigurasjon; prosjektets standardkonfigurasjon er beholdt.

| Kontroll | Resultat |
| --- | --- |
| Enhetstester | PASS, 66 tester, inkludert hoppbuffer, B-prioritet, seed-gjentakbarhet og progresjon. |
| Bygg | PASS, 31 offentlige filer i `dist/`, uten nye runtimeavhengigheter. |
| Nettlesertester mot `dist/` | PASS, 13 tester, inkludert eksisterende appforløp og to nye Viking-tester. |
| Visuell gjennomgang | Fem miljøer og femten hendelser tegnet i en sceneoversikt. Skip/fjord, skogdybde og verdenstre ble justert etter skjermbildekontroll. |
| `git diff --check` | PASS. |

Nye skjermbilder genereres som `build/viking-scenes.png`, `build/viking-ready.png`,
`build/viking-gameplay.png` og `build/viking-mobile.png`. De er lokale, ignorerte
testartefakter. Testene bruker kontrollerte scener og eksisterende Web Serial-mock;
produktet får ingen simuleringsmodus. Sceneoversikten kontrollerer at visning ikke
muterer spilltilstand og at miljøene/hendelsene gir ulike bilder. Faktisk utseende
er også gjennomgått visuelt; bildeulikhet alene beviser ikke grafisk kvalitet.

Fysisk Micro:bit-latens, instrumentert langtidsytelse og komplett hinderbalanse er
ikke målt. Konservative hinderavstander brukes fortsatt; rapporten hevder ikke
full VD-01–16-produktakseptanse eller verifisering av vilkårlige hinderkombinasjoner.
