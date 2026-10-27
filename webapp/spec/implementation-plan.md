# Implementasjonsplan for webapplikasjonen

Dato: 2026-10-27. Planen omfatter hele webappen. Kun regel- og opptaksgrunnlaget beskrevet nedenfor er implementert; ingen ferdig frontend, seriell adapter eller backendintegrasjon foreligger.

## Styrende grunnlag

Les [komponentspesifikasjonen](Komponentspesifikasjon_webapplikasjon_forklart.md), [C3-modellen](models/c4-komponentmodell_nivaa3.drawio), [API-guiden 0.2.0](../../spec/contracts/webapp-backend/contract.md), [OpenAPI](../../spec/contracts/webapp-backend/openapi.yaml) og [avklaringer](../../spec/contracts/webapp-backend/alignment.md). Wireformat og grenser eies av [serieprotokollen](../../spec/contracts/microbit-webapp/microbit-serial-protocol.md), mens spillenes grensesnitt eies av [utviklergrensesnittet](../../spec/contracts/microbit-webapp/web-page-developer-interface.md). Ingen alternative API-ruter eller meldingsformater innføres.

Eksisterende [adapterplan](game-input-implementation-plan.md) beholdes som detaljplan for biblioteket. Testlab følger [egen spesifikasjon](games/microbit-testlab/specification.md) og [design](games/microbit-testlab/implementation-design.md). Test-ID-ene TWEB, GI og TLAB beholdes. Felles systemkrav og systemverifikasjonsplan er ennå ikke utarbeidet i `spec/system`; denne planen fyller ikke inn antatte krav derfra.

## Arkitektur og avhengigheter

Siden eier én adapter og én port. Spillplattformen eier spilltilstand, pausevalg, eierbundet forsøks-ID og resultatinnsending. Spillmoduler eier spillregler og bruker bare den felles spillsesjonen. Routeren eier navigasjon og rutebeskyttelse. API-klienten eier HTTP, feilkonvolutt og tidsavbrudd. Testlab eier lokal visning/opptak og kaller aldri konto-, fornyelses- eller resultatruter.

Forslag for videre frontend er statiske ES-moduler med separat visningslag og router; et eventuelt rammeverk velges før UI-fasen. Dagens rene moduler krever ingen rammeverkbeslutning. Ingen ny avhengighet, hosting eller publisering inngår i dette grunnlaget. En lokal HTTPS-proxy til `/api` må etableres før cookieintegrasjon; produksjonen bruker samme HTTPS-opprinnelse for nettside og API.

| Trinn | Leveranse | Avhengighet og akseptanse |
| --- | --- | --- |
| 0 – testgrunnlag | Native Node-testkjører, låst miljø, rene plattformregler og opptak, benchmarkskript. | Levert i denne endringen. `npm ci`, `npm test`, `npm run benchmark`. Deldekning av TWEB/TLAB; ingen samlet produktgodkjenning. |
| 1 – protokoll og adapter | Følg adapterplanens fase 1–5: framer, duplikatnøkkelkontroll, streng V2-validering, mapping, hendelser, én paced writer, kø/ID/resultat, recovery og disposal. | Gjenbruk alle relevante seksjoner i `conformance.json`. GI-01–14,16–20 med fake klokke/transport; ingen fysisk venting for tidsfristtester. Ingen spill eller Testlab oppretter egen serial-leser. |
| 2 – API og sesjon | Injiserbar fetch-klient, `/auth/session`, register/login/logout/renew, kontooperasjoner, spillkatalog og privat historikk. | TWEB-01/02/06/08. POST har JSON og `X-MBG-Request: 1`, credentials same-origin. Ingen JS-token/passordlagring. Registrering gir innloggingsskjema. GET fornyer ikke sesjon. Proxy-svar uten JSON og nettverksfeil bevarer lokale forsøk. |
| 3 – skall, router og Launcher | Velg visningsteknologi; offentlige Launcher/Testlab, beskyttede konto-/spillsider. Katalog kobles til lokale moduler med stabil Game.id. | TWEB-01/02/10. Inaktive/ukjente moduler kan ikke startes. Lokal Testlab er tilgjengelig ved katalogfeil. Meny skjules under aktiv spilling. |
| 4 – Spillplattform | Start krever innlogget spiller, aktivt kjent spill, connected/inputAvailable og vellykket renew. UUID opprettes én gang ved start. Pause ved utilgjengelig input, eksplisitt resume, exit/finish og minnebasert lagringskø. | TWEB-02–06. Nett-/sesjonsbrudd bevarer tilstand og eier. Forny omtrent hvert femte minutt bare ved aktiv spilling med input. Alle avsluttede forsøk sendes, også frivillig avbrutte. Disposal avventes ved spillbytte; lagringsvalg håndteres uavhengig av oppryddingsfeil. |
| 5 – Dashboard og Profil | Privat forsøksliste, filter/sideinndeling, detaljoppslag etter forsøks-ID, separat offentlig rekordhistorikk. Skrivebeskyttet profil, passordendring og sletting. | TWEB-04/07/08. Fremhev siste forsøk også uten rekord. `incomplete` med null vises som «Ingen delverdi». Ubekreftede forsøk skilles fra lagrede; 404 lekker ingen annen eiers data. Kontoendringer avslutter sesjonen. |
| 6 – AI | Ett selvstendig spørsmål om gangen; kun question og valgfri game_id, ren tekst, lokal liste uten sendt historikk. | TWEB-09. Frontendfrist foreslås 70 s, backend har 60 s. Ingen automatisk retry. ok/no_data/cannot_answer og tekniske feil håndteres uten å stoppe spill/lagring. |
| 7 – Testlab | Figur/sensorer, grafer, tellere fra onPress/onGesture, outputeditorer med eksplisitt Send, diagnostikk, opptak, eksport og reset. | TLAB-01–16. Bruk opptaksmodulen via eksplisitt mapping av gyldige snapshots. 10 Hz/3000 sensorer og 1000 hendelser; ingen fabrikasjon i datagap. Siste gyldige data merkes utdaterte ved brudd. Innstillinger beholdes, gamle kommandoer gjentas ikke. Reset stopper/tømmer enheten og viser feil. |
| 8 – system og fysisk måling | Nettlesermock, faktisk backend med cookieintegrasjon, fysisk V2, responstid og langkjøring. | Alle relevante TWEB/GI/TLAB-caser må ha evidens. Manglende produkt/hardware gir BLOCKED/SKIPPED med grunn, aldri PASS. |

## Teststrategi og dagens dekning

Kjørbare enhetstester ligger i `tests/unit/`. `src/platform/rules.js` gir rene beslutningsfunksjoner, ikke en komplett spillcontroller eller sikkerhetsgrense. `src/testlab/recorder.js` bruker ringbuffere og eier kopier av inn-/utdata. Opptak mottar allerede validerte, flate sensorverdier; det beviser ikke validering av rå serieinput. UUID-generering og API-responsvalidering implementeres i henholdsvis spillcontroller og API-klient. `submissionState` brukes først etter validert respons-body; HTTP-status alene skal ikke få vise rekordeffekt.

| Kontrollsett | Kjørbar dekning nå | Gjenstående |
| --- | --- | --- |
| TWEB-01/02/03/05/06/09/10 | Ruteregler, startkrav, fornyelsesvilkår, pause/resume, uforanderlig ferdig forsøk, eierkontroll og eksakt request ved retry, feilstatus og AI-body. | Faktisk router, fetch, klokke/scheduling, sesjonsutløp, spillcontroller og UI. |
| TWEB-04 | Tallgrenser og skillet mellom lagringsbekreftelse og rekord. | Historikken 100,80,120,110 og rekordene 100→120 mot faktisk backend. |
| TWEB-07/08 | Ingen produkttest levert. | Dashboard, profil, kontoendringer og sletting med backend. |
| TLAB-09/10/11/13/16 | Opptakstilstander, avbrutt erstatning, pause/datavindu, 10 Hz, flere bufferomløp, eierskap, JSON/CSV og tapsmetadata. | Integrasjon med adapter, full UI, reset og faktisk minne-/rendertrend. |
| GI-01–20 og øvrige TLAB | Ingen adapter-/nettleser-/maskinvaretest levert. | Implementeres i trinn 1,7,8. Fraværende kode skal ikke merkes bestått gjennom en referansemodell alene. |

Utvid enhetstestene ved hver implementasjon; installer og lås Playwright/browser ved første nettleserleveranse. Fake transport og klokke injiseres, med tester for sen chooser/open/write, resultat før write er ferdig, timeout/recovery, disponering under callback og null gjenværende timere/abonnementer. Frontendtester bruker kontrollerte API-svar; eierskap, atomisk rekordlagring og sletting må også testes mot faktisk backend.

## Benchmarks og akseptanse

`npm run benchmark` måler de leverte modulene ved 50 Hz og 500 Hz stress med 600 sekunder akselerert logisk tid per profil. Rapporten inneholder p50/p95/p99/maksimum, operasjoner/s, CPU-tid/operasjon, eksportstørrelse/tid, buffergrenser, miljø og kildehasher. Oppvarming er inkludert i bufferomløp men ikke tidsstatistikken. Dette er ingen ti minutters faktisk soak eller måling av serial-throughput. Ingen ny tidsgrense for rene hjelpefunksjoner konstrueres; rapporten er en startbaseline. Kapasitetsbrudd gjør kjøringen feilende.

Når adapter/UI finnes, utvid målerunneren med:

- Komplett råfixture-framing/validering/normalisering ved normal 50 Hz og dokumentert stressrate. Skill forventet avvisning fra tap av gyldige frames.
- Komplett linje til state/event-callback med én og fire abonnenter: **p95 ≤ 5 ms ved 50 Hz**. Bruk host `performance.now`, ikke differanse mot enhetens `u`.
- Minst fem minutters faktisk langkjøring med wrap/gap, ugyldige/oversized linjer, silence/recovery, output og spillbytte. Logg kølengde, minne og latens over tid; buffere og kommandokø skal holde kontraktens grenser.
- Testlab med grafer/logg/eksport gjennom flere bufferomløp. Mål heaptrend og UI-respons i faktisk nettleser, separat fra Node-kjernemålingen.
- Fysisk V2: first-byte→result og final-LF→result separat; pacing og timeoutstatistikk. ACK betyr startet/anvendt, aldri ferdig output.
- Instrumentert fysisk knapp/tilt→spillcallback: **p95 ≤ 100 ms**, minst **20 forsøk**. Manuell omtrentlig timing kan ikke etablere PASS.

Fake klokke kontrollerer eksakte 500 ms freshness-, 3000 ms handshake- og 1000 ms resultfrister. Én in-flight + 16 ventende kommandoer og høyst 16 byte per chunk med minst 5 ms mellom chunkstarter er obligatorisk. Disse grensene er krav, ikke målte resultater i denne leveransen.

Rapporter kilde-/fixtureversjon, browser/OS, buildmodus, abonnenter, klokke, prøveantall og utstyr/runtime/firmware for fysisk test. Ikke senk grenser etter feil. Før full akseptanse må UI-teknologi, adapterdiagnostikk for faktisk målerate/siste snapshot, ordinært spillmodulgrensesnitt og reell browser/V2-kombinasjon konkretiseres uten å endre kontraktene.
