# Backend for frontendgruppen – kom i gang

**API 0.3.0, 2026-10-29.** Backend har bestått full testfase på commit `3bd5d07`. Grensesnittet brukes av backend og er fortsatt et forslag til frontendgruppen. Dette er en praktisk lesehjelp; [OpenAPI](openapi.yaml) eier felter og ruter, og [kontrakten](contract.md) eier brukerforløp.

## Adresse og tilkobling

**Offentlig adresse: https://parrot.tail106c62.ts.net**  
**API-base: https://parrot.tail106c62.ts.net/api/v1**

Tailscale Funnel er aktivert 2026-10-29. HTTPS og API er kontrollert fra Parrot; brukeren har også bekreftet `{"status":"ok"}` fra helseendepunktet på mobilnett. Besøkende trenger vanlig nettleser, ikke Tailscale-konto eller VPN. Parrot må være på og ha internett. Se [driftskontrollen](../../../backend/results/runtime-2026-10-29.md) for kontrollert flyt og begrensninger.

**Frontend er publisert 2026-10-29**, fra commit `fdfdbca`, på samme adresse som API-et. Brukeren har bekreftet at gruppen kommer inn fra skolen. Se [skoleveiledningen](../../../docs/play-at-school.md) og [publiseringskontrollen](../../../results/verification/frontend-publication-2026-10-29.md). Frontend bygges med `npm run build` fra `webapp/` og publiseres med [publiseringsskriptet](../../../backend/ops/runtime/README.md#4-publiser-frontendpakken).

Nettsiden og API-et skal ha **samme HTTPS-adresse**. Bruk `/api/v1` som base i frontend, eksempelvis `fetch('/api/v1/games')`. Åpne `/api/v1/health` i nettleseren for å kontrollere forbindelsen; forvent `{"status":"ok"}`. AI kan være nede selv om denne kontrollen er grønn.

Ikke kall serverens URL direkte fra en annen nettside eller fra `http://localhost:…` og forvent at innlogging virker. API-et åpner ikke CORS, og POST kontrollerer sidens origin. Første felles integrasjon skjer ved at frontendens statiske bygg serveres gjennom samme webinngang som API-et. En lokal utviklingsproxy trenger et separat, avtalt HTTPS-/origin-oppsett; å omskrive Origin i en proxy er ikke en generell tillatelse til å omgå CSRF.

## Første fungerende flyt

1. Åpne nettsiden på den avtalte HTTPS-adressen.
2. Hent `/games`. Bruk ID og regler fra svaret; ikke hardkod testenes Ada/Nora- eller spill-ID-er.
3. Registrer en konto, og logg inn. Registrering logger ikke inn automatisk.
4. Hent `/auth/session` for spiller-ID og utløpstider.
5. Kall `/auth/renew` før spillstart. Lag én `attempt_id` med `crypto.randomUUID()` ved start.
6. Send sluttresultatet med samme ID, og vis lagringsbekreftelse først når backend har svart.
7. Prøv AI via `/ai/questions`. Vanlig spilling skal fortsette mens AI arbeider.

Driftsdatabasen er adskilt fra testdatabasen. Den har ikke testkontoene Ada/Nora eller benchmarkens rekorder. Ti aktive spillvarianter er registrert etter [frontendens register](../../../webapp/src/games/registry.js): seks Snake-varianter, Viking Dash, Stjernefangst, Reaksjonsjakt og Balanseløypa. **Poengjakt (demo)** og **Sprint (demo)** er beholdt som eldre katalogoppføringer, uten spillmoduler i den nye frontenden. Hent ID og regler fra `/games`; nye eller endrede spillregler må samordnes før publisering. Det finnes ingen offentlig administrasjonsrute for spill.

## Kopierbar JavaScript-klient

[api-client.mjs](examples/api-client.mjs) er et lite eksempel som kan kopieres inn i frontendkoden. Det håndterer JSON, tomme 204-svar, cookie, CSRF-header, tidsgrense og feil uten automatiske omforsøk. Det er ingen ny kjøretidsavhengighet eller krav om å bruke akkurat denne filen.

```js
import { api, ApiError } from './api-client.mjs'; // Tilpass importstien i bygget.

// Offentlig spillkatalog (høyst 100 per side).
const { data: catalog } = await api('/games?page=0&page_size=30');
const game = catalog.items.find(g => g.is_active); // Vis et valg hvis flere spill.

// Verdiene kommer fra skjemaet; ikke lagre passord i kildekoden.
await api('/auth/register', { method: 'POST', body: { username, password } });
const { data: session } = await api('/auth/login', {
  method: 'POST', body: { username, password }
});
console.log(session.player.id, session.expires_at);

const { data: currentSession } = await api('/auth/session');
await api('/auth/renew', { method: 'POST' });
```

Nettleseren håndterer innloggingscookien. **Ingen Bearer-token, API-nøkkel eller sesjonstoken i localStorage.** JavaScript skal ikke lese eller sette cookien. POST sender `Content-Type: application/json` og `X-MBG-Request: 1`; tom body er `{}`. Nettleseren setter selv Origin/Referer.

Brukernavn er 3–32 ASCII-bokstaver, sifre, `_` eller `-`. Store/små bokstaver skiller ikke kontoer. Passord er 12–128 tegn. Ikke trim passordet. Innlogging gir `player`, `expires_at` og `absolute_expires_at`, ikke et token i JSON.

## Resultater og toppliste

```js
// Ved spillstart: behold eier og ID gjennom hele forsøket og alle omforsøk.
const pending = {
  playerId: currentSession.player.id,
  gameId: game.id,
  attemptId: crypto.randomUUID()
};

// Ved avslutning: value er heltall i game.score_unit og følger spillets grenser.
const submitted = { attempt_id: pending.attemptId, status: 'completed', value: score };
const { status, data: saved } = await api(`/games/${pending.gameId}/results`, {
  method: 'POST', body: submitted
});
// status 201 = nytt forsøk. 200 = identisk forsøk var allerede lagret.
console.log(saved.outcome, saved.current_record);

const { data: board } = await api(`/games/${game.id}/leaderboard?page=0&page_size=30`);
// board.items: [{ rank, player: { id, username, created_at }, record: { ... } }]
const { data: ownAttempts } = await api('/account/results?page=0&page_size=30');
```

`completed` krever en gyldig heltallsverdi. Ved avbrudd send `incomplete` med delverdi eller eksplisitt `null`; et ufullført forsøk gir aldri rekord. Backend bestemmer rekordutfallet:

| `outcome` | Betydning |
| --- | --- |
| `created` | Første eller forbedret personlig rekord. |
| `already_recorded` | Samme verdi som en tidligere rekord. Forsøket er lagret. |
| `not_improved` | Fullført forsøk uten forbedring. |
| `not_eligible` | Ufullført forsøk, uten rekordmulighet. |

Ved nettbrudd/ukjent lagringsutfall behold nøyaktig samme ID og body. Sjekk at samme spiller er innlogget før brukeren prøver igjen. Ikke lag en ny ID for samme forsøk. `current_record` kan ha endret seg mellom kall. Private forsøk vises bare til eieren; offentlig toppliste og rekordhistorikk kan leses uten innlogging. Vis enheten fra spillet, og følg `higher_is_better` / `lower_is_better`.

## AI-samtale

```js
const { data: reply } = await api('/ai/questions', {
  method: 'POST', body: { question: 'Hvordan har jeg forbedret meg?', game_id: game.id }
});
answerElement.textContent = reply.answer; // Aldri innerHTML for AI-tekst.
for (const notice of reply.notices ?? []) console.log(notice);

// «Ny samtale»: tøm lokal visning først etter vellykket 204.
await api('/ai/conversation/reset', { method: 'POST' });
```

Send bare `question` (1–1000 tegn, trimmet) og eventuell `game_id`. Ingen spiller-ID, samtale-ID, historikk, SQL eller verktøynavn fra frontend. Backend bestemmer identiteten. `status` er `ok`, `no_data` eller `cannot_answer`; alle tre bruker HTTP 200. Vis forklaringen også når svaret ikke er `ok`.

Opptil 20 utvekslinger huskes per innlogging, bare i RAM. Plassmangel kan gi tidligere glemming med `notices`. Ny innlogging, 30 minutters inaktivitet, kapasitet eller omstart kan gi tom samtale. Faner med samme cookie deler minne. Ett AI-spørsmål behandles totalt om gangen; ved `AI_BUSY` ber frontend brukeren prøve senere. Ingen automatisk retry. Bruk rundt 70 sekunders klientfrist; serverens grense er 60 sekunder. Målte AI-kall i siste test tok omtrent 11–16 sekunder varme og 51 sekunder kalde, ikke en garanti for fremtidig svartid.

Ved [driftskontrollen 29. oktober](../../../backend/results/runtime-2026-10-29.md) svarte AI-en på en hilsen og hentet riktig rekord i en ny samtale, mens ett rekordspørsmål etter hilsenen ikke bestod svarkontrollen. AI-tekst kan variere; bruk de vanlige API-rutene som fasit for poeng og topplister, og vis alle dokumenterte AI-utfall tydelig.

## Feil som frontend må håndtere

```js
try {
  await api('/ai/questions', { method: 'POST', body: { question } });
} catch (error) {
  if (!(error instanceof ApiError)) throw error;
  errorElement.textContent = error.message;
  // Styr brukerflyt etter error.code. requestId kan brukes ved feilmelding til backendgruppen.
}
```

| Kode / situasjon | Handling |
| --- | --- |
| `AUTH_REQUIRED` (401) | Be om ny innlogging; behold et ventende forsøk med opprinnelig eier. |
| `INVALID_CREDENTIALS` (401) | Vis feil brukernavn/passord uten å avsløre om kontoen finnes. |
| `FORBIDDEN` (403) | Sjekk samme HTTPS-origin og `X-MBG-Request: 1`. Ikke slå av CSRF. |
| `USERNAME_TAKEN` (409) | Be om annet brukernavn. |
| `INVALID_REQUEST` / `INVALID_RESULT` (400) | Rett felter, typer, lengder eller poenggrenser. |
| `ATTEMPT_CONFLICT` / `GAME_INACTIVE` (409) | Behold forsøket for avklaring; ikke generer ny ID automatisk. |
| `RATE_LIMITED` (429) | Vent minst `Retry-After` sekunder. |
| `OUTCOME_UNKNOWN`, nettbrudd eller klienttimeout ved lagring | Lagring kan ha skjedd; samme spiller, forsøks-ID og body ved nytt forsøk. |
| `AI_BUSY`, `AI_UNAVAILABLE`, `AI_TIMEOUT`, `INVALID_AI_RESPONSE` | Vis AI-feilen og la vanlig spilling fortsette. |
| Proxyfeil/ikke-JSON | Vis tilgjengelighetsfeil, ikke antatt vellykket lagring. |

[Full rutetabell](contract.md#hva-frontend-kan-kalle) dekker også utlogging, passordendring, kontosletting og offentlig historikk. Ikke legg til egne felter i forespørslene; ukjente felter avvises.

## Før gruppen kaller integrasjonen ferdig

Fra en annen PC/et annet nett: sjekk HTTPS uten sertifikatadvarsel, spillkatalog, registrering/innlogging, sesjonsfornyelse, ett lagret resultat, offentlig toppliste, privat historikk, AI-spørsmål/oppfølging, «ny samtale» og utlogging. Bekreft at feil vises tydelig, og at en annen konto ikke kan lese private forsøk. En full Micro:bit-/spilldemonstrasjon kommer i tillegg til backendens automatiserte testpakke.
