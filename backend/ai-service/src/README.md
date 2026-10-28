# AI-kildekode

Lokal samtaleassistent via `transport:app`, én aktiv oppgave, med Ollama og samme Qwen-modell. [Modulplanen](../../spec/ai-module.md) og [ADR-009](../../../spec/decisions/adr-009-conversational-ai.md) beskriver gjeldende design.

`orchestrator.py` eier samtaleminne per innlogging, 20-utvekslingsgrense, sletting, utløp og budsjetter. `model_client.py` validerer navngitte verktøyhandlinger og tillater naturlig tekst for prat. `read_store.py` eier fire dataverktøy med fast SQL og native `$1`-binding. `query_policy.py` kontrollerer hele SQL-treet og referanser mot de tre offentlige visningene før utførelse som `ai_reader`.

SQLGlot kvalifiserer en kopi for skjemakontroll; kopien kjøres ikke. Modellen kan ikke sende egen SQL. Direkte SQL-policytester beholdes som ekstra sikkerhetskontroll. Rolle- og resultatgrenser er uendret.

Samtalen er avgrenset kontekst, ikke trening eller varig lagring. Modellen kan fremdeles velge feil data eller formulere feil fakta. Format- og tilgangskontroller er ikke en godkjenning av faktakvaliteten. Full testfase kjøres av brukeren med `./backend/check`.
