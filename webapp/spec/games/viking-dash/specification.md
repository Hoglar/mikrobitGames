# Viking Dash – spesifikasjon

**Implementasjon 2026-10-29:** Kode er levert i webappen. Se [implementasjonsnotatet](../../webapp-implementation.md) og [verifikasjonsrapporten](../../../results/webapp-validation.md). Statuslinjen nedenfor beskriver spesifikasjonens opprinnelige baseline; full produkt-/maskinvareakseptanse gjenstår.

**Status:** Avklart funksjonelt omfang og foreslått design, 2026-10-28. Ingen implementasjon eller målinger foreligger.

## Formål og grensesnitt

Viking Dash er en 2D endless runner med enkel pixel art, norsk natur og norrøn mytologi. Vikingen løper automatisk mot høyre; landskap og hindringer beveger seg mot venstre. Spilleren hopper eller dukker for å overleve. Én kollisjon eller fall i en grøft avslutter runden.

Spillet bruker [felles Micro:bit-API](../../../../spec/contracts/microbit-webapp/web-page-developer-interface.md), [frontendkontrakten](../../../../spec/contracts/webapp-backend/contract.md) og [spillplattformen](../../Komponentspesifikasjon_webapplikasjon_forklart.md). Fysikk, hinderregler og hendelseskatalog eies av [game design](game-design.md). Numeriske startverdier der er balanseforslag, ikke målte egenskaper.

## Styring og spillforløp

Knapp A gir ett hopp med fast høyde per nytt trykk. Ingen dobbelthopp eller automatisk hopping ved holdt knapp. Et kort toleransevindu før landing gjør at et tidlig A-trykk kan utløse hopp ved landing. Holdt B gir dukking på bakken. A ignoreres mens B holdes; B endrer ikke hoppbanen, men gir dukking ved landing dersom knappen fortsatt holdes.

Før start og etter eksplisitt gjenopptakelse vises tre sekunders nedtelling. Ved utilgjengelig Micro:bit-input pauses spilltilstand, distanse og hendelsesklokke. Gjenoppretting alene starter ikke runden igjen. Ved tap vises distanse og, i rangert modus, lagringsstatus. A kan starte en ny runde etter at A først er sluppet; omstartstrykket skal ikke samtidig bli et hopp.

## Moduser og resultatregler

| Modus | Seed | Resultat |
| --- | --- | --- |
| Rangert | Ny tilfeldig seed per runde, uten manuell overstyring. | Forsøket sendes til backend og kan gi rekord. |
| Øving | Spilleren kan velge seed som ord eller tall. Samme seed kan brukes igjen. | Distanse vises lokalt; ingen resultatinnsending eller topplistepåvirkning. |

Modus og seed låses ved rundestart. En øvingsrunde kan ikke gjøres rangert etterpå. Samme seed og spillversjon skal gi samme hinder-, miljø- og hendelsesforløp ved samme distanse og aktive spilletid.

Score er `floor(distanse)` i virtuelle meter, og øker bare under aktiv spilling. Det gis ingen ekstra poeng for hindringer eller spesialhendelser. Foreslått katalogmetadata er `score_unit: meters`, `ranking_direction: higher_is_better`, `min_value: 0` og `max_value: 9007199254740991`, innenfor API-ets sikre heltallsområde. Vanlig kollisjon/fall er en avsluttet spillrunde og sendes som `completed`; frivillig avbrudd sendes som `incomplete` med oppnådd distanse. Samme forsøk avsluttes bare én gang.

## Krav og kontroll

| ID | Krav | Test |
| --- | --- | --- |
| WEB-017 | Spillet er en 2D endless runner med automatisk fremdrift og én kollisjon/fall som avslutning. | VD-01 |
| WEB-018 | A/B følger hopp-, dukke- og toleransereglene uten dobbelthopp eller hopprepetisjon ved hold. | VD-02 |
| WEB-019 | Score følger tilbakelagt distanse, avrundet ned; telling fryses utenfor aktiv spilling. | VD-03 |
| WEB-020 | Rangert bruker ny tilfeldig seed; selvvalgt seed er bare tilgjengelig i øving uten resultatinnsending. | VD-04 |
| WEB-021 | Samme seed og spillversjon gir gjentakbar bane, miljøvalg og hendelser. | VD-05 |
| WEB-022 | Ett felles fysikkoppsett gjelder overalt. Farten øker gradvis til et tak. | VD-06 |
| WEB-023 | Definerte hindervarianter og sekvenser skal kunne passeres med avtalte hopp-, landings- og reaksjonsmarginer. | VD-07 |
| WEB-024 | Bakkehindringer, dukkehindringer, grøfter og kombinasjoner introduseres gradvis. | VD-08 |
| WEB-025 | Alle fem miljøer inngår, med skog som start og seed-valgte overganger ved faste distansegrenser. Sjeldne miljøer kan utebli. | VD-09 |
| WEB-026 | Alle beskrevne spesialhendelser inngår. Bare én er aktiv om gangen, uten identisk hendelse to ganger på rad. | VD-10 |
| WEB-027 | Hendelser har varighet, startgrense og varierte pauser. Endret hinderutvalg varsles; hendelser endrer ikke løpefarten. | VD-11 |
| WEB-028 | Retrofigurer, animasjoner og bakgrunnseffekter bevarer tydelige hindringer. Nettleserlyd er valgfri; ingen spillstyrte Micro:bit-effekter. | VD-12 |
| WEB-029 | Start/gjenopptakelse bruker nedtelling; frakobling bevarer rundetilstand uten replay av input ved retur. | VD-13 |
| WEB-030 | Rangert resultat avsluttes og lagres etter API-et; omforsøk bevarer identitet og innhold. | VD-14 |
| WEB-031 | Resultatvisningen tillater direkte omstart etter slipp/nytt A-trykk, med separat håndtering av forrige lagring. | VD-15 |
| WEB-032 | Visning og lyd skal ikke endre spillutfallet. Minnet holdes begrenset og respons testes med fysisk Micro:bit. | VD-16 |

## Samordning med plattformen

Øving uten innsending er et avklart unntak fra plattformens regel om å sende alle spillforsøk. Direkte omstart erstatter obligatorisk navigasjon til Dashboard for dette spillet. Dette må innarbeides i felles spillflyt og tester før integrasjon; dokumentpakken endrer ikke de delte kontraktene.

Øvrige startkrav, blant annet innlogging, aktivt spill og klar Micro:bit, følger plattformen. Det er ikke avtalt anonym øving. Seed og modus er lokale spillinnstillinger, ikke nye felt som kan sendes til dagens resultat-API.
