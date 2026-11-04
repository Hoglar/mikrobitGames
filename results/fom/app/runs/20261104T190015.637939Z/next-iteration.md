# Neste iterasjon etter 02 – spillisolasjon og SDK

Kjøring: 20261104T190015.637939Z
Commit: b48b42ed7b74d11b4f8e58471263815971d7fdc6; lokale endringer: False
Kildehash: 79ab77a905f20c058e38aada47f9ec7f3f2b4fbab5e79a1bfd0ff6de19630f8c
Serie: 7b4225da7b54 · Profil: local-browser
FoM: 97.86; teknisk: 99.83; status: COMPLETE

## Brukeropplevelse og prioriteringer

2026-11-04T19:03:41.928079+00:00 · Martin · 9.0/10
Nå er alt nesten helt bra, funksjonalitet virker som planlagt

## Feil og manglende målinger

- browser-app: FAIL — 45/46 bestått, 1 feil, 0 utelatt; logg: browser-app.log

Selvtest: PASS; logg: evaluation-selftest.log
64/64 bestått, 0 feil, 0 utelatt

## Avgrensning

- Firmware kjøres på vertsmaskinen med simulert maskinvare; USB, fysisk knapp-til-piksel-latens og tillatelsesdialog er ikke målt.
- Nettlesertester bruker mockede API-svar og Web Serial. Lokal backendkontroll tester reglene, ikke database eller AI-runtime.
- Benchmark måler input-replay og spillenes simulering; FPS, tegning/GPU og nettverkslatens inngår ikke.
- Maskinlast kan påvirke ytelsen. Kjør på samme maskin uten andre tunge oppgaver.
- Micro Racer inngår i web-/nettlesertestene, men har ingen egen profil i det eksisterende CPU-benchmarket for seks spill. Supplerende AI-scoretester under backend/ai-service/tests kjøres separat og gir ingen FoM-poeng.
- Levende API, PostgreSQL og lokal AI er ikke kjørt. Bruk --backend-full i konfigurert backend-testmiljø for en egen utvidet serie.
