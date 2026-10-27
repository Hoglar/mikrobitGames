# Start her: grunnlaget for backend-implementeringen

**Status 2026-10-25:** Krav, designmodeller og testkode er skrevet. Database, API og AI er ennå ikke implementert, og ingen produktbaseline er målt. Første implementasjon bestilles av brukeren; oppsett på Parrot inngår i klargjøringen.

Mappen `spec/` samler både spesifikasjon, teknisk design og planer. Dokumentenes rolle, ikke mappenavnet, avgjør hvordan de skal brukes. Denne siden er en leseveiledning; den definerer ingen nye funksjonskrav.

## Leserekkefølge

1. **Hva vi bygger:** Les krav og ansvar i [databaseoversikten](requirements.md), [backend-modulen](backend-module.md) og [AI-modulen](ai-module.md). Kontraktene nedenfor er oppslagsverk for presis oppførsel.
2. **Hvordan delene utformes:** Les komponentdelene i modulbeskrivelsene, [datamodellen og diagrammene](models/README.md) og [interne grensesnitt og oppstart](../verification/test-runtime.md).
3. **Hvordan arbeidet gjennomføres:** Les [byggerekkefølge og iterative runder](implementation-plan.md). [Begrepsforklaringen](iterative-development.md) skiller testing, verifisering og FoM.
4. **Hvordan du kontrollerer leveransen:** Bruk [kjøreguiden](../verification/README.md). Detaljert testdekning finnes i [testoversikten](../tests/README.md).

## Hvor finnes fasiten?

| Område | Autoritativt grunnlag | Rolle |
| --- | --- | --- |
| Kontoer, sesjoner, rekordregler og DB-kvalitetskrav | [Kontrakt 1.4](contracts/backend-database/contract.md) | Krav til oppførsel; tekniske anbefalinger er merket i teksten. [Kortversjonen](contracts/backend-database/README.md) er en lesehjelp. |
| Frontendens API | [OpenAPI 1.3](../../spec/contracts/webapp-backend/openapi.yaml) og [utviklerguiden](../../spec/contracts/webapp-backend/contract.md) | OpenAPI definerer felter/ruter; guiden beskriver brukerforløp. Se status nedenfor. |
| API–AI-meldinger og utfall | [Kontrakt 1.5](contracts/backend-ai/contract.md) | Grensesnitt og oppførsel. |
| AI-datatilgang og sikkerhetsgrenser | [Kontrakt 1.6](contracts/ai-database/contract.md) | Tillatte data, operasjoner og begrensninger. |
| Databasestruktur | [Datamodell](models/data-model.md) | Teknisk design med felt, relasjoner og begrensninger. ER-diagram og JSON-fasit skal gjengi dette. |
| Komponenter og tekniske valg | [API](backend-module.md), [AI](ai-module.md), [modeller](models/README.md) og [beslutninger](../../spec/decisions/README.md) | Modulenes komponent-/driftsdeler er design; kravtabellene beskriver ansvar og mål. |
| Interne funksjoner, modellmeldinger og testtilkobling | [Testgrensesnitt](../verification/test-runtime.md) | Teknisk design for første implementasjon, ikke selvstendige produktkrav. |
| Hva som kan legges i Git | [Versjonskontroll og lokale data](../../docs/project-structure.md#versjonskontroll-og-lokale-data) | Faste leveransekrav til filplassering, hemmeligheter og kontroll før commit. |
| Kontrollsett, FoM, baseline og rettingsrunder | [Implementeringsplan](implementation-plan.md) | Arbeidsprosess og målemetode. Modulenes testtabeller utdyper scenarioene. |

Tester avledes fra dette grunnlaget. Ved motstrid mellom kontrakt, modell og test skal avviket avklares eksplisitt; verken kode eller en bestått test avgjør automatisk hva kravet skal være. Endringer føres i kilden og deretter i berørte modeller og tester. Sammendrag lenker til kilden fremfor å innføre alternative regler.

## Beslutningsstatus for første implementasjon

- **Frontendkontrakt:** 1.3 er godkjent, bekreftet av brukeren 2026-10-27. Utviklerguiden og OpenAPI 0.1.0 er felles fasit for frontend, backend og kontrakttester.
- **Sesjoner:** Fornyelsesreglene i 1.4 del 8 brukes i første implementasjon og testgrunnlaget. Frontendforløpet er beskrevet i den godkjente 1.3. Implementasjon og verifisering gjenstår.
- **Internt design:** Funksjonsnavn, modellmeldinger og oppstartsgrensesnitt i `test-runtime.md` er eksplisitte designvalg som implementasjonen og testene deler. De utvider ikke funksjonsomfanget.
- **Klargjøres ved byggestart:** Applikasjonens bibliotekversjoner, PostgreSQL-hovedversjon, SQL-tillatelseslisten innenfor 1.6 og tjenestebrukere/målerettigheter på Parrot. Modellens faktiske egnethet må måles. Domene og offentlig nettverkstilgang avklares før publisering.

Oppryddingen endrer ikke avtalte funksjoner, sikkerhetsgrenser eller benchmark-/FoM-krav. Historiske notater og korte sammendrag beholdes som lenker og forklaringer, ikke parallelle planer.
