# Figure of Merit

[Implementeringsplanen](../../backend/spec/implementation-plan.md) fastsetter to felles mål: **krav-FoM** og **modell-FoM**, begge i prosent med lik vekt til database, API og AI. Høyere er bedre. Formler, faste kontrollpunkter og behandling av ufullstendige kjøringer er beskrevet der.

Her skal komplette målepunkter og to fremgangskurver lagres, med lenker til [råresultatene](../../backend/results/README.md). Registrer baseline før forbedringene og minst tre målepunkter totalt over tid. Brukeren bestemmer hver utviklingsrunde. Behold regresjoner; ufullstendige kjøringer gir rapport, ikke komplett FoM. Endret fasit eller tellemetode krever ny merket serie eller ommåling av tidligere commits.

Knytt hver måling til tidspunkt, kodecommit, kontrollversjon og miljø. Ingen baseline, måleresultater eller kurver er produsert ennå. Kurvene genereres automatisk ved komplette kjøringer under `backend/results/runs/`; utvalgte rapporter og kurver arkiveres her for gruppen. Se [kjørekommandoene](../../backend/verification/README.md).
