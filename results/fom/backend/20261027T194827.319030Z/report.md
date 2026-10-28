# Testresultat

Tid: 2026-10-27T19:48:27.319030+00:00
Kode: `d70e9fa5d8944705060c716eea29a7c0fcd65ec3`
Modus: full · Python: 3.13.5
Kontrollversjon: 2 · Modellkontroller DB/API/AI: (24, 4, 4)
Endret arbeidsmappe: False

- Kontrollverktøy: {'PASS': 72}
- Enhetstester: {'PASS': 52}
- Integrasjon og benchmark: {'PASS': 39, 'FAIL': 1}

## FoM

Krav: **91.67 %** · Modell: **100.00 %**
Kurver: [krav](requirements.svg) · [modell](model.svg)

## Kontrollgrupper

| Gruppe | Status |
| --- | --- |
| KDB-1 | PASS |
| KDB-2 | PASS |
| KDB-3 | PASS |
| KDB-4 | PASS |
| KAPI-1 | PASS |
| KAPI-2 | PASS |
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
| TAI-02-08-real-model | FAIL | Forventningen var ikke oppfylt. |

## Benchmark

### without_ai

Startdata: {'players': 1000, 'games': 10, 'records': 10000, 'attempts': 10000}. Etter belastning: {'records': 11393, 'attempts': 11524}.

| Operasjon | Antall | Feil | HTTP p95 ms | DB p95 ms |
| --- | --- | --- | --- | --- |
| leaderboard | 3240 | 0 | 34.56072500011942 | 8.633 |
| session | 1080 | 0 | 15.413310999065288 | 3.431 |
| result | 1080 | 0 | 30.1624220010126 | 15.532 |
### with_ai

Startdata: {'players': 1000, 'games': 10, 'records': 10000, 'attempts': 10000}. Etter belastning: {'records': 11391, 'attempts': 11524}.

| Operasjon | Antall | Feil | HTTP p95 ms | DB p95 ms |
| --- | --- | --- | --- | --- |
| leaderboard | 3240 | 0 | 36.63817099914013 | 8.948 |
| session | 1080 | 0 | 15.874310000072 | 3.383 |
| result | 1080 | 0 | 30.02785699936794 | 15.355 |

| AI-fase | Sekunder | Format/status gyldig |
| --- | --- | --- |
| cold | 44.349 | False |
| warm | 13.657 | False |
| warm | 17.321 | False |
| warm | 8.968 | True |
| warm | 15.003 | False |
| warm | 16.031 | False |
| warm | 9.002 | True |
| warm | 15.031 | False |
| warm | 16.027 | False |
| warm | 9.007 | True |

AI-format og tidsgrense beviser ikke alle faktapåstander. Svarene ligger i rårapporten.

Alle delresultater, måleverdier og miljøopplysninger ligger i `report.json`.
