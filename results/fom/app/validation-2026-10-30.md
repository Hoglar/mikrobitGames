# Verifisering av felles appevaluering – 30. oktober 2026

Den lokale nettleserprofilen er kjørt og består. Teknisk skår er **100/100**.
Samlet FoM venter på gruppens UX-skår og kommentar; ingen brukervurdering er fylt
inn av testverktøyet eller utviklingsassistenten.

[Gjennomgått målesammendrag](baseline-summary-2026-10-30.json) inneholder
kontrollresultater, skårformel, miljø, kilde-/kontrollhash og alle p95-verdier.
Det er et utdrag fra kjøring `20261030T114311.199639Z`, ikke et nytt historikkpunkt.
Commit var `11aaab1e529c4b8f9d7307cef5d7c0f2bdae033b` med lokale endringer.

| Kontroll | Bestått |
| --- | ---: |
| Webapp-enhetstester | 58 |
| Inputadapter | 39 |
| Backend-enhetstester | 72 |
| Firmware / CTest-pakker | 3 |
| Nye komponentkoblinger | 3 |
| App i Chromium | 29 |
| Inputadapter i Chromium | 10 |
| Måleverktøyets egne regresjonstester | 17 |

Dette er 214 produktrelaterte testtilfeller/testpakker pluss 17 verktøytester.
Firmwaretallet teller tre CTest-pakker, ikke hver enkelt intern assertion.
Kapasitetskontrollen og alle 14 ytelsesprofiler bestod i tillegg.

- Input p95 i Node: 0,0225–0,0249 ms; budsjett 5 ms.
- Input p95 i Chromium: omtrent 0,1000 ms; budsjett 5 ms.
- Spillsimulering p95: 0,0031–0,1035 ms per avtalt arbeidsmengde; budsjett 16,67 ms.
- Rapporten ble åpnet direkte fra disk i Chromium. Grafpunkt, navigasjon,
  historikkfiltrering, mobilbredde 390 px og fravær av JavaScript-feil ble kontrollert.
- Vurderingshistorikk, skårgrenser, manglende målinger, avbrudd/timeout,
  HTML-escaping og bevaring av opprinnelige rapporter inngår i verktøytestene.

Miljø: AMD Ryzen 7 7435HS, WSL2/Linux, Python 3.13.5, Node **20.19.2** og Chromium
156.0.8078.4. Prosjektets anbefalte Node-versjon er 24.22.1. Denne kjøringen
dokumenterer det faktiske lokale miljøet; en kjøring med anbefalt Node-versjon
vil få egen sammenligningsserie. Manglende Chromium-biblioteker ble pakket ut
under `/tmp/mbg-browser-deps/`, og `LD_LIBRARY_PATH` ble brukt under verifiseringen.
For varig oppsett brukes installasjonsstegene i [kjøreguiden](README.md).

To tidligere oppsettskjøringer ligger bevart lokalt som `BLOCKED`, uten punkt.
De hadde manglende avhengigheter/sandkassetilgang; én av dem avdekket også en for
streng flyttallssammenligning i den nye koblingstesten, som deretter ble rettet
til toleranse `1e-12`. Dette er oppsett og verifisering av testverktøyet, ikke tre
gjennomførte produktiterasjoner. Grafen har ett målbart teknisk punkt.

Levende PostgreSQL, API-/AI-runtime og fysisk micro:bit er ikke testet her.
Nettleserens eksterne grensesnitt er mocker. `--backend-full` er implementert,
men ble ikke kjørt mot et konfigurert backend-testmiljø i denne kontrollen.
Eksisterende backend-FoM-arkiv er uendret.

Lokale fullrapporter, logger, graf og overleveringsfiler ligger i
`results/fom/app/runs/` og er ignorert av Git. Dette sammendraget inneholder ingen
UX-kommentarer eller ekte brukerdata. SHA-256 for original `report.json`:
`1172900f2da31ba86139ce621e46358ae739173b883fa8781e09a680c928c3de`.
