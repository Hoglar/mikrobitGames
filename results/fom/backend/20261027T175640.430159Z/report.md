# Testresultat

Tid: 2026-10-27T17:56:40.430159+00:00
Kode: `5b41984244483b8fec6e2f85f3d847754ff2923d`
Modus: full · Python: 3.13.5
Kontrollversjon: 2 · Modellkontroller DB/API/AI: (24, 4, 4)
Endret arbeidsmappe: True

- Kontrollverktøy: {'PASS': 63}
- Enhetstester: {'PASS': 52}
- Integrasjon og benchmark: {'PASS': 34, 'FAIL': 5, 'BLOCKED': 1}

## FoM

**Ikke komplett målbart ennå. Ingen FoM-punkt eller oppdiktet baseline.**
- Arbeidsmappen er ikke en ren commit. Resultatene er foreløpige, uten FoM-punkt.

## Kontrollgrupper

| Gruppe | Status |
| --- | --- |
| KDB-1 | PASS |
| KDB-2 | PASS |
| KDB-3 | PASS |
| KDB-4 | PASS |
| KAPI-1 | FAIL |
| KAPI-2 | FAIL |
| KAPI-3 | PASS |
| KAPI-4 | FAIL |
| KAI-1 | PASS |
| KAI-2 | PASS |
| KAI-3 | PASS |
| KAI-4 | FAIL |
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
| MAPI-1 | PASS |
| MAPI-2 | PASS |
| MAPI-3 | PASS |
| MAPI-4 | PASS |
| MAI-1 | PASS |
| MAI-2 | PASS |
| MAI-3 | PASS |
| MAI-4 | PASS |

## Feil og kontroller som ikke ble utført

| Kontroll | Status | Årsak |
| --- | --- | --- |
| TBE-02-renew-expiry | FAIL | CheckViolation: testen kunne ikke fullføres som forventet. |
| TBE-05-concurrent-records | FAIL | Forventningen var ikke oppfylt. |
| TBE-05-concurrent-replay | FAIL | Forventningen var ikke oppfylt. |
| TBE-07-rate-limit | FAIL | HTTP 400, forventet 401 |
| BENCH-HTTP-DB | BLOCKED | Målinger mangler: with_ai PSS. Påviste avvik: with_ai DB-topp > 1000 ms; with_ai feil under topper; with_ai/result DB p95 > 200 ms; with_ai/result HTTP p95 > 500 ms; without_ai DB-topp > 1000 ms; without_ai feil under topper; without_ai/result DB p95 > 200 ms; without_ai/result HTTP p95 > 500 ms |
| TAI-02-08-real-model | FAIL | Forventningen var ikke oppfylt. |

## Benchmark

### without_ai

Startdata: {'players': 1000, 'games': 10, 'records': 10000, 'attempts': 10000}. Etter belastning: {'records': 11315, 'attempts': 11335}.

| Operasjon | Antall | Feil | HTTP p95 ms | DB p95 ms |
| --- | --- | --- | --- | --- |
| leaderboard | 3240 | 0 | 203.04453700009617 | 177.039 |
| session | 1080 | 0 | 180.36676400015494 | 167.984 |
| result | 1080 | 0 | 848.1393869997191 | 833.773 |
### with_ai

Startdata: {'players': 1000, 'games': 10, 'records': 10000, 'attempts': 10000}. Etter belastning: {'records': 11317, 'attempts': 11337}.

| Operasjon | Antall | Feil | HTTP p95 ms | DB p95 ms |
| --- | --- | --- | --- | --- |
| leaderboard | 3240 | 0 | 206.09956399948715 | 176.951 |
| session | 1080 | 0 | 180.59979699955875 | 167.928 |
| result | 1080 | 0 | 848.3421020000605 | 833.569 |

| AI-fase | Sekunder | Format/status gyldig |
| --- | --- | --- |
| cold | 43.950 | False |
| warm | 13.680 | False |
| warm | 17.382 | False |
| warm | 8.994 | True |
| warm | 15.045 | False |
| warm | 16.021 | False |
| warm | 8.993 | True |
| warm | 15.009 | False |
| warm | 16.048 | False |
| warm | 8.970 | True |

AI-format og tidsgrense beviser ikke alle faktapåstander. Svarene ligger i rårapporten.

Alle delresultater, måleverdier og miljøopplysninger ligger i `report.json`.
