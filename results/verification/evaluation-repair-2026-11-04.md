# Evalueringsverktøy, rapport og GitHub-oppdatering – 4. november 2026

`python3 tests/evaluate.py run` fullfører nå uten den tidligere portblokkeringen.
Den nye kjøringen har én bevart Tetris-feil og komplette automatiske målinger.
Ingen ny rettingsrunde på spillene, publisering, commit eller push er utført.

## Årsak og rettelse

Kjøringen `20261030T134504.669991Z` stoppet fordi testserverens adresse
`127.0.0.1:4176` allerede var i bruk. Forrige kjøring var avbrutt. En etterlatt
testserver er en sannsynlig årsak; prosessen fra 30. oktober kunne ikke
identifiseres sikkert i ettertid. Portene var ledige da denne undersøkelsen startet.

Evalueringsverktøyet sendte tidligere umiddelbar SIGKILL til testprosessen ved
avbrudd eller tidsavbrudd. Playwright fikk dermed ikke rydde opp sine separate
serverprosesser. På Linux/macOS får testprosessen nå først SIGINT og opptil åtte
sekunder til opprydding, deretter SIGTERM og eventuelt SIGKILL. Windows beholder
stopp av prosesstreet med `taskkill /T`.

En OS-lås hindrer samtidige evalueringer i samme arbeidsmappe. Låsen frigjøres
automatisk ved prosessavslutning. Ukjente servere gjenbrukes eller stoppes ikke
automatisk. Opptatt testport gir en forklaring i rapporten og beholder BLOCKED.

Den første nye målingen, `20261104T083902.338210Z`, avslørte at fire CLI-egenkontroller
tok arbeidsmappens virkelige lås selv om selve testkjøringen var simulert. Jeg
avbrøt målingen og beholdt den i historikken. CLI-testene isolerer nå denne
avhengigheten, mens separate prosesstester kontrollerer den virkelige låsen.
Produktets forventninger og målebudsjetter ble ikke endret.

## Tydeligere rapporter

HTML og Markdown viser nå testområde, miljø og avgrensning, med navn og resultat
per test fra de lagrede resultatene. Siste komplette kjøring har 262 testnavn i
sju grupper. Testnavn som inneholder ord som «physical» beskriver fortsatt
simulerte grensesnitt i nettlesertestene, slik miljøkolonnen forklarer.

Benchmarkdelen viser lagret metode, prøveantall, logisk varighet, p50/p95/p99,
maksimum og throughput der det er målt, i tillegg til eksisterende budsjett og
skår. Rådata kan finnes fra avbrutte grupper; disse merkes som ufullførte og
får ingen ny skår. CPU-tid for spillsimulering er ikke FPS, USB-latens eller
nettverkskapasitet.

De historiske rapportvisningene er regenerert fra bevarte filer. SHA-256-kontroll
bekreftet at de opprinnelige rårapportene, loggene, XML-filene og benchmarkdataene
fra 30. oktober er uendret. Formel, vekter, testforventninger og budsjetter er beholdt.
Etter siste måling ble navnevisningen også kontrollert for Python-testenes
flerlinjede beskrivelser; dette endrer kun lesingen av eksisterende logger.

## Kodeoppdatering og ny kjøring

Tre commits fra GitHub ble hentet inn med fast-forward fra `a7b90d8` til
`f77aedeab492f6c5837fd79f86cac2212932ece2`: nytt sidedesign, Micro Racer-spesifikasjon
og implementasjon. Evalueringsrettelsene ble bevart. Ingen flettekonflikter eller
nye kildekodecommits ble opprettet.

Kommandoen var:

```bash
python3 tests/evaluate.py run --non-interactive --label '2026-11-04 – Micro Racer med rettet evalueringsverktøy'
```

Kjøring: **`20261104T084043.311188Z`**, profil `local-browser`, med lokale
evalueringsrettelser. Miljøet bruker Node 20.19.2, som avviker fra prosjektets
anbefalte 24.22.1. Python/Chromium og øvrig miljø er lagret i rårapporten.

| Gruppe | Resultat |
| --- | --- |
| Måleverktøyets egenkontroll | 57/57 PASS |
| Webapp-/spill-enhetstester | 89/89 PASS |
| Input-enhetstester | 39/39 PASS |
| Backend-enhetstester | 72/72 PASS |
| Firmware på vertsmaskinen | 3/3 PASS |
| Komponentkoblinger | 3/3 PASS |
| Nettleserforløp | 45/46 PASS, én FAIL |
| Input i nettleseren | 10/10 PASS |
| Kapasitetsbenchmark | PASS |
| Input-benchmarks i Node og Chromium | Alle åtte profiler PASS |
| CPU-benchmark for seks spill | Alle seks profiler PASS |

**F: 99,73 · P: 100,00 · teknisk skår: 99,83/100.** Samlet FoM er ikke beregnet;
gruppens UX-kommentar og skår mangler. Exitkode 1 skyldes den målte testfeilen,
og er ikke en tilkoblingsblokkering. En høy teknisk skår kan fortsatt inneholde feil.

Feilen er `local tetris starts without an account or backend, using the production
input adapter`: etter Start forventes «SPILLER» innen sju sekunder, men visningen
blir stående på «KLAR». Den er beholdt med opprinnelig forventning og diagnostikk.
Andre Tetris-forløp bestod. Årsaken til denne spill-/testfeilen er ikke undersøkt
eller rettet i denne runden.

[HTML-rapport](../fom/app/runs/20261104T084043.311188Z/report.html) ·
[Markdown og benchmarktall](../fom/app/runs/20261104T084043.311188Z/report.md) ·
[Historikk](../fom/app/history.md) ·
[Neste iterasjon](../fom/app/runs/20261104T084043.311188Z/next-iteration.md).

## Supplerende kontroller og avgrensninger

- Reell Playwright-probe med to lokale servere: tidsavbrudd ryddet opp begge
  serverne på 4175/4176. Det ble ikke opprettet noe FoM-punkt for proben.
- Alle 57 egenkontroller bestod også mens hovedkjøringens virkelige lås ble holdt.
- Fire rene AI-tester for racingresultatenes presentasjon bestod separat.
  De gir ingen FoM-poeng etter komponentens eksisterende testavtale.
- Rapporten ble åpnet i Chromium: sju testlister/262 testnavn, benchmarktabeller,
  historikkfilter og mobilbredde 390 px fungerte uten JavaScript-feil.
- Micro Racer inngår i web-/nettlesertestene, men har ingen egen CPU-benchmarkprofil.
- Levende backend, PostgreSQL, Qwen, fysisk micro:bit og produksjonsnettverk er
  ikke målt i denne standardprofilen. `--backend-full` var ikke valgt.
- Den publiserte spillserveren er ikke oppdatert til den nye koden.

Neste handling er gruppens UX-vurdering eller en uttrykkelig bestilt retting av
Tetris-feilen. En ny måling eller rettingsrunde startes ikke automatisk.
