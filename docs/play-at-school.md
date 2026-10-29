# Spill fra skolen

**Adresse: https://parrot.tail106c62.ts.net**

Frontend og backend er publisert sammen. Dere trenger ingen Tailscale-konto og ingen lokal spillserver. Parrot hjemme må være på, våken og tilkoblet internett.

1. Åpne adressen i **Chrome på PC-en**. Nettleseren må støtte Web Serial; [Chrome-dokumentasjonen](https://developer.chrome.com/docs/capabilities/serial) beskriver enhetsvalg og USB-serietilkoblingen.
2. Koble en **micro:bit V2** til PC-en med USB-datakabel. Enheten må ha prosjektets firmware. Hvis den mangler, følg [firmwareveiledningen](../microbit/README.md#flash-and-verify); kopier prosjektets bygde `MICROBIT.hex` til enheten og vent til overføringen er ferdig.
3. Klikk **Koble til micro:bit**, velg enheten og tillat tilkoblingen. Lukk andre programmer som bruker den samme serieporten.
4. Åpne **Testlab** først. Kontroller at A/B og vipping gir utslag. Testlab krever ingen konto.
5. Opprett en konto og logg inn. Passordet skal ha 12–128 tegn. Velg et spill og start når enheten er klar.
6. Fullfør en runde. Se etter bekreftet lagring. **Dashboard** viser dine egne forsøk; **Topplister** i hovedmenyen viser rekorder fra alle spillere. På spillsiden følger **Toppliste for valgt variant** den Snake-varianten du har valgt. Øving lagrer ikke resultater.

Micro Snake, Viking Dash rev. 3, Stjernefangst, Reaksjonsjakt, Balanseløypa og Micro Tetris er publisert. Snake har seks varianter med separate rekorder. To gamle demospill finnes fortsatt i katalogen; en melding om to katalogoppføringer uten kompatibel modul gjelder disse.

Hvis siden ikke åpner, prøv [helseendepunktet](https://parrot.tail106c62.ts.net/api/v1/health). `{"status":"ok"}` bekrefter kontakt med backend, men sier ikke at USB eller AI fungerer. Hvis siden åpner og micro:bit ikke blir klar, kontroller firmware, datakabel, valgt enhet og nettleserens tillatelse. Ved sperret USB-tilgang på administrert skole-PC må skolens IT-ansvarlige tillate den.

[Publiseringskontrollen](../results/verification/frontend-publication-2026-10-29.md) dokumenterer hva som er kontrollert. En faktisk fullført runde med fysisk micro:bit fra skolen gjenstår å dokumentere.

[Oppdateringen med Tetris og Viking Dash rev. 3](../results/verification/games-update-publication-2026-10-29.md) er publisert fra `852e43d`. Oppdater siden etter en avsluttet spillrunde for å laste den nye versjonen.
