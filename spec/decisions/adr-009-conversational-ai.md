# ADR-009: Lokal samtaleassistent med navngitte dataverktøy

**Status 2026-10-28:** Bestilt av brukeren for backend/API, med oppdaterte kontraktforslag og tester. Frontendkontrakten er fortsatt et forslag til frontendgruppen.

## Bakgrunn

Den lille lokale Qwen-modellen laget feil SQL eller tolket riktige data feil. En separat samtaleprototype ga bedre oppfølging og vanlige samtaler. Den første hilsenen feilet fordi modellen svarte vanlig tekst som JSON-parseren avviste. Dette var en formatfeil, ikke manglende databasetilgang. Utprøving av streng JSON-schema-styring og native verktøykall ga andre feil; de variantene innføres ikke.

## Beslutning

Behold Ollama og `qwen3:4b-instruct-2507-q4_K_M`. Modellen velger `games`, `standings`, `history` eller `player_games`, med strengt validerte argumenter. Tjenestekoden bruker faste, parameterbundne SQL-spørringer. SQL-policy og PostgreSQL-rollen `ai_reader` beholdes som egne kontroller. Ingen modellgenerert SQL, private forsøk eller shellverktøy tilbys.

Bruk den utprøvde JSON-handlingsprotokollen, med vanlig tekst/JSON-streng som tillatt prat. Skadet struktur godtas ikke som tekst. Deklarerte faktasvar krever ferskt dataoppslag; dette beviser ikke sannheten i hele svaret.

Samtaleminne ligger i AI-prosessens RAM per innlogging: høyst 20 utvekslinger, 30 minutters inaktivitet, høyst 64 samtaler. API-et lager ugjennomsiktig samtale-ID med en tilfeldig prosessnøkkel; token/hash sendes ikke til AI. Frontend kan ikke velge identitet eller levere autoritativ historikk. Ny reset-rute sletter samtalen. Utløp, kapasitet og omstart kan også fjerne den. Utlogging sperrer tilgang, men gir ikke umiddelbar fysisk RAM-sletting.

Kontekst økes fra 4096 til 16384 tokens, med 12288 UTF-8-byte inputgrense og 512 genererte tokens. Eldre utvekslinger kan fjernes tidligere med varsel. Nåværende spørsmål og data avkortes ikke. Fire modellkall, tre DB-forsøk, to sekunder per spørring, 1000 rader / 1 MiB og 60 sekunder samlet beholdes. Valgt spill-ID bruker ett DB-forsøk.

## Konsekvenser og kontroll

Dette erstatter valget om modellgenerert SQL i ADR-001 og stateless-meldinger i tidligere kontrakt 1.5. Direkte DB-lesing fra AI-tjenesten, komponentavhengigheter og modellvalg fra ADR-001/006 beholdes. Verktøysettet dekker ikke vilkårlige analyser. Antall rekordholdere kan ikke brukes som sikkert totalt deltakerantall.

Modellen kan fortsatt velge feil verktøy, feilklassifisere faktasvar som prat eller dikte opp påstander. Minnet kan videreføre feil. Større kontekst kan øke minnebruk og svartid; dette må måles av brukeren. Ingen ny full baseline eller godkjenning av faktakvalitet hevdes.

Kontrakter, OpenAPI, komponentmodeller og tester samordnes. Kontrollversjon 3 starter en ny måleserie, med uendret 24/4/4-fordeling, benchmarklast og faktakrav. Gamle rapporter beholdes. Brukeren kjører `./backend/check`, og velger selv eventuelle videre rettingsrunder.
