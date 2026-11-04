# Automatisk katalog og online-topplister

**Status:** Backend-/utrullingskode er implementert lokalt 2026-11-04; migrering/synkronisering er ikke kjørt mot driftsdatabase i denne leveransen. Brukerens siste valg er installasjon gjennom mapper, uten import/opplasting i nettleseren. Derfor brukes en betrodd katalogsynkronisering ved utrulling, ikke et offentlig registrerings-API.

## Hva skjer når eieren legger til et spill?

1. Eieren kopierer spillmappen til `webapp/src/games/`.
2. Vanlig bygg validerer alle manifest, kompilerer pakkene og genererer en komplett katalog med utledede backend-ID-er, scoregrenser og regelfingeravtrykk.
3. Nettstedets vanlige utrullingsjobb synkroniserer den genererte katalogen med backend. Jobben bruker en beskyttet driftsidentitet; ingen hemmelighet ligger i spillmappen eller webpakken.
4. Etter bekreftet synkronisering publiseres webpakken. Nye spill og moduser er da synlige og har tomme, fungerende online-topplister.

Dette krever ett felles oppsett ved innføring av plattformen, men ingen ny kode eller manuell registrering per spill. En offentlig besøkende får ikke installasjonsrett ved å eie en ZIP. Et spill som bare er installert på egen PC oppretter ingen oppføring på et annet nettsted.

En ren statisk hosting uten prosjektets backend kan tilby spill og lokale rekorder. Den kan ikke tilby delt online-lagring bare ved å ha `game.json`. Hvis synkronisering mangler/mislykkes, viser UI «Online-toppliste er ikke klargjort» og tilbyr lokalspill/øving. Et startet onlineforsøk bytter ikke mål automatisk.

## Katalogsynkronisering

Felles driftsverktøy: `backend/database/sync-game-catalog.py`, implementert sammen med dagens `backend/database/manage-game.py`, og kalt én gang fra utrullingsjobben. Input er det genererte `catalog.json` fra en vellykket webapp-build, ikke kode som serveren må kjøre.

Hver modus gir:

```text
id, packageId, mode: {id, rulesVersion, config, selection?, score, ...},
name, score_unit, ranking_direction, min_value, max_value,
rulesFingerprint, rulesCanonical, contentHash
```

Backend utleder codecVersion=1 og offentlig sdk_metadata fra disse feltene. rulesCanonical er den kanoniske regelteksten fra JS-byggeren; backend kontrollerer at den beskriver de samme reglene og gir det oppgitte fingeravtrykket. Katalogen valideres på nytt i backend. Ukjente codecs, kolliderende UUID-er, dupliserte nøkler, endret scorekontrakt under eksisterende regelutgave og tall utenfor støttet intervall avvises før skrivning. Maksimumsgrenser er konsistente med pakkevalideringen. Metadata kan ikke inneholde SQL, JS, URL-er som serveren skal hente eller passord.

Synkronisering bruker én transaksjon: opprett manglende spill/topplister, behold eksisterende identiteter og historikk, oppdater kun tillatt presentasjon, og registrer kontrakt/fingeravtrykk. Gjentatt kjøring med samme katalog gjør ingen logisk endring. Et eksplisitt nytt `rulesVersion` oppretter en ny toppliste; aldri omskriv gamle resultatregler.

En tom/ufullstendig katalog skal ikke slette rekorder. Manglende oppføringer rapporteres som diff. Synkroniseringsverktøyet deaktiverer aldri manglende spill automatisk. Eventuell deaktivering gjøres separat med eksisterende driftsverktøy etter gjennomgått katalogdiff. Bruk dagens regler for deaktivert spill og idempotent retry av allerede eksisterende forsøk. Ved gradvis utrulling beholdes eldre moduser aktive til gamle pågående runder har fått avsluttes; deaktivering er en egen avsluttende driftsfase.

## Scorekoding og eksisterende API

SDK-et tar strukturerte scorer, mens [API 0.3.0](../../../spec/contracts/webapp-backend/contract.md) fortsatt kan motta `{attempt_id, status, value}` med ett heltall. Nye spill trenger derfor ikke et nytt HTTP-endepunkt per spill eller en ny databasekolonne for hver scoretype.

**Ett felt:** `value = score[field.key]`; retningen er feltets retning. `offset` og `radix` er ikke tillatt i denne profilen. Min/maks beholdes direkte.

**Flere felt:** Sett global retning til første felts retning. For felt i:

```text
width[i] = max[i] - min[i] + 1
digit[i] = score[i] - min[i]          hvis feltets retning = global retning
digit[i] = max[i] - score[i]          ellers
radix[i] = oppgitt radix eller width[i]   (bare i > 0)

rank = digit[0]
for i = 1..n-1:
    rank = rank * radix[i] + digit[i]
value = rank + (offset eller 0)
```

Alle radix-er må være minst width; første felt kan ikke ha radix. Kodet maksimum beregnes ved å bruke `width[i]-1` som hvert siffer. Bruk eksakt heltallsaritmetikk ved validering før konvertering til JS-number. Dekoding trekker fra offset, deler/modulerer baklengs og validerer alle siffer; hull i intervallet er ugyldige scorer. Maksimum må være høyst 9 007 199 254 740 991. Lexikografisk sammenligning og kodet heltall skal gi samme rekkefølge.

Migreringseksempler som skal bevares **bit for bit**:

| Spill | Deklarasjon | Eksisterende verdi |
| --- | --- | --- |
| Snake | mat 0..396 høyere; steg 0..999999 lavere; siste radix 1000000 | `mat*1000000 + (999999-steg)` |
| Racer AI-løp | plass 1..4 lavere; tid 1..600000 lavere; siste radix 1000000, offset 1 | `(plass-1)*1000000 + tid` |
| Racer tidskjøring | tid i ms, ett felt lavere | Uendret tid i ms. |
| Tetris og andre skalare spill | poeng/metre/tid, ett felt med opprinnelige grenser/retning | Uendret heltall. |

Snake Labyrint beholder maksimum mat 380 og sin eksisterende UUID. `legacyGameId` og eksisterende `score_unit` beholdes i migreringsmetadata for alle 47 nåværende varianter. Nye flerscoremoduser bruker felles enhet `sdk_rank_v1`, og nye skalare moduser bruker `sdk_value_v1`; presentasjon kommer fra scoredefinisjonen. Gamle enhetsnavn finnes fortsatt for eksisterende API-klienter.

## Nødvendige backendendringer

Dette er fortsatt en backendendring selv om resultatbody beholdes:

- Legg til versjonert, deklarativ SDK-metadata knyttet én-til-én til eksisterende Game/toppliste. Migrering skal ikke slette eller renummerere Game, Attempt eller Record. Metadata er valgfri for gamle spill under overgangen.
- Utvid katalogsynkronisering med idempotent opprettelse og regelkonfliktkontroll. Vanlig spillklient får ingen administratorrettigheter.
- Valider SDK-kodede scorer ved å dekode og sjekke feltgrenser, også kodingshull. Serveren bruker sin lagrede definisjon, aldri en scoredefinisjon sendt med resultatet. Eksisterende legacy-attempt-retry beholder sin opprinnelige kontrakt/kvittering.
- Tilby offentlig, validert `sdk_metadata` i spillmetadata for de generiske frontend-/AI-presentatørene. Dette er en additiv API-revisjon som må beskrives i OpenAPI, kontrakt og testfixtures før aktivering. Topplistesvar kan fortsatt inneholde kodet `record.value`; SDK-et dekoder den med verifisert metadata.
- Bruk dagens atomiske personlige rekordregler, delte rangering, sesjonseierskap, privat forsøkshistorikk og eksakt idempotens. Ingen automatisk overføring av lokale navn/scorer til kontoer.
- Gjør AI-presentasjon generell gjennom metadata fremfor stadig nye spillspesifikke dekodere. AI får fortsatt bare offentlige rekorder og ingen private forsøk. Der metadata mangler brukes eksisterende formatering.

Kodekjøring er ikke del av katalogsynkronisering. Nettstedets statiske spillkode serveres med webpakken og kjøres bare i nettleseren. Katalogvalidering og en SDK-bro kan validere format/grenser, men kan ikke bevise at en klient faktisk spilte ærlig. Dette er samme grunnleggende begrensning som dagens API.

## Publiseringsrekkefølge og feilhåndtering

Innfør bakoverkompatibel database/API-støtte først, så katalogsynkronisering, deretter den nye webpakken. Hvis synkronisering feiler, publiseres ikke en halvferdig katalog som «online klar». Behold forrige webpakke tilgjengelig. Ny frontend skal kunne tilby lokalspill selv om SDK-metadata mangler i en eldre backend; online start sperres ved manglende/ulik regelkontrakt.

Tilbakerulling skal kunne publisere forrige webpakke uten å slette nye topplister eller historikk. Denne leveransen utfører ingen faktisk migrering, katalogsynkronisering eller utrulling.
