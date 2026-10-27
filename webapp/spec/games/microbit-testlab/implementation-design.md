# Micro:bit Testlab – teoretisk implementasjon

**Status:** Foreslått design, 2026-10-27. Teknologi og kildekode er ikke etablert.

Designet bygger på [spesifikasjonen](specification.md) og [det felles Micro:bit-API-et](../../../../spec/contracts/microbit-webapp/web-page-developer-interface.md).

## Komponentmodell

| Komponent | Ansvar |
| --- | --- |
| Inputvisning | Micro:bit-figur, sensorverdier, grafer og tellere. |
| Outputpanel | Redigering, validering, eksplisitt sending og kommandostatus. |
| Opptak | Start/pause/fortsett/stopp, begrensede buffere og eksport. |
| Testlab-styring | Samordning, tilkoblingsstatus, nullstilling og opprydding. |

Siden eier forbindelsen. Testlab mottar input og sender output gjennom én spillsesjon i den felles adapteren. Verktøyet åpnes lokalt fra spillvelgeren og trenger ingen backendregistrering.

## Dataflyt og tilstander

Gyldige inputoppdateringer går til livevisningen og, når opptak er aktivt, til opptaksdelen. Trykk telles gjennom `onPress`, inkludert hendelsens antall; rist telles gjennom `onGesture`. Testlab bruker adapterens tolkninger fremfor egne klassifikatorer.

Opptaket har tilstandene klart, opptak, pause og stoppet. Start oppretter et nytt opptak; fortsett gjenopptar det pausede. Ved forbindelsesbrudd beholdes opptaksstatusen, mens sensormålinger uteblir til gyldige data kommer tilbake.

Siste gyldige input beholdes separat fra gjeldende tilkoblingsstatus, slik at utdaterte verdier kan vises uten å behandles som nye målinger. Outputinnstillinger beholdes ved brudd, men sending krever en klar forbindelse.

## Lagring og opprydding

Opptak bruker buffere med grensene i spesifikasjonen. Eksport bygges fra de bevarte dataene ved nedlasting. Graftegning og antall synlige logglinjer begrenses uavhengig av mottaksraten.

Nullstilling rydder lokale data og sender stopp/tøm gjennom adapteren. Ved frakobling kan fysisk opprydding ikke bekreftes. Ved spillbytte fjernes abonnementer og sesjonen avsluttes med `dispose()` etter den felles kontrakten.

Mottaksrate og tidspunkt for siste gyldige snapshot må samordnes med adapterens diagnostikk før implementasjon. Det offentlige tilstandsabonnementet inneholder også livsløpsoppdateringer, så alle callbacks kan ikke telles som sensormålinger. Testlab skal ikke opprette en egen seriell leser.
