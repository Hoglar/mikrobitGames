# Micro Racer – testplan

**Status 2026-10-30:** Testgrunnlag for den lokale implementasjonen. Programvaretester og frosne kontrolltracer er levert; se [valideringsrapporten](../../../results/racing-validation.md) for faktisk kjøring og begrensninger. Fysisk Micro:bit-akseptanse er fortsatt planlagt, ikke dokumentert som bestått.

Test [spesifikasjonen](specification.md), den versjonerte [spillprofilen](game-design.md) og [implementasjonsdesignet](implementation-design.md). Bruk rene enhetstester til fysikk/regler, integrasjonstester til input/motor/ramme og nettlesertester til brukerflyt. API-/Web Serial-mocker beviser ikke faktisk maskinvare eller produksjonssystem.

## Kravdekning

| Test | Krav | Kontroll og forventning |
| --- | --- | --- |
| MR-01 | WEB-069 | Begge formater velges fra samme kassett. Tidskjøring har én fysisk bil; AI-løp har nøyaktig fire. AI-biler fungerer uten backendens AI-tjeneste, også i lokal øving. |
| MR-02 | WEB-070 | Hver av de tre banene kan velges med 1/3 runder. Forhåndsvisning, oppsett og konkurransenøkkel er konsistente. Midtløpsendring er sperret eller krever bekreftet avbrudd; et eksisterende forsøk beholder ID/oppsett. |
| MR-03 | WEB-071 | Kontroller alle tabellparametere og deres versjon. Standardiserte gass-/bremse-/svingtracer viser forskjell i akselerasjon, toppfart og sideveis fart. Samme klasse gir samme bilfysikk for spiller og AI. |
| MR-04 | WEB-072 | X like under/på/over ±0,08 og ±0,75; fortegn og metning er korrekt. Filterets respons følger aktiv simulert tid ved 30/60/144 Hz. Y, lys, lyd og risting endrer ikke rattutslag. Test venstre/høyre ved alle fire verdensretninger. |
| MR-05 | WEB-073 | Holdt B gir vedvarende gass; slipp gir coast. Holdt A bremser uten motordrevet rygging; A+B bremser. `count>1` og mistet kort trykk rekonstrueres ikke som langvarig gass/brems. Ingen menybekreftelse under kjøring. |
| MR-06 | WEB-074 | Hold B/A/logo eller tilt gjennom start, fortsett og reconnect. Ingen kjøring før nytt ferskt nøytralitetsbevis på 100 ms etter GO. Syntetisk unavailable-null og samplegap er ikke gyldig slipp. |
| MR-07 | WEB-075 | Kamera følger heading, ikke velocity, også under sladd. Ved 359°→1° går interpolasjonen korteste vei. Bilens nese ligger opp i visningen; HUD roterer aldri. Minikartets nordretning er stabil og symbolene stemmer med verdensposisjonene. |
| MR-08 | WEB-076 | Samme stegfestede trace gir samme sluttid, runder og plassering ved 30/60/144 Hz rendering. `draw()`/lyd/resize muterer ikke modellen. Ingen NaN/Infinity, ubegrenset catch-up eller tilfeldig resultat fra iterasjonsrekkefølge. |
| MR-09 | WEB-077 | Underlag gir dokumentert grep/fartsreduksjon. Barrierekontakt og gjenoppretting kan ikke krysse vegg eller gi gategevinst. Reset går bak neste gate, nuller fart og bevarer tid/runder/straff. Opptatt spawn venter sikkert; ingen overlapping eller fremoversnarvei. |
| MR-10 | WEB-078 | Første startpassering gir ingen runde; alle porter kreves før mål. Test baklengs mål, linjeforlengelse utenfor gate, senter akkurat på linjen, jitter, to porter i ett steg, store segmenter og 1/3 runder. Teleport/penetrasjonsskyv gir aldri gratis porter. |
| MR-11 | WEB-079 | Nøyaktig tre AI-er, én fast profil og samme bilklasse. Stående start, grid og profilseed er faste i rangert modus. Ingen gummistrikk, ekstra grep/fart eller nettverkskall. AI bremser før sving/barriere og kan fullføre hver bane/bilklasse. |
| MR-12 | WEB-080 | Front-/side-/bak-/flerbilskontakt med lik masse. Swept test ved maksimal relativ fart og tynn barriere hindrer tunnellering. Løseren er stabil og maksimalt fire pass; ingen varig fastlåsing, voksende energi eller dobbel målgang. Fullførte AI-er er ikke fysiske blokkeringer. |
| MR-13 | WEB-081 | Spilleren først, sist, mellom to ferdige AI-er, og lik målgang i samme millisekund. Alle biler behandles i sluttsteget før plassering fryses. AI som ikke er ferdig vises uten oppdiktet tid; lik tid gir delt plass. |
| MR-14 | WEB-082 | GO starter klokken; første oppkjøring og alle runder inngår. Ingen tid i nedtelling/pause; alle biler fryses. Delsteg ved mål og kumulative splittrunder gir én sluttavrunding. 600000 ms godtas; senere målgang gir DNF. Recovery-kostnad kan ikke omgås med pause/restart. |
| MR-15 | WEB-083 | Alle resultatvektorer under. Førsteplass slår alltid andreplass, så lavere tid. Avvis usikre/flyttalls-/negative verdier, plass 0/5 og kodingshull. DNF/avbrutt nedtelling gir `incomplete,null`, aldri en rask fullført rekord. |
| MR-16 | WEB-084 | Kartesisk produkt gir 36 unike lokale nøkler/UUID-er, 18 per format. Katalogregler og aktiv-status valideres før start. Toppliste og personlig rekord følger nøyaktig bane/format/laps/car; sen tidligere forespørsel ignoreres. Ingen gjenbruk av flygende trerundersrunde på én-rundelisten. |
| MR-17 | WEB-085 | Pause/logo/Escape, fysisk loss, skjult fane, framegap og kontotap fryser også AI og delsteg. Reconnect gir ikke automatisk fortsettelse. Samme konto, eksplisitt handling og ny nedtelling kreves der plattformen krever det. |
| MR-18 | WEB-086 | Publisert rangert/øving krever riktig session/katalog/input. Lokalmodus bruker ekte adapter og sender ingen API-kall. Øving sender aldri forsøk, heller ikke etter målgang, DNF, modusbytte eller senere innlogging. |
| MR-19 | WEB-087 | Målgang/kollisjon/timeout i samme steg avslutter høyst én gang. HTTP 201 betyr lagret, ikke automatisk rekord. Mistet svar → identisk eier/ID/body ved retry. Ny runde har ny ID og påvirkes ikke av gammelt lagringssvar. |
| MR-20 | WEB-088 | Restart nullstiller alle fire biler, porter, klokker, gjenoppretting og AI-tilstand. Pause gjør ikke det. Spillbytte midt i asynkron start/cleanup oppretter ikke orphan-session. Fullskjerm avsluttes ved bytte; alle abonnementer og effekter ryddes. |
| MR-21 | WEB-089 | Desktop, 390×844 portrett, landskap og høy DPI/fullskjerm. Ingen klippet HUD, varsel eller kontroll. Tilstrekkelig utsyn ved formelbilfart. Under minimumsflate gis forklaring/pause; ingen endring av fysikk ved resize. Riktig toppliste til høyre/under og bevart chatutkast. |
| MR-22 | WEB-090 | Av/på/volum, blokkert AudioContext, outputfeil og redusert bevegelse gir identisk løpsresultat. Kameraets påkrevde rotasjon beholdes uten dekorativ risting. Display/lyd stopper ved pause/slutt; sene callbacks påvirker ikke neste runde. |
| MR-23 | WEB-091 | Mål maksimum biler, AI-arbeid, kontaktpass, catch-up, hjulspor, partikler, stemmer og outputkø. Ingen full frame-/posisjonshistorikk beholdes. Langkjøring/restart gir ingen stigende minnetrend eller ekstra aktive listeners. |
| MR-24 | WEB-092 | Fysisk V2/USB: bruk begge knapper som gass/brems, tilt, nøytralitet, reconnect og logo. Test alle bilklasser/baner, bremse-/kameraergonomi og AI-konkurranse. Dokumenter latenstid, komfort og balansering; ingen PASS fra bare mocks. |

## Konkrete resultatvektorer

Alle tider er millisekunder. Interne flyttallsdetaljer og kosmetikk er ikke skjulte tiebreakere.

| Oppsett | Forventning |
| --- | --- |
| Tidskjøring, total `83456` | `value=83456`; UI «01:23.456». |
| Tre runder med kumulative tider `30000`, `58000`, `85500` | Splitt `30000/28000/27500`, total `85500`. Bare total sendes til trerundersvarianten. |
| AI-løp, førsteplass, `83456` | `value=83456`; dekodes til plass 1/tid 83456. Katalogen skiller dette fra tidskjøring. |
| AI-løp, andreplass, `70000` | `value=1070000`; rangeres bak enhver gyldig førsteplass, også 600000 ms. |
| AI-løp, tredjeplass, `40000` | `value=2040000`; UI «3. plass · 00:40.000». |
| AI-løp, fjerdeplass ved tidsgrensen | `value=3600000`; dekodes til plass 4/tid 600000. |
| AI-tider `61000`, `62000`, ufullført; spiller `62000` | Spilleren deler andreplass: `P=2`, `value=1062000`. |
| Alle fire fullfører i samme millisekund `62000` | Delt førsteplass; spillerverdi `62000`, ikke skjult grid-/bil-ID-tiebreak. |
| To spillere i samme variant med samme plass og tid | Lik backendverdi og delt topplisteplass etter felles API. |
| `700000`, `1000000`, `1600001`, `4600000` som kodet raceverdi | Avvis; tid/klasse utenfor profilen eller kodingshull. |
| Timeout uten målgang, også med to av tre runder fullført | `status=incomplete`, `value=null`; ingen rekord. Lokal tekst kan vise progresjonen. |
| Avbrudd under første nedtelling | Rangert forsøk avsluttes én gang som `incomplete,null`; øving sendes ikke. |
| Pause i 30 sekunder og ny tresekunders nedtelling | Ingen bil-/AI-bevegelse og ingen ekstra konkurransetid. |
| Gjenoppretting uten venting på opptatt punkt | 2000 ms faktisk aktiv gjenopprettingstid; øvrige biler kjører, ingen fremoverport eller ekstra skjult tidstraff. |

Banefixturer skal i tillegg inneholde gyldig kontrolltrace for hver av de ni bane/bil-kombinasjonene og både 1/3-rundersavslutning. Fysikkfixturer dekker akselerasjon/coast/brems, sladd, kurvatur, asfalt/gress og parvis/flerbilskontakt. Forventede banetider må hentes fra den faktisk implementerte profilen; de skal ikke finnes på i denne planen.

## Fysisk akseptanse og rapportering

Bruk minst én faktisk Micro:bit V2 med dokumentert firmware/USB, browser/OS og profil-/kildeversjon. Kjør tidskjøring og AI-løp på alle tre baner med alle bilene, og minst ett sammenhengende fem minutters forløp med pause, reconnect, restart og fullskjerm. Flere deltester kan dele et forløp, men rapporten må vise hvilke kombinasjoner som faktisk er prøvd.

Behold felles p95-krav: høyst 5 ms fra komplett seriallinje til adaptercallback ved 50 Hz, og høyst 100 ms fra instrumentert fysisk knapp/tilt til spillcallback over minst 20 forsøk. Mål separat tilt→synlig respons, der spillets bevisste 80 ms-filter inngår; ikke trekk filteret fra og påstå samme end-to-end-respons. Rapporter faktisk metode og råmålinger fremfor simulerte latenspåstander.

Utprøv om drift kan kontrolleres, om formelbilens bremsepunkter er synlige, og om roterende top-down-visning er komfortabel over flere runder. Et roterende kamera er avklart funksjon, men kosmetisk risting/overdrevet vinkelutjevning skal kunne fjernes uten å endre fysikk. Noter behov for justering før konkurranseprofilen fryses.

Dokumenter MR-ID, PASS/FAIL/SKIPPED, profil, banefilhash, katalog-ID, fysisk/simulert metode og observerte avvik. Programvaretest, faktisk USB-akseptanse, backendintegrasjon og publisering rapporteres separat. Opprett verifikasjonsrapport når arbeidet er utført; ingen fabrikkert baseline, FoM eller PASS-resultater inngår i denne spesifikasjonen.
