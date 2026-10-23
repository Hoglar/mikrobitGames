# Direkte databasetilgang for AI-tjenesten

**Status:** Proposed

## Kontekst

Spillsystemet skal ha en lokal AI-tjeneste som lar spillere stille spørsmål om highscores.

Vi vurderte to alternativer:
1. AI-tjenesten får highscore-data gjennom Backend API.
2. AI-tjenesten får direkte lesetilgang til databasen.

## Beslutning

Vi velger å gi AI-tjenesten direkte lesetilgang til highscore-data i databasen.

AI-tjenesten skal kunne generere egne databasespørringer basert på spørsmål fra spillerne.

Tilgangen skal begrenses slik at AI-tjenesten ikke får tilgang til sensitiv brukerinformasjon, eksempelvis passord.

## Begrunnelse

Direkte databasetilgang gir AI-tjenesten større fleksibilitet til å besvare forskjellige spørsmål om highscores.

Dette gjør at vi ikke trenger å utvikle egne API-endepunkter for hver type spørsmål.

## Konsekvenser

**Fordeler:**
- Fleksible spørsmål og analyser av highscores.
- Mindre behov for spesialiserte API-endepunkter.

**Ulemper og risiko:**
- AI-genererte databasespørringer kan være feilaktige eller ineffektive.
- Direkte databasetilgang krever streng tilgangskontroll.
- AI-tjenesten blir avhengig av databasens struktur.

**Sikkerhetstiltak:**

AI-tjenesten skal bruke en egen databasebruker med kun lesetilgang til godkjente highscore-data, fortrinnsvis gjennom en begrenset databasevisning (view). Tilgangen skal håndheves av databasen, ikke bare gjennom instruksjoner til AI-modellen.
