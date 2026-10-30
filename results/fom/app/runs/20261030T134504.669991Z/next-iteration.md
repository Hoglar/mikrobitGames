# Neste iterasjon etter funker ikke

Kjøring: 20261030T134504.669991Z
Commit: 0658e3e22c1dee6672420dddca01a77ce0fc013e; lokale endringer: True
Kildehash: b318b0de83ca842438ac20a0481ae16ffe48ab87b17196e8cb9dd603a72992b2
Serie: dd4fe64446c1 · Profil: local-browser
FoM: —; teknisk: —; status: BLOCKED

## Testøkt

Vurderer / gruppe: Martin


## Brukeropplevelse og prioriteringer

Venter på gruppens UX-skår og kommentar.

## Feil og manglende målinger

- browser-app: BLOCKED — 0/0 bestått, 0 feil, 0 utelatt; logg: browser-app.log
- interrupted: BLOCKED — Kjøringen ble avbrutt. Delresultater er bevart.; logg: interrupted.log

Selvtest: PASS; logg: evaluation-selftest.log
53/53 bestått, 0 feil, 0 utelatt

## Avgrensning

- Firmware kjøres på vertsmaskinen med simulert maskinvare; USB, fysisk knapp-til-piksel-latens og tillatelsesdialog er ikke målt.
- Nettlesertester bruker mockede API-svar og Web Serial. Lokal backendkontroll tester reglene, ikke database eller AI-runtime.
- Benchmark måler input-replay og spillenes simulering; FPS, tegning/GPU og nettverkslatens inngår ikke.
- Maskinlast kan påvirke ytelsen. Kjør på samme maskin uten andre tunge oppgaver.
