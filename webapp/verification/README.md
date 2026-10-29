# Måleverktøy

`npm run benchmark` fra webapp kjører `benchmark.js` og skriver [rapporten](../results/unit-benchmark.json). Kjøringen måler rene plattformregler og Testlab-opptak, med 50/500 Hz akselerert logisk input og bufferomløp. Den bruker ingen enhet eller backend. Kapasitetskontroller feiler med ikke-null exitkode.

Rapporten inneholder miljø, kildehasher, metode, prøveantall, CPU-tid, throughput, percentiler og eksportstørrelser. Tidene inkluderer måleoverhead; én lokal kjøring er ikke en regresjonsgrense.

`npm run benchmark:input` måler den leverte adapteren fra fullstendig linje til state-callback, ved 50/500 Hz og én/fire abonnenter. Hver profil spiller av 300 sekunder logisk tid etter 1000 oppvarmingsframes. Rapporten er [input-benchmark.json](../results/input-benchmark.json). Normalprofilen kontrollerer kontraktens p95 ≤ 5 ms; serialframing, validering og normalisering bruker produksjonskode med fake transport/klokke. Testharnessens målearrayer er ikke bibliotekets bufferbruk.

`npm run test:browser` måler også tilsvarende profiler med native Streams i Chromium og Web Serial-mock. Rapporten er [input-browser-benchmark.json](../results/input-browser-benchmark.json). Nettlesertestene starter lokalserveren selv. Installer riktig Chromium-revisjon med `npx playwright install chromium` etter `npm ci`.

Replay med akselerert logisk tid er ikke en faktisk femminutters USB-soak. Reelle tillatelsesdialoger, hardware-roundtrip, kontinuerlig heap-/stack-topp og fysisk knapp/tilt til spillcallback er fortsatt umålt. Manuell timing kan ikke etablere fysisk latens-PASS. Se [valideringsrapporten](../results/game-input-validation.md) og [planen](../spec/implementation-plan.md).

Sett eventuelt `INPUT_BENCHMARK_REPORT` eller `INPUT_BROWSER_BENCHMARK_REPORT` til en annen filsti før kjøring for å bevare tidligere rapporter. Relative stier tolkes fra arbeidsmappen (`webapp/` ved npm-kommandoene). [Sensoroppfølgingen](../results/input-sensor-follow-up.md) bruker separate rapporter etter endringen av ristklassifikatoren.

## Webapp og samlet leveranse

- `npm run dev`: lokal kildeforhåndsvisning, port 4174.
- `npm run build`: rydder generert `dist/`, kopierer hele den offentlige appen og skriver SHA-256-manifest.
- `npm run preview`: serverer bare `dist/`, port 4174.
- `npm run test:app`: bygger og tester den statiske pakken med mockede eksterne grensesnitt.
- `npm run catalog:commands`: skriver backendens registreringskommandoer uten å kjøre dem.

Lokal server videresender ingen cookies til produksjon og omskriver ikke Origin.
Faktisk innlogging testes ved at bygget serveres fra samme HTTPS-origin som API-et.
