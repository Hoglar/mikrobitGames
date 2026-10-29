# Micro Snake – teoretisk implementasjon

**Status:** Foreslått design, 2026-10-29. Ingen spillkode er levert. [Spesifikasjonen](specification.md) eier krav/rangering og [game design](game-design.md) eier spillregler og balanseforslag.

## Komponentmodell

Spillet bygges med HTML, CSS, JavaScript og Canvas i webappens vanlige bygg. Ingen ekstra programvare hos spilleren utover støttet nettleser og nødvendig Micro:bit-firmware kreves.

| Komponent | Ansvar |
| --- | --- |
| Spillkontroller | Modusvalg, låst rundekonfigurasjon, tilstander, pausemeny, bekreftelser og ett endelig resultat. |
| Snake-logikk | Rutenett, kropp, retning, ventende sving, matvekst, kollisjon og stegtelling. Rene oppdateringer. |
| Matgenerator | Versjonert Competitive-/Random-algoritme og seedtilstand. |
| Resultatregler | Koding/dekoding av mat og steg, gyldighetsgrenser og kobling til riktig spill-ID. |
| Presentasjon | Canvas, menyer, valgfri nettleserlyd og Micro:bit-bilder gjennom adapteren. |

Brettkonfigurasjon inneholder bredde/høyde, startkropp, retning, veggruter og fartskurve. Valider unike, sammenhengende kroppsruter, fri startretning, vegger innen brettet, sammenhengende spillområde og sikre resultatgrenser før start. Skalering av Canvas endrer ikke logisk brettstørrelse.

## Tilstander og input

| Tilstand | Overganger og regler |
| --- | --- |
| Modusvelger/klar | A/B navigerer, A+B bekrefter/start. Felles startkrav må være oppfylt; logo ignoreres. |
| Nedtelling | Tre sekunder uten bevegelse eller opptjening av ventende svinger. Inputbrudd eller logo går til pause. |
| Aktiv | Ett bevegelsessteg om gangen; logo åpner pause. Spillogikken gir tap, seier eller steggrense. |
| Pausemeny | Fortsett gir nedtelling; Restart/Hovedmeny åpner bekreftelse. Logo gir fortsett dersom input igjen er klart. |
| Avbruddsbekreftelse | A/B velger, A+B bekrefter. Avbryt/logo går til pausemenyen. Bekreftet avbrudd fryser et ufullført resultat. |
| Resultat | Vis endelig mat/steg og lagringsstatus. Nytt A+B etter slipp starter ny runde; logo ignoreres. |

Spillplattformen eier forbindelsen; bruk [adapterens inputfasade](../../../../spec/contracts/microbit-webapp/web-page-developer-interface.md). I aktiv spilling bruker A/B `onPress`, mens logo har egen `onPress`-handling. Behandle logo før en eventuell bevegelse i samme oppdatering, og tøm ventende sving ved pause/nedtelling. Holdte A/B repeterer ikke. `count > 1` gir høyst én ventende sving, ikke rekonstruerte historiske trykk.

A+B er bare en bekreftelse utenfor aktiv spilling. Bruk gyldig tilstand med begge knapper holdt; adapteren lover ikke eksakte samtidige fysiske trykktidspunkter. I menyene utsettes enkeltknappens navigasjon til den slippes, slik at en A+B-kombinasjon kan bekrefte opprinnelig markering uten først å flytte den. Et chord forbruker begge knapper frem til begge er sluppet. Etter tilstandsskifte må ny gyldig slipp registreres før ny bekreftelse tillates; frakoblingens nøytrale tilstand teller ikke som slipp.

I aktiv spilling finnes ingen venting på et kombinasjonsvindu. Dersom gyldig tilstand viser begge holdt, ignoreres deres svinghendelser. Ellers vinner første leverte gyldige A/B-hendelse før neste steg; adapterens leveringsrekkefølge er deterministisk, men ikke bevis på fysisk rekkefølge mellom knapper.

Bruk en monoton spillklokke og stegintervall fra fartskurven. Tegning skjer uavhengig. Bevar gjenværende intervall under pause og start det igjen etter nedtelling. Ved skjult fane eller så stort tidsgap at flere steg måtte gjøres uten spillerkontroll, pause fremfor å utføre usette catch-up-bevegelser. Rekordmålet er logiske bevegelsessteg, ikke veggklokketid.

## Deterministisk matplassering

Gi hver rute stabil ID `y × bredde + x`; listen over spillbare ruter er sortert etter ID. Matnummeret starter på null og økes bare etter spist mat.

Foreslått generatorgrunnlag er UTF-8 med FNV-1a 32-bit som nøkkelhash og xorshift32 for deterministiske trekk. Bruk eksakte 32-bit-operasjoner, dokumentert erstatningsverdi for nulltilstand og faste testvektorer før generatoren tas i bruk. Dette er et designvalg, ikke en sikkerhetsmekanisme.

- **Competitive:** Hash den faste strengen `micro-snake/v1/<modus>/food/<matnummer>`. Bruk generatoren til Fisher–Yates-permutasjon av alle statisk spillbare ruter. Velg første ledige rute etter kroppskontroll.
- **Random:** Initialiser en separat generator fra rundens seed. Ved hver matplassering velges en indeks blant den sorterte listen over faktisk ledige ruter. Bruk upartisk heltallsutvalg, ikke modulo med skjev fordeling. Automatisk seed hentes fra nettleserens tilfeldighetskilde; valgte seed normaliseres med trimming og Unicode NFC, med forskjell på store/små bokstaver.

Ingen rutekandidater betyr seier hvis kroppen fyller spillområdet, ellers konfigurasjonsfeil. Unngå gjentatt tilfeldig prøving av opptatte ruter, som blir tregt nær fullt brett. Menyvalg, lyd, API-svar og rendering må aldri forbruke generatorens tilfeldige trekk.

Competitive-nøkkel, generator, brett, fart og resultatkoding er del av spillversjonen. Frys disse før tellende publisering. Endringer som endrer sammenlignbarhet må håndteres som nytt rekordgrunnlag, normalt nye spill-ID-er, fremfor å blande gamle og nye prestasjoner.

## Seks katalogoppføringer og scorepresentasjon

| Lokal kombinasjon | Backendoppføring | Foreslått `max_value` |
| --- | --- | --- |
| standard/competitive | Micro Snake – Standard Competitive | 396 999 999 |
| standard/random | Micro Snake – Standard Random | 396 999 999 |
| fast/competitive | Micro Snake – Hurtig Competitive | 396 999 999 |
| fast/random | Micro Snake – Hurtig Random | 396 999 999 |
| maze/competitive | Micro Snake – Labyrint Competitive | 380 999 999 |
| maze/random | Micro Snake – Labyrint Random | 380 999 999 |

Dette er seks stabile UUID-er, ikke navn brukt som nøkkel. Faktiske ID-er opprettes ved backendregistrering; ingen seeds/migreringer leveres her. Alle bruker `higher_is_better`, `min_value: 0` og foreslått enhet `snake_rank_v1`. Maksverdiene er konservative kodegrenser fra matkapasiteten, ikke påstander om at hver tallverdi er oppnåelig.

Frontend grupperer oppføringene som ett spill med tre hovedmoduser og to undervalg. Riktig UUID låses før start. Selvvalgt Random-seed merkes som øving og går aldri til resultatklienten, selv om brukeren logger inn eller endrer innstillinger senere.

Rangeringsverdien beregnes med sikre heltall uten bitvise 32-bit-triks. Eksempel: 396 mat/2 000 steg gir 396 997 999; samme mat/2 200 steg gir 396 997 799. 395 mat/1 000 steg gir 395 998 999 og rangeres under begge. Formatters funksjon for `snake_rank_v1` dekoder også offentlige topplister, personlige rekorder og privat historikk. Det gjelder ufullførte delverdier når de finnes; de skal fortsatt merkes ufullførte.

Den generelle backendrangeringen krever ikke nye resultatfelt. AI og andre konsumenter som forklarer rekordene må kjenne kodingen; råverdien skal ikke feilaktig omtales som antall matbiter. Formatering og AI-forklaring er integrasjonspunkter før samlet produktvisning, ikke gjennomførte backendendringer.

## Avslutning, lagring og display

Plattformen eier innlogging, sesjonsfornyelse, `attempt_id` og spilleridentitet etter [frontendkontrakten](../../../../spec/contracts/webapp-backend/contract.md). Et rangert resultat fryses én gang med riktig `game_id`, status og kodet verdi. Bekreftet restart etter start, også under første nedtelling, gir ufullført forsøk. Et omforsøk bruker identisk body og eier. Øving beholder bare lokal sluttvisning.

Lagring og visuell avslutning er separate. Vis «avventer lagring» frem til faktisk svar. Bare `outcome: created` gir rekordmarkering; HTTP 201 alene betyr bare at forsøket er lagret. Vis pokal høyst én gang for samme forsøk, og bare mens det fortsatt er rundens resultatpanel og en klar spillsesjon. Et sent svar oppdaterer lagringsstatus, men sender ikke output til en ny runde. Et omforsøk kan returnere tidligere `created`; det skal ikke gi gjentatte pokaler.

Kommandoene går gjennom adapterens displaymetoder. Feil logges/vises uten å blokkere resultatinnsending eller restart. Før ny spillsesjon opprettes avventes gammel `dispose()` slik at gamle kølagte bilder ikke dukker opp senere. Ny runde starter med ryddet display. Ingen automatisk replay etter forbindelsesbrudd.

**Samordning før integrasjon:** Gruppering av seks ID-er, poengformatter, AI-forklaring, lokal øving og direkte restart/retur til Snakes modusvelger må kobles til felles plattform og tester. Personlig rekord på skjermen gjelder én kombinasjon; manglende API-svar skal ikke fabrikkere en rekord. Dagens API verifiserer ikke at klienten faktisk brukte Competitive-reglene.

Hold kropp og matrutelister avgrenset av brettets størrelse. Det er ikke behov for full bevegelseshistorikk. Avslutning rydder timere, lyd og abonnementer; gamle callbacks får ikke endre ny rundetilstand eller dens display.
