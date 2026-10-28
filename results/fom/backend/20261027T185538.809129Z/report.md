# Testresultat

Tid: 2026-10-27T18:55:38.809129+00:00
Kode: `e21d82edc82301c1ef26b4e64a9771780db67291`
Modus: full · Python: 3.13.5
Kontrollversjon: 2 · Modellkontroller DB/API/AI: (24, 4, 4)
Endret arbeidsmappe: False

- Kontrollverktøy: {'PASS': 72}
- Enhetstester: {'PASS': 52}
- Integrasjon og benchmark: {'PASS': 36, 'FAIL': 4}

## FoM

Krav: **83.33 %** · Modell: **100.00 %**
Kurver: [krav](requirements.svg) · [modell](model.svg)

## Kontrollgrupper

| Gruppe | Status |
| --- | --- |
| KDB-1 | PASS |
| KDB-2 | PASS |
| KDB-3 | PASS |
| KDB-4 | PASS |
| KAPI-1 | PASS |
| KAPI-2 | FAIL |
| KAPI-3 | PASS |
| KAPI-4 | PASS |
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
| TBE-05-concurrent-records | FAIL | Forventningen var ikke oppfylt. |
| TBE-05-concurrent-replay | FAIL | Forventningen var ikke oppfylt. |
| BENCH-HTTP-DB | FAIL | with_ai DB-topp > 1000 ms; with_ai feil under topper; with_ai/result DB p95 > 200 ms; with_ai/result HTTP p95 > 500 ms; without_ai DB-topp > 1000 ms; without_ai feil under topper; without_ai/result DB p95 > 200 ms; without_ai/result HTTP p95 > 500 ms |
| TAI-02-08-real-model | FAIL | Forventningen var ikke oppfylt. |

## Benchmark

### without_ai

Startdata: {'players': 1000, 'games': 10, 'records': 10000, 'attempts': 10000}. Etter belastning: {'records': 11324, 'attempts': 11347}.

| Operasjon | Antall | Feil | HTTP p95 ms | DB p95 ms |
| --- | --- | --- | --- | --- |
| leaderboard | 3240 | 0 | 206.22940600060247 | 178.323 |
| session | 1080 | 0 | 180.32876100005524 | 167.312 |
| result | 1080 | 0 | 848.2509010000285 | 833.557 |
### with_ai

Startdata: {'players': 1000, 'games': 10, 'records': 10000, 'attempts': 10000}. Etter belastning: {'records': 11329, 'attempts': 11346}.

| Operasjon | Antall | Feil | HTTP p95 ms | DB p95 ms |
| --- | --- | --- | --- | --- |
| leaderboard | 3240 | 0 | 206.33878499938874 | 177.329 |
| session | 1080 | 0 | 180.27274400083115 | 167.262 |
| result | 1080 | 0 | 848.0114140002115 | 833.28 |

| AI-fase | Sekunder | Format/status gyldig |
| --- | --- | --- |
| cold | 44.235 | False |
| warm | 13.665 | False |
| warm | 17.379 | False |
| warm | 8.994 | True |
| warm | 15.017 | False |
| warm | 15.927 | False |
| warm | 8.950 | True |
| warm | 14.927 | False |
| warm | 15.983 | False |
| warm | 8.994 | True |

AI-format og tidsgrense beviser ikke alle faktapåstander. Svarene ligger i rårapporten.

Alle delresultater, måleverdier og miljøopplysninger ligger i `report.json`.
