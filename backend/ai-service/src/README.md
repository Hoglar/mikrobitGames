# AI-kildekode

Implementasjon og konfigurasjon for lokal AI, spillerforespørsler og kontrollert tilgang til highscore-data. Krav og modeller ligger under backend/spec, og tester under backend/tests. Modellvekter og lokale hemmeligheter skal ikke lagres her.

[Modulplanen for WBS 6.1](../../spec/ai-module.md) samler krav og komponentmodell. Første implementasjon bruker `transport:app` som Uvicorn-inngang, én aktiv oppgave og en separat Ollama-adapter. `query_policy.py` eier SQL-tillatelseslisten; `read_store.py` er eneste PostgreSQL-adapter og bruker driverens native `$1`-binding.

Se [oppsett](../../SETUP.md). Ingen modellspørsmål eller produktmålinger er kjørt av utviklingsagenten. Faktakvalitet, tidsbruk og maskinens egnethet gjenstår å måle.
