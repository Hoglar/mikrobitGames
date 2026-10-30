# Micro Racer – foreslått implementasjonsdesign

**Status 2026-10-30:** Design, ikke levert kode. [Spesifikasjonen](specification.md) eier funksjon/rangering og [spilldesignet](game-design.md) eier første regel-/balanseprofil. Ingen firmware-, database- eller driftsendring utføres av denne dokumentpakken.

## Moduler og ansvar

Foreslått mappe er `webapp/src/games/micro-racer/`, familie-/motornøkkel `racing`. Bruk JavaScript ES-moduler og Canvas i dagens statiske bygg. Ingen ny rammeverkspakke eller ekstern fysikk-/AI-tjeneste er nødvendig.

| Modul | Ansvar |
| --- | --- |
| `index.js` | Eksisterende motorgrensesnitt, inputarmering, aktiv tilstand og orkestrering. |
| `config.js` | Uforanderlig, versjonert bil-/fysikk-/AI-profil. |
| `tracks/*.js` | De tre versjonerte banene med overflater, gater, grid og AI-linje. |
| `track-validation.js` | Lukket veibane, referanser, sikre spawnpunkter og gyldig kontrollpunktrekkefølge. |
| `physics.js` | Faste fysikksteg, overflater, kontakt mot barrierer og fire biler. Ingen DOM eller I/O. |
| `progress.js` | Rettede gatepasseringer, startarmering, runder og målgang. |
| `ai.js` | Tre lokale sjåfører som produserer kontrollsignaler. |
| `rules.js` | Tid, timeout, løpsplassering og koding/dekoding av resultat. |
| `camera.js` / `scene.js` | Kameratransformasjon, interpolasjon, bane, biler, minikart og HUD. |
| `audio.js` / `device-output.js` | Valgfrie, avgrensede effekter og tilstandsbilder gjennom eksisterende API-er. |

Modulene kan slås sammen der ansvaret forblir oversiktlig; tabellen er et designforslag, ikke krav om tomme filer. Sporbarhet og kjørbar funksjon er viktigere enn filantall.

## Motor og felles spillramme

Motoren tilbyr samme grensesnitt som eksisterende spill: `input(state)`, `press(event)`, `tick(seconds)`, `draw(context,width,height)`, `releaseControls()`, `setPlaying(bool)`, valgfri `finishRound()`, `dispose()` og lesbare `ended`, `completed`, `value`, `label`, `resultText`. Den mottar en uforanderlig konfigurasjon og injiserte output-/lydfasader. Ingen motorfunksjon åpner Web Serial, leser konto eller sender HTTP-kall.

`value` er `null` før gyldig målgang og ved DNF; etter målgang er den den frosne heltallsverdien. `completed=false` signaliserer timeout/teknisk avbrudd til rammen. Rammen må ikke anta at `engine.value` alltid er et tall: eksisterende resultatregler støtter `null` for ufullførte forsøk. Tilpass resultatteksten til «DNF – ikke fullført», fremfor å vise null som en rekordtid.

Eksisterende `gamePage` har spillspesifikke modusvalg; racing trenger et oppsett med fire avhengige valg fremfor én flat liste med 36 navn. Rammen løser `(track, format, laps, car)` til én kjent lokal katalogoppføring. Bruk samme `onSelectedGame`-kobling som oppdaterer topplisten ved andre modusvalg. Endres et valg i klar tilstand, nullstill forhåndsvisningen og vis ny variant; et aktivt forsøk beholder sitt opprinnelige oppsett.

Rammen eier startkrav, tre sekunders nedtelling, forsøks-ID, konto, kø, bekreftet avbrudd og fullskjerm. Motoren eier løpsklokke, gateprogresjon, AI og fysikk. Ny racingprofil må legges til i familieregister, modulimport og dagens validering av gyldige spillnøkler i routeren. Oppsettet må støtte både tilkoblet og lokalt spill uten å omgå eksisterende API-sperrer.

Den foreslåtte «Tilbake til banen»-handlingen er racing-spesifikk. Rammen tilbyr handlingen i racingens pausepanel og ber motoren planlegge sikker gjenoppretting etter fortsett-nedtellingen; den skal ikke improvisere posisjonsendring fra generelle restartknapper.

## Tidsmodell og determinisme

Samle aktiv `dt` i en rest og simuler ved 120 Hz. Render bare fra tilstanden; `draw()` får ikke trekke AI-tilfeldighet, telle tid, passere gater eller endre kontaktløsningen. UI/lyd/API-svar kan ikke påvirke antall simuleringssteg eller rekkefølgen på biler.

En aktiv frame på høyst 250 ms gir høyst 30 steg. Større gap eller skjult fane skal pause før catch-up. Normal rest beholdes gjennom pause, men tid tilbrakt i pausen legges aldri til. Ingen skjult «dropp tid»-optimalisering som lar en treg klient kjøre et billigere konkurranseløp. Ikke interpoler fysisk gatepassering fra en kamerabevegelse.

Per fysikksteg:

1. Bekreft aktiv tilstand, gyldig input og løpets eierskap gjennom ramme/motor.
2. Oppdater spillerens rattsignal og holdte gass/brems; forbruk eventuell pause før bevegelse.
3. Oppdater AI-beslutninger på hvert sjette steg. AI-signaler går gjennom samme begrensede styre-/drivverk som spilleren.
4. Beregn alle fire bilers frie bevegelser fra samme forrige tilstand.
5. Løs swept kontakt mot bane og bilpar med stabil ID-/kontaktrekkefølge og fast iterasjonsgrense.
6. Behandle faktiske bevegelsessegmenter og gatepasseringer i treffrekkefølge; kontaktkorrigering/teleport markeres som ikke-givende.
7. Oppdater splittider, målgang og aktiv tid. Behandle alle bilene før spillerens plassering bestemmes. Gyldig målgang på tidsgrensen går foran timeout.
8. Publiser én ny observasjonstilstand og avgrensede effektforespørsler.

Logiske kontrolltracer angir hvilke signaler som gjelder ved hvert simuleringssteg. Identisk profil/konfigurasjon/inputtrace skal gi samme utfall ved 30/60/144 Hz tegning. Flyttallsammenligning bruker dokumenterte toleranser i geometrien; tid/score kvantiseres etter de felles reglene. Ikke lov bitidentisk flyttallsreplay på alle JS-motorer uten separat dokumentasjon.

## Input, pause og livsløp

Abonner på produksjonsadapterens gyldige tilstander via spillets sideeide session. Holdt A/B leses kontinuerlig. Tapte knappetrykktidspunkter kan ikke rekonstrueres som «ekstra gass» med `count`. Kun logo/pause er engangshandling; flere aggregerte logotrykk i samme callback får høyst én pauseovergang.

`releaseControls()` skal tømme rattsignal, ønsket input og armering uten å endre frosset bilfysikk. Etter hver overgang til aktiv kjøring kreves nytt nøytralitetsbevis fra gyldige samples. Tilbakevendende input starter aldri løpet automatisk. Pause fra tap av sesjon eller brukerens utlogging må stoppe alle fire biler, ikke bare spillerens input.

Ved restart: avslutt eventuelt rangert forsøk én gang, stopp effekter, nullstill alle biler/progresjon/tider og start ny runde med eget resultatobjekt. Før spillbytte opprettes ny session først etter at gammel `dispose()` er ferdig. Etter hvert `await` som kan overlappe spillbytte kontrolleres aktivt view/generasjon; en gammel start eller outputcallback skal ikke opprette en ny session eller sende til en ny runde.

## Konkurransekatalog og resultatkoding

Konkurransenøkkelen er:

```text
micro-racer-v1 / trackId@trackVersion / format / laps / carId
format ∈ {time-trial, race}
laps ∈ {1, 3}
carId ∈ {drift, race, formula}
```

Tre baner gir 36 oppføringer. Tildel én stabil UUID til hver nøkkel under implementasjon og før registrering; ikke generer nye ID-er ved runtime eller bruk visningsnavn som koblingsnøkkel. Den faktiske 36-raders UUID-tabellen er en implementasjonsleveranse. Denne specen reserverer ingen produksjons-ID-er og aktiverer ingen spill.

Navnet inneholder nødvendig kontekst, for eksempel «Micro Racer · Havneringen · AI-løp · 3 runder · Driftbil». Race bruker `racing_rank_v1`; tidskjøring bruker `milliseconds`. Begge er `lower_is_better`. Lås nøyaktige min-/maksverdier fra [spesifikasjonen](specification.md#tid-resultat-og-topplister), og avvis inaktiv/ukjent katalog eller avvikende poengregler før start.

`encodeRace(P,T)` og `decodeRace(value)` må kontrollere sikre heltall, `1≤P≤4`, `1≤T≤600000`, og avvise kodingshull (for eksempel `700000`, `1000000`, `4600000`). De generiske backendgrensene avviser ikke alle hull; frontendvalidering og testvektorer er derfor nødvendige. Backendteamet må samordne eventuell domenekontroll for denne enheten før tellende utrulling. Det er fortsatt ingen serververifisering av selve kjøringen.

DTO-et forblir `{attempt_id,status,value}` på eksisterende resultatendepunkt. Ikke legg til uavtalte `track`, `car`, `laps` eller `position`-felt; API-et avviser ukjente felt. Katalog-ID-en bærer varianten og race-enheten bærer plassering/tid. AI-motstandernes tider og spillerens enkeltrunder vises bare lokalt i første leveranse. Hvis disse senere skal lagres separat, kreves eksplisitt kontraktarbeid.

Utvid scorepresentasjon i spill, Dashboard, offentlig toppliste/historikk og AI-forklaring. `racing_rank_v1` skal aldri omtales som «poeng» eller rå millisekunder. Tidskjøring og race viser `mm:ss.SSS` med ledende nuller. Behold eksisterende formatering for andre spill. Endringer i bane, fart/grep, kontakt, AI, startgrid, tidsstraff eller tidtaking som påvirker sammenlignbarhet krever nytt versjonert rekordgrunnlag og samordnet nye katalog-ID-er.

## Visning, lyd og ressursgrenser

Tegn i logiske verdensmeter og skaler ved rendering. Kameraet bruker heading, og HUD tegnes etter `restore()` slik at den ikke roteres. Minikartet gjenbruker validert banegeometri, ikke en uavhengig skisse som kan vise en annen bane. Høy DPI og fullskjerm tilpasses uten mutasjon av fysikk eller zoomavhengige treffområder.

Foreslått minimum kjøreflate er 280×440 CSS-piksler i portrett eller 480×280 i landskap, målt på selve visningen etter verktøylinjer. Fullskjerm deler tilgjengelig areal med nødvendige kontroller. Dersom krav til utsyn/lesbarhet ikke kan oppfylles ved minimumsstørrelsen, pause fremfor å skjule informasjon og juster den dokumenterte grensen før akseptanse.

Faste øvre grenser i første profil: fire biler, tre AI-kontrollere, fire kontaktpass per steg, høyst 30 innhentingssteg per frame, tre lagrede spillerrundetider, 128 hjulsporsegmenter, 64 partikler og åtte samtidige nettleserlydstemmer. Banegeometri har statisk størrelse; bruk romlig indeks og avgrenset AI-fremoversøk. Ikke behold alle posisjoner eller frames i minnet under vanlig spilling.

Valgfri nettleserlyd aktiveres i brukerhandlingen før asynkron start. Stopp og rydd stemmer ved pause, DNF, målgang og spillbytte. Micro:bit-bilder sendes bare ved tilstandsendring gjennom adapteren, med høyst ett normalt utestående displaykall og nyeste ønskede bilde. Outputfeil er diagnostikk, ikke DNF. Ingen sen callback får endre score eller gi en gammel rekordmarkering i neste runde.

## Leveranserekkefølge

1. Frys startprofilen og lever tre validerbare banefiler, bilparametere og regel-/scorefixturer.
2. Implementer ren fysikk, gateprogresjon, klokke og tidskjøring; verifiser alle biler og rundetall uten rendering.
3. Implementer tre deterministiske AI-kontrollere, fysisk kontakt og plassering; legg til kollisjons-/målgangsfixturer.
4. Integrer én kassett, variantvalg, eksisterende session/ramme, fullskjerm og riktig toppliste.
5. Samordne UUID-tabell, ny resultatformatter og AI-/backendpresentasjon; generer registreringskommandoer for gjennomgang uten automatisk kjøring.
6. Kjør programvare- og fysiske tester fra [testplanen](test-plan.md), dokumenter observerte begrensninger og behandle utrulling separat.
