# Micro Tetris – spesifikasjon

**Status 2026-10-29:** Implementert lokalt; [valideringsrapporten](../../../results/tetris-validation.md) dokumenterer programvaretestene og gjenstående fysisk akseptanse. Tallene i [game design](game-design.md) er versjonerte startverdier til utprøving.

## Formål og avgrensning

Spilleren plasserer de sju tetrominoene på et 10×20 synlig brett, rydder hele vannrette rader og spiller til top-out. Hold, SRS-rotasjon med vegg-/gulvkicks, T-spins/Mini, ghost piece, fem neste brikker, combo, back-to-back og perfect clears inngår. Spillet er endeløst uten 150-linjers seier. Mer poeng gir høyere fallhastighet frem til et tak; poeng fortsetter å øke etter taket.

Bruk [felles inputbibliotek](../../../src/microbit-input/README.md), [API 0.3.0](../../../../spec/contracts/webapp-backend/contract.md) og [dagens spillramme](../../webapp-implementation.md). Bare adapteren eier Web Serial. Denne pakken spesifiserer ett nytt spill og nødvendige integrasjonspunkter; den endrer ikke firmware-/API-kontraktene og registrerer ikke et backendspill.

## Styring

| Input under aktiv spilling | Handling |
| --- | --- |
| `state.tilt.x` | Diskret flytting venstre/høyre, med dødsone/hysterese og kontrollert repetisjon. Ikke absolutt valg av kolonne. |
| Nytt A-trykk | Hard drop til ghost-posisjonen og umiddelbar låsing. Holdt A gjentar ikke. |
| Nytt B-trykk | Ett forsøk på 90° rotasjon med klokken, med SRS-kicks. Holdt B gjentar ikke. |
| Nytt logotrykk | Hold/swap én gang per brikkelåsing; innkommende brikke starter med standard rotasjon og spawn-posisjon. |
| Nettstedets Pause-knapp / Escape | Pause. Logo er hold, ikke pause i dette spillet. |

Tilt bruker bare X; Y, risting, lys og mikrofon påvirker ikke spillreglene. Ingen tastatur-/musestyrt gameplay-fallback skal omgå kravet om klar fysisk Micro:bit. Musen kan brukes til menyer, lydvalg og pause. Samtidige handlinger, aggregerte trykk og repetisjon er entydig definert i [implementasjonsdesignet](implementation-design.md#input-og-simuleringsrekkefølge).

Start, restart og fortsett bruker spillrammens tre sekunders nedtelling. Input under nedtelling/linjerydding bufres ikke til neste brikke. Holdte kontroller fra meny eller inputbrudd skal ikke utløse rotasjon/drop/hold ved retur. Ny, gyldig nøytral tilt og slupne knapper/logo kreves før kontrollene armeres.

## Visning og lyd

Webflaten viser hele 10×20-brettet, aktiv brikke, tydelig ghost, neste fem brikker, hold-brikke med bokstav, score, nivå, ryddede linjer og neste poenggrense. Hver brikketype har egen stabil farge i retro/pixel-stil. Farge og effekter endrer ikke treffområder eller regler.

Micro:bits 5×5-display viser **den lagrede hold-brikken**, i standard orientering; tom hold gir blankt display. Nettleseren viser også hold, slik at spilleren ikke må se bort fra brettet for å forstå tilstanden. Vanlige poeng-/taps-/rekordbilder skal ikke overskrive hold under en aktiv Tetris-runde.

Mens runden er aktiv spiller Micro:bit en gjenkjennelig, monofonisk Korobeiniki-hovedmelodi i løkke. Tempo følger spillnivået fra rolig start til et makstempo. Nettleseren gir egne lydeffekter for vellykket rotasjon, hard drop og linjerydding; Micro:bit-musikken avbrytes ikke av disse. Musikk og nettlesereffekter har separate på/av-valg, begge på som standard ved første besøk, med volumkontroller. Valgene kan endres under runden og beholdes ved restart i samme sidebesøk.

Pause, nedtelling, tapt input, Game Over og sidebytte stanser musikk og nettlesereffekter. Fortsett spiller den avbrutte takten fra starten, uten å ta igjen tiden i pausen. Nettleserens lydaktivering knyttes til en eksplisitt brukerhandling; blokkert lyd vises som utilgjengelig uten å stanse spillet. Display-/lydfeil gir diagnostikk og endrer ikke score eller resultat; faktisk inputtap følger normal pausepolicy.

Linjerydding har nivåer av visuell respons etter linje-/bonuspoengene: et vanlig firelinjers clear er tydelig kraftigere enn et vanlig single på samme nivå. Combo, back-to-back, T-spin og perfect clear fremheves med tekst og økt effektklasse. Effekter må ikke skjule neste brikke eller forsinke reglene; redusert bevegelse beholder poeng-/bonusinformasjonen uten kameraristing.

## Moduser, slutt og resultat

| Modus | Brikkefølge | Lagring |
| --- | --- | --- |
| Rangert | Ny tilfeldig seed per forsøk; ingen manuell seed. Samme låste regelprofil. | Ett backendforsøk med vanlig innloggings-/start-/fornyelseskrav. |
| Øving | Valgfri trimmet/NFC-normalisert seed; tomt felt gir ny seed. | Bare lokal visning, ingen backendinnsending eller rekord. Øving kan ikke omklassifiseres. |

**Lokalt utviklingsunntak:** `npm run dev`/`npm run preview` tilbyr bare øving uten
innlogging eller backendkatalog; den innebygde katalogen og ekte Micro:bit brukes.
Ingen forsøks-ID, innsending, historikk eller AI er tilgjengelig i denne modusen.
Se [implementasjonsnotatet](../../webapp-implementation.md#lokalt-spill--unntak-for-utvikling-2026-10-29).
Dette endrer ikke kravene for øving/rangert på det publiserte nettstedet.

Score er et ikke-negativt sikkert heltall. Katalogprofilen er `key: tetris`, navn `Micro Tetris`, `score_unit: tetris_score_v1`, `ranking_direction: higher_is_better`, `min_value: 0`, `max_value: 9007199254740991`. UI-et formaterer enheten som poeng; råenheten vises ikke til spilleren. Den stabile lokale UUID-en er `6a990001-165b-4e1d-8a20-000000000011`, med eget kataloggrunnlag. [Kodeveiledningen](../../../src/games/tetris/README.md) har registreringskommandoen; ingen ekstern registrering er utført som del av implementasjonen.

Top-out er en normal avslutning (`completed`), også med null poeng. Restart/hovedmeny/sidebytte etter godkjent rundestart gir `incomplete` med nåværende score, også ved avbrutt første nedtelling. Bare bekreftet `completed` kan gi rekord etter backendreglene. Score/utfall fryses én gang; ny runde får ny forsøks-ID. Samme score deler rangering; linjer, tid og antall brikker er ikke skjulte tiebreakere. Hvis neste poengtillegg ville overstige `Number.MAX_SAFE_INTEGER`, behold siste gyldige score og avslutt som `incomplete` med tydelig teknisk årsak; aldri wrap eller klipp et konkurranseresultat.

Pause bevarer brett, aktiv brikke, hold-lås, next/bag/RNG, poeng, nivå, combo/B2B og spillklokker. Gjenoppkobling krever eksplisitt fortsett. Resultatpanelet har direkte «Spill igjen»; et gammelt lagringssvar får ikke sende output eller endre en ny runde. En ny fysisk A-aktivering etter slipp kan brukes til restart fra resultatpanelet; den skal forbrukes som menyvalg og ikke hard-droppe første brikke.

## Sporbare krav

| ID | Krav | Test |
| --- | --- | --- |
| WEB-049 | Moderne endless-profil med 10×20 synlig brett, sju typer og definerte top-out-regler. | TT-01 |
| WEB-050 | Deterministisk 7-bag, fem next-brikker og ghost uten tilfeldige trekk fra visning/lyd. | TT-02 |
| WEB-051 | Tilt flytter diskret med hysterese/DAS/repetisjon; pauser slipper kontroller sikkert. | TT-03 |
| WEB-052 | B bruker de definerte SRS-geometriene og klokkeretnings-kicktabellene. | TT-04 |
| WEB-053 | A hard-dropper/låser én brikke per ny handling med korrekt avstandspoeng. | TT-05 |
| WEB-054 | Logo gir standard hold/swap én gang per låsing; innkommende brikke respawner. | TT-06 |
| WEB-055 | Gravitasjon, begrenset lock delay, linjerydding og simuleringsrekkefølge er deterministiske. | TT-07 |
| WEB-056 | T-spin/Mini klassifiseres etter siste transformasjon, hjørner og kick. | TT-08 |
| WEB-057 | Poeng følger tabell, combo, B2B og perfect clear uten dobbelttelling. | TT-09 |
| WEB-058 | Poenggrenser øker nivå/fart til et fast tak; gammelt nivå brukes til poengberegningen. | TT-10 |
| WEB-059 | Fargede retrobrikker, HUD, ghost og ryddige responsive forhåndsvisninger. | TT-11 |
| WEB-060 | Linje-/bonuspoeng gir målbar effektklasse; redusert bevegelse bevarer informasjon. | TT-12 |
| WEB-061 | 5×5-displayet viser bare aktuell hold-brikke under runden, uten gammel output etter restart. | TT-13 |
| WEB-062 | Micro:bit spiller melodiløkke med nivåstyrt tempo og avgrenset outputkø. | TT-14 |
| WEB-063 | Nettleseren gir rotasjon/drop/clear-effekter med separat på/av/volum. | TT-15 |
| WEB-064 | Start/nedtelling/pause/inputtap/fortsett følger plattformen uten skjult gameplay eller lyd. | TT-16 |
| WEB-065 | Rangert/øving og seed låses per runde; kun rangert sendes. | TT-17 |
| WEB-066 | Egen katalogprofil og uforanderlig resultat lagres én gang; direkte restart bevarer eldre innsending. | TT-18 |
| WEB-067 | Outputfeil, tidsavbrudd og sene callbacks kan ikke endre eller blokkere en nyere runde. | TT-19 |
| WEB-068 | Avgrenset ressursbruk, ulik framefrekvens og fysisk V2-styring/lyd verifiseres før akseptanse. | TT-20 |
