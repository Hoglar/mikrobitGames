# Micro Snake – spesifikasjon

**Status:** Avklart funksjonelt omfang, 2026-10-29. Ingen implementasjon eller målinger foreligger.

## Formål og grensesnitt

Spilleren styrer en slange på et rutenett, samler mat og forsøker å fylle brettet uten å kollidere. Visningen har minimalistisk retrodesign, mørk bakgrunn, grønn slange, diskret rutenett og mat i kontrastfarge. Matpoeng, steg og personlig rekord for valgt kombinasjon vises over brettet.

Spillet bruker [Micro:bit-API-et](../../../../spec/contracts/microbit-webapp/web-page-developer-interface.md), [frontendkontrakten](../../../../spec/contracts/webapp-backend/contract.md) og [spillplattformen](../../Komponentspesifikasjon_webapplikasjon_forklart.md). [Game design](game-design.md) eier bevegelsesregler og foreslåtte balanseverdier. Det opprettes ingen egen seriell protokoll.

## Moduser og styring

| Hovedmodus | Spillbrett og utfordring | Undervalg |
| --- | --- | --- |
| Standard | Brett uten interne hindringer. | Competitive / Random |
| Hurtig | Samme åpne brett, høyere start- og maksfart. | Competitive / Random |
| Labyrint | Fast hinderoppsett, samme fart som Standard. | Competitive / Random |

Competitive bruker et fast, versjonert konkurranseoppsett med deterministisk matplassering. Random velger automatisk ny seed for hver tellende runde. Brukeren kan angi egen seed under Random, men dette gir bare øving og lokal resultatvisning. Modus, seedkilde og seed låses ved rundestart. Det inngår ingen daglige/ukentlige utfordringer.

A svinger 90 grader til venstre og B til høyre, relativt til slangens retning. Første gyldige trykk venter til neste bevegelsessteg; ytterligere trykk før steget ignoreres. Slangen kan ikke snu 180 grader i ett steg. Logoen brukes eksklusivt til å åpne/lukke menyen under en runde.

I menyer flytter A/B markeringen og A+B bekrefter. A+B starter også fra startskjermen og gir ny runde etter Game Over. Holdte knapper skal ikke gjenbrukes som valg eller svinger i en ny tilstand. Start og fortsett har tre sekunders nedtelling.

Pausemenyen har Fortsett, Restart og Hovedmeny. Restart og Hovedmeny krever ekstra bekreftelse. Logo fra bekreftelsen returnerer til pausemenyen; neste logotrykk lukker menyen og fortsetter etter nedtelling. Hovedmeny er Snakes egen modusvelger, med eget valg tilbake til plattformens spillvelger.

## Resultat og rangering

Én matbit gir ett matpoeng og vekst på én rute. Fart eller modus gir ingen multiplikator. Flest matbiter er alltid best; ved lik mengde er færrest steg best. Helt like prestasjoner deler plassering.

Med `F` spiste matbiter, `S` bevegelsessteg og `B = 1 000 000`:

```text
value = F × B + (B − 1 − S)
F = floor(value / B)
S = B − 1 − (value mod B)
```

`0 ≤ S ≤ 999 999`. Steggrensen avslutter runden; stegtallet skal aldri klippes eller fortsette forbi grensen. Ved startlengde fire er største matmengde antall spillbare ruter minus fire. Ingen tids-, seiers- eller overlevelsesbonus inngår. UI-et viser for eksempel «120 mat · 850 steg», ikke den kodede verdien.

Kollisjon, fullt brett og nådd steggrense er normale avslutninger og gir `completed`. Fullt brett gir seier; steggrensen alene gir ingen seiersmarkering. Bekreftet restart/hovedmeny eller annen frivillig avslutning etter rundestart gir `incomplete`. Verdien kodes på samme måte, men ufullførte forsøk kan ikke gi rekord. Øving sendes aldri til backend.

## Krav og kontroll

| ID | Krav | Test |
| --- | --- | --- |
| WEB-033 | Standard, Hurtig og Labyrint har Competitive/Random og seks adskilte topplister. | MS-01 |
| WEB-034 | Brettet er 20×20 i første versjon, med utviklerkonfigurerbare mål og et fast labyrintoppsett. | MS-02 |
| WEB-035 | Mat gir ett poeng og én ekstra kroppsrute; maks én matbit finnes samtidig. | MS-03 |
| WEB-036 | A/B gir relative svinger med maks én ventende handling og ingen direkte 180-graders vending. | MS-04 |
| WEB-037 | Logo toggler bare meny under runden; A/B navigerer og A+B bekrefter uten gjenbruk av holdte knapper. | MS-05 |
| WEB-038 | Restart/hovedmeny krever bekreftelse. Start/fortsett bruker tre sekunders nedtelling. | MS-06 |
| WEB-039 | Competitive er deterministisk; Random er tilfeldig. Selvvalgt seed gir øving uten rekordpåvirkning. | MS-07 |
| WEB-040 | Fart øker etter matmengde til modusens tak, likt for begge undervalg. | MS-08 |
| WEB-041 | Vegg/kropp gir tap; halen kan følges når den flyttes. Fullt brett gir seier; steggrensen avslutter. | MS-09 |
| WEB-042 | Heltallskodingen rangerer mat før steg og kan dekodes entydig innen fastsatte grenser. | MS-10 |
| WEB-043 | UI og topplister viser mat/steg og personlig rekord for riktig kombinasjon. | MS-11 |
| WEB-044 | Rangert sluttresultat lagres én gang med uforanderlig eier, spill-ID og forsøks-ID gjennom omforsøk. | MS-12 |
| WEB-045 | Utilgjengelig input pauser uten tap av rundetilstand; retur krever eksplisitt fortsett uten replay. | MS-13 |
| WEB-046 | Nettleserlyd er valgfri. Micro:bit viser seier/tap og pokal ved bekreftet personlig rekord. | MS-14 |
| WEB-047 | Sene svar eller displayfeil skal ikke endre ny runde, stoppe restart eller hindre resultatlagring. | MS-15 |
| WEB-048 | Tegnefrekvens og lyd påvirker ikke logikken; ressurser og abonnementer ryddes ved spillbytte. | MS-16 |

## Integrasjon

Seks backend-spill-ID-er kobles til samme Snake-modul med ulike konfigurasjoner. Dette støttes av dagens datamodell, men krever gruppering i spillvelgeren. Backendens heltallsrangering beholdes. Dekoding av poeng må inngå i relevante frontendvisninger og samordnes med eventuell AI-presentasjon av rekordene.

Lokal øving uten innsending og direkte restart fra resultatpanelet er spillspesifikke unntak som må samordnes med plattformflyten. Innlogging, sesjonsfornyelse, klar Micro:bit og øvrige startkrav beholdes; anonym øving er ikke avtalt. Felles kontrakter endres ikke av denne dokumentpakken.
