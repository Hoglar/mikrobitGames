# Samlet appevaluering gjennom iterasjoner

[Første lokale verifisering og målesammendrag, 30. oktober 2026](validation-2026-10-30.md).

Kjør fra prosjektroten i en terminal:

```powershell
python tests/evaluate.py run
```

Testen spør først om navn på iterasjonen, vurderer/gruppe og eventuell
testkontekst, for eksempel maskinvare og nettleser dere prøver manuelt. Dere kan
oppgi navnet på forhånd med `--label "01 – baseline"`. Deretter kjøres de
automatiske testene og benchmarkene. Når de er ferdige, stiller
brukervurderingen bare to spørsmål:

1. Hvordan var brukeropplevelsen?
2. Hvilken skår gir dere brukeropplevelsen (1–10)?

Det første svaret er fritekst. Prøv **den samme kodeversjonen** som ble testet
automatisk før dere svarer.

Under brukervurderingen kan dere skrive `senere` for å utsette resten. Tomt svar
på skårspørsmålet utsetter også vurderingen. Hvis inndata avsluttes eller dere
trykker Ctrl+C etter de automatiske testene, beholdes både testrapporten og
brukersvarene som allerede er registrert. En ufullstendig vurdering gir ingen
UX-skår eller samlet FoM.

Åpne deretter `results/fom/app/index.html` i nettleseren. Grafen og rapportene
virker direkte fra disk, uten server eller internettilgang. Klikk på et punkt for
å se testresultater, p95, målebudsjetter og tilbakemeldinger. Hver kjørings
`runs/<kjørings-ID>/report.html` samler disse resultatene med testkontekst,
brukersvar og en FoM-graf over historikken. Hver kjøring beholder egne JSON-filer
og logger; eksisterende målinger overskrives ikke. Kjør én evaluering om gangen,
uten andre tunge oppgaver.

Hvis en deltest eller benchmark feiler, fortsetter kjøringen med de uavhengige
delene og den manuelle vurderingen. Rapporten beholder feilstatus, beskrivelse
og logg. Tester som avhenger av et mislykket bygg, eller mangler nødvendige
verktøy, merkes `BLOCKED`; de fremstår ikke som bestått.

For automatiserte kjøringer uten spørsmål:

```powershell
python tests/evaluate.py run --non-interactive --label "01 – baseline"
```

Uten et interaktivt terminalvindu velges denne oppførselen automatisk, og
`--label` må oppgis. `--interactive` tvinger frem spørsmål, også ved videresendte
inndata. `--interactive` og `--non-interactive` kan ikke brukes samtidig.

For å registrere en utsatt vurdering eller rette en tidligere vurdering, bruk:

```bash
python3 tests/evaluate.py feedback latest --score 7 --reviewer "Gruppen" --comment "Navigasjonen var tydelig. Det var vanskelig å oppdage at spillet var pauset. Prioriter tydeligere pausevisning neste gang."
```

Tallet og kommentaren over er kun et eksempel; de legges ikke inn automatisk.
Bruk kjørings-ID i stedet for `latest` når dere vurderer en eldre versjon.
Kommentaren og vurderer er obligatoriske. Skåren er et tall fra **1 til 10**.
En retting lagres som en ny vurdering; hele vurderingshistorikken beholdes, og
den siste vurderingen brukes i FoM. Den opprinnelige testrapporten endres ikke.

Gi `runs/<kjørings-ID>/next-iteration.md` videre til neste utviklingsrunde.
Filen samler kodeversjon, skår, feil og gruppens kommentarer. Gjør forbedringen,
kjør igjen med `--label "02 – tydeligere pause"`, og vurder samme brukerforløp.
Minst tre **reelle** målepunkter (baseline og to bestilte forbedringsrunder) gir
en nyttig utviklingskurve. Verktøyet lager ingen kunstige historikkpunkter.

## Engangsoppsett

Bruk Node-versjonen i `webapp/.nvmrc` (24.22.1), Python 3.10 eller nyere
(backendens låste miljø bruker 3.13), CMake, CTest og en C++11-kompilator.

På Windows/PowerShell:

```powershell
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
cd webapp
npm ci
npx playwright install chromium
cd ..
```

På Linux/macOS brukes vanligvis `python3` og `.venv/bin/`:

```bash
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
cd webapp
npm ci
npx playwright install chromium
cd ..
```

På Linux kan Chromium også trenge systembiblioteker. Installer dem med
`npx playwright install-deps chromium` fra `webapp/` hvis oppstartskontrollen
melder manglende biblioteker. Dette kan kreve administratorrettigheter.
Evalueringsverktøyet installerer ingen avhengigheter automatisk. `.venv` brukes
automatisk når miljøet finnes. `--node /sti/til/node` velger en bestemt Node-binær.
I kommandoene i denne guiden kan `python3` erstattes med `python` på Windows.

Selve måleverktøyets regresjonstester:

```bash
python3 -m unittest discover -s tests/evaluation -p 'test_*.py'
```

## Hva inngår?

Enhetstester kontrollerer enkeltmoduler, mens integrasjonstestene kontrollerer
koblinger og samlede forløp. De vises separat i rapporten, sammen med
benchmarkmålinger og UX-svar.

| Del | Kontroll | Faktisk omfang |
| --- | --- | --- |
| Enhetstest | `web-unit` | Alle eksisterende webapp-enhetstester: spill, launcherregler, resultater, kø/retry, Testlab, lyd og Tetris-utdata. |
| Enhetstest | `input-unit` | Framing, validering, normalisering, sesjoner, reconnect, kommandoer og native Streams. |
| Enhetstest | `backend-unit` | Backendens ekte regler for autentisering, poeng/rangering, AI-svar, samtale og tillatte databasespørringer. Ingen levende DB eller modell. |
| Firmware/integrasjon | `firmware` | C++-kjerne, felles protokollfixtures og serialharness, via CMake/CTest med simulert maskinvare. |
| Integrasjon | `cross-component` | Ekte C++-enkoder → webapp-framer/validator/input; webapp-kommando → firmware → kvitteringsparser; grenseverdier for alle registrerte spill sammenlignes med ekte Python-validering. |
| Kapasitet | `platform-capacity` | Eksisterende opptaksbenchmark: 50/500 Hz, bufferomløp, 3000 samples / 1000 hendelser og eksport. Korrektheten inngår i funksjonsskåren. |
| Nettleser/integrasjon | `browser-app` | Hele eksisterende Playwright-pakken mot bygget app: spillstart, pause/reconnect, resultatinnsending, konto, dashboard, AI-visning og mobilvisning. API og Web Serial er mocker. |
| Nettleser/integrasjon | `browser-input` | Hele eksisterende adapterpakken i Chromium, inkludert native Streams. Replaymålingene inngår også i nettleserbenchmarken. |
| Benchmark | `input-benchmark` | Målte input-replayprofiler i Node, med p95 og faste tidsbudsjetter. |
| Benchmark | `games-benchmark` | Seks spillfamilier med faste simuleringer og bevarte individuelle tidsprøver. |
| Benchmark | `browser-performance` | Input-replay med native Streams i Chromium; inngår når nettleserprofilen kjøres. |
| Brukervurdering | UX | Gruppens fritekst om brukeropplevelsen og skår 1–10. |

Enhetstester verifiserer deler; koblingene kontrolleres med integrasjonstester.
Dette er en **lokal applikasjonsprofil**, ikke bevis for faktisk USB, PostgreSQL,
nettverk, autentisering i produksjon eller AI-modellens svarkvalitet.

For også å kjøre prosjektets eksisterende API/database/AI-integrasjon og HTTP-/DB-/AI-benchmarks:

```bash
python3 tests/evaluate.py run --label "01 – med backend" --backend-full
```

Dette kjører `backend/check full`, med samme oppsett og testdatabase som beskrevet
i [backendens kjøreguide](../../../backend/verification/README.md).
Backendrapporten må være komplett og uten blokkeringer. Fjernkjøring krever samme
rene commit på begge maskiner. En ny rapport fra **denne** kjøringen kopieres inn;
gamle backendrapporter gjenbrukes aldri som nye målinger. Backendens faste
kontrollgrupper, inkludert ytelseskrav, inngår som en ekstra funksjonsgruppe.
HTTP-/DB-/AI-råmålingene finnes i `backend-full.json`.

`--no-browser` gir en raskere `local-core`-profil uten Chromium. Den får en egen
serie. Å utelate nettleseren eller backend kan derfor ikke forbedre en eksisterende
series skår. Fysisk micro:bit testes separat etter
[maskinvareplanen](../../../microbit/spec/test-plan.md).

## FoM og benchmarks

FoM er en avtalt kvalitetsindikator, ikke testdekning i prosent eller et bevis på
at appen er feilfri. Første versjon bruker:

**FoM = 0,50 × F + 0,30 × P + 0,20 × U**, fra 0 til 100.

| Delskår | Grunnlag | Bidrag til samlet FoM |
| --- | --- | --- |
| F – funksjon, 0–100 | Enhets- og integrasjonstester, nettleserkontroller, firmware og kapasitet; eventuell full backendkontroll | `0,50 × F`, maksimalt 50 poeng |
| P – ytelse, 0–100 | Målte benchmarkgrupper for input og spillsimulering; Chromium når valgt | `0,30 × P`, maksimalt 30 poeng |
| U – brukeropplevelse, 10–100 | Gruppens UX-skår 1–10 multiplisert med 10 | `0,20 × U`, maksimalt 20 poeng |

Rapporten viser delskårene og hvert vektet bidrag, slik at dere kan se hvordan
enhetstester, benchmarks og brukervurdering inngår i sluttskåren.

- **F – funksjon:** Gjennomsnitt av funksjonsgruppenes beståttandel. Gruppene
  vektes likt, slik at mange tester i én modul ikke skjuler en annen modul.
  Kapasitetskontrollen gir 100 ved bestått og 0 ved brutt kontroll.
- **P – ytelse:** Lik vekt mellom input-replay i Node, spillsimulering og
  input-replay i Chromium (Chromium bare i nettleserprofilen). Profilene innenfor
  hver benchmark vektes likt. Hver måling får
  `100 × min(1, budsjett / målt p95)`, med 100 også ved målt null.
- **U – brukeropplevelse:** Gruppens skår 1–10 multiplisert med 10.

| Benchmark | Belastning og statistikk | Fast budsjett |
| --- | --- | --- |
| Input, Node og Chromium | 50 og 500 Hz, 1 og 4 abonnenter, 1000 oppvarmingsframes, 300 sekunder akselerert logisk tid per profil; p50/p95/p99 og throughput | p95 ≤ 5 ms fra komplett linje til callback. Kontrakten angir dette ved 50 Hz; samme budsjett ved 500 Hz er et valgt stressmål for denne FoM-en. |
| Alle seks spillfamilier | 100 oppvarminger + 1000 målinger per spill, fast seed, opprettelse og 60 simuleringssteg ved 120 Hz; Snake bruker 5 steg. Alle individuelle prøver beholdes. | p95 ≤ 16,67 ms per hel arbeidsmengde. Et valgt CPU-budsjett, ikke et målt FPS-krav. |
| Plattform og opptak | Eksisterende 50/500 Hz-test med 600 sekunder logisk opptak, bufferomløp og JSON-/CSV-eksport | Kapasitet/korrekthet inngår i F. Tidsmålinger er rå referansetall uten oppdiktet latenskrav. |

Alle tidsmålinger inkluderer testens måleoverhead. Spilltesten måler simulering
og opprettelse, **ikke tegning, GPU eller bildefrekvens**. Input-replay er ikke en
femminutters USB-soak. Råverdiene er tilgjengelige selv når skåren allerede er 100;
videre forbedring under budsjettet gir ikke en kunstig skår over 100.

Uten UX-vurdering viser grafen et **åpent teknisk punkt**:
`(0,50 × F + 0,30 × P) / 0,80`. Samlet FoM vises som et fylt punkt etter vurdering.
UX settes aldri automatisk. Manglende verktøy, timeout, utelatte
tester, tom testoppdagelse eller manglende målinger gir `BLOCKED`, uten punkt.
Målte testfeil beholdes som `FAIL` og trekker skåren ned. En høy samlet skår kan
derfor fortsatt ha testfeil: les alltid delresultatene.

Exitkode: `0` = automatiske målinger bestod (UX kan mangle), `1` = test eller
ytelseskrav feilet, `2` = ufullstendig/blokkert måling uten registrerte testfeil.

## Brukervurdering

Prøv samme versjon av appen som testen målte. Bruk gjerne samme gruppe, maskin
og funksjoner hver gang for å sammenligne iterasjonene. Deretter svarer dere på
de to spørsmålene om brukeropplevelse og skår. Det er ingen egen sjekkliste eller
ekstra spørsmål om enkeltoppgaver.

Skalaen går fra **1** = dårligst til **10** = best brukeropplevelse. Desimaltall
er tillatt, også med komma. Beskriv opplevelsen med egne ord i fritekstsvaret.
Hvis dere utsetter skåren med tomt svar eller `senere`, beholdes teksten uten at
en UX-skår blir funnet på.

Dere kan starte den lokale appen i en annen terminal:

```powershell
cd webapp
npm run dev
```

Åpne `http://127.0.0.1:4174/`. Lokalmodus har spill og fysisk micro:bit-input,
men konto, resultatlagring, dashboard og AI er deaktivert. Disse funksjonene
krever et tilkoblet appmiljø med samme kodeversjon. Vurder det dere faktisk har
prøvd, og oppgi gjerne begrensninger i fritekstsvaret.

## Historikk og sammenlignbarhet

Kjøringene lagrer dato, commit, lokale endringer, kildehash, kontrollhash,
maskin/CPU, Node/Python/kompilator, Python-pakker, nettleserversjon og formel.
Grafen knytter bare sammen punkter med samme kontrollgrunnlag, miljø og profil.
Endrer dere tester, vekter eller budsjetter, starter en ny serie. Den tidligere
backend-FoM-en beholdes som en separat måling.

Lokale kodeendringer er tillatt og merkes med kildehash; commit før en delt baseline
for best sporbarhet. Hvis kode eller kontrollsett endres under kjøringen blir den
blokkert. Ikke sammenlign en kald eller tungt belastet maskin med en ellers ledig
maskin som om endringen skyldes produktkoden.

`python3 tests/evaluate.py report` bygger HTML, Markdown og SVG på nytt fra historikken.
`--output /annen/mappe` før underkommandoen velger en annen rapportrot, også for
`feedback` og `report`. Denne kommandoen kjører ingen tester på nytt og endrer
ikke de opprinnelige målingene.
Fullførte vurderinger lagres som nye `feedback-*.json`; utsatte eller avbrutte
brukersvar lagres som `user-input-*.json`. Ingen av dem endrer den opprinnelige
`report.json` med automatiske målinger. Bare en fullført vurdering brukes i FoM.

## Graf og resultater i GitHub

![FoM-score gjennom registrerte iterasjoner](history.svg)

[Les historikk og rapporter direkte i GitHub](history.md) eller [åpne grafen som SVG](history.svg). Den viser bare reelle, komplette målinger;
en blokkert kjøring beholdes i historikken uten FoM-punkt. Et åpent punkt er
teknisk skår før UX-vurderingen er registrert.

Følgende genererte filer under `results/fom/app/` er tilgjengelige for manuell
innsjekking sammen med kildekoden:

| Fil eller mappe | Innhold |
| --- | --- |
| `history.svg` | Grafen som også vises direkte i denne README-en på GitHub. |
| `history.md` | Historikk med delskårer og lenker til rapporter som kan leses direkte i GitHub. |
| `index.html` | Samlet historikk med lenker til kjøringsrapportene. |
| `runs/<kjørings-ID>/report.md` | Rapport med separate testkategorier, skårberegning, graf og feillogger som vises direkte i GitHub. |
| `runs/<kjørings-ID>/report.html` | Samlet rapport med tester, feil, benchmarks, UX og FoM-graf. |
| `runs/<kjørings-ID>/report.json` | Opprinnelige automatiske testresultater, miljø og målegrunnlag. |
| `runs/<kjørings-ID>/summary.json` | Beregnede delskårer, samlet FoM og fullføringsstatus. |
| `runs/<kjørings-ID>/*.json`, `*.xml` og `*.log` | Råmålinger, individuelle prøver, testutdata og registrerte brukersvar. |
| `runs/<kjørings-ID>/next-iteration.md` | Feil og prioriteringer til neste utviklingsrunde. |

Behold eksisterende kjøringer, også feil og blokkerte forsøk. Nye evalueringer
lagres i nye mapper. Etter en vurdering eller ny kjøring oppdateres oversikten og
grafen fra den bevarte historikken.

Når dere selv inkluderer resultatmappen i staging, commit og push i VS Code,
følger graf, rapporter og testdata med til GitHub. Gjennomgå brukersvarene før
deling. HTML-rapportene kan lastes ned med resten av prosjektet og åpnes lokalt;
GitHub viser grafen i README-en, Markdown-rapportene og råfilene i repositoryet. Evalueringsverktøyet
utfører ingen staging, commit eller push.
