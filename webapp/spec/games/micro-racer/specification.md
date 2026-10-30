# Micro Racer – spesifikasjon

**Status:** Avklart hovedomfang og første lokalt implementerte profil, 2026-10-30. Se [beslutningsoversikten](README.md#avklarte-produktvalg) og [valideringsrapporten](../../../results/racing-validation.md). Kravene nedenfor er målgrunnlaget; rapporten skiller programvaredekning fra gjenstående fysisk akseptanse og utrulling.

## Formål og avgrensning

Spilleren kjører en bil rundt en lukket bane, passerer kontrollpunkter i riktig rekkefølge og fullfører valgt antall runder. Det finnes to formater på hver bane: **Tidskjøring**, uten andre biler, og **AI-løp**, med spilleren og tre AI-biler. Begge tilbyr én eller tre runder og alle tre bilklasser. AI-løp har én fast vanskelighetsgrad; det finnes ikke valg av antall motstandere eller skjult nivåtilpasning.

Spillet bygges inn i den eksisterende énsides spillhallen. Bruk [felles Micro:bit-grensesnitt](../../../../spec/contracts/microbit-webapp/web-page-developer-interface.md), [API 0.3.0](../../../../spec/contracts/webapp-backend/contract.md) og [spillrammen](../../webapp-implementation.md). Ingen ny seriell protokoll eller separat nettside inngår. Multiplayer over nett, karrieremodus, oppgraderinger, innkjøp og baneredigering inngår ikke i første profil.

## Valg og start

Én kassett åpner Micro Racer i spillrammen. Startpanelet viser forhåndsvisning og valg for bane, løpsformat, rundetall, bilklasse og rangert/øving. Bilenes grep, akselerasjon og toppfart vises sammenlignbart. Alle kombinasjoner finnes fra starten; ingen opplåsing kreves.

Valgene danner en entydig konkurransevariant og låses ved godkjent rundestart. Bil eller bane kan ikke byttes under et pågående forsøk. Startpanelet viser bare personlig rekord og toppliste for den valgte varianten. Et sent svar for et tidligere valg får ikke overskrive den aktive topplisten. Under runden er valgene låst; tilbake til oppsett krever vanlig bekreftelse på avbrudd.

Rangert spill krever innlogging, aktiv og kompatibel katalogoppføring, klar fysisk Micro:bit V2 og vellykket sesjonsfornyelse. Publisert øving følger de øvrige startkravene, men sender ingen resultater. Utviklingsserverens eksisterende lokale øvingsunntak beholdes: ingen konto, backend, resultater eller AI-chat, men ekte Micro:bit-input. AI-bilene kjøres lokalt og er tilgjengelige også i lokal øving; de er uavhengige av backendens AI-chat/modell.

## Styring

| Input | Handling under aktiv kjøring |
| --- | --- |
| `state.tilt.x < 0` | Styr mot bilens venstre side. |
| `state.tilt.x > 0` | Styr mot bilens høyre side. |
| Hold B | Gi gass kontinuerlig. Slipp B for å rulle med naturlig fartsreduksjon. |
| Hold A | Brems kontinuerlig. Bremsen skal ikke i seg selv starte rygging. |
| Hold A og B samtidig | Brems vinner; ingen gass eller menybekreftelse under aktiv kjøring. |
| Nytt logotrykk, Pause-knapp eller Escape | Pause; logo er ikke drift, boost eller girskift. |

Styring er relativ til bilens lengdeakse, aldri absolutt valg av retning på skjermen. Kontinuerlig tilt og holdte knapper leses fra gyldige tilstander, ikke rekonstruerte knappetellere. `onPress` brukes bare til engangshandlinger som logo/pause. Y-tilt, risting, lys og lydnivå påvirker ikke bilen. Kameraet endrer ikke inputmappingen.

USB holdes øverst og LED-siden vendt mot spilleren. En synlig kontrollforklaring viser A = brems, B = gass og tilt = ratt før start. Enheten må være sluppet og tilnærmet nøytral med fersk, gyldig input før kontrollene armeres. Nedtelling eller frakoblingens syntetiske nullverdier teller ikke som slipp. Ingen automatisk gass fra en knapp som ble holdt i forrige tilstand. Tall for dødsone, filtrering og armering er definert i [spilldesignet](game-design.md#inputprofil).

## Baner, runder og løpsregler

Første forslag er tre faste, versjonerte baner med ulik geometri og vanskelighetsprofil. Hver tilbyr både én og tre runder. Ingen tilfeldig banegenerering, værendring eller skiftende grep finnes i rangerte forsøk.

En runde krever hele den ordnede kontrollpunktsekvensen og deretter målpassering i riktig retning. Den første passeringen av startlinjen fra startoppstillingen starter ikke en fullført runde. Baklengs passering, frem-og-tilbake-kjøring på målstreken eller hopp over kontrollpunkter gir ingen ekstra runde. Hver bil har egen progresjon, også AI-bilene.

Tidskjøring har ingen motstandere eller fysisk ghostbil. AI-løp har tre motstandere i samme bilklasse og med samme bilfysikk som spilleren. Kollisjoner kan påvirke fart og retning, men ingen bil har helse, våpen eller permanent skade. Underlag, barrierer, feil retning og gjenoppretting følger [spilldesignet](game-design.md#underlag-kollisjoner-og-gjenoppretting).

Løpet avsluttes når spilleren fullfører valgt antall runder, også ved andre-, tredje- eller fjerdeplass. AI-biler som ikke har fullført på dette tidspunktet rangeres bak spilleren. Maksimal aktiv kjøretid er foreslått til 600 000 ms. Målgang på grensen godtas; ingen målgang innen grensen gir DNF og `incomplete`.

## Kamera og presentasjon

Kameraet ser rett ned, følger spillerens posisjon og roterer med **bilens retning**, ikke fartsvektoren. Bilens nese peker oppover i kjørevisningen. Ved drifting kan bilen derfor bevege seg sidelengs i bildet selv om nesen peker opp. Kamerainterpolasjon skal følge korteste vinkel over 0°/360° og ikke gi helomdreining ved vinkelskifte.

HUD og menyer roterer ikke. Vis bilklasse, format, bane, runde `nå/antall`, totaltid, aktuell rundetid og fart. AI-løp viser også løpsplassering `nå/4`; et nordorientert minikart viser hele banen, mål og de fire bilene. Farge alene skal ikke identifisere biler eller varsler. Fartsvisning er spillfart, ikke påståtte data fra en virkelig bil.

Bruk den eksisterende retrostilen, spillrammen og fullskjermknappen. Topplisten ligger til høyre på stor desktop og under spillet på mindre skjerm; AI-chatten forblir nederst på siden. Fullskjerm og resizing endrer bare presentasjon. Hele det nødvendige kjøreområdet og HUD må være lesbart; for liten flate gir pause med forklaring. Redusert bevegelse fjerner dekorativ risting, blink og partikler; den brukerdefinerte roterende kjørevisningen beholdes uten ekstra wobble.

## Tid, resultat og topplister

Klokken starter på GO, inkludert akselerasjon fra stillestående og oppkjøring til første startlinjepassering. Tre sekunders nedtelling, pause og fortsett-nedtelling inngår ikke. Alle biler fryses ved pause. Fullført løp rangeres etter **totaltid for hele arrangementet**, ikke beste enkeltrunde. Enkeltrunder vises lokalt; en flygende runde fra et trerundersløp sendes aldri til énrundestopplisten.

Bruk heltall i millisekunder, avrundet opp én gang ved målgang. Separate topplister kreves for hver `(regelprofil, baneversjon, format, rundetall, bilklasse)`. Med tre baner er dette 18 tidskjøringsvarianter og 18 AI-løpsvarianter. Ingen samlet rangering blander bilklasser eller de to formatene.

| Format | Resultatverdi | Katalogregler |
| --- | --- | --- |
| Tidskjøring | `value = T`, totaltid i millisekunder. | `score_unit: milliseconds`, `lower_is_better`, `min_value: 1`, `max_value: 600000`. |
| AI-løp | `value = (P - 1) × 1000000 + T`, med plassering `P=1..4` og tid `T=1..600000`. | `score_unit: racing_rank_v1`, `lower_is_better`, `min_value: 1`, `max_value: 3600000`. |

For AI-løp er `P = 1 + antall AI-biler med strengt lavere fullført millisekundtid enn spilleren`. Like sluttider gir delt løpsplassering, uten skjult bil-ID-tiebreak. Bil-ID kan bestemme stabil visningsrekkefølge. En førsteplass er alltid bedre enn enhver andreplass, uansett tid. Innen samme plassering er lavere tid best. Dekoding: `P=floor(value/1000000)+1`, `T=value mod 1000000`; avvis hull i kodingen. Topplisten viser for eksempel «2. plass · 01:23.456», ikke råverdien `1083456`. Like backendverdier deler rangering etter felles kontrakt.

Bare en gyldig målgang gir `completed`. Timeout, bekreftet restart/retur/spillbytte etter godkjent start, også avbrutt første nedtelling, eller teknisk ugyldig simulering gir `incomplete` med `value: null`. DNF skal aldri kodes som null tid eller en kunstig dårlig fullført plassering. Runden har ett endelig resultat; gamle lagringssvar kan ikke endre neste runde.

Kun rangerte forsøk sendes gjennom eksisterende kø med uforanderlig spiller, spill-ID, forsøks-ID, status og verdi. Øving kan ikke omklassifiseres senere. Backendens bekreftelse styrer lagringsstatus og eventuell rekordmarkering. Resultat-API-et beviser ikke faktisk kjøring; denne spesifikasjonen innfører ikke en serverautoritativ racingmotor.

## Pause og omstart

Pause, inputtap, skjult fane, lang framepause eller tapt kontoeierskap fryser bilene, AI, kontrollpunktprogresjon, klokker, kontaktløsning og eventuelle gjenopprettingsfaser. Inputbrudd er ikke automatisk DNF. Fortsett krever klar input, riktig konto der det kreves, eksplisitt handling og ny nedtelling. Ikke simuler bortfalt tid i etterkant.

Resultatpanelet tilbyr «Spill igjen» med samme oppsett og «Endre oppsett». Ny runde nullstiller alle biler og tids-/rundedata og får ny forsøks-ID i rangert modus. Fortsett fra pause bevarer fysikken; restart nullstiller den. Ingen gass, brems eller logotrykk fra forrige tilstand gjenbrukes.

## Sporbare krav

| ID | Krav | Test |
| --- | --- | --- |
| WEB-069 | Tidskjøring og firebilers AI-løp finnes som to formater i samme spillfamilie. | MR-01 |
| WEB-070 | Hver startbane har én og tre runder, forhåndsvisning og låst variant ved start. | MR-02 |
| WEB-071 | Driftbil, racerbil og formelbil har tydelig forskjellige, versjonerte kjøreegenskaper. | MR-03 |
| WEB-072 | X-tilt styrer relativt til bilens retning med definert dødsone og filtrering. | MR-04 |
| WEB-073 | Hold B gir gass, hold A bremser, A+B prioriterer brems uten historisk replay. | MR-05 |
| WEB-074 | Fersk nøytral input og slipp kreves etter start, pause og inputbrudd. | MR-06 |
| WEB-075 | Kamera følger og roterer med bilens retning; HUD/minikart har stabile referanser. | MR-07 |
| WEB-076 | Fysikk og kontaktløsning er deterministisk med fast tidssteg og begrensede verdier. | MR-08 |
| WEB-077 | Underlag, barrierer og sikker gjenoppretting kan ikke hoppe over baneprogresjon. | MR-09 |
| WEB-078 | Kontrollpunkter, retning og startlinjearmering hindrer falske runder/målgang. | MR-10 |
| WEB-079 | AI-løp bruker tre lokale motstandere med én fast profil og like bilregler. | MR-11 |
| WEB-080 | Bilkontakt håndteres stabilt uten tunnellering, permanent skade eller doble målutfall. | MR-12 |
| WEB-081 | Løpsplassering bygger på gyldig målgang, med delt plass ved lik millisekundtid. | MR-13 |
| WEB-082 | Totaltid, splittider, nedtelling, pause og tidsgrense er entydig definert. | MR-14 |
| WEB-083 | Tidskjøring rangeres på totaltid; AI-løp på korrekt plass/tid-koding. DNF er ufullført. | MR-15 |
| WEB-084 | Alle 36 foreslåtte varianter har adskilte katalog-ID-er og riktig toppliste. | MR-16 |
| WEB-085 | Pause/inputtap/sesjonstap fryser hele løpet; fortsett er eksplisitt. | MR-17 |
| WEB-086 | Rangert og øving følger plattformkrav og lokalunntak uten innsending fra øving. | MR-18 |
| WEB-087 | Resultat fryses/lagres én gang; omforsøk beholder eier, ID og body. | MR-19 |
| WEB-088 | Restart, nytt oppsett og spillbytte rydder gammel motor, input, lyd og output. | MR-20 |
| WEB-089 | Retro-HUD, varsler, minikart og kjøreflate er lesbare på desktop, mobil og i fullskjerm. | MR-21 |
| WEB-090 | Valgfri lyd, display og reduserte effekter endrer ikke bilfysikk eller resultat. | MR-22 |
| WEB-091 | Ressurser, AI-arbeid, kontaktiterasjoner og historikk har faste grenser. | MR-23 |
| WEB-092 | Fysisk V2-styring, latenstid, konkurransebalanse og roterende kamera akseptansetestes. | MR-24 |
