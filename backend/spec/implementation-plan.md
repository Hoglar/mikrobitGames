# Felles implementeringsplan: database, API og AI

**Status:** Avtalt arbeidsmåte, 2026-10-24. Planen beskriver hele opplegget. Oppdatert 2026-10-25: testpakken har nå enhetstester, integrasjon, benchmark, modelluttrekk, SSH-kjøring og rapportering. Komponentene og engangsoppsettet på Parrot må fortsatt klargjøres før full måling. Ingen produktbaseline eller FoM-måling foreligger.

Database, backend API og AI-tjeneste implementeres samlet fra modellene. [Frontendkontrakten i 1.3](../../spec/contracts/webapp-backend/README.md) brukes som arbeidsgrunnlag her, selv om den fortsatt er merket forslag. Den andre oppgaveeierens formelle godkjenning endres ikke. Kontrollene trenger ikke ferdig nettside eller Micro:bit; samlet systemdemonstrasjon kommer senere.

Se [kort kjøreoversikt](../verification/README.md) og [arbeidsflyten i draw.io](../../docs/presentation/iterative-development.drawio).

## Byggerekkefølge innenfor første bestilling

Krav og design finnes via [leseoversikten](README.md). Trinnene nedenfor organiserer én samlet leveranse av database, API og AI; de er ikke separate AI-forbedringsrunder eller FoM-punkter.

| Trinn | Arbeid | Resultat før neste trinn |
| --- | --- | --- |
| 1. Klargjør | Lås applikasjonsavhengigheter og PostgreSQL-hovedversjon. Konkretiser SQL-tillatelseslisten innenfor 1.6. Følg de interne grensesnittene i `test-runtime.md`. Klargjør serverklonen, tjenestebrukere og målerettigheter etter kjøreguiden. | Dokumenterte valg og gjentakbart oppsett; ingen funksjonskrav utvides. |
| 2. Database | Lag migreringer, begrensninger, roller, AI-visninger og gjenopprettingsrutine etter datamodellen og 1.4/1.6. | Database kan opprettes på nytt og brukes med tjenestenes egne roller. |
| 3. API og rekordflyt | Bygg databaseadapter, konto/sesjoner, rekordlogikk og offentlige oppslag. Koble HTTP-rutene til tjenestene etter 1.3 og komponentmodellen. | Vanlig konto- og rekordflyt kan kjøres uten AI, nettside og Micro:bit. |
| 4. AI og sammenkobling | Bygg SQL-kontroll, leselager, modellklient, styring og intern HTTP-inngang. Koble API-gatewayen til den lokale AI-tjenesten. | Hele backendens avtalte flyt er implementert, med sikkerhets- og ressursgrenser. |
| 5. Lever for måling | Ferdigstill oppstart, DB-timing og dokumenterte kjørekommandoer. Lagre den samlede kodeversjonen og klargjør samme versjon på Parrot. | Brukeren kan kjøre hele testfasen og lagre første målbare baseline. |

Oppstart-/syntakskontroller under bygging er ikke egne målepunkter. Den avtalte testfasen og retting ut fra dens resultater følger arbeidsflyten nedenfor; utviklings-AI starter ikke en serie forbedringer på egen hånd. Offentlig publisering og demonstrasjon med frontend/Micro:bit følger ved systemleveransen.

## Arbeidsflyten – du bestemmer hver runde

1. **Lag kontrollgrunnlaget først.** Versjonsfest fasit, syntetiske testdata, deltester, modelluttrekk, normaliseringsregler og FoM-beregning. Lag kjørbare kontroller og kontroller at de oppdager bevisst innførte feil i egne kontrollfixturer. AI kan hjelpe; fasiten utledes fra kravene, ikke fra implementasjonen som skal vurderes. Kontroller uten ferdig komponent er foreløpig blokkert, ikke bestått.
2. **Bestill første implementering.** Du ber utviklings-AI bygge database, API og AI-tjeneste sammen fra modellene. Lagre kodeversjonen i git og klargjør samme versjon på serverens testoppsett.
3. **Kjør kontrollene selv.** Første fullstendige, målbare kjøring er baseline, før retting ut fra resultatene. Kontroller kan feile og likevel gi et målepunkt. Hvis oppsettet hindrer måling, behold feilrapporten og rett målehindringen; ikke registrer en oppdiktet baseline på 0 %.
4. **Les rapporten.** Verktøyene viser tester, modellavvik, svartider og FoM. De endrer ikke kode og kaller ikke utviklings-AI.
5. **Velg neste steg.** Du bestiller en målrettet retting, avklarer en modellendring, eller stopper. Etter retting lagres ny kodeversjon før du kjører kontrollene igjen.

Oppgaven krever minst **tre målte punkter over tid**, inkludert baseline. Det er ikke tre automatiske AI-runder. Du bestemmer antallet bestillinger og kjøringer; også regresjoner beholdes. Dette erstatter tidligere intern veiledning om baseline pluss tre obligatoriske målepunkter.

## Et lite, fast kontrollsett

[Begrepsforklaringen](iterative-development.md) skiller testing, verifisering, benchmark og FoM. Denne planen er autoritativ for kontrollgruppene, beregningen og reglene for måleserien.

Gjenbruk Ada/Nora-datasettet og scenarioene i [DB-testplanen](test-plan.md), [backendplanen](backend-module.md) og [AI-planen](ai-module.md). De kjørbare deltestene og koblingen til kontrollgruppene er beskrevet i [testoversikten](../tests/README.md). Kontrollgrunnlaget gjennomgås før første implementasjon og fryses for måleserien. Et punkt består bare når **alle** dets avtalte deltester består; ingen delpoeng.

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

**Kjør hele pakken med `./backend/check`.** [Kjøreguiden](../verification/README.md) eier instruksjonene for oppsett, SSH, kodeversjon, kjøremoduser og rapportvisning. [Testgrensesnittene](../verification/test-runtime.md) beskriver hvordan implementasjonen kobles til testpakken.

Hjemmeserveren er målmiljø. Målingene foregår lokalt der, uavhengig av internettforsinkelsen. Testinstansen skal være isolert fra offentlig drift; omstart, sletting og gjenoppretting skal bare berøre testdata. Testkommandoen endrer ikke kode og starter ikke utviklings-AI.

## Rapport og ferdigkriterium

Hver kjøring lagrer maskinlesbare råresultater og en kort lesbar rapport under [backend/results](../results/README.md): status per kontroll, forventet/faktisk resultat, modellavvik og benchmark med tid/enhet, feil, antall forsøk og kald/varm modell. Fullførte målepunkter gir to kurver i samme rapportmappe. Rapporter og kurver som skal versjonsfestes til presentasjonen kopieres til [results/fom](../../results/fom/README.md).

Registrer tidspunkt, kodecommit, kontroll-/spesifikasjonsversjon, datasett, kommando, maskinvare, programvareversjoner og nøyaktig modelldigest, runtime og innstillinger. Behold mislykkede og ufullstendige kjøringer; ingen eksempelverdier skal fremstå som faktiske målinger.

FoM-ene er oversikt, ikke hele godkjenningen. Øvrige krav gjelder fortsatt, blant annet benchmarkmål, offentlig HTTPS, faktiske nettleserkontroller og oppstart etter reboot. Sikkerhetsfeil blokkerer godkjenning uansett FoM. Før levering demonstrerer gruppen også nettside, Micro:bit og database sammen. Du avgjør når resultatene er gode nok til neste steg.
