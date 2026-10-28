# Testresultater og Figure of Merit

Her ligger arkiverte backendrapporter som skal deles med hele gruppen gjennom Git. Alle fire tidligere fullkjøringer fra 2026-10-27 er tatt med, inkludert feil og ufullstendige målinger. Filene er uendrede kopier av de lokale rapportene. Oversikten gjelder den daværende implementasjonen, før samtaleintegrasjonen 2026-10-28.

[Kort arbeidsrapport: AI-rettingen og den nye samtaleløsningen, 2026-10-28](ai-work-summary-2026-10-28.md) forklarer problemet, endringene og hva som er kontrollert før neste fullkjøring.

## Tidligere kjøringer

Tidspunktene i mappenavn og rapporter er UTC. Resultatkolonnen gjelder integrasjon og benchmark; kontrollverktøy og enhetstester står i hver rapport. FoM-kolonnen viser krav / modell.

| Kjøring (UTC) og rapport | Testet commit | Integrasjon/benchmark | Krav-FoM / modell-FoM |
| --- | --- | --- | --- |
| [20261027T174958.751158Z](backend/20261027T174958.751158Z/report.md) | `5b41984` | 10 PASS, 1 FAIL, 30 BLOCKED | Ingen komplett FoM |
| [20261027T175640.430159Z](backend/20261027T175640.430159Z/report.md) | `5b41984` + lokale endringer | 34 PASS, 5 FAIL, 1 BLOCKED | Ingen komplett FoM |
| [20261027T185538.809129Z](backend/20261027T185538.809129Z/report.md) | `e21d82e` | 36 PASS, 4 FAIL | 83.33 % / 100.00 % |
| [20261027T194827.319030Z](backend/20261027T194827.319030Z/report.md) | `d70e9fa` | 39 PASS, 1 FAIL | 91.67 % / 100.00 % |

- **17:49:** Flere tjenester startet ikke. Mange kontroller var blokkert; ingen FoM.
- **17:56:** Flere kontroller og benchmark ble utført, men kjøringen hadde feil, en blokkert kontroll og lokale kodeendringer. Den er foreløpig og gir ikke FoM.
- **18:55:** Første komplette FoM-måling i dette arkivet: 83,33 % / 100 %. Testens database-mellomledd hadde en senere påvist transportfeil som påvirket samtidighet og kunne påvirke ytelse. Rapporten er bevart med dette forbeholdet; se [diagnosen i kjøreguiden](../../backend/verification/README.md).
- **19:48:** 91,67 % / 100 %. HTTP-/DB-benchmark bestod; virkelig AI feilet fortsatt. Dette er siste tidligere fullkjøring i arkivet, ikke en måling av dagens samtaleløsning.

## Kurver

| Måling | Krav-FoM | Modell-FoM |
| --- | --- | --- |
| 18:55 | [Vis kurve](backend/20261027T185538.809129Z/requirements.svg) | [Vis kurve](backend/20261027T185538.809129Z/model.svg) |
| 19:48 | [Vis kurve](backend/20261027T194827.319030Z/requirements.svg) | [Vis kurve](backend/20261027T194827.319030Z/model.svg) |

**Målingene er ikke én sammenhengende, sammenlignbar kurveserie.** De to komplette målingene har forskjellig `control_digest`. Samtaleintegrasjonen bruker dessuten kontrollversjon 3 og større modellkontekst. Endret kontrollgrunnlag eller miljø gir en ny serie; prosentendringen alene kan ikke tilskrives bedre produktkode. De opprinnelige SVG-filene viser bare sammenlignbare kjøringer.

Krav-FoM måler oppfyllelse av de faste kontrollgruppene. Modell-FoM måler samsvar med data-, komponent- og grensesnittmodellene. **100 % modell-FoM betyr ikke at AI-en svarer 100 % riktig.** [Implementeringsplanen](../../backend/spec/implementation-plan.md) beskriver formel, vekter og vilkår. Kravet om minst tre målepunkter over tid er ikke oppfylt av to komplette punkter i ulike serier.

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
