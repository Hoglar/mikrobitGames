# Frontendguide: Webapp ↔ Backend API

**Status:** Forslag til kontrakt 1.3, utarbeidet sammen med [WBS 4.1 / issue #13](https://github.com/Hoglar/mikrobitGames/issues/13), 2026-10-24. Den ansvarlige for 1.3 gjennomgår og avklarer dette med frontend før implementasjon. Godkjenningen av 4.1 godkjenner ikke denne kontrakten eller OpenAPI-filen. Issue 1.3 er ikke erklært ferdig.

**Start her:** Frontend bruker `/api/v1` på samme HTTPS-adresse som nettsiden. Backend tilbyr konto/innlogging, spilloversikt, topplister, rekordhistorikk, innsending av resultater og AI-spørsmål. [openapi.yaml](openapi.yaml) er den maskinlesbare fasiten for endepunkter, felt, typer og HTTP-status. Denne guiden beskriver brukerforløp og oppførsel. Endringer oppdaterer begge dokumentene sammen.

## Hva frontend kan kalle

Alle stier nedenfor har prefikset `/api/v1`. «Innlogging» betyr en gyldig sesjonscookie; frontend sender ikke spiller-ID som bevis på hvem brukeren er.

| Metode og sti | Innlogging | Inndata → vellykket svar |
| --- | --- | --- |
| `POST /auth/register` | Nei | `username`, `password` → 201 med spiller. Deretter vanlig innlogging; registrering logger ikke automatisk inn. |
| `POST /auth/login` | Nei | `username`, `password` → 200 med spiller og sesjonens utløpstider; nettleseren får cookie. |
| `GET /auth/session` | Ja | Ingen body → 200 med spiller og utløpstider. 401 betyr at ny innlogging kreves. Fornyer ikke sesjonen. |
| `POST /auth/renew` | Ja | `{}` → 200 med oppdaterte utløpstider; cookie fornyes. |
| `POST /auth/logout` | Nei¹ | `{}` → 204 uten body; aktuell sesjon og cookie fjernes. |
| `POST /account/password` | Ja | `current_password`, `new_password` → 204. Alle sesjoner avsluttes; ny innlogging kreves. |
| `POST /account/delete` | Ja | `current_password` → 204. Konto, sesjoner og rekordhistorikk slettes samlet. |
| `GET /games` | Nei | `page`, `page_size`, `include_inactive` → 200 med side av spill. Bare aktive som standard. |
| `GET /games/{game_id}` | Nei | Spill-ID → 200 med spillets regler og aktiv-status, også for inaktive spill. |
| `GET /games/{game_id}/leaderboard` | Nei | Sideparametere → 200 med spill og én gjeldende rekord per spiller med plassering. |
| `POST /games/{game_id}/results` | Ja | `value` → 201 for ny rekord, ellers 200. Backend henter spiller fra sesjonen. |
| `GET /players/{player_id}` | Nei | Spiller-ID → 200 med offentlig spillerprofil. |
| `GET /players/{player_id}/records` | Nei | Sideparametere → 200 med spillerens gjeldende rekord per spill. |
| `GET /players/{player_id}/games/{game_id}/records` | Nei | Sideparametere → 200 med rekordhistorikk i tidsrekkefølge. |
| `POST /ai/questions` | Ja | `question`, valgfri `game_id` → 200 med `request_id`, `status`, `answer`. |
| `GET /health` | Nei | 200 med `{"status":"ok"}` når API og nødvendig databasetilgang er klare, ellers 503. AI er ikke et krav for denne kontrollen. |

¹ Utlogging er gjentakbar og gir 204 også uten en gyldig sesjon. Hvis en eksisterende sesjon ikke kan fjernes på grunn av databasefeil, gis feil; backend skal ikke påstå at den er avsluttet.

## Felles felt og svar

- JSON over UTF-8. POST krever `Content-Type: application/json`, også når body bare er `{}`. Maksimal request-body er 16 KiB. Ukjente body-felt og query-parametere avvises. ID-er er UUID-strenger; tidspunkt er serverbestemte UTC-strenger som `2026-10-02T12:00:00Z`.
- `Player` har `id`, `username`, `created_at`. `Game` har `id`, `name`, `score_unit`, `ranking_direction`, `min_value`, `max_value`, `is_active`. `Record` har `id`, `player_id`, `game_id`, `value`, `created_at`. Passordhash og sesjonstoken finnes aldri i JSON-svar.
- Resultater er heltall i spillets enhet, innen spillets grenser og JavaScripts sikre heltallsområde. Backend gjør ingen automatisk konvertering av strenger eller boolske verdier til tall. Brukernavn: 3–32 ASCII-bokstaver/sifre/`_`/`-`, unikt uten hensyn til store/små bokstaver. Nye passord: 12–128 Unicode-kodepunkter, uten trimming eller normalisering.
- Sideinndeling: `page=0`, `page_size=30` som standard, høyst 100 per side. Svar inneholder `items`, `page`, `page_size`, `total` og eventuell spiller/spill-kontekst. `total` er antall rader etter filtrering, før sideinndeling. En side etter siste rad er tom; ukjent spiller eller spill gir 404.
- Topplister rangeres etter spillets retning, med delt plassering som 1, 1, 3 og spiller-ID som stabil sekundær sortering. Historikk sorteres stigende på `(created_at, id)`. Spillister og personlige rekordoversikter sorteres på `(name, game_id)`. `total`, rangering og rader kommer fra samme lesesnapshot per kall; senere kall kan se nye rekorder.
- API-svar har `Cache-Control: no-store` i første versjon. Backend lager en korrelasjons-ID i `X-Request-ID`; AI-svar og feilsvar har også samme ID i body. Frontend trenger ikke lage denne ID-en.

## Innlogging og spilling

Nettleseren håndterer cookien `__Host-mbg_session`, med `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/` og uten `Domain`. Bruk `credentials: "same-origin"` i `fetch`. Sesjonstoken skal ikke lagres i JavaScript eller `localStorage`.

Alle POST-kall krever `X-MBG-Request: 1`, også registrering og innlogging. Backend kontrollerer i tillegg at `Origin`, eller opprinnelsen i `Referer` når `Origin` mangler, er nøyaktig den konfigurerte nettsideadressen. Ugyldig, `null` eller ukjent opprinnelse avvises med 403. Frontend setter ikke disse nettleserstyrte headerne selv. Ingen generell CORS-tilgang åpnes. Dette er CSRF-beskyttelse; den konstante headerverdien er ingen hemmelighet eller autentisering. Se [OWASPs veiledning](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) og [MDNs cookie-regler](https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/Cookies).

Før spillstart kaller frontend `/auth/renew` og starter først etter suksess. Forny omtrent hvert femte minutt under aktiv spilling med brukerinput, ikke fra en inaktiv fane. Sesjonen varer inntil 72 timer etter godkjent fornyelse, men aldri utover 30 døgn etter innlogging. Svaret viser `expires_at` og `absolute_expires_at`. Backend bruker sin egen tid; GET-kall fornyer ikke sesjonen.

Ved utløp eller nettbrudd under spilling beholdes spillet/resultatet midlertidig. Lagre hvilken `player_id` resultatet tilhører, og krev ny innlogging med **samme spiller** før innsending. Et resultat skal ikke flyttes til en annen konto. Frontend sender alle avsluttede, gyldige resultater; backend avgjør om de er nye rekorder. Kun rekordene lagres. Protokollen validerer resultatet, men beviser ikke at nettleseren faktisk spilte spillet.

## Resultatinnsending

```js
const response = await fetch(`/api/v1/games/${gameId}/results`, {
  method: "POST",
  credentials: "same-origin",
  headers: { "Content-Type": "application/json", "X-MBG-Request": "1" },
  body: JSON.stringify({ value: 120 })
});
// Se response.status og håndter både JSON-feil og nettverks-/proxyfeil.
```

Svaret inneholder `outcome`, `record` og `current_record`. `created` betyr at `record` er den nye rekorden. `already_recorded` returnerer den tidligere lagrede rekorden med samme verdi, selv om spilleren nå har en bedre rekord. `not_improved` gir `record: null`. `current_record` er alltid gjeldende beste rekord etter behandlingen.

Ved tapt bekreftelse eller `OUTCOME_UNKNOWN` kan spilleren forsøke samme spiller/spill/verdi igjen. Det gir ingen duplisert rekord, men utfallet kan bli annerledes hvis en bedre rekord er registrert i mellomtiden. Ikke gjør generelle, automatiske omforsøk på kontoendringer eller AI-kall.

## AI-spørsmål

Send bare `question` og eventuelt `game_id` (UUID, `null` eller utelatt). Frontend skal trimme spørsmålet; API-et godtar 1–1 000 kodepunkter i innsendt tekst, avviser bare blanktegn og trimmer før videresending. Backend setter spiller-ID og forespørsels-ID. Spillkontekst begrenser ikke spørsmål på tvers av spill.

`status` er `ok`, `no_data` eller `cannot_answer`; alle tre er HTTP 200. Vis `answer` som ren tekst, aldri som HTML. Ett spørsmål behandles om gangen; 503 `AI_BUSY` betyr at brukeren kan prøve senere. AI-kallet har en backendfrist på 60 sekunder. Frontends ventetid må gi rom for dette og vanlig nettverkstid, eksempelvis 70 sekunder, og brukeren skal fortsatt kunne spille. Ingen samtalehistorikk eller automatiske omforsøk.

## Feil frontend må håndtere

```json
{"request_id":"99999999-9999-4999-8999-999999999999","error":{"code":"AUTH_REQUIRED","message":"Logg inn for å fortsette."}}
```

Frontend styrer oppførsel etter `error.code`, ikke den norske teksten. Detaljer og mulige koder per operasjon finnes i OpenAPI-filen.

| HTTP / kode | Frontendoppførsel |
| --- | --- |
| 400 `INVALID_REQUEST` / `INVALID_RESULT` | Vis valideringsfeil; ikke gjenta uendret input. |
| 401 `AUTH_REQUIRED` / `INVALID_CREDENTIALS` | Be om innlogging / vis samme feil for ukjent bruker og feil passord. Bevar eventuelt spillresultat. |
| 403 `FORBIDDEN` / `CURRENT_PASSWORD_INCORRECT` | Forespørselen mangler tillatelse eller har feil passordbekreftelse. |
| 404 `NOT_FOUND` | Spill eller spiller finnes ikke. |
| 409 `USERNAME_TAKEN` / `GAME_INACTIVE` | Velg annet brukernavn / ikke start eller send nye resultater til spillet. |
| 413 `REQUEST_TOO_LARGE`, 415 `UNSUPPORTED_MEDIA_TYPE` | Rett størrelse eller innholdsformat. |
| 429 `RATE_LIMITED` | Respekter `Retry-After` (hele sekunder). Ingen permanent kontolåsing. |
| 500 `INTERNAL_ERROR`, 503 `SERVICE_UNAVAILABLE` | Vis midlertidig feil; ikke påstå at resultatet er lagret. |
| 503 `OUTCOME_UNKNOWN` | Lagring kan ha skjedd. Følg avklaringsregelen over; kontoendringer avklares gjennom innlogging/oppslag. |
| 503 `AI_BUSY` / `AI_UNAVAILABLE`, 504 `AI_TIMEOUT`, 502 `INVALID_AI_RESPONSE` | Vis AI-feil uten å stoppe vanlig spilling eller rekordlagring. |

Hvis PC-en, hjemmenettet eller API-et er nede, kan nettleseren få nettverksfeil eller et proxy-svar uten JSON. Frontend må håndtere dette også. Den felles feilkonvolutten gjelder svar produsert av API-et, ikke alle mulige internettfeil.

## Publisering og videre gjennomgang

Nettsiden og API-et skal nås fra internett på samme HTTPS-adresse, med hjemmemaskinen som vert. Domene, DNS og faktisk ekstern tilgjengelighet er ennå ikke avklart. Ved lokal utvikling brukes en proxy fra frontendserveren til `/api`, slik at nettleseren fortsatt ser én adresse. Test cookieinnlogging med lokal HTTPS også; sikkerhetsflaggene skal ikke fjernes fra produksjonsoppsettet for å få utviklingsmiljøet til å virke. GitHub Pages med en separat API-adresse krever en ny vurdering av cookies/CORS og er ikke grunnlaget her.

Det finnes ikke offentlige endepunkter for spilladministrasjon, vilkårlig SQL eller redigering av historiske rekorder. Backendplanen og driftskravene står i [WBS 4.1](../../../backend/spec/backend-module.md). Funksjonen følger [databasekontrakten 1.4](../../../backend/spec/contracts/backend-database/contract.md) og [AI-kontrakten 1.5](../../../backend/spec/contracts/backend-ai/contract.md).
