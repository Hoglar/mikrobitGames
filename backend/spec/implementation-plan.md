# Felles implementeringsplan: database, API og AI

**Status:** Avtalt arbeidsmåte, 2026-10-24. Dette er en plan; kontrollverktøy og komponenter er ikke implementert, og ingen måleresultater foreligger.

Database, backend API og AI-tjeneste implementeres samlet fra modellene. [Frontendkontrakten i 1.3](../../spec/contracts/webapp-backend/README.md) brukes som arbeidsgrunnlag her, selv om den fortsatt er merket forslag. Den andre oppgaveeierens formelle godkjenning endres ikke. Kontrollene trenger ikke ferdig nettside eller Micro:bit; samlet systemdemonstrasjon kommer senere.

Se [kort kjøreoversikt](../verification/README.md) og [arbeidsflyten i draw.io](../../docs/presentation/iterative-development.drawio).

## Arbeidsflyten – du bestemmer hver runde

1. **Lag kontrollgrunnlaget først.** Versjonsfest fasit, syntetiske testdata, deltester, modelluttrekk, normaliseringsregler og FoM-beregning. Lag kjørbare kontroller og kontroller at de oppdager bevisst innførte feil i egne kontrollfixturer. AI kan hjelpe; fasiten utledes fra kravene, ikke fra implementasjonen som skal vurderes. Kontroller uten ferdig komponent er foreløpig blokkert, ikke bestått.
2. **Bestill første implementering.** Du ber utviklings-AI bygge database, API og AI-tjeneste sammen fra modellene. Lagre kodeversjonen i git og klargjør samme versjon på serverens testoppsett.
3. **Kjør kontrollene selv.** Første fullstendige, målbare kjøring er baseline, før retting ut fra resultatene. Kontroller kan feile og likevel gi et målepunkt. Hvis oppsettet hindrer måling, behold feilrapporten og rett målehindringen; ikke registrer en oppdiktet baseline på 0 %.
4. **Les rapporten.** Verktøyene viser tester, modellavvik, svartider og FoM. De endrer ikke kode og kaller ikke utviklings-AI.
5. **Velg neste steg.** Du bestiller en målrettet retting, avklarer en modellendring, eller stopper. Etter retting lagres ny kodeversjon før du kjører kontrollene igjen.

Oppgaven krever minst **tre målte punkter over tid**, inkludert baseline. Det er ikke tre automatiske AI-runder. Du bestemmer antallet bestillinger og kjøringer; også regresjoner beholdes. Dette erstatter tidligere intern veiledning om baseline pluss tre obligatoriske målepunkter.

## Et lite, fast kontrollsett

Testing kjører eksempler med forventede resultater. Verifisering undersøker om krav og modeller er fulgt, blant annet gjennom testing og automatisk modellsammenligning. Benchmark måler eksempelvis svartid. FoM sammenfatter et avgrenset utvalg av resultatene over tid; det er ikke en egen test.

Gjenbruk Ada/Nora-datasettet og scenarioene i [DB-testplanen](test-plan.md), [backendplanen](backend-module.md) og [AI-planen](ai-module.md). Før første implementering lager vi en versjonert kontrolliste med konkrete deltester og forventninger for hvert punkt nedenfor. Listen fryses for måleserien. Et punkt består bare når **alle** dets avtalte deltester består; ingen delpoeng.

### Kravkontroller: fire punkter per område

| ID | Punkt | Grunnlag og sentrale kontroller |
| --- | --- | --- |
| KDB-1 | Dataintegritet | TDB-02–03: CRUD, unike nøkler, feltgrenser og fremmednøkler. |
| KDB-2 | Atomiske endringer og sletting | TDB-04,06: kaskadesletting, beskyttede spill og rollback. |
| KDB-3 | Effektive rettigheter | TDB-05/TAI-04: faktiske DB-roller; avvis hemmeligheter og uautorisert skriving. |
| KDB-4 | Bevaring og gjenoppretting | TDB-07: data etter omstart/gjenoppretting, med avtalte regler for sesjoner. |
| KAPI-1 | Konto og sesjoner | TBE-02: registrering, innlogging, fornyelse, utløp, utlogging, passordendring og kontosletting. |
| KAPI-2 | Rekorder og gjentakelser | TBE-03,05: begge rangeringsretninger, ingen duplikater, samtidighet og ukjent commit-utfall. |
| KAPI-3 | Offentlige oversikter | TBE-04: toppliste, delt plassering, sideinndeling og bevart historikk. |
| KAPI-4 | Ugyldig og uautorisert input | TBE-01,07: kontraktfeil, eierskap, cookie-/CSRF-regler og rategrenser; HTTP-klienten etterligner nettleserforespørsler. |
| KAI-1 | API–AI-meldinger og feil | TAI-01,05/TBE-06: felter, bevart ID, feil, opptatt tjeneste og tidsavbrudd. |
| KAI-2 | SQL-filter | TAI-03: tillatt lesing, avvist skriving, farlige funksjoner og skjulte operasjoner. |
| KAI-3 | Grenser og isolasjon | TAI-06–07: forsøk, tid, samtidighet, resultatstørrelse, prosessrettigheter, ingen samtalehistorikk og vanlig backend når AI er nede. |
| KAI-4 | Faktisk lokal modell | Objektiv del av TAI-02,08: faste spørsmål gjennom virkelig tjeneste mot testdata; status, ID, svarskjema, ikke-tomt svar, lengde og svar innen kontraktens tidsfrist. |

KAI-4 bruker et versjonert spørsmålssett med forventet status per spørsmål. De tre første spørsmålene i AI-planens tabell har data og skal gi `ok`. En kontrollert modelladapter kan ikke bestå dette punktet. Svartider og feil fra kald oppstart og varme runder lagres separat etter TAI-08. En observert overskredet frist er FAIL, ikke en utelatt måling.

Ingen AI brukes som dommer. Disse objektive kontrollene beviser **ikke at alle påstander i fri norsk tekst er riktige**. AI-planens krav om faktakorrekthet består, men fri tekstevaluering inngår ikke som en egen poengsatt vurderingsrunde i FoM. Eventuelle faktuelle feil følges opp selv om formatkontrollene består.

### Modellkontroller: uttrekk mot avtalt fasit

| Område | Faste kontrollpunkter | Fasiten |
| --- | --- | --- |
| Database | De eksisterende 20 strukturkontrollene: tabeller, nøkler og AI-visninger. | [Databaseskjema](models/database-schema.json) og reglene i [testplanen](test-plan.md). |
| Frontend/API | Fire grupper: (1) ruter/metoder, (2) forespørselsskjemaer, (3) svar-/feilskjemaer, (4) deklarert autentisering. | [OpenAPI 1.3](../../spec/contracts/webapp-backend/openapi.yaml), mot kjørende APIs uttrekk. |
| AI og interne grensesnitt | Fire grupper: (1) internt AI-forespørselsskjema, (2) internt svar-/feilskjema, (3) API-komponentavhengigheter, (4) AI-komponentavhengigheter. | [Kontrakt 1.5](contracts/backend-ai/contract.md), [API-modell](models/backend-components.json) og [AI-modell](models/ai-components.json). |

Interne skjemaer trekkes ut fra implementasjonens deklarasjoner, komponentavhengigheter fra kildekoden. Normalisering og håndtering av ukjente/dynamiske avhengigheter fastsettes før baseline; ukjent gir aldri automatisk PASS. Modellsamsvar beviser ikke faktisk tilgangskontroll eller kjøreoppførsel – derfor trengs også testene.

## To FoM-er, lik vekt til de tre områdene

Begge uttrykkes i prosent, hvor høyere er bedre. `K` er antall beståtte kravpunkter og `M` antall beståtte modellpunkter i hvert område:

```text
Krav-FoM   = (100 / 3) × (K_DB / 4 + K_API / 4 + K_AI / 4)
Modell-FoM = (100 / 3) × (M_DB / 20 + M_API / 4 + M_AI / 4)
```

DBs 20 detaljkontroller får dermed ikke større samlet vekt enn de andre områdene. Rapporten viser også delresultater og konkrete avvik; DBs antall strukturavvik fra 0 til 20 beholdes som diagnose.

| Status | Betydning og behandling |
| --- | --- |
| PASS | Utført og forventningen oppfylt. |
| FAIL | Utført, fant avvik. Teller ikke som bestått; nevneren er fast. |
| SKIPPED | Ikke kjørt, for eksempel virkelig modell i hurtigkjøring. Aldri bestått. |
| BLOCKED | Kunne ikke vurderes, for eksempel feil serverversjon eller utilgjengelig modelluttrekk. Behold årsaken. |

Bare en full kjøring der alle faste punkter og deres avtalte deltester kan vurderes som PASS eller FAIL gir et komplett FoM-målepunkt. SKIPPED/BLOCKED gir ufullstendig rapport med delresultater, uten komplett FoM-punkt; de fjernes ikke fra nevneren. En feilet deltest må ikke skjule at andre deltester ikke ble kjørt. Skill observerte produktfeil fra feil i måleoppsettet.

Endret fasit, deltestsett, normalisering eller tellemetode krever **ny merket serie eller ommåling av tidligere commits**. Ikke flytt forventningene for å få grønnere resultater. Miljø-/modellendringer registreres og sammenlignbarhet vurderes før kurver kobles sammen.

## Enkel kjøring fra denne PC-en mot hjemmeserveren

Første implementeringssteg er kontrollverktøyene med disse **planlagte, ennå ikke kjørbare** kommandoene fra prosjektroten:

| Kommando | Virkning |
| --- | --- |
| `./backend/check quick` | Raske kontroller med kontrollerte modelladaptere. Foreløpig rapport, ikke komplett FoM-punkt. |
| `./backend/check full` | Hele kontrollsettet, virkelig lokal modell og benchmarks. Komplett målepunkt når kjøringen er målbar. |
| `./backend/check report` | Vis siste tilgjengelige rapport og kurver. Starter ikke tester eller kodeendringer. |

Hjemmeserveren er målmiljø fra starten. Engangsoppsettet omfatter SSH fra denne PC-en, gjerne over privat Tailscale-nettverk, og egen testinstans av PostgreSQL med separate testtjenester, roller og syntetiske data. Omstart, sletting og gjenoppretting skal ikke berøre offentlig drift. Databaseporter eksponeres ikke på internett. Privat testtilgang er uavhengig av offentlig HTTPS.

Kommandoen kontrollerer at serverens kode samsvarer med valgt git-commit, og stopper tydelig ved mismatch eller lokale endringer som gjør versjonen ukjent. Den oppdaterer eller deployer ikke kode i skjul. Konkrete installasjons-/overføringssteg beskrives når verktøyene lages; hemmeligheter og lokale adresser holdes utenfor git.

Målingene utføres på serveren, og rapportene hentes tilbake til denne PC-en. Internettforsinkelse måles separat fra serverens API-/DB- og modellbenchmark. Én kommando gir én kontrollrunde eller rapportvisning; den starter aldri automatisk utviklings-AI eller rettingsrunde.

## Rapport og ferdigkriterium

Hver kjøring lagrer maskinlesbare råresultater og en kort lesbar rapport under [backend/results](../results/README.md): status per kontroll, forventet/faktisk resultat, modellavvik og benchmark med tid/enhet, feil, antall forsøk og kald/varm modell. Fullførte målepunkter gir to kurver under [results/fom](../../results/fom/README.md).

Registrer tidspunkt, kodecommit, kontroll-/spesifikasjonsversjon, datasett, kommando, maskinvare, programvareversjoner og nøyaktig modelldigest, runtime og innstillinger. Behold mislykkede og ufullstendige kjøringer; ingen eksempelverdier skal fremstå som faktiske målinger.

FoM-ene er oversikt, ikke hele godkjenningen. Øvrige krav gjelder fortsatt, blant annet benchmarkmål, offentlig HTTPS, faktiske nettleserkontroller og oppstart etter reboot. Sikkerhetsfeil blokkerer godkjenning uansett FoM. Før levering demonstrerer gruppen også nettside, Micro:bit og database sammen. Du avgjør når resultatene er gode nok til neste steg.
