# Arbeidsrapport: retting og omlegging av AI-assistenten

**Dato:** 2026-10-28. **Status:** Implementert og fulltestet av brukeren på ren commit `3bd5d07`. [Fullrapporten](backend/20261028T185422.473900Z/report.md) viser at alle automatiserte kontroller består, med **100 % krav-FoM og 100 % modell-FoM**.

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

## Kontroller før full testfase

- 72 tester av kontrollverktøyene og 69 enhetstester består.
- 12 utvalgte API/AI-integrasjonskontroller består, samlet over diagnosekjøringen og omkontrollen av en rettet testfixture. De omfatter blant annet sesjonsisolasjon, sletting, 20-utvekslingsgrensen og ressursgrenser.
- Alle 32 kontroller av data-, komponent- og grensesnittmodeller består.
- En avgrenset prøve med ekte Qwen viste fungerende hilsener, vanlig prat og riktige rekordverdier i flere spørsmål. Den viste også gjenværende feil i formuleringene. En planlagt ekstra modellprøve ble avbrutt før utførelse; den senere fulle testfasen er beskrevet nedenfor.

## Resultat fra brukerens fullkjøring

Kjøringen `20261028T185422.473900Z` brukte kontrollversjon 3 og bestod **72 kontrollverktøytester, 69 enhetstester, 42 integrasjons-/benchmarkkontroller og alle 32 modellkontroller**. Ingen feil eller blokkerte kontroller er registrert. Krav-FoM og modell-FoM er begge **100 %**.

Begge HTTP-/DB-benchmarkfasene bestod. Under normal last med AI var HTTP p95 omtrent 33,5 ms for toppliste, 14,8 ms for sesjonsoppslag og 29,2 ms for resultatlagring, uten registrerte operasjonsfeil i denne fasen. P95 betyr at minst 95 % av de målte kallene var ferdige innen denne tiden. Det kalde AI-kallet tok 50,75 sekunder; de ni varme kallene tok 10,64–16,40 sekunder. Alle ti AI-kall bestod format-/status- og tidskontrollene.

Ved arkivering ble det oppdaget en hardkodet metadatafeil: rapporten oppgir 4096 konteksttokens, mens kode og kontroll av faktiske modellkall bruker 16384. Avviket er dokumentert i [arkivnotatet](backend/20261028T185422.473900Z/archive-notes.md). Originalrapport, målinger og teststatuser er bevart; ingen test- eller produktkode er endret som følge av denne gjennomgangen.

## Hva vi ennå ikke kan konkludere med

De tekniske rettingene og integrasjonen er levert, men vi kan ikke si at alle AI-svar er riktige. Modellen kan fortsatt velge feil verktøy, misforstå data eller legge til uriktige påstander. For eksempel er antall personer med offentlig rekord ikke nødvendigvis antall personer som har spilt.

Den automatiserte testfasen er fullført. Kontrollversjon 3 har sitt første komplette målepunkt; tidligere målinger beholdes i [resultatarkivet](README.md) som egne serier. Neste praktiske steg er frontendintegrasjon og demonstrasjon. Kjente begrensninger i frie AI-svar kan dokumenteres som begrensninger i skoleprosjektet; tilgangsfeil eller blanding av brukeres samtaler skal ikke godtas. Ingen ny forbedringsrunde er startet automatisk.
