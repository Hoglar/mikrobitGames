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
| FoM (Figure of Merit) | Hvordan utvikler en valgt, målbar egenskap seg gjennom iterasjonene? | p95-responstid for rekordregistrering under samme avtalte arbeidslast. |

Tester er en del av verifiseringen. Verifisering omfatter også modellkontroll og gjennomgang av om testene faktisk undersøker kravene. Integrasjonstester erstatter ikke oppgavens enhetstester. Enhetstester alene beviser heller ikke at databasekoblingen virker.

Et nyttig tillegg er **validering**: Har vi laget noe som fungerer for brukeren? Eksempel: Spill et helt spill, la sesjonen måtte fornyes, og sjekk at resultatet kan leveres uten at spilleren mister fremgangen. Oppgaveteksten bruker ikke dette som et eget vurderingspunkt, men det er en nyttig praktisk kontroll.

## En gjennomførbar utviklingsløkke

1. **Velg ett lite mål.** Eksempel: Registrere første rekord og beholde forrige rekord ved forbedring. Identifiser relevante krav og skriv forventede resultater før kodegenerering.
2. **Gi AI et avgrenset grunnlag.** Relevant kontrakt, datamodell, krav-ID-er og testtilfeller. Be om en liten implementasjon og relevante tester. Testforventninger må begrunnes i kravene, ikke genereres fra det koden allerede gjør.
3. **Kjør enhetstester og integrasjonstester.** Kontroller også innholdet i testene. Rett avvik, og behold tidligere tester slik at nye endringer ikke ødelegger gammel oppførsel.
4. **Verifiser mot modell og krav.** Trekk ut faktisk databaseskjema automatisk, og sammenlign det med en strukturert forventning fra datamodellen ved hjelp av faste regler. Samme modell og skjema skal gi samme avviksrapport; en AI-vurdering alene er ikke deterministisk verifisering. Knytt resultatene til krav-ID-er. Avvik må vurderes: Er koden feil, eller må kravet/modellen endres? Endre ikke fasiten bare for å få grønne tester.
5. **Kjør benchmark og registrer FoM på en dokumentert versjon.** Bruk samme last, datasett og målegrense. FoM kan bygge på ytelse eller modellavvik; benchmark og modellkontroll trengs fortsatt uansett hvilken FoM gruppen velger. Oppgi også feil og teststatus; rask feilrespons skal ikke fremstå som forbedret ytelse.
6. **Analyser og velg neste endring.** Forklar hva som ble bedre eller dårligere, lag en hypotese om årsaken, og gjør en målrettet endring. Oppdater spesifikasjonen hvis designet endres. Gjenta fra trinn 1.

Den viktige delen etter målingen er altså **analyse og forbedring**. Å generere hele løsningen på nytt uten å bruke avvikene og målingene gir svakere grunnlag for å vise en kontrollert utviklingsprosess.

## En enkel FoM å vurdere

For backend foreslås foreløpig **p95-responstid for registrering av resultat** ved kontraktens faste last. p95 betyr at 95 % av observasjonene er like raske eller raskere enn denne tiden. Lavere er bedre. Det er et forslag til bidrag i prosjektets felles FoM, ikke en ny vedtatt FoM for hele systemet.

- Hold testlast, fordeling mellom nye rekorder og ikke-rekorder, startdata, maskin og målegrense sammenlignbare.
- Rapporter antall kall, feilandel og korrekthets-/sikkerhetsstatus ved siden av FoM. En raskere løsning som mister data består ikke verifiseringen.
- Bruk en definert beregningsmetode for persentilen i måleverktøyet, og behold den mellom iterasjoner.
- Andel beståtte tester og kodedekning er nyttig støtteinformasjon, men blir ikke automatisk en god FoM. Flere enkle tester kan øke prosentene uten å gjøre systemet bedre.
- Hvis gruppen velger en samlet FoM, må beregning og eventuelle vekter være dokumentert. Ikke bland millisekunder og prosent til et vilkårlig tall.

## Baseline og sporbarhet

Planlegg målemetoden fra starten, og etabler baseline som første aktivitet ved implementeringen. For responstid betyr det å måle første kjørbare versjon **før forbedringsiterasjonene**. Oppgaven krever minst tre datapunkter totalt: baseline og minst to senere målinger. Prosjektplanen legger opp til baseline pluss minst tre etterfølgende målepunkter, altså fire totalt; det er et strengere internt mål. Før koden kan kjøres finnes ingen ærlig responstidsmåling; marker da «ikke målbart ennå», ikke null millisekunder. Baseline kan ha feil, men disse skal registreres og ikke skjules.

| Målepunkt | Hva som lagres |
| --- | --- |
| Baseline | Første målbare versjon, commit, teststatus, miljø, FoM og kjente avvik. |
| Iterasjon 1 | Hypotese/endring, samme måling, testresultater og tolkning av forskjellen. |
| Iterasjon 2 | Ny målrettet endring og sammenlignbar måling. |
| Iterasjon 3 | Ny målrettet endring og sammenlignbar måling. |

Behold også regresjoner. Endres målemetoden eller testlasten vesentlig, marker ny måleserie eller kjør tidligere baseline med den nye metoden. Ingen resultater skal fylles ut på forhånd.

## Hvor materialet hører hjemme

- Enhetstester: [tests/unit](../tests/unit/README.md).
- Backend–database-integrasjonstester: [tests/integration](../tests/integration/README.md).
- Modelluttrekk og benchmarks: [verification](../verification/README.md).
- Resultater: [results](../results/README.md), med dato, commit, krav-ID, metode og forventet/faktisk resultat.
- Felles FoM-plan og utviklingskurve: [results/fom](../../results/fom/README.md).

WBS 1.4 beskriver kontrakten og hvordan den kan kontrolleres. Kjørbar testkode, faktiske målinger og forbedringsiterasjoner hører til de senere implementeringsarbeidspakkene. Vi planlegger dem nå; vi hevder ikke at de er gjennomført.
