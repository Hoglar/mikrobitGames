# Samtaleprototype og integrert løsning

**Oppdatert 2026-10-28:** Brukeren har bestilt integrasjon i backend/API. Samtale- og dataverktøykoden ligger nå i `backend/ai-service/src`; filene her importerer samme kode. Ingen alternativ AI-motor skal vedlikeholdes her.

Prøv hele API-flyten med syntetisk database:

```bash
.venv/bin/python backend/ops/try-ai.py
```

Bruk `/ny` for å slette samtalen, `/data` for fasiten, `/spiller ada|nora`, `/spill ingen|poengjakt|sprint` og `/avslutt`. Dette er lokal diagnose, uten benchmark eller FoM. Ikke kjør den samtidig med benchmark. Alle egne tjenester og testdata ryddes ved avslutning.

Den opprinnelige `run.py` er fortsatt en utviklerprøve direkte mot den delte samtalemotoren, med `/verktøy` for innsyn. Den går utenom API-innlogging og tester ikke API- eller Linux-brukerisolasjon. Den bruker bare `ai_reader` mot sin midlertidige database.

Minnet er økt fra tre til opptil 20 utvekslinger. Eldre innhold kan fjernes tidligere med varsel ved plassmangel. Backendens levetid, isolasjon og sletting står i [kontrakt 1.5](../../spec/contracts/backend-ai/contract.md). Navngitte dataverktøy og deres grenser står i [kontrakt 1.6](../../spec/contracts/ai-database/contract.md). Modellen er fortsatt samme Qwen, nå med 16384 konteksttokens, 512 genererte tokens og 12288 UTF-8-byte inputgrense.

Hilsenen feilet fordi vanlig tekst ble avvist av parseren. Naturlig tekst/JSON-strenger godtas nå som prat; verktøyhandlinger valideres fortsatt strengt. Tjenesten beregner rangering og forbedring fra data, men modellen kan fortsatt velge feil verktøy eller gi uriktige tillegg. Antall offentlige rekordholdere sier ikke sikkert hvor mange som har spilt.

## Historisk utprøving før integrasjon

Følgende beskriver den opprinnelige prototypen med tre utvekslinger og den daværende backendvarianten, ikke dagens API. Resultatene er bevart som sporbar dokumentasjon.

## Kontroll og første avgrensede evaluering

Kjør de ni egne regresjonskontrollene uten tjenester eller modell:

```bash
.venv/bin/python -m unittest discover -s backend/prototypes/conversation -p 'test_*.py' -v
```

Alle ni bestod. De dekker samtaleisolasjon, sletting, ferskt datagrunnlag for
deklarerte faktasvar, forsøksgrenser, feilutfall, varslet historikkgrense, ingen
skjult avkorting og avvisning av SQL-/identitetsargumenter fra modellen.

Seks grupper med kontroller mot en virkelig, midlertidig PostgreSQL-instans bestod:
gjeldende rekorder/rangeringsretning/avstand; historikk og valgt identitet;
navngitt spiller/tomt grunnlag/parameterbinding; inaktive spill; delte plasseringer;
og tvetydige spillnavn med eksplisitt ID som alternativ.

Den første ekte Qwen-samtalen inneholdt sju meldinger:

| Melding | Observert resultat |
| --- | --- |
| «Hei!» | Ugyldig modellsvar; hilsener er ikke ferdig håndtert. |
| «Hvem har mest poeng?» | Korrekt Ada 120 og Nora 115 fra gjeldende rekorder. |
| «Og hvem har minst?» | Korrekt Nora 115; oppfølgingen beholdt spillkonteksten. |
| Sprint-sammenligning med Nora | Korrekt Ada 55 000 ms, Nora 58 000 ms og forskjell 3 000 ms. |
| «Hvor mye har jeg forbedret meg der?» | Valgte Sprint og hentet korrekt 60 000 → 55 000 ms, men la til en **uriktig** påstand om to spillforsøk igjen. Hele svaret regnes derfor ikke som korrekt. |
| Noras spill | Valgte `games` med ugyldig spillerargument, gjentok feilen og endte med teknisk feil. |
| Private forsøk | Avviste tilgang uten dataoppslag. |

Påstanden om to spillforsøk kan være påvirket av feltet `attempts_left` i den
interne verktøyresponsen, som teller verktøyforsøk. Det er en hypotese, ikke bevist
årsak. Ingen ny instruksjonsvariant eller automatisk forbedringsrunde ble startet
på grunnlag av resultatene.

Fire sammenligningsspørsmål ble kjørt mot dagens backend på samme syntetiske
grunnlag. Hilsenen ble avvist; «mest poeng» ga feilaktig Nora, «minst poeng» ga
feilaktig manglende data, og Sprint-sammenligningen ga feilaktig manglende data.
Dette er enkeltforsøk, ikke en statistisk kvalitetsmåling. Hilsenen, mest/minst og
Sprint ble stilt som selvstendige spørsmål til backend, som ikke har samtaleminne.
Oppfølgingen i prototypen var med vilje del av en samtale. Ingen ytelsesgevinst
utledes fra tidsforskjellene mellom disse ulike flytene.

Råresultater med alle verktøyvalg og syntetiske verktøydata ligger lokalt i
`backend/results/runs/conversation-prototype-20261028T090359Z.json`.
Hilsenen ble gjentatt én gang med samme instruksjon for å skille formatfeil fra
datahentingsfeil. Modelladapteren meldte `ModelFailure: Ugyldig modellsvar`;
diagnosen ligger i `backend/results/runs/conversation-greeting-20261028T090911Z.json`.
Tidligere rapporter er bevart. Ingen full testfase, FoM, commit eller push er utført.

