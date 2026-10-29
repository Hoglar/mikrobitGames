# Micro Tetris – test- og akseptanseplan

**Status 2026-10-29:** 23 Tetris-spesifikke Node-tester og fire Playwright-tester er implementert og bestått. Hele kjøringen og dekningsgrensene står i [valideringsrapporten](../../../results/tetris-validation.md). TT-scenarioene er akseptansegrupper med flere delkrav; de er ikke alle fullt godkjent gjennom softwaretester. Fysisk styring, musikkgap og langtids-/latensmålinger gjenstår. [Spesifikasjonen](specification.md), [game design](game-design.md) og [implementasjonsdesignet](implementation-design.md) er fasit. Felles GI/TWEB-/firmwaretester beholdes.

## Lag og testgrunnlag

- Rene motortester injiserer board, brikke, bag/RNG, score og simuleringssteg. Assertions gjelder nøyaktige ruter, rotasjon/kick, hendelser, poeng og faser – ikke bare at skjermen endret seg.
- Integrasjonstester bruker ekte motor med fake input/output, monoton klokke, forsinkede/feilende ACK-er og seed. Lag Web Serial-mock før produksjonsbiblioteket importeres.
- Browser-tester går gjennom dagens spillramme med kontrollerte API-svar, faktisk Canvas/Web Audio-grense og adapterkode. Katalog-ID/metadata skal matche den nye Tetris-profilen, ikke låne en gammel spill-ID.
- Fysiske tester bruker en registrert V2/firmware/browser-kombinasjon. Fravær av hardware merkes SKIPPED med grunn; det hopper ikke over softwaretestene. Instrumentert latency og lydopptak skilles fra operatørens observasjon.

Bagvektorene, spawnformene, kicktabellene, hold-bitmapene og den åttetakters notetabellen er oppgitt i designet. `tests/unit/tetris.test.js` inneholder uavhengige golden-matriser, bag-/scorevektorer og konkrete T-spin-brett; `tetris-output.test.js` dekker klokker, noter og output. Kicktesten bygger kollisjonsbrett fra sine egne forventede matriser/offsets, uten produksjonens geometri. 118 av 120 kandidater testes som første gyldige kick. T 0→1 kandidat 4 og T 2→3 kandidat 3 kan ikke bli første gyldige: når de passer, passer allerede kandidat 1. Testen kontrollerer også disse to forventede unntakene og fullstendig blokkert rotasjon.

## Sporbare scenarioer

| ID | Krav | Kontroller og forventet resultat |
| --- | --- | --- |
| TT-01 | WEB-049 | 10×20 synlig +20 skjulte rader; vegg/gulv/bufferkollisjon, spawn på `(3,-1)` og alle sju former. Spawn-blokkering, hold-blokkering og full lock-out gir ett completed. Test delvis skjult låsing, clear som redder full lock-out og markerte brikkeblokker gjennom radkomprimering. Ingen uendelig venting uten aktiv brikke. |
| TT-02 | WEB-050 | Hver bag er en permutasjon av sju typer; seedvektorer stemmer. Fem previews fornyes korrekt ved spawn/tom hold/bytte. Ghost peker på siste frie posisjon, følger kick/hold og muterer ikke board/RNG. Lyd/resize/particles endrer ikke de neste 1000 typene. |
| TT-03 | WEB-051 | Test X like før/på begge engasjerings- og slippgrenser, direkte retningsbytte og hopp over nøytralområdet. Én første flytting, 170 ms DAS, så 70 ms repetisjon innen ett fast simuleringsstegs kvantisering. Vegg gir ingen oppsamlet bevegelse; pause/nedtelling trenger ferskt slipp/nøytralitet, aldri adapterens unavailable-verdier. |
| TT-04 | WEB-052 | Alle fire CW-overganger for JLSTZ og I, hver av de fem kandidatene som første gyldige, gulv/vegg/stack og failure. Test Y-ned-tegn, rotasjonspivot, ingen tunnellering og O uten forskyvning/lock-reset. Bare vellykket rotasjon gir rotasjonslyd. |
| TT-05 | WEB-053 | A flytter til ghost og låser umiddelbart ved avstand 0/1/maks. `2×avstand` uten nivåmultiplikasjon, bare faktisk nedflytting. Holdt A gjentar ikke. Count>1 eller flere A før samme steg dropper ikke nye brikker. B+A roterer før drop; logo+B+A bruker den definerte rekkefølgen. |
| TT-06 | WEB-054 | Første hold forbruker next; bytte gjør ikke. Hold låses til faktisk lock, også gjennom ny input/recovery. Brikker returnerer med spawnrotasjon/-posisjon, null fallrest og tom spinhistorikk. Ulovlig andre hold har ingen sideeffekter. Test hold-spawn top-out og alle sju bilder. |
| TT-07 | WEB-055 | Fallintervall før/på frist, første grounded delay 500 ms, gyldig/ugyldig reset, lift/fall og reset nummer 15 med lock ved neste grounded-steg. Hard drop overstyrer lock delay. Fjern flere ikke-naborader samtidig og kompakter stabilt. Clear-fase er alltid 150 ms; større animasjon endrer ikke spawn-tid. |
| TT-08 | WEB-056 | Full/Mini i alle T-orienteringer, tre/fire/færre opptatte hjørner, vegg/gulv/skjult rad og kick-test 5. Positiv vertikal/horizontal oversettelse etter rotasjon fjerner kandidat; feilforsøk/null-drop bevarer den. Ingen spin-bonus til andre typer. Full/Mini med 0/1/2 og full med 3 linjer. |
| TT-09 | WEB-057 | Alle poengrader og nivåmultiplikasjon, combo-sekvens, B2B start/bevaring/brudd og perfect clear inkludert skjult restblokk. Bruk konkrete forventninger nedenfor; ingen dobbelttelling av drop eller bonuser. All logikk gir sikre heltall. |
| TT-10 | WEB-058 | Score 0/4999/5000, flere grenser i ett tillegg, 69999/70000 og videre. Nivå 1/8/15 gir 1000/224/50 ms og 90/135/180 BPM. Låsingen scorer med gammelt nivå; neste brikke bruker nytt. Drop/T-spin uten clear kan øke nivå. Fart/tempo går ikke over taket, og UI viser neste grense/maksfart. |
| TT-11 | WEB-059 | Sju ulike stabile farger, typebokstaver, diskret grid, ghost og korrekt hold/next. Hele brettet og viktige HUD-felt leses på desktop/mobil og høy DPI. Resize endrer ikke logisk posisjon/seed; utilstrekkelig plass pauser fremfor å skjule ruter. |
| TT-12 | WEB-060 | Samme nivå: single→klasse 1, double→2, triple→3, Tetris→4, perfect clear→5 uten andre bonuser. Combo/B2B/spin øker etter terskel; drop-poeng påvirker ikke klasse. Klasse gir riktig varighet/partikkelgrense. Samtidige effekter holder totalgrensen. Redusert bevegelse fjerner risting/partikler og beholder tekst/poeng. |
| TT-13 | WEB-061 | Sammenlign alle åtte normative 25-pikselbilder. Tom hold er blank; endring sendes én gang, rask endring koalesceres og recovery resynkroniserer. Kontroller fysisk USB-orientering. Pause beholder hold; Game Over/slutt rydder. Nye rekorder/eldre lagringssvar kan ikke overskrive aktivt hold-bilde. |
| TT-14 | WEB-062 | Alle åtte takter har fire slag, riktige pitch/rest/durasjoner, ≤16 noter og ≤10000 ms. Test løkke 8→1, nivåendring ved taktgrense, volumenhet/mute og høyst én utestående musikkkommando. Fysisk opptak ved 90/180 BPM, nivåendring og hold-trafikk måler faktiske mellomrom; ACK er ikke playback-end. |
| TT-15 | WEB-063 | Vellykket rotasjon, null/positiv hard drop og alle clear-klasser spiller riktig lokal effekt. Separate mute/volumer/defaults og åtte stemmer. Blokkert/unsupported AudioContext gir brukbar status, ingen gameplayfeil og ingen endring av Micro:bit-musikken. Samme seed/input med all lyd av gir samme score/board. |
| TT-16 | WEB-064 | Avbryt start/nedtelling, spill, clear-fase og pause med inputtap/faneskygging/framegap. Board, lock-/fallrest, holdUsed, bag/RNG og score fryses. STOP sendes uten å vente på taktvarighet; ingen stale input. Fortsett krever eksplisitt handling, samme konto, klar input og ny nedtelling; avbrutt takt starter på nytt uten catch-up. |
| TT-17 | WEB-065 | Rangert får ny tilfeldig seed uten manuell overstyring. Øving låser valgt seed, starter identisk igjen og sendes aldri – heller ikke etter modusbytte, seier/tap eller innlogging senere. Startkrav og katalogvalidering beholdes i begge moduser. |
| TT-18 | WEB-066 | Riktig ny UUID/enhet/direction/min/max og scoreformatering overalt. Top-out gir completed; bekreftet avbrudd/nedtellingsavbrudd gir incomplete. Resultat fryses én gang; lik score deler plass uten skjult tiebreak. Restart får egen forsøks-ID mens eldre innsending beholder eier/body. Test tallsikkerhetsgrensen uten wrap/klipping. |
| TT-19 | WEB-067 | Forsinket ACK, device error, resulttimeout, partial write, fysisk loss og sen Promise etter mute/restart/ny session. Ingen automatisk replay eller musikk-/bildeflom, ingen gammel effekt i ny runde, ingen endret score. Outputfeil alene blokkerer ikke innsending; faktisk unavailable input pauser. |
| TT-20 | WEB-068 | Samme logiske inputtrace ved 30/60/144 Hz rendering gir samme spillutfall. Minst fem minutters faktisk UI/USB-kjøring med musikk, hold, klareffekter, pause/restart og resizes; mål minne/køer/late callbacks. 20 instrumenterte inputforsøk og fysisk kontrollergonomi ved nivå 1/mellomnivå/15. |

## Konkrete score- og tidsvektorer

| Oppsett | Forventning |
| --- | --- |
| Nivå 1, vanlig single, første clear, drop 0, ikke PC | +100, combo=0, B2B av |
| Nivå 1, første Tetris, drop 20, ikke PC | +840, B2B på |
| Neste clear Tetris på nivå 1, drop 18, ikke PC | +1286: 1200 base/B2B +50 combo +36 drop |
| B2B på → T-spin uten linjer | Spin-poeng, combo=-1; B2B forblir på, ingen B2B-multiplikator |
| B2B på → vanlig double | +300×L pluss eventuell combo/drop; B2B av |
| Nivå 3, T-spin Double, forrige B2B på, combo blir 2, drop 0, ikke PC | +5700 |
| Nivå 1, første firelinjers perfect clear, drop 0, combo=0 | +2800: 800+2000 |
| Nivå 1, firelinjers PC med B2B-bonus, combo blir 1, drop 0 | +4450: 1200+3200+50 |
| Score 4999 → vanlig single, L=1, drop 0 | 5099; clear bruker L=1, neste brikke L=2 |
| Score 70000+, gjentatte clears | Nivå 15, 50 ms/rute, 180 BPM; score fortsetter |

## Fysisk akseptanse og rapportering

Rapporter TT-ID og PASS/FAIL/SKIPPED med kilde-/regel-/fixtureversjon, browser/OS, Micro:bit-revisjon, firmwareartefakt og målemetode. Merk foreslåtte balanseverdier som utprøvd først når en operatør faktisk har testet dem. Kontroller spesielt at tilt er presis ved maksfart, at logo ikke gir utilsiktet gjentatt hold, og at lav musikkvolum/mute ikke endrer reglene.

Behold felles krav om p95 ≤5 ms fra komplett mottatt linje til adaptercallback ved 50 Hz, og minst 20 instrumenterte knapp/tilt→gamecallback-forsøk med p95 ≤100 ms. Mål også input→synlig handling inklusive DAS separat; en tilsiktet repetisjonsforsinkelse er ikke adapterlatens. Musikk: opptak av minst fem løkker ved hvert tempo med samtidig hold-output, p95 taktgrensegap utover tilsiktede pauser ≤150 ms, samt maksimum/effektiv løkketid og STOP-respons. Audio-ACK alene kan ikke etablere disse resultatene.

Langkjøring skal vise fast 40×10-brett, begrenset bag/next, ≤150 partikler, ≤8 browserstemmer, én musikktimer og ≤2 normale utestående outputkall fra planleggeren. Logg både gjeldende og maksimumsverdier, samt minnetrend etter mange runder. Simulert femminutters tid er ikke en fysisk femminutters soak. Manglende hardware, lydopptak eller instrumentering merkes eksplisitt; ikke senk terskler etter feil.
