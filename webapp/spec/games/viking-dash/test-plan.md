# Viking Dash – testplan

**Status:** Planlagte tester, 2026-10-28. Ingen kjørbare spilltester eller produktmålinger er levert.

Planen kontrollerer [spesifikasjonen](specification.md), [game design](game-design.md) og [implementasjonsdesignet](implementation-design.md). Felles transport- og plattformoppførsel dekkes også av [adaptertestene](../../game-input-test-plan.md) og [plattformtestene](../../platform-test-plan.md).

## Testgrunnlag

Bruk styrt simuleringstid, faste seed og tidsbestemte inputsekvenser for enhetstester. Fasit må omfatte konkrete hindersekvenser og kollisjonsforløp, ikke bare sammenligning av generatoren med seg selv. Test både kjent gyldige og bevisst umulige baner. Automatisk input brukes bare i tester; fysisk Micro:bit V2 kreves for vurdering av betjening og reaksjonsmarginer.

## Scenarioer og forventede resultater

| ID | Krav | Test og forventet resultat |
| --- | --- | --- |
| VD-01 | WEB-017 | Kollisjon med hvert hinder og fall i grøft avslutter runden én gang. Nesten-treff og korrekt passering fortsetter. En rask passering mellom to steg oppdages fortsatt. |
| VD-02 | WEB-018 | Test korte/holdte A-trykk, dobbelthopp, A+B, holdt B ved landing og `count > 1`. Bare gyldige nye hopp utføres. Trykk 99/100/101 ms før sikker landing kontrollerer toleransegrensen; landing i grøft utløser aldri nytt hopp. |
| VD-03 | WEB-019 | Distanse 123,9 gir score 123. Nedtelling, pause og resultatskjerm øker ikke distansen. Ingen poengbonus for hindringer, og kollisjonsanimasjonen endrer ikke sluttverdien. |
| VD-04 | WEB-020 | Rangert får ny tilfeldig seed uten manuelt seedvalg. Øving tar ord/tall og sender ingen resultater, heller ikke ved tap eller avbrudd. Modus kan ikke byttes etter start. |
| VD-05 | WEB-021 | Samme seed/versjon gir samme bane og hendelsesplan ved ulik tegningsfrekvens, lydinnstilling og pausevarighet. Faste testvektorer kontrollerer seednormalisering og generator. |
| VD-06 | WEB-022 | Kontroller fart ved 0, 600 og 1 200 m mot designets 12/18/24 m/s, og at den ikke øker videre. Hoppets toppunkt/flytid og treffområder er like i alle miljøer og hendelser. |
| VD-07 | WEB-023 | Test alle hindervarianter ved start- og maksimal fart, inkludert grøft etter hopp og dukking etter landing. Generatoren avviser for brede grøfter, utilstrekkelig handlingsskifte og umulige sekvenser. Kandidatgrensen gir trygg bakke, ikke heng eller ugyldig bane. |
| VD-08 | WEB-024 | Kontroller distansene rett før/på hver progresjonsgrense. Ingen dukking, grøfter eller kombinasjoner kreves før de introduseres. Etter maksimal fart beholdes alle sikkerhetsmarginer. |
| VD-09 | WEB-025 | Skog er startområdet. Faste seed dekker alle fem miljøer og runder som utelater sjeldne miljøer. Overganger skjer ved riktige grenser uten fysisk brudd, reset eller endring av aktive hindringer. |
| VD-10 | WEB-026 | Katalogtesten dekker alle hendelser, også sammensatt Fenris/Ragnarok. Ingen overlapper eller identisk gjentakelse over miljøgrenser. Ikke bruk få tilfeldige runder som eneste bevis på sjeldne hendelser. |
| VD-11 | WEB-027 | Første hendelse er visuell og kommer i åpningsvinduet. Senere hendelser følger distansegrenser, varighet og pauseintervaller. Hinderendring varsles før påvirkning; eksisterende objekter forsvinner ikke ved slutt. Fart påvirkes aldri. |
| VD-12 | WEB-028 | Gjennomgå alle miljøer, overganger og effekter med lyd av/på. Hinderkanter og varsler er lesbare; lyn/tåke/snø skjuler ikke banen. Spillet sender ingen egne display-/lydkommandoer til Micro:bit. |
| VD-13 | WEB-029 | Frakoble under hopp, nedtelling og hendelse. Posisjon, score og generator fryses; retur krever eksplisitt fortsett og tre sekunder. Gamle hopp eller frakoblingens nøytrale A-verdi starter ikke handlinger. |
| VD-14 | WEB-030 | Tap/fall gir `completed`; avbrudd gir `incomplete`. Samtidige sluttårsaker gir ett resultat. Nettfeil/ukjent utfall gjentas med samme ID/body og riktig spiller; øving er fortsatt uten sending. |
| VD-15 | WEB-031 | Hold A gjennom tap: ingen omstart. Slipp og trykk gir én ny runde med nedtelling, uten samtidig hopp. Kontroller separat identitet og lagringsstatus når forrige innsending fortsatt venter eller feiler. |
| VD-16 | WEB-032 | Sammenlign spillutfall ved ulik tegnefrekvens og med lyd/effekter av/på. Kjør flere miljø-/hendelsesomløp og spillbytter; antall beholdte objekter og minne vokser ikke med total distanse. |

## Spilltesting og rapportering

Prøv først åpningen og hver ny hindertype, deretter maksimal fart, grøfter, kombinasjoner og Ragnarok. Bruk faste seed for sammenligning og nye seed for variasjon. Registrer om spilleren rekker å oppfatte og utføre handlingene, om kollisjoner oppleves rimelige, og om pausene mellom hendelser gir variasjon uten monotoni. Ikke regn en matematisk mulig bane som dokumentert god spillopplevelse.

Mål input-til-synlig-respons, tegnetid og minnebruk ved normal/maksimal belastning og representative skjermstørrelser. Felles adapterfrister beholdes. Balanseforslag justeres etter observerte problemer, med dokumentert versjon og begrunnelse; funksjonskrav eller reaksjonsmarginer skal ikke svekkes bare for å få en test til å bestå.

Rapporter krav/test-ID, seed, spill-/kontraktversjon, miljø, metode og forventet/faktisk resultat med PASS/FAIL/SKIPPED/BLOCKED. Maskinvaretester uten enhet er SKIPPED; uavklart plattformstøtte gir BLOCKED der den hindrer kontroll. Senere testkode, måleskript og resultater plasseres under henholdsvis `webapp/tests/`, `webapp/verification/` og `webapp/results/`.
