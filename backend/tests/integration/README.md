# Integrasjonstester

Kjøres automatisk med `./backend/check`. Testene bruker ekte PostgreSQL-forbindelser, tjenestenes egne DB-roller og HTTP mot den virkelige API-/AI-koden. HTTP-reléer lager kontrollerte modell-/gatewayfeil; SQL-sikkerheten testes også direkte mot databasen.

Hver funksjonstest får nye syntetiske data. COMMIT-testen lar PostgreSQL lagre rekorden, men mister bekreftelsen på vei tilbake til API-et. Testen kontrollerer både `OUTCOME_UNKNOWN` og at gjentakelsen ikke lager duplikat.

Se [kjøreguide](../../verification/README.md) og [testgrensesnitt](../../verification/test-runtime.md). Prosjektets migreringer, tjenester og gjenopprettingsrutine må implementeres før disse testene kan utføres fullt ut.
