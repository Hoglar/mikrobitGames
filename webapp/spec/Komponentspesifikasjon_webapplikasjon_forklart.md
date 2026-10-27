# Komponentspesifikasjon – Webapplikasjon

**Status:** Samordnet revisjon 2026-10-27 etter brukerens avklaringer. Implementasjon og produktverifisering gjenstår. [Konflikter og beslutninger](../../spec/contracts/webapp-backend/alignment.md).
**Formål:** Strukturert input til AI-assistert utvikling og verifisering.
**Omfang:** Frontendens komponenter (C4 nivå 3) og deres forbindelser til Backend API og fysisk Micro:bit.

## 1. Overordnet beskrivelse

Webapplikasjonen er en spillplattform hvor brukere kan registrere seg, logge inn, velge mellom tilgjengelige spill, spille ved hjelp av Micro:bit og se egne resultater. Brukeren kan også se kontoinformasjon, endre passord, slette kontoen og bruke en AI-chat til å stille spørsmål om spillresultater og sammenligninger.

**Viktig krav:** Alle ordinære spill som tilbys i launcheren, **krever at Micro:bit er tilkoblet før spillstart**, og skal kunne styres med Micro:bit. Spillplattformen skal tilby et felles grensesnitt for Micro:bit-input slik at hvert spill ikke trenger å håndtere selve tilkoblingen.

Testlab er et lokalt verktøy i spillvelgeren, uten innlogging, backendregistrering eller resultatlagring. Verktøyet kan åpnes uten tilkobling for å vise tilkoblingspanelet; faktisk input og output krever en klar Micro:bit-forbindelse. [Testlab-spesifikasjonen](games/microbit-testlab/specification.md) eier verktøyets forløp.

Navigasjon mellom sidene håndteres av en felles router. Backend API er en ekstern container sett fra frontendmodellen. Den fysiske Micro:bit-enheten ligger utenfor frontend.

## 2. Komponenter og ansvar

### 2.1 Innlogging og registrering
- **Ansvar:** Vise skjema for innlogging/registrering og håndtere brukerhandlingene knyttet til disse.
- **Input:** Brukerens innloggings- eller registreringsopplysninger.
- **Output:** Forespørsel til Backend API; navigasjon til Launcher etter vellykket innlogging.
- **Avhengigheter:** Backend API og Router.
- **Avgrensning:** Backend avgjør om opplysningene er gyldige. Frontend lagrer ikke passord eller sesjonstoken. Registrering gir ingen automatisk innlogging; vis innloggingsskjema etter opprettet konto. `GET /auth/session` etablerer kontotilstand ved oppstart; 401 betyr utlogget tilstand og krever innlogging bare for beskyttede funksjoner. Offentlige sider skal fortsatt vises. Cookie, CSRF og fornyelse følger [utviklerguiden](../../spec/contracts/webapp-backend/contract.md).

### 2.2 Navigasjonsmeny
- **Ansvar:** Vise navigasjonsvalg for Launcher, Dashboard, Profil og AI-chat, samt tilgang til utlogging.
- **Input:** Brukerens valg i menyen.
- **Output:** Forespørsel om sidebytte til Router.
- **Avhengigheter:** Router; eventuelt innloggingsfunksjonalitet ved utlogging, avhengig av valgt løsning.
- **Avgrensning:** Navigasjonsmenyen skal bare vise valg for å bytte side. Hver side har selv ansvar for sitt eget innhold og sine funksjoner.
- **Visning:** Menyen vises på hovedsidene, men er skjult under aktiv spilling.

### 2.3 Router
- **Ansvar:** Koble adresser/sidevalg til riktige visninger, håndtere navigasjon og beskytte Spillplattform for ordinære spill, Dashboard, Profil og AI-chat med sesjonskontroll; Launcher med offentlig topplistevisning og Testlab kan åpnes uten innlogging.
- **Input:** Navigasjonsforespørsler og eventuelle parametere, som spill-ID.
- **Output:** Viser riktig side/komponent.
- **Avhengigheter:** Sidene som inngår i rutekonfigurasjonen. Detaljene avhenger av valgt rammeverk.
- **Avgrensning:** Skal ikke lagre resultater eller behandle spillregler.

### 2.4 Launcher
- **Ansvar:** Vise spillkatalogen og la brukeren velge et spill eller åpne spillets offentlige toppliste uten innlogging. Topplistevisningen tilhører Launcher; Dashboard viser eierens private historikk.
- **Input:** Spillkatalog og `GET /games/{game_id}/leaderboard` fra Backend API; brukerens valg og sideparametere. Offentlig rekordhistorikk kan åpnes for en valgt spiller via `/players/{player_id}/games/{game_id}/records`.
- **Output:** Navigasjon til valgt spill med spill-ID, eller offentlig visning av plassering, brukernavn, rekordverdi og enhet. Tom toppliste og API-feil vises tydelig. Innlogging kreves først når brukeren vil spille.
- **Avhengigheter:** Router og Backend API (spillkatalogen hentes fra serveren).
- **Avgrensning:** Selve spillet kjøres av Spillplattform, ikke Launcher. Backendens `Game.id` kobles til en spillmodul i webpakken; navn brukes ikke som nøkkel. Spillkatalogens API-svar inneholder metadata; spillkoden lastes fra Caddy som del av webpakken. Ukjent modul eller inaktivt spill kan ikke startes. Testlab er en separat lokal oppføring som også virker uten API-et. Vis katalogfeil separat fra dette verktøyet.

### 2.5 Spillplattform
- **Ansvar:** Laste inn og kjøre valgt spill i en felles spillvisning; håndtere oppstart/avslutning; integrere Micro:bit-input; rapportere spillresultat.
- **Input:** Spill-ID, spillinnstillinger og informasjon om knappetrykk eller bevegelser fra Micro:bit, sendt i et felles format som alle spill kan forstå.
- **Output:** Spillresultat til Backend API; navigasjonsforespørsel til Dashboard når spillet er avsluttet.
- **Avhengigheter:** Micro:bit-kommunikasjon, Backend API og Router.
- **Avgrensning:** Hvert spill har ansvar for sine egne spillregler og poengberegning. Alle spill skal bruke den samme Micro:bit-komponenten for tilkobling og kommunikasjon, i stedet for å ha egen kode for dette.
- **Krav:** Alle ordinære spill krever Micro:bit-tilkobling før oppstart. Start av spill må blokkeres til enheten er tilkoblet. Hvis forbindelsen brytes under spill, skal spillet pauses og en feilmelding vises. Brukeren kan enten gjenopprette forbindelsen og fortsette, eller avslutte spillet. Hvis spilleren avslutter etter at Micro:bit-forbindelsen er brutt, skal forsøket lagres privat som **ufullført**, med eventuell delverdi eller `null` når ingen meningsfull verdi finnes. Alle avsluttede forsøk, også frivillig avbrutte spill, sendes til Backend API. API-status er `completed` eller `incomplete`. Kun fullførte forsøk kan gi rekord. Ved lagringsfeil beholdes forsøket midlertidig i minnet og vises som ikke bekreftet lagret, med eksplisitt mulighet for omforsøk eller å gå videre uten lagringsbekreftelse. Oppdatering/lukking kan miste disse dataene.

**Sesjon og innsending:** Før ordinært spill starter kreves både `connected` og `inputAvailable`, samt vellykket `POST /auth/renew`. Forny omtrent hvert femte minutt under aktiv spilling med brukerinput; GET-kall og en inaktiv fane fornyer ikke sesjonen. Opprett én `attempt_id` ved start og behold spiller-ID, forsøks-ID, spill, sluttstatus og verdi ved pause og omforsøk. Ved nettbrudd eller utløpt sesjon beholdes spilltilstand og eventuelt ferdig forsøk; krev samme konto før innsending. Et forsøk flyttes aldri til en annen konto. `201` betyr nytt forsøk lagret, `200` betyr identisk forsøk allerede lagret; rekordeffekten leses fra body. Ved `OUTCOME_UNKNOWN` gjentas samme innhold og ID, mens `ATTEMPT_CONFLICT` krever avklaring uten automatisk ID-bytte. Gjenbruk av ID kan bekreftes også etter at spillet er deaktivert.

### 2.6 Micro:bit-kommunikasjon
- **Ansvar:** Etablere og overvåke forbindelse til fysisk Micro:bit, motta knappetrykk/sensordata og gjøre data tilgjengelige via et felles grensesnitt for spillene.
- **Input:** Data fra Micro:bit; forespørsler om tilkobling/frakobling.
- **Output:** Informasjon om knappetrykk og bevegelser i et felles format, og beskjed om Micro:bit er tilkoblet, til Spillplattform.
- **Avhengigheter:** Fysisk Micro:bit og teknologien definert i WBS 1.2.
- **Avgrensning:** Skal ikke avgjøre hvordan hvert spill reagerer på input eller beregne poeng.
- **Krav:** Alle spill bruker denne løsningen for Micro:bit-input. Komponenten leverer standardiserte hendelser, for eksempel `button=A, action=pressed`, og status for tilkoblingen. Hvert spill tolker hendelsene ut fra egne spillregler. Tilkobling må bekreftes før et spill starter, og frakobling under spill må meldes til Spillplattformen.

**Teknisk konkretisering:** Komponenten implementeres etter [JavaScript-planen](game-input-implementation-plan.md), [utviklergrensesnittet](../../spec/contracts/microbit-webapp/web-page-developer-interface.md) og [serieprotokollen](../../spec/contracts/microbit-webapp/microbit-serial-protocol.md). Det uformelle knappeeksemplet over er ikke et ekstra meldingsformat: engangshandlinger bruker `onPress({ input, count })`, mens holdte knapper og tilt leses fra felles state. Kun V2 støttes. Websiden eier forbindelsen; hvert spill får en avgrenset spilløkt. Gjenopprettet input gjør ikke at spillet automatisk fortsetter: Spillplattformen venter på spillerens valg. Protokoll, datahåndtering og testing kan implementeres uten at frontendrammeverk er valgt.

### 2.7 Dashboard
- **Ansvar:** Vise brukerens lagrede resultater, personlig highscore og spillhistorikk, inkludert resultater fra ufullførte spill med tydelig statusmerking. Egen forsøkshistorikk er privat og hentes fra `GET /account/results`, valgfritt filtrert på `game_id`, nyeste først. Enkeltforsøk hentes via `GET /account/results/{attempt_id}`; annen eiers eller ukjent ID gir 404. Kun resultater med status `completed` kan telle mot personlig rekord eller offentlige highscore-lister; ufullførte resultater vises kun i historikken og som siste spillresultat. Ved navigasjon etter et avsluttet spill skal resultatet fra siste spill fremheves; ved åpning via navigasjonsmenyen vises en generell oversikt.
- **Input:** Resultatdata fra Backend API; eventuelt spill-ID og `attempt_id` ved navigasjon etter avsluttet spill. Vis delverdi med enhet eller «Ingen delverdi»; bruk aldri delverdi som sluttresultat. Offentlig rekordhistorikk hentes separat fra `/players/{player_id}/games/{game_id}/records`.
- **Output:** Visualisering av data og eventuelle filtreringsvalg.
- **Avhengigheter:** Backend API.
- **Avgrensning:** Dashboard lagrer normalt ikke resultatene selv. Hvis brukeren ikke har spilt før, vises en tydelig tomtilstand, for eksempel «Du har ingen spillresultater ennå». Et forsøk uten ny rekord skal fortsatt vises; `current_record: null` betyr at spilleren ennå ikke har noen rekord. Ubekreftet lokalt forsøk merkes separat fra lagret historikk.

### 2.8 Profil
- **Ansvar:** Vise `id`, `username` og `created_at`, tilby passordendring og kontosletting. Brukernavn og andre profilfelt kan ikke redigeres i første versjon.
- **Input:** Brukerens endringer.
- **Output:** `POST /account/password` med gjeldende og nytt passord, eller `POST /account/delete` med gjeldende passord. Begge avslutter alle sesjoner; passordendring krever ny innlogging.
- **Avhengigheter:** Backend API.
- **Avgrensning:** Sikker validering og lagring av passord skal håndteres av riktig backend-/autentiseringstjeneste.

### 2.9 AI-chat
- **Ansvar:** Vise en samtale der brukeren kan spørre om **offentlige rekorder og rekordhistorikk** og sammenligne resultater som er offentlig tilgjengelige.
- **Input:** Brukerens spørsmål.
- **Output:** Svar kun basert på offentlige rekorder og rekordhistorikk som backend har gjort tilgjengelige.
- **Avhengigheter:** Backend API, som håndterer tilgang til spilldata og eventuelt AI-tjenesten.
- **Avgrensning:** AI-chatten skal ikke finne på spillresultater eller hente private spill- eller profildata om andre brukere. Den skal kun bruke offentlige rekorder og rekordhistorikk. Backend og AI-databaserollen håndhever denne begrensningen. Private forsøk er utilgjengelige også for spørsmål om egne forsøk. «Utvikling» gjelder rekorder. Hvert spørsmål behandles selvstendig uten samtalehistorikk; vis dette i grensesnittet selv om spørsmål/svar vises i en lokal liste. AI-feil stopper ikke spilling eller resultatlagring. Ventetid gir rom for backendens frist på 60 sekunder, eksempelvis 70 sekunder i frontend, uten automatiske omforsøk.

## 3. Eksterne enheter og tjenester

### Backend API
Backend API er ikke en intern frontend-komponent. Det mottar forespørsler fra frontend og håndterer blant annet brukerdata, spillkatalog, lagring/henting av resultater og forespørsler til AI-funksjonalitet i den grad dette inngår i backendkontrakten. Endepunkter, format, autentisering og feilhåndtering følger **WBS 1.3 revisjon 0.2.0**: [utviklerguide](../../spec/contracts/webapp-backend/contract.md) og [OpenAPI](../../spec/contracts/webapp-backend/openapi.yaml). Databasen er normalt backendens ansvar, ikke en frontend-komponent.

### Fysisk Micro:bit
Micro:bit er en fysisk enhet, ikke en intern programvarekomponent. Forbindelse, dataprotokoll, knapper/sensorer og håndtering av frakobling må samsvare med **WBS 1.2**.

## 4. Avhengigheter og kommunikasjon

Tabellen viser hvilke komponenter som samarbeider, og hva de bruker hverandre til.

| Fra → Til | Hva skjer mellom komponentene? |
|---|---|
| Innlogging og registrering → Backend API | Sender innloggings- eller registreringsopplysninger. Backend behandler forespørselen og sender svar tilbake. |
| Innlogging og registrering → Router | Ber routeren åpne Launcher etter vellykket innlogging. |
| Navigasjonsmeny → Router | Ber routeren åpne siden brukeren velger i menyen. |
| Launcher → Backend API | Henter spillkatalog, offentlige topplister og valgt spillers offentlige rekordhistorikk uten krav om innlogging. |
| Launcher → Router | Ber routeren åpne Spillplattformen med spillet brukeren har valgt. |
| Spillplattform → Micro:bit-kommunikasjon | Sjekker om Micro:bit er tilkoblet, og mottar knappetrykk, annen spillinput og tilkoblingsstatus. |
| Micro:bit-kommunikasjon → Fysisk Micro:bit | Håndterer forbindelsen til den fysiske enheten og oppdager når tilkoblingen brytes. |
| Spillplattform → Backend API | Sender fullførte eller ufullførte spillresultater for lagring, med `attempt_id`, `status` og `value` (eventuelt `null`). |
| Spillplattform → Router | Ber routeren åpne Dashboard etter at spillet er avsluttet. |
| Dashboard → Backend API | Henter spillresultater, personlige rekorder og spillhistorikk. Viser siste resultat når brukeren kommer fra et spill. |
| Profil → Backend API | Viser kontoinformasjon og sender forespørsler om passordendring eller kontosletting. |
| AI-chat → Backend API | Sender spørsmål og mottar svar basert bare på offentlige rekorder og rekordhistorikk. |

**Tolkning av piler:** En pil viser normalt at komponenten til venstre *bruker* komponenten til høyre, ikke nødvendigvis retningen på alle datapakker. Svar fra API-et krever derfor vanligvis ikke en ekstra pil tilbake.

**Rutekonfigurasjon:** Routeren viser Launcher, Spillplattform, Dashboard, Profil og AI-chat ved relevant adresse. Pilene fra disse sidene til Router vises bare der sidene selv ber om navigasjon; ingen direkte pil kreves fra Router til hver side i denne forenklede modellen.

## 5. Eksempel på bruker- og dataflyt

1. Brukeren logger inn. Innlogging sender forespørsel til Backend API.
2. Etter vellykket innlogging ber Innlogging Router om å vise Launcher.
3. Brukeren velger et spill. Launcher ber Router åpne Spillplattform med riktig spill-ID.
4. Spillplattform kontrollerer klar Micro:bit og fornyer sesjonen før spillstart. Den lager en stabil forsøks-ID. Hvis enheten ikke er tilkoblet, kan spillet ikke startes. Når forbindelsen er klar, laster Spillplattform spillet og bruker Micro:bit-kommunikasjon for kontrollinput.
5. Hvis Micro:bit kobles fra under spillet, pauses spillet og en feilmelding vises. Brukeren kan koble til på nytt og fortsette, eller velge å avslutte. Ved avslutning etter frakobling sendes oppnådd resultat til Backend API med status `incomplete`. Ved normal fullføring sendes resultatet med status `completed`.
6. Når lagringen er bekreftet (eller brukeren har valgt å gå videre med tydelig ubekreftet lokal lagring), ber Spillplattform Router vise Dashboard med forsøks-ID. Backend har lagret forsøk og eventuell ny rekord i samme transaksjon.
7. Dashboard henter resultatene fra Backend API og fremhever det nylig avsluttede spillet. Hvis Dashboard åpnes fra navigasjonsmenyen, viser det i stedet den generelle resultatoversikten.

Dette er **bruker-/dataflyt** som supplement til C3-avhengighetene, ikke en erstatning for komponentdiagrammet.

## 6. Felles implementeringsgrunnlag

- **API:** [WBS 1.3, revisjon 0.2.0](../../spec/contracts/webapp-backend/README.md) fastsetter innlogging, spillkatalog, privat forsøkshistorikk, offentlige rekorder, konto og AI. Felt og feil kopieres ikke til alternative kontrakter.
- **Micro:bit:** WBS 1.2 og JavaScript-planen fastsetter V2-input, pause og opprydding. Spilltilstand og lagring eies fortsatt av Spillplattform.
- **Spillregistrering:** Frontend registrerer lokale moduler under backendens stabile spill-ID og avviser ukjente/inaktive spill ved start. Testlab er et uttrykkelig lokalt unntak.
- **Resultater:** Alle avsluttede ordinære spillforsøk er private. Fullførte kan gi offentlig rekord; ufullførte har eventuell delverdi og gir aldri rekord.
- **Profil og AI:** Kontoens visningsfelt er skrivebeskyttet. AI bruker offentlig rekordhistorikk og ingen samtalehistorikk eller private forsøk.
- **Teknologivalg:** Frontendrammeverk/router og det interne livsløpsgrensesnittet for vanlige spill velges ved frontendimplementering innenfor disse komponentansvarene. Det endrer ikke HTTP-kontrakten eller det rammeverkuavhengige Micro:bit-biblioteket.

### Samlet webpakke

Alt som kjøres eller vises i frontend skal leveres som **én samlet statisk webpakke**, servert fra Parrot over samme HTTPS-adresse som API-et. Pakken inneholder HTML, CSS, JavaScript, alle spill, Testlab, Micro:bit-biblioteket og nødvendige ressurser som bilder, lyd og fonter. Biblioteker og spillressurser skal følge med i pakken; nettleseren skal ikke være avhengig av eksterne CDN-er eller andre nettsteder for å laste dem. Bygging kan hente låste avhengigheter fra pakkeregisteret.

- **Frontendgruppen eier bygget:** Fra `webapp/` skal `npm ci` etterfulgt av `npm run build` produsere hele leveransen i `webapp/dist/`, med `index.html` som inngang. Kommandoene og låsefilen etableres ved frontendimplementering; de er ikke implementert ennå.
- **Én pakke kan ha flere filer:** Spill kan lastes ved behov fra filer i samme bygg. Alle filreferanser må fungere når `dist/` publiseres ved roten av nettstedet. API-kall bruker relative `/api/v1`-adresser.
- **Backend-/driftsgruppen eier publisering:** Hele `dist/` leveres til Caddys publiseringsmappe som én versjon. Caddy serverer filene, og nettleseren kjører frontend og spill. En utviklingsserver er ikke nødvendig i drift.
- **Versjonering:** Kildekode, byggeskript og låsefil lagres i Git. `dist/` er generert og allerede ignorert. Pakken inneholder bare filer beregnet på offentlig distribusjon; serverhemmeligheter og driftsdata inngår ikke.

Publiseringsrekkefølge og oppdatering beskrives i [implementeringsplanen](../../backend/spec/implementation-plan.md#publisering-av-webpakken). Kontroll av den ferdige pakken er TWEB-12 i [plattformtestplanen](platform-test-plan.md).

## 7. Instruks til AI-assistert utvikling

Bruk denne komponentspesifikasjonen sammen med det samordnede C3-diagrammet, funksjonelle krav, kvalitetskrav og kommunikasjonskontraktene WBS 1.2 og 1.3. Implementer komponentene med ansvarene og avhengighetene som er beskrevet. Ikke anta endepunkter, meldingsformat eller Micro:bit-protokoll der spesifikasjonen ennå ikke er avklart. Marker uavklarte beslutninger tydelig, og foreslå eventuelle arkitekturendringer før de implementeres. Skriv tester som verifiserer komponentansvar og grensesnitt.

## 8. Bekreftede produktbeslutninger

1. **Micro:bit er obligatorisk:** Alle ordinære spill krever klar Micro:bit og gyldig fornyet sesjon før oppstart. Testlab følger verktøyets eget forløp.
2. **Spillkatalog:** Launcher henter tilgjengelige spill fra Backend API.
3. **AI-chat:** Spørsmål og sammenligninger bruker offentlige rekorder og rekordhistorikk, uten private forsøk.
4. **Frakobling under spill:** Spillet pauses, feilmelding vises, og brukeren velger mellom å koble til på nytt og fortsette, eller å avslutte.
5. **Dashboard:** Viser siste resultat etter avsluttet spill og en generell statistikkoversikt når siden åpnes direkte fra menyen. Ufullførte spill markeres tydelig.
6. **Ufullførte spill:** Dersom spilleren avslutter etter brudd i Micro:bit-forbindelsen, lagres oppnådd resultat med status `incomplete`, eventuell delverdi eller `null`, og vises bare i eierens forsøkshistorikk. Ufullførte resultater teller ikke mot highscore eller personlig rekord.

7. **Highscore:** Bare spill med status `completed` teller mot personlig rekord og offentlige highscore-lister. Resultater med status `incomplete` er synlige bare i eierens private forsøkshistorikk, men påvirker ikke rangeringene.

Disse beslutningene er samordnet med WBS 1.3 revisjon 0.2.0. Se [plattformens testplan](platform-test-plan.md) for kontrollene som må implementeres sammen med frontend.
