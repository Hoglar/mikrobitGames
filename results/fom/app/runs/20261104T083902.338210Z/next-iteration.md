# Neste iterasjon etter 2026-11-04 – Micro Racer etter evalueringsrettelse

Kjøring: 20261104T083902.338210Z
Commit: f77aedeab492f6c5837fd79f86cac2212932ece2; lokale endringer: True
Kildehash: 6a3ca2e6b85478352d7a34713be15ebe288b487719ae3c404bda3d031d0f8a52
Serie: f9491acd0594 · Profil: local-browser
FoM: —; teknisk: —; status: BLOCKED

## Brukeropplevelse og prioriteringer

Venter på gruppens UX-skår og kommentar.

## Feil og manglende målinger

- interrupted: BLOCKED — Kjøringen ble avbrutt. Delresultater er bevart.; logg: interrupted.log

Selvtest: FAIL; logg: evaluation-selftest.log
53/57 bestått, 4 feil, 0 utelatt

## Avgrensning

- Firmware kjøres på vertsmaskinen med simulert maskinvare; USB, fysisk knapp-til-piksel-latens og tillatelsesdialog er ikke målt.
- Nettlesertester bruker mockede API-svar og Web Serial. Lokal backendkontroll tester reglene, ikke database eller AI-runtime.
- Benchmark måler input-replay og spillenes simulering; FPS, tegning/GPU og nettverkslatens inngår ikke.
- Maskinlast kan påvirke ytelsen. Kjør på samme maskin uten andre tunge oppgaver.
- Micro Racer inngår i web-/nettlesertestene, men har ingen egen profil i det eksisterende CPU-benchmarket for seks spill. Supplerende AI-scoretester under backend/ai-service/tests kjøres separat og gir ingen FoM-poeng.
