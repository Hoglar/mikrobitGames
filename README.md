Vi skal lage en enkel browser over spill, hvor vi kan velge og browse i spillene med en microbit. Vi skal og få ai til og lage noen spill, som vi kan spille med mikrobit. Vi skal ha en persistent lagring av highscores. Vi skal ha lokal ai som skal kunne fortelle om
spill historik, som kan brukes til å info om spillene. 

## Prosjektstruktur

[Prosjektstruktur og felles regler](docs/project-structure.md) er vedtatt og etablert (WBS 1.7). Prosjektet har tre hovedmoduler:

- [Micro:bit](microbit/README.md): sensorer, aktuatorer og USB-kommunikasjon.
- [Webapp](webapp/README.md): spill, launcher, dashboard og Web Serial.
- [Backend](backend/README.md): API, database og lokal AI samlet i én modul.

Krav, modeller og lokale tester ligger sammen med hver modul. Strukturen er etablert; implementasjon og testverktøy kommer i de tilhørende arbeidspakkene.

## Felles materiale

- [Systemspesifikasjon og C4-modell](spec/system/README.md).
- [Kontrakter mellom hovedmodulene](spec/contracts/README.md).
- [Arkitekturbeslutninger](spec/decisions/README.md).
- [Systemtester](tests/README.md).
- [Testresultater og FoM](results/README.md).
- [Presentasjon og demonstrasjon](docs/presentation/README.md).

## Evaluering mellom iterasjoner

`python3 tests/evaluate.py run --label "01 – baseline"` kjører enhetstester,
komponentkoblinger, nettlesertester og benchmarks. Åpne
`results/fom/app/index.html` for historikkgrafen. Legg til gruppens UX-skår og
kommentar med `python3 tests/evaluate.py feedback latest --score 7 --reviewer "Gruppen" --comment "Vår vurdering og neste prioritet"`.
Se [oppsett, FoM-formel og arbeidsflyt](results/fom/app/README.md).
