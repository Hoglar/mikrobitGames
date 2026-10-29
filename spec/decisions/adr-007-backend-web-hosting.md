# ADR-007: Backend API og nettside på hjemmemaskinen

**Driftsvalg 2026-10-29:** Brukeren har valgt reserveplanen Tailscale Funnel etter at hjemmeruterens WAN-adresse viste en privat adresse bak enda en ruter. Dette er påvist dobbel NAT, ikke dokumentert CGNAT hos leverandøren. Funnel terminerer offentlig HTTPS og sender til lokal Caddy på 127.0.0.1:8080. Nettside og API bruker **https://parrot.tail106c62.ts.net**; opennote.no endres ikke. [Driftsoppsettet](../../backend/ops/runtime/README.md) er installert med egne systemd-tjenester og vedvarende data. Funnel er aktivert, og brukeren har bekreftet helseendepunktet fra mobilnett. [Driftskontrollen](../../backend/results/runtime-2026-10-29.md) beskriver dokumentasjonen. Fysisk reboot og samlet frontend-/Micro:bit-flyt gjenstår.

**Opprinnelig status 2026-10-24–27:** Godkjent av brukeren som del av WBS 4.1. Hjemmemaskinen ble valgt som vert for både nettside og backend, med tunnel som reserveplan uten valgt leverandør. Frontendkontrakten 1.3 ble godkjent som arbeidsgrunnlag for backend, fortsatt et forslag overfor frontendgruppen. Publisering var da ikke utført; gjeldende driftsvalg står over.

## Kontekst

Backend kjører på brukerens Parrot Linux-PC og skal være tilgjengelig fra internett. Maskinen kan skrus av og på; normal oppstart skal ikke kreve manuell kjøring av utviklingskommandoer. Frontend trenger et tydelig, versjonert grensesnitt. Databasen og AI-modulen har egne kontrakter.

## Beslutning

- **Python og FastAPI** for API-et. Dette gir samme språk som AI-tjenesten og støtte for OpenAPI/JSON Schema og interaktiv API-dokumentasjon. Den avtalte OpenAPI-filen er fasit; dokumentasjon generert fra koden brukes som modelluttrekk. Se [FastAPI-funksjonene](https://fastapi.tiangolo.com/features/).
- **Caddy** serverer frontendens statiske bygg og videresender `/api/*` til en lokal API-prosess. Ett offentlig vertsnavn gir én opprinnelse for nettleserens cookies. Caddy håndterer HTTPS og sertifikatfornyelse når DNS og nettverk er korrekt satt opp. Se [automatisk HTTPS](https://caddyserver.com/docs/automatic-https).
- **systemd** styrer oppstart, prosessrestart og logger. Tjenestene kjører med separate, begrensede brukere; data og konfigurasjon ligger vedvarende. Se [Caddys Linux-drift](https://caddyserver.com/docs/running).

Dette erstatter ikke sikkerhetskontroller i applikasjonen. Cookie, CSRF og tilgang bestemmes i [frontendkontrakten](../contracts/webapp-backend/contract.md). DB-driver, HTTP-klient og konkrete versjoner velges i den felles implementeringsplanen. Ingen ORM kreves.

## Alternativer og konsekvenser

GitHub Pages med et separat backend-domene er mulig, men vil kreve et annet oppsett for CORS/cookies og løser ikke tilgjengeligheten til API-et hjemme. Vi planlegger derfor én adresse på hjemmemaskinen. Hvis frontend trenger serverbasert rendering fremfor statiske filer, må webdriften justeres; det endrer ikke API-kontrakten.

Node/TypeScript er også aktuelt for backend. Python/FastAPI velges for å gjenbruke språkkompetanse fra AI-modulen og gjøre kontraktuttrekk enkelt. Docker er ikke nødvendig for den første driftsplanen; systemd passer den ene Linux-maskinen, men krever dokumenterte avhengigheter og oppdateringer.

Ekstern tilgang må verifiseres: vertsnavn/DNS, eventuell dynamisk IP, ruter/brannmur og CGNAT. **Plan A** er direkte HTTPS-tilgang. **Plan B** er en offentlig tunnel dersom direkte tilgang ikke fungerer eller blir upraktisk, med Tailscale Funnel som første kandidat og Cloudflare Tunnel som alternativ ved eget domene. HTTPS beholdes; tunnel betyr ikke at spillere må koble seg til en privat VPN. Valg, automatisk oppstart og kontroll ved bruk av reserveplanen er beskrevet i [backendplanen](../../backend/spec/backend-module.md#hosting-oppstart-og-gjenoppretting). Nedetid når PC, strøm eller nett er av, kan ikke løses av tunnelen eller automatisk prosessrestart.
