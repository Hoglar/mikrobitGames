# Webapp–backend

Forslag til [WBS 1.3](https://github.com/Hoglar/mikrobitGames/issues/3), konkretisert i [backendplanen for WBS 4.1](../../../backend/spec/backend-module.md). Både guiden og OpenAPI-filen er fortsatt forslag. Den ansvarlige for 1.3 avklarer dem med frontend; ferdigstilling av 4.1 ferdigstiller ikke 1.3.

**Arbeidsgrunnlag for backend, 2026-10-25:** Etter brukerens beslutning brukes gjeldende guide og OpenAPI ved første backend-implementasjon og testing. Dette endrer ikke kontraktens formelle status overfor frontend. Senere avtalte endringer må følges opp i kontrakt, kode og tester.

- **Frontend starter i [utviklerguiden](contract.md):** tilgjengelige endepunkter, innlogging, resultater, AI og feilhåndtering.
- [OpenAPI-kontrakten](openapi.yaml) beskriver felter, typer, svar, autentisering og eksempler som maskinlesbar fasit. Den kan brukes til API-dokumentasjon, klienttyper og kontroller ved implementasjon.

Nettsiden og API-et planlegges på samme offentlige HTTPS-adresse, med Linux-PC-en hjemme hos prosjekteier som vert. Domene og nettverkstilgang avklares før publisering. Ingen tjenester er implementert eller eksponert gjennom denne dokumentasjonen.
