# Tester, verifisering og FoM i iterativ utvikling

Dette er en begrepsforklaring for gruppen. Den bygger på prosjektets issues, [vedtatte prosjektstruktur](../../docs/project-structure.md) og oppgaveteksten for oppgave 2 som ble delt 23. oktober 2026. Den operative planen vedlikeholdes i [implementeringsplanen](implementation-plan.md).

Oppgaven krever enhetstester og benchmarks, automatisert modelluttrekk og deterministisk verifisering så langt det er mulig, samt en valgt FoM med minst tre datapunkter over tid. Dokumentene våre planlegger dette; de er ikke bevis på gjennomført verifisering. Systemet kan være en liten mock-up, men må vise at interaksjon med mikrokontrolleren fyller en database, og at et nettleserbasert dashboard med Web Serial viser informasjon fra databasen.

## Begreper som må holdes fra hverandre

| Begrep | Spørsmål det besvarer | Eksempel i dette prosjektet |
| --- | --- | --- |
| Enhetstest (unit test) | Gjør en avgrenset del av koden det den skal? | Er 120 bedre enn 100 i et poengspill, og er 55 000 bedre enn 60 000 i et tidsspill? |
| Integrasjonstest | Virker flere deler sammen? | Sender backend en ny rekord til PostgreSQL, og finnes riktig rad etter commit? |
| Benchmark | Hvordan yter løsningen under en definert belastning? | Måle tiden for rekordregistrering med samme datasett og antall samtidige kall. |
| Verifisering | Har vi bevis på at implementasjonen følger kravene og modellen? | DB-002 kobles til en transaksjonstest; faktiske fremmednøkler sammenlignes med datamodellen. |
| FoM (Figure of Merit) | Hvordan utvikler en valgt, målbar egenskap seg gjennom iterasjonene? | Andel av de faste krav- eller modellkontrollene som består, med avtalte vekter. |

Tester er en del av verifiseringen. Verifisering omfatter også modellkontroll og gjennomgang av om testene faktisk undersøker kravene. Integrasjonstester erstatter ikke oppgavens enhetstester. Enhetstester alene beviser heller ikke at databasekoblingen virker.

Et nyttig tillegg er **validering**: Har vi laget noe som fungerer for brukeren? Eksempel: Spill et helt spill, la sesjonen måtte fornyes, og sjekk at resultatet kan leveres uten at spilleren mister fremgangen. Oppgaveteksten bruker ikke dette som et eget vurderingspunkt, men det er en nyttig praktisk kontroll.

## Den avtalte arbeidsmåten

[Implementeringsplanen](implementation-plan.md) er fasit for byggerekkefølge, kontrollsett, FoM-vekter, baseline, rapportstatus og brukerbestilte rettingsrunder. [Kjøreguiden](../verification/README.md) beskriver kommandoene og hvordan resultatet leses. Denne begrepsforklaringen vedlikeholder ikke en egen versjon av prosessen.

## Hvor materialet hører hjemme

- Enhetstester: [tests/unit](../tests/unit/README.md).
- Backend–database-integrasjonstester: [tests/integration](../tests/integration/README.md).
- Modelluttrekk og benchmarks: [verification](../verification/README.md).
- Resultater: [results](../results/README.md), med dato, commit, krav-ID, metode og forventet/faktisk resultat.
- Felles FoM-plan og utviklingskurve: [results/fom](../../results/fom/README.md).

WBS 1.4 beskriver kontrakten og hvordan den kan kontrolleres. Testkode er nå skrevet, mens kjøring mot de faktiske komponentene og forbedringsiterasjonene gjenstår. Dokumentasjon og testkode alene er ikke bevis på at systemet virker.
