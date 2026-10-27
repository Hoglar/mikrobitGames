# Webapp–backend

**Gjeldende revisjon: 0.2.0, 2026-10-27.** Samordnet etter brukerens valg om privat lagring av alle avsluttede spillforsøk. Godkjenningen av 0.1.0 som WBS 1.3-leveranse gjaldt den tidligere versjonen; produktimplementasjon og verifisering gjenstår.

- [Utviklerguiden](contract.md): brukerforløp, innlogging, forsøk, rekorder, profil, AI og feil.
- [OpenAPI](openapi.yaml): maskinlesbar fasit for ruter, felt, typer, tilgang og svar.
- [Konflikter og beslutninger](alignment.md): avvik mellom spesifikasjonene, løsning og tilpasning av testgrunnlaget.

Kontrakten er felles implementeringsgrunnlag for frontend, backend og kontrakttester. Endringer samordnes i begge kontraktfilene og berørte modeller/tester. Nettsiden og API-et planlegges på samme offentlige HTTPS-adresse på hjemmemaskinen. Domene og ekstern tilgjengelighet avklares før publisering.
