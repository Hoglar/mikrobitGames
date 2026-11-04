# Spesifikasjon: plugg inn et spill

**Status:** Kravgrunnlag for SDK v1, lokalt implementert 2026-11-04. Se [produktvalgene](README.md#avklarte-produktvalg) og [valideringsrapporten](../../results/cartridges-validation.md) for faktisk dekning og gjenstående database-/maskinvareakseptanse.

## Brukerforløp

**Lag et spill:** Kopier spillmalen til en ny mappe under `webapp/src/games/`, velg ny spill-ID, rediger `game.json`, lag et omslag og skriv `index.js`. Utviklingsserveren oppdager gyldige mapper uten vedlikehold av et register. Nytt spill vises automatisk i kassetthjulet ved katalogoppdatering. Pakking/validering skal ha forståelige feil med filsti og felt.

**Installer delt spill:** Pakk ut ZIP-en til én mappe under `webapp/src/games/`. Plattformen validerer pakken før noe spillkode kjøres. Utviklingsserverens katalogoppdatering viser spillet i samme hjul som medfølgende spill. På en publisert side bygges/publiseres nettstedet på nytt fra de installerte mappene. Nettleseren tilbyr ingen pakkeimport, pakkeopplasting eller lagring av spillinstallasjoner.

**Spill lokalt:** Velg modus og «Lokale rekorder», koble til Micro:bit og start. Etter fullført runde vises score og et frivillig navnefelt med «Lagre lokalt» og «Hopp over». Et navn gir første rekord eller forbedrer eksisterende rekord etter spillets rangeringsregler. «Lavere er bedre» og flere rangeringsfelt støttes. Vis lokal toppliste ved siden av spillflaten på desktop, under på smal skjerm.

**Spill online:** Utrullingsflyten registrerer automatisk topplistene til spillene nettstedets eier har installert. Spilleren logger inn som vanlig for rangerte resultater. Ingen trenger å skrive SQL, endre registerkode eller registrere hver variant manuelt. Lokal installasjon uten backend forblir fullt spillbar og oppretter ikke bakgrunnskall til internett. Kopiering til en lokal mappe installerer ikke spillet på et annet, offentlig nettsted.

## Krav

| ID | Krav og observerbar oppførsel |
| --- | --- |
| WEB-093 | Et nytt SDK-spill skal kunne tilføyes med endringer utelukkende inne i sin egen spillmappe. Ingen endring i sentral JS, CSS, ruter eller manuell katalogregistrering skal kreves. |
| WEB-094 | Spillpakken skal ha standardisert manifest, kodeinngang, rasteromslag og interne ressurser etter [pakkekontrakten](package-format.md). Manifestet skal kunne valideres uten å kjøre spillkode. |
| WEB-095 | Plattformen skal oppdage spillmapper automatisk ved oppstart og katalogoppdatering i utvikling. Statisk publisering skal bruke et automatisk generert katalogmanifest; ingen nettleser skal være avhengig av mappeopplisting. |
| WEB-096 | Deling som ZIP skal dokumenteres som utpakking til en spillmappe, uten importknapp på nettsiden. Pakkeverktøyet skal lage en portabel mappe uten SDK-kopi, hemmeligheter, `node_modules` eller byggverktøy. |
| WEB-097 | Installasjon, oppdatering og fjerning skal skje gjennom spillmappene og kataloggenerering. Endringer skal ikke erstatte kode midt i en aktiv runde; runden beholder sin utgave til den er avsluttet. Fjernede/ugyldige pakker skal gi forståelig feilmelding ved gammel lenke. |
| WEB-098 | Pakke-ID, utgavefingeravtrykk og modus-ID skal gi stabil identitet uavhengig av mappenavn, ZIP-navn, filrekkefølge og komprimering. Ingen pakke skal automatisk overskrive en annen med samme navn eller oppnå tillit ved å etterligne en medfølgende ID. |
| WEB-099 | Manifest- og SDK-versjon skal kontrolleres før start. Ustøttet hovedversjon skal gi forståelig feilmelding uten å forsøke kjøring. |
| WEB-100 | Én dokumentert SDK-inngang skal gi spillet Micro:bit-input/output, spillavgrenset rekordtilgang, resultatavslutning og nødvendige vertstjenester. Spill skal ikke kjenne serialprotokoll, API-ruter, cookies eller databaseskjema. |
| WEB-101 | SDK-et skal bevare dagens Micro:bit-tilstander, knappetellere, gestures, kapabiliteter, outputgrenser og feil. Vertssiden skal eie nøyaktig én fysisk forbindelse og høyst én aktiv spillsesjon. |
| WEB-102 | Spill skal ha standardisert opprettelse, simulering, rendering, pause, fortsettelse og opprydding. Inputtap og skjult fane skal pause; gjenopprettet forbindelse skal aldri automatisk fortsette en runde. |
| WEB-103 | Sandboxen skal hindre importert kode i å lese vertssidens DOM, kontoopplysninger eller lagring. Bare avgrensede SDK-operasjoner skal formidles til verten, bundet til aktiv pakke, modus og runde. |
| WEB-104 | Ugyldige pakker, referanser utenfor spillmappen, ugyldige brokall og sene meldinger fra gamle spill skal avvises uten å skade andre spill/rekorder. Et spillkrasj skal gi en synlig stopp-/byttemulighet. |
| WEB-105 | Det generiske kassetthjulet skal vise manifestets tittel, omslag og kontrollforklaring. Innlasting, spillramme, fullskjerm, pause, lydkontroller og bunnchat skal kunne brukes uten spillspesifikke grener i vertssiden. |
| WEB-106 | Manifestets konkurransevarianter skal bestemme modusvalg og tilhørende toppliste. Bane, bil, runder eller andre valg som påvirker konkurransen skal gi entydig modus-ID. Modus og lagringsmål låses ved rundestart. |
| WEB-107 | Rangeringsregler skal være deklarative, med heltallsgrenser, retning, visningsformat og eventuelt flere felt i prioritert rekkefølge. Verken lokal lagring eller server skal utføre en sammenligningsfunksjon levert av spillet. |
| WEB-108 | Lokalspill skal fungere uten konto, API og katalogregistrering. Klar Micro:bit V2 kreves som i dagens spillplattform; portabel spillkode er ingen lovnad om støtte for Web Serial på alle telefoner/nettlesere. |
| WEB-109 | Etter en kvalifisert lokal runde skal vertssiden vise valgfritt navnefelt og eksplisitt lagre-/hopp-over-handling. Tomt navn skal ikke gi rekord. Feltet og lagringsbekreftelsen skal være tilgjengelige også etter fullskjermspill. |
| WEB-110 | Lokale navn skal trimmes, normaliseres og sammenlignes uten hensyn til store/små bokstaver etter [navnereglene](package-format.md#lokale-navn). Samme normaliserte navn har høyst én rekord per toppliste. Navn er lokale aliaser uten autentisering. |
| WEB-111 | Første lokale score skal opprette rekord; bare strengt bedre score skal erstatte den. Lik/dårligere score skal beholde eksisterende score, visningsnavn og tidspunkt. Oppdateringen skal være atomisk også mellom to faner. |
| WEB-112 | Lokal toppliste skal ha riktig sortering, delte plasseringer og stabil sekundærsortering. Den skal overleve vanlig nettleseromstart og være tydelig merket «Lokale rekorder · denne nettleseren». |
| WEB-113 | Bare fullførte, gyldige scorer skal gi lokal rekord eller navneprompt. Avbrudd/DNF kan vises som resultat, men skal ikke overskrive en rekord. Doble klikk/identiske sluttmeldinger skal ikke gi doble lagringer. |
| WEB-114 | Hvert spill, modus og regelutgave skal ha egen lokal toppliste. Kosmetisk pakkeoppdatering kan beholde rekordene, men endrede konkurranseregler krever ny regelutgave. Appen skal ikke blande lokale aliaser og offentlige kontorekorder. |
| WEB-115 | Ved lagringsfeil eller kvotemangel skal brukeren få sannferdig feil og kunne prøve igjen mens resultatet fortsatt er tilgjengelig. Lokal lagring skal aldri beskrives som sikkerhetskopi eller som delt mellom maskiner. |
| WEB-116 | Brukeren skal kunne eksportere/importere lokale rekorder separat fra spill-ZIP og slette lokale rekorder eksplisitt. Import skal validere, slå sammen etter beste score og være atomisk. Avinstallering av spill skal som standard beholde rekorder. |
| WEB-117 | Bygge-/utrullingsflyten skal automatisk synkronisere topplister for gyldige installerte spill med backend, uten manuell SQL, sentral registerendring eller egen administratorkommando per variant. Gjentatt synkronisering skal gi samme identiteter. |
| WEB-118 | Katalogsynkronisering skal være en betrodd driftsoperasjon, ikke et offentlig klient-API. Online-resultater krever innlogget spiller. Manglende synkronisering skal ikke hindre lokalspill; ingen lokal rekord skal lastes opp automatisk. |
| WEB-119 | Nye online-topplister skal følge manifestets deklarative rangering, inkludert flere felt. Serveren skal validere verdier og oppdatere personlig rekord atomisk; nettleserens påstand om «ny rekord» skal ikke være autoritativ. |
| WEB-120 | Online-resultater skal beholde kontoeierskap, stabil forsøks-ID, idempotente omforsøk og skillet mellom bekreftet og ubekreftet lagring. Manglende nett/konto skal ikke gjøre et onlineforsøk om til et lokalt navneresultat i det skjulte. |
| WEB-121 | Installerte spill skal ikke kunne hente private kontoforsøk, opprette kontoer, velge en annen spillers identitet eller skrive til andre topplister gjennom SDK-et. SDK-lagring skal ikke fremstilles som bevis for manipulasjonsfri konkurranse. |
| WEB-122 | Refaktoreringen skal bevare eksisterende spillregler, kontrolloppsett, pause/recovery, lyd, fullskjerm, gamle lenker og alle eksisterende backend-ID-er/rekorder. Overgangsadaptere skal ikke bli et permanent krav for nye spill. |
| WEB-123 | Leveransen skal inneholde lettlest spillguide, kopierbar mal, manifestskjema, SDK-referanse, validerings-/pakkeverktøy og et eksempelspill som bare importerer SDK-et. Guiden skal skille støttet API fra interne moduler. |
| WEB-124 | Akseptanse skal demonstrere en helt ny spillmappe, pakking og utpakking i en annen ren installasjon, med ekte adaptergrensesnitt og lokale/online-rekorder, uten manuelle integrasjonsendringer utenfor spillmappen etter etablering av plattformen. |

## Avgrensninger

Første pakkeprofil er nettleserkjørbar JavaScript med lokale ressurser. Native programmer, vilkårlig npm-installasjon ved import, eksterne CDN-er, egne serverprosesser og ny Micro:bit-firmware per spill inngår ikke. Eksisterende AI-chat forblir en vertstjeneste; spill kan ikke sende egne SQL-spørringer eller modellverktøy gjennom SDK-et.

«Automatisk» betyr at plattformen utfører nødvendige trinn fra pakken. En statisk publisert nettside kan ikke oppdage endrede serverfiler uten ny kataloggenerering/publisering, og en lokal maskin uten backend kan ikke opprette en faktisk online-toppliste. Disse grensene skal forklares i guiden og i statusvisningen.
