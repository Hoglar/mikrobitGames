# Lokale resultater

Utvalgte testresultater, benchmarks og modelluttrekk. Oppgi dato, commit, krav eller modell, metode, testmiljø, forventet og faktisk resultat samt avvik. Målinger skal ha enheter og relevant konfigurasjon. Behold tidligere iterasjoner, og lenk til resultater som inngår i prosjektets felles FoM.

[Driftskontroll 2026-10-29](runtime-2026-10-29.md): offentlig HTTPS via Funnel, konto-/resultatflyt og avgrenset AI-prøve. Inkluderer et AI-avvik og begrensninger; dette er ingen ny FoM-måling.

Etter [implementeringsplanen](../spec/implementation-plan.md) skal hver kjøring gi maskinlesbare råresultater og en kort rapport med kontrollstatus, modellavvik og benchmark. Ta med kodecommit, kontroll-/spesifikasjonsversjon, datasett og modellens digest, runtime og innstillinger. Behold ufullstendige kjøringer med årsak; bare komplette målinger gir FoM-punkt under [results/fom](../../results/fom/README.md). Rapporter og råmålinger fra testkommandoen lagres under `runs/` (ignorert av git). Fem fullkjøringer er gjennomgått og arkivert i [den felles resultatoversikten](../../results/fom/README.md), med rapporter, rå benchmarkdata og tilgjengelige FoM-kurver. De lokale originalene beholdes. Nye rapporter blir ikke automatisk lagt i Git.
