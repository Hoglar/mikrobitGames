# Webapp–backend

**Status:** Godkjent og ferdigstilt som dokumentasjonsleveranse for [WBS 1.3 / issue #3](https://github.com/Hoglar/mikrobitGames/issues/3), bekreftet av brukeren 2026-10-27. Godkjenningen omfatter utviklerguiden og OpenAPI-kontrakten, versjon **0.1.0**.

Kontrakten er felles fasit for frontend, backend og kontrakttester. Den ble konkretisert sammen med [backendplanen for WBS 4.1](../../../backend/spec/backend-module.md). Senere avtalte endringer må følges opp i kontrakt, kode og tester. Implementasjon og faktiske målinger følger i komponentarbeidet.

- **Frontend starter i [utviklerguiden](contract.md):** tilgjengelige endepunkter, innlogging, resultater, AI og feilhåndtering.
- [OpenAPI-kontrakten](openapi.yaml) beskriver felter, typer, svar, autentisering og eksempler som maskinlesbar fasit. Den kan brukes til API-dokumentasjon, klienttyper og kontroller ved implementasjon.

Nettsiden og API-et planlegges på samme offentlige HTTPS-adresse, med Linux-PC-en hjemme hos prosjekteier som vert. Domene og nettverkstilgang avklares før publisering. Ingen tjenester er implementert eller eksponert gjennom denne dokumentasjonen.
