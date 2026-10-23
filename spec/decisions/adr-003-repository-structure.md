# ADR-003: Monorepo med tre hovedmoduler

**Status:** Accepted

**Dato:** 2026-10-23

## Kontekst og problemstilling

Fem gruppemedlemmer skal utvikle et Micro:bit-spillsystem gjennom modelldrevet AI-utvikling. Kode, krav, modeller, kontrakter, tester og måleresultater trenger tydelige plasseringer som støtter parallelt arbeid og samlet verifisering.

Gruppen har gjennomgått strukturforslaget i WBS 1.7 og valgt å samle Backend API, database og AI-tjeneste i én backend-modul. C4-modellens ansvarsdeling beholdes; organisering i mapper bestemmer ikke om delene kjører i én eller flere prosesser.

## Beslutningsdrivere

- Gjøre det enkelt å koordinere grensesnitt og endringer i samme repository.
- Samle arbeidet med API, database og AI uten å blande ansvarsområdene i implementasjonen.
- Tillate forskjellige teknologier og arbeidsprosesser i hovedmodulene.
- Gjøre grunnlaget for utvikling og dokumentert verifisering lett å finne.

## Vurderte alternativer

- Separate repositoryer for systemdelene: selvstendig administrasjon, men mer koordinering av kontrakter og versjoner.
- Monorepo med fem hovedmoduler: følger C4-delene direkte, men fordeler backend-arbeidet mellom tre separate toppnivåmapper.
- Monorepo med tre hovedmoduler: samler backend-arbeidet og beholder intern inndeling etter ansvar.

## Beslutning

Vi velger **monorepo med `microbit/`, `webapp/` og `backend/`**. Backend inneholder `api/`, `database/` og `ai-service/`, med felles spesifikasjoner, tester, verifikasjonsverktøy og resultater.

Hver hovedmodul eier sine krav, modeller, implementasjon og lokale tester. API–database, API–AI og AI–database får kontrakter under `backend/spec/contracts/` og integrasjonstester under `backend/tests/integration/`. Kontrakter mellom hovedmodulene ligger i rotens `spec/contracts/`; systemtester og prosjektets FoM ligger også felles.

Detaljert plassering, navngivning og regler er dokumentert i [prosjektstrukturen](../../docs/project-structure.md). Vi velger ikke rammeverk, database eller testverktøy gjennom denne beslutningen.

### Konsekvenser

- Endringer i kontrakter og berørte moduler kan gjennomføres sammen.
- Backend kan utvikles som én modul med tydelige interne ansvarsområder.
- Hovedmodulene kan velge arbeidsmetoder selv, men må følge felles regler for kontrakter og dokumentasjon av resultater.
- Gruppen må vedlikeholde skillet mellom lokale tester og systemtester og unngå kopier av kontrakter.
- Denne beslutningen endrer ikke eksisterende ADR-er eller godkjenner andre arkitekturvalg.
