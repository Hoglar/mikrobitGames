# Testresultat

Tid: 2026-10-28T18:54:22.473900+00:00
Kode: `3bd5d07f3ec92375c55cf3695e15a4e21516cdfc`
Modus: full · Python: 3.13.5
Kontrollversjon: 3 · Modellkontroller DB/API/AI: (24, 4, 4)
Endret arbeidsmappe: False

- Kontrollverktøy: {'PASS': 72}
- Enhetstester: {'PASS': 69}
- Integrasjon og benchmark: {'PASS': 42}

## FoM

Krav: **100.00 %** · Modell: **100.00 %**
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
| KAI-4 | PASS |
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

## Benchmark

### without_ai

Startdata: {'players': 1000, 'games': 10, 'records': 10000, 'attempts': 10000}. Etter belastning: {'records': 11393, 'attempts': 11524}.

| Operasjon | Antall | Feil | HTTP p95 ms | DB p95 ms |
| --- | --- | --- | --- | --- |
| leaderboard | 3240 | 0 | 34.19012599988491 | 8.415 |
| session | 1080 | 0 | 15.424376999817468 | 3.373 |
| result | 1080 | 0 | 29.765623999992386 | 15.199 |
### with_ai

Startdata: {'players': 1000, 'games': 10, 'records': 10000, 'attempts': 10000}. Etter belastning: {'records': 11391, 'attempts': 11524}.

| Operasjon | Antall | Feil | HTTP p95 ms | DB p95 ms |
| --- | --- | --- | --- | --- |
| leaderboard | 3240 | 0 | 33.54474600018875 | 8.404 |
| session | 1080 | 0 | 14.798770000197692 | 3.242 |
| result | 1080 | 0 | 29.164777000005415 | 14.898 |

| AI-fase | Sekunder | Format/status gyldig |
| --- | --- | --- |
| cold | 50.747 | True |
| warm | 14.837 | True |
| warm | 16.346 | True |
| warm | 10.639 | True |
| warm | 15.492 | True |
| warm | 16.358 | True |
| warm | 10.702 | True |
| warm | 15.491 | True |
| warm | 16.399 | True |
| warm | 10.704 | True |

AI-format og tidsgrense beviser ikke alle faktapåstander. Svarene ligger i rårapporten.

Alle delresultater, måleverdier og miljøopplysninger ligger i `report.json`.
