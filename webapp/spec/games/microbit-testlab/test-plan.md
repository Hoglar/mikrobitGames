# Micro:bit Testlab – testplan

**Status:** Planlagte tester, 2026-10-27. Ingen testkode eller produktmålinger foreligger.

Planen kontrollerer [spesifikasjonen](specification.md) og [implementasjonsdesignet](implementation-design.md). Felles protokoll- og adapteroppførsel dekkes av [input-testplanen](../../game-input-test-plan.md).

## Testgrunnlag

Enhetstester bruker faste inputdata og styrt klokke for tellere, opptak og eksport. Nettlesertester kontrollerer betjening og visning. Fysisk Micro:bit V2 brukes for å kontrollere samsvar mellom faktisk handling, skjermrespons og output. Testdata i automatiserte tester innebærer ingen simuleringsmodus i produktet.

## Scenarioer og forventede resultater

| ID | Krav | Test og forventet resultat |
| --- | --- | --- |
| TLAB-01 | WEB-001 | Åpne uten innlogging og backend. Testlab er tilgjengelig og sender ingen resultater. |
| TLAB-02 | WEB-002 | Lever kjente sensorverdier. Alle inputkilder vises riktig; manglende data fremstilles ikke som reelle nullverdier. |
| TLAB-03 | WEB-003 | Trykk, hold, berør, vipp og rist. Riktig visuell respons og korrekt telling, også ved flere trykk i én hendelse. |
| TLAB-04 | WEB-004 | Endre temperatur, lys og lyd. Separate grafer viser riktig historikk og opphold ved datagap. |
| TLAB-05 | WEB-005 | Rediger og send hver outputtype med mus og tastatur. Redigering alene sender ingenting; ugyldige verdier avvises. |
| TLAB-06 | WEB-006 | Prøv bekreftelse, avvisning og timeout. Riktig status vises; forhåndsvisning forveksles ikke med fysisk avlesning. |
| TLAB-07 | WEB-007 | Kontroller status, mottaksrate og alder med kjent datatilførsel. Feil og ugyldige meldinger holder ikke sensorstatus frisk. |
| TLAB-08 | WEB-008 | Koble fra og til. Siste verdier merkes utdaterte, editorverdier beholdes og gamle kommandoer sendes ikke på nytt. |
| TLAB-09 | WEB-009 | Start, pause, fortsett og stopp. Bare aktive perioder tas opp; avbrutt bekreftelse ved ny start beholder tidligere data. |
| TLAB-10 | WEB-010 | Bryt forbindelsen under opptak. Samme opptak fortsetter med synlig datagap og gjenoppretting. |
| TLAB-11 | WEB-011 | Fyll begge buffere. Grensene holdes og eldste data fjernes. Kontroller redusert sensoropptak uten fabrikering av manglende målinger. |
| TLAB-12 | WEB-012 | Registrer input, output og feil; fold loggen inn/ut. Hendelsene beholdes uten dobbeltføring. |
| TLAB-13 | WEB-013 | Eksporter og les JSON/CSV tilbake. Innhold, tider og enheter stemmer med bevarte opptaksdata. |
| TLAB-14 | WEB-014 | Nullstill med aktive tellere, lyd og display. Lokale data tømmes og enheten ryddes uten normal frakobling; feil vises. |
| TLAB-15 | WEB-015 | Bytt spill. Gamle abonnementer og outputhandlinger følger ikke med til det nye spillet. |
| TLAB-16 | WEB-016 | Kjør lenge nok til flere bufferomløp, med grafer, logg og eksport. Minnebruk og respons måles; beholdte data vokser ikke utover grensene. |

## Gjennomføring og rapportering

Kontroller fysisk display og lyd i tillegg til kommandobekreftelsen. Bruk et asymmetrisk bilde for å oppdage feil pikselrekkefølge. Bare maskinvaretester hoppes over dersom enheten mangler; programvaretestene skal fortsatt kunne kjøres.

Rapporter krav/test-ID, versjon, miljø, forventet og faktisk resultat samt PASS/FAIL/SKIPPED/BLOCKED med begrunnelse. Manglende adapterdiagnostikk som hindrer en kontroll rapporteres som BLOCKED.

Kjørbare tester legges under `webapp/tests/`, måleskript under `webapp/verification/` og utvalgte resultater under `webapp/results/`. Registrer minnebruk, eksportstørrelse og respons under samme belastning mellom målinger. Ingen ytelse regnes som verifisert før resultatene foreligger.
