# Samlet appevaluering gjennom iterasjoner

[Første lokale verifisering og målesammendrag, 30. oktober 2026](validation-2026-10-30.md).

Kjør fra prosjektroten:

```bash
python3 tests/evaluate.py run --label "01 – baseline"
```

Åpne deretter `results/fom/app/index.html` i nettleseren. Grafen og rapportene
virker direkte fra disk, uten server eller internettilgang. Klikk på et punkt for
å se testresultater, p95, målebudsjetter og tilbakemeldinger. Hver kjøring beholder
egne JSON-filer og logger i `runs/<kjørings-ID>/`; eksisterende målinger overskrives
ikke. Kjør én evaluering om gangen, uten andre tunge oppgaver.

Etter at gruppen har prøvd **den samme versjonen** av appen, registrer vurderingen:

```bash
python3 tests/evaluate.py feedback latest --score 7 --reviewer "Gruppen" --comment "Navigasjonen var tydelig. Det var vanskelig å oppdage at spillet var pauset. Prioriter tydeligere pausevisning neste gang."
```

Tallet og kommentaren over er kun et eksempel; de legges ikke inn automatisk.
Bruk kjørings-ID i stedet for `latest` når dere vurderer en eldre versjon.
Kommentaren og vurderer er obligatoriske. Skåren er et tall fra **0 til 10**.
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

Selve måleverktøyets regresjonstester:

```bash
python3 -m unittest discover -s tests/evaluation -p 'test_*.py'
```

## Hva inngår?

| Kontroll | Faktisk omfang |
| --- | --- |
| `web-unit` | Alle eksisterende webapp-enhetstester: spill, launcherregler, resultater, kø/retry, Testlab, lyd og Tetris-utdata. |
| `input-unit` | Framing, validering, normalisering, sesjoner, reconnect, kommandoer og native Streams. |
| `backend-unit` | Backendens ekte regler for autentisering, poeng/rangering, AI-svar, samtale og tillatte databasespørringer. Ingen levende DB eller modell. |
| `firmware` | C++-kjerne, felles protokollfixtures og serialharness, via CMake/CTest med simulert maskinvare. |
| `cross-component` | Ekte C++-enkoder → webapp-framer/validator/input; webapp-kommando → firmware → kvitteringsparser; grenseverdier for alle registrerte spill sammenlignes med ekte Python-validering. |
| `platform-capacity` | Eksisterende opptaksbenchmark: 50/500 Hz, bufferomløp, 3000 samples / 1000 hendelser og eksport. |
| `browser-app` | Hele eksisterende Playwright-pakken mot bygget app: spillstart, pause/reconnect, resultatinnsending, konto, dashboard, AI-visning og mobilvisning. API og Web Serial er mocker. |
| `browser-input` | Hele eksisterende adapterpakken i Chromium, inkludert native Streams og replay-benchmark. |

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

- **F – funksjon:** Gjennomsnitt av funksjonsgruppenes beståttandel. Gruppene
  vektes likt, slik at mange tester i én modul ikke skjuler en annen modul.
  Kapasitetskontrollen gir 100 ved bestått og 0 ved brutt kontroll.
- **P – ytelse:** Lik vekt mellom input-replay i Node, spillsimulering og
  input-replay i Chromium (Chromium bare i nettleserprofilen). Profilene innenfor
  hver benchmark vektes likt. Hver måling får
  `100 × min(1, budsjett / målt p95)`, med 100 også ved målt null.
- **U – brukeropplevelse:** Gruppens skår 0–10 multiplisert med 10.

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
UX settes aldri automatisk til 0 eller 10. Manglende verktøy, timeout, utelatte
tester, tom testoppdagelse eller manglende målinger gir `BLOCKED`, uten punkt.
Målte testfeil beholdes som `FAIL` og trekker skåren ned. En høy samlet skår kan
derfor fortsatt ha testfeil: les alltid delresultatene.

Exitkode: `0` = automatiske målinger bestod (UX kan mangle), `1` = test eller
ytelseskrav feilet, `2` = ufullstendig/blokkert måling uten registrerte testfeil.

## Fast UX-opplegg

Bruk samme gruppe, maskin og oppgaver hver gang, og vurder funksjonene som faktisk
inngår i profilen. Forslag til omtrent ti minutters gjennomgang:

1. Finn et spill og forstå kontrollene uten hjelp.
2. Koble til micro:bit, spill og prøv pause, frakobling og fortsettelse.
3. Prøv alle seks spillfamilier kort; vurder lesbarhet og respons.
4. I tilkoblet app: logg inn, fullfør en runde, finn resultatet og prøv AI-chat.
5. Bli enige om én samlet skår og skriv hva som fungerte, det viktigste problemet
   og konkret prioritet til neste iterasjon. Oppgi hvis en oppgave ikke kunne prøves.

Skala: **0** = oppgavene kan ikke gjennomføres; **2** = store hindringer;
**5** = gjennomførbart med tydelig friksjon; **8** = lett å forstå med små problemer;
**10** = alle avtalte oppgaver oppleves problemfrie. Mellomverdier er tillatt.
Enighet om samme kriterier betyr mer enn mange desimaler.

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

`python3 tests/evaluate.py report` bygger HTML/SVG på nytt fra historikken.
`--output /annen/mappe` før underkommandoen velger en annen rapportrot, også for
`feedback` og `report`. Genererte resultater og kommentarer ignoreres av Git.
For deling: gjennomgå innholdet, og kopier ønsket rapportrot med `index.html`,
`history.svg` og `runs/` til et arkiv. Kommentarer kan inneholde personopplysninger;
ikke commit råkjøringer automatisk. Ingen kommando her publiserer eller pusher noe.
