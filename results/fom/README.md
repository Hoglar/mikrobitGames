# Testresultater og Figure of Merit

**Ny felles appevaluering:** [App-FoM, benchmarks, graf og UX-tilbakemelding](app/README.md).
Kjør `python3 tests/evaluate.py run --label "01 – baseline"` fra prosjektroten.
Appmålingen har egen formel og historikk; backendarkivet nedenfor er bevart.

Her ligger arkiverte backendrapporter som skal deles med hele gruppen gjennom Git. Fem fullkjøringer fra 2026-10-27–28 er tatt med, inkludert feil og ufullstendige målinger. Filene er uendrede kopier av de lokale rapportene. Siste kjøring, på commit `3bd5d07`, tester den integrerte samtaleløsningen og har **100 % krav-FoM og 100 % modell-FoM**.

[Kort arbeidsrapport: AI-rettingen og den nye samtaleløsningen, 2026-10-28](ai-work-summary-2026-10-28.md) forklarer problemet, endringene og hva som er kontrollert, inkludert den fullførte testfasen.

## Kjøringer

Tidspunktene i mappenavn og rapporter er UTC. Resultatkolonnen gjelder integrasjon og benchmark; kontrollverktøy og enhetstester står i hver rapport. FoM-kolonnen viser krav / modell.

| Kjøring (UTC) og rapport | Testet commit | Integrasjon/benchmark | Krav-FoM / modell-FoM |
| --- | --- | --- | --- |
| [20261027T174958.751158Z](backend/20261027T174958.751158Z/report.md) | `5b41984` | 10 PASS, 1 FAIL, 30 BLOCKED | Ingen komplett FoM |
| [20261027T175640.430159Z](backend/20261027T175640.430159Z/report.md) | `5b41984` + lokale endringer | 34 PASS, 5 FAIL, 1 BLOCKED | Ingen komplett FoM |
| [20261027T185538.809129Z](backend/20261027T185538.809129Z/report.md) | `e21d82e` | 36 PASS, 4 FAIL | 83.33 % / 100.00 % |
| [20261027T194827.319030Z](backend/20261027T194827.319030Z/report.md) | `d70e9fa` | 39 PASS, 1 FAIL | 91.67 % / 100.00 % |
| [20261028T185422.473900Z](backend/20261028T185422.473900Z/report.md) | `3bd5d07` | 42 PASS | 100.00 % / 100.00 % |

- **17:49:** Flere tjenester startet ikke. Mange kontroller var blokkert; ingen FoM.
- **17:56:** Flere kontroller og benchmark ble utført, men kjøringen hadde feil, en blokkert kontroll og lokale kodeendringer. Den er foreløpig og gir ikke FoM.
- **18:55:** Første komplette FoM-måling i dette arkivet: 83,33 % / 100 %. Testens database-mellomledd hadde en senere påvist transportfeil som påvirket samtidighet og kunne påvirke ytelse. Rapporten er bevart med dette forbeholdet; se [diagnosen i kjøreguiden](../../backend/verification/README.md).
- **19:48:** 91,67 % / 100 %. HTTP-/DB-benchmark bestod; virkelig AI feilet fortsatt. Dette er siste kjøring før samtaleintegrasjonen.

- **28. oktober, 18:54 UTC:** Samtaleløsningen bestod alle kontroller, inkludert ekte Qwen og benchmark. Dette er første målepunkt for kontrollversjon 3. Et avvik i rapportens registrerte kontekststørrelse er forklart i [arkivnotatet](backend/20261028T185422.473900Z/archive-notes.md); originalrapporten er uendret.

## Kurver

| Måling | Krav-FoM | Modell-FoM |
| --- | --- | --- |
| 27. oktober 18:55 | [Vis kurve](backend/20261027T185538.809129Z/requirements.svg) | [Vis kurve](backend/20261027T185538.809129Z/model.svg) |
| 27. oktober 19:48 | [Vis kurve](backend/20261027T194827.319030Z/requirements.svg) | [Vis kurve](backend/20261027T194827.319030Z/model.svg) |
| 28. oktober 18:54 | [Vis kurve](backend/20261028T185422.473900Z/requirements.svg) | [Vis kurve](backend/20261028T185422.473900Z/model.svg) |

**Målingene er ikke én sammenhengende, sammenlignbar kurveserie.** De tre komplette målingene har forskjellig `control_digest`. Samtaleintegrasjonen bruker dessuten kontrollversjon 3 og større modellkontekst. Endret kontrollgrunnlag eller miljø gir en ny serie; prosentendringen alene kan ikke tilskrives bedre produktkode. De opprinnelige SVG-filene viser bare sammenlignbare kjøringer.

Krav-FoM måler oppfyllelse av de faste kontrollgruppene. Modell-FoM måler samsvar med data-, komponent- og grensesnittmodellene. **100 % modell-FoM betyr ikke at AI-en svarer 100 % riktig.** [Implementeringsplanen](../../backend/spec/implementation-plan.md) beskriver formel, vekter og vilkår. Arkivet har nå tre komplette FoM-punkter over tid, fordelt på ulike måleserier. Kontrollversjon 3 har foreløpig ett målepunkt; arkivet viser ikke tre direkte sammenlignbare målinger av samme kontrollgrunnlag.

## Benchmark og rådata

Åpne `report.md` i tabellen for feil, status, HTTP-/DB-p95 og kalde/varme AI-svartider. Hver mappe inneholder også `report.json` med alle registrerte delresultater og råmålinger:

- `measurements.http_db`: oppvarming, normal last, topper, operasjonsoppsummering, ressursmålinger og AI-kall, for fasene `without_ai` og `with_ai` når de ble utført.
- `measurements.ai`: de registrerte AI-spørsmålene, svarene, svartidene og format-/statuskontrollene.
- `measurements.model` og `environment`: modellinnstillinger, digest, runtime, pakkeversjoner og maskinopplysninger.
- `integration_tests`, `product_tests`, `tool_tests`, `models`, `controls` og `blockers`: delresultater, feil og manglende målinger.

JSON-filene kan være for store til GitHubs vanlige forhåndsvisning; last dem ned via **Raw/Download raw file**, eller åpne dem i en klonet prosjektmappe. Original formatering og tall er bevart. [Manifestet](backend/manifest.json) viser filstørrelser og SHA-256, slik at arkivkopiene kan kontrolleres mot originalene.

## Nye resultater

`./backend/check` lagrer fortsatt lokalt i `backend/results/runs/`. Den publiserer, committer eller pusher ingenting. Etter en ferdig kjøring gjennomgås rapportene for hemmeligheter og ekte brukerdata. Kopier så `report.md`, `report.json` og eventuelle `requirements.svg`/`model.svg` til en ny mappe under `results/fom/backend/` med samme kjørings-ID. Oppdater oversikten og manifestet; behold feil og regresjoner. Commit og push arkivet for å gjøre det synlig for gruppen.

Dette arkivet inneholder rapporter fra syntetiske testdata. Lokale konfigurasjonsfiler, databaser, modellvekter, løpende logger og midlertidige diagnoseskript inngår ikke. Avgrensede AI-eksperimenter og oppstartskontroller er ikke fullkjøringer og teller ikke som FoM-punkter.
