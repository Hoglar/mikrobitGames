# ADR-006: Lokal modellkjøring bak AI-tjenestens adapter

**Status:** Godkjent av brukeren som del av WBS 6.1, 2026-10-24. Modellvalget gjelder første kandidat til utprøving. Ikke installert eller ytelsestestet.

## Kontekst

AI skal svare på frie spørsmål om rekorddata på en eksisterende Parrot Linux-PC med 16 GB RAM og GTX 980. Ved starten av WBS 6.1 var API-kontrakten avklart, mens modell, kjøremiljø og språk for AI-tjenesten skulle velges. Sikkerhetsreglene skal håndheves av tjenestekode og PostgreSQL, uavhengig av modellvalg.

## Beslutning

Bruk **Python** til den lille AI-tjenesten, med adskilte moduler for HTTP, styring, modelladapter, SQL-kontroll og DB-lesing. Backend API kan velge språk uavhengig. Konkrete biblioteker og versjoner fastsettes før implementasjon.

Prøv **Ollama** som lokal modellkjører via `POST /api/chat` på `127.0.0.1:11434`, med **`qwen3:4b-instruct-2507-q4_K_M`**. Den kvantiserte pakken er omtrent 2,5 GB. Instruct-2507-varianten bruker ikke separat thinking-modus. Begrens kontekst og generert lengde som beskrevet i [modulplanen](../../backend/spec/ai-module.md). Bruk strukturert JSON og valider det i tjenestekoden; formatstyring garanterer ikke riktig SQL eller fakta. Se [modellpakken](https://ollama.com/library/qwen3:4b-instruct-2507-q4_K_M), [modellkortet](https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507) og [strukturerte svar](https://docs.ollama.com/capabilities/structured-outputs).

Ollama er en modellkjører, ikke vår AI-tjeneste: den får ingen direkte databaseforbindelse. Skyfunksjoner deaktiveres med `OLLAMA_NO_CLOUD=1`. Fast modellnavn, faktisk digest, programversjoner og innstillinger registreres ved måling; ikke bruk en flytende `latest`-referanse. Se [Ollamas lokale oppsett](https://docs.ollama.com/faq).

## Alternativer og konsekvenser

- **llama.cpp direkte:** Aktuelt hvis vi trenger mer kontroll over modellkjøringen; innebærer mer eget oppsett. Adapteren gjør et senere bytte mulig.
- **Større eller mindre lokal modell:** Vurderes dersom den første kandidaten ikke gir tilstrekkelig korrekte svar innenfor ressurs- og tidsgrensene. Størrelse alene avgjør ikke kvalitet.
- **Ekstern AI-tjeneste:** Oppfyller ikke det avtalte premisset om lokal AI og er ikke valgt.

Ollama er valgt for et oversiktlig lokalt HTTP-grensesnitt og støtte for strukturerte svar. Vi legger ikke inn et eget agentrammeverk. Modellen trenes ikke; den får aktuelle data gjennom kontrollerte spørringer.

GTX 980 er oppført med compute capability 5.2. Ollamas dokumentasjon oppgir driver 570 eller nyere for denne gruppen. Faktisk støtte, tilgjengelig GPU-minne og CPU-alternativet må kontrolleres på serveren; 2,5 GB modellfil er ikke et løfte om samlet minnebruk eller svartid. Se [maskinvarekravene](https://docs.ollama.com/gpu).

Behold eller bytt kandidaten etter kontrollert utprøving av norsk, SQL, faktakorrekthet, ressursbruk og svartid. Modellen kan byttes uten å endre kontrakten mot backend. Beslutningen godkjenner utprøving av kandidaten; ytelsen er ennå ikke verifisert.
