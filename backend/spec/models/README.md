# Modeller

Designmodeller som styrer utviklingen av denne delen. Datamodellen og komponentmodeller for API og AI samles her. Uttrekk fra implementasjonen som brukes som bevis ved verifisering lagres under modulens results.

- [Datamodell for backend–database, WBS 1.4](data-model.md): avklarte felt, relasjoner og regler for spillerkontoer, sesjoner, spill og rekordhistorikk.
- [ER-diagram for databasen](database-er.drawio): redigerbar oversikt over tabeller, datatyper, nøkler, kardinalitet og slettingsregler. Bygger på datamodellen og brukes videre i WBS 5.1.
- [Maskinlesbar modellfasit](database-schema.json): felter, nøkler og AI-visninger for den avgrensede, automatiserte modellkontrollen beskrevet i [testplanen](../test-plan.md).
- [AI-komponentdiagram](ai-components.drawio) og [maskinlesbar komponentmodell](ai-components.json): ansvar og avhengigheter i den ferdigstilte spesifikasjonen for [AI-modulen, WBS 6.1](../ai-module.md).
