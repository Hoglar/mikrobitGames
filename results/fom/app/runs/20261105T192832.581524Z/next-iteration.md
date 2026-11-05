# Neste iterasjon etter 04 – Tetris-styring, spillflate og tilkobling

Kjøring: 20261105T192832.581524Z
Commit: d54d01239620c0210b2ae0c2df298750c42669b9; lokale endringer: False
Kildehash: 7f1b47488b7865ff1f8b504f68500a0230d6fbe0af9f4bfc7234c80e56e63489
Serie: 216cc22a506d · Profil: local-browser
FoM: 100.00; teknisk: 100.00; status: COMPLETE

## Brukeropplevelse og prioriteringer

2026-11-05T19:36:36.129130+00:00 · Martin · 10.0/10
vi er fornøyde nå

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
