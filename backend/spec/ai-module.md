# AI-modulen – krav, modell og testplan for WBS 6.1

**Status:** Ferdigstilt og godkjent av brukeren for [WBS 6.1 / issue #17](https://github.com/Hoglar/mikrobitGames/issues/17), 2026-10-24. Ingen implementasjon eller målinger er gjennomført.

**Kort fortalt:** En lokal modell foreslår lesespørringer og formulerer svar. Tjenestekoden kontrollerer forespørsler, SQL og ressursbruk; PostgreSQL håndhever datatilgangen. Vi velger Ollama med Qwen3-4B-Instruct som første modell å prøve. Brukeren stiller fortsatt frie spørsmål, også på tvers av spill og spillere.

## Grunnlag og krav

[Backend–AI-kontrakten (1.5)](contracts/backend-ai/contract.md) er autoritativ for meldinger, status og feil. [AI–database-kontrakten (1.6)](contracts/ai-database/contract.md) er autoritativ for datatilgang, SQL-kontroll og grenser. [ADR-001](../../spec/decisions/adr-001-direkte-datatilgang-for-ai.md) begrunner direkte lesetilgang. [Datamodellen](models/data-model.md) beskriver rekordhistorikken.

| Kravgrunnlag | Konkret ansvar i AI-modulen | Planlagt kontroll |
| --- | --- | --- |
| AI-001 | Svare kort på norsk ut fra faktiske data. «Min» bruker innlogget `player_id`. Følge spillets enhet og rangeringsretning; forklare manglende grunnlag. | TAI-02, TAI-08 |
| AI-002, AI-005 | Lese alle tillatte spillerdata, spill og historiske rekorder gjennom de tre `ai_read`-visningene. Ingen tilgang til passord, sesjoner eller skriving. | TAI-01, TAI-04, TAI-07 |
| AI-003, AI-007 | Skille `ok`, `no_data`, `cannot_answer` og tekniske feil etter 1.5. Avvise ugyldig input før modellkjøring. | TAI-01, TAI-05 |
| AI-006 | Kontrollere hele SQL-strukturen før utførelse. Ingen shell-, filskrive- eller generelle kodeverktøy for modellen. | TAI-03, TAI-04, TAI-07 |
| AI-004, AI-008 | Ett aktivt spørsmål uten kø; samlet ventefrist 60 s. Én DB-forbindelse, høyst tre spørringsforsøk, 2 s per SQL-spørring og høyst 1 000 rader / 1 MiB per resultat. | TAI-05, TAI-06, TAI-08 |

**Prioritering:** 1. Sikkerhet og faktakorrekthet. 2. Tydelige utfall og stabil drift. 3. Svartid og ressursbruk. Alle planlagte sikkerhetstester skal bestå. Alle faktapåstander i det faste spørsmålssettet skal stemme; avvik rapporteres, også når svaret har riktig format. 60 s er en grense, ikke dokumentert ytelse.

Ett spørsmål behandles selvstendig. Midlertidige modellmeldinger og resultater kan beholdes mens dette spørsmålet behandles, men gjenbrukes ikke i neste spørsmål. Ingen trening, samtalehistorikk eller ekstern AI-tjeneste inngår.

## Komponentmodell

[Komponentdiagrammet](models/ai-components.drawio) viser fem interne komponenter. [Den maskinlesbare modellen](models/ai-components.json) angir ansvar og tillatte avhengigheter som styrende input til implementasjon.

| Komponent | Ansvar |
| --- | --- |
| `transport` | Lokal HTTP-inngang `POST /v1/answer`, streng inn- og utvalidering og avtalte HTTP-feil. |
| `orchestrator` | Styrer ett spørsmål, identitet/spillkontekst, opptattstatus, tidsfrist og forsøksbudsjett. Bevarer backendens `request_id`; modellen får ikke overstyre den. |
| `model_client` | Sender avgrenset kontekst til lokal modell og validerer strukturerte modellmeldinger. Har ingen DB-tilkobling. |
| `read_store` | Eneste DB-adapter. Kjører både faste oppslag og modellens SQL gjennom `query_policy` før parameterbundet lesing som `ai_reader`. Begrenset resultat og opprydding. |
| `query_policy` | Ren kontroll av parset SQL, objekter og tillatte operasjoner etter 1.6. Ingen nettverk eller databaseforbindelse. |

**Normal flyt:** Valider forespørselen → reserver én aktiv plass → kontroller eventuell spill-ID med et fast oppslag → be modellen foreslå relevant SQL → kontroller og kjør SQL → gi resultatet tilbake til modellen → valider og returner svar. Avviste forslag kan korrigeres innenfor samme budsjett. Faste databaseoppslag teller også blant de tre spørringsforsøkene; avviste SQL-forslag teller som forsøk. Maksimalt fire modellkall per spørsmål hindrer ubegrenset korrigering av modellformat. Alle steg deler samme tidsfrist.

Modellen leverer strukturert JSON: enten et spørringsforslag med SQL og separate parametere, eller et svar med status og tekst. Disse interne meldingsskjemaene versjoneres før implementasjonen genereres. SQL er fortsatt upålitelig selv om JSON-formatet er gyldig. Et `ok`-svar om databasedata skal ha et faktisk hentet datagrunnlag; dette alene beviser ikke at tolkningen er riktig.

Modellen får spørsmålet, spiller-ID, eventuell spillkontekst, tillatt databasestruktur og relevante resultater. Store resultater sammenstilles eller avgrenses gjennom nye kontrollerte spørringer innenfor budsjettet. Kontekstoverskridelse skal oppdages; nødvendig datagrunnlag eller sikkerhetsinstruksjoner skal ikke kuttes bort uten varsel. Hvis grunnlaget ikke kan behandles, brukes `cannot_answer`. Teknisk modell- eller databasefeil gir `INTERNAL_ERROR`.

Opptattstatus gjelder hele tjenesten, også dersom klienten slutter å vente. Plassen frigjøres først når pågående arbeid faktisk har stoppet. Fristen i backend beholdes som siste grense. Kjør én tjenesteprosess i første versjon, slik at samtidighetskontrollen ikke ved et uhell blir én plass per prosess.

## Lokal modell og drift

[ADR-006](../../spec/decisions/adr-006-local-ai-runtime.md) fastsetter **Ollama + `qwen3:4b-instruct-2507-q4_K_M`**, og Python for tjenestekoden. Modellvektene er omtrent 2,5 GB; det er ikke det samme som totalt minnebehov. Modellen er en kandidat for maskinen med 16 GB RAM, ikke en dokumentert egnet løsning. GTX 980 og driverstøtte kontrolleres på den faktiske serveren; CPU-kjøring er et alternativ som også må måles. Se [modellpakken](https://ollama.com/library/qwen3:4b-instruct-2507-q4_K_M) og [Ollamas maskinvarestøtte](https://docs.ollama.com/gpu).

Startinnstillinger til utprøving: 4 096 tokens kontekstvindu og høyst 512 genererte tokens per modellkall. Ufullstendig JSON avvises; oppbrukte grenser gir ikke et tilsynelatende komplett svar. Modellen kan byttes gjennom `model_client` uten å endre 1.5. RAM-/GPU-bruk, kvalitet og svartid avgjør videre valg.

AI-tjenesten og modellkjøringen lytter bare lokalt. Ollama bruker `127.0.0.1:11434`; vår tjenestes port velges ved oppsett. Skyfunksjoner deaktiveres, og ingen data sendes til en ekstern modell. Separate, uprivilegerte Linux-brukere brukes for tjenesten og modellkjøringen. Bare AI-tjenesteprosessen får `ai_reader`-hemmeligheten, som brukes av `read_store`; modellkjøringen får ikke lese den. Hemmeligheten sendes aldri i modellkonteksten. Følg fil- og prosessbegrensningene fra 1.6. Logger inneholder ID, varighet og feiltype, uten rå spørsmål, svar eller databaseuttrekk.

## Planlagte tester og forventede resultater

Bruk de samme syntetiske Ada/Nora-dataene som i [databasens testplan](test-plan.md#miljø-og-fast-testgrunnlag). Eksemplene er testtilfeller, ikke en liste over tillatte spørsmål.

| Spørsmål / situasjon | Forventet innhold |
| --- | --- |
| Ada: «Hvordan har jeg utviklet meg i Poengjakt?» | 100 → 120 poeng, forbedring på 20 poeng. Dette gjelder rekorder, ikke alle forsøk. |
| Ada: «Hvordan ligger jeg an mot Nora i Sprint?» | Ada 55 000 ms, Nora 58 000 ms. Ada er 3 000 ms raskere. |
| «Hvilke spill har Nora rekorder i?» med Poengjakt som spillkontekst | Både Poengjakt og Sprint. Konteksten begrenser ikke datatilgangen. |
| «Hva er rekorden til spilleren Ukjent?» | `no_data`, ingen oppdiktet rekord. |
| Spør om forbedring for en spiller med bare én rekord i et separat testoppsett | Beskriv den ene rekorden og manglende sammenligningsgrunnlag; ikke hevde forbedring. |

| Test | Nivå og kontroll | Forventet resultat |
| --- | --- | --- |
| TAI-01 | Enhet/HTTP: felt, typer, Unicode-lengder, ekstra felt, ukjent spill-ID og svarformat. Bruk en kontrollert modelladapter. | Grensene fra 1.5 håndheves. Ugyldig input gir 400 uten modellkall; gyldige forespørsler og svar bevarer riktig ID. |
| TAI-02 | Integrasjon med faktisk lokal modell og testdatabase: spørsmålene over og varierte formuleringer. | Riktige tall, enheter, identiteter og statuser. Sammenlign med uavhengig fasit; identisk ordlyd kreves ikke. |
| TAI-03 | Enhet: SQL-parser og tillatelsesregler, inkludert gyldige JOIN/aggregater, skjult skriving i CTE, flere kommandoer, låsing, forbudte funksjoner og andre skjemaer. | Gyldige lesinger godtas; alle forbudte/ukjente konstruksjoner avvises før DB-kall. Parserfeil gir aldri fri passasje. |
| TAI-04 | Integrasjon: direkte forsøk som `ai_reader`, uavhengig av SQL-filteret, samt skadelige instruksjoner i spørsmål og syntetiske DB-tekster. | Tillatte data kan leses, også inaktive spill. Hemmeligheter og skriving avvises. Data og skjema er uendret. Gjenbruk TDB-05. |
| TAI-05 | Enhet/integrasjon: tomt resultat, avvist SQL, feil modellformat, modell-/DB-brudd og tidsavbrudd. | Skille manglende data, ubesvarbart spørsmål og teknisk feil etter 1.5/1.6. Rydd opp; ikke returner falsk suksess. |
| TAI-06 | Styrt klokke og kontrollerte adaptere: to samtidige kall, langsom modell, avbrudd, forsøksgrenser og resultat-/kontekstgrenser. | Andre kall gir 503 uten kø. Ingen fjerde SQL-spørring eller femte modellkall. Sene svar ignoreres; fortsatt arbeid holder tjenesten opptatt. Ingen skjult avkorting. |
| TAI-07 | Drift/integrasjon: prosessbrukere, lesbare hemmeligheter, skrivbare mapper, lytteadresser og to påfølgende spørsmål. | Modellen har ingen shell-/filverktøy eller DB-hemmelighet. Ingen ekstern AI-trafikk; tidligere spørsmål følger ikke med i neste. Vanlig spill/rekordlagring virker når AI er nede. |
| TAI-08 | Benchmark på hjemmemaskinen: fast spørsmålssett, først kald oppstart separat, deretter tre runder med varm modell. | Lagre alle svartider, feil/tidsavbrudd, faktakorrekthet, RAM-/GPU-bruk og modellversjon. Mål samtidig vanlig rekordlagring mot backendkravene. Ingen ytelse hevdes før måling. |

## Verifisering og videre arbeid

Testing inngår i verifiseringen. Ved implementasjon skal et skript trekke ut komponentavhengigheter fra kildekodens importstruktur og sammenligne med `ai-components.json`. Ren skjema-/konfigurasjonskode holdes utenfor komponentgrafen; nettverk og databasebruk utenfor de angitte adapterne rapporteres. Ukjente eller dynamiske avhengigheter flagges til gjennomgang. Kontroller HTTP-grensesnittet fra den kjørende tjenesten mot 1.5. Modellkontroll alene beviser ikke at SQL-kontrollen blir brukt; TAI-03–04 undersøker dette ved kjøring.

Automatiske kontroller skal kunne kjøres av gruppen uten AI som dommer. Faste JSON-/SQL-/HTTP-regler og strukturerte resultater kan sammenlignes deterministisk. Fri norsk svartekst vurderes også av gruppen mot fasiten, inkludert eventuelle ekstra påstander. Automatisk kontroll av noen tall alene skal ikke rapporteres som full faktaverifisering.

Svartid og andel faktuelt riktige svar i et fast spørsmålssett er mulige bidrag til prosjektets felles FoM. Ingen egen måleserie vedtas her. Den samlede planen, baseline, kommandoer og grafiske arbeidsflyten avklares etter backendplanleggingen, som avtalt i [implementeringsnotatet](implementation-note.md).

Før kodegenerering i WBS 6.2: velg og versjonsfest HTTP-rammeverk, DB-driver og SQL-parser, konkretiser interne meldingsskjemaer og SQL-tillatelseslisten. Lag kontrollgrunnlaget før AI genererer implementasjonen. Faktisk CPU, GPU-minne og driver kartlegges under oppsett; ingen modell lastes ned som del av 6.1.
