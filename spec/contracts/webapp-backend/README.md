# Webapp–backend

**Gjeldende revisjon: 0.3.0, 2026-10-28.** Samtaleassistent med avgrenset hukommelse og «ny samtale». Arbeidsgrunnlag for backend etter brukerbestilling, fortsatt et forslag til frontendgruppen.

- [Kom i gang for frontendgruppen](quickstart.md): adresse, kopierbar JavaScript-klient, innlogging, resultater, AI og feilsøking.
- [Utviklerguiden](contract.md): brukerforløp, innlogging, forsøk, rekorder, profil, AI og feil.
- [OpenAPI](openapi.yaml): maskinlesbar fasit for ruter, felt, typer, tilgang og svar.
- [Konflikter og beslutninger](alignment.md): avvik mellom spesifikasjonene, løsning og tilpasning av testgrunnlaget.

Kontrakten er felles implementeringsgrunnlag for frontend, backend og kontrakttester. Endringer samordnes i begge kontraktfilene og berørte modeller/tester. Nettsiden og API-et bruker samme offentlige HTTPS-adresse på hjemmemaskinen. Tailscale Funnel er aktivert 2026-10-29 på **https://parrot.tail106c62.ts.net**; tilgang fra mobilnett er bekreftet av brukeren. Hurtigguiden beskriver integrasjonen og hva som gjenstår før den ferdige frontendpakken publiseres.
