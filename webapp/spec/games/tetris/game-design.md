# Micro Tetris – regler, balanse og presentasjon

**Profil:** `micro-tetris-v1`, implementert 2026-10-29. Dette er den eksakte prosjektprofilen for kode og tester; tallene er ikke fysisk kalibrert. Reglene gjelder identisk i rangert og øving. En endring av brikkefølge, poeng, bevegelse eller progresjon krever versjonering og avklaring av rekordgrunnlaget.

## Brett, brikker og tilfeldighet

Logisk brett har 10 kolonner (`x=0..9`), 20 synlige rader (`y=0..19`) og 20 skjulte spawnrader (`y=-20..-1`). X øker mot høyre, Y nedover. Kollisjon inkluderer vegger, gulv, øvre buffergrense og lagrede blokker. Aktiv brikke/ghost er ikke del av det låste brettet. Ingen garbage eller kaskadefysikk.

Spawn bruker lokalgeometriene nedenfor med origo `(3,-1)`, rotasjon `0`. Spawn-høyden er et eksplisitt valg i denne profilen. J/L/S/T/Z roteres rundt `(1,1)` i en 3×3-boks; I rundt `(1.5,1.5)` i en 4×4-boks. O beholder sitt fotavtrykk og roterer rundt `(1.5,0.5)`; det flyttes ikke ved rotasjon.

| Type | Lokale blokker i spawn | Fargeforslag |
| --- | --- | --- |
| I | `(0,1) (1,1) (2,1) (3,1)` | Cyan `#43d9e6` |
| J | `(0,0) (0,1) (1,1) (2,1)` | Blå `#4e73ff` |
| L | `(2,0) (0,1) (1,1) (2,1)` | Oransje `#ffad42` |
| O | `(1,0) (2,0) (1,1) (2,1)` | Gul `#f6db4d` |
| S | `(1,0) (2,0) (0,1) (1,1)` | Grønn `#63d86a` |
| T | `(1,0) (0,1) (1,1) (2,1)` | Lilla `#c67aff` |
| Z | `(0,0) (1,0) (1,1) (2,1)` | Rød `#f26b6b` |

En bag inneholder nøyaktig én av hver type, blandet med Fisher–Yates fra høyeste indeks ned til 1. Startrekkefølgen før blanding er `[I,J,L,O,S,T,Z]`; bruk prosjektets `shared/random.js` med seed `micro-tetris-v1:${roundSeed}`. Den eksisterende FNV-baserte nøkkelhashen/Mulberry32-generatoren og følgende vektorer fryses som del av denne spillprofilen. Tilfeldighet brukes bare ved bagblanding. Samme seed og tidsbestemte spillinput gir samme spill, uavhengig av grafikk, lyd, nettverk og framefrekvens.

| `roundSeed` | Bag 1 | Bag 2 | Bag 3 |
| --- | --- | --- | --- |
| `demo` | O Z J L S I T | J I S Z L T O | Z L J S T O I |
| `practice-1` | L Z S I O J T | T I J Z S L O | T L Z I J S O |

Next viser de fem neste typene i korrekt rekkefølge i spawn-orientering. Første tomme hold forbruker neste type; senere holdbytte forbruker ingen next-brikke. Ghost er den lengste kollisjonsfrie vertikale nedflyttingen fra aktiv posisjon, med samme rotasjon; den oppdateres etter hver transformasjon og gir ikke kollisjon, poeng eller RNG-trekk.

## Rotasjon: SRS med klokken

Tilstander går `0 → R → 2 → L → 0`. Først roteres lokalt med `(x',y')=(cx-(y-cy), cy+(x-cx))`. Prøv deretter oversettelsene i tabellens rekkefølge relativt til denne grunnrotasjonen; første frie kandidat velges atomisk. Alle tabeller her har **Y positiv nedover**, også kicks. Feil på alle fem gir helt uendret brikke og ingen rotasjonseffekt. Ingen ekstra improviserte offsets eller 180°-kicks.

| J/L/S/T/Z | Test 1 | Test 2 | Test 3 | Test 4 | Test 5 |
| --- | --- | --- | --- | --- | --- |
| 0→R | `(0,0)` | `(-1,0)` | `(-1,-1)` | `(0,2)` | `(-1,2)` |
| R→2 | `(0,0)` | `(1,0)` | `(1,1)` | `(0,-2)` | `(1,-2)` |
| 2→L | `(0,0)` | `(1,0)` | `(1,-1)` | `(0,2)` | `(1,2)` |
| L→0 | `(0,0)` | `(-1,0)` | `(-1,1)` | `(0,-2)` | `(-1,-2)` |

| I | Test 1 | Test 2 | Test 3 | Test 4 | Test 5 |
| --- | --- | --- | --- | --- | --- |
| 0→R | `(0,0)` | `(-2,0)` | `(1,0)` | `(-2,1)` | `(1,-2)` |
| R→2 | `(0,0)` | `(-1,0)` | `(2,0)` | `(-1,-2)` | `(2,1)` |
| 2→L | `(0,0)` | `(2,0)` | `(-1,0)` | `(2,-1)` | `(-1,2)` |
| L→0 | `(0,0)` | `(1,0)` | `(-2,0)` | `(1,2)` | `(-2,-1)` |

O har bare `(0,0)`, samme fotavtrykk og ingen kick-/lock-reset; en B-aktivering kan gi den vanlige rotasjonslyden. Brikkenes standardgeometri og klokkeretningsdata kan kryssjekkes mot utviklernes egne [Piece-data](https://github.com/nullpomino/nullpomino/blob/master/nullpomino-core/src/main/java/mu/nu/nullpo/game/component/Piece.java) og [StandardWallkick](https://github.com/nullpomino/nullpomino/blob/master/nullpomino-core/src/main/java/mu/nu/nullpo/game/subsystem/wallkick/StandardWallkick.java). Bare rotasjon med klokken eksponeres i denne kontrollprofilen; tre slike forsøk lover ikke samme kicks som én motklokkerotasjon.

## Hold, fall, låsing og tap

Hold er tom ved start. Logo lagrer aktiv type og spawner neste når hold er tom; ellers byttes typene. Innkommende brikke får spawn-posisjon/rotasjon, null fallrest, ny lock-timer og tømt rotasjonshistorikk. `holdUsed` settes og tillater ikke enda et bytte før innkommende brikke faktisk låses og neste ordinære brikke spawner. Hold resetter ikke combo/B2B og gir ingen poeng. Et bytte som ikke kan spawnes gir top-out; det rulles ikke tilbake for å gi et nytt forsøk.

Gravitasjon flytter én rute per intervall fra fartskurven; den hopper ikke over kollisjoner. Ved bakkekontakt brukes 500 ms lock delay. En vellykket horisontal flytting eller rotasjon som endrer fotavtrykk, startet mens brikken var grounded, kan nullstille delay, høyst 15 ganger per aktiv brikke. Feilforsøk og O-rotasjon nullstiller ikke. Ved reset nummer 15 låses brikken på første grounded simuleringssteg, også om en kick først løftet den. Lufttid teller ikke som grounded delay; nye kontakter før resetgrensen starter 500 ms igjen. Resetantallet beholdes gjennom løft/fall. Hard drop låser alltid umiddelbart, også ved avstand null.

Ved låsing vurderes T-spin og antall fulle rader på brettet med brikken lagt inn, **før radene fjernes**. Alle fulle rader fjernes samtidig; resten kompakteres ned, med tomme rader på toppen. Deretter vurderes perfect clear, poeng og top-out. Linjerydding har 150 ms fast logisk fase uten aktiv brikke; input i fasen forkastes. Større kosmetiske effekter kan fortsette over neste brikke, men forlenger ikke fasen. Ingen vanlig spawn-forsinkelse utover denne fasen.

Top-out skjer ved kollisjon i spawn (også hold-spawn), ved full lock-out eller ved forsøk på lagring utenfor øvre buffer. Full lock-out vurderes etter eventuell radrydding/komprimering: minst én blokk fra den nylig låste brikken gjenstår, og samtlige gjenstående blokker fra den er over synlig rad 0. Blokker som er ryddet bort teller ikke; dersom alle fire er fjernet, er det ingen lock-out. Minst én gjenstående synlig blokk er nok til å unngå full lock-out. Spor disse fire blokkenes fjerning/komprimerte posisjoner. Dette er profilens eksplisitte top-out-variant. Et spillertap er `completed`, ikke teknisk feil.

## T-spins og Mini

Ved låsing av T kreves både en bevart siste vellykket rotasjon og minst tre opptatte diagonale hjørner rundt T-pivoten. Sidevegger, gulv og øvre buffergrense teller opptatt; ledige skjulte ruter teller tomme. En vellykket celleoversettelse etter rotasjonen (horisontalt, gravitasjon eller hard drop over minst én rute) fjerner rotasjonsmarkøren. Feilforsøk og null-avstands hard drop bevarer den. Hold/spawn nullstiller markøren. Dette fastsetter også tilfellene der spillets ulike T-spin-varianter ellers kunne vært tvetydige.

Front er retningen til T-ens utstikkende blokk: opp i 0, høyre i R, ned i 2 og venstre i L. Begge front-hjørner opptatt gir full T-spin. Ellers er resultatet Mini, bortsett fra når siste rotasjon brukte **test 5** i T-kicktabellen: da oppgraderes det til full. Et eventuelt trelinjers T-spin-utfall klassifiseres alltid full, aldri Mini Triple. Vanlige bevegelser med J/L/S/Z gir ingen spin-bonus.

## Poeng, combo og back-to-back

`L` er nivået **før låsingen og dens poengtillegg**. Grunnverdiene nedenfor multipliseres med L. Poeng for hard drop er separat `2 × faktisk falt antall ruter`, uten nivå-/combo-/B2B-multiplikator. Det finnes ingen soft-drop-kontroll eller poeng for automatisk fall.

| Hendelse | Grunnpoeng |
| --- | ---: |
| Single / Double / Triple / Tetris (4 linjer) | 100 / 300 / 500 / 800 |
| Mini uten linje / Mini Single / Mini Double | 100 / 200 / 400 |
| Full T-spin uten linje / Single / Double / Triple | 400 / 800 / 1200 / 1600 |

Combo starter på `-1`. Hver påfølgende låsing med minst én rad øker telleren med én; første clear har combo 0 og null combo-bonus. Bonus er `50 × combo × L`. En låsing uten clear resetter til `-1`, også et poenggivende T-spin uten linjer. Hold og tid uten låsing påvirker ikke combo.

Et vanskelig clear er fire linjer eller et T-spin/Mini med minst én linje. Det starter/bevarer B2B. Hvis B2B allerede var aktiv, multipliseres **bare hendelsens grunnpoeng** med 1,5. Et ordinært 1–3-linjers clear bryter B2B; en låsing uten clear bevarer den. Ingen B2B-bonus til et spin uten linjer.

Perfect clear krever at hele brettet, inkludert skjulte rader, er tomt etter et clear. Tillegget er `800/1200/1800/2000 × L` for 1/2/3/4 linjer. Et firelinjers perfect clear som også mottar B2B bruker `3200 × L` i stedet for `2000 × L`. Dette kommer i tillegg til grunn-, B2B- og combo-poeng, uten å multipliseres videre.

```text
lockDelta = (base × (b2bBonus ? 1.5 : 1) + 50 × max(combo,0) + perfectBase) × L + 2 × dropDistance
```

`b2bBonus` er sann bare når det aktuelle clear er vanskelig og B2B allerede var aktiv. `base` og `perfectBase` er 0 når ingen relevant hendelse/PC finnes; `dropDistance` er 0 ved naturlig låsing. Ingen avrunding er nødvendig for disse heltallsverdiene. Samtidige bonuser gir ett atomisk poengtillegg. Eksempler uten perfect clear: første Tetris på nivå 1 med drop 20 gir 840; neste Tetris med combo 1, B2B og drop 18 gir 1286. T-spin Double på nivå 3 med B2B, combo 2 og drop 0 gir 5700. Tabellen er en valgt moderne poengprofil; prosjektets drop-/perfect-clear-regler er eksplisitte. Den [offisielle nettutgaven](https://play.tetris.com/games/) og utviklernes [MarathonMode](https://github.com/nullpomino/nullpomino/blob/master/nullpomino-core/src/main/java/mu/nu/nullpo/game/subsystem/mode/MarathonMode.java) er referanser, ikke levende avhengigheter som kan endre denne profilen.

## Poengstyrt progresjon

```text
level(score) = min(15, 1 + floor(score / 5000))
gravityMs(L) = round(1000 × (50 / 1000)^((L - 1) / 14))
musicBpm(L) = 90 + round(90 × (L - 1) / 14)
```

| Score fra | Nivå | Fallintervall | Musikk |
| --- | ---: | ---: | ---: |
| 0 | 1 | 1000 ms/rute | 90 BPM |
| 5000 | 2 | Beregnet formel | 96 BPM |
| 35000 | 8 | 224 ms/rute | 135 BPM |
| 70000 | 15 (tak) | 50 ms/rute | 180 BPM (tak) |

Ny score kan hoppe over flere grenser. Beregn nytt nivå én gang etter hele låsingstillegget; neste brikke bruker ny fart. Lock delay, tilt/DAS og linjeryddingsfase endres ikke med nivå. Musikk tar neste nivåtempo fra neste takt; pitch beholdes. Høyere linjetall alene gir ikke nivåøkning. Verken oppnådd nivå eller musikktempo synker under en runde.

## Retrovisning og klareffekter

Canvas bruker tydelige rutekanter, ensfargede blokkflater med enkel pixel-shading og stabile typefarger fra tabellen. Ghost bruker kontur/lav fyllstyrke og skiller seg fra låste blokker. Hold/next viser også typebokstav. HUD viser score, nivå, linjer, combo/B2B ved aktivitet og «maksfart» ved nivå 15. Tilpass skala og HUD på mobil uten å skjule deler av brettet; for lite spillområde pauser i stedet for å beskjære skjulte farer.

Effektverdien er linje-/spin-/combo-/perfect-clear-poeng **uten drop-poeng**, dividert med L. Nivåmultiplikatoren alene endrer ikke betydningen av samme clear. Velg høyeste terskel som treffes, med minst klasse lik antall ryddede rader (maks fem klasser):

| Klasse | Terskel | Maks partikler | Risting | Kosmetisk varighet |
| --- | ---: | ---: | ---: | ---: |
| 1 | 0 | 20 | 0 px | 180 ms |
| 2 | 300 | 40 | 1 px | 240 ms |
| 3 | 500 | 70 | 2 px | 320 ms |
| 4 | 800 | 110 | 4 px | 400 ms |
| 5 | 1600 eller perfect clear | 150 | 6 px | 500 ms |

Et vanlig single er klasse 1 og Tetris klasse 4 ved samme nivå uten bonuser. Vis «Single/Double/Triple/Tetris», «T-spin/Mini», «B2B», combo og `+poeng` fra samme låseresultat. Ingen linjeeffekt uten linjer; spin uten clear får kort tekst/poengmarkering. Maks 150 levende partikler totalt, også ved overlapp; kosmetisk RNG har separat strøm. Redusert bevegelse fjerner risting/partikler og erstatter puls med stabil ramme/tekst. Effekter er ikke en logikkpause.

## Micro:bit-display: hold

Bruk brightness 9 for blokker, 0 ellers, radvis med USB øverst. Beskjær spawnformen til minste boks og sentrer med `floor((5 - bredde)/2)` og tilsvarende Y; partallsbredde/høyde får overskytende marg til høyre/nederst. Normaliser orienteringen ved hvert holdbytte. Disse fem radstrengene er normative fixtures:

| Hold | Rader fra øverst til nederst |
| --- | --- |
| Tom | `00000 / 00000 / 00000 / 00000 / 00000` |
| I | `00000 / 00000 / 99990 / 00000 / 00000` |
| J | `00000 / 09000 / 09990 / 00000 / 00000` |
| L | `00000 / 00090 / 09990 / 00000 / 00000` |
| O | `00000 / 09900 / 09900 / 00000 / 00000` |
| S | `00000 / 00990 / 09900 / 00000 / 00000` |
| T | `00000 / 00900 / 09990 / 00000 / 00000` |
| Z | `00000 / 09900 / 00990 / 00000 / 00000` |

Vis blankt ved rundestart, oppdater ved faktisk holdendring og synkroniser én gang ved fortsett etter recovery. Pause kan beholde bildet; Game Over/avslutning rydder displayet. Ingen kontinuerlig bildeutsending per snapshot/frame eller pokal fra sent lagringssvar.

## Musikk og nettlesereffekter

Micro:bit spiller en lokal, egen monofonisk transkripsjon av Korobeiniki-hovedmelodien. Ingen lydopptak fra andre spill eller eksterne nettressurser lastes. Første profil bruker denne åttetakters, gjenkjennelige løkken i 4/4. `note:slag`, `R` er pause; C4 er MIDI 60 og A4 = 440 Hz:

```text
1: E5:1 B4:0.5 C5:0.5 D5:1 C5:0.5 B4:0.5
2: A4:1 A4:0.5 C5:0.5 E5:1 D5:0.5 C5:0.5
3: B4:1.5 C5:0.5 D5:1 E5:1
4: C5:1 A4:1 A4:1 R:1
5: D5:1.5 F5:0.5 A5:1 G5:0.5 F5:0.5
6: E5:1.5 C5:0.5 E5:1 D5:0.5 C5:0.5
7: B4:1 B4:0.5 C5:0.5 D5:1 E5:1
8: C5:1 A4:1 A4:1 R:1
```

Frekvens er `round(440 × 2^((midi-69)/12))`; R gir 0. Varighet er `round(slag × 60000/BPM)` ms per note. Én takt sendes som én `playMelody`, 4–6 noter og omtrent 1,33–2,67 sekunder, innen grensen 16 noter/10000 ms. Standard musikkvolum er 96/255, justerbart 0–255. Muting stopper høyttaleren, ikke bare fremtidige noter. Pause husker neste ikke-fullførte takt og spiller denne fra starten etter fortsett; den sender ikke gamle noter som catch-up. Takten kan dermed gjentas delvis etter pause.

Dagens API gir ingen løkke- eller ferdigmelding. Planleggingen og mål for mellomrom står i [implementasjonsdesignet](implementation-design.md#output-og-musikkplanlegging); sømløs avspilling er ikke en eksisterende kontraktgaranti. Tempo endres ved neste taktgrense, uten å endre tonehøyde eller avbryte gjeldende takt.

Nettleseren bruker lokal Web Audio-syntese: kort klikk/tone for akseptert rotasjon (ca. 35 ms), fall/smell ved hard drop (ca. 80 ms), og stigende akkord/sveip etter clear-klasse (120–450 ms). Feilet rotasjon spiller ingen effekt. Maks åtte samtidige effektstemmer; rydd eldste ved overskridelse. Mastervolum starter på 0,2 (0–1). Effekter og Micro:bit-musikk har egne mute/volumvalg; lyden er aldri eneste feedback for handling eller bonus.
