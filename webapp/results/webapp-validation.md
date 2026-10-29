# Webapp – verifikasjon 2026-10-29

Utgangspunkt: `63ae3c1`, med lokale frontendendringer beskrevet i
[implementasjonsnotatet](../spec/webapp-implementation.md). Miljø: macOS/darwin,
Node 24.22.1, npm 11.19.1, Playwright 1.64.1, Chromium 156.0.8078.4.

| Kontroll | Faktisk resultat |
| --- | --- |
| `npm ci` | PASS. Låste testavhengigheter installert, ingen nye runtimeavhengigheter. |
| `npm run build` | PASS. 29 offentlige filer i `dist/`, omtrent 196 KiB inkludert filoversikt. |
| `npm test` | PASS, 62 tester. Eksisterende adapter-/opptaks-/plattformtester og seks nye frontend-/spilltester. |
| `npm run test:app` | PASS, 11 nettlesertester mot bare `dist/`, med kontrollerte API-svar og eksisterende Web Serial-mock. |
| `npm run test:browser` | PASS, 10 eksisterende adaptertester inkludert nettleserbenchmark. Målingene er oppdatert i `input-browser-benchmark.json`. |
| `npm run catalog:commands` | PASS. Ti gjennomgåbare registreringskommandoer genereres; ingen databaseoperasjon kjøres. |
| `git diff --check` | PASS. |
| Desktop/mobil | Visuelt inspisert skjermbilder ved 1280 og 390 px. Ingen horisontal overflyt i de testede sidene. |

## Dekket av nye tester

- Same-origin, JSON/CSRF, tomt 204-svar, proxyfeil uten JSON og avvist vilkårlig API-URL.
- Eierbundet forsøk, eksakt omforsøk etter tapt bekreftelse, avvisning av annen eier,
  og avvisning av motstridende/feilidentifiserte lagringssvar.
- Registerets eksakte UUID-/regelkontroll, Snake-rangering, deterministisk mat,
  første sving, dødelig steg, vegger og beskyttelse av kroppskopi.
- Vikings faste fysikksteg og repeterbarhet, hopp og B som sperre for hopp.
- Launcher med alle fem spillfamilier, offentlig Testlab ved feilende og ved
  hengende katalogkall. Ingen session-renew/resultatinnsending fra Testlab.
- Faktiske nettleserstrømmer mot produksjonsadapteren i Testlab, sensorverdier,
  tellere fra count, lokal bilderedigering, korrekt IMAGE-kommando og reset STOP/CLEAR.
- Start sperret uten micro:bit, renew før start, fysisk tap i mock, kobling til samme
  logiske økt, eksplisitt fortsett, ufullført resultat ved bekreftet restart.
- Registrering uten automatisk innlogging, beskyttet Dashboard, AI som ren tekst
  (HTML-lignende svar lager ingen HTML-elementer) og reset mot avtalt rute.
- Normal Snake-avslutning, avkodet mat/steg, ett lagret completed-forsøk, pokal bare
  ved validert `created`, og restart uten å sende forrige resultat igjen.
- Privat Dashboard med ufullført/null, fremheving via eksakt forsøks-ID, og separat
  tomtilstand for personlige rekorder.
- Profilens passordendring og tilbakeføring til innlogging uten localStorage-data.
- Alle fem spill lastes i samme ramme; egendefinert øvingsseed fører ikke til innsending.
- Offentlig toppliste og rekordhistorikk uten innlogging, med korrekt Snake-formatering.
- Lasting på mobil, lokale filer og ingen 404 fra ressursene som brukes i testen.

## Grenser for evidensen

Dette er programvarekontroller, ikke samlet godkjenning av alle TWEB/GI/TLAB/MS/VD-
scenarioer. Nettlesertestene bruker kontrollerte kontoer og katalogdata. De beviser
ikke faktisk HTTPS-cookie/CSRF-integrasjon, databaseeierskap, kontosletting eller
atomisk resultat-/rekordlagring på Parrot. Ingen ny registrering eller publisering
på produksjon er gjort. Spillene må registreres og `dist/` publiseres sammen med API-et.

Fysisk V2/firmware, native USB-tillatelsesdialog, faktisk håndtering av alle
spillkontroller, instrumentert fysisk latens, fem minutters faktisk UI/USB-soak og
heaptrend er **ikke kjørt**. Langtidsbalanse, alle menykombinasjoner, eksport ved
full UI-buffer, alle Viking-hindermønstre og integrert AI-forklaring av Snake-score
må verifiseres før full produktakseptanse. De er ikke merket PASS gjennom mocks.

Den eksisterende nettleserbenchmarken bruker akselerert logisk tid og måler
adapteren; den er ikke en faktisk langkjøring av den nye Testlab-visningen.
