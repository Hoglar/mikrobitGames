# Verifikasjonsplan for backend–database

**Status:** Planlagt verifisering under WBS 1.4. Ingen tester, testverktøy eller målinger er implementert eller gjennomført gjennom dette dokumentet.

## Grunnlag og formål

Planen bruker [kontrakten](contract.md), særlig DB-001–DB-008, og [datamodellen](../../models/data-model.md) som fasit for AI-generert backend-kode og databaseskjema. Før en test implementeres, skal forventet resultat kunne utledes fra spesifikasjonen. Uavklarte regler skal markeres som uavklarte, ikke gis en fasit basert på hva den genererte koden tilfeldigvis gjør. Revidert 2026-10-27 for databasekontrakt 1.2 og privat forsøkshistorikk. Kjørbar testtilpasning er listet i [samordningsoversikten](../../../../spec/contracts/webapp-backend/alignment.md#tilpasning-av-eksisterende-kjørbare-tester). Sesjonstestene følger arbeidsgrunnlaget i kontraktens del 8. Senere regelendringer håndteres etter [implementeringsplanen](../../implementation-plan.md).

Det skal kontrolleres både at backend og database kan kommunisere, og at resultatet av kommunikasjonen samsvarer med kontrakten. Vellykket tilkobling alene viser ikke korrekt datalagring, tilgangskontroll eller transaksjonshåndtering.

## Enhetstester uten database

Enhetstester undersøker avgrenset backend-logikk med faste inndata og forventede utdata. De trenger ingen PostgreSQL-server. De skal være egne tester, selv om samme regel også undersøkes gjennom integrasjon. Dette er en plan for senere tester, ikke implementert testkode.

| ID | Logikk | Eksempel på forventet resultat | Krav/regel |
| --- | --- | --- | --- |
| UDB-01 | Sammenligne resultat med gjeldende rekord | 120 forbedrer 100 ved høyest-best; 55 000 forbedrer 60 000 ved lavest-best. Lik verdi er ingen forbedring; manglende tidligere rekord håndteres. | DB-002, kontrakt del 2 |
| UDB-02 | Validering av resultat | Fullførte forsøk krever gyldig heltall på spillets grenser. Ufullførte godtar null eller sikker ikke-negativ delverdi uavhengig av sluttresultatgrensene. Brøker og ugyldig type avvises; spillets intervall gjelder bare fullførte sluttverdier. | DB-001 |
| UDB-03 | Normalisering av brukernavn | `Spiller_1` og `spiller_1` gir samme navnenøkkel. Ugyldige tegn/lengder avvises. Databasens faktiske unikhetsregel testes separat. | DB-001 |
| UDB-04 | Sesjonstider med styrt klokke | Godta rett før utløp; avvis på og etter utløp. Fornyelse følger 72-timersregelen og overskrider aldri absolutt grense. Utløpt sesjon kan ikke fornyes. | DB-003, sesjonsregler i del 8 |
| UDB-05 | Feiloversettelse og beslutning om nytt forsøk | Kjent rollback kan gi et begrenset nytt forsøk; ukjent commit gir ikke blind gjentakelse. Unikhetskonflikt oversettes til konflikt uten lekkasje av spørringsparametere. | DB-005 |

Enhetstester kan bruke en kontrollert klokke og enkle testdobler ved avhengigheter. Testene skal ikke erstatte funksjonen som faktisk undersøkes med en testdobbel. Testdekning alene viser ikke at kravene er oppfylt.

## Testmiljø

- Opprett en isolert PostgreSQL-testdatabase med samme hovedversjon og relevante innstillinger som planlagt drift. Bruk en egen instans til omstart og feilinjeksjon dersom andre databaser ellers ville blitt påvirket.
- Bygg databasen fra prosjektets versjonerte migreringer, og legg inn syntetiske, reproduserbare testdata. Test oppgradering fra tidligere skjema når slike versjoner finnes.
- Kjør den virkelige backend-koden med valgt driver, tilkoblingspool og runtime-databasebruker. Administratorrettigheter brukes bare til oppsett, opprydding og inspeksjon når nødvendig, ikke som backendens rolle under test.
- Integrasjonstestene bruker en ekte PostgreSQL-forbindelse. Enhetstestene over inngår i testplanen, men teller ikke som bevis på at koblingen fungerer.
- Backend-operasjonene testes uten å kreve ferdig frontend eller fysisk Micro:bit. HTTP-kall brukes der innlogging og spilleridentitet skal testes på API-grensen; direkte kall til backendens datatilgang brukes der selve databaseoperasjonen er målepunktet.

## Kontroll av datamodellen

Trekk ut tabeller, kolonner, datatyper, nullbarhet, primærnøkler, fremmednøkler, unikhetsregler og sjekkbegrensninger fra den opprettede databasen. Sammenlign med en strukturert forventning som er gjennomgått mot datamodellen og kontrakten, uavhengig av migreringskoden.

PostgreSQLs [information_schema](https://www.postgresql.org/docs/current/information-schema.html) beskriver databaseobjekter. PostgreSQL-spesifikke egenskaper, som enkelte indeksdetaljer, må hentes fra systemkatalogene. Normaliser uttrekket før sammenligning, slik at tilfeldig rekkefølge og automatisk genererte navn ikke gir falske avvik. Bruk inspeksjonsrettigheter som gir et fullstendig uttrekk; test effektive runtime-rettigheter separat.

Faktisk rettighetskontroll skal omfatte rollemedlemskap og tillatelser som arves, også fra `PUBLIC`. At en rolle har forventede eksplisitte tillatelser, er ikke nok dersom den samtidig arver for vide rettigheter.

## Testscenarioer og forventede bevis

| ID | Kontroll | Forventet resultat/bevis | Krav |
| --- | --- | --- | --- |
| VDB-01 | Tilkobling med riktig konfigurasjon, deretter feil passord og feil databasenavn | Gyldig oppsett kobler til som riktig rolle i riktig database. Ugyldig oppsett avvises med definert feil. Bekreft at backend ikke bruker administratorrollen. | DB-003, DB-005 |
| VDB-02 | Modelluttrekk og uavhengige forsøk på ugyldige referanser og duplikater | Strukturen samsvarer med modellen. Databasens egne begrensninger avviser ugyldige data også når forsøket ikke går gjennom backendens validering. | DB-001 |
| VDB-03 | Opprette konto og logge inn med riktig og feil passord | Én konto opprettes, passordhash lagres, vellykket innlogging gir sesjon, og feil innlogging gir ingen sesjon. Inspiser database og svar separat. | DB-001, DB-003 |
| VDB-04 | Personlige rekorder og toppliste med kjente data | For poengspillet gir sekvensen 100, 80, 120, 110 fire private forsøk og rekordhistorikken 100, 120. En annen spiller med 115 plasseres etter spilleren med 120. For tidsspillet gir 60 000, 65 000, 55 000, 58 000 fire private forsøk og rekordhistorikken 60 000, 55 000. | DB-001–DB-002 |
| VDB-05 | Beskyttede operasjoner og sesjonsgrenser | Offentlig toppliste og rekordhistorikk kan leses uten innlogging. Privat forsøkshistorikk krever eierens sesjon; annen eiers ID gir 404, og AI-rollen får ingen tilgang. Registrering uten gyldig sesjon og forsøk på å overstyre spilleridentitet avvises. Kontroller grensene for gjeldende utløp med styrt klokke. Utlogging gjør sesjonen ugyldig straks. | DB-003 |
| VDB-06 | Samtidige konto- og rekordregistreringer | Nøyaktig én konto per normalisert brukernavn. Rekordhistorikken tilsvarer en tillatt seriell rekkefølge, uten duplikater eller tap av tidligere bekreftet historikk. | DB-001–DB-002 |
| VDB-07 | Avbrudd under en flertrinnsoperasjon, database utilgjengelig og forbindelsesbrudd rundt commit | Ingen delvis lagring. Ingen falsk suksessmelding. Ukjent utfall håndteres etter kontraktens del 7; samme spiller/forsøks-ID/body gir ikke duplisert forsøk eller rekord. Ulike ID-er med lik verdi gir ulike forsøk, og endret innhold under samme ID gir konflikt. | DB-002, DB-005 |
| VDB-08 | Omstart av backend og database etter bekreftet lagring | Uavhengig lesing viser de samme bekreftede rekordene og relasjonene etter omstart. | DB-004 |
| VDB-09 | Runtime-rolle forsøker administrator- og skjemaoperasjoner; offentlige svar og logger inspiseres | Forbudte operasjoner avvises. Ingen råpassord eller rå sesjonstoken i lagring/logger, og ingen passordhash eller sesjonsdata i offentlige svar. | DB-003 |
| VDB-10 | Avtalt belastningsprofil for 30 spillere og samtidige topper | Responstid og feilandel sammenlignes med DB-006. Forbindelser, minne og køer måles mot ferdigstilte grenser i DB-007. | DB-006–DB-007 |
| VDB-11 | Sikkerhetskopiering og gjenoppretting i en separat testdatabase | Kontoer, spill og rekordhistorikk samsvarer med kopitidspunktet. Gjenopprettede sesjoner fjernes før åpning. Tid måles mot det foreslåtte driftsmålet i kontrakten. | DB-008 |
| VDB-12 | Passordendring, feil passordbekreftelse og konkurrerende innlogging | Feil bekreftelse endrer ingenting. Vellykket endring oppdaterer hash og fjerner alle sesjoner samlet; gammel passordkontroll kan ikke gi en ny sesjon etter endringen. | DB-002–DB-003 |
| VDB-13 | Kontosletting og avbrudd under sletting | Vellykket sletting fjerner konto, sesjoner, forsøk og rekorder, men ikke spill eller andre spillere. Rollback etterlater ikke delvis slettede data. | DB-001–DB-003 |
| VDB-14 | Spilladministrasjon og rekordhistorikk | Deaktivert spill avviser nye resultater, men historikken kan leses. Spill med forsøk eller rekorder kan ikke slettes eller få nye enheter/rangeringsregler/intervaller. Identisk omforsøk etter deaktivering bekrefter den tidligere lagringen. | DB-001–DB-003 |
| VDB-15 | Fornyelse før utløp, samtidig fornyelse/utlogging og absolutt grense | Gyldig sesjon forlenges med samme identitet innenfor absolutt grense. Slettet/utløpt sesjon gjenopplives ikke. Oppdatering rulles tilbake ved feil. | DB-002–DB-003, sesjonsregler i del 8 |

Ved VDB-04 kontrolleres både backendens returverdi og faktiske rader gjennom en separat inspeksjonsforbindelse etter commit. Testen skal ikke bare bruke samme lese- og skrivekode som kan dele en feil. De konkrete talleksemplene er testfasit og skal ikke beregnes med backendens egen rangeringsfunksjon.

Ved VDB-06 kan konkurrerende resultater gi ulik gyldig historikk avhengig av behandlingsrekkefølgen. Hvis 150 behandles før 120, lagres begge forsøk, men 120 skal ikke legges til som ny rekord. Samtidig identisk forsøks-ID/body gir én forsøksrad; konkurrerende forskjellig body under samme ID gir én lagring og én konflikt. Testen skal derfor kontrollere en lovlig seriell rekkefølge og korrekt beste resultat, ikke kreve én tilfeldig bestemt historikk. Bruk synkronisering i testen for å fremprovosere konkurransen og gjenta med flere avtalte rekkefølger.

VDB-12–VDB-14 dekker oppdatering og sletting. Tersklene for ressurser og gjenoppretting er tekniske anbefalinger i kontrakten og må bekreftes ved gjennomgang. Det avtalte testgrunnlaget versjoneres før måling. Brukerforløpet som bevarer et resultat ved utløp og krever ny innlogging som samme spiller, testes senere sammen med webappen; en databasetest alene verifiserer ikke dette.

## Uavhengig fasit og kontroll av testene

AI kan brukes til å skrive både kode og tester. Det avgjørende er at forventningene er hentet fra gjennomgåtte krav, ikke fra implementasjonen. Testene skal ikke godkjennes bare fordi AI erklærer at de dekker kontrakten.

- Gjennomgå koblingen mellom hvert testscenario, krav-ID og konkret forventet resultat.
- Hold testdata og fasit enkle nok til at mennesker kan kontrollere dem, som tallsekvensene i VDB-04.
- Som ekstra kvalitetskontroll kan et lite utvalg tester prøves med bevisste feil i en isolert kopi: snu rangeringsretningen, fjern en unikhetsbegrensning eller hopp over utløpskontrollen. De relevante testene skal da feile. Dette er en mulighet for senere arbeid, ikke et krav om å bygge et omfattende mutasjonstestverktøy nå.
- Ved avvik avgjøres det om kode eller kontrakt er feil. Endring av kontrakten må begrunnes og gjennomgås; forventet resultat skal ikke bare justeres for å få en grønn test.

## Rapportering og akseptanse

Hvert scenario rapporterer krav-ID, dato, commit for kode og spesifikasjon, testmiljø, metode, forventet og faktisk resultat samt **PASS**, **FAIL**, **SKIPPED** eller **BLOCKED** med årsak. Manglende implementasjon eller uavklart forventning er ikke bestått verifikasjon.

Korrekthets- og sikkerhetstester må bestås før målt ytelse kan brukes til å hevde at kontrakten er oppfylt. Målinger rapporterer observasjonsantall og feil separat. Resultater fra en utviklermaskin dokumenterer ikke automatisk kapasiteten på hjemmemaskinen; endelig ytelsesmåling utføres på det avtalte driftsmiljøet med beskrevet øvrig belastning.

Tester gir etterprøvbare bevis for scenarioene og miljøet som er undersøkt, ikke en garanti for alle mulige feil. Kontrakten kan først regnes som verifisert innenfor dette omfanget når nødvendige regler og terskler er fastsatt, alle påkrevde scenarioer er bestått, og uavklarte avvik er behandlet.

## FoM og utviklingsiterasjoner

FoM er ikke et eget testnivå. Enhetstester og integrasjonstester gir bestått/ikke bestått for konkrete krav; modelluttrekk og gjennomgang inngår i den samlede verifiseringen. En valgt FoM beskriver en målt egenskap over tid. [Veiledningen for iterativ utvikling](../../iterative-development.md) beskriver baseline, AI-generering, tester, verifisering, måling, analyse og neste forbedring. Målemetoden holdes stabil, og testfeil rapporteres ved siden av FoM.

## Plassering og senere gjennomføring

- Kjørbare enhetstester: [backend/tests/unit](../../../tests/unit/README.md).
- Kjørbare tester: [backend/tests/integration](../../../tests/integration/README.md).
- Modelluttrekk, sammenligning og måleverktøy: [backend/verification](../../../verification/README.md).
- Rapporter, uttrekk og måleresultater: [backend/results](../../../results/README.md).

Ved senere implementasjon bør funksjonelle tester og modellkontroll kjøres ved relevante endringer i backend, migreringer og kontrakt. Omstart, feilinjeksjon og ytelsesmålinger kjøres i et isolert miljø etter en dokumentert plan. Nå leveres bare spesifikasjonen av denne verifiseringen.

## Tillegg: private forsøk og rekordeffekt

- Ufullførte forsøk med null eller høy delverdi lagres privat med `not_eligible`; rekordhistorikk/toppliste forblir uendret. Gjenta uten noen tidligere rekord: `current_record` er null.
- Nye forsøk med identisk gammel rekordverdi gir 201/`already_recorded`. Identisk ID/body gir 200 med opprinnelig utfall/referanse, selv etter ny bedre rekord; bare `current_record` oppdateres i svaret.
- Feil mellom rekordinnsetting og forsøksinnsetting ruller tilbake begge. Kontosletting mot innsending etterlater ingen foreldreløse eller delvis slettede rader.
- Privat liste filtreres før telling/sideinndeling og sorteres nyeste først. Test sidestørrelse, tom side, ukjent spillfilter og annen eiers enkeltforsøk.
