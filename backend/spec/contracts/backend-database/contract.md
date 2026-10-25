# Kontrakt mellom Backend API og PostgreSQL

**Arbeidspakke:** [WBS 1.4 / issue #4](https://github.com/Hoglar/mikrobitGames/issues/4)  
**Versjon:** 1.1 – ferdigstilt dokumentasjonsleveranse, 2026-10-23.  
**Status:** Gjennomgått og godkjent av prosjekteier som leveranse for WBS 1.4. Funksjonelle valg og overordnede kvalitetskrav er avklart. Presisering 2026-10-25: sesjonsreglene i del 8 brukes som arbeidsgrunnlag for første backend-implementasjon og tester. Frontendens gjennomføring samordnes gjennom 1.3; formell gruppegodkjenning påstås ikke. Ingen programvare er implementert eller testet som del av denne leveransen.

Les [sammendraget som følger issue #4](README.md) først. Dette dokumentet er den detaljerte spesifikasjonen og kan brukes som oppslagsverk ved implementasjon.

## 1. Formål, omfang og dokumentgrunnlag

Dette dokumentet beskriver datautvekslingen mellom backend og databasen, og skal brukes som grunnlag for senere AI-assistert implementasjon og verifisering. Det omfatter datamodell, tilkobling, operasjoner, tilgangskontroll, feil og kvalitetskrav. HTTP-endepunkter og nettleserens cookie-oppsett tilhører [webapp–backend](../../../../spec/contracts/webapp-backend/README.md).

Dokumentet er hovedinngangen til leveransen. [Datamodellen](../../models/data-model.md) spesifiserer felter og begrensninger, [verifikasjonsplanen](verification-plan.md) beskriver testmuligheter, og [ADR-005](../../../../spec/decisions/adr-005-postgresql.md) begrunner databasevalget. Disse vedleggene utdyper kontrakten uten å definere alternative regler.

Backend og PostgreSQL skal kjøre på samme Parrot Linux-PC med 16 GB RAM og oppgitt diskkapasitet over 1 TB. Ledig plass og nøyaktig prosessor er ikke kontrollert. Forventet bruk er opptil **30 samtidige spillere**. Dette er dimensjonerende belastning, ikke en grense som automatisk avviser spiller nummer 31.

## 2. Avklarte funksjonelle valg

- Spillere oppretter selv konto med brukernavn og passord. Innlogging kreves for spilling og innsending av rekorder.
- Topplister og tidligere rekorder/progresjon er offentlige, også uten innlogging.
- Hvert spill bruker én numerisk resultatverdi med fast enhet. Spillet angir om høyere eller lavere verdi er bedre.
- Bare personlige rekorder per spiller og spill lagres. Første gyldige resultat blir første rekord; senere resultater må være strengt bedre. Tidligere rekorder beholdes. Like og dårligere resultater lagres ikke.
- Topplisten inneholder bare gjeldende rekord per spiller. Like resultater gir delt plassering. Teknisk anbefaling er konkurranserangering som 1, 1, 3, med spiller-ID som stabil sekundær sortering.
- Innloggingssesjoner lagres i databasen. Fornyelse og utløp følger arbeidsgrunnlaget i del 8. Utlogging avslutter den aktuelle sesjonen straks.
- Passordendring krever gyldig innlogging og gjeldende passord. Alle eksisterende sesjoner avsluttes. Automatisk gjenoppretting av glemt passord inngår ikke i første versjon.
- Kontosletting krever gyldig innlogging og bekreftelse av passord. Konto, alle sesjoner og all tilhørende rekordhistorikk slettes samlet.
- Utviklerne administrerer spill. Spill med historikk deaktiveres fremfor å slettes. Spillere kan ikke redigere registrerte rekorder.

Eksempel på poengspill: **100, 80, 120, 110** gir lagret historikk **100, 120** og gjeldende rekord **120**. Eksempel på tidsspill: **60 000, 65 000, 55 000, 58 000 ms** gir historikk **60 000, 55 000 ms** og gjeldende rekord **55 000 ms**.

## 3. Prioriterte kvalitetskrav

Prioritet 1 er dataintegritet og sikkerhet, prioritet 2 er pålitelighet, og prioritet 3 er responstid, ressursbruk og drift. Høyere hastighet kompenserer ikke for brudd på integritet eller tilgangskontroll. Krav-ID-ene videreføres fra arbeidsutkastet.

| ID | Prioritet | Krav og kriterium for verifisering |
| --- | --- | --- |
| DB-001 | 1 | Gyldige referanser, unike brukernavn og gyldige feltverdier. Ingen ugyldig rad i testene; samtidige registreringer med samme normaliserte navn oppretter nøyaktig én konto. |
| DB-002 | 1 | Rekordregistrering, passordendring og kontosletting er atomiske. Samtidige rekorder tilsvarer en gyldig seriell behandling. Ingen delvis lagring eller utilsiktet tap av tidligere historikk. Kontosletting er det avtalte unntaket fra bevaring av historikk. |
| DB-003 | 1 | Innlogging og eierskap kontrolleres av backend. Ingen råpassord eller rå sesjonstoken lagres i database/logger; ingen passordhash eller sesjonsdata i offentlige svar. Databasebrukeren mangler administrator- og skjemarettigheter. Alle negative tilgangstester skal bestås. |
| DB-004 | 2 | Bekreftede lagringer overlever omstart av backend og database når lagringsmediet er intakt. Forventet tap etter omstart er null. Dette er ikke en garanti mot diskhavari. |
| DB-005 | 2 | Databasefeil gir et definert feilutfall, uten falsk bekreftelse på innlogging eller lagring. Forbindelsesbrudd rundt commit kan gi ukjent utfall og håndteres etter del 7. |
| DB-006 | 3 | Ved normalprofilen i del 9 fullføres minst 95 % av kallene innen hver operasjonstype på høyst 200 ms. Ved topper på 30 samtidige forespørsler fullføres alle innen ett sekund. Ingen uventede databasefeil eller dataintegritetsbrudd. |
| DB-007 | 3 | Begrenset ressursbruk og ingen opphopning av forbindelser eller transaksjoner. Anbefalt startbudsjett er fem samtidige databaseforbindelser for API-et totalt og høyst 2 GiB samlet PSS-minne for API og PostgreSQL under testprofilen. Etter avsluttet last skal ingen forespørsler eller åpne transaksjoner bli hengende igjen. |
| DB-008 | 3 | Oppsett, sikkerhetskopiering og gjenoppretting skal kunne gjentas fra dokumenterte steg. Anbefalt driftsmål: sikkerhetskopi minst hver 24. time, sju dagers oppbevaring og gjenoppretting av testdatasettet innen 30 minutter. Gjenopprettede data skal stemme med tidspunktet for kopien. |

DB-006 og prioriteringen er avklart med prosjekteier. Startbudsjett og driftsmål i DB-007–DB-008 er tekniske anbefalinger for gruppens gjennomgang, ikke målte egenskaper. PSS betyr prosessenes proporsjonale andel av minnebruk, slik at delt minne ikke telles fullt flere ganger. CPU-bruk og øvrig serverbelastning rapporteres sammen med målingene.

## 4. Databasevalg og tilkobling

**Valgt database er PostgreSQL.** Transaksjoner, integritetsbegrensninger og separate roller støtter de høyest prioriterte kravene. Detaljert begrunnelse og vurdering mot SQLite finnes i ADR-005.

Følgende er anbefalt oppsett, uten installasjon eller konfigurasjonsendringer i denne leveransen:

| Del | Teknisk anbefaling |
| --- | --- |
| Adresse | `127.0.0.1:5432`, lokal TCP på samme PC. Databasen eksponeres ikke på hjemmenettverk eller internett. |
| Database og skjema | Database `mikrobit_games`, applikasjonsskjema `app`. Egen isolert database til testing. |
| Protokoll | PostgreSQLs egen protokoll gjennom et etablert databasebibliotek. Brukerverdier bindes som parametere; SQL-identifikatorer og sortering velges fra en tillatt liste i backend. |
| Autentisering | Egen rolle `backend_app` med `scram-sha-256`. Tilkoblingshemmeligheten ligger i beskyttet serverkonfigurasjon, ikke i repository, nettleser eller logger. |
| Forbindelser | Gjenbruk gjennom en pool, høyst fem forbindelser totalt for API-prosessene. Ingen permanent forbindelse per spiller. Andre tjenester og administrasjon får separat forbindelsesbudsjett. |
| Tidsavbrudd | Tilkobling: 3 s. Venting på pool: 1 s. Spørring: 1 s. Låsventing: 500 ms. Inaktiv transaksjon: 5 s. Samlet frist for en databaseoperasjon, inkludert eventuelt nytt forsøk: 3 s. |
| Transaksjoner | `READ COMMITTED` med eksplisitt låsing etter del 6. Commit før suksess rapporteres. Rollback og opprydding ved feil. Defekte forbindelser fjernes fra poolen. |

Tidsavbruddene er feilgrenser, ikke tillatte normale responstider; DB-006 gjelder fortsatt. Databasen skal ikke bruke innstillinger som bevisst svekker varigheten til bekreftede commits, eksempelvis deaktivert `fsync` eller asynkron commit for disse lagringene.

SCRAM autentiserer brukeren, men krypterer ikke hele forbindelsen. Denne anbefalingen bygger på loopback på samme maskin. Flytting til annen maskin krever nytt nettverksoppsett og TLS med serververifisering. Separate containere krever tilpasset intern adresse; `127.0.0.1` er ikke automatisk en annen container.

Backend-språk, driver og eventuell ORM velges ved implementasjonsplanlegging. Driveren må støtte PostgreSQL, parameterbinding, transaksjoner, tidsavbrudd og den valgte autentiseringen. Kontrakten krever ikke en ORM og er ikke avhengig av et bestemt rammeverk.

## 5. Datamodell og validering

Den autoritative feltspesifikasjonen og indeksplanen ligger i [datamodellen](../../models/data-model.md). Tabellnavn og datatyper er tekniske anbefalinger som konkretiserer de avklarte behovene.

| Tabell | Innhold og relasjoner |
| --- | --- |
| `players` | Spiller-ID, brukernavn, normalisert unikt brukernavn, passordhash og opprettelsestidspunkt. |
| `sessions` | Hash av tilfeldig sesjonstoken, spiller-ID, opprettelse, siste fornyelse og utløpsgrenser. Én spiller kan ha flere sesjoner. |
| `games` | Spill-ID, navn, resultatenhet, rangeringsretning, tillatt resultatintervall og aktiv-status. |
| `records` | Rekord-ID, spiller-ID, spill-ID, resultatverdi og registreringstidspunkt. Én spiller og ett spill kan ha flere historiske rekorder. |

Alle ID-er er stabile. Alle lagrede tidspunkt settes av serveren og representerer entydige tidspunkt; UTC brukes i utveksling og rapporter. Rekordtidspunktet betyr tidspunktet resultatet ble registrert, ikke en påstand fra nettleseren om når spillet fysisk ble fullført.

Anbefalt første versjon bruker brukernavn på 3–32 tegn fra `A–Z`, `a–z`, `0–9`, `_` og `-`. Store og små bokstaver skiller ikke kontoer. Passord er 12–128 Unicode-kodepunkter; passord normaliseres eller trimmes ikke. Backend håndhever passordlengden før hashing. Argon2id anbefales gjennom et etablert bibliotek, med minimumsparametere etter OWASP: 19 MiB minne, to iterasjoner og parallellitet én. Endelig bibliotek og ytelse dokumenteres ved implementasjon.

Resultater lagres som heltall i spillets enhet, eksempelvis poeng eller millisekunder, innenfor spillets avtalte intervall. Desimaltid representeres dermed presist som millisekunder. Ikke-numeriske verdier, brøker, verdier utenfor intervallet og ukjente/inaktive spill avvises. Spillenes konkrete intervaller settes når spillene registreres. Første versjon støtter ingen sekundær resultatverdi for rangering.

Databasen håndhever feltbegrensninger, unike verdier og fremmednøkler. Backend håndhever innlogging, passordkontroll og regler som avhenger av andre rader, inkludert om resultatet er en ny rekord. Dette skillet skal verifiseres eksplisitt; gyldig format alene beviser ikke at et nettleserrapportert resultat faktisk er oppnådd i et spill.

## 6. Operasjoner, samtidighet og eierskap

Operasjonene er logiske navn i kontrakten, ikke fastsatte HTTP-endepunkter eller funksjonsnavn. Backend må hente spilleridentitet fra gyldig sesjon, aldri stole på en innsendt spiller-ID som autorisasjon.

| Operasjon | Inndata og forutsetning | Resultat og virkning |
| --- | --- | --- |
| Opprette konto | Validert brukernavn og passordhash | Ny spiller-ID. Konflikt ved opptatt normalisert brukernavn. Ingen eksisterende konto endres. |
| Hente innloggingsgrunnlag | Normalisert brukernavn | Spiller-ID og passordhash, kun til backendens autentiseringskode. Ukjent bruker og feil passord gir samme eksterne innloggingsfeil. |
| Opprette sesjon | Vellykket passordkontroll | Ny tokenhash knyttet til spiller, med første utløp etter 259 200 sekunder og absolutt utløp etter 2 592 000 sekunder. Nytt tilfeldig token for hver innlogging. |
| Kontrollere sesjon | Tokenhash og serverens nåtid | Spiller-ID hvis sesjonen finnes og nåtid er strengt før utløp; ellers avvisning. |
| Fornye sesjon | Eksisterende gyldig sesjon og eksplisitt autentisert fornyelsesforespørsel | Oppdater `renewed_at` til serverens nåtid og `expires_at` til det tidligste av nåtid + 72 timer og absolutt utløp. En utløpt eller slettet sesjon gjenopplives aldri. |
| Logge ut | Aktuell sesjon | Sesjonen slettes. Gjentatt utlogging er ufarlig og kan returnere samme vellykkede utfall. |
| Endre passord | Gyldig sesjon, kontrollert gjeldende passord, ny hash | Oppdater hash og slett alle spillerens sesjoner i samme transaksjon. Ny innlogging kreves. |
| Slette konto | Gyldig sesjon og kontrollert gjeldende passord | Slett spiller, alle sesjoner og alle rekorder atomisk. Spilltabellen beholdes. |
| Registrere resultat | Gyldig sesjon, aktivt spill, gyldig resultatverdi | `created` med rekord-ID ved ny rekord, `already_recorded` med eksisterende ID ved tidligere lagret samme verdi, ellers `not_improved`. De to siste utfallene skriver ingen resultatoppføring. |
| Hente toppliste | Spill-ID, side og sidestørrelse | Én gjeldende rekord per spiller med spiller-ID, brukernavn, verdi, enhet, tidspunkt og plassering. Offentlig. Ukjent spill gir `not_found`; kjent spill uten rekorder gir tom liste. |
| Hente personlige rekorder | Spiller-ID, side og sidestørrelse | Gjeldende rekord per spill for denne spilleren. Offentlig. |
| Hente rekordhistorikk | Spiller-ID, spill-ID, side og sidestørrelse | Historikk sortert på registreringstidspunkt og rekord-ID. Offentlig. Ukjent spiller/spill gir `not_found`; ingen historikk gir tom liste. |
| Administrere spill | Separat utvikler-/vedlikeholdsrolle | Opprette spill, endre visningsnavn eller deaktivere/reaktivere spill. Spill uten rekorder kan slettes. Spill med rekorder kan ikke slettes. |

Anbefalt sideinndeling er 30 rader som standard, maksimalt 100 og ikke-negativ sideindeks. Plassering i topplisten beregnes over hele resultatsettet før sideinndeling. Flere sideforespørsler kan vise endringer dersom nye rekorder kommer mellom kallene; en enkelt forespørsel skal være konsistent.

Rangeringsretning, enhet og resultatintervall er uforanderlige etter første lagrede rekord. Et vesentlig endret spill får ny spill-ID. Deaktivering stopper nye resultater; eksisterende topplister og historikk kan fortsatt leses og merkes med spillets status. Brukernavnendring og manuell redigering/sletting av enkeltrekorder støttes ikke i første versjon. Kontosletting er en egen avtalt operasjon.

### Transaksjonsregel for rekordregistrering

1. Start transaksjon og lås den aktuelle spillerraden med `FOR UPDATE`. Dette fungerer også før spillerens første rekord og serialiserer skrivende konto-/rekordoperasjoner for spilleren.
2. Kontroller sesjonen på nytt inne i transaksjonen. Lås deretter spillraden med `FOR SHARE` og kontroller aktiv-status og resultatregler.
3. Undersøk om samme spiller/spill/verdi allerede er lagret. Hvis ja, returner eksisterende rekord. Ellers hent gjeldende beste verdi og sett bare inn dersom resultatet er første eller strengt bedre.
4. Fullfør transaksjonen før resultatet bekreftes. Ingen låser holdes mens brukeren spiller eller mens passord hashes.

Denne løsningen låser per spiller, også på tvers av spill, og er valgt som en enkel anbefaling for 30 spillere. Den skal måles mot DB-006. Operasjoner som låser både spiller og spill, bruker alltid denne rekkefølgen. Spilladministrasjon må låse spillraden før kontroll av historikk og endring, slik at første rekord og endring av spillregler ikke konkurrerer ukontrollert.

Passordendring, kontosletting, sesjonsoppretting, sesjonsfornyelse og utlogging bruker også spillerradlåsen. Når passord er kontrollert før transaksjonen, må backend etter låsing kontrollere at hash/sesjon fortsatt er den samme før endringen eller sesjonsopprettingen fullføres. Fornyelse kontrollerer gyldighet på nytt etter låsing og kan bare oppdatere en fortsatt eksisterende rad. Dette hindrer at parallell fornyelse omgår utlogging eller passordendring. Flere spillere kan behandles parallelt.

## 7. Feil, gjentatte forespørsler og tilgang

| Feilklasse | Betydning og forventet håndtering |
| --- | --- |
| `validation_error` | Ugyldige felt eller resultatverdier. Avvis uten skriving. |
| `conflict` | Opptatt brukernavn eller operasjon i strid med avtalte regler. Eksisterende data beholdes. |
| `unauthenticated` / `forbidden` | Manglende/ugyldig sesjon, feil passordbekreftelse eller manglende rettighet. Ingen beskyttet skriving. |
| `not_found` | Referert spiller eller spill finnes ikke. |
| `database_unavailable` / `timeout` | Forbindelsen eller kapasiteten er utilgjengelig. Rollback når mulig, og ingen suksessbekreftelse. |
| `outcome_unknown` | Forbindelsen brøt sammen etter at commit kan ha skjedd, men før bekreftelsen ble mottatt. Ikke påstå verken sikker lagring eller sikkert fravær av lagring. |

Feiltypene er kontraktens interne utfall. HTTP-status og tekst til brukeren defineres i webapp–backend-kontrakten. Interne feil kan logges med korrelasjons-ID, operasjon og feilklasse, men ikke råpassord, sesjonstoken eller fullstendige spørringsparametere.

Rekordinnsending kan gjentas med samme spiller, spill og verdi etter ukjent utfall. En allerede lagret verdi gir `already_recorded`; en fortsatt forbedring kan lagres; et resultat som i mellomtiden er slått, gir `not_improved`. Dette garanterer ingen duplisert rekord og en konsistent tilstand, men ikke identisk returverdi ved gjentakelse. Gjentatte ikke-rekorder gir ingen lagret spillforsøkshistorikk.

Backend kan gjøre høyst ett nytt forsøk etter kjent rollback ved deadlock, innen samlet frist. Den skal aldri gjenta en skriving blindt etter ukjent commit-utfall. Ved konto-/passord-/slettingsoperasjoner rapporteres ukjent utfall og gjeldende tilstand kontrolleres gjennom ny innlogging/oppslag. En tapt bekreftelse på sesjonsoppretting kan etterlate en ubrukt sesjon som utløper normalt.

### Databasebrukerens anbefalte rettigheter

| Objekt | `backend_app` |
| --- | --- |
| Database og `app`-skjema | `CONNECT` og `USAGE`, ingen oppretting av objekter. |
| `players` | `SELECT`, `INSERT`, `DELETE`; `UPDATE` bare for `password_hash`. |
| `sessions` | `SELECT`, `INSERT`, `DELETE`; `UPDATE` bare for `renewed_at` og `expires_at`. Absolutt utløp og opprettelse kan ikke endres. |
| `games` | `SELECT` og nødvendig kolonnebegrenset `UPDATE` på `is_active` for PostgreSQLs radlåsprivilegium. Backend tilbyr ingen spilladministrasjonsoperasjon til spillere. |
| `records` | `SELECT`, `INSERT`; ingen direkte `UPDATE` eller `DELETE`. Kontosletting rydder via fremmednøkkelens kaskade. |

PostgreSQLs låsende lesing krever oppdateringsprivilegium på minst én kolonne. Rettigheten til `games.is_active` er et bevisst begrenset unntak for `FOR SHARE`, og skal inngå i rettighetsgjennomgangen. Den er ikke en mekanisme som gjør databasebrukeren sikker mot kompromittert backend. Alternativt kan låsingen kapsles i en avgrenset databasefunksjon etter en separat vurdering.

Driftsrollen eier ikke skjema/tabeller, er ikke superbruker og arver ikke migrerings- eller administratorroller. Uønskede tillatelser gjennom `PUBLIC` fjernes, og et kontrollert `search_path` brukes. Migrering og spilladministrasjon bruker separate rettigheter. PostgreSQL skiller backendroller, mens backend håndhever hvilke spillerkontoer en forespørsel kan operere på.

## 8. Autentisering og drift

Backend verifiserer spillerens passord mot lagret Argon2id-hash. Sesjonstoken genereres kryptografisk tilfeldig, anbefalt 32 tilfeldige byte. Bare SHA-256-hash av tokenet lagres. Fast hashing er egnet for disse tilfeldige tokenene, ikke for menneskevalgte passord.

### Fornyelse uten å avbryte spill

Følgende regler erstatter det tidligere forslaget om fast utløp etter innlogging. De brukes i første backend-implementasjon og testgrunnlaget. Frontendforløpet nedenfor er fortsatt del av forslaget i 1.3; denne presiseringen erklærer ikke løsningen implementert eller gruppegodkjent.

- Webappen ber om fornyelse før spillstart og omtrent hvert femte minutt mens spillet er aktivt og spilleren gir input. En åpen, inaktiv fane eller automatisk henting av offentlige topplister skal ikke holde innloggingen ved like. Nettleseren rapporterer aktivitet; backend bruker alltid sin egen tid og kontrollerer sesjonen.
- Backend oppdaterer samme sesjon til `expires_at = min(nåtid + 72 timer, absolute_expires_at)`. Dette er forlengelse av en databasesesjon og trenger ikke et separat refresh-token-system. Cookie-levetiden oppdateres til gjenværende varighet.
- `absolute_expires_at` settes til 30 døgn etter opprinnelig innlogging, slik at en sesjon ikke kan forlenges ubegrenset. Tre og 30 døgn er produkt-/designvalg, ikke tidsgrenser hentet fra en standard. Ved den absolutte grensen kreves passord på nytt.
- På selve utløpstidspunktet er sesjonen ugyldig. Bare en fortsatt gyldig sesjon kan fornyes. Utlogging, passordendring og kontosletting gjelder umiddelbart og kan ikke omgås av fornyelse.
- Hvis utløp eller forbindelsesbrudd likevel oppstår under spilling, skal webappen beholde det pågående spillet og resultatet midlertidig. Før innsending kreves ny innlogging som samme spiller. Resultatet flyttes ikke automatisk til en annen konto. Dette brukerforløpet må også inn i webapp–backend-spesifikasjonen; databasekontrakten gir ingen rett til innsending med utløpt sesjon.

Anbefalt opprydding av utløpte sesjoner er daglig. Utlogging sletter bare aktuell sesjon; passordendring og kontosletting fjerner alle. Fornyelsesreglene bygger på skillet mellom inaktivitetsutløp og absolutt utløp i OWASPs veiledning, men de konkrete intervallene er prosjektets egne valg.

Cookie-, CSRF-, CORS- og registreringsoppførsel følger gjeldende [arbeidsgrunnlag i 1.3](../../../../spec/contracts/webapp-backend/contract.md). De endrer ikke lagringskontrakten. Webappen må håndheve innlogging før spillstart, og backend kontrollerer på nytt ved innsending.

Sikkerhetskopier oppbevares tilgangsbegrenset, med minst én kopi utenfor den aktuelle harddisken. Ved gjenoppretting slettes alle gjenopprettede sesjoner før tjenesten åpnes, slik at gamle innlogginger ikke blir gyldige igjen. En slettet konto kan fortsatt forekomme i eldre sikkerhetskopier i oppbevaringsperioden; gjenopprettingsrutinen må håndtere slettinger etter kopitidspunktet før offentlig åpning. Dette skal dokumenteres ved driftsoppsett.

## 9. Verifisering og måling

Verifikasjonsplanen er et vedlegg med praktiske muligheter for senere arbeid. Hovedprinsippet er at testene bruker kontrakten som fasit, ikke den AI-genererte koden. Kjør ekte backend mot en isolert PostgreSQL-database med riktig driftsrolle. Hent ut faktisk skjema og sammenlign med datamodellen. Kontroller både retursvar og faktiske rader med en uavhengig inspeksjonsforbindelse.

**Enhetstester** undersøker isolert logikk uten PostgreSQL, som rangering, validering og tidsregler. **Integrasjonstester** undersøker virkelig kommunikasjon og lagring. **Verifisering** samler disse testene og modellkontrollen som bevis mot kravene. **FoM** er et valgt tall som måles likt mellom iterasjoner; det er ikke et annet navn på testene. [Arbeidsflyten for iterativ utvikling](../../iterative-development.md) beskriver skillet og bruk av resultatene til neste forbedring.

Nødvendige scenarioer dekker tilkobling, CRUD-operasjonene i del 6, rekorder i begge rangeringsretninger, offentlig historikk, sesjonsutløp, passordendring, kontosletting, spilldeaktivering, samtidighet, omstart, feil og rettigheter. Kontroller utvalgte tester ved bevisste feil i en isolert kopi; testen skal da feile. Ingen test skal merkes bestått bare fordi AI har vurdert sin egen kode.

Anbefalt, reproduserbar belastningsprofil:

| Del | Profil |
| --- | --- |
| Startdata | 1 000 syntetiske kontoer, 10 spill, 10 000 historiske rekorder, begge rangeringsretninger. Tilbakestill samme datasett mellom sammenlignbare kjøringer. |
| Normalbelastning | 30 simulerte spillere, én operasjon per spiller hvert femte sekund, forskjøvet: 6 operasjoner/s. Fordeling: 60 % toppliste med 30 rader, 20 % sesjonsoppslag og 20 % resultatregistrering. |
| Varighet | To minutters oppvarming og 15 minutters måling. Gjenta for å undersøke målevariasjon. |
| Topper | 30 samtidige operasjoner, separat for hver operasjonstype, ti repetisjoner. Både samme og forskjellige spillere brukes ved rekordregistrering. |
| Ressurser | Registrer PSS-minne, CPU, forbindelser, kø og åpne transaksjoner. Etter belastningen skal køen og forespørselstransaksjonene være tomme innen operasjonsfristen på 3 s. |

Responstiden måles fra backend ber om databaseoperasjonen, inkludert poolventing, til data er tilgjengelige eller skriving er bekreftet med commit. Nettlesernettverk, rendering og passordhashing inngår ikke. Komplett innlogging og offentlig trafikk ut over profilen testes separat på API-/systemnivå. Oppgi forsinket eller uteblitt utsending av testkall, slik at køproblemer ikke skjules ved redusert faktisk last.

Rapporter krav-ID, dato, kode- og spesifikasjonscommit, PostgreSQL-versjon, maskinvare, konfigurasjon, øvrig serverbelastning, testdata, forventet/faktisk resultat og PASS/FAIL/SKIPPED/BLOCKED med begrunnelse. Endelig ytelse må måles på hjemmemaskinen. Manglende gjennomføring er ikke bestått test.

Felles krav-FoM og modell-FoM er valgt i [implementeringsplanen](../../implementation-plan.md). Responstid og andel vellykkede operasjoner ved fast last rapporteres fortsatt som benchmark. Sikkerhet og integritet er bestått/ikke bestått-krav. Målepunkter og kurver samles under [prosjektets FoM](../../../../results/fom/README.md).

## 10. Dekning og videre overlevering

| Akseptansekriterier i issue #4 | Dokumentasjon |
| --- | --- |
| Data, CRUD og forventet oppførsel | Del 2, 5–7 og datamodellen. |
| Teknologi, tilkobling, datastruktur og rettigheter | Del 4–8, datamodellen og ADR-005. |
| Prioriterte og målbare kvalitetskrav | Del 3 og 9. Tekniske startbudsjetter er merket som anbefalinger. |
| Testmetode, integrasjon, kvalitetsmåling og FoM | Del 9 og verifikasjonsplanen; felles beregning i implementeringsplanen. |
| Dokumentasjon og arkitekturbeslutninger | Dette hoveddokumentet med lenkede vedlegg ligger i repositoryets arbeidskopi. |
| Gjennomgang og godkjenning av leveransen | Prosjekteier har gjennomgått dokumentpakken og erklært WBS 1.4 ferdig 2026-10-23. |

Ved byggestart konkretiseres gjenstående tekniske anbefalinger, og PostgreSQL-hovedversjon og applikasjonsbiblioteker fastsettes etter [implementeringsplanen](../../implementation-plan.md). Sesjonsreglene i del 8 og gjeldende 1.3 brukes som arbeidsgrunnlag. Senere avtalte endringer skal oppdatere kontrakt og testforventninger sammen. Dokumentasjonsleveransen for WBS 1.4 er ferdig; commit, publisering og lukking av issue #4 håndteres separat.

## 11. Kilder

- PostgreSQL: [forbindelser](https://www.postgresql.org/docs/current/runtime-config-connection.html), [autentisering](https://www.postgresql.org/docs/current/auth-password.html), [transaksjoner](https://www.postgresql.org/docs/current/tutorial-transactions.html), [radlåser](https://www.postgresql.org/docs/current/explicit-locking.html), [databegrensninger](https://www.postgresql.org/docs/current/ddl-constraints.html).
- OWASP: [passordlagring](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) og [sesjonshåndtering](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).
