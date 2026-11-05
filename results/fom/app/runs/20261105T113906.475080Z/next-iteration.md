# Neste iterasjon etter 03 – kontrollert tidspunkt i Viking-lydtesten

Kjøring: 20261105T113906.475080Z
Commit: f6730683d6ac67c437f7bda7d6811b0f9b982c5f; lokale endringer: True
Kildehash: 79ab77a905f20c058e38aada47f9ec7f3f2b4fbab5e79a1bfd0ff6de19630f8c
Serie: 754257955077 · Profil: local-browser
FoM: 98.00; teknisk: 100.00; status: COMPLETE

## Brukeropplevelse og prioriteringer

2026-11-05T11:42:59.338200+00:00 · Martin · 9.0/10
Nå er alt nesten helt bra, funksjonalitet virker som planlagt

## Feil og manglende målinger

Ingen registrerte testfeil.

Selvtest: PASS; logg: evaluation-selftest.log
64/64 bestått, 0 feil, 0 utelatt

## Avgrensning

- Firmware kjøres på vertsmaskinen med simulert maskinvare; USB, fysisk knapp-til-piksel-latens og tillatelsesdialog er ikke målt.
- Nettlesertester bruker mockede API-svar og Web Serial. Lokal backendkontroll tester reglene, ikke database eller AI-runtime.
- Benchmark måler input-replay og spillenes simulering; FPS, tegning/GPU og nettverkslatens inngår ikke.
- Maskinlast kan påvirke ytelsen. Kjør på samme maskin uten andre tunge oppgaver.
- Micro Racer inngår i web-/nettlesertestene, men har ingen egen profil i det eksisterende CPU-benchmarket for seks spill. Supplerende AI-scoretester under backend/ai-service/tests kjøres separat og gir ingen FoM-poeng.
- Levende API, PostgreSQL og lokal AI er ikke kjørt. Bruk --backend-full i konfigurert backend-testmiljø for en egen utvidet serie.
