# API-kildekode

Første implementasjon av REST API, autentisering, spilldata og kommunikasjon med database og AI. [Modulplanen for WBS 4.1](../../spec/backend-module.md) beskriver krav og komponenter. [Oppsett](../../SETUP.md) beskriver Python/FastAPI, oppstart og begrensningene ved leveransen.

Frontend bruker den felles [utviklerguiden](../../../../spec/contracts/webapp-backend/contract.md) og [OpenAPI-kontrakten](../../../../spec/contracts/webapp-backend/openapi.yaml), fortsatt som forslag overfor frontendgruppen. Tester ligger under backend/tests. Produktmåling og baseline startes av brukeren.

`http_api:app` er Uvicorn-inngangen. `schemas.py` deklarerer JSON-skjemaene som både kjørende validering og `/openapi.json` bruker. Kontrakten leses ikke som erstatning for modelluttrekk. `database.py` er eneste PostgreSQL-adapter, og `ai_gateway.py` eneste AI-klient.
