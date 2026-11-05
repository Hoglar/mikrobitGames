# Tetris, spillflate og tilkobling – 5. november 2026

Kilde: `d54d01239620c0210b2ae0c2df298750c42669b9`, hentet med fast-forward
fra GitHub. Testene startet fra ren arbeidsmappe. Ingen produktkode eller
testforventninger ble endret under denne gjennomgangen.

## Hva oppdateres?

- Tetris får mer stabil tiltstyring og beskyttelse mot utilsiktet sideflytting
  samtidig med drop.
- Spillflaten tilpasses på nytt etter asynkron lasting og størrelsesendringer,
  slik at Tetris ikke blir stående med tom canvas.
- Spillene får felles lyd- og volumkontroller.
- Tilkobling håndterer rester fra en tidligere serial-økt. Spill pauser straks
  input forsvinner, og spillbytte bruker en dialog som ikke blokkerer sensorstrømmen.

Backend, databasemigreringer og firmware er uendret. Alle 47 spill-ID-er og
poengregler er sammenlignet med installert katalog og bevart. Det nye bygget
inneholder 120 filer og syv spillpakker. Bygget og katalogen er validert før
publisering; SHA-256 er kontrollert for hver fil.

## Testresultater

[Full måling: 20261105T192832.581524Z](../fom/app/runs/20261105T192832.581524Z/report.md).

| Område | Resultat |
| --- | --- |
| Måleverktøyets egenkontroll | 64/64 bestått |
| Webapp og spillregler | 102/102 bestått |
| Inputbibliotek | 45/45 bestått |
| Backendens enhetstester | 76/76 bestått |
| Firmware på vertsmaskinen | 3/3 bestått |
| Koblinger mellom komponenter | 3/3 bestått |
| App i Chromium | 62/62 bestått |
| Input i Chromium | 10/10 bestått |
| Separat SDK-kontroll | 13/13 bestått |
| Kapasitetskontroll | Bestått |
| Benchmarks | 14/14 profiler innenfor budsjettene |

Teknisk skår, funksjon og ytelse er alle **100/100**. Brukeren ga **10/10**
med begrunnelsen «vi er fornøyde nå», med Martin som vurderer. Samlet
**FoM er 100,00/100**. Flere tester og endret kontrollgrunnlag gir en ny
serie (`216cc22a506d`); tidligere resultater beholdes.

[SDK-loggen](../fom/app/runs/20261105T192832.581524Z/sdk-additional.log) dekker
spillisolasjon, lokale rekorder og online-resultatflyt. Disse kontrollene er
kjørt i tillegg og gir ikke ekstra FoM-poeng.

## Publisering

Brukeren publiserte med det installerte `publish-web.py`. Det synkroniserer
katalogmetadata og bytter webpakken atomisk. Eksisterende kontoer og rekorder
beholdes. Ingen backendinstallasjon eller omstart var nødvendig.

- Offentlig adresse: https://parrot.tail106c62.ts.net.
- Ny webpakke: `/var/www/mikrobit-games/releases/20261105T193535179131Z`.
- Forrige webpakke: `/var/www/mikrobit-games/releases/20261104T174046514278Z`.
- Backend er fortsatt `/opt/mikrobit-games/releases/20261104T174028332774Z-2c209f27`.

Etter publisering ble alle **120 filer** sammenlignet med SHA-256 mot det
testede bygget, både på disk og via offentlig HTTPS. Helseendepunktet svarte
`{"status":"ok"}`, og alle seks driftstjenester var aktive. API-et viste 49
spilloppføringer: 47 spillvarianter fra katalogen og to tidligere demospill.
ID, poengregler, innholdshash og SDK-metadata samsvarte for alle 47 varianter.

Den offentlige Chromium-kontrollen brukte ekte API og kontrollerte syv spillkort,
47 topplister, forsidebilder, firmwarelenke og mobilbredde 390 px. Ingen
JavaScript-feil eller horisontal overflyt ble funnet. Kontrollen skrev ingen
kontoer, rekorder eller andre spillerdata.

Første nettleserkontroll leste bildestatus før innlastingen var ferdig og
stoppet med `8 !== 0` ved kontroll av ventende/ødelagte bilder. Oppfølgingen
logget bildestatus før og etter eksplisitt venting på innlasting. Alle bildene
ble komplette med bredde 512 px, og hele kontrollen bestod. Dette rettet
ventingen i det separate kontrollskriptet; produktkoden og FoM-testpakken ble
ikke endret. [Kontrolloggen](../fom/app/runs/20261105T192832.581524Z/public-browser-check.log)
bevarer observasjonene.

[Maskinlesbar publiseringskontroll](frontend-publication-2026-11-05.json) ·
[SHA-256-manifest for publisert bygg](frontend-publication-2026-11-05-manifest.json)

## Avgrensning

Testmiljø: Parrot, Node 20.19.2 og Python 3.13.5. Repoet anbefaler Node
24.22.1; denne kjøringen bruker samme lokale Node-versjon som tidligere målinger.
Browser-testene bruker Chromium med simulert Web Serial og API.
Fysisk micro:bit/USB, faktisk spillefølelse, ekte Qwen-svar og den lange
backendprofilen (`./backend/check`) er ikke kjørt på nytt.

[Samlet utviklingsoversikt](../fom/app/overview.md)
