# Forslag til prosjektstruktur

**Status:** Forslag til gjennomgang i gruppen. Ikke godkjent eller etablert.

**Arbeidspakke:** [WBS 1.7 – Definere repository- og prosjektstruktur](https://github.com/Hoglar/mikrobitGames/issues/22).

Dokumentet beskriver foreslått organisering av kildekode, krav, modeller, tester og dokumentasjon. Gruppen gjennomgår forslaget før mappene etableres og eksisterende filer flyttes. Mappetrærne nedenfor viser ønsket struktur, ikke dagens innhold.

## 1. Organisering og ansvar

Prosjektet organiseres som ett **monorepo med fem delprosjekter**, tilsvarende systemdelene i C4-modellen. Dette samler kontrakter og dokumentasjon og gjør det mulig å endre et grensesnitt og berørte systemdeler i samme endring.

Separate repositoryer ville gitt mer uavhengig administrasjon, men også mer koordinering av kontrakter, versjoner og dokumentasjon. For denne skoleoppgaven med fem gruppemedlemmer foreslås derfor ett repository.

Hvert delprosjekt samler egne krav, modeller, implementasjon og tester. Gruppen bruker felles regler for plassering og dokumentasjon, mens hver del kan velge teknologi, testverktøy, arbeidsprosess og intern kodestruktur. Inndelingen krever ikke at hvert gruppemedlem bare arbeider med én del.

| Delprosjekt | Ansvar |
| --- | --- |
| `microbit/` | Sensorer, knapper, aktuatorer og enhetens USB-kommunikasjon. |
| `webapp/` | Spill, launcher, dashboard, felles Web Serial-adapter og kommunikasjon med backend. |
| `backend/` | REST API, autentisering, spilldata og kommunikasjon med database og AI-tjeneste. |
| `database/` | Databasestruktur, databaseendringer, testdata og tilgangsrettigheter. |
| `ai-service/` | Lokal AI, håndtering av spillerforespørsler og kontrollert lesetilgang til highscore-data. |

## 2. Foreslått mappestruktur

```text
mikrobitGames/
├── README.md
├── microbit/
├── webapp/
├── backend/
├── database/
├── ai-service/
├── spec/
│   ├── system/
│   │   ├── requirements.md
│   │   ├── models/
│   │   └── verification-plan.md
│   ├── contracts/
│   │   ├── microbit-webapp/
│   │   ├── webapp-backend/
│   │   ├── backend-database/
│   │   ├── backend-ai/
│   │   └── ai-database/
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

Treet angir hvor materialet skal ligge. Kravdokumenter, kontrakter og testplaner fylles ut i sine respektive arbeidspakker. Etablering av strukturen betyr ikke at disse leveransene er ferdige.

### Struktur i hvert delprosjekt

```text
<delprosjekt>/
├── README.md
├── spec/
│   ├── requirements.md
│   ├── models/
│   └── test-plan.md
├── src/
├── tests/
├── verification/
└── results/
```

| Plassering | Innhold |
| --- | --- |
| `README.md` | Ansvar, lenker til relevante kontrakter og etter hvert instruksjoner for oppsett, kjøring og testing. |
| `spec/requirements.md` | Funksjonelle krav og relevante kvalitetskrav for delen. |
| `spec/models/` | Komponentmodeller, datamodeller og andre designmodeller som brukes som grunnlag for utviklingen. |
| `spec/test-plan.md` | Planlagte tester, forventede resultater og hvordan krav og modeller skal verifiseres. |
| `src/` | Implementasjonen, organisert etter ansvar og valgt teknologi. |
| `tests/` | Kjørbare tester av delens funksjonalitet og interne komponenter. |
| `verification/` | Eventuelle skript for modelluttrekk, modellsammenligning og benchmarks. |
| `results/` | Utvalgte testresultater, målinger og uttrekk fra implementasjonen som dokumenterer verifiseringen. |

Databasedelen bruker `migrations/` og `seeds/` i stedet for `src/` til henholdsvis databaseendringer og testdata. Datamodellen ligger under `database/spec/models/`.

Spill og den felles Micro:bit-adapteren tilhører webappen. Detaljert oppdeling av kildekoden bestemmes ved utvikling av hver del. Verktøybestemte plasseringer beskrives i delens README dersom de avviker fra utgangspunktet.

## 3. Felles krav, modeller og kontrakter

**Systemnivå:** Overordnet C4-modell, krav som gjelder hele systemet og samlet verifikasjonsplan lagres under `spec/system/`. Modeller for én systemdel lagres hos den aktuelle delen.

**Kommunikasjonskontrakter:** Hvert av de fem grensesnittene har én autoritativ beskrivelse under `spec/contracts/`. Her lagres også tilhørende meldingsskjemaer og eksempler når disse defineres. Delprosjektene lenker til kontraktene fremfor å vedlikeholde kopier. Endringer gjennomgås av dem som arbeider på begge sider av grensesnittet.

Selve meldingsformatene, API-endepunktene og databasetilgangen defineres i WBS 1.2–1.6. Denne strukturbeslutningen endrer ingen API-er eller kommunikasjonsformater.

**Arkitekturbeslutninger:** ADR-er samles under `spec/decisions/`, også når beslutningen gjelder én del. Delprosjektenes dokumentasjon lenker til relevante ADR-er.

**Utviklingsgrunnlag:** Krav, modeller og kontrakter skal kunne brukes som strukturert input til AI-assistert utvikling. Ved avvik mellom modell og implementasjon dokumenteres avviket, og det vurderes om implementasjonen eller spesifikasjonen skal endres.

## 4. Testing, verifisering og FoM

### Plassering av tester

- Enhetstester og integrasjonstester mellom interne komponenter ligger i delprosjektets `tests/`.
- Tester mellom systemdelene ligger i rotens `tests/integration/`, gruppert etter grensesnitt ved behov.
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

Baseline tas som første aktivitet ved implementeringen, før forbedringsiterasjonene starter. Planlegg baseline og minst tre etterfølgende målepunkter, slik at både oppgavens krav om minst tre datapunkter og issuene om måling over tid dekkes. Regresjoner beholdes i historikken.

Selve FoM-en velges i verifikasjonsarbeidet. Strukturen krever ikke en egen FoM for hver del; lokale målinger kan inngå i den felles måleplanen. Felles dokumentasjon lenker til lokale resultater fremfor å kopiere dem.

## 5. Felles navngivnings- og organiseringsregler

- Bruk engelske mappe- og filnavn med små bokstaver og bindestrek, for eksempel `ai-service` og `test-plan.md`. Behold standardnavn som `README.md` og navn som kreves av verktøy.
- Skriv ny forklarende dokumentasjon på norsk. Eksisterende engelsk dokumentasjon kan beholdes.
- Gi krav stabile identifikatorer: `MB-001`, `WEB-001`, `BE-001`, `DB-001`, `AI-001` og `SYS-001`, med videre nummerering innenfor hver del. Ikke gjenbruk identifikatorer for slettede krav.
- Testbeskrivelser refererer til relevante krav og ved behov kontrakter og modeller. Unngå å kopiere kravteksten inn i flere dokumenter.
- Bruk relative lenker mellom filer i repositoryet og lenker til relevante GitHub-issues for arbeidsoppgaver.
- Navngi ADR-er som `adr-001-beskrivende-navn.md`. Nummeret identifiserer beslutningen, mens dokumentet angir status.
- Hold filer og moduler avgrenset etter ansvar, i tråd med SRP.
- Versjoner utvalgte resultater som underbygger verifisering og FoM. Utelat midlertidige logger, byggartefakter, lokale databaser, modellvekter og hemmeligheter gjennom relevante `.gitignore`-regler når verktøy tas i bruk.
- Bruk syntetiske testdata i repositoryet. Dokumenter nødvendige konfigurasjonsverdier uten å legge inn passord eller andre hemmeligheter.

Hoved-README skal være inngangen til prosjektet og lenke til delprosjektene, felles spesifikasjoner og dette dokumentet. Presentasjon og demonstrasjonsbeskrivelse samles i `docs/presentation/`; store videofiler kan refereres med lenke.

## 6. Etablering etter gruppens gjennomgang

Følgende arbeid gjennomføres etter at gruppen har godkjent forslaget:

1. Opprett de fem delprosjektene og fellesområdene fra mappetreet med korte README-filer som forklarer formålet. Git lagrer ikke tomme mapper. Opprett detaljerte undermapper når de får innhold, og unngå tomme dokumenter som kan forveksles med ferdige spesifikasjoner.
2. Flytt eksisterende filer etter tabellen nedenfor. Behold innhold og beslutningsstatus ved flytting; godkjenning av strukturen godkjenner ikke automatisk andre arkitekturvalg.
3. Opprett ADR-003 med begrunnelse for monorepo, delprosjekter og skillet mellom lokalt og felles materiale. Bruk eksisterende ADR-mal og registrer gruppens beslutning.
4. Oppdater hoved-README, delprosjektenes README-filer og interne referanser til nye plasseringer. Fjern `systemModel/` når filene er flyttet og mappen er tom.
5. Kontroller at filer er bevart, lenker virker og alle materialtypene i issue 1.7 har en entydig plass.

| Dagens plassering | Foreslått plassering |
| --- | --- |
| `systemModel/c4ContainerDiagram.drawio` | `spec/system/models/c4-container.drawio` |
| `systemModel/c4ComponentMicroBit.drawio` | `microbit/spec/models/c4-component.drawio` |
| `spec/decisions/adr-direkte-datatilgang-for-AI.md` | `spec/decisions/adr-001-direkte-datatilgang-for-ai.md` |
| `spec/decisions/microbit-serial-communication-adr.md` | `spec/decisions/adr-002-microbit-serial-communication.md` |
| `spec/decisions/adr-template.md` | Beholdes på samme sted. |

Micro:bit-komponentdiagrammet er tomt ved utarbeidelse av forslaget. Det flyttes som eksisterende plassholder og merkes som ikke påbegynt i delens README; det regnes ikke som en ferdig modell. AI-beslutningen får identifikatoren ADR-001, som issuene allerede refererer til.

## 7. Dekning av akseptansekriteriene i WBS 1.7

Alle punktene nedenfor er foreslått eller planlagt. Tabellen innebærer ikke at gruppen allerede har godkjent dem.

| Akseptansekriterium | Hvor det besvares | Gjenstående før lukking |
| --- | --- | --- |
| Vurdere og velge repository-struktur. | Del 1: monorepo og vurdering av separate repositoryer. | Gruppen vedtar valget. |
| Definere mappeinndeling for hoveddelene. | Del 1–2: fem delprosjekter og fellesområder. | Gruppen godkjenner inndelingen. |
| Definere plassering av krav, modeller og kontrakter. | Del 2–3. | Gruppen godkjenner plasseringene. |
| Definere organisering av enhets- og integrasjonstester. | Del 4. | Gruppen godkjenner skillet mellom lokale og felles tester. |
| Definere plassering av FoM-målinger og testresultater. | Del 4. | Gruppen godkjenner plassering og dokumentasjonskrav. |
| Definere navngivnings- og organiseringsregler. | Del 5. | Gruppen godkjenner reglene. |
| Etablere mappestrukturen i GitHub-repositoryet. | Fremgangsmåte i del 6. | Opprett, flytt, kontroller og få endringene inn i GitHub-repositoryet. |
| Dokumentere strukturen og gjennomgå den med gruppen. | Dette dokumentet. | Registrer gjennomgang og avtalte justeringer i issuen. |
| Dokumentere vesentlige arkitekturvalg i ADR ved behov. | ADR-003 planlagt i del 6. | Skriv og godkjenn ADR-en om repository-struktur. |

Issuen kan lukkes når gruppen har gjennomgått og godkjent strukturen, den er etablert i repositoryet, og README, ADR og dette dokumentet samsvarer med faktisk struktur. Filplasseringer og interne lenker skal være kontrollert.

Valg av rammeverk, konkret FoM, detaljert testdesign og ferdigstilling av øvrige krav og modeller hører til de tilhørende arbeidspakkene og er ikke nødvendig for å fullføre WBS 1.7.
