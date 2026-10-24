# Tester, verifisering og FoM i iterativ utvikling

Dette er en kort arbeidsveiledning for senere backend-utvikling. Den bygger på prosjektets issues, [vedtatte prosjektstruktur](../../docs/project-structure.md) og oppgaveteksten for oppgave 2 som ble delt 23. oktober 2026.

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

[Implementeringsplanen](implementation-plan.md) beskriver kontrollsett, vekter, baseline og ansvarsfordeling. [Kjøreoversikten](../verification/README.md) er den korte veiledningen for gruppen.

Først lager vi kontrollgrunnlaget fra kravene og sjekker verktøyene med kjente feil. Deretter bestiller brukeren samlet implementering av database, API og AI. Brukeren lagrer versjonen og starter kontrollene; verktøyene rapporterer uten å endre kode. Brukeren analyserer resultatene og bestemmer om AI skal rette noe, modellen må avklares, eller arbeidet skal stoppe. Ingen automatisk rettingssløyfe.

Vi har valgt krav-FoM og modell-FoM, begge i prosent med lik vekt til database, API og AI. Faste kontrollpunkter og deltester hindrer at prosentene øker bare fordi noen legger til mange enkle tester. Benchmark beholdes som egen dokumentasjon av ytelse. Rask feilrespons skal ikke fremstå som forbedret ytelse.

Første fullstendige, målbare kontrollrunde er baseline før forbedringene. Oppgaven krever minst tre målepunkter totalt; brukeren bestemmer antall runder. Ufullstendige kjøringer lagres med årsak, men gir ikke komplett FoM. Behold også regresjoner. Endret kontrollgrunnlag krever ny serie eller ommåling av tidligere commits. Ingen resultater fylles ut på forhånd.

## Hvor materialet hører hjemme

- Enhetstester: [tests/unit](../tests/unit/README.md).
- Backend–database-integrasjonstester: [tests/integration](../tests/integration/README.md).
- Modelluttrekk og benchmarks: [verification](../verification/README.md).
- Resultater: [results](../results/README.md), med dato, commit, krav-ID, metode og forventet/faktisk resultat.
- Felles FoM-plan og utviklingskurve: [results/fom](../../results/fom/README.md).

WBS 1.4 beskriver kontrakten og hvordan den kan kontrolleres. Kjørbar testkode, faktiske målinger og forbedringsiterasjoner hører til de senere implementeringsarbeidspakkene. Vi planlegger dem nå; vi hevder ikke at de er gjennomført.
