# Resultater

[unit-benchmark.json](unit-benchmark.json) er en faktisk lokal kjøring av regel-/opptaksbenchmarken. Filen inneholder kildehasher og miljø; ikke tolk HEAD alene som den målte kodeversjonen når endringene ikke er committet.

17 enhetstester bestod lokalt 2026-10-27 med Node 24.22.1/npm 11.19.1. Kjør `npm test` for ny kontroll. Testene gir deldekning av TWEB/TLAB, ikke ferdig produktverifikasjon. Nettleser, adapter, backendintegrasjon og fysisk V2 er ikke verifisert her. Målemetode og begrensninger står i rapporten og [implementasjonsplanen](../spec/implementation-plan.md).
