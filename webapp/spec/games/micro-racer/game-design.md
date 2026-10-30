# Micro Racer – spilldesign og første balanseprofil

**Første profil:** `micro-racer-v1`, implementert lokalt 2026-10-30. Tallene er spillverdier til utprøving, ikke realistiske bildata eller fysisk kalibrerte målinger. [Spesifikasjonen](specification.md) eier funksjon og rangering. Banefiler og kjørefysikk skal fryses som et samlet konkurransegrunnlag før tellende publisering; [valideringsrapporten](../../../results/racing-validation.md) beskriver observert programvaredekning.

## Baneforslag

| Bane / lokal nøkkel | Utforming | Spillopplevelse |
| --- | --- | --- |
| Havneringen / `harbor-ring` | Bred, avrundet ring med lang startrett, to store hårnålsvinger og én åpen S-kombinasjon. Asfaltbredde foreslått 14 m. | Nybegynnerbane: lær relativ styring, gass og brems. Lange svinger gjør drift lett å lese. |
| Furudalen / `pine-valley` | Mellomlange rettstrekninger, to ulike hårnåler og sammenhengende middels raske svinger. Asfaltbredde 12 m. | Balansert bane der bremsepunkt og utgangsfart betyr mer enn ren toppfart. |
| Neonhavna / `neon-docks` | Kompakt by-/havnebane med skarpe 90°-svinger, to sjikaner og én lang rettstrekning. Asfaltbredde 10 m. | Teknisk bane med tydelige barrierer; krever kontrollert fart og presise svinger. |

Alle tre er flate, lukkede og kjøres i én fast retning. Ingen brokryss, hopp, løse hindringer, blindveier eller alternative ruter i første profil. Dekorasjoner utenfor banen har ikke usynlig kollisjon. Kantstein gir visuelt spillerom og samme grep som asfalt. Avkjøringsarealer og barrierer skiller seg tydelig fra kjørbar bane.

Hver banefil skal ha: `trackId`, `trackVersion`, verdenskoordinater i meter, kjørbar overflate, barrierer, start-/målgate med fremovernormal, kontrollpunktgater i rekkefølge, fire sikre startplasser, gjenopprettingspunkter, AI-linje og minikartgeometri. Alle gater dekker relevant veibredde. Kontrollpunkter legges før/etter store svinger slik at det ikke går an å hoppe over en hel del av banen. Lengder beregnes fra de faktiske filene; denne spesifikasjonen hevder ingen målte banelengder eller rundetider.

Endelige kontrollpunktskoordinater og tegninger er innholdsleveranser under implementasjon. De må valideres for sammenhengende veibane, sikre startposisjoner, passerbare svinger og rettet gateprogresjon for alle bilklassene før første konkurranseprofil fryses. Hver bane skal kunne fullføres med hver bil uten kontakt med barrierer; dette skal demonstreres med en lagret kontrolltrace, ikke antas fra et skjermbilde.

## Bilprofiler

Samme valgte bilklasse brukes av spilleren og alle tre AI-bilene. Bilene har forskjellige farger/startnumre; fargevalget endrer ikke fysikk. Formelbil betyr her en egen arkadebil med formelbilfasong.

| Parameter | Driftbil | Racerbil | Formelbil |
| --- | ---: | ---: | ---: |
| Motorkraft uttrykt som akselerasjon | 8 m/s² | 10 m/s² | 13 m/s² |
| Toppfart på asfalt | 30 m/s | 36 m/s | 44 m/s |
| Sideveis grep, dempningsrate `g` | 4 s⁻¹ | 8 s⁻¹ | 12 s⁻¹ |
| Bremsereduksjon | 12 m/s² | 16 m/s² | 20 m/s² |
| Akselavstand i styremodell | 2,6 m | 2,6 m | 2,6 m |
| Kollisjonsradius | 1,2 m | 1,2 m | 1,2 m |
| Typisk følelse | Slipper lett sideveis, krever motstyring. | Forutsigbar allroundbil. | Rask akselerasjon og høy fart; krever tidligere planlegging. |

Grep er ikke bare en UI-stolpe: det regulerer hvor fort sideveis fart dempes. Driftbilen må kunne ha tydelig, kontrollerbar forskjell mellom retning og fartsvektor. Ingen automatisk styringsassistent skal skjule forskjellen mellom bilene. Ingen særskilt driftpoengsum eller bonus for hjulspinn inngår.

Masse er lik for alle fire biler i et løp. Første forslag bruker sirkelkollisjon for rettferdig, stabil kontakt; bilens synlige hjul/vinger skal ikke gi misvisende treffområder. Mer detaljert treffgeometri er en profilendring, ikke en kosmetisk justering.

## Inputprofil

Bruk adapterens ferdig normaliserte `tilt.x`; ikke legg til en ny mg-konvertering eller endre firmware. Forslag: dødsone `d=0,08`, fullt ratt ved `|x|=0,75`:

```text
uTarget = sign(x) × clamp((abs(x) - 0.08) / (0.75 - 0.08), 0, 1)
u = u + (uTarget - u) × (1 - exp(-h / 0.08))
```

`h` er ett fast simuleringssteg i sekunder. Filteret er tidsbasert og oppdateres i simuleringen, ikke én gang per tegnet frame. Ingen engangs rotasjon eller automatisk retting til nord. Uten fart roterer ikke bilen på stedet.

Kontroller armeres etter minst 100 ms sammenhengende, ferske, gyldige samples med `|x|≤0,08`, begge knapper sluppet og logo sluppet. Et samplingsopphold over 100 ms bryter nøytralitetsbeviset. Pause/start/inputtap tømmer filterets gamle ønskemål og setter gass/brems til null; bilens lagrede fart og retning fryses, de nullstilles ikke ved vanlig pause. Først ny nøytral input etter GO kan armere neste kjøreperiode. Kalibrerings-/følsomhetsvalg som endrer konkurransefysikken inngår ikke i første rangerte profil.

## Fysikkgrunnlag

Bruk et fast steg `h=1/120 s`. Verden har X mot høyre og Y nedover. Bilretningen `θ=0` peker mot nord (`-Y`), positiv vinkel roterer med klokken. Fremovervektor `f=(sin θ,-cos θ)` og høyrevektor `r=(cos θ,sin θ)`. Positive tiltverdier gir positivt rattutslag.

Tilstand per bil inkluderer posisjon, retning, verdenshastighet, filtertilstand, gateprogresjon og rundetider. Fart skal ikke erstattes av retning × fart ved hver frame; det ville fjernet drifting.

Foreslått oppdateringsrekkefølge, identisk for spiller og AI:

1. Les holdt input. A overstyrer B; ingen knappeteller gir ekstra gass.
2. Projiser verdenshastighet på bilens fremover-/sidevektor. Legg til motorkraft langs `f` når gass er aktiv.
3. Reduser fartsstørrelsen mot null med brems ved A, ellers rulle-/luftmotstand. Brems skal aldri reversere hastighetsvektoren. Rullemotstand foreslås `1 + 0,002 × speed²` m/s² på asfalt.
4. Beregn styrevinkel `δ=u × 0.55 / (1 + |vLong|/18)` rad og dreiehastighet `ω=clamp((vLong / 2.6) × tan(δ), -2, 2)` rad/s. Integrer retning med `θ += ω × h`. Motorstyrt rygging finnes ikke; kort bakoverglidning etter kontakt kan forekomme.
5. Projiser oppdatert verdenshastighet på den nye retningen; demp sidekomponenten med `exp(-g × h)` og sett sammen verdensvektoren igjen. Det er denne gradvise tilpasningen som gir sladd.
6. Håndhev asfaltens maksimale fartsstørrelse og underlagsrespons, beregn kandidatbevegelse, løs barrierer/bilkontakt og kontroller den faktiske bevegelsen mot gater.

Disse tallene er en startprofil, ikke en lovnad om ferdig kjørefølelse. Før implementert profil fryses må konkrete integrasjons-/kollisjonsvektorer dokumentere at bilene oppfører seg forskjellig, ikke genererer energi i kontakt og ikke kan tunnellere gjennom tynne barrierer.

## Underlag, kollisjoner og gjenoppretting

Asfalt/kantstein bruker tabellens grep. Gress/avkjøring foreslås med 45 % sidegrep og ekstra fartsreduksjon på 8 m/s²; over 45 % av asfaltens toppfart brukes ytterligere 16 m/s² reduksjon inntil denne farten er nådd. Ingen umiddelbar teleport eller skjult rundetidsstraff ved berøring av gress. Små hjørnekutt innen de obligatoriske gatene er en del av den faste arkadebanen; store avkortninger stenges av gateplassering og barrierer.

Barrierer sperrer bevegelse; løs kontakt med normal og lav foreslått restitutionskoeffisient 0,1. Bilkontakt bruker lik masse, koeffisient 0,2 og stabil rekkefølge på bilpar. Begrens løseren til fire kontaktpass per steg. Høy fart og tynne vegger krever swept collision/time-of-impact; sluttposisjon alene er ikke tilstrekkelig. Korrigering ved penetrasjon eller gjenoppretting får ikke utløse kontrollpunkter som om bilen hadde kjørt veien.

Ingen auto-reset etter en vanlig feil. Pausemenyen tilbyr «Tilbake til banen» hvis spilleren sitter fast. Forslag: tilbake til siste sikkert passerte kontrollpunkt, null fart og to sekunder låst gjenoppretting mens løpsklokken og øvrige biler går. Kostnaden inngår som faktisk aktiv tid, uten et skjult tidstillegg som kunne endret løpsplasseringen etter målgang. Dette er en egen aktiv tilstand som krever ferskt slipp før kjøring fortsetter. Velges funksjonen fra pause, vis en tydelig bekreftelse og ny nedtelling før den aktive gjenopprettingen starter.

Gjenopprettingspunktet er bak neste påkrevde gate og innen kjørbar bane. Bilplassering må være fri for andre biler; er det opptatt, vent på et trygt vindu mens aktiv klokke går. Ingen usårbarhetsperiode som lar bilen skyve gjennom andre; ingen fremoversnarvei eller nullstilling av straff/tid. AI kan bruke samme regel ved fastkjøring; tidspunktet styres deterministisk av manglende fremdrift, ikke veggklokke.

## Start, gatepassering og tid

Begge formater har stående start og tre sekunders nedtelling. Solo bruker første startplass; AI-løp har en fast 2×2-oppstilling, spilleren bakerst til høyre. Startplasser ligger før målstreken i kjøreretningen, med nok avstand til at fire kollisjonssirkler ikke overlapper. Plassene og AI-identitetene endres ikke fra rangert forsøk til forsøk.

GO starter totaltiden. Startlinjens første passering armerer banens første kontrollpunkt, uten å gi rundetelling. Deretter må alle kontrollpunkter passeres i rekkefølge før start-/målgaten kan fullføre en runde. Etter en fullført runde venter bilen igjen på første kontrollpunkt. Gatepassering bruker den faktiske, kontinuerlige bevegelsen til bilens senter gjennom et endelig linjesegment med riktig fremovernormal. Portens linjeforlengelse utenfor veien teller ikke.

Ved flere gatepasseringer i samme steg behandles de i stigende trefftid langs de fysiske bevegelsesdelene. Baklengs bevegelse forbruker ingen gate. Start på en gate, numerisk jitter og kontaktkorrigering gir ingen nye passeringer. Hver bil kan bare avslutte ett løp, og UI viser feil retning uten å reversere inputmappingen.

Fullføringspunkt innen et steg interpoleres langs den aksepterte bevegelsen. Intern tid er aktive simuleringssteg pluss delsteg, inkludert tid brukt i gjenoppretting. `T=ceil(activeSeconds×1000)` beregnes én gang ved målgang; splittrundetider beregnes fra de samme kumulative målepunktene, ikke ved å summere separat avrundede frames. Pause/nedtelling flytter ingen av disse klokkene. Runde fullført på nøyaktig 600 000 ms godtas.

## AI-profil

Tre deterministiske lokale sjåfører følger en forhåndsvalidert linje med fremoversøk, kurvebasert målfart, bremseplanlegging og enkle sideveis vike-/forbikjøringsvalg. De sender ratt, gass og brems til samme bilfysikk som spilleren. Ingen teleport til racelinjen, ekstra grep, usynlig motorbonus, gummistrikkeffekt eller banesnarvei.

Én synlig vanskelighetsgrad, foreslått navn «Klubbløp». Startverdien for målfart er 80 % av beregnet mulig fart, videre begrenset av svingens kurvatur, bremseavstand, forankjørende bil og fri plass. Bilens faktiske grep, akselerasjon, brems og toppfart endres ikke av AI-en. Samme profil brukes på alle baner/bilklasser; nødvendige baneparametere versjoneres sammen med banefilen.

Rangerte AI-løp bruker en fast profilseed per variant og stabile bil-ID-er `player`, `ai-1`, `ai-2`, `ai-3`. Beslutninger oppdateres på et fast intervall, foreslått hvert sjette fysikksteg (20 Hz), mens fysikken går 120 Hz. Eventuell variasjon i siktpunkt/tålmodighet bruker egen deterministisk strøm. Kosmetikk eller kameratilstand får ikke forbruke denne strømmen. Ingen AI-kall over nett.

Fullførte AI-biler fjernes fra fysisk kontakt etter målgang og kan rulle videre som tydelig ikke-kolliderende resultatsilhuetter. Biler som ikke har fullført når spilleren går i mål vises som «ikke i mål» i det lokale resultatpanelet, ikke med oppdiktet sluttid. Behandle alle fire bilers målpasseringer i det avgjørende simuleringssteget før spillerens plassering fryses.

## Kamera, grafikk og lyd

Bruk en roterende verdensvisning med bilen omtrent 70 % ned fra toppen og et fremoverrettet utsyn. Kamera og tegnet spillerbil bruker samme interpolerte heading, langs korteste vinkel, slik at nesen holder seg oppover uten ekstra rotasjonslagg. Fysikken vet ingenting om kameraet. Minikartet er nordorientert med et roterende bilsymbol; HUD tegnes i skjermkoordinater etter at verdensrotasjonen er tilbakestilt.

Foreslått vertikalt utsyn er 110 m med ca. 77 m foran bilen. Endelig utsyn må verifiseres mot formelbilens stopplengde, inputlatens og de raskeste svingene, samtidig som bilene er lesbare på mobil. Mobil/fullskjerm må ikke zoome så tett at nødvendige bremsepunkter skjules. Endring av utsyn som gir konkurransefordel skal inngå i vurderingen av regelprofilen.

Grafikken bruker lesbar asfalt/kantstein, tydelige bilsilhuetter, startnumre, retningspiler og begrensede hjulspor. Maks 128 hjulsporsegmenter og 64 partikler totalt foreslås. HUD viser sladd visuelt via bil/bevegelse, uten driftpoeng. Formelbilens vinger, driftbilens brede fasong og racerbilens kompakte profil gir gjenkjennelige valg.

Foreslått lyd er valgfri nettlesermotor, dekklyd, korte kontaktlyder og nedtelling/mållyd, med mute/volum. Ingen melodi over Micro:bit-høyttaleren i første profil. Micro:bit-display kan vise nedtelling og målflagg én gang per overgang; ingen fortløpende hastighetsstrøm kreves. UI har samme informasjon. Outputfeil påvirker ikke kjøring eller lagring. Brukeren skal kunne slå av lyd/effekter uten endret kjørefysikk.
