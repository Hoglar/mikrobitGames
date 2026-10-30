# 02 test fførste iterasjon

[Alle iterasjoner](../../history.md) · [HTML-rapport](report.html) · [Rårapport](report.json)

Kjøring: 20261030T134157.523334Z. Tid (UTC): 2026-10-30T13:41:57.880693+00:00.

Profil: local-browser. Serie: dd4fe64446c1. Commit: 0658e3e22c1dee6672420dddca01a77ce0fc013e. Lokale endringer: False.

![FoM-score gjennom iterasjoner](../../history.svg)

## Testøkt

Vurderer / gruppe: Martin.

```text

```

## Slik beregnes samlet FoM

**FoM = 50 % × F + 30 % × P + 20 % × U**, på skalaen 0–100.

| Del | Skår / 100 | Vekt | Vektet bidrag | Grunnlag |
| --- | ---: | ---: | ---: | --- |
| F – funksjon | 100.00 | 50 % | — | Lik vekt mellom funksjonsgruppene: enhetstester, integrasjon/nettleser og plattformens kapasitetskontroll. Ufullstendig komponent; skåren viser bare et delgjennomsnitt. |
| P – benchmarks / ytelse | 100.00 | 30 % | 30.00 | Lik vekt mellom målte benchmarkgrupper; lik vekt mellom profilene i hver gruppe. |
| U – brukeropplevelse | — | 20 % | — | Siste fullførte UX-skår multiplisert med 10. |

**Samlet FoM: — / 100 · BLOCKED.**

Teknisk skår uten UX: — / 100. Den normaliserer F og P etter deres samlede vekt og er et eget, åpent punkt i grafen.

Hver funksjonsgruppes skår er beståttandel × 100. Kapasitetskontrollen gir 100 ved PASS og 0 ved FAIL. Hver ytelsesprofil får `100 × min(1, budsjett / målt p95)`, med 100 ved målt null.

Målte feil (FAIL) trekker skåren ned og beholdes i grafen. BLOCKED betyr at en måling mangler eller ikke kan stoles på; da beregnes ingen samlet FoM. Delverdiene over kan være ufullstendige. UX fylles aldri inn automatisk.

Grupper i F: web-unit: 100.00, input-unit: 100.00, backend-unit: 100.00, firmware: 100.00, cross-component: 100.00, platform-capacity: 100.00, interrupted: —.

Grupper i P: input-benchmark: 100.00, games-benchmark: 100.00.

## Måleverktøyets egenkontroll

Status: PASS. [Logg](evaluation-selftest.log).

53/53 bestått, 0 feil, 0 utelatt

## Enhetstester (unit tests)

| Kontroll | Status | Skår / 100 | Bidrar til | Detaljer / logg |
| --- | --- | ---: | --- | --- |
| web-unit | PASS | 100.00 | F – funksjon | 58/58 bestått, 0 feil, 0 utelatt [Logg](web-unit.log) |
| input-unit | PASS | 100.00 | F – funksjon | 39/39 bestått, 0 feil, 0 utelatt [Logg](input-unit.log) |
| backend-unit | PASS | 100.00 | F – funksjon | 72/72 bestått, 0 feil, 0 utelatt [Logg](backend-unit.log) |
| firmware | PASS | 100.00 | F – funksjon | 3/3 bestått, 0 feil, 0 utelatt [Logg](firmware.log) |

## Integrasjon og andre funksjonstester

| Kontroll | Status | Skår / 100 | Bidrar til | Detaljer / logg |
| --- | --- | ---: | --- | --- |
| cross-component | PASS | 100.00 | F – funksjon | 3/3 bestått, 0 feil, 0 utelatt [Logg](cross-component.log) |
| interrupted | BLOCKED | — | F – funksjon | Kjøringen ble avbrutt. Delresultater er bevart. [Logg](interrupted.log) |

## Benchmarks

| Kontroll | Status | Skår / 100 | Bidrar til | Detaljer / logg |
| --- | --- | ---: | --- | --- |
| platform-capacity | PASS | 100.00 | F – funksjon | 50/500 Hz opptak, fast bufferkapasitet og eksport; tidsmålinger i platform-benchmark.json. [Logg](platform-benchmark.log) |
| input-benchmark | PASS | 100.00 | P – ytelse | 4 målte profiler; rådata: input-benchmark.json [Logg](input-benchmark.log) |
| games-benchmark | PASS | 100.00 | P – ytelse | 6 målte profiler; rådata: games-benchmark.json [Logg](games-benchmark.log) |

Plattformens kapasitetsbenchmark bidrar til F (korrekthet); dets rå tidsmålinger gis ingen oppdiktet ytelsesvekt.

### Målte ytelsesprofiler

| Profil | p95 ms | Budsjett ms | Skår / 100 |
| --- | ---: | ---: | ---: |
| input-50Hz-1-abonnenter | 0.0274 | 5.0000 | 100.00 |
| input-50Hz-4-abonnenter | 0.0220 | 5.0000 | 100.00 |
| input-500Hz-1-abonnenter | 0.0201 | 5.0000 | 100.00 |
| input-500Hz-4-abonnenter | 0.0203 | 5.0000 | 100.00 |
| snake | 0.0305 | 16.6667 | 100.00 |
| viking | 0.0508 | 16.6667 | 100.00 |
| stars | 0.0510 | 16.6667 | 100.00 |
| reaction | 0.0044 | 16.6667 | 100.00 |
| balance | 0.0144 | 16.6667 | 100.00 |
| tetris | 0.0942 | 16.6667 | 100.00 |

### Rådata fra benchmarks

- [games-benchmark.json](games-benchmark.json)
- [input-benchmark.json](input-benchmark.json)
- [platform-benchmark.json](platform-benchmark.json)

## Brukeropplevelse (UX)

Ny brukervurdering har to spørsmål: Beskriv brukeropplevelsen med egne ord, og gi en skår fra 1–10. Delvise svar beholdes uten å gi UX-poeng.

Venter på gruppens UX-skår og kommentarer.

## Feil og blokkeringer

| Kontroll | Status | Skår / 100 | Bidrar til | Detaljer / logg |
| --- | --- | ---: | --- | --- |
| interrupted | BLOCKED | — | F – funksjon | Kjøringen ble avbrutt. Delresultater er bevart. [Logg](interrupted.log) |

### interrupted: BLOCKED

Loggutdrag:

```text

Kjøringen ble avbrutt. Delresultater er bevart.

```

## Måleomfang

- Firmware kjøres på vertsmaskinen med simulert maskinvare; USB, fysisk knapp-til-piksel-latens og tillatelsesdialog er ikke målt.
- Nettlesertester bruker mockede API-svar og Web Serial. Lokal backendkontroll tester reglene, ikke database eller AI-runtime.
- Benchmark måler input-replay og spillenes simulering; FPS, tegning/GPU og nettverkslatens inngår ikke.
- Maskinlast kan påvirke ytelsen. Kjør på samme maskin uten andre tunge oppgaver.

[Til neste iterasjon](next-iteration.md) · [Maskinlesbar oppsummering](summary.json)
