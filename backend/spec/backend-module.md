# Backend API – krav, modell og testplan for WBS 4.1

**Status:** Ferdigstilt og godkjent av brukeren for [WBS 4.1 / issue #13](https://github.com/Hoglar/mikrobitGames/issues/13), 2026-10-24. Oppdatert arbeidsgrunnlag 2026-10-25: gjeldende 1.3 brukes for backend-implementasjonen etter brukerens beslutning; formell godkjenning eies fortsatt av den ansvarlige for 1.3. Ingen tjenester er implementert, startet eller publisert.

**Dokumentrolle:** Kravtabellen beskriver hva API-et skal oppfylle. Komponent-, teknologi- og driftsdelene beskriver valgt design; testtabellen beskriver hvordan det kontrolleres. Byggerekkefølge og iterasjoner ligger i [implementeringsplanen](implementation-plan.md). Se [leseoversikten](README.md) for autoritative kilder.

## Ansvar og grensesnitt

Backend binder nettsiden, PostgreSQL og lokal AI sammen. Den håndhever innlogging, kontoendringer og rekordregler, tilbyr offentlige spilldata og formidler AI-spørsmål. Frontendens inngang er [utviklerguiden](../../spec/contracts/webapp-backend/contract.md) med [OpenAPI-kontrakten](../../spec/contracts/webapp-backend/openapi.yaml). Begge brukes som arbeidsgrunnlag for første backend-implementasjon og kontrakttestene. Den ansvarlige for 1.3 avklarer dem med frontend; eventuelle avtalte endringer samordnes i kontrakt, implementasjon og tester. Godkjenningen av 4.1 ferdigstiller ikke 1.3.

[1.4](contracts/backend-database/contract.md) fastsetter databaseoperasjoner og transaksjoner. [1.5](contracts/backend-ai/contract.md) fastsetter kommunikasjon med AI. [Databasespesifikasjonen](requirements.md) og [AI-modulplanen](ai-module.md) er allerede ferdigstilt. Denne planen konkretiserer HTTP-grensesnittet uten å endre de interne kontraktene.

## Krav og prioritering

| ID | Prioritet | Krav og målbar kontroll |
| --- | --- | --- |
| BE-001 | 1 | Implementere endepunkter, felt, feil og tilgang etter den avtalte OpenAPI-kontrakten. Alle kontrakttester skal bestå; ingen hemmeligheter i offentlige svar eller logger. |
| BE-002 | 1 | Registrering, innlogging, eksplisitt sesjonsfornyelse, utlogging, passordendring og kontosletting følger 1.4. Utløpte/slettede sesjoner gir ingen beskyttet operasjon; innsendt spiller-ID kan ikke overstyre sesjonen. |
| BE-003 | 1 | Lagre bare første/strengt bedre personlige rekord og bevare tidligere rekorder. Lås, kontroller sesjon/spill og commit etter 1.4. Samtidighet og gjentatte kall skal ikke lage duplikater eller delvis lagring. |
| BE-004 | 1 | Offentlige spill, topplister og historikk gir korrekt enhet, rangeringsretning, delt plassering og sideinndeling. Inaktive spill kan leses, men tar ikke nye resultater. |
| BE-005 | 2 | Formidle AI etter 1.5 med serverbestemt identitet og kontrollert svar. Ingen DB-lås/-forbindelse holdes mens AI arbeider. AI-feil skal ikke stanse konto- eller rekordfunksjoner. |
| BE-006 | 3 | Under normalprofilen for 30 spillere i 1.4: p95 ≤ 500 ms per HTTP-operasjon for toppliste, sesjonsoppslag og resultatregistrering, målt lokalt gjennom HTTPS-inngangen. DB-006s egne grenser gjelder separat. Innlogging/passordhashing og AI måles separat. |
| BE-007 | 2 | Nettsiden/API-et skal være tilgjengelig fra internett over HTTPS når hjemmemaskinen og forbindelsen er oppe. Etter normal omstart skal nettside, innlogging og rekordlagring virke uten interaktiv oppstart innen 5 minutter etter at operativsystem og nettverk er klare. Bekreftede data bevares. Dette er et testmål, ikke et løfte om kontinuerlig oppetid. |
| BE-008 | 1 | Internettilgangen skal ha cookie-/CSRF-kontroll, begrensede forespørsler og beskyttelse mot gjentatte passordforsøk. Bare webinngangen eksponeres; API, PostgreSQL, AI og modellkjøring lytter lokalt. Alle negative tilgangstester skal bestå. |

Sikkerhet og integritet prioriteres foran ytelse. BE-006 og femminuttersmålet er akseptansegrenser for senere testing, ikke målte egenskaper. Ingen tilgjengelighetsprosent settes for en PC som også kan skrus av. Ved strøm-/nettbrudd er tjenesten utilgjengelig; foreslått frontendoppførsel beskrives i 1.3.

## Komponentmodell

[Diagrammet](models/backend-components.drawio) har én side for komponentene og én for publisering fra hjemmemaskinen. [backend-components.json](models/backend-components.json) er strukturert input til implementasjon og senere kontroll av avhengigheter.

| Komponent | Ansvar og avhengigheter |
| --- | --- |
| `http_api` | HTTP-ruter, validering, cookie/CSRF, feilformat, forespørsels-ID og begrensning av trafikk. Kaller tjenestene; kun helsesjekken bruker databaseadapteren direkte. |
| `auth_service` | Passordhashing, innloggingskontroll, sesjoner og bekreftede kontoendringer. Bruker `database`. |
| `score_service` | Spill-/spilleroppslag, topplister, historikk og atomisk resultatregistrering. Bruker `score_rules` og `database`. |
| `score_rules` | Ren logikk for gyldige resultater, forbedring og rangering. Ingen nettverk, database eller modellkall. |
| `database` | Eneste PostgreSQL-adapter for API-et. Parameterbinding, samlet poolbudsjett, låsing, transaksjoner og feilklassifisering etter 1.4. |
| `ai_gateway` | Eneste HTTP-klient til AI-tjenesten. Setter interne meldinger, håndhever 60 s frist og kontrollerer svarformat/ID. Ingen direkte modell- eller SQL-kjøring. |

Beskyttede ruter henter identiteten gjennom `auth_service`. Skriving kontrollerer sesjonen på nytt inne i den låste transaksjonen etter 1.4; kontrollen ved HTTP-inngangen alene er ikke tilstrekkelig. Offentlige lesinger bruker én SQL-setning for rangering, antall og rader, slik at de får samme snapshot også med `READ COMMITTED`. AI-kall sendes først etter sesjonskontroll, og autentiseringshemmeligheter sendes aldri videre.

Valg i [ADR-007](../../spec/decisions/adr-007-backend-web-hosting.md): Python med FastAPI, PostgreSQL-driver med eksplisitte transaksjoner og en egen HTTP-klient for AI. Bruk samme språk som AI-tjenesten for å begrense antall teknologier. FastAPIs standardvalideringsfeil må tilpasses endelig avtalt feilformat i 1.3; automatisk generert dokumentasjon er et uttrekk av implementasjonen, ikke fasiten. Bibliotekversjoner fastsettes før kodegenerering.

[Interne grensesnitt og oppstart](../verification/test-runtime.md) konkretiserer funksjonene som enhetstestene kaller, tokenrepresentasjon, miljøvariabler og måleinstrumentering. Dette er del av første implementasjons tekniske design; produktoppførselen bestemmes fortsatt av kontraktene.

## Innlogging og internettsikkerhet

Følg frontendguidens cookie-, CSRF- og sesjonsregler. Aktiver streng typevalidering og avvis ekstra inputfelt. Passord lagres som Argon2id og tilfeldige token som hash etter 1.4. Ukjent brukernavn og feil passord gir samme svar; kontroller også passordverifikasjonens tidsforskjeller. Utlogging av én sesjon skal ikke logge ut andre sesjoner; passordendring/kontosletting skal gjøre det.

Startgrenser til gjennomgang: maksimalt 16 KiB request-body; samlet høyst 60 kall/minutt per klient-IP til registrering, innlogging og passordbekreftende kontooperasjoner. Etter ti mislykkede passordkontroller for samme normaliserte brukernavn og IP innen fem minutter avvises videre slike forsøk til vinduet åpner. Ikke opprett permanent kontolåsing. Returner 429 med `Retry-After`; gjennomgå også at mange elever bak samme IP kan logge inn. Tellere, opprydding og maksimal minnebruk avgrenses og testes. Stol bare på klient-IP-header fra den konfigurerte lokale proxyen.

API-tjenesten kjører som egen Linux-bruker uten sudo, med bare `backend_app`-tilgang. Modell-/AI-brukere får ikke lese dens hemmeligheter. SQL, passord, cookies og rå AI-spørsmål/svar skal ikke havne i tilgangslogger eller feilrapporter. Proxy, API og avhengigheter skal ha dokumentert oppdateringsrutine før publisering. Utviklingsmodus skal ikke være internettjenesten.

## Hosting, oppstart og gjenoppretting

**Avklart premiss:** Hjemmemaskinen er en Parrot Linux-PC med 16 GB RAM, eldre Intel-prosessor og GTX 980. Den skal servere både nettsiden og backend og være tilgjengelig fra internett. Nøyaktig maskinvare og ledig diskplass kontrolleres ved oppsett.

**Plan A – direkte tilgang:** Caddy håndterer HTTPS, serverer webappens bygde filer og videresender `/api/*` til API-et på `127.0.0.1:8000` uten å fjerne prefikset. Backend monterer rutene under `/api/v1` etter forslaget til 1.3. Andre adresser tilhører frontend; ukjente API-ruter skal ikke returnere frontendens HTML. PostgreSQL (`5432`), AI-tjenesten (foreslått `8001`) og Ollama (`11434`) er lokale. Bare port 443 og port 80 for HTTPS-omdirigering/sertifikatoppsett åpnes for webtrafikk. Caddys administrasjonsgrensesnitt eksponeres ikke.

Bruk systemd-tjenester for webinngang, API, PostgreSQL, AI-tjeneste og modellkjører. Aktiver oppstart ved boot og kontrollert restart etter prosessfeil med forsinkelse og grense mot endeløse restart-løkker. PostgreSQL må være klar før API-et erklæres klart; tap av databasen skal gi 503 og kunne gjenopprettes uten ny deploy. AI er en valgfri avhengighet for vanlig spillfunksjon, og skal ikke hindre oppstart av API eller nettside. Avslutt vedlikehold kontrollert, med opprydding av pågående forespørsler.

Konfigurasjon, database, modellfiler og sertifikatdata skal overleve omstart. En normal boot skal verken laste ned modellen på nytt eller opprette/reset­te databasen. Migreringer er et eksplisitt deploy-steg. Status, logger og restart for hver tjeneste skal dokumenteres med konkrete kommandoer i driftsveiledningen ved implementasjon. Sikkerhetskopi og gjenoppretting følger DB-008; omstart er ikke det samme som gjenoppretting fra backup.

**Må avklares før publisering:** domene eller stabilt vertsnavn, DNS/dynamisk IP, offentlig IP eller CGNAT, ruter-/brannmurtilgang og eventuell IPv6. Test fra et annet nett, eksempelvis mobilnett. Dersom direkte tilgang ikke er mulig, velges en dokumentert tunnelløsning eller annet oppsett før publisering. HTTPS alene gir ikke ruting gjennom CGNAT. Ingen ruter-, brannmur- eller DNS-endringer inngår i 4.1.

**Plan B – offentlig tunnel:** Hvis direkte tilgang blokkeres av hjemmenettet eller blir upraktisk, vurderes først [Tailscale Funnel](https://tailscale.com/docs/features/tailscale-funnel); [Cloudflare Tunnel](https://developers.cloudflare.com/tunnel/get-started/) er et alternativ ved eget domene. Begge kan gjøre webtjenesten offentlig tilgjengelig uten vanlig portvideresending. Dette erstatter veien inn til serveren, ikke HTTPS-kravet. Nettside og API beholder samme offentlige adresse, mens database og AI forblir interne. En privat VPN alene gir ikke offentlig tilgang for vanlige besøkende. Leverandør velges først dersom reserveplanen tas i bruk; TLS, proxyheadere og offentlig origin-konfigurasjon tilpasses og testes da. Tunnelen skal starte automatisk etter omstart og inngå i TBE-09. Avslått PC eller bortfall av internett gir fortsatt nedetid.

## Planlagte tester og verifisering

Gjenbruk Ada/Nora og spillene fra [databasens testplan](test-plan.md), med styrt klokke for sesjoner. Utvid med tredje spiller for delt plassering. Forventninger bestemmes fra kontrakten før implementasjonen genereres.

| ID | Krav | Test og forventet resultat |
| --- | --- | --- |
| TBE-01 | BE-001 | Enhet/HTTP: gyldige/ugyldige felt, typer, lengder, ekstra felt, sideparametere, body-grense og feilformat. Alle svar matcher avtalt kontrakt; ingen standard 422 eller feilsider fra rammeverket. |
| TBE-02 | BE-002, BE-008 | Enhet og DB-integrasjon: registrering, navn med ulik bokstavstørrelse, innlogging, 72 t/30 døgn, fornyelse ved grensen, utlogging, passordendring og kontosletting. Ingen utløpt sesjon gjenopplives; riktige rader/sesjoner slettes atomisk. |
| TBE-03 | BE-003 | Enhet for begge rangeringsretninger. Integrasjon: 100, 80, 120, 110 lagrer bare 100 og 120; gjentatt 100 gir `already_recorded` med gammel rekord og gjeldende 120. Tidsspillet følger motsatt retning. |
| TBE-04 | BE-004 | Offentlig lesing uten cookie: Ada 120/Nora 115; tredje spiller 120 gir plassering 1,1,3 før sideinndeling. Historikk bevares, inaktive spill leses, ukjente ID-er gir 404 og kjent tom historikk gir tom liste. |
| TBE-05 | BE-002–003 | Integrasjon: samtidige rekorder, kontosletting/passordendring mot fornyelse/innsending, DB-brudd rundt commit. Riktig seriell tilstand, ingen falsk lagringsbekreftelse. Ukjent commit gir `OUTCOME_UNKNOWN`; gjentatt rekord gir ingen duplikat. |
| TBE-06 | BE-005 | Kontrollert AI-tjeneste returnerer alle utfall fra 1.5, feil ID/format og sent svar. Backend lager riktig ekstern feil og holder ikke DB-ressurser under AI-venting. Spill/lagring virker mens AI er opptatt/nede. Gjenta sentrale kall med virkelig AI senere. |
| TBE-07 | BE-001, BE-008 | Nettleser/proxy: cookie-flagg, fremmed/manglende/null Origin uten gyldig Referer, manglende custom header, forfalsket spiller-ID og proxyheader. Avvis uautorisert skriving. Test rategrenser og ingen lekkasje i svar/logger. |
| TBE-08 | BE-006 | Benchmark etter 1.4s normalprofil, med og uten aktiv AI. Mål HTTP p95 separat fra DB-tid; registrer feil, hash-ytelse, CPU, PSS og forbindelser. Backend- og DB-mål må begge vurderes. |
| TBE-09 | BE-007–008 | Driftstest på testoppsett, deretter hjemmemaskinen: normal reboot, prosessfeil, DB utilgjengelig/tilbake og AI nede. Ingen manuell terminaloppstart; nettside, innlogging og rekordlagring virker innen målet. Bekreftede rekorder bevares. Test ekstern HTTPS og at interne porter ikke er offentlig tilgjengelige. |

Trekk ut faktisk OpenAPI fra den kjørende implementasjonen og sammenlign deterministisk med den avtalte filen: ruter, metoder, obligatoriske felt, datatyper, grenser, svar og autentisering. Sammenlign effektiv URL etter at `servers.url` og rutesti er kombinert. Normaliser dokumentasjons-/rekkefølgeforskjeller, men behold semantiske avvik. Kjør også faktiske kall; OpenAPI alene beviser ikke cookie-, eierskaps- eller transaksjonsoppførsel. Kildekodeuttrekk av importavhengigheter sammenlignes med komponentmodellen; ukjente/dynamiske avhengigheter flagges til gjennomgang.

Testing er en del av verifiseringen. Skript og tester skal kunne kjøres av gruppen uten AI som dommer. Resultater lagres med commit, kontroll-/kontraktversjon, miljø, kommando og PASS/FAIL/SKIPPED/BLOCKED. [Implementeringsplanen](implementation-plan.md) fastsetter de to felles FoM-ene, baseline og brukerbestilte runder. Se [kjøreoversikten](../verification/README.md). Ytelse og driftskrav kontrolleres selv om de ikke alle inngår i FoM.
