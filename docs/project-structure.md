# Prosjektstruktur

**Status:** Ferdig og vedtatt av gruppen. Mappestrukturen er etablert lokalt.

**Dato:** 2026-10-23.

**Arbeidspakke:** [WBS 1.7 – Definere repository- og prosjektstruktur](https://github.com/Hoglar/mikrobitGames/issues/22).

Dokumentet beskriver vedtatt organisering av kildekode, krav, modeller, tester og dokumentasjon etter gruppens gjennomgang. Backend API, database og AI-tjeneste er samlet i én backend-modul. Dokumentet er ferdig; ferdigstilling av de enkelte systemdelene følger egne arbeidspakker.

## 1. Organisering og ansvar

Prosjektet organiseres som ett **monorepo med tre delprosjekter**: Micro:bit, webapp og backend. Backend samler API, database og AI-tjeneste som interne deler. C4-modellens ansvarsdeling beholdes; mappeinndelingen bestemmer ikke antall kjørende tjenester. Dette samler kontrakter og dokumentasjon og gjør det mulig å endre et grensesnitt og berørte systemdeler i samme endring.

Separate repositoryer ville gitt mer uavhengig administrasjon, men også mer koordinering av kontrakter, versjoner og dokumentasjon. For denne skoleoppgaven med fem gruppemedlemmer er derfor ett repository valgt.

Hvert delprosjekt samler egne krav, modeller, implementasjon og tester. Gruppen bruker felles regler for plassering og dokumentasjon, mens hver del kan velge teknologi, testverktøy, arbeidsprosess og intern kodestruktur. Inndelingen krever ikke at hvert gruppemedlem bare arbeider med én del.

| Delprosjekt | Ansvar |
| --- | --- |
| `microbit/` | Sensorer, knapper, aktuatorer og enhetens USB-kommunikasjon. |
| `webapp/` | Spill, launcher, dashboard, felles Web Serial-adapter og kommunikasjon med backend. |
| `backend/` | Samlet ansvar for REST API, autentisering, spilldata, database og lokal AI. Internt deles implementasjonen i `api/`, `database/` og `ai-service/`. |

## 2. Mappestruktur

```text
mikrobitGames/
├── README.md
├── microbit/
├── webapp/
├── backend/
│   ├── api/src/
│   ├── database/
│   │   ├── migrations/
│   │   └── seeds/
│   ├── ai-service/src/
│   ├── spec/
│   │   ├── models/
│   │   └── contracts/
│   │       ├── backend-database/
│   │       ├── backend-ai/
│   │       └── ai-database/
│   ├── tests/
│   │   ├── unit/
│   │   └── integration/
│   ├── verification/
│   └── results/
├── spec/
│   ├── system/models/
│   ├── contracts/
│   │   ├── microbit-webapp/
│   │   └── webapp-backend/
│   └── decisions/
├── tests/
│   ├── integration/
│   └── e2e/
├── results/
│   ├── verification/
│   └── fom/
└── docs/
    ├── project-structure.md
    └── presentation/
```

README-filer forklarer formålet med mappene og er utelatt fra treet over. Kravdokumenter, kontrakter og testplaner fylles ut i sine respektive arbeidspakker; det er ikke opprettet tomme dokumenter som kan forveksles med ferdige leveranser.

### Felles utgangspunkt for delprosjektene

Micro:bit og webapp bruker følgende struktur:

```text
<delprosjekt>/
├── README.md
├── spec/
│   └── models/
├── src/
├── tests/
├── verification/
└── results/
```

| Plassering | Innhold |
| --- | --- |
| `README.md` | Ansvar, lenker til relevante kontrakter og etter hvert instruksjoner for oppsett, kjøring og testing. |
| `spec/` | Krav i `requirements.md` og planlagte tester med forventede resultater i `test-plan.md`, når disse utarbeides. |
| `spec/models/` | Komponentmodeller, datamodeller og andre designmodeller som brukes som grunnlag for utviklingen. |
| `src/` | Implementasjonen, organisert etter ansvar og valgt teknologi. |
| `tests/` | Kjørbare tester av delens funksjonalitet og interne komponenter. |
| `verification/` | Eventuelle skript for modelluttrekk, modellsammenligning og benchmarks. |
| `results/` | Utvalgte testresultater, målinger og uttrekk fra implementasjonen som dokumenterer verifiseringen. |

Backend følger samme prinsipp, men har implementasjonen i `api/src/`, `ai-service/src/` og `database/`. Databaseendringer ligger i `database/migrations/` og syntetiske testdata i `database/seeds/`. Backend har ett felles `spec/`, `tests/`, `verification/` og `results/`, med underinndeling etter ansvar ved behov. Datamodellen ligger under `backend/spec/models/`.

Spill og den felles Micro:bit-adapteren tilhører webappen. Detaljert oppdeling av kildekoden bestemmes ved utvikling av hver del. Verktøybestemte plasseringer beskrives i delens README dersom de avviker fra utgangspunktet.

## 3. Felles krav, modeller og kontrakter

**Systemnivå:** Overordnet C4-modell, krav som gjelder hele systemet og samlet verifikasjonsplan lagres under `spec/system/`. Modeller for én systemdel lagres hos den aktuelle delen.

**Kommunikasjonskontrakter:** Grensesnittene Micro:bit–webapp og webapp–backend beskrives under rotens `spec/contracts/`. De interne grensesnittene API–database, API–AI og AI–database beskrives under `backend/spec/contracts/`, med navn som følger de eksisterende arbeidspakkene. Hvert grensesnitt har én autoritativ beskrivelse. Tilhørende meldingsskjemaer og eksempler lagres sammen med kontrakten når de defineres. Delprosjektene lenker til kontraktene fremfor å vedlikeholde kopier. Endringer gjennomgås av dem som arbeider på begge sider av grensesnittet.

Selve meldingsformatene, API-endepunktene og databasetilgangen defineres i WBS 1.2–1.6. Denne strukturbeslutningen endrer ingen API-er eller kommunikasjonsformater.

**Arkitekturbeslutninger:** ADR-er samles under `spec/decisions/`, også når beslutningen gjelder én del. Delprosjektenes dokumentasjon lenker til relevante ADR-er.

**Utviklingsgrunnlag:** Krav, modeller og kontrakter skal kunne brukes som strukturert input til AI-assistert utvikling. Ved avvik mellom modell og implementasjon dokumenteres avviket, og det vurderes om implementasjonen eller spesifikasjonen skal endres.

## 4. Testing, verifisering og FoM

### Plassering av tester

- Enhetstester og integrasjonstester mellom interne komponenter ligger i delprosjektets `tests/`.
- Tester mellom API, database og AI ligger i `backend/tests/integration/`. Backendens enhetstester ligger i `backend/tests/unit/`.
- Tester mellom Micro:bit, webapp og backend ligger i rotens `tests/integration/`, gruppert etter grensesnitt ved behov.
- Samlede brukerforløp ligger i rotens `tests/e2e/`.
- Tester som krever fysisk Micro:bit får dokumenterte steg og forventede resultater når automatisering ikke er praktisk. Lokale maskinvaretester beskrives i delens testplan; tester på tvers av systemet beskrives i den felles verifikasjonsplanen.

En test som dekker samme kommunikasjon for to arbeidspakker, skal ha én felles plassering. Begge arbeidspakkene kan referere til den.

### Verifisering og resultater

Testing undersøker konkret oppførsel. Verifisering viser hvordan implementasjonen oppfyller kravene og samsvarer med modellene. Oppgaven legger også opp til automatisert modelluttrekk og deterministisk verifisering så langt det er mulig. Skript for dette lagres under delens `verification/`, og felles kontroll av flere systemdeler under rotens `tests/` sammen med den relevante testen.

Utvalgte lokale resultater lagres i delens `results/`. Resultater fra systemintegrasjon og ende-til-ende-testing lagres i `results/verification/` i roten. Resultatene skal inneholde:

- Dato og commit for implementasjonen som ble undersøkt.
- Krav, modell eller kontrakt som ble kontrollert.
- Metode eller kommando, nødvendig testmiljø og relevante testdata.
- Forventet og faktisk resultat, og bestått/ikke bestått der det passer.
- Eventuelle avvik og referanser til oppfølging.

Målinger skal også angi enheter og relevant maskinvare eller konfigurasjon. Dokumenterte resultater fra tidligere iterasjoner beholdes slik at utviklingen kan etterprøves.

### Felles FoM

Felles måleplan, baseline, målepunkter og fremgangsdiagram lagres i `results/fom/`. Måleplanen skal beskrive hva som måles, beregningsmåte, målebetingelser og hvordan målingen gjentas. Målepunktene skal knyttes til dato og commit.

Kontrollgrunnlaget klargjøres først. Første komplette, målbare kjøring av implementasjonen er baseline før forbedringsiterasjonene. Oppgaven krever minst tre målepunkter totalt, inkludert baseline. Brukeren bestiller hver utviklingsrunde; regresjoner beholdes. Dette erstatter tidligere intern plan om fire obligatoriske målepunkter.

For backend er krav-FoM og modell-FoM valgt, med lik vekt til database, API og AI, se [implementeringsplanen](../backend/spec/implementation-plan.md). Det kreves ikke en separat FoM for hver komponent. Felles dokumentasjon lenker til lokale resultater fremfor å kopiere dem.

## 5. Felles navngivnings- og organiseringsregler

- Bruk engelske mappe- og filnavn med små bokstaver og bindestrek, for eksempel `ai-service` og `test-plan.md`. Behold standardnavn som `README.md` og navn som kreves av verktøy.
- Skriv ny forklarende dokumentasjon på norsk. Eksisterende engelsk dokumentasjon kan beholdes.
- Gi krav stabile identifikatorer: `MB-001`, `WEB-001`, `BE-001`, `DB-001`, `AI-001` og `SYS-001`, med videre nummerering innenfor hvert ansvarsområde. Backend beholder prefiksene `BE`, `DB` og `AI` selv om disse områdene ligger i samme modul. Ikke gjenbruk identifikatorer for slettede krav.
- Testbeskrivelser refererer til relevante krav og ved behov kontrakter og modeller. Unngå å kopiere kravteksten inn i flere dokumenter.
- Bruk relative lenker mellom filer i repositoryet og lenker til relevante GitHub-issues for arbeidsoppgaver.
- Navngi ADR-er som `adr-001-beskrivende-navn.md`. Nummeret identifiserer beslutningen, mens dokumentet angir status.
- Hold filer og moduler avgrenset etter ansvar, i tråd med SRP.
- Versjoner utvalgte resultater som underbygger verifisering og FoM. Utelat midlertidige logger, byggartefakter, lokale databaser, modellvekter og hemmeligheter gjennom relevante `.gitignore`-regler når verktøy tas i bruk.
- Bruk syntetiske testdata i repositoryet. Dokumenter nødvendige konfigurasjonsverdier uten å legge inn passord eller andre hemmeligheter.

Hoved-README skal være inngangen til prosjektet og lenke til delprosjektene, felles spesifikasjoner og dette dokumentet. Presentasjon og demonstrasjonsbeskrivelse samles i `docs/presentation/`; store videofiler kan refereres med lenke.

## 6. Gjennomført etablering

Gruppen har gjennomgått forslaget og valgt å samle Backend API, database og AI i én modul. Strukturen er etablert med forklarende README-filer, og eksisterende filer er flyttet som følger:

| Tidligere plassering | Nåværende plassering |
| --- | --- |
| `systemModel/c4ContainerDiagram.drawio` | `spec/system/models/c4-container.drawio` |
| `systemModel/c4ComponentMicroBit.drawio` | `microbit/spec/models/c4-component.drawio` |
| `spec/decisions/adr-direkte-datatilgang-for-AI.md` | `spec/decisions/adr-001-direkte-datatilgang-for-ai.md` |
| `spec/decisions/microbit-serial-communication-adr.md` | `spec/decisions/adr-002-microbit-serial-communication.md` |
| `spec/decisions/adr-template.md` | Beholdt på samme sted. |

Diagrammenes og de eksisterende ADR-enes innhold er bevart. Micro:bit-komponentdiagrammet er fortsatt en tom plassholder og er merket som ikke påbegynt i delens README. Godkjenningen av strukturen endrer ikke beslutningsstatusen til andre ADR-er.

Valget er dokumentert i [ADR-003](../spec/decisions/adr-003-repository-structure.md). Den tidligere `systemModel/`-mappen er fjernet etter flyttingen. Hoved-README lenker til delprosjektene, fellesområdene og dette dokumentet.

## 7. Dekning av akseptansekriteriene i WBS 1.7

| Akseptansekriterium | Dekning og status |
| --- | --- |
| Vurdere og velge repository-struktur. | Ferdig: monorepo er valgt og begrunnet i del 1 og ADR-003. |
| Definere mappeinndeling for hoveddelene. | Ferdig: tre delprosjekter og fellesområder er beskrevet og etablert. |
| Definere plassering av krav, modeller og kontrakter. | Ferdig: del 2–3 og README-filene beskriver plasseringene. |
| Definere organisering av enhets- og integrasjonstester. | Ferdig: del 4 skiller mellom interne backend-tester og tester på tvers av hoveddelene. |
| Definere plassering av FoM-målinger og testresultater. | Ferdig: del 4 og opprettede resultatmapper. |
| Definere navngivnings- og organiseringsregler. | Ferdig: del 5. |
| Etablere mappestrukturen i GitHub-repositoryet. | Etablert lokalt; endringene må committes og pushes før dette punktet er fullført på GitHub. |
| Dokumentere strukturen og gjennomgå den med gruppen. | Ferdig: gruppens gjennomgang og beslutning er bekreftet 2026-10-23 og innarbeidet her. |
| Dokumentere vesentlige arkitekturvalg i ADR ved behov. | Ferdig: ADR-003 dokumenterer den vedtatte strukturen. |

Dokumentet og den lokale strukturen er ferdige. Ved publisering av endringene kan issue 1.7 oppdateres og lukkes. Dette dokumentet innebærer ikke at endringene allerede er publisert eller at GitHub-issuen er lukket.

Valg av rammeverk, konkret FoM, detaljert testdesign og ferdigstilling av øvrige krav og modeller hører til de tilhørende arbeidspakkene og er ikke nødvendig for å fullføre WBS 1.7.
