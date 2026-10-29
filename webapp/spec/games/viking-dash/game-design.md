# Viking Dash – game design

**Status:** Designrevisjon, 2026-10-29, etter brukerens ønske om skarpere grafikk, musikk, høyere fart og hyppigere hendelser. Tallene er gjeldende balanseverdier til utprøving; fysisk spillbalanse er ikke verifisert. Endringer som påvirker banen skal gi ny spillversjon.

## Bevegelse og kollisjon

Verden måles i virtuelle meter. Vikingen har fast horisontal skjermposisjon, mens verdensposisjonen øker. Kamera og skjermstørrelse skal ikke endre bevegelsesreglene. Ett fysikkoppsett brukes i begge moduser og alle miljøer, også på snø og i uvær.

| Parameter | Foreslått startverdi |
| --- | --- |
| Fart ved distanse `d` | `v(d) = 12 + 12 × min(d / 1200, 1)` meter/sekund: 12 ved start, maksimalt 24. |
| Hopp | Startfart oppover 8 m/s, tyngdeakselerasjon 20 m/s²: høyde 1,6 m og flytid 0,8 s over flat bakke. |
| Inputtoleranse | Ett A-trykk mottatt høyst 100 ms før landing kan utløse neste hopp. |
| Treffområde | Stående: bredde 0,5 m, høyde 1,4 m. Dukkende: samme bredde, høyde 0,65 m. Nederkant følger føttene. |
| Synlig figur | Omtrent 0,6 × 1,6 m stående og 0,6 × 0,8 m dukkende; treffområdet er litt mindre. |
| Reaksjonsmargin | Nytt handlingskrav skal være tydelig synlig minst 1,0 aktivt sekund før siste trygge handlingstid. |
| Handlingsskifte | Minst 0,35 aktive sekunder fra nødvendig landing til neste obligatoriske hopp/dukk. |
| Synsfelt | 40 virtuelle meter, slik at høyere fart fortsatt gir tid til å oppfatte kommende hindringer. |
| Hinderavstand | Fartsavhengig, beregnet fra et valgt tidsintervall på normalt 2,1–2,8 sekunder, under Ragnarok 1,65–2,15 sekunder. Absolutt minsteavstand er 28,8 m, tilsvarende 1,2 sekunder ved maksimal fart. |

Løping og dukking har samme fart. Et hopp følger samme bane selv om A slippes. B i luften forkorter ikke hoppet eller treffområdet. Positiv overlapp mellom figurens og hinderets treffområder gir kollisjon; kontrollen må også oppdage passering mellom to simuleringssteg. Ved grøfter må fotpunktet ha bakke når figuren er på bakken eller lander. Manglende støtte gir fall og avslutter runden, uten poengøkning under en eventuell fallanimasjon.

## Hindertyper og progresjon

Grafiske varianter deler et lite sett logiske former. Skin velges etter miljø/hendelse uten skjulte endringer i treffområdene.

| Type | Grafiske varianter | Foreslåtte former og krav |
| --- | --- | --- |
| Bakkehinder | Steiner, steinblokker, tømmerstokker, stubber, ødelagte kjerrehjul, skjold og falne runesteiner. | Bredde/høyde 0,6/0,4 m eller 1,0/0,7 m. Må hoppes over. |
| Dukkehinder | Greiner, ravner, horisontale piler og lave trebjelker. | Bredde 1,0 eller 1,5 m; treffområde mellom 0,9 og 1,8 m over bakken. Passeres dukkende; øvre kant er høyere enn hoppets fotpunkt på toppen. |
| Grøft | Små grøfter og sprekker. | Bredde 1,5 eller 2,5 m. Krever hopp og sikker landing på andre siden. |

Første versjon lar alle kolliderbare objekter følge verdensbevegelsen. Ravner/piler kan ha enkel animasjon, men får ikke ekstra tilfeldig angrepsfart. Spesialhendelser bruker de samme formene og sikkerhetsmarginene.

| Distanse | Tilgjengelig utfordring |
| --- | --- |
| 0–74 m | Enkle bakkehindringer med romslige mellomrom. Første hinder gir minst reaksjonsmarginen etter nedtelling. |
| Fra 75 m | Dukkehindringer introduseres enkeltvis. |
| Fra 150 m | Grøfter introduseres. |
| Fra 300 m | Sekvenser av hopp og dukking tillates med sikker landing og handlingsskifte. |
| Fra 1 200 m | Maksimal fart. Videre variasjon kommer fra mønstre og hendelser; marginene strammes ikke inn. |

Generatoren kontrollerer hele kombinasjonen, ikke bare avstanden mellom to objekter. En gyldig sekvens må ha minst ett handlingsforløp som kan gjennomføres med hoppbanen, gjeldende/fremtidig fart og reaksjonsmarginene. Den skal ikke kreve samtidige hopp og dukking. Ugyldige forslag forkastes; hvis ingen kandidat blir godkjent innen et begrenset antall forsøk, legges et rolig parti med sikker bakke. Ingen hendelse får overstyre denne kontrollen.

## Miljøer og visuell progresjon

Start i skog, hovedsakelig gråtoner. Velg neste miljø ved hver 250. meter, med en visuell overgang på omtrent to aktive sekunder. Tabellen foreslår relative utvalgsvekter; alle miljøene er tilgjengelige fra første leveranse, men ingen runde er garantert å møte dem alle.

| Miljø | Visuelle elementer | Vekt etter start |
| --- | --- | --- |
| Norsk skog | Grantrær, steiner og enkle terrengsilhuetter. | 15 |
| Fjord og kyst | Fjell, sjø, vikingskip og små bosetninger. | 35 |
| Fjellandskap | Åpent landskap, fjell og snø. | 35 |
| Nordlysnatt | Mørk himmel, stjerner og grønne/blå nordlysfarger. | 10 |
| Mytologisk landskap | Runer, uvanlige himmelfarger og norrøne silhuetter. | 5 |

Bakgrunnen kan ha flere parallaxlag. Et miljøskifte endrer ikke bakken under spilleren, aktive treffområder eller allerede plasserte hindringer. Nye grafiske varianter brukes på kommende objekter. Samme miljø kan trekkes igjen; forbudet mot identisk gjentakelse gjelder spesialhendelser.

Vikingen har 2–4 løpebilder, hopp-, dukke- og kollisjonsanimasjon. Tegn med enkle pikselformer eller små sprites. Hindringer har tydelig kontrast gjennom alle overganger. Snø, tåke, lyn, meteoritter og nordlys ligger bak spillområdet og skal ikke skjule hinderkanter eller gi kraftige skjermblink.

Canvas skal tegne med oppløsning tilpasset faktisk skjermstørrelse og pikseltetthet. Tekst, tall og varsler tegnes skarpt i den aktuelle oppløsningen, med lesbar størrelse også på mobil. Retropreget kommer fra formene og fargebruken; tekst skal ikke forstørres fra en lavoppløst bakgrunnsflate.

## Spesialhendelser og rytme

Første, rent visuelle hendelse velges etter 3–5 aktive sekunder. Senere hendelser velges blant dem som er åpnet av distansen. Bare én hendelse er aktiv; den forrige hendelsens identitet utelukkes ved neste valg, også over miljøskifter. Hendelsene styres av seed og aktiv spilletid, ikke veggklokke eller lydavspilling.

Varighet er 6–9 sekunder for visuelle hendelser og 8–11 sekunder for hinderpåvirkende hendelser. Seed velger en pause på 2–3,5 sekunder etter visuelle hendelser og 3–5 sekunder etter intense sekvenser. Hinderpåvirkning varsles med et kort navn i to sekunder før nye hendelseshindre introduseres. Påvirkningen gjelder bare nye objekter; eksisterende hindringer beholdes etter hendelsens slutt.

| Hendelse | Visuelt uttrykk | Påvirkning / tidligste distanse | Utvalgsvekt |
| --- | --- | --- | --- |
| Nordlys | Rolig bevegelse i grønt/blått. | Visuell; fra åpningen. | 3 |
| Stjerneskudd | Enkel lysstripe over himmelen. | Visuell; fra åpningen. | 3 |
| Meteorregn | Flere små striper i bakgrunnen. | Visuell; fra 80 m. | 2 |
| Solformørkelse | Gradvis dempet bakgrunn. | Visuell; fra 180 m. | 1 |
| Måneformørkelse | Mørkere himmel og måne. | Visuell; fra 180 m. | 1 |
| Tordenvær | Skyer og dempede lyn; valgfri nettleserlyd. | Visuell; fra 80 m. | 2 |
| Snøstorm | Snø i bakgrunnen, uendret grep og sikt til hindringer. | Visuell; fra 80 m. | 2 |
| Tåke | Tåkelag bak spillområdet. | Visuell; fra 80 m. | 2 |
| Dag/solnedgang/natt | Gradvis endring av bakgrunnens palett. | Visuell; fra åpningen. | 3 |
| Tor | Markerte, men dempede lyn og valgfri torden. | Visuell; fra 180 m. | 2 |
| Odin | Hugin/Munin-inspirerte ravner. | Økt andel ravnehindre blant tillatte mønstre; fra 240 m. | 2 |
| Bivrost | Regnbuelignende bro på himmelen. | Visuell; fra 180 m. | 2 |
| Yggdrasil | Stor verdenstre-silhuett. | Visuell; fra 300 m. | 1 |
| Fenrisulven | Ulvesilhuett på fjelltopp under måneformørkelse. | Én samlet visuell hendelse; fra 450 m. | 1 |
| Ragnarok | Rødlige farger, mørk himmel, lyn og meteoritter. | Økt andel gyldige hinderkombinasjoner; fra 600 m. | 0,5 |

Nordlyset som del av miljøets bakgrunn er ikke en ekstra samtidig spesialhendelse. Fenris og Ragnarok er sammensatte hendelser, ikke flere parallelle hendelser. Ingen hendelse endrer fart eller fysikk. Intensitet kommer fra valg mellom godkjente mønstre; den reduserer aldri reaksjons- eller landingsmarginer.

## Musikk og lydeffekter

Valgfri, lokalt syntetisert bakgrunnsmusikk gir en gjentakende retroinspirert melodi med bass og rytme. Musikk spilles under aktiv spilling og stanser ved pause, nedtelling og avslutning. Hopp, landing, dukking, kollisjon og hendelser har egne lydeffekter. Lydvalget gjelder både musikk og effekter, og lydressurser ryddes ved omstart og spillbytte. Varsler skal fortsatt kunne oppfattes med lyden avslått; Micro:bit-høyttaleren brukes ikke.

Gjeldende kodeverdier samles i [config.js](../../../src/games/viking-dash/config.js), med seed- og balanseversjon `viking-v3`. Endret tempo og hendelsesplan gir et annet forløp enn tidligere versjoner med samme seed. Før rangert publisering må det avklares hvordan eksisterende rekorder skal sammenlignes med den nye balansen.
