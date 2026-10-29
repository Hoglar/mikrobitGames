# Micro Tetris – implementasjonsdesign

**Status 2026-10-29:** Designet er implementert lokalt i [spillmodulen](../../../src/games/tetris/README.md). [Valideringsrapporten](../../../results/tetris-validation.md) skiller programvarekontroller fra fysisk akseptanse. [Spesifikasjonen](specification.md) eier funksjonelle krav; [game design](game-design.md) eier eksakte spillregler og balanse. Ikke gjenimplementer serialprotokollen i spillet.

## Modulansvar

Plasseringen er `webapp/src/games/tetris/` med `index.js` som inngang. `rules.js` eier geometri/kicks, bag, poeng, fart og hold-bilder; `model.js` eier brett og simulering; `scene.js` tegner, `audio.js` gir nettlesereffekter og `device-output.js` planlegger hold/musikk. Rene regler testes uten DOM, nettleser eller enhet. Rendereren og lydsystemene leser avgrensede hendelser fra motoren; de trekker ikke fra brikkegeneratoren og muterer ikke brettet.

Motoren følger dagens `tick(seconds)`, `draw(context,width,height)`, `press(event)`, `input(state)`, `releaseControls()`, `ended`, `value`, `label`, `resultText`, samt de allerede brukte valgfri-hookene `setPlaying(boolean)` og `dispose()`. Rendering i forhåndsvisning har ingen session og må aldri sende output.

Fabrikken mottar injiserte `outputs` fra **den aktuelle** `session.outputs`, en feilrapportør og klokke-/lydseams for tester, i tillegg til `seed`. `gamePage` sender output og sideeid browser-audio ved rundestart; forhåndsvisningen får ingen av dem. `finishRound()` stanser output og rydder hold-bildet ved både top-out og eksplisitt rundeavslutning; pause beholder bildet. Eksisterende spill beholder samme oppførsel. Ingen moduler importerer singletonen for å finne/overta en port selv.

## Runde og deterministisk tid

Plattformtilstandene beholdes: ready → starting → countdown → playing → paused/result → ny runde. Motoren bruker under playing enten falling eller clearing. Scoren/utfallet fryses før resultatpublisering. Restart avventer gammel spillsesjons `dispose()` før en ny kobles inn; rangert forsøk/opprinnelig eier/lagring beholdes av plattformens eksisterende kø.

Simulering bruker fast steg på `1/120` sekund med en restakkumulator. Hvert steg behandler input, fall og låsing deterministisk; ingen fysikk i `draw()`. Fallintervall, grounded lock-tid, tiltfrister og clear-fase bruker aktiv simuleringstid. Nivåendring kommer etter låsingens samlede score; nye brikker starter med null fallrest. Store framegap over 250 ms og skjult fane følger eksisterende plattformpause, uten catch-up. Unit-tester injiserer input på bestemte simuleringssteg for sammenligning av ulike renderfrekvenser.

Musikkens sendefrister bruker monoton hosttid når playing er sann, ikke opptjente simuleringssteg. Hold/bag/score er logiske data; musikktakt/-generasjon er separat. Pause fryser logikken og kansellerer fremtidige lydfrister. Ingen manglende lyd-/display-ACK får motoren til å vente synkront eller låse en brikke.

## Input og simuleringsrekkefølge

Bruk `input(state)` for X-tilt og ferske holdte A/B/logo-nivåer. Bruk `press({input,count})` for A/B/logo-handlinger. Den offentlige API-en gir ikke rå `u`/`n` eller fysisk trykktid; spillkontrolleren påstår ikke at det kan rekonstruere dem.

Tilt har følgende faste startprofil i begge moduser/nivåer:

| Parameter | Verdi |
| --- | --- |
| Engasjer venstre/høyre | `tilt.x <= -0.22` / `>= +0.22` |
| Slipp venstre/høyre | X kommer tilbake til `>= -0.12` / `<= +0.12` |
| Retningsbytte | Krysses motsatt engasjeringsgrense, bytt straks og nullstill repetisjonsklokken. |
| Første flytting | Én rute ved engasjering/ny spawn med beholdt tiltretning. |
| DAS | 170 ms før første gjentatte flytting. |
| Videre repetisjon | Én rute per 70 ms. Også blokkerte forsøk forbruker intervallet. |
| Armering etter start/fortsett | 100 ms fersk nøytral tilt (`abs(x) <= 0.12`) og slupne A/B/logo. |

Inne i hystereseområdet beholdes retningen bare så lenge dens slippgrense ikke er krysset. En jump fra venstre til svakt positiv tilt skal stoppe venstreflytting, ikke fortsette den. Ved veggen akkumuleres ingen kø av flyttinger. Etter vanlig spawn/hold resettes DAS; kontrollene behøver ikke ny nøytralstilling midt i aktiv spilling.

Motta høyst ett ventende flagg hver for hold, rotasjon og drop per simuleringssteg. Flere meldinger/count>1 koalesceres for samme handling; de skal aldri bli en kø som dropper eller holder fremtidige brikker. Antall manglende fysiske trykktidspunkter kan ikke rekonstrueres. Plattformen sender bare press til motoren under playing; motoren forkaster i tillegg handlinger i clearing, inaktiv fase eller før armering.

Rekkefølgen i et falling-steg er:

1. Bruk nyeste gyldige kontrolltilstand og avgjør om kontrollene er armert.
2. Eventuell hold; dersom den er ulovlig, ignoreres den uten andre endringer. Spawn-kollisjon avslutter straks.
3. Eventuell B-rotasjon, så eventuell tidsstyrt horisontal flytting.
4. Eventuell A-hard-drop og umiddelbar låsing. Dette forbruker hele handlingssettet; ingenting går til neste brikke.
5. Ellers: gravitasjon, grounded/lock-reset-regler og eventuell naturlig låsing.
6. Ved låsing: T-spin før fjerning, rader/komprimering, combo/B2B/perfect clear, atomisk score/nivå, lock-out, så clearing/spawn. Ett immutable `lockResult` beskriver poeng/bonuser/effektklasse.

Dette overstyrer ikke adapterens state→A→B→logo-varsling; motorens lille handlingssett gjør samtidighet entydig. B+A kan dermed rotere før drop selv om adapteren varslet A først. Logo+B+A holder først og roterer/dropper den innkommende brikken; alle operasjonene tilhører samme falling-steg. Feilaktig ny hold kan ikke låse opp hold-grensen.

`releaseControls()` tømmer handlingssett, DAS og armering. Bare faktiske ferske inputverdier kan etablere slipp/nøytralitet, aldri adapterens utilgjengelige nullverdier. Under nedtelling kan kontrolleren observere fersk nøytralitet uten å bufre handlinger; ved `setPlaying(true)` brukes den hvis siste gyldige input er høyst 100 ms gammel. Ellers venter armeringen på nye gyldige samples. Påvirkning fra menytrykk og restart-A forbrukes før gameplay.

## Output og musikkplanlegging

Én runde eier én outputplanlegger med rundegenerasjon/session-identitet. Alle callbacks/timere kontrollerer begge. `setPlaying` kalles hver frame av dagens app og må være idempotent; bare faktiske faseoverganger starter/stanser musikk. Ingen nye standardtoner, skjermnedtellinger eller rekordbilder skal konkurrere med planleggeren på denne sesjonen.

### Hold-bilde

Behold bare siste ønskede hold-type, siste kvitterte type og høyst én utestående displaykommando. Endringer mens den skrives erstatter den lokale ønskede tilstanden, ikke en voksende adapterkø. Når ACK kommer, send bare hvis ønsket bilde fortsatt avviker. Gamle callbacks kan ikke markere et nytt bilde som kvittert. Bruk `showImage` med de 25 heltallene eller `clear()` ved tom hold. Pause stanser ikke et hold-bilde; etter recovery/fortsett synkroniseres det én gang siden en handshake kan ha blankt displayet.

Outputfeil rapporteres med riktig kanal og hold-modellen rulles ikke tilbake. Ett kontrollert resynkroniseringsforsøk kan gjøres ved eksplisitt fortsett/«Prøv output igjen», ikke hver frame. UI viser eventuelt at hardwarebildet ikke er bekreftet.

### Micro:bit-musikk

Send én takt fra notetabellen i game design gjennom `playMelody({notes,volume})`. Påbegynn takt `k+1` først etter at takt k er kvittert **og** dens beregnede notetid er gått fra ACK-tidspunktet. Dette er en konservativ sluttberegning: ACK betyr startet, og må aldri tolkes som ferdig. Bruk én monoton engangstimer og høyst én utestående musikkkommando; ingen forhåndsfylling av hele sangen. Tempoet for en takt låses ved sending og beregnes fra gjeldende nivå. Etter takt 8 fortsettes takt 1.

Samme serial-writer må også betjene hold-bilder. Planleggeren eier høyst én utestående display- og én musikkkommando, altså høyst to normale offentlige kall. Ved pause/mute tømmer den lokale fremtidsfrister, øker generasjonen og sender én STOP uten å vente på musikktaktens varighet. STOP kan vente på allerede skrevet kommando/ACK og delt writer; den har ingen ny transportprioritet som protokollen ikke tilbyr. Session-disposal sørger til slutt for autoritativ STOP/CLEAR selv om motorens lokale disposering ikke kan avvente Promise-resultater.

Når pause avbryter en takt beholdes dens indeks; fortsett starter den takten fra begynnelsen etter nedtelling. Hvis takten var markert ferdig før pause, behold neste indeks. Det blir ingen forsinket utsending av gamle noter. Mute/unmute følger samme prinsipp. Volum-/tempoendring gjelder neste takt; volum 0 kan behandles som mute, slik at det ikke sendes lydløs musikk kontinuerlig.

**Eksisterende kontraktbegrensning:** Det finnes ingen planlagt device-starttid, dobbel lydkø, løkke eller playback-completion-event. Denne løsningen kan gi et kort mellomrom ved taktgrenser, og kan ikke love sample-presis/sømløs musikk. Mål p95 mellomrom utover notetabellens tilsiktede pauser til **≤150 ms** ved 90/180 BPM og samtidig hold-trafikk på normal maskin/enhet; rapporter også maksimum og faktisk løkketid. Ikke mål dette som forskjellen mellom to ACK-er. Hvis resultatet er hørbart utilfredsstillende eller ikke møter målet, må planlegging/lydprofil justeres og testes; en eventuell firmware-/kontraktutvidelse skal få egen beslutning før den beskrives som tilgjengelig. Ikke senk målet etter en feilet måling.

Feil fra musikkkommando gir synlig status og stopper automatisk ny musikk for den rundegenerasjonen inntil eksplisitt retry/fortsett. Ingen blind replay etter timeout. Hvis adapteren setter input unavailable, pauser plattformen på vanlig måte. Musikkfeil alene setter ikke ended eller endrer konkurranseresultatet.

### Nettleserlyd

Bruk egen lokal Web Audio-kontroller for rotasjon/drop/clear. Siden eier denne kontrolleren/AudioContext gjennom restart; den nye motoren får en rundebundet referanse, ikke en ny uaktivert context etter gamle motorens dispose. Opprett/gjenoppta AudioContext direkte fra eksplisitt Start-/lydknapphandling, **før første await for auth/serial**. Å gjøre det bare inne i den asynkront opprettede motoren er ikke tilstrekkelig. Et senere firmwaretrykk er ikke en nettleser-user-gesture; etter en Micro:bit-start kan spilleren derfor måtte klikke lydvalget hvis nettleseren blokkerer audio. Vis dette uten å kreve en ny runde.

Pause/engine-dispose stopper rundens stemmer/timere; selve context lukkes ved side-dispose. Gamle rundetokens kan ikke stoppe eller opprette stemmer i ny runde. Kald forhåndsvisning spiller ingen lyd. Maks åtte effektstemmer. Mute og unsupported AudioContext må ikke påvirke motor/RNG eller Micro:bit-musikk.

## Implementerte integrasjonsendringer

| Kode | Levert tilpasning |
| --- | --- |
| `games/registry.js`, katalogverktøy | Ny familie/nøkkel `tetris`, separat versjonert scoreenhet og ny UUID. Ingen gjenbruk av de ti eksisterende katalogoppføringene. |
| `loadGame()` / byggepakken | Last lokal `tetris/index.js`, CSS/notedata og øvrige lokale ressurser. Ingen CDN. |
| `gamePage` fabrikkkall | Injiser aktuell `session.outputs` ved rundestart; preview får ingen port/output. Behold `seed` og vis seedfeltet i Tetris-øving. |
| `gamePage` kontroller | Vis tilt/A/B/logo-instruksjoner; logo må sendes til hold. Eksisterende Snake-logopause gjelder bare Snake. Legg til Tetris-Escape-pause og sikker A-restart. |
| `gamePage` lydvalg | To separate toggles/volumer med avklart standard på; sideeid browser-audio aktiveres i brukerhandlingen før første await og lånes til nye runder. Ikke gjenbruk Vikings av-standard eller én felles toggle. |
| `gamePage` faser/output | Kall idempotent `setPlaying`, synkroniser hold etter fortsett, STOP på pause og rydd før ny runde. Ingen gamle lagringssvar sender displayeffekter for Tetris. |
| Score-/historikkvisning | Formater `tetris_score_v1` som poeng i Launcher, resultat, Dashboard og toppliste. Nivå/linjer er lokal statistikk, ikke nye API-felt. |
| Engine-disposal | Frigi grafikk/lyd/timere synkront og avskjær sene outputcallbacks; plattformen avventer selve `session.dispose()` før navigasjon/ny session. |

Resultat går gjennom eksisterende `createAttempt`/`finishAttempt`/submission-kø. Kontroller poengtillegget før addisjon (`score > Number.MAX_SAFE_INTEGER - lockDelta`) og avvis også et ikke-sikkert `lockDelta`; en teknisk grenseavslutning skal ikke lage en avrundet rekord. Dagens API får bare sine definerte felt for forsøk/score/status; ikke send seed, replay, nivå eller Tetris-statistikk som ekstra request-felt. Serveren beregner ikke Tetris-spillet på nytt. Rangert/øving følger avklart eksisterende unntak for spill, uten anonym øving.

## Ressurser og leveranserekkefølge

Behold fast 40×10-brett, én aktiv brikke, én hold-type, fem previews, høyst to bagers relevant kø, begrenset handlingssett og én låseresultat-hendelse per steg. Maks 150 partikler, åtte browserstemmer, én musikktimer og én utestående kommando per outputkanal. Ingen full spillhistorikk i minnet. Session-/rundeidentitet inngår i all asynkron opprydding.

1. Implementer/frys geometri, kickdata, bagvektorer, kollisjon og ghost med rene tester.
2. Legg til hold/drop/lock/T-spin/score/fart og kombinasjonsfixtures før UI.
3. Integrer styring, faser, katalogprofil og ranked/practice med dagens spillramme.
4. Legg til retrovisning, effektklasser og browser-audio uten å endre logikkens RNG.
5. Implementer outputplanlegger/hold/Micro:bit-melodi med mock-klokker, feil og tidlige/sene ACK-er.
6. Kjør [TT-testplanen](test-plan.md), deretter fysisk styring, display, musikk og langtidsmålinger. Programvarekontrollene er kjørt som dokumentert i valideringsrapporten; fysisk akseptanse gjenstår. Registrering/publisering krever de vanlige separate driftsstegene; implementasjonen gjør ingen slike endringer.
