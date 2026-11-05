# Micro:bit Games SDK v1

**Status:** Implementert SDK v1, 2026-11-04. Editor-typer leveres i `src/game-sdk/index.d.ts`. Spillet importerer bare `@microbit-games/sdk` som plattformbibliotek; lokale egne moduler er tillatt.

## Inngang og livsløp

```js
import { defineGame } from '@microbit-games/sdk';

export default defineGame(({ canvas, input, device, scores, round,
  assets, ui, audio, random }) => {
  return {
    update(dt) {},                  // faste simuleringssteg, sekunder
    render(ctx, viewport) {},       // Canvas 2D; CSS-piksler
    onPause(reason) {},             // valgfri
    onResume() {},                  // valgfri
    onResize(viewport) {},          // valgfri
    dispose() {}                   // valgfri; kan returnere Promise
  };
}, { stepHz: 60 });
```

Factory kan returnere controller eller `Promise<controller>`. `update` og `render` kreves og er synkrone. `stepHz` er 30, 60 eller 120, standard 60. SDK-runtime eier requestAnimationFrame og akkumulering; høyst 250 ms/30 simuleringssteg tas igjen per render. En pause tømmer akkumuleringen; pause-/fanetid legges ikke til simulasjonen. Tid i spillreglene må komme fra `dt`/`round.elapsedMs`, ikke veggklokken. `render` skal ikke endre spilltilstand eller trekke tilfeldige tall.

Vertens tilstander er `ready → loading → countdown → playing → paused/result → closed`. Factory opprettes for valgt modus ved start; en lett forhåndsvisning kan opprettes separat uten aktiv runde. I forhåndsvisning er output/resultatoperasjoner avvist med `ROUND_NOT_ACTIVE`. Under nedtelling er simulering og press-/gesturelevering stoppet. Ved GO eller bekreftet fortsettelse settes ferske inputbaselines; gamle engangshendelser spilles ikke av.

`onPause` kalles etter at runtime har stanset simulering og press-/gesturelevering. Tilstandsabonnementer/getState beholder den faktiske adaptertilstanden; spillet skal slippe egne kontrollbuffere i pausecallbacken. `onResume` gir ikke automatisk fysisk nøytralitet: spill med holdte/sensitive kontroller må fortsatt kreve fersk nøytral input som i dagens Tetris/Racer. Runtime sender ikke oppsamlede pausehendelser. Output stopper ved pause, ikke bare ved spillbytte. Bruker må eksplisitt fortsette etter inputtap eller skjult fane. En syntetisk unavailable-tilstand skal ikke presenteres som en ny fysisk nøytral måling.

`dispose` er idempotent. Runtime fjerner egne løkker, abonnementer, blob-URL-er og lyd før rammen fjernes; verten avventer Micro:bit-sessionens opprydding før neste spill får output. Oppryddingsfeil vises uten å tillate gamle output-/resultatkall. Nye spill trenger ikke implementere meny, nedtelling, konto, lagringsskjema eller fullskjerm selv.

## Context

| Objekt | Offentlig innhold |
| --- | --- |
| `canvas` | Spilldokumentets Canvas-element. Ingen tilgang til verts-DOM. `render` får allerede skalert 2D-context. |
| `round` | Frosne `id`, `modeId`, `rulesVersion`, `config`, `seed`, `storage` (`local`, `online`, `none`); lesbare `phase`, `elapsedMs`; `requestPause()` og `onPhase(callback)` som returnerer unsubscribe. Ingen spiller-ID eller cookie. |
| `input` | `getState()`, `subscribe(callback)`, `onPress(callback)`, `onGesture(callback)`. Samme felt/tilfeller som eksisterende game.inputs. Alle abonnementer kan avmeldes og ryddes ved disposal. |
| `device` | Lesbare `capabilities`; `display` og `speaker` med eksisterende outputmetoder. Ingen connect/disconnect/raw serial. |
| `scores` | Avslutning, bekreftelsesstatus og lesetilgang til den **allerede valgte** topplisten; se nedenfor. |
| `assets` | `url(path) → Promise<string>`, `readText(path) → Promise<string>`, `readJson(path) → Promise<JSON>`. Bare normaliserte pakkestier. URL gjelder til disposal. |
| `ui` | `setStatus(text)`, `setHelp(text)`, `requestFullscreen() → Promise<void>`. Alt tekst behandles som ren tekst. Fullskjerm kan kreve brukerklikk; vertens knapp er alltid tilgjengelig når støttet. |
| `audio` | `getSettings()`, `subscribe(callback)`, `onUnlock(callback)`, `unlock() → Promise<void>`, `registerCleanup(callback)`. Felles mute/volum fra spillrammens topplinje og opprydding for nettleserlyd; valgfri lyd må ikke stoppe spillet hvis nettleseren avviser den. |
| `random` | `next() → number` i `[0,1)`, deterministisk fra rundens seed. Samme algoritme/versjon testes; ingen seedendring under runden. |

Bibliotekets deklarasjonsfil gir editoren typer for context, kontroller, input/output og rekorder. Det finnes ingen direkte HTTP-klient, generell RPC, kontoprofil eller privat forsøkshistorikk i context. `round.config` og snapshots er dypt frosne lokale kopier.

`viewport` i render/resize inneholder `{width, height, pixelRatio}`. Width/height er CSS-piksler i den faktisk tildelte spillflaten; runtime setter Canvas-bakbuffer og transform etter DPR. Ved `fit: 'contain'` beholdes manifestets designproporsjon; `responsive` bruker tilgjengelig areal. Minimumsstørrelse sjekkes av verten. Mer avansert spillspesifikk responsivitet håndteres i spillets `onResize`, eventuelt med `round.requestPause()`.

### Generiske tilleggskontroller

For spillspesifikke presentasjonsvalg og blant annet Racers recovery uten grener i verten tilbyr `ui` også:

- `addSetting({id, label, type, defaultValue, min?, max?, step?}, onChange) → unsubscribe`. Type er `toggle` eller `range`. Runtime registrerer høyst åtte validerte kontroller i vertens innstillingsområde; callbacks lever i spillet og mottar validerte verdier, ikke DOM-elementer. Range krever endelige min/maks/step og verdi innen intervallet. Innstillinger er spillspesifikke presentasjonsvalg; bruk felles `audio` for lyd, og legg konkurranseregler i låst modus/config.
- `addPauseAction({id, label, confirmText?, resumeAfter?}, handler) → unsubscribe`. Høyst fire handlinger. Vertens pausemeny viser knappen og eventuell bekreftelse. Handler kalles i sandboxen mens simuleringen fortsatt er pauset; ved vellykket svar kan `resumeAfter` starte vanlig kontrollert nedtelling. Alle start-/inputkrav sjekkes igjen. Dette lar Racer flytte bilen til siste sikre punkt uten at verten kjenner `requestRecovery`.

ID-er er lokale for aktiv runtime; tekst er ren tekst med maksimum 120 tegn per etikett og 300 per bekreftelse. Disposisjon fjerner kontroller og callbacks. Feil beholder pause og vises i verten. Ingen handler serialiseres som kode til verten; SDK-et formidler registrering/aktivering gjennom sin bundne port. Spesialmenyer tegnet inne i spilldokumentet er også tillatt, men grunnleggende pause/fullskjerm og navnelagring lever alltid hos verten.

## Micro:bit gjennom samme bibliotek

Input bruker [det eksisterende offentlige biblioteket](../../src/microbit-input/README.md#reading-inputs): tilstand med knapper, tilt, akselerometer, temperatur, lys, mikrofon og logo; `onPress` gir `{ input, count }`, og `onGesture` gir `shake`. Ingen nye sensorer eller tidsstempler innføres. Hendelsesrekkefølge og tellere bevares gjennom broen. Gjeldende snapshot leses før trykkhendelser; sammenslåing skal ikke miste antall trykk.

```js
const offState = input.subscribe(state => {
  if (!state.inputAvailable) return;
  const steer = state.tilt.x;
  const throttle = state.buttons.bPressed;
});
const offPress = input.onPress(({ input: key, count }) => {
  if (key === 'a') rotate(count);
});

await device.display.showText('READY');
await device.speaker.playTone({ frequencyHz: 440, durationMs: 100 });
```

Håndter avviste output-Promises. API-navn, argumentgrenser, kapabiliteter, FIFO/16 ventende kommandoer og betydningen «startet/anvendt, ikke ferdigavspilt» beholdes. Originale `MicrobitError.kind`/protokolkoder formidles som serialiserte SDK-feil med `source: 'microbit'`. Sandboxen får ingen sideeid singleton; `microbit.connect()` er fortsatt vertens Connect-knapp.

## Score og rekorder

| Metode | Kontrakt |
| --- | --- |
| `scores.finish({status, score, resultText?})` | `Promise<FinishReceipt>`. `status` er `completed` eller `incomplete`; completed krever alle scorefeltene, incomplete tillater gyldig delscore eller `null`. Stopper runden og utløser vertens resultatflyt. |
| `scores.getLeaderboard({scope?, page?, pageSize?} = {})` | `Promise<LeaderboardPage>`. Scope er `local` eller `online`; standard er rundens lagringsmål, eller `local` ved øving. Bare denne modusen/regelutgaven. Sidestørrelse 1–100, standard 10. Online krever synkronisert toppliste, men offentlig lesing krever ikke innlogging. |
| `scores.getPersonalBest()` | `Promise<Record|null>`. Online: gjeldende kontos offentlige rekord. Lokalt: navnet brukeren sist eksplisitt lagret under i denne visningen, ellers null. Ingen tilgang til hemmelige kontodata. |
| `scores.format(score)` | Ren lokal formatering etter manifest; samme presentasjon som vertens toppliste. |
| `scores.decode(value)` | Dekoder gammel heltallsrepresentasjon etter modusens kontrakt. Primært for migrering; nye spill leverer strukturert score direkte. |
| `scores.compare(a, b)` | Ren sammenligning: -1 når a er bedre, 0 ved likhet, +1 når b er bedre. Validerer begge scorer. |
| `scores.subscribe(callback)` | Straks gjeldende lagringsstatus, deretter endringer. Returnerer unsubscribe. |

`FinishReceipt` er `{attemptId, status, eligible, score}` og betyr **mottatt avslutning**, ikke lagret rekord. Første gyldige finish låser resultatet; identisk gjentakelse returnerer samme receipt, endret payload gir `RESULT_CONFLICT`. Vertens avbrudd bruker samme avslutningsmekanisme. Incomplete gir aldri rekord/navnefelt. For online bevares dagens private forsøk; en delscore pakkes bare hvis komplett gyldig feltstruktur finnes, ellers sendes null.

I `storage: 'none'` vises score, men ingen navneprompt eller API-kall, og lagringsstatus blir `skipped`. Utviklingsserveren tilbyr `local` som standard og `none` som eksplisitt øving. Hostet nettsted tilbyr `online` for innlogget spiller og `local`/`none` uten konto; valgt mål vises før start. Online betyr alltid kontoens rekord, lokal betyr alltid et frivillig alias.

Lagringsstatus er `{ state, outcome?, currentRecord?, error? }`, hvor state er `idle`, `awaiting-name`, `saving`, `saved`, `skipped`, `unconfirmed` eller `conflict`. `saved` sendes først etter fullført IndexedDB-transaksjon eller validert API-kvittering. Outcome er `created`, `improved`, `equal`, `not-improved` eller `not-eligible`; eksisterende API-utfall mappes i provideren. `skipped` betyr ingen lokal skriving.

Spillet samler ikke inn navn og kaller ikke en vilkårlig `save(name, gameId, score)`. `finish` er den eneste skriveoperasjonen; verten eier frivillig navnefelt, valg av konto/lagringsmål og omforsøk. Spillet kan ikke velge en annen forsøks-ID, spiller eller toppliste. Spill som bare ønsker standardskjermen trenger kun `scores.finish`.

`LeaderboardPage` er `{scope, boardKey, items, page, pageSize, total}`. Hver rad inneholder `{rank, name, score, formattedScore, recordedAt, isCurrentPlayer}`. Lokal brukeridentitet/online spiller-ID brukes internt av verten; SDK-et gir bare nødvendige offentlige raddata. Visningsnavn returneres som tekst, aldri HTML. Lesinger kan se nyere data enn en tidligere lesing.

## Feil og grenser

SDK-feil er `{name: 'GameSdkError', code, message, source?, retryable}`. Sentrale koder: `INVALID_SCORE`, `ROUND_NOT_ACTIVE`, `RESULT_CONFLICT`, `PAUSED`, `DISPOSED`, `ASSET_NOT_FOUND`, `STORAGE_UNAVAILABLE`, `STORAGE_FULL`, `ONLINE_UNAVAILABLE`, `ONLINE_NOT_READY`, `LOGIN_REQUIRED`, `RATE_LIMITED`, `UNSUPPORTED`. Ukjente feil vises uten stack/private data i spillet. Promise-avvisning er ikke lagringsbekreftelse.

Broen aksepterer bare kjente operasjoner med validerte størrelser. Rekordlesing har høyst én forespørsel i gang per type og høyst to starter per sekund; gjentatte UI-lesinger kan caches i ett sekund. Output beholder adapterens strengere køgrenser. Status/help er høyst 300 tegn og endres høyst 10 ganger/sekund. En klient kan ikke utvide rettigheter ved å manipulere sin lokale SDK-kopi.

## Lyd og fokus

Spillets nettleserlyd kjører i sandboxdokumentet. Spillrammens topplinje har én felles lydknapp og ett volumvalg for alle spill, også i fullskjerm. Valget lagres i nettleseren og beholdes ved restart og spillbytte; standard er lyd av og volum 1. Spill skal bruke `audio.subscribe` fremfor å lage egne mute-/volumkontroller eller legge kontroller over spillflaten. Sandboxen får autoplay-tillatelse fra verten; lydaktivering i topplinjen varsler spillets `audio.onUnlock`-callbacks. Hvis nettleseren likevel avviser lyd, skal spillet fortsette uten lyd.

`audio.subscribe` gir `{enabled, volume}` ved abonnement og endringer; bruk `enabled` til å slå lyd av/på og `volume` (0–1) på spillets gain-noder. `audio.onUnlock(callback)` og `audio.unlock()` lar spillet forsøke å gjenoppta sin AudioContext; meldinger over broen overfører ikke brukeraktivering. Registrer stopp av egne stemmer med `registerCleanup`, og stans lyd ved pause/disposal. Ved gjenopptakelse brukes de samme felles innstillingene. Lyd er aldri eneste feedback.

Micro:bit-output går alltid gjennom verten, som blokkerer speaker-avspilling ved mute/volum 0 og skalerer `playTone`/`playMelody` automatisk. Spill skal derfor ikke også multiplisere micro:bit-volumet med hovedvolumet. Pågående enhetslyd stoppes når volumet endres; neste avspilling bruker nytt volum. `playBuiltInSound` følger mute, men har ikke variabelt volum i protokoll v1.

Verten eier Escape/pause og fokusering ved start/fullskjerm. Logo kan være spillhandling som hold i Tetris; plattformen må ikke globalt reservere alle logotrykk. Kontrollregler deklareres/implementeres inne i spillet, mens en tilgjengelig Pause-knapp alltid finnes utenfor rammen.

Spillbytte og tap av ulagrede resultater bekreftes i en asynkron dialog i spillrammen, også i fullskjerm. Dialogen pauser en aktiv runde, men lar sidens serial-lesing fortsette. Avbryt/Escape beholder runden pauset og bevarer navnefeltet for en eventuell lokal rekord; Fortsett krever fortsatt et eksplisitt valg. Native `confirm()` skal ikke brukes i tilkoblet spillflyt, siden den blokkerer serial-behandling og kan utløse friskhetsgjenoppretting mens spilleren tenker.
