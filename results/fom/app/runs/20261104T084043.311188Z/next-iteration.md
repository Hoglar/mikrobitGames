# Neste iterasjon etter 2026-11-04 – Micro Racer med rettet evalueringsverktøy

Kjøring: 20261104T084043.311188Z
Commit: f77aedeab492f6c5837fd79f86cac2212932ece2; lokale endringer: True
Kildehash: 6a3ca2e6b85478352d7a34713be15ebe288b487719ae3c404bda3d031d0f8a52
Serie: a8a78ef6f9ea · Profil: local-browser
FoM: 95.86; teknisk: 99.83; status: COMPLETE

## Brukeropplevelse og prioriteringer

2026-11-04T08:52:18.591011+00:00 · Martin · 8.0/10
Nettsiden er visuelt mye finere nå.

## Feil og manglende målinger

- browser-app: FAIL — 45/46 bestått, 1 feil, 0 utelatt; logg: browser-app.log

Selvtest: PASS; logg: evaluation-selftest.log
57/57 bestått, 0 feil, 0 utelatt

## Avgrensning

- Firmware kjøres på vertsmaskinen med simulert maskinvare; USB, fysisk knapp-til-piksel-latens og tillatelsesdialog er ikke målt.
- Nettlesertester bruker mockede API-svar og Web Serial. Lokal backendkontroll tester reglene, ikke database eller AI-runtime.
- Benchmark måler input-replay og spillenes simulering; FPS, tegning/GPU og nettverkslatens inngår ikke.
- Maskinlast kan påvirke ytelsen. Kjør på samme maskin uten andre tunge oppgaver.
- Micro Racer inngår i web-/nettlesertestene, men har ingen egen profil i det eksisterende CPU-benchmarket for seks spill. Supplerende AI-scoretester under backend/ai-service/tests kjøres separat og gir ingen FoM-poeng.
- Levende API, PostgreSQL og lokal AI er ikke kjørt. Bruk --backend-full i konfigurert backend-testmiljø for en egen utvidet serie.
