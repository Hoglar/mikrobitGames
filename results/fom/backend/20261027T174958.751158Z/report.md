# Testresultat

Tid: 2026-10-27T17:49:58.751158+00:00
Kode: `5b41984244483b8fec6e2f85f3d847754ff2923d`
Modus: full · Python: 3.13.5
Kontrollversjon: 2 · Modellkontroller DB/API/AI: (24, 4, 4)
Endret arbeidsmappe: False

- Kontrollverktøy: {'PASS': 63}
- Enhetstester: {'PASS': 52}
- Integrasjon og benchmark: {'PASS': 10, 'BLOCKED': 30, 'FAIL': 1}

## FoM

**Ikke komplett målbart ennå. Ingen FoM-punkt eller oppdiktet baseline.**

## Kontrollgrupper

| Gruppe | Status |
| --- | --- |
| KDB-1 | PASS |
| KDB-2 | PASS |
| KDB-3 | PASS |
| KDB-4 | PASS |
| KAPI-1 | BLOCKED |
| KAPI-2 | BLOCKED |
| KAPI-3 | BLOCKED |
| KAPI-4 | BLOCKED |
| KAI-1 | BLOCKED |
| KAI-2 | BLOCKED |
| KAI-3 | BLOCKED |
| KAI-4 | BLOCKED |
| MDB-1 | PASS |
| MDB-2 | PASS |
| MDB-3 | PASS |
| MDB-4 | PASS |
| MDB-5 | PASS |
| MDB-6 | PASS |
| MDB-7 | PASS |
| MDB-8 | PASS |
| MDB-9 | PASS |
| MDB-10 | PASS |
| MDB-11 | PASS |
| MDB-12 | PASS |
| MDB-13 | PASS |
| MDB-14 | PASS |
| MDB-15 | PASS |
| MDB-16 | PASS |
| MDB-17 | PASS |
| MDB-18 | PASS |
| MDB-19 | PASS |
| MDB-20 | PASS |
| MDB-21 | PASS |
| MDB-22 | PASS |
| MDB-23 | PASS |
| MDB-24 | PASS |
| MAPI-1 | BLOCKED |
| MAPI-2 | BLOCKED |
| MAPI-3 | BLOCKED |
| MAPI-4 | BLOCKED |
| MAI-1 | BLOCKED |
| MAI-2 | BLOCKED |
| MAI-3 | PASS |
| MAI-4 | PASS |

## Feil og kontroller som ikke ble utført

| Kontroll | Status | Årsak |
| --- | --- | --- |
| TBE-02-account | BLOCKED | Tjenesten startet ikke. Kontroller entrypoint, miljøvariabler og applikasjonsavhengigheter. |
| TBE-02-renew-expiry | BLOCKED | Tjenesten startet ikke. Kontroller entrypoint, miljøvariabler og applikasjonsavhengigheter. |
| TBE-02-password-delete | BLOCKED | Tjenesten startet ikke. Kontroller entrypoint, miljøvariabler og applikasjonsavhengigheter. |
| TBE-03-records | BLOCKED | Tjenesten startet ikke. Kontroller entrypoint, miljøvariabler og applikasjonsavhengigheter. |
| TBE-03-incomplete | BLOCKED | Tjenesten startet ikke. Kontroller entrypoint, miljøvariabler og applikasjonsavhengigheter. |
| TBE-05-retry-conflict | BLOCKED | Tjenesten startet ikke. Kontroller entrypoint, miljøvariabler og applikasjonsavhengigheter. |
| TBE-05-concurrent-records | BLOCKED | Tjenesten startet ikke. Kontroller entrypoint, miljøvariabler og applikasjonsavhengigheter. |
| TBE-05-concurrent-replay | BLOCKED | Tjenesten startet ikke. Kontroller entrypoint, miljøvariabler og applikasjonsavhengigheter. |
| TBE-05-atomic-attempt-record | BLOCKED | Tjenesten startet ikke. Kontroller entrypoint, miljøvariabler og applikasjonsavhengigheter. |
| TBE-04-private-history | BLOCKED | Tjenesten startet ikke. Kontroller entrypoint, miljøvariabler og applikasjonsavhengigheter. |
| TBE-04-public | BLOCKED | Tjenesten startet ikke. Kontroller entrypoint, miljøvariabler og applikasjonsavhengigheter. |
| TBE-01-07-input | BLOCKED | Tjenesten startet ikke. Kontroller entrypoint, miljøvariabler og applikasjonsavhengigheter. |
| TBE-07-rate-limit | BLOCKED | Tjenesten startet ikke. Kontroller entrypoint, miljøvariabler og applikasjonsavhengigheter. |
| TBE-05-unknown-commit | BLOCKED | Tjenesten startet ikke. Kontroller entrypoint, miljøvariabler og applikasjonsavhengigheter. |
| TBE-05-revocation-race | BLOCKED | Tjenesten startet ikke. Kontroller entrypoint, miljøvariabler og applikasjonsavhengigheter. |
| TBE-09-db-outage | BLOCKED | Tjenesten startet ikke. Kontroller entrypoint, miljøvariabler og applikasjonsavhengigheter. |
| TBE-06-gateway | BLOCKED | Tjenesten startet ikke. Kontroller entrypoint, miljøvariabler og applikasjonsavhengigheter. |
| TAI-01-05-transport | BLOCKED | Tjenesten startet ikke. Kontroller entrypoint, miljøvariabler og applikasjonsavhengigheter. |
| TAI-03-04-sql-runtime | BLOCKED | Tjenesten startet ikke. Kontroller entrypoint, miljøvariabler og applikasjonsavhengigheter. |
| TAI-04-private-attempts | BLOCKED | Tjenesten startet ikke. Kontroller entrypoint, miljøvariabler og applikasjonsavhengigheter. |
| TAI-06-budgets | BLOCKED | Tjenesten startet ikke. Kontroller entrypoint, miljøvariabler og applikasjonsavhengigheter. |
| TAI-06-busy | BLOCKED | Tjenesten startet ikke. Kontroller entrypoint, miljøvariabler og applikasjonsavhengigheter. |
| TAI-07-history-outage | BLOCKED | Tjenesten startet ikke. Kontroller entrypoint, miljøvariabler og applikasjonsavhengigheter. |
| TAI-06-large-result | BLOCKED | Tjenesten startet ikke. Kontroller entrypoint, miljøvariabler og applikasjonsavhengigheter. |
| TBE-06-timeout | BLOCKED | Tjenesten startet ikke. Kontroller entrypoint, miljøvariabler og applikasjonsavhengigheter. |
| TAI-07-process-isolation | BLOCKED | Tjenesten startet ikke. Kontroller entrypoint, miljøvariabler og applikasjonsavhengigheter. |
| TAI-06-result-bytes | BLOCKED | Tjenesten startet ikke. Kontroller entrypoint, miljøvariabler og applikasjonsavhengigheter. |
| TAI-06-sql-timeout | BLOCKED | Tjenesten startet ikke. Kontroller entrypoint, miljøvariabler og applikasjonsavhengigheter. |
| BENCH-HTTP-DB | BLOCKED | Tjenesten startet ikke. Kontroller entrypoint, miljøvariabler og applikasjonsavhengigheter. |
| TAI-02-08-real-model | BLOCKED | Tjenesten startet ikke. Kontroller entrypoint, miljøvariabler og applikasjonsavhengigheter. |
| cleanup | FAIL | Opprydding feilet: PermissionError |
| MAPI-1 | BLOCKED | API er ikke klart |
| MAPI-2 | BLOCKED | API er ikke klart |
| MAPI-3 | BLOCKED | API er ikke klart |
| MAPI-4 | BLOCKED | API er ikke klart |
| MAI-1 | BLOCKED | Internt AI-skjema kunne ikke hentes |
| MAI-2 | BLOCKED | Internt AI-skjema kunne ikke hentes |

## Benchmark


Alle delresultater, måleverdier og miljøopplysninger ligger i `report.json`.
