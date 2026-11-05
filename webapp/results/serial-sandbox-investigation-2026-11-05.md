# Undersøkelse av micro:bit-feil etter sandbox-refaktorering

**Dato:** 2026-11-05. **Grunnlag:** `2c209f2` og lokal arbeidskopi med arbeidet på felles lydkontroller. Brukeren observerer feil umiddelbart etter tilkobling og enkelte opphold/frakoblinger under spilling. Fysisk enhet er ikke undersøkt i denne kjøringen.

To feilforløp er reprodusert og rettet i frontend. Det første forklarer falske «Malformed JSON»-meldinger ved tilkobling/gjenoppretting; det andre er en regresjon i hvordan sandbox-verten reagerer på kortvarig inputtap. Dette beviser ikke årsaken til alle faktiske USB-avbrudd eller at sandboxen alene har økt antallet avbrudd.

## 1. Gamle JSON-fragmenter tolkes som nye meldinger

Firmware kan fortsatt strømme når en ny side åpner porten. Første lesing kan da starte midt i en gammel sensorlinje. Adapteren tømmer også sin linjebuffer ved gjenoppretting, selv om resten av den gamle linjen fremdeles kan komme fra den åpne porten. Den gamle koden forsøkte å JSON-parse disse restene før den nye `deviceInfo`-barrieren var mottatt.

Deterministisk reproduksjon med produksjonsadapteren, fake transport og klokke:

| Forløp | Før rettingen | Etter rettingen |
| --- | --- | --- |
| Åpne port med slutten av en gammel JSON-linje før gyldig `deviceInfo` | `Malformed JSON`, selv om tilkoblingen lykkes | Gammel rest forkastes; én handshake og klar forbindelse |
| Gyldig hel JSON-linje etter 600 ms blokkert nettlesertid | `Sensor input became stale`; ny handshake | Samme nødvendige friskhetsgjenoppretting |
| Samme gyldige linje delt før/etter pausen | Friskhetstimeout **og** `Malformed JSON` | Bare friskhetstimeout; ingen falsk JSON-feil eller historiske trykk |
| Ugyldig JSON etter mottatt `deviceInfo` | Protokollfeil; ingen oppdatert friskhet | Samme strenge avvisning |

Rettingen i [`adapter.js`](../src/microbit-input/adapter.js) forkaster pre-barriere-fragmenter mens den venter på komplett metadata. Metadata går fortsatt gjennom streng validering, inkludert duplikate nøkler og kapabiliteter. Etter barrieren gjelder vanlig JSON-/sensorvalidering. Brudd på protokollen under aktiv forbindelse skjules ikke.

Feilen i grensehåndteringen fantes før sandbox-refaktoreringen. Den forklarer rapporterte feilmeldinger uten at bytes fra firmwaren trenger å være feil. Undersøkelsen måler ikke hvor ofte fysisk tilkobling faktisk starter midt i en linje.

## 2. Rask recovery kunne gå ubemerket gjennom spillverten

Den gamle spillverten pauset direkte i inputabonnementet når `inputAvailable` ble usann. Etter refaktoreringen tok sandboxen imot tilstandsendringen, mens sidens spillcontroller kontrollerte forbindelsen ved polling hvert 150 ms. En recovery som både begynte og sluttet mellom to slike kontroller kunne bli oversett.

En browser-test utløste en lesefeil i native Web Streams-mocken. Før rettingen ble en ny handshake fullført med samme portvelger, mens Snake fortsatte å kjøre og nådde resultatfasen i stedet for pause. Etter rettingen pauser verten direkte på inputtap; tilkoblingen kan gjenopprettes, men spillet venter på eksplisitt «Fortsett».

[`play.js`](../src/app/play.js) abonnerer nå på inputtap umiddelbart. Pause sender heller ikke egne STOP/CLEAR-kall gjennom en forbindelse som allerede er utilgjengelig. Dette reduserer følgefeil fra opprydding under recovery, uten å skjule faktiske output-feil på en klar forbindelse.

## 3. Oppfølging: eksakt handshake-timeout før Start

Brukeren rapporterte deretter fortsatt `deviceInfo and first snapshot did not arrive before the handshake deadline`, **før Start på den lokale siden**. De to første rettingene beviste ikke at denne feilen var løst. Før Start finnes ikke spill-iframen; tilkoblingen eies av hovedsiden, og det er derfor oppstartsforløpet som må undersøkes.

En ny browser-regresjon reproduserte den eksakte timeouten ved å la den simulerte enhetens RX-buffer inneholde `C|1|17|D|TEXT|HEL`, slik den kan gjøre hvis en tidligere side lukkes mellom to output-chunks. Connect på siden sendte da `HELLO|1\n` rett etter de gamle tegnene. Enheten mottok én sammenføyd kommandolinje i stedet for en gyldig `HELLO`; ingen nye metadata ble sendt, og nettleseren nådde sin 3000 ms frist. Den gamle mocken startet alltid med tom RX-buffer og dekket ikke dette tilfellet.

Første handshake på en ny port sender nå `\nHELLO|1\n` i én begrenset chunk gjennom samme paced writer. En ren enhet ignorerer tomlinjen; en enhet med gamle kommandobytes får etablert en ny linjegrense. Den tidligere handlingen spilles ikke av på nytt, og ny `HELLO` nullstiller output som før. Høyst én forventet gammel `MALFORMED_COMMAND`/`LINE_TOO_LONG` før metadata håndteres som resynkronisering. `UNSUPPORTED_VERSION`, `INTERNAL_ERROR` og gjentatte framingfeil avvises fortsatt.

Dette er en reprodusert oppstartsfeil i nettleserens forbindelsesforløp. Det er **ikke** bekreftet at brukerens fysiske enhet faktisk hadde akkurat denne restbufferen, eller at sandbox-refaktoreringen økte hvor ofte siden ble lukket under output. Firmware og frister er ikke endret. Samme oppstartsreparasjon gjelder utviklingsserver og bygget nettsted.

Oppfølgingen er kontrollert med **45 inputtester** og **5 browser-scenarier**. Regresjonen for avbrutt side-output feilet før reparasjonen og bestod etterpå. Native Streams-mocken er også rettet til å håndtere flere LF-avsluttede linjer i samme write, slik ekte serial-data skal behandles. Handshake-timeout har nå `handshakeStage: "deviceInfo" | "snapshot"` og `recovery` i Testlab-eksporten, slik at en eventuell gjentakelse viser hvilken av de to meldingene som manglet.

## 4. Oppfølging: stale-feil bare ved spillbytte midt i runden

Etter oppstartsrettingen meldte brukeren at tilkoblingen fungerte, med ett gjenstående tilfelle: `Sensor input became stale` ved bytte av spill midt i runden. Dette er reprodusert med sidens faktiske spillbytte og en native `confirm()` som ble stående i 900 ms. Browser-dialogen blokkerte sidens serial-lesing/timere mens brukeren vurderte valget. Ved retur var friskhetsgrensen på 500 ms passert, og adapteren gjenopprettet forbindelsen.

Spillbytte bruker nå en asynkron HTML-dialog, og routeren avventer svaret. Aktiv runde pauser før dialogen åpner; sensorstrømmen fortsetter. Bekreft rydder den gamle runden og bytter spill. Avbryt/Escape beholder runden pauset og bevarer et eventuelt ulagret navnefelt. Dialogen ligger i spillrammen slik at den også kan brukes i fullskjerm. Fysiske spillmenyknapper er nøytralisert mens bekreftelsen vises. Samme dialog erstatter blokkerende bekreftelser for ulagret resultat, Testlab-opptak og sletting av konto/lokale rekorder.

Regresjonen feilet med stale-feilen før endringen og bestod etterpå: over 20 nye snapshots ble mottatt mens bekreftelsen stod åpen i 900 ms, uten feil eller ekstra `HELLO`. Andre browser-kontroller dekker avbryt/fortsett, bevaring av ulagret navn, alle syv spillbytter, konto-/Testlab-flyter og fullskjerm. Her ble bare nettstedets dialog-/navigasjonskode endret; firmware, adapterfrister og gjenopprettingsregler er uendret.

Fullskjermkontrollen avdekket også en overgangsrace: en dialog åpnet før en pågående fullskjermforespørsel var ferdig kunne ende bak fullskjermlaget. Spillbekreftelsen avventer nå denne asynkrone overgangen før den åpnes. Dialogens plassering, standardfokus på Avbryt og synlige rendering er kontrollert. Totalt syv målrettede browser-scenarier bestod for denne oppfølgingen.

## Hva som fortsatt er usikkert

- Sandboxen mottar normaliserte JavaScript-objekter over `MessageChannel`; den parser ikke rå serial-JSON og åpner ikke egne porter. Native lesing, én kommandokø og pacing lå fortsatt i den samme sideeide adapteren. Det er ikke påvist overlappende serial-writere som årsak.
- Friskhetsgrensen er fortsatt 500 ms. En blokkert nettlesertråd kan utløse recovery selv om enheten har sendt data. Lasting, kodeinitialisering, rendering eller annen CPU-belastning er derfor mulige utløsere; det er ikke målt en slik belastningsøkning på brukerens maskin.
- USB-/driverfeil og reelle manglende/ugyldige snapshots kan også gi oppstarts-/forbindelsesproblemer. Disse er ikke bekreftet for den rapporterte enheten. Oppstart med ufullført kommando er nå dekket av reproduksjonen over.
- Ingen firmwarekilder eller medfølgende HEX er endret. Programvaretester med transportmock er ikke en fysisk USB-/firmwaretest.

## Diagnostikk og kontroll

Testlabs eksisterende JSON-eksport beholder nå `snapshotAgeMs` og `freshnessOverrunMs` for friskhetsfeil, `lineBytes`/`connectionPhase` for parserfeil og eventuell `protocolCode`, `commandId`, `gapCount` og underliggende `causeName`. Ingen komplette rå serial-linjer er lagt til eksporten. Feltene skiller observasjoner fra antakelser; stor overskridelse alene beviser ikke en blokkert nettlesertråd.

Kontrollene bruker produksjonsadapteren og ekte browser-/Web Streams-kode med simulerte enhetsdata:

- **42 inputtester bestått**, inkludert tre nye regresjoner, native stream-livsløp, streng parser, pacing, timeout og akselerert femminutters replay.
- Browser-regresjoner dekker oppstart med gammel linjerest, recovery som er raskere enn polling, delt record over en bevisst 600 ms blokkering, eksplisitt fortsettelse, fysisk frakobling/reconnect i Tetris/Racer og Testlab-eksport.
- Webbygget er kontrollert. Ingen timeout er økt eller protokollgrense lempet.

Fra `webapp/`:

```sh
node --test tests/microbit-input/*.test.js
npm run build
npm run test:app -- connection.spec.js
```

En gjentatt fysisk feil etter rettingen trenger en fersk Testlab-opptakseksport og enhet-/nettleseropplysninger før en bestemt USB-, firmware- eller ytelsesårsak kan fastslås.
