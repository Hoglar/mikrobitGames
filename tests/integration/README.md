# Integrasjon mellom hoveddelene

Tester av Micro:bit–webapp og webapp–backend. Samme test kan refereres fra flere arbeidspakker uten å kopieres. Dokumenter fysisk oppsett og manuelle steg der maskinvaretesten ikke automatiseres. Resultater lagres i results/verification i roten.

`components.test.mjs` bruker den kompilerte firmwarekjernen sammen med webappens
protokollkode i begge retninger. Den sammenligner også grenseverdier for alle
registrerte spill med backendens faktiske resultatvalidering via `score-oracle.py`.
Ingen fysisk enhet eller database inngår i disse testene.

Kjør som del av `python3 tests/evaluate.py run --label "01 – baseline"`;
verktøyet bygger simulatoren og lagrer resultatet under `results/fom/app/runs/`.
Se [felles kjøreguide](../../results/fom/app/README.md).
