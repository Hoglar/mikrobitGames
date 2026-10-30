# Felles tester

[Felles appevaluering](../results/fom/app/README.md) kjøres med
`python3 tests/evaluate.py run --label "01 – baseline"`. Verktøyet samler
deltestene, kjører koblingstestene i `integration/components.test.mjs` og lagrer
FoM-historikk, graf og UX-kommentarer. `evaluation/` inneholder benchmarks,
rapportgenerator, skårberegning og regresjonstester for måleverktøyet.

[integration/](integration/README.md) inneholder tester mellom hoveddelene, og [e2e/](e2e/README.md) beskriver samlede brukerforløp. Interne backend-tester ligger under backend/tests. De kjørbare nettleserforløpene ligger i webapp/tests/app/browser.
