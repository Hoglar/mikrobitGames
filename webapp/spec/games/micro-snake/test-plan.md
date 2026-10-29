# Micro Snake – testplan

**Status:** Planlagte tester, 2026-10-29. Ingen kjørbare spilltester eller fysiske målinger er levert.

Grunnlaget er [spesifikasjonen](specification.md), [game design](game-design.md) og [implementasjonsdesignet](implementation-design.md). Gjenbruk [adaptertestene](../../game-input-test-plan.md) og [plattformtestene](../../platform-test-plan.md) for de felles grensesnittene.

## Testgrunnlag

Bruk styrt klokke, små brett med manuelt fastsatt fasit og versjonerte generatorvektorer. Test rene regler uavhengig av Canvas. Programvaretester bruker kontrollerte adaptere; produktet styres med faktisk Micro:bit V2. Nettleser- og maskinvarekontroller er nødvendige før styring og lesbarhet kan regnes som verifisert.

## Scenarioer og forventede resultater

| ID | Krav | Test og forventet resultat |
| --- | --- | --- |
| MS-01 | WEB-033 | Alle seks valg peker til riktig unik backend-ID og samme spillmodul. Rekord og resultat blandes ikke mellom kombinasjoner. |
| MS-02 | WEB-034 | Valider 20×20, startkropp og labyrintens 16 veggruter/384 spillruter. Kontroller sammenheng, fri start og eksempel på fullbrettsrute. Prøv et mindre gyldig testbrett samt ugyldige vegger/startdata. |
| MS-03 | WEB-035 | Én matbit gir ett poeng og én kroppsrute. Mat ligger aldri på vegg/kropp. På nesten fullt brett velges siste ledige rute, og fullføring oppretter ingen ny mat. |
| MS-04 | WEB-036 | Test A/B i alle fire retninger, hold, raske ekstratrykk og `count > 1`. Bare første gyldige sving brukes per steg; ingen 180-graders vending eller automatisk repetisjon. |
| MS-05 | WEB-037 | Test logo-toggle, menyens A/B og A+B med litt ulik trykktid. Bekreftelse flytter ikke først markeringen. Holdt chord over et skjermskifte gir ikke nytt valg; logo gjør ingenting på start-/resultatskjermen. |
| MS-06 | WEB-038 | Restart/hovedmeny krever bekreftelse. Avbryt/logo gir pausemeny uten avslutning; neste logo gir nedtelling. Slange og stegtall står stille i tre sekunder. |
| MS-07 | WEB-039 | Competitive gir identisk prioritering per matnummer. Ulik kropp velger første ledige kandidat etter samme liste. Random er gjentakbar med fast testseed; egen seed sender aldri resultat. Ingen meny-/tegnehandling påvirker generatoren. |
| MS-08 | WEB-040 | Kontroller fart før/på hver femte matbit og ved taket. Neste hele intervall bruker ny fart; Competitive/Random har identiske fartskurver innen hovedmodusen. |
| MS-09 | WEB-041 | Test yttervegg, labyrintvegg, kropp og flyttende hale. Dødelig steg telles. Fullt brett gir seier; steg 999 999 avslutter uten steg 1 000 000. Seier/kollisjon på grensen følger definert prioritet. |
| MS-10 | WEB-042 | Kontroller koding/dekoding ved F=0/maks og S=0/999 999. Én ekstra matbit slår alle stegforskjeller; færre steg vinner ved lik F. Test eksemplene i designet, ugyldige verdier og at store tall ikke behandles som 32-bit. |
| MS-11 | WEB-043 | UI, toppliste og historikk viser riktig mat/steg for kodet verdi. Personlig rekord gjelder valgt UUID. Lik prestasjon får delt plassering; API-feil gir utilgjengelig rekordvisning. |
| MS-12 | WEB-044 | Tap, seier og steggrense gir completed; bekreftet avbrudd gir incomplete. Omforsøk beholder body/eier/ID. Samtidige sluttårsaker gir ett resultat, og en ny runde overskriver ikke forrige ventende innsending. |
| MS-13 | WEB-045 | Frakoble før steg, under meny og nedtelling. Kropp, mat, generator og resttid bevares. Fortsett krever klar input og eksplisitt handling; gamle trykk eller nøytrale frakoblingsverdier starter ingenting. |
| MS-14 | WEB-046 | Seier/tap gir riktig bilde, mat/tap/seier valgfri nettleserlyd. created gir én pokal; already_recorded/not_improved eller bare HTTP 201 gjør det ikke. Øving gir ingen backendpokal. |
| MS-15 | WEB-047 | Forsinket API-/displayrespons etter restart påvirker ikke ny runde. Displayfeil hindrer ikke lagring; gamle kølagte bilder ryddes før neste sesjon. Gjentatt created-svar repeterer ikke pokalen. |
| MS-16 | WEB-048 | Samme tidsbestemte input gir samme utfall ved ulik tegningsfrekvens og lydvalg. Langkjøring og gjentatte restart/spillbytter gir ikke voksende historikk, timere eller abonnementer. |

## Spilltesting og rapportering

Prøv Standard først, deretter Hurtig ved maksimal fart og Labyrint med lang kropp. Vurder om relative svinger er forståelige, om én inputplass gir tilstrekkelig respons, og om logo/A+B kan betjenes uten utilsiktede handlinger. Test begge seedtyper og matplassering nær fullt brett. En sammenhengende labyrint eller deterministisk generator beviser ikke at spillet oppleves balansert.

Gjenskap fullføringskontrollen fra designet: del spilleområdet i 2×2-ruter med hver sin lille syklus og flett dem til én gjennom et spenntre. La først alle ruteblokkene langs Y=10–11 kobles horisontalt, og koble områdene over/under via venstre ende; startkroppens kantsekvens beholdes. Kontroller at ruten besøker hver spillbar rute én gang, lukkes og kan følges med tillatte svinger. Test fasiten mot feil som å sjekke kroppen før halen flyttes eller trekke ny mat før fullbrettskontrollen. Konkurranseregler skal fryses før tellende publisering.

Rapporter krav/test-ID, spillversjon, modus, seedtype/testseed, miljø, metode og forventet/faktisk resultat med PASS/FAIL/SKIPPED/BLOCKED. Mål inputrespons, stegintervaller og minnebruk. Maskinvarekontroller uten enhet er SKIPPED; manglende plattformtilpasning er BLOCKED der den hindrer kontroll. Senere testkode, måleskript og rapporter plasseres under `webapp/tests/`, `webapp/verification/` og `webapp/results/`.
