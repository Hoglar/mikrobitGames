# Webapp – implementasjonsnotat 2026-10-29

Implementert som lokale JavaScript ES-moduler med egen hashrouter og Canvas.
Dette notatet beskriver den leverte koden; kravdokumentene er fortsatt fasit.
Ingen Sites-hosting, produksjonspublisering eller ekstern databaseendring inngår.

## Ansvar

| Modul | Ansvar |
| --- | --- |
| `src/app/main.js` | Sideskall, offentlig/beskyttet navigasjon, sidebytte og sideeid adapter. Treg backend blokkerer ikke Testlab. |
| `src/app/api.js` | Injiserbar fetch, cookie/CSRF, tidsfrister, feil og validering av lagringsbekreftelse. |
| `src/app/pages.js` | Launcher, auth, offentlig toppliste/historikk, Dashboard, Profil og AI 0.3.0. |
| `src/app/play.js` | Én spillramme; start, tre sekunders nedtelling, pause, menyer, øving, fornyelse og eierbundet forsøk. |
| `src/platform/submissions.js` | Minnebaserte lagringsoppføringer; identisk omforsøk, én pågående innsending per ID og kontroll av eier/svar. |
| `src/app/testlab.js` | Figur, sensorer, tre grafer, outputeditorer, lokal diagnostikk og opptak/eksport. |
| `src/games/` | Stabilt register og scoreformatering; hvert spill har egen mappe med `index.js`, og hjelpefunksjoner ligger i `shared/`. |
| `verification/build.js` | Hele den statiske offentlige pakken, uten kilde-README, tester eller backendfiler. |

Spillmotorenes felles grensesnitt er `tick(seconds)`, `draw(context,width,height)`,
`press(event)`, valgfri `input(state)`/`releaseControls()`, og `ended`, `value`,
`label`, `resultText`. Ingen motor åpner serialport eller kaller API.

Alle ressurser er lokale CSS/Canvas og systemfonter. Ingen CDN eller eksternt
bilde-/lyd-/fontkall. Det er ingen produktmodus som godtar mock som ekte enhet.

[Spillkodens struktur](../src/games/README.md) samler Viking Dash i `viking-dash/`,
Snake i `snake/` og de tre mindre spillene i `stars/`, `reaction/` og `balance/`.
Stjernefangst, Reaksjonsjakt og Balanseløypa har hver sin motor; den tidligere
samlede `arcade.js` er delt opp. Registeret beholder spillnøkler og katalog-ID-er.

## Forløp og avklarte valg

- Spill er installert i webpakken, men ti nye katalogoppføringer må opprettes på
  backend med de stabile ID-ene i registeret. `npm run catalog:commands` genererer
  vedlikeholdskommandoer uten å kjøre dem. Faktiske demospill-ID-er gjenbrukes ikke.
- API 0.3.0 har forrang foran komponentspesifikasjonens eldre tekst om selvstendige
  AI-spørsmål. Backend styrer samtaleminnet; klienten sender bare spørsmål og
  eventuelt spill-ID, støtter reset og viser notices som ren tekst.
- Snake/Vikings spesifikasjoner har forrang for direkte restart og øving uten
  resultatinnsending. Øvrige startkrav beholdes. Rammen gir samme mulighet for de
  tre spillene bestilt i samtalen. Øving kan aldri etterregistreres som rangert.
- Snake har seks ID-er med enheten `snake_rank_v1`. Competitive prioriterer frie
  ruter gjennom versjonert Fisher–Yates; Random bruker rundens seed. Den faktiske
  generatoren er FNV-basert nøkkelhash og Mulberry32; generatoren fryses som del av
  første spillversjon. Endring av rekordgrunnlag krever nye ID-er/avtalt versjon.
- Viking bruker fast fysikksteg på 1/120 sekund og `viking-v3`-balansen i
  `viking-dash/config.js`: fart øker fra 12 til 24 m/s over 1 200 meter, og
  synsfeltet er 40 meter. Hinderavstand beregnes etter forventet fart og et
  tidsintervall, med 28,8 meter som absolutt minimum. Alle fem miljøer og femten
  hendelser finnes. Miljø trekkes hver 250. meter og tones over to aktive sekunder.
  Første hendelse kommer etter 3–5 sekunder; senere pauser er 2–3,5 sekunder,
  eller 3–5 etter intense hendelser. Grafikk og lyd bruker ikke banens RNG.
  Seedversjonen har separate strømmer for bane, miljø, hendelser og hinderutseende;
  samme seed lover ikke samme bane som i tidligere versjoner. Poengenhet og
  katalog-ID er beholdt. Komplett fysisk spillbalanse og hele spesifikasjonens
  kontroll av vilkårlige hinderkombinasjoner er ikke verifisert.
- `viking-dash/scene.js` tegner pikselformer direkte med Canvas-flaten tilpasset
  skjermstørrelse og pikseltetthet, uten oppskalering fra en 480×270-bitmap. Tekst
  og varsler tegnes separat i aktuell oppløsning med lesbar størrelse på mobil.
- Viking har valgfri musikk og lydeffekter via `viking-dash/audio.js`, avslått som
  standard. Et lokalt syntetisert lydspor med melodi, bass og rytme går under
  aktiv spilling; pause, nedtelling og slutt stopper musikken. Hopp, landing,
  dukking, kollisjon og hendelser har egne effekter. Omstart og avslutning rydder
  lydressurser. Styring og varsler er visuelle.
  Viking sender ingen spillstyrt Micro:bit-output. Snake bruker displaybilder.
- Uventet frakobling bevarer den logiske spillsesjonen. Eksplisitt fortsett kreves.
  Faneskygging eller framegap over 250 ms pauser fremfor usett catch-up.
- Ved sesjonsutløp kan samme konto logges inn i pausepanelet uten å miste runden.
  Ferdige forsøk kan også lagres fra Dashboard etter ny innlogging.
- Sene lagringssvar kan oppdatere gammel lagringsstatus, men gir ingen displayeffekt
  i en nyere runde. Dispose avventes ved side-/spillbytte.

Vikings revisjon kontrolleres med `tests/unit/viking.test.js` og
`tests/app/browser/viking.spec.js`: hoppbuffer, B-prioritet, seed-gjentakbarhet,
progresjonsgrenser, miljøoverganger, alle femten hendelser, tegning uten endring av
spilltilstand, lydvalg og pause. Nettlesertesten lager sceneoversikt og skjermbilder
i den ignorerte `build/`-mappen. Disse er visuell kontroll med testdata, ikke fysisk
Micro:bit-verifisering eller en ny full akseptanserapport.

## Testlab

Gyldige tilgjengelige tilstandsoppdateringer fra spillsesjonen er målegrunnlaget;
livsløpsoppdateringer uten input tas ikke opp. Siste gyldige måling beholdes separat.
Mottaksrate viser aksepterte målinger siste sekund, og alder bruker samme monotone
vertsklokke som opptaket. Dette er nettleserens mottaksrate, ikke målt firmwarekadens.

Livehistorikk begrenses til 3000 målinger ved maksimalt 10 Hz og 1000 loggrader.
Opptaksmodulen har sine egne tilsvarende grenser. Grafene brytes ved datagap.
Tellere bygger på `onPress.count` og `onGesture`, ikke observerte knappestater.
Output sendes eksplisitt; redigering gjør ingen enhetskall. Tekst, bilde, tone,
melodi, annonserte lyder, STOP og CLEAR går gjennom samme adapterkø.
JSON inneholder sensorer/hendelser/tap; CSV er sensorhistorikken. Reset tømmer lokale
buffere og forsøker STOP/CLEAR, med synlig feil dersom enheten ikke kan ryddes.

## Gjenstående produktakseptanse

Registrering av katalog, faktisk publisering og samme-origin cookieintegrasjon mot
Parrot gjenstår. Nye spill er derfor bevisst sperret på en backend som bare har
Poengjakt/Sprint-demo. Mocktester er ingen samlet produktgodkjenning.

Fysisk V2, firmwarekombinasjon, 20 instrumenterte latencyforsøk, fem minutters
faktisk UI/USB-langkjøring, heaptrend, aksene og kontrollenes ergonomi må kontrolleres.
Full MS/VD-scenariodekning, hinder-/matbalanse over lange runder og AI-presentasjon
av Snake-kodingen hos backend må også verifiseres før full akseptanse.
