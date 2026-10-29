# Micro:bit Testlab – spesifikasjon

**Implementasjon 2026-10-29:** Kode er levert i webappen. Se [implementasjonsnotatet](../../webapp-implementation.md) og [verifikasjonsrapporten](../../../results/webapp-validation.md). Statuslinjen nedenfor beskriver spesifikasjonens opprinnelige baseline; full produkt-/maskinvareakseptanse gjenstår.

**Status:** Forslag basert på brukerens avklaringer, 2026-10-27. Ingen implementasjon eller målinger foreligger.

## Formål og grensesnitt

Testlab er en fri testflate i spillvelgeren. Brukeren skal kunne undersøke alle inputkilder, sende output til Micro:bit og ta opp data for senere gjennomgang. Første versjon bruker bare faktiske data fra Micro:bit V2 og har ingen poeng eller rekordlagring. Den åpnes uten innlogging, sesjonsfornyelse eller backendregistrering som et uttrykkelig lokalt verktøy i Launcher. Tilkoblingspanelet kan åpnes uten enhet; input/output og adapterens spillsesjon krever klar forbindelse.

Spillet bruker [det felles Micro:bit-API-et](../../../../spec/contracts/microbit-webapp/web-page-developer-interface.md). Sensorsemantikk, outputgrenser og kommunikasjon følger API-et og [serieprotokollen](../../../../spec/contracts/microbit-webapp/microbit-serial-protocol.md).

## Input og visning

Visningen kombinerer sensorverdier med en figur formet som en Micro:bit. Alle inputkilder skal være synlige samtidig.

| Input | Visning |
| --- | --- |
| A, B og logo | Markeres på figuren ved aktivering, med egen trykkteller for hver. |
| Tilt og akselerasjon | Figuren vipper med enheten. Tilt, akselerasjon i X/Y/Z og beregnet styrke vises numerisk. |
| Rist | Kort risteanimasjon og egen teller. |
| Temperatur, lys og lyd | Tallverdier og separate historikkgrafer. Mikrofonens stille/høyt-klassifisering vises også. |

Tellerne bruker adapterens registrerte hendelser. Sensorverdier og avledede tolkninger skal skilles tydelig.

## Output

Brukeren kan skrive egen displaytekst, tegne et 5×5-bilde med lysstyrke per punkt og velge tonefrekvens, varighet og volum. Melodier, tilgjengelige innebygde lyder, tømming av display og stopp av lyd skal også kunne testes.

Output sendes med «Send» eller hurtigtast, ikke fortløpende under redigering. Kommandoen og dens bekreftelse eller feil vises. Figurens LED-matrise forhåndsviser forventet output; faktisk bilde eller lyd kontrolleres på enheten. En bekreftelse betyr startet/anvendt kommando, ikke ferdig avspilling.

## Krav og kontroll

| ID | Krav | Test |
| --- | --- | --- |
| WEB-001 | Tilgjengelig fra spillvelgeren uten innlogging eller avhengighet til backend. | TLAB-01 |
| WEB-002 | Alle inputkilder vises med faktiske verdier og relevante tolkninger. | TLAB-02 |
| WEB-003 | Figuren følger tilt og markerer A/B/logo og rist, med separate tellere. | TLAB-03 |
| WEB-004 | Temperatur, lys og lyd har hver sin historikkgraf. | TLAB-04 |
| WEB-005 | Beskrevne outputtyper kan redigeres og sendes med knapp eller tastatur. | TLAB-05 |
| WEB-006 | Kommando, bekreftelse og feil vises. LED-forhåndsvisningen merkes som forventet output. | TLAB-06 |
| WEB-007 | Tilkoblingsstatus, mottaksrate, tid siden siste gyldige data og feil vises. | TLAB-07 |
| WEB-008 | Ved brudd beholdes siste verdier merket utdaterte og outputinnstillinger beholdes. Sending sperres; kommandoer gjentas ikke automatisk. | TLAB-08 |
| WEB-009 | Opptak har start, pause/fortsett og stopp. Ny start krever bekreftelse før ikke eksporterte data erstattes. | TLAB-09 |
| WEB-010 | Aktivt opptak fortsetter gjennom forbindelsesbrudd og viser opphold uten konstruerte sensordata. | TLAB-10 |
| WEB-011 | Opptak begrenses til 3 000 sensormålinger ved ti målinger per sekund og 1 000 logghendelser. Eldste data fjernes ved full buffer. | TLAB-11 |
| WEB-012 | Hendelsesloggen kan foldes inn/ut og viser inputhendelser, outputkommandoer, utfall og feil. | TLAB-12 |
| WEB-013 | Hele opptaket kan eksporteres som JSON og sensorhistorikken som CSV. | TLAB-13 |
| WEB-014 | «Nullstill test» tømmer logg, historikk og tellere, stopper lyd og tømmer display uten å koble fra. Feil ved opprydding vises. | TLAB-14 |
| WEB-015 | Felles adapter brukes, med opprydding av spillsesjonen ved spillbytte. | TLAB-15 |
| WEB-016 | Minnebruk og respons holdes begrenset og måles ved implementasjon. | TLAB-16 |

## Opptak og lagring

Start begynner et nytt opptak. Pause og fortsett gjelder samme opptak; stopp avslutter og beholder data klare for eksport. Livevisningen fortsetter uavhengig av opptaket. Loggen registreres automatisk, uten manuelle vurderinger av samsvar eller avvik.

Sensorbufferen rommer omtrent fem minutter ved sammenhengende opptak. Historikken skal vise tidsopphold ved pause og forbindelsesbrudd. JSON inneholder bevarte sensormålinger, hendelser og kommandoer; CSV inneholder sensorhistorikken. Eksporten skal angi tid, enheter og om eldre data er fjernet.

Data mellomlagres i nettleserens minne og forsvinner ved lukking eller oppdatering av siden. Det lagres ingen opptak i backend.
