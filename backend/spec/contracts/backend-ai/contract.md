# WBS 1.5 – Kontrakt mellom Backend API og AI-tjenesten

**Revisjon 1.2, 2026-10-27:** Presisert at private forsøk er utenfor AI-grunnlaget. Meldingsformat, offentlig rekordgrunnlag og grenser er uendret. Tidligere godkjenning gjaldt tidligere revisjoner.

**Historisk status:** Dokumentasjonsleveranse for [WBS 1.5 / issue #5](https://github.com/Hoglar/mikrobitGames/issues/5). Versjon 1.0 ble godkjent av prosjekteier 2026-10-23; versjon 1.1 utvider til spørsmål på tvers av spill etter prosjekteiers ønske 2026-10-24. Ett spørsmål og ett svar uten samtalehistorikk, med lokal HTTP/JSON. Implementasjon, kjørbare tester og målinger følger i komponent- og integreringsarbeidet.

## Formål og avgrensning

En innlogget spiller kan stille frie spørsmål om dataene i databasen, både innenfor ett spill og på tvers av spill og spillere. Spørsmålene er ikke begrenset til forhåndsdefinerte spørsmålstyper. Private spillforsøk er utenfor datagrunnlaget, også når spilleren spør om egne forsøk. AI-tjenesten henter relevante data og returnerer ett kort svar på norsk som ren tekst. Hvert spørsmål behandles selvstendig, uten samtalehistorikk eller strømming av svaret.

«Utvikling» betyr endring i **personlige rekorder**, ikke alle spillforsøk. AI-en må følge spillets enhet og regel for om høyere eller lavere resultat er best. Spørsmål om andre spillere bruker den offentlige rekordhistorikken fra [WBS 1.4](../backend-database/README.md).

AI-tjenesten skal ha lesetilgang til alle spill, inkludert deaktiverte spill, alle spilleres rekordhistorikk og ikke-sensitive spillerdata som ID, brukernavn og tidspunkt for kontoopprettelse. Passordhash, hele `sessions`-tabellen, innloggingstoken og øvrige autentiseringshemmeligheter er utenfor tilgangen. Den konkrete listen over tillatte databasefelt og håndhevingen fastsettes i 1.6. Tjenesten henter data som trengs for spørsmålet; hele databasen skal ikke automatisk sendes til modellen.

Valg av AI-modell, kjøremiljø og intern organisering tas i [WBS 6.1](https://github.com/Hoglar/mikrobitGames/issues/17). Kontrollert databasetilgang beskrives i [WBS 1.6](../ai-database/contract.md), med [ADR-001](../../../../spec/decisions/adr-001-direkte-datatilgang-for-ai.md) som grunnlag.

## Kommunikasjon og ansvar

- **Fast premiss:** Backend og AI kjører på samme Linux-PC, og AI-svar beregnes med en lokalt installert modell.
- **Valgt kommunikasjon:** Backend kaller den separate AI-tjenesten med `POST /v1/answer` over HTTP med JSON (`Content-Type: application/json`). Tjenesten lytter kun på `127.0.0.1`; port konfigureres ved implementasjon. Dette er grensesnittet til vår AI-tjeneste; hvordan den kaller selve modellen avklares i WBS 6.1.
- **Begrunnelse:** Et eget HTTP-grensesnitt kan testes med kjente svar og feil uten en kjørende modell. Backend beholder samme grensesnitt når AI-tjenestens modell eller kjøremiljø endres. AI-tjenesten får separat oppstart og omstart.
- Backend kontrollerer innlogging og henter `player_id` fra sesjonen. «Jeg» og «min» viser til denne spilleren. Passord, passordhash og sesjonstoken sendes ikke til AI-tjenesten.
- Webappen oppgir spørsmålet og eventuelt valgt spill som kontekst. Backend lager en ny `request_id` og sender forespørselen videre. Spørsmålet bestemmer hvilke spill som undersøkes; spillkonteksten er ingen tilgangsgrense og hindrer ikke spørsmål på tvers av spill.
- AI-tjenesten henter tillatte rekorddata gjennom grensesnittet fra 1.6. Backend mottar et ferdig svar; den utfører ikke SQL eller annen kode fra svaret.
- Backend kontrollerer svarformat, størrelsesgrense og samsvarende `request_id` før videreformidling. Webappen viser svaret som ren tekst. Formatkontroll alene beviser ikke at AI-ens faktapåstander er riktige.

## Meldingsformat og eksempel

`request_id`, `player_id` og `question` er obligatoriske. De to ID-ene er UUID-er. `game_id` er valgfri spillkontekst: en UUID, `null` eller utelatt. Den begrenser ikke tilgangen til andre spill. `question` er en tekststreng med 1–1 000 Unicode-kodepunkter etter trimming av innledende og avsluttende blanktegn. Ukjente felt og ugyldige typer avvises.

```json
{
  "request_id": "33333333-3333-4333-8333-333333333333",
  "player_id": "11111111-1111-4111-8111-111111111111",
  "game_id": null,
  "question": "Hvilke spill har Nora registrert rekorder i?"
}
```

Eksempel med testdata der Nora har rekorder i Poengjakt og Sprint. Et gyldig svar med HTTP 200 kan være:

```json
{
  "request_id": "33333333-3333-4333-8333-333333333333",
  "status": "ok",
  "answer": "Nora har registrert rekorder i Poengjakt og Sprint."
}
```

Disse tre svarfeltene er obligatoriske; ekstra felt avvises. `answer` er ren tekst med 1–4 000 Unicode-kodepunkter. Alle tre statusverdiene nedenfor returneres med HTTP 200:

| Status | Betydning |
| --- | --- |
| `ok` | Spørsmålet kan besvares ut fra tilgjengelige rekorddata. Tall, enheter og sammenligninger skal stemme med dataene. |
| `no_data` | Nødvendig historikk eller navngitt spiller finnes ikke. Forklar hva som mangler; ikke dikt opp resultater. Én rekord kan beskrives, men gir ikke grunnlag for å hevde en forbedring. |
| `cannot_answer` | AI-en kan ikke besvare spørsmålet med de tilgjengelige, tillatte dataene. Forklar dette i svaret. |

## Feil og ventetid

Feil fra AI-tjenesten har formatet `{"request_id":"…","error":"INVALID_REQUEST"}`. ID-en gjentas når den kan leses som gyldig UUID; ellers brukes `null`. Bare disse to feltene inngår. Feiltekst til spilleren bestemmes av backend og skal ikke avsløre SQL, passord eller interne feildetaljer.

| Situasjon | Forventet håndtering |
| --- | --- |
| Ugyldig forespørsel, felt eller ukjent `game_id` når ID er oppgitt | AI-tjenesten returnerer HTTP 400 med `INVALID_REQUEST`. Manglende eller `null` spillkontekst er gyldig. Ugyldig input skal avvises før modellkjøring. |
| AI-tjenesten er opptatt | HTTP 503 med `AI_BUSY`. Første versjon tillater ett aktivt AI-kall totalt for tjenesten, uten ventekø. |
| Intern feil, inkludert feil ved datahenting | HTTP 500 med `INTERNAL_ERROR`. Teknisk feil skal ikke fremstilles som manglende rekordhistorikk. |
| Ingen forbindelse til AI-tjenesten | Backend rapporterer `AI_UNAVAILABLE` til webappen gjennom dens avtalte feilformat. |
| Tidsfristen overskrides | Backend avslutter ventingen med `AI_TIMEOUT` og ignorerer eventuelle sene svar. Ingen automatiske omforsøk. |
| Ugyldig svarformat eller feil `request_id` | Backend rapporterer `INVALID_AI_RESPONSE` og videreformidler ikke svaret. |

**Tidsgrense i første versjon:** Backend venter maksimalt 60 sekunder fra AI-kallet starter til et fullstendig svar er mottatt. Dette er en grense for venting, ikke en målt eller lovet svartid på hjemmemaskinen. Et utløpt kall skal avbrytes så langt kjøremiljøet støtter det; tjenesten regnes fortsatt som opptatt dersom modellarbeidet fortsetter. Spill og vanlig rekordlagring skal fortsatt fungere når AI er opptatt eller utilgjengelig. Endres grensene etter målinger, oppdateres kontrakten og tilhørende testforventninger sammen.

## Kvalitetskrav og senere verifisering

| Krav | Prioritet | Kontroll ved implementasjon og integrering |
| --- | --- | --- |
| AI-001: Korrekt og ærlig bruk av databasedata | 1 | Test varierte, frie spørsmål mot kjente data, også på tvers av spill og spillere og med manglende data. Faktapåstander skal stemme med datagrunnlaget; ordlyden kan variere. |
| AI-002: Avgrenset datautveksling | 1 | Test at backend bruker innlogget spiller som identitet, ikke sender autentiseringshemmeligheter og avviser ugyldige svar. Verifiser under 1.6 at alle spill og spilleres tillatte data kan leses, mens passordhash, sesjonsdata og skriveoperasjoner avvises av databasen. |
| AI-003: Forutsigbar feilhåndtering | 2 | En falsk AI-tjeneste gir hvert feilutfall i tabellen. Backend skal gi riktig utfall uten å blokkere spill eller rekordlagring. Gjenta sentrale kall mot den virkelige tjenesten ved integrering. |
| AI-004: Begrenset venting | 3 | Test tidsfristen med styrt klokke. Mål faktisk svartid og feilandel for et fast sett spørsmål på hjemmemaskinen. |

Enhetstester av validering og detaljerte integrasjonstester utarbeides i komponentarbeidet. Meldingsformatet kontrolleres med faste regler; faktainnholdet sammenlignes med kjent testdata, ikke bare med AI-ens egen vurdering. Modelluttrekk og sammenligning av implementert grensesnitt planlegges sammen med komponentmodellen.

Svartid for et fast sett spørsmål er en mulig måling til [prosjektets felles FoM](../../../../results/fom/README.md). Denne kontrakten krever ingen egen FoM-serie. Oppgaven krever minst tre datapunkter over tid for valgt FoM, inkludert baseline; konkrete målinger samordnes i prosjektets felles måleplan.
