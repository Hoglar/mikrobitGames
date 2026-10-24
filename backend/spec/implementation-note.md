# Notat: felles implementering og iterativ utvikling

**Dato:** 2026-10-24. Tas opp igjen etter at AI- og backendmodulen er planlagt. Dette er et utgangspunkt for en felles implementeringsplan, ikke en ferdig gjennomføringsplan.

## Retning

Planlegg implementeringen av database, backend og AI samlet, inkludert grensesnittet mot nettsiden. Bygg små, sammenhengende deler og test samspillet tidlig. Et mulig første steg er registrering og visning av en rekord, deretter AI-spørsmål om lagrede data.

AI kan hjelpe med implementasjon, testkode, kontrollverktøy og feilretting. Gruppen skal selv kunne kjøre kontrollene og få lagrede, etterprøvbare resultater uten at AI må avgjøre om kontrollene bestod. Forventede resultater skal komme fra avtalte krav og modeller. Også kontrollverktøyene må sjekkes, blant annet med kjente feil.

## Foreslått arbeidsflyt

1. Avklar krav, modeller, fast testgrunnlag, forventede resultater, benchmark og FoM.
2. Klargjør tester og automatisk modelluttrekk med deterministisk sammenligning.
3. Etabler en reell baseline før forbedringsiterasjonene. Det som ennå ikke kan måles, merkes «ikke målbart».
4. La AI implementere en avgrenset del basert på modellene og kontraktene.
5. Gruppen kjører kontrollene med dokumenterte kommandoer og lagrer resultater knyttet til commit, kontrollgrunnlag og miljø.
6. Vurder avvik, bruk AI til målrettet retting og kjør kontrollene igjen. Fasiten endres ikke bare for å få grønne tester.

Testing er en del av verifiseringen, sammen med modellkontroll og gjennomgang. FoM viser utvikling for et valgt mål og erstatter ikke øvrige kontroller. Oppgaven krever minst tre datapunkter totalt; én felles FoM-serie kan være tilstrekkelig. Enhetstester og benchmark skal også inngå. Frie AI-svars forståelighet og relevans kan kreve menneskelig vurdering i tillegg til automatiske kontroller av fakta og tilgang.

## Avklares senere

- Rekkefølge på implementeringssteg, konkrete verktøy og kommandoer.
- Felles FoM, målemetode, baseline og faste rapporter. Eksisterende FoM-forslag er kandidater.
- Ansvarsfordeling mellom AI, kontrollverktøyene og gruppen.
- Når prosessen er avklart: et draw.io-diagram av iterasjonssløyfen og ansvarsfordelingen, til gruppen og fremføringen.

Se også [arbeidsveiledningen for iterativ utvikling](iterative-development.md) og [databasens testplan](test-plan.md).
