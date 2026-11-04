# Medfølgende micro:bit-firmware

`microbit-v2.hex` er den ferdigbygde V2-firmwaren for protokoll v1. Alle som bruker samme støttede maskinvare kan bruke denne filen, uavhengig av PC, operativsystem og spill. Den versjoneres som en distribuert ressurs slik at lokal spilling og hosting ikke krever CODAL eller en Arm-kompilator. `release.json` dokumenterer størrelse, SHA-256, kildehasher, byggetid, kompilator og avhengighetspins. HEX-filen beholder identiske bytes ved Git-utsjekking.

Webbygget kontrollerer filens hash og kopierer bare HEX til `dist/firmware/microbit-v2.hex`. Utviklingsserveren tilbyr samme URL. Lokale firmwarekilder og `microbit/build/` brukes ikke ved hosting; endringer der erstatter heller ikke automatisk den distribuerte utgaven.

Ved en ny firmwareutgave bygger vedlikeholderen med [firmwareverktøyet](../../../../microbit/README.md#build-and-test), og kjører fra `webapp/`:

```sh
npm run firmware:update
```

Kommandoen kontrollerer byggets artefakt- og kildehasher før den oppdaterer HEX og `release.json`. Kontroller [maskinvaretestene](../../../../microbit/spec/test-plan.md) før publisering og ta med begge filene i versjonskontrollen. Bygg på nytt bare når selve firmwaren eller støttet maskinvare/protokoll endres. Vanlige nye spill trenger ingen ny firmware. Enheten må være V2; filen støtter ikke V1.
