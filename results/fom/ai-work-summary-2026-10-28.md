# Arbeidsrapport: retting og omlegging av AI-assistenten

**Dato:** 2026-10-28. **Status:** Implementert og kontrollert med avgrensede tester. Ny full testkjøring og benchmark utføres av brukeren; resultatet er ikke kjent ennå.

## Problemet

Den lokale Qwen-modellen hadde tilgang til tillatte databasedata, men assistenten ga likevel tekniske feil og uriktige svar. Undersøkelsen viste flere årsaker:

- SQL-filteret avviste enkelte gyldige uttrykk. Modellen kunne også lage feil spørringer eller velge feil spiller/spill.
- En enkel hilsen kunne gi feil fordi modellen svarte med vanlig tekst, mens programmet krevde JSON. «Hei hei» feilet altså uten at datahenting var nødvendig.
- Hvert spørsmål var opprinnelig selvstendig. Assistenten manglet sammenhengen for spørsmål som «Og hvem har minst?» og «Hvor mye har jeg forbedret meg der?».

## Hva vi endret

Vi rettet SQL-valideringen og endret deretter selve arbeidsmåten etter utprøving og brukerens bestilling. Qwen velger nå mellom fire kontrollerte dataverktøy: spilloversikt, gjeldende rekorder/rangering, rekordhistorikk og spillerens spill. Backendkoden utfører faste SQL-spørringer med separat bundne verdier. Modellen skriver dermed ikke lenger SQL. Rangering og forbedring beregnes fra data i koden.

Vanlig tekst godtas som samtalesvar, slik at en hilsen ikke blir en formatfeil. Verktøyhandlinger valideres fortsatt strengt. Modellen kan prate uten databaseoppslag, mens svar den markerer som rekordbaserte, krever fersk datahenting.

Samtaleprototypen er integrert i det vanlige backend-API-et. Hver innlogging får sitt eget minne med **opptil 20 utvekslinger**. En ny «ny samtale»-rute sletter minnet. Det ligger bare i RAM, utløper etter inaktivitet og forsvinner ved omstart. Lange samtaler kan miste eldre utvekslinger tidligere med varsel. Modellen er fortsatt den samme lokale Qwen gjennom Ollama; kontekstvinduet er økt fra 4 096 til 16 384 tokens.

Databasens tilgangsgrenser beholdes: bare offentlige rekorddata, ingen private forsøk, passord eller sesjoner. Kontrakter, OpenAPI, komponentmodeller og tester er oppdatert. Frontendkontrakten er fortsatt et forslag til frontendgruppen. Se [arkitekturbeslutningen ADR-009](../../spec/decisions/adr-009-conversational-ai.md).

## Hva som er kontrollert

- 72 tester av kontrollverktøyene og 69 enhetstester består.
- 12 utvalgte API/AI-integrasjonskontroller består, samlet over diagnosekjøringen og omkontrollen av en rettet testfixture. De omfatter blant annet sesjonsisolasjon, sletting, 20-utvekslingsgrensen og ressursgrenser.
- Alle 32 kontroller av data-, komponent- og grensesnittmodeller består.
- En avgrenset prøve med ekte Qwen viste fungerende hilsener, vanlig prat og riktige rekordverdier i flere spørsmål. Den viste også gjenværende feil i formuleringene. Den siste planlagte modellprøven gjennom hele API-et ble avbrutt før utførelse.

## Hva vi ennå ikke kan konkludere med

De tekniske rettingene og integrasjonen er levert, men vi kan ikke si at alle AI-svar er riktige. Modellen kan fortsatt velge feil verktøy, misforstå data eller legge til uriktige påstander. For eksempel er antall personer med offentlig rekord ikke nødvendigvis antall personer som har spilt.

Brukeren kjører nå neste fullstendige kontroll med `./backend/check`. Den skal måle hele løsningen, inkludert virkelig AI og benchmark. Kontrollversjon 3 starter en ny måleserie fordi designet og kontrollgrunnlaget er endret. Tidligere målinger beholdes i [resultatarkivet](README.md). Den nye rapporten og FoM-resultatet legges til når kjøringen er ferdig; ingen ny forbedringsrunde startes automatisk.
