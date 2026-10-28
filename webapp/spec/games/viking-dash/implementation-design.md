# Viking Dash – teoretisk implementasjon

**Status:** Foreslått design, 2026-10-28. Ingen spillkode er levert. Regler eies av [spesifikasjonen](specification.md), balanseverdier og kataloger av [game design](game-design.md).

## Komponentmodell

Spillet bygges med HTML Canvas og JavaScript som en modul under webappen. Grafikk og valgfri lyd følger prosjektets bygg og lastes fra egen adresse. Ingen egen spillmotor eller ny seriell adapter er nødvendig.

| Komponent | Ansvar |
| --- | --- |
| Spillkontroller | Tilstander, rundestart, pause, nedtelling, låst modus/seed og ett terminalt resultat. Samarbeider med plattformen. |
| Spillogikk | Fysikk, spillerens treffområde, kollisjon/fall og distanse. Rene oppdateringer med injisert tid/input. |
| Banegenerator | Seed, miljøvalg, hendelsesplan, hinderforslag og kontroll av passerbare sekvenser. |
| Visning og lyd | Canvas, sprites, bakgrunnslag, varsler og resultatpanel. Leser tilstanden uten å endre fysikken. |

## Rundetilstander og business logic

| Tilstand | Oppførsel og overgang |
| --- | --- |
| Klar | Velg modus og seed. Felles startkrav må være oppfylt før nedtelling. |
| Nedtelling | Vis 3–2–1, frys verden og se bort fra hopptrykk. Avbrudd går til pause. |
| Aktiv | Behandle input, oppdater fysikk/distanse og aktiver planlagte miljøer/hendelser. Kollisjon/fall gir avsluttet runde. |
| Pause | Frys posisjoner, fart, distanse, tilfeldig-generatorens tilstand og hendelsesklokke. Etter klar forbindelse kreves eksplisitt fortsett og ny nedtelling. |
| Avsluttet | Frys endelig distanse og utfall. Vis resultat og separat lagringsstatus. Slipp og nytt A-trykk kan starte neste runde. |

Rangert start krever innlogget spiller, aktivt kjent spill, klar Micro:bit og sesjonsfornyelse etter plattformkontrakten. Øving beholder øvrige startkrav; eneste avtalte unntak er lokal seed og ingen resultatinnsending. Modus kan ikke endres midt i et forsøk. Ny rangert runde får ny seed og forsøks-ID; ny øvingsrunde bruker valgt seed til brukeren endrer den.

Hvert aktivt simuleringssteg behandler først gjeldende B-status, deretter en eventuell A-hendelse, så bevegelse og kollisjon. B sperrer A og tømmer et eventuelt ventende hopp. A fra `onPress` gir høyst én hoppforespørsel per mottatt hendelse, selv når `count` er større enn én; tapte trykktidspunkter kan ikke rekonstrueres som en kø av fremtidige hopp. Hopp i luften forkastes, unntatt ett trykk innen toleransevinduet før forventet landing. Bare faktisk landing på bakke kan utløse det ventende hoppet.

Toleransen måles fra spillets mottak av input, ikke fra en påstått fysisk trykktid. Pause, tap og omstart tømmer ventende hopp. Holdt A starter ikke automatisk hopp etter retur. Slippkravet ved omstart bygger på nye gyldige inputverdier, ikke adapterens nøytrale frakoblingstilstand.

Score beregnes fra aktiv simulert distanse. Kollisjon/fall avslutter en endelig runde som `completed`, også når score er null. Frivillig avslutning etter godkjent rundestart gir `incomplete` med nåværende distanse, også ved avbrutt første nedtelling med distanse null. Når resultatet er frosset kan senere callbacks ikke endre det eller opprette en ny innsending for samme runde.

## Tid, seed og gyldige baner

Bruk et fast simuleringssteg, foreslått 1/60 sekund, uavhengig av tegningsfrekvens. Canvas tegner siste tilstand med eventuell visuell interpolasjon. Store tidsbrudd og skjult nettleserfane skal pause i stedet for å flytte verden forbi usette hindringer. Pause og nedtelling forbruker ikke aktiv tid eller tilfeldige valg.

Seedbehandlingen og tilfeldig-generatoren skal være deterministiske og versjonerte. Foreslått tekstregel er trimming og Unicode NFC-normalisering, med forskjell på store/små bokstaver; tomt felt gir ny tilfeldig seed. Definer en stabil algoritme med faste testvektorer før implementasjon, ikke bruk løpende `Math.random()` til banevalg. Lag separate deterministiske strømmer for hindringer, miljøer og hendelser. Kosmetisk animasjon eller avslått lyd skal ikke påvirke deres trekk.

Bygg en begrenset strekning foran spilleren. For hver kandidat kontrolleres minst én sammenhengende, mulig handlingssekvens fra den allerede godkjente banen gjennom kandidaten og frem til sikker bakke. Kontrollen bruker samme fysikk og eventuelle fartsøkning som spillet, men inkluderer reaksjons- og handlingsmarginene fra designet. Den kontrollerer også møtet mellom gammel bane og nye hendelsesmønstre. Foreslått grense er 20 kandidatforsøk før en trygg bakkeutvidelse velges. Utvalget må ikke tilpasses spillerens feil eller aktuelle knappetrykk; samme seed skal fortsatt gi samme bane.

Avstand mellom hindringer utledes fra handlingstid og aktuell fart, ikke én fast pikselavstand. Ravner, piler og grøfter følger samme godkjenningsløp som vanlige hindringer. Spilleren må kunne se et kommende hinder tidlig nok på alle støttede skjermstørrelser. Resize endrer skalering, ikke verdensmål. Et utilstrekkelig spillområde skal pause og be brukeren justere visningen.

Spillversjonen omfatter også generator, normalisering og balanseverdier. Samme seed lover gjentakbarhet innen denne versjonen. Før balanseendringer brukes rangert må rekordgrunnlaget samordnes, slik at ulike regler ikke uten videre sammenlignes under samme spill-ID.

## Plattform og resultatinnsending

Siden eier forbindelsen, og spillet bruker [adapterens spillsesjon](../../../../spec/contracts/microbit-webapp/web-page-developer-interface.md). Frakobling pauser umiddelbart. Ingen egen handshake, seriell leser eller nye Micro:bit-kommandoer innføres. Vanlig `dispose()`-opprydding gjelder selv om spillet ikke bruker display/høyttaler.

Plattformen eier autentisering, spilleridentitet, forsøks-ID og HTTP etter [frontendkontrakten](../../../../spec/contracts/webapp-backend/contract.md). Rangert resultat sendes som `attempt_id`, `status` og `value`. Seed, modus og spillversjon beholdes lokalt og legges ikke til request-body uten en senere kontraktendring. Dagens API validerer resultatet, men verifiserer ikke at klienten brukte tilfeldig seed eller faktisk spilte runden.

Øving må eksplisitt merkes som lokal ved oppstart, slik at plattformens normale sluttbehandler ikke sender resultatet. Direkte omstart må kunne beholde forrige uendrede, eierbundne resultat til lagring er bekreftet eller feil håndtert. En ny runde har egen identitet; den skal aldri overskrive forrige ventende resultat. Ved ny omstart gjentas felles startkontroll og sesjonsfornyelse. Ved kontobytte kan forrige resultat bare sendes som sin opprinnelige eier.

**Integrasjonspunkter:** Øvingsunntaket og resultatpanel med omstart må samordnes med plattformens sluttflyt og tester før integrasjon. Dette dokumentet endrer ikke felles kontrakter eller innfører en ny resultatstatus.

## Ressursbruk

Frigi passerte hindringer og ferdige effekter; behold bare nødvendig bane foran spilleren. Ingen ubegrenset historikk over tilbakelagt bane. Gjenbruk bilder/lyd og begrens partikler. Ved avslutning fjernes lokale abonnementer, timere og lyd, og spillsesjonen disponeres etter kontrakten. Mål respons, langtidsminne og faktisk Micro:bit-betjening før tallfestede ytelsespåstander.
