# Felles tester

[Felles appevaluering](../results/fom/app/README.md) kjøres fra prosjektroten:

```powershell
python tests/evaluate.py run
```

I terminalen spør testen om navn på iterasjonen, vurderer/gruppe og eventuell
testkontekst. Etter de automatiske testene stiller brukervurderingen to spørsmål:

1. Hvordan var brukeropplevelsen?
2. Hvilken skår gir dere brukeropplevelsen (1–10)?

Svarene samles med deltester og benchmarks i én rapport med FoM-graf.
Skriv `senere` under brukervurderingen for å utsette den; registrerte svar og
automatiske resultater beholdes.

Åpne `results/fom/app/index.html` for historikken, eller
`results/fom/app/runs/<kjørings-ID>/report.html` for én samlet rapport med graf.
I GitHub kan dere lese [historikken og Markdown-rapportene](../results/fom/app/history.md).
FoM krever både komplette automatiske målinger og en faktisk UX-vurdering.

Rapporten skiller mellom enhetstester, integrasjonstester, benchmarks og
brukervurdering. **FoM = 0,50 × funksjon + 0,30 × ytelse + 0,20 × UX**, med alle
delskårer fra 0 til 100. Enhets- og integrasjonstestene inngår i funksjon,
benchmarkenes ytelsesmålinger i ytelse, og gruppens UX-skår 1–10 ganges med 10.
Plattformbenchmarkens kapasitetskrav inngår i funksjon; rå tidstall uten et
avtalt budsjett får ingen egen ytelsesvekt.

En feil i en deltest tas med i rapporten, og kjøringen fortsetter med uavhengige
tester og brukervurderingen. Målte feil trekker skåren ned. Manglende verktøy eller
ufullstendige målinger merkes `BLOCKED`, beholder loggene og gir ingen komplett
FoM.

Resultater, testdata og logger under `results/fom/app/`, inkludert grafen
`history.svg`, er tilgjengelige for manuell innsjekking. Når dere selv tar dem
med i commit og push fra VS Code, følger de med til GitHub. Se
[grafen og delingsoppsettet](../results/fom/app/README.md#graf-og-resultater-i-github).

For kjøring uten spørsmål, bruk
`python tests/evaluate.py run --non-interactive --label "01 – baseline"`.
`--interactive` tvinger frem spørsmål når inndata videresendes fra et annet
program. På Linux/macOS kan kommandoen hete `python3`.

Verktøyet kjører også koblingstestene i `integration/components.test.mjs`.
`evaluation/` inneholder benchmarks, rapportgenerator, skårberegning og
regresjonstester for måleverktøyet. Se kjøreguiden for engangsoppsett og senere
registrering eller retting av UX-vurderingen.

[integration/](integration/README.md) inneholder tester mellom hoveddelene, og [e2e/](e2e/README.md) beskriver samlede brukerforløp. Interne backend-tester ligger under backend/tests. De kjørbare nettleserforløpene ligger i webapp/tests/app/browser.
