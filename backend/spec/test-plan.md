# Testplan for databasedelen – WBS 5.1

**Oppfølging 2026-10-28:** DB-struktur, roller og datakrav er uendret. Gjeldende samlet kontrollversjon er 3, med samtaleintegrasjon i API 0.3.0. Statusavsnittet nedenfor beskriver opprinnelig testplan før implementasjon; kjørte målinger finnes i rapportmappene.

**Status:** Samordnet testplan 2026-10-27 for databasekontrakt 1.2, modellformat 2 og API 0.2.0. Testkode/modellverktøy er tilpasset som kontrollversjon 2; se [endringsoversikten](../../spec/contracts/webapp-backend/alignment.md#tilpasning-av-eksisterende-kjørbare-tester). Ingen produktkontroller er kjørt.

## Testing, verifisering og FoM

Se [begrepsforklaringen](iterative-development.md) for skillet mellom testing, verifisering og FoM. Denne planen eier databasens testscenarioer og de 24 strukturkontrollene. Felles beregning og regler for måleserien eies av [implementeringsplanen](implementation-plan.md).

## Miljø og fast testgrunnlag

Bruk en isolert PostgreSQL-testdatabase med samme hovedversjon som drift. Bygg den fra migreringene. Oppsettsrollen klargjør og inspiserer; `backend_app` og `ai_reader` brukes til å teste faktisk tilgang. Omstart og gjenoppretting kjøres i en egen testinstans. Hvert scenario starter fra samme datasett, slik at endringer fra én test ikke påvirker neste.

To syntetiske spillere, **Ada** og **Nora**, får hver sin sesjon. Brukernavn lagres med vist bokstavstørrelse; `username_key` skal bli `ada` og `nora`. Hasher er gyldige testverdier; ingen ekte brukere eller hemmeligheter inngår. Seedene får faste UUID-er og versjoneres ved implementasjon.

| Spill | Regel og grenser | Adas rekordhistorikk | Noras rekordhistorikk |
| --- | --- | --- | --- |
| Poengjakt | `points`, høyest er best, 0–100 000 | 100, 120 | 110, 115 |
| Sprint | `milliseconds`, lavest er best, 1–3 600 000 | 60 000, 55 000 | 65 000, 58 000 |

Første og andre rekord registreres henholdsvis `2026-10-01T12:00:00Z` og `2026-10-02T12:00:00Z`. Begge spill er aktive. Sesjonene opprettes på første tidspunkt og fornyes på det andre; `expires_at` er `2026-10-05T12:00:00Z` og absolutt utløp `2026-10-31T12:00:00Z`. Tester av gyldighet bruker styrt klokke.

Dette er tidseksempelet for styrt klokke. Kjørende integrasjonstester oppretter gyldige sesjoner relativt til testtidspunktet etter [testgrensesnittenes regler for data og tid](../verification/test-runtime.md#data-og-tid), slik at testene også kan kjøres etter eksempeldatoene.

**Fasit:** To spillere, to sesjoner, to spill, åtte fullførte forsøk og åtte rekordrader. Hver seedet rekord har et tilhørende forsøk med record_outcome=created og riktig record_id; forsøket får samme registreringstid som rekorden. Ada leder begge spill med henholdsvis 120 poeng og 55 000 ms. Offentlig rekordhistorikk inneholder åtte rader; hvert privat konto-oppslag viser bare eierens fire forsøk. Utvid separate scenarioer med like/dårligere og ufullførte forsøk uten å endre fasiten for AI-rekordspørsmålene.

## Testscenarioer

| ID | Kontroll | Forventet resultat |
| --- | --- | --- |
| TDB-01 | Opprett database fra migreringer og trekk ut faktisk modell. | Fem tabeller og tre AI-visninger med struktur som i fasiten nedenfor. Oppsett kan gjentas på en ny testdatabase. |
| TDB-02 | CRUD med `backend_app`: opprett en ny testspiller, les den, oppdater passordhash og slett spilleren. Les også historikk og topplister fra det faste datasettet. | Hvert tillatt trinn lykkes og bekreftes gjennom en separat inspeksjonsforbindelse etter commit. Historikk og rangering stemmer med fasiten. |
| TDB-03 | Prøv duplikatbrukeren `ADA`, duplisert rekordverdi for samme spiller/spill, duplisert spiller/forsøks-ID, manglende fremmednøkler, NULL i obligatoriske felt og ugyldige radlokale feltverdier etter datamodellen. | Hvert ugyldig innslag avvises. Kontroller også tom passordhash, ugyldig rangeringsretning, resultat utenfor heltallsgrensen, feil tokenhash-lengde og ugyldige sesjonstider. Gyldige grenseverdier godtas. attempts.value og record_id kan være null bare etter status-/utfallsreglene. To forskjellige forsøk med samme verdi godtas; completed/null og incomplete/record_id avvises. |
| TDB-04 | Slett Ada som `backend_app`. Prøv separat å slette et spill med rekorder som oppsettsrollen. | Ada, hennes sesjon, fire forsøk og fire rekordrader slettes samlet. Nora, hennes fire forsøk, fire rekorder og begge spill beholdes. Sletting av et spill med rekorder avvises av fremmednøkkelen. Gjenta for et spill med bare et ufullført forsøk: sletting avvises også da. |
| TDB-05 | Kontroller visningsdata og effektive rettigheter direkte som `ai_reader` og `backend_app`, etter rettighetsreglene i 1.4 og 1.6. | AI ser alle tillatte rader og felter, også etter at et spill deaktiveres. Direkte tilgang til grunntabeller, passordhash, sesjoner, private forsøk (også egne), skriving, objektoppretting og rollebytte avvises for AI. Backend får bare sine avtalte rettigheter. Test uten å støtte deg på AI-filteret eller `READ ONLY`. |
| TDB-06 | Gjør flere endringer i én transaksjon og fremprovoser en feil før commit. | Rollback gjenoppretter den opprinnelige tilstanden uten delvise endringer. En tilsvarende vellykket transaksjon blir synlig etter commit. Samtidighet og ukjent commit-utfall testes videre gjennom backend etter 1.4. |
| TDB-07 | Lagre og bekreft data, start testinstansen på nytt, og test separat sikkerhetskopi/gjenoppretting. | Omstart bevarer de bekreftede dataene. Gjenopprettede data stemmer med kopitidspunktet; gjenopprettede sesjoner fjernes som bestemt i 1.4. Gjenopprettingstid registreres. |
| TDB-08 | Benchmark faste lese- og skriveoperasjoner med versjonerte testdata. | Rapporter responstid, feil og miljø. Test også AI-spørringenes tids- og resultatgrenser sammen med AI-tjenesten. Full belastningsprofil fra DB-006 gjennomføres ved backend-integrasjon etter VDB-10 i 1.4. |

`CHECK`-begrensninger og rettigheter trekkes ut og gjennomgås mot datamodellen og kontraktene i tillegg til de praktiske forsøkene. Databasetestene bruker reelle forbindelser. Enhetstester for rekordlogikk og SQL-filter tilhører henholdsvis backend- og AI-arbeidet. Selve modellkontrollverktøyet bør enhetstestes med kjente avvik, som feil datatype, manglende fremmednøkkel og en uventet kolonne.

## Deterministisk modellkontroll og bidrag til FoM

[database-schema.json](models/database-schema.json) er den versjonerte forventningen, basert på den avtalte modellen og tilgangskontrakten. Den beskriver felter, nøkler, genererte kolonner og visninger; den er ikke en migrering. Fasiten skal ikke hentes fra de genererte migreringene. `CHECK`-regler, effektive rettigheter og forretningsoppførsel kontrolleres gjennom TDB-03–07 og inngår ikke i tallet nedenfor.

Ved implementasjon henter et skript faktisk struktur fra PostgreSQLs `information_schema` og systemkataloger. Normaliser rekkefølge, automatisk navngitte begrensninger og tilsvarende datatypenavn, for eksempel `int8`/`bigint`. Genererte uttrykk og visningsdefinisjoner sammenlignes strukturelt etter dokumenterte normaliseringsregler. Uavklarte forskjeller rapporteres til gjennomgang.

**DB-diagnose: antall modellkontroller med avvik, fra 0 til 24. Lavere er bedre.** Antall beståtte punkter inngår i felles modell-FoM etter [implementeringsplanen](implementation-plan.md). Kontrollsettet er nytt og må versjoneres separat fra tidligere 20-kontrollserie:

- Fire kontroller for hver av fem tabeller: (1) nøyaktig feltsett, typer, NOT NULL og genererte uttrykk; (2) primærnøkkel; (3) fremmednøkler med slettingsregler; (4) øvrige unike nøkler. Det gir 20 kontroller (MDB-1–20 i rekkefølgen players, sessions, games, records, attempts).
- Én kontroll per AI-visning: nøyaktig kilde og feltprojeksjon, uten ekstra koblinger, filtrering eller endring av verdier. Det gir tre kontroller (MDB-21–23). Felttypene følger kildekolonnene; JSON-fasitens eksplisitte `not_null_columns` gjelder hver grunntabell (modellformat 2).
- Én kontroll av tabell- og visningssettet: bare de fem avtalte tabellene i `app` og de tre visningene i `ai_read`. Denne kontrollen er MDB-24. Migreringsverktøyets metatabeller plasseres utenfor disse skjemaene.

Hvert kontrollpunkt gir 0 når det samsvarer og 1 ved avvik, uansett antall detaljer i avviksrapporten. Manglende tabeller gir avvik på alle deres fire punkter; manglende visninger gir avvik på sine punkter. Feil ved tilkobling eller ufullstendig uttrekk gir «ikke målbart», aldri null avvik. Uttrekket må kjøres med tilstrekkelige inspeksjonsrettigheter.

Hvordan de 24 kontrollene vektes sammen med API og AI, og hvordan baseline og regelendringer håndteres, er definert i [implementeringsplanen](implementation-plan.md).

Null modellavvik betyr at disse 24 strukturkontrollene samsvarer. Dataintegritet, rettigheter og ytelse vurderes gjennom sine egne tester. Benchmark beholdes uansett valg av FoM.

## Gjennomføring og rapportering i 5.2

Før kodegenerering gjennomgås fasit og forventede resultater. Første implementering av database, API og AI bestilles samlet etter felles plan; senere rettinger bestilles ut fra rapporterte avvik. Ved avvik undersøkes årsaken før kode eller spesifikasjon endres; modellkontrollen skal ikke godta implementasjonen bare fordi AI foreslår det.

Lagre dato, kodecommit, spesifikasjonsversjon, PostgreSQL-versjon, datasett, miljø, kommando og forventet/faktisk resultat. Bruk PASS/FAIL/SKIPPED/BLOCKED etter felles plan, med begrunnelse. For benchmark dokumenteres også antall målinger, oppvarming, arbeidslast, målegrense og øvrig belastning. Måling av en SQL-spørring alene dokumenterer ikke backendens fulle responstidskrav.

Kjørbare tester legges under [backend/tests](../tests/README.md), modelluttrekk og benchmarks under [backend/verification](../verification/README.md), og rapporter under [backend/results](../results/README.md). Felles fremgangskurve samordnes under [results/fom](../../results/fom/README.md).
