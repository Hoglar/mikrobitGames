# Spillisolasjon og SDK publisert – 4. november 2026

Versjon **`2c209f27bbc840b19c2218c3c9ebd0b63264b67d`** er publisert på
**https://parrot.tail106c62.ts.net**. Alle sju spill bruker nå den felles
spillverten med isolerte spillvinduer, manifestbasert katalog og lokale rekorder.
Nettsiden tilbyr også nedlasting av den medfølgende micro:bit V2-firmwaren.

Dette er en publiseringskontroll, **ikke en ny FoM-måling**. Ingen ny brukerskår
eller lang benchmarkkjøring er registrert. Tidligere målinger er uendret.

## Hva ble kontrollert?

| Kontroll | Resultat | Hva resultatet viser |
| --- | --- | --- |
| Frontendens enhets- og inputtester | **134/134 bestått** | Spillregler, SDK/katalog, resultatkoding og inputadapter. |
| Backendens enhetstester | **76/76 bestått** | Backendregler, inkludert de nye katalog-/scorekontrollene. |
| Supplerende AI-scorepresentasjon | **6/6 bestått** | Dekoding av legacy- og SDK-resultater; ingen modellkjøring. |
| Vanlige app-/nettlesertester | **45/46 bestått, 1 feil** | Spillstart, konto-/resultatgrensesnitt, topplister og rendering med simulert API og Web Serial. Lokal Tetris-start bestod. |
| Egen SDK-/spillkassettpakke | **13/13 bestått** | Sju isolerte spill, lokale rekorder, import/eksport, meldingsgrenser og online-resultatflyt med testdata. |
| Migrering og katalogsynk i PostgreSQL 17 | **Bestått** | Ny privat testdatabase, migrering 001 → 002, syntetiske eksisterende rekorder og forsøk. Ingen TCP-port eller driftsdata brukt. |
| Ekte API mot testdatabasen | **Bestått** | Katalogmetadata, opprettelse/innlogging, resultatlagring, idempotent replay og avvisning av ugyldig kodet score. HTTP ble kjørt gjennom TestClient, ikke offentlig nettverk. |
| AI-leserolle i testdatabasen | **Bestått** | Leser metadata og dekoder rekorder; tilgang til private forsøk og skriving er fortsatt avvist. |
| Publiseringsskriptets feilgrener | **Bestått med simulerte tjenester** | Katalogfeil beholder gammel webpakke; feil i helsesjekk gjenoppretter gammel webpakke. Dette var ingen faktisk produksjonsrollback. |
| Offentlig HTTPS og installerte filer | **119/119 filer samsvarer** | SHA-256 sammenlignet med det validerte bygget, både på disk og over HTTPS. |
| Offentlig API-katalog | **47 SDK-varianter kontrollert** | Alle ID-er, navn, scoregrenser, retninger, regelfingeravtrykk og innholdshasher samsvarer. De to tidligere demospillene er også beholdt: 49 API-oppføringer totalt. |
| Offentlig nettleser, uten API-mocker | **Bestått** | Sju spillkort/omslag, 47 topplister, firmwarelenke og mobilbredde 390 px. Ingen JavaScript-feil eller produksjonsskrivninger. |
| Driftstjenester | **6/6 aktive** | Database, API, AI, Ollama, Caddy og Tailscale. Aktiv tjeneste er ikke i seg selv en test av AI-svarkvalitet. |

## Kjent avvik – eksplisitt godkjent før publisering

`viking.spec.js:45`, «Viking stage keeps its scenery visible and supports optional
sound through start and pause», forventet `AudioContext.state == running`, men
fikk `closed`. Feilen oppstod både i hele nettleserpakken og ved én isolert
omkjøring med uendret kode/test.

I begge feilsnapshotene var spillet allerede i **RESULTAT**, med en avsluttet
runde på **27 meter**. Dette forklarer at lyden var stoppet på måletidspunktet;
kontrollen dokumenterer ikke at lyd gjennom hele spill-/pauseforløpet er riktig.
Testen er fortsatt registrert som feil. Ingen forventninger, frister eller
produktkode ble endret for å få grønt resultat. Brukeren valgte uttrykkelig
**«Publiser med kjent testavvik»**.

## Databevaring og faktisk utrulling

- Før endringene ble det tatt en privat PostgreSQL-backup:
  `/var/backups/mikrobit-games/before-sdk-20261104T174027Z.dump`.
  Arkivlisten ble lest med `pg_restore --list`; produksjonskopien er ikke
  gjenopprettet som del av denne kontrollen.
- Migrering `002_game_sdk.sql` legger til metadata og utvider AI-visningen.
  Migrering og katalogsynk sletter eller renummererer ingen forsøk/rekorder.
  Bevaring, gjentatt synk og full transaksjonsrollback ved regelkonflikt ble
  kontrollert med syntetiske data før utrulling.
- Eksisterende 47 spillkontrakter ble sammenlignet med driftskatalogen før
  publisering. Alle var identiske. Ingen kontoer eller rekorder ble opprettet
  i drift av verifikasjonen.
- Backendrelease: `/opt/mikrobit-games/releases/20261104T174028332774Z-2c209f27`.
- Webrelease: `/var/www/mikrobit-games/releases/20261104T174046514278Z`.
- Tidligere releaser beholdes. Ingen nye offentlige porter ble åpnet.

Første forsøk på å hente samtlige filer over mange separate HTTPS-forbindelser
ble avbrutt av en TLS-forbindelsesfeil. Den komplette sluttkontrollen brukte
forbindelsesgjenbruk og vanlig sertifikatverifisering; alle 119 filer samsvarte,
uten transportomforsøk i denne kjøringen. Dette er ingen langtidsmåling av nettet.

## Avgrensning og videre måling

Miljøet var Parrot, Node **20.19.2** / npm **9.2.0**, Python **3.13.5** og
PostgreSQL **17**. Repoet anbefaler Node **24.22.1**; npm meldte dette avviket.
Den første sandbox-kjøringen av frontendtestene rapporterte bare 13 filgrupper;
den detaljerte kjøringen utenfor sandkassen bekreftet de **134 individuelle testene**.

Fysisk micro:bit/USB, spilling fra skolen, ekte Qwen-svar og lange ytelsesprofiler
ble ikke testet i denne runden. Nettlesertestene før publisering brukte simulert
Web Serial. Den offentlige kontrollen var skrivebeskyttet og kontrollerte ikke
innsending av en fysisk spilt runde.

Brukeren starter neste komplette evaluering selv:

```bash
python3 tests/evaluate.py run --label "02 – spillisolasjon og SDK"
```

Prøv den samme versjonen før brukerskåren registreres. SDK-testpakken er kjørt
separat her; de 13 kontrollene er ikke lagt til som ekstra FoM-poeng. Endret
kontrollgrunnlag gir egen serie etter eksisterende regler.

[Maskinlesbar publiseringskontroll](sdk-publication-2026-11-04.json) ·
[Samlet utviklingsoversikt](../fom/app/overview.md)
