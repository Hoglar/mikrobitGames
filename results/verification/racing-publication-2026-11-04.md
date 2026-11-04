# Micro Racer og nytt sidedesign publisert 4. november 2026

Frontend og backend fra ren commit `177131ddc87124df89e32bd9cc7e1fb6246b21d9`
er publisert på https://parrot.tail106c62.ts.net.

- Backend: `/opt/mikrobit-games/releases/20261104T090740862356Z-177131dd`.
- Webpakke: `/var/www/mikrobit-games/releases/20261104T090808776107Z`.
- Forrige webpakke er beholdt: `/var/www/mikrobit-games/releases/20261029T203201259102Z`.
- 57 offentlige filer og sju spillfamilier; 47 aktive spillvarianter, inkludert
  36 nye Micro Racer-varianter. To gamle demospill er beholdt, totalt 49 katalograder.

Brukeren kjørte det klargjorte skriptet med sudo. Det tok privat databasebackup
før backendoppdatering og registrering med eksisterende administrasjonsverktøy.
Eksisterende ID-er, regler, kontoer og rekorder ble ikke endret av operasjonene.
Backendoppdateringen inkluderer dekoding av `racing_rank_v1` for AI-verktøyene:
plassering og tid presenteres separat. API- og databasemigreringer er uendret.

## Kontroll etter publisering

Kontrollert 2026-11-04 kl. 09:09 UTC gjennom offentlig HTTPS og Chromium:

| Kontroll | Resultat |
| --- | --- |
| API-helse | PASS: `status: ok` |
| Seks driftstjenester, inkludert Tailscale | Alle aktive |
| Installerte webfiler og offentlig byggmanifest | Alle 57 samsvarer med det kontrollerte bygget |
| Installert AI-kode | Samsvarer med kildekoden, inkludert racingpresentasjon |
| Offentlig katalog | Alle 47 ID-er, navn, aktivstatus og poengregler samsvarer |
| Ny spillvelger | Sju spillkassetter, inkludert Micro Racer |
| Offentlige topplister | 47 lenker, hvorav 36 racingvarianter |
| Tidskjøring og AI-løp | Begge toppliste-API-er svarte HTTP 200 med riktig poengenhet |
| Racing uten innlogging | Krever innlogging før spilling |
| JavaScript-feil i besøkte sider | Ingen observert |

[Maskinlesbare kontroller og SHA-256-manifest](racing-publication-2026-11-04.json).
Kontrollene opprettet ingen brukerkontoer eller resultater.

## Testgrunnlag og begrensninger

Den [siste appevalueringen](../fom/app/runs/20261104T084043.311188Z/report.md)
har 261 av 262 tester bestått, alle målte benchmarks bestått, teknisk skår
99,83/100 og FoM 95,86/100 etter Martins UX-skår 8/10. Den tidligere versjonen
har UX-skår 5/10, men mangler komplett automatisk måling og samlet FoM.
Disse målingene ble ikke kjørt på nytt ved publisering.

Den kjente lokale Tetris-starttesten feiler fortsatt og er ikke endret for å
publisere. Fysisk Micro Racer-spill, USB og resultatlagring fra skole-PC er ikke
verifisert i denne kontrollen. Qwens racingbesvarelser er ikke målt med ekte
modell etter oppdateringen. Brukerne bør avslutte pågående runde og deretter
oppdatere nettsiden for å laste det nye bygget.
