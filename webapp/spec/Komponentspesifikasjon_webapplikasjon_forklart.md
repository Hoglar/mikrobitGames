# Komponentspesifikasjon – Webapplikasjon

**Status:** Oppdatert utkast – skal gjennomgås og godkjennes av prosjektgruppen  
**Formål:** Strukturert input til AI-assistert utvikling og verifisering.  
**Omfang:** Frontendens komponenter (C4 nivå 3) og deres forbindelser til Backend API og fysisk Micro:bit.

## 1. Overordnet beskrivelse

Webapplikasjonen er en spillplattform hvor brukere kan registrere seg, logge inn, velge mellom tilgjengelige spill, spille ved hjelp av Micro:bit og se egne resultater. Brukeren kan også se og redigere profilen sin og bruke en AI-chat til å stille spørsmål om spillresultater og sammenligninger.

**Viktig krav:** Alle spill som tilbys i launcheren, **krever at Micro:bit er tilkoblet før spillstart**, og skal kunne styres med Micro:bit. Spillplattformen skal tilby et felles grensesnitt for Micro:bit-input slik at hvert spill ikke trenger å håndtere selve tilkoblingen.

Navigasjon mellom sidene håndteres av en felles router. Backend API er en ekstern container sett fra frontendmodellen. Den fysiske Micro:bit-enheten ligger utenfor frontend.

## 2. Komponenter og ansvar

### 2.1 Innlogging og registrering
- **Ansvar:** Vise skjema for innlogging/registrering og håndtere brukerhandlingene knyttet til disse.
- **Input:** Brukerens innloggings- eller registreringsopplysninger.
- **Output:** Forespørsel til Backend API; navigasjon til Launcher etter vellykket innlogging.
- **Avhengigheter:** Backend API og Router.
- **Avgrensning:** Backend avgjør om opplysningene er gyldige. Frontend skal ikke selv lagre passord eller avgjøre autentisering kun lokalt.

### 2.2 Navigasjonsmeny
- **Ansvar:** Vise navigasjonsvalg for Launcher, Dashboard, Profil og AI-chat, samt tilgang til utlogging.
- **Input:** Brukerens valg i menyen.
- **Output:** Forespørsel om sidebytte til Router.
- **Avhengigheter:** Router; eventuelt innloggingsfunksjonalitet ved utlogging, avhengig av valgt løsning.
- **Avgrensning:** Navigasjonsmenyen skal bare vise valg for å bytte side. Hver side har selv ansvar for sitt eget innhold og sine funksjoner.
- **Visning:** Menyen vises på hovedsidene, men er skjult under aktiv spilling.

### 2.3 Router
- **Ansvar:** Koble adresser/sidevalg til riktige visninger, håndtere navigasjon og eventuelt beskytte sider som krever innlogging.
- **Input:** Navigasjonsforespørsler og eventuelle parametere, som spill-ID.
- **Output:** Viser riktig side/komponent.
- **Avhengigheter:** Sidene som inngår i rutekonfigurasjonen. Detaljene avhenger av valgt rammeverk.
- **Avgrensning:** Skal ikke lagre resultater eller behandle spillregler.

### 2.4 Launcher
- **Ansvar:** Vise spillkatalogen og la brukeren velge et spill.
- **Input:** Liste over tilgjengelige spill hentet fra Backend API; brukerens valg.
- **Output:** Navigasjon til valgt spill med spill-ID.
- **Avhengigheter:** Router og Backend API (spillkatalogen hentes fra serveren).
- **Avgrensning:** Selve spillet kjøres av Spillplattform, ikke Launcher.

### 2.5 Spillplattform
- **Ansvar:** Laste inn og kjøre valgt spill i en felles spillvisning; håndtere oppstart/avslutning; integrere Micro:bit-input; rapportere spillresultat.
- **Input:** Spill-ID, spillinnstillinger og informasjon om knappetrykk eller bevegelser fra Micro:bit, sendt i et felles format som alle spill kan forstå.
- **Output:** Spillresultat til Backend API; navigasjonsforespørsel til Dashboard når spillet er avsluttet.
- **Avhengigheter:** Micro:bit-kommunikasjon, Backend API og Router.
- **Avgrensning:** Hvert spill har ansvar for sine egne spillregler og poengberegning. Alle spill skal bruke den samme Micro:bit-komponenten for tilkobling og kommunikasjon, i stedet for å ha egen kode for dette.
- **Krav:** Alle spill krever Micro:bit-tilkobling før oppstart. Start av spill må blokkeres til enheten er tilkoblet. Hvis forbindelsen brytes under spill, skal spillet pauses og en feilmelding vises. Brukeren kan enten gjenopprette forbindelsen og fortsette, eller avslutte spillet. Hvis spilleren avslutter etter at Micro:bit-forbindelsen er brutt, skal spillet lagres som et **ufullført resultat** med status `ufullført` og oppnådd poengsum frem til avbruddet. Både fullførte og ufullførte resultater sendes til Backend API. En lagringsfeil må håndteres før brukeren sendes til Dashboard.

### 2.6 Micro:bit-kommunikasjon
- **Ansvar:** Etablere og overvåke forbindelse til fysisk Micro:bit, motta knappetrykk/sensordata og gjøre data tilgjengelige via et felles grensesnitt for spillene.
- **Input:** Data fra Micro:bit; forespørsler om tilkobling/frakobling.
- **Output:** Informasjon om knappetrykk og bevegelser i et felles format, og beskjed om Micro:bit er tilkoblet, til Spillplattform.
- **Avhengigheter:** Fysisk Micro:bit og teknologien definert i WBS 1.2.
- **Avgrensning:** Skal ikke avgjøre hvordan hvert spill reagerer på input eller beregne poeng.
- **Krav:** Alle spill bruker denne løsningen for Micro:bit-input. Komponenten leverer standardiserte hendelser, for eksempel `button=A, action=pressed`, og status for tilkoblingen. Hvert spill tolker hendelsene ut fra egne spillregler. Tilkobling må bekreftes før et spill starter, og frakobling under spill må meldes til Spillplattformen.

**Teknisk konkretisering:** Komponenten implementeres etter [JavaScript-planen](game-input-implementation-plan.md), [utviklergrensesnittet](../../spec/contracts/microbit-webapp/web-page-developer-interface.md) og [serieprotokollen](../../spec/contracts/microbit-webapp/microbit-serial-protocol.md). Det uformelle knappeeksemplet over er ikke et ekstra meldingsformat: engangshandlinger bruker `onPress({ input, count })`, mens holdte knapper og tilt leses fra felles state. Kun V2 støttes. Websiden eier forbindelsen; hvert spill får en avgrenset spilløkt. Gjenopprettet input gjør ikke at spillet automatisk fortsetter: Spillplattformen venter på spillerens valg. Protokoll, datahåndtering og testing kan implementeres uten at frontendrammeverk er valgt.

### 2.7 Dashboard
- **Ansvar:** Vise brukerens lagrede resultater, personlig highscore og spillhistorikk, inkludert resultater fra ufullførte spill med tydelig statusmerking. Kun resultater med status `fullført` kan telle mot personlig rekord eller offentlige highscore-lister; ufullførte resultater vises kun i historikken og som siste spillresultat. Ved navigasjon etter et avsluttet spill skal resultatet fra siste spill fremheves; ved åpning via navigasjonsmenyen vises en generell oversikt.
- **Input:** Resultatdata fra Backend API; eventuelt spill-ID eller resultat-ID ved navigasjon etter avsluttet spill.
- **Output:** Visualisering av data og eventuelle filtreringsvalg.
- **Avhengigheter:** Backend API.
- **Avgrensning:** Dashboard lagrer normalt ikke resultatene selv. Hvis brukeren ikke har spilt før, vises en tydelig tomtilstand, for eksempel «Du har ingen spillresultater ennå».

### 2.8 Profil
- **Ansvar:** Vise og oppdatere relevante brukeropplysninger og tilby endring av passord.
- **Input:** Brukerens endringer.
- **Output:** Forespørsler om å hente/oppdatere kontoopplysninger via Backend API.
- **Avhengigheter:** Backend API.
- **Avgrensning:** Sikker validering og lagring av passord skal håndteres av riktig backend-/autentiseringstjeneste.

### 2.9 AI-chat
- **Ansvar:** Vise en samtale der brukeren kan spørre om **offentlige highscore-lister** og sammenligne resultater som er offentlig tilgjengelige.
- **Input:** Brukerens spørsmål.
- **Output:** Svar kun basert på offentlige highscore-data som backend har gjort tilgjengelige.
- **Avhengigheter:** Backend API, som håndterer tilgang til spilldata og eventuelt AI-tjenesten.
- **Avgrensning:** AI-chatten skal ikke finne på spillresultater eller hente private spill- eller profildata om andre brukere. Den skal kun bruke offentlig publiserte highscore-data. Backend må håndheve denne begrensningen.

## 3. Eksterne enheter og tjenester

### Backend API
Backend API er ikke en intern frontend-komponent. Det mottar forespørsler fra frontend og håndterer blant annet brukerdata, spillkatalog, lagring/henting av resultater og forespørsler til AI-funksjonalitet i den grad dette inngår i backendkontrakten. Endepunkter, format, autentisering og feilhåndtering fastsettes i **WBS 1.3**. Databasen er normalt backendens ansvar, ikke en frontend-komponent.

### Fysisk Micro:bit
Micro:bit er en fysisk enhet, ikke en intern programvarekomponent. Forbindelse, dataprotokoll, knapper/sensorer og håndtering av frakobling må samsvare med **WBS 1.2**.

## 4. Avhengigheter og kommunikasjon

Tabellen viser hvilke komponenter som samarbeider, og hva de bruker hverandre til.

| Fra → Til | Hva skjer mellom komponentene? |
|---|---|
| Innlogging og registrering → Backend API | Sender innloggings- eller registreringsopplysninger. Backend behandler forespørselen og sender svar tilbake. |
| Innlogging og registrering → Router | Ber routeren åpne Launcher etter vellykket innlogging. |
| Navigasjonsmeny → Router | Ber routeren åpne siden brukeren velger i menyen. |
| Launcher → Backend API | Henter listen over tilgjengelige spill som vises i Launcher. |
| Launcher → Router | Ber routeren åpne Spillplattformen med spillet brukeren har valgt. |
| Spillplattform → Micro:bit-kommunikasjon | Sjekker om Micro:bit er tilkoblet, og mottar knappetrykk, annen spillinput og tilkoblingsstatus. |
| Micro:bit-kommunikasjon → Fysisk Micro:bit | Håndterer forbindelsen til den fysiske enheten og oppdager når tilkoblingen brytes. |
| Spillplattform → Backend API | Sender fullførte eller ufullførte spillresultater for lagring, med poengsum og status. |
| Spillplattform → Router | Ber routeren åpne Dashboard etter at spillet er avsluttet. |
| Dashboard → Backend API | Henter spillresultater, personlige rekorder og spillhistorikk. Viser siste resultat når brukeren kommer fra et spill. |
| Profil → Backend API | Henter og oppdaterer brukeropplysninger, inkludert forespørsler om passordendring. |
| AI-chat → Backend API | Sender spørsmål og mottar svar basert bare på offentlige highscore-data. |

**Tolkning av piler:** En pil viser normalt at komponenten til venstre *bruker* komponenten til høyre, ikke nødvendigvis retningen på alle datapakker. Svar fra API-et krever derfor vanligvis ikke en ekstra pil tilbake.

**Rutekonfigurasjon:** Routeren viser Launcher, Spillplattform, Dashboard, Profil og AI-chat ved relevant adresse. Pilene fra disse sidene til Router vises bare der sidene selv ber om navigasjon; ingen direkte pil kreves fra Router til hver side i denne forenklede modellen.

## 5. Eksempel på bruker- og dataflyt

1. Brukeren logger inn. Innlogging sender forespørsel til Backend API.
2. Etter vellykket innlogging ber Innlogging Router om å vise Launcher.
3. Brukeren velger et spill. Launcher ber Router åpne Spillplattform med riktig spill-ID.
4. Spillplattform kontrollerer at Micro:bit er tilkoblet før spillstart. Hvis enheten ikke er tilkoblet, kan spillet ikke startes. Når forbindelsen er klar, laster Spillplattform spillet og bruker Micro:bit-kommunikasjon for kontrollinput.
5. Hvis Micro:bit kobles fra under spillet, pauses spillet og en feilmelding vises. Brukeren kan koble til på nytt og fortsette, eller velge å avslutte. Ved avslutning etter frakobling sendes oppnådd resultat til Backend API med status `ufullført`. Ved normal fullføring sendes resultatet med status `fullført`.
6. Når lagringen er bekreftet (eller feil håndtert), ber Spillplattform Router vise Dashboard.
7. Dashboard henter resultatene fra Backend API og fremhever det nylig avsluttede spillet. Hvis Dashboard åpnes fra navigasjonsmenyen, viser det i stedet den generelle resultatoversikten.

Dette er **bruker-/dataflyt** som supplement til C3-avhengighetene, ikke en erstatning for komponentdiagrammet.

## 6. Avklaringer før implementering

- **WBS 1.2:** Tilkobling kreves før spillstart; ved bortfall pauses spillet og brukeren velger å koble til og fortsette eller avslutte. Web Serial, V2-protokoll og standardiserte input-/output-metoder er beskrevet i de felles kontraktene og [implementeringsplanen](game-input-implementation-plan.md). Disse tekniske utkastene må verifiseres under implementering; Spillplattformen har ansvar for å bevare spilltilstand under pause og vente på spillerens valg om å fortsette.
- **WBS 1.3:** Hvilke API-endepunkter og dataformater brukes til innlogging, spillkatalog, resultater, profil og AI-chat?
- **Spillgrensesnitt:** Hvordan registreres nye spill, og hvilken felles kontrakt må hvert spill følge for Micro:bit-input og resultater?
- **Spillkatalog:** **Avklart:** Oversikten hentes fra Backend API. Avklar datafelter og hvordan backend angir hvilket spill frontend skal laste.
- **AI:** **Avklart:** Kun offentlige highscore-lister kan vises og sammenlignes. Avklar hvem som henter highscore-data og kaller eventuell AI-modell, samt hvilke felter som inngår i offentlige lister.
- **Resultatlagring:** **Avklart:** Spill som avsluttes etter frakobling lagres som ufullførte resultater og vises i spillhistorikken. Kun `fullført` kan telle mot personlig rekord eller offentlige highscore-lister. Backend API skal håndheve dette ved beregning av topplister. Må fortsatt avklare hvordan lagringsfeil håndteres og hvilke felter som sendes.
- **Ruting:** Hvilket rammeverk brukes, og hvordan beskyttes sider som krever innlogging?

## 7. Instruks til AI-assistert utvikling

Bruk denne komponentspesifikasjonen sammen med godkjent C3-diagram, funksjonelle krav, kvalitetskrav og kommunikasjonskontraktene WBS 1.2 og 1.3. Implementer komponentene med ansvarene og avhengighetene som er beskrevet. Ikke anta endepunkter, meldingsformat eller Micro:bit-protokoll der spesifikasjonen ennå ikke er avklart. Marker uavklarte beslutninger tydelig, og foreslå eventuelle arkitekturendringer før de implementeres. Skriv tester som verifiserer komponentansvar og grensesnitt.

## 8. Bekreftede produktbeslutninger

1. **Micro:bit er obligatorisk:** Alle spill krever bekreftet tilkobling før oppstart.
2. **Spillkatalog:** Launcher henter tilgjengelige spill fra Backend API.
3. **AI-chat:** Spørsmål og sammenligninger begrenses til offentlige highscore-lister.
4. **Frakobling under spill:** Spillet pauses, feilmelding vises, og brukeren velger mellom å koble til på nytt og fortsette, eller å avslutte.
5. **Dashboard:** Viser siste resultat etter avsluttet spill og en generell statistikkoversikt når siden åpnes direkte fra menyen. Ufullførte spill markeres tydelig.
6. **Ufullførte spill:** Dersom spilleren avslutter etter brudd i Micro:bit-forbindelsen, lagres oppnådd resultat med status `ufullført` og vises i spillhistorikken. Ufullførte resultater teller ikke mot highscore eller personlig rekord.

7. **Highscore:** Bare spill med status `fullført` teller mot personlig rekord og offentlige highscore-lister. Resultater med status `ufullført` er synlige i spillerens historikk, men påvirker ikke rangeringene.

Disse beslutningene skal samsvare med funksjonelle krav og avklares teknisk i WBS 1.2 og 1.3 før implementering.
