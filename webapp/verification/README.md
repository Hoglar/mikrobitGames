# Måleverktøy

`npm run benchmark` fra webapp kjører `benchmark.js` og skriver [rapporten](../results/unit-benchmark.json). Kjøringen måler rene plattformregler og Testlab-opptak, med 50/500 Hz akselerert logisk input og bufferomløp. Den bruker ingen enhet eller backend. Kapasitetskontroller feiler med ikke-null exitkode.

Rapporten inneholder miljø, kildehasher, metode, prøveantall, CPU-tid, throughput, percentiler og eksportstørrelser. Tidene inkluderer måleoverhead; én lokal kjøring er ikke en regresjonsgrense. Ingen adapter-, browser-, faktisk langkjørings- eller fysisk latens er verifisert. Se [planen](../spec/implementation-plan.md) for obligatoriske fremtidige målinger og grenser.
