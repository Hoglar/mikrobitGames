# Kildekode

Implementasjonen av denne systemdelen. Organiser filer etter ansvar og valgt teknologi. Språk, verktøy og kommandoer for bygging og kjøring dokumenteres i modulens README når de er valgt.

Det felles Micro:bit-biblioteket er implementert som JavaScript ES-moduler under `microbit-input/`, med offentlig import fra `microbit-input/index.js`. Se [brukerveiledningen](microbit-input/README.md) for API, livsløp og kjørekommandoer. Transport, protokoll, input og kommandoer er uavhengige av individuelle spill og frontendrammeverk. Eksemplet under `examples/microbit-input/` bruker samme produksjonskode som spillene skal importere.

`platform/rules.js` inneholder rene regler for rutetilgang, start/pause/fornyelse og eierbundet resultatinnsending. `testlab/recorder.js` inneholder det lokale opptaket med begrensede buffere og JSON/CSV. Dette er testbart grunnlag, ikke en ferdig webapp. Opptak tar flate, allerede validerte felt: temperatureC/lightLevel/soundLevel, aPressed/bPressed/logoPressed, tiltX/tiltY, xMg/yMg/zMg/strengthMg, gesture/soundEvent. Tid leveres som monoton millisekundtid fra samme klokke. Adaptertilstander skal filtreres av Testlab før sample kalles. `snapshot()` og JSON beholder hele sensorraden; CSV bruker de dokumenterte feltene. Hendelser leveres separat.
