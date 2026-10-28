# Resultater

[unit-benchmark.json](unit-benchmark.json) er en faktisk lokal kjøring av regel-/opptaksbenchmarken. Filen inneholder kildehasher og miljø; ikke tolk HEAD alene som den målte kodeversjonen når endringene ikke er committet.

17 enhetstester for regel-/opptaksgrunnlaget bestod lokalt 2026-10-27 med Node 24.22.1/npm 11.19.1. Dette var deldekning av TWEB/TLAB, ikke ferdig produktverifikasjon.

2026-10-28: adapterbiblioteket har 37 egne Node-tester og 6 Playwright-tester inkludert browserbenchmarken; `npm test` kjører også de 17 eksisterende testene (54 bestått). Se [valideringsrapporten](game-input-validation.md), [Node-inputbenchmark](input-benchmark.json) og [browser-inputbenchmark](input-browser-benchmark.json). Fysisk browser/V2, instrumentert inputlatens og backendintegrasjon er fortsatt ikke verifisert i denne leveransen. Kjørbare kommandoer og begrensninger står i rapporten og [implementasjonsplanen](../spec/implementation-plan.md).

Senere samme dag: [sensoroppfølging](input-sensor-follow-up.md) dokumenterer brukerens browsertest, fysisk lysrespons, en revidert ristregel og tydeligere sensormålinger i eksemplet. 56 Node-tester og 7 Playwright-tester bestod etter endringen. Tidligere rapporter beholdes som historiske kjøringer; nye benchmarkrapporter ligger ved oppfølgingen.
