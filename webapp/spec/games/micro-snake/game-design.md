# Micro Snake – game design

**Status:** Foreslått design, 2026-10-29. Kontrollene, modusene og rangeringen er avklart. Fart, konkret brettoppsett og grafiske valg nedenfor er første forslag til testing.

## Brett og balanse

Koordinater er nullbaserte med `(0,0)` øverst til venstre, X mot høyre og Y nedover. Brettet har harde yttervegger, uten gjennomgang til motsatt kant. Foreslått start er hodet `(10,10)`, kroppen `(9,10), (8,10), (7,10)`, vendt mot høyre.

| Parameter | Standard | Hurtig | Labyrint |
| --- | --- | --- | --- |
| Brett | 20×20, åpent | 20×20, åpent | 20×20, faste veggruter |
| Startlengde | 4 | 4 | 4 |
| Startfart | 5 steg/s | 8 steg/s | 5 steg/s |
| Fartstak | 10 steg/s | 14 steg/s | 10 steg/s |
| Økning | +1 steg/s per fem matbiter | Samme | Samme |
| Fullt brett | 396 matbiter | 396 matbiter | 380 med foreslått oppsett |

Formel: `fart(F) = min(startfart + floor(F / 5), fartstak)`. Ny fart gjelder neste hele stegintervall etter at maten er spist. Ingen midlertidig akselerasjon ved pause, tegneforsinkelse eller lydavspilling.

Labyrintforslaget har fire 2×2-blokker: X=4–5/Y=4–5, X=14–15/Y=4–5, X=4–5/Y=14–15 og X=14–15/Y=14–15. Det gir 16 veggruter og 384 spillbare ruter med fri startplass. Oppsettet har sammenhengende passasjer og ingen isolerte matruter.

En matematisk kontroll av forslaget fant en sammenhengende rundløype gjennom alle 384 rutene, forenlig med startkroppen og retningen. Å følge den gir en fullføringsstrategi for enhver lovlig matplassering: høyst `380 + 379 + … + 1 = 72 390` steg, under steggrensen. Det viser at fullføring er mulig, ikke at kontrollene eller spillbalansen er fysisk verifisert.

Brettmål, startkropp og vegger ligger i konfigurasjon, ikke som spredte konstanter. Et større brett krever validering av startplass, matruter, maksverdi og visning. Det er en utviklerendring, ikke et spillerstyrt rangeringsvalg. Endret konkurransegrunnlag skal ikke blandes med eksisterende rekorder uten en avklart ny versjon/spill-ID.

## Bevegelsesregler

Slangen flyttes én rute per logisk steg. Retningene følger syklusen opp, høyre, ned, venstre. A flytter ett hakk mot venstre i syklusen; B ett hakk mot høyre. Bare første gyldige input siden forrige steg lagres. Holdt knapp gir ingen repetisjon, og flere registrerte trykk i én adapterhendelse lager ikke en kø av fremtidige svinger.

Ved hvert steg:

1. Bruk eventuell ventende sving og tøm inputplassen.
2. Øk stegtallet med én og beregn neste hoderute. Også et dødelig bevegelsesforsøk telles.
3. Avgjør om neste rute inneholder mat. Kontroller yttervegg, intern vegg og kropp. Haleruten unntas fra kroppskontrollen bare når slangen ikke vokser dette steget.
4. Ved kollisjon: avslutt uten å legge til hodet. Ellers flytt hodet og fjern halen hvis ingen mat spises.
5. Ved mat: øk matpoeng én gang og behold halen. Er hele spillområdet fylt, avslutt som seier uten å forsøke ny matplassering.
6. Hvis runden fortsatt er aktiv og steggrensen er nådd, avslutt uten seier. Ellers plasser ny mat ved behov og planlegg neste intervall.

Kollisjon har prioritet over steggrensen; seier på siste tillatte steg beholdes som seier. Ved pause fryses også gjenværende tid til neste steg. Fortsett skjer etter nedtelling uten et ekstra gratis steg eller tapte bevegelser.

## Mat og like konkurransevilkår

Begge undervalg bruker de samme spillbare rutene. Mat legges aldri på vegg eller kropp. Etter vekst er halen fortsatt opptatt; etter et vanlig steg er den gamle haleruten ledig. Mat forblir på samme sted til den spises.

**Competitive:** Hver hovedmodus har en fast konkurransenøkkel per spillversjon. For matbit nummer `k` lager en deterministisk generator en prioritert permutasjon av alle statisk spillbare ruter. Første rute som ikke er opptatt av kroppen velges. Dermed finnes en kandidat så lenge brettet ikke er fullt. Rekkefølgen avhenger av modus, versjon og `k`, ikke av veggklokke, bruker eller tegnefrekvens.

Alle møter samme regler og prioriteringer. Matens faktiske rute kan avvike når slangekroppene ligger ulikt; forskjellen kommer da fra spillernes egne valg. Dette er ikke et løfte om identisk matsekvens uansett spillerhandling eller om at enhver rute spilleren velger fortsatt kan fullføres. Egen kropp kan sperre veien til maten som en konsekvens av strategien.

**Random:** Automatisk seed opprettes ved ny runde; en versjonert generator velger blant ledige ruter. Selvvalgt seed bruker samme algoritme, men låser runden til lokal øving. Samme seed og samme handlinger gir samme forløp innen versjonen. Brukeren kan ikke flytte en øvingsprestasjon til en tellende spill-ID etterpå.

## Menyer og tilbakemelding

Modusvelgeren viser hovedmodus, Competitive/Random og eventuell egen seed. Øving merkes tydelig. Startskjerm og resultatpanel bruker A+B for start/restart; logoen har ingen funksjon der. A/B navigerer i menyene, og knappene må slippes mellom bekreftelser.

Logo under aktiv spilling fryser runden og åpner pausemenyen med Fortsett markert. Restart/Hovedmeny åpner en bekreftelse med Avbryt som standard. Avbryt eller logo returnerer til pausemenyen. Logo fra pausemenyen betyr fortsett med nedtelling. Slange, score, mat og tilfeldig-generatorens tilstand beholdes under pause.

Vis matpoeng og steg som to tydelige tall. Personlig rekord og toppliste gjelder valgt kombinasjon, ikke alle Snake-runder samlet. Øving viser lokal prestasjon og at den ikke lagres. Manglende rekorddata vises som utilgjengelig, ikke som en bekreftet rekord på null.

Slangen beveger seg visuelt rutevis. Hodets retning skal være tydelig; en rolig overgang mellom rutene kan brukes uten å endre kollisjonstidspunkt. Faste vegger skiller seg fra kropp og mat. Korte nettleserlyder ved mat, tap og seier kan slås av.

Ved seier sendes et 5×5-smilefjes til Micro:bit; ved tap et trist ansikt. Steggrensen alene gir en nøytral sluttmelding i nettleseren. Bekrefter backend `outcome: created` for den avsluttede tellende runden, kan en pokal erstatte sluttbildet. Lik tidligere rekord gir ikke pokal; første fullførte resultat kan etablere første rekord. Bilder er forhåndsdefinerte 25-pikseldata, og displayet tømmes ved ny runde. Det brukes ikke Micro:bit-lyd.
