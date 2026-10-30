# Micro Racer – lokal programvareverifikasjon 2026-10-30

Implementasjonen følger [spesifikasjonen](../spec/games/micro-racer/README.md).
[Kodeveiledningen](../src/games/micro-racer/README.md) beskriver moduler,
startkommandoer og de 36 nye katalogvariantene. Rapporten gjelder lokal kode;
ingen produksjonsregistrering, utrulling eller fysisk USB-akseptanse er utført.

## Miljø og metode

Windows, Node 24.22.1 gjennom installert VS Code-runtime med
`ELECTRON_RUN_AS_NODE=1`, prosjektets låste Playwright/Chromium og Python 3.14.7
for rene scorepresentasjonstester. Node/npm finnes ikke som vanlige kommandoer
i denne sandkassens PATH. De normale npm-kommandoene i README utfører de samme
prosjektskriptene på et ordinært Node-oppsett.

Bygget kopierer bare offentlige kildefiler til `dist/`; racing har ingen nye
runtimepakker, bilde-/lydlastinger eller AI-nettverksavhengighet. De tre
motstanderne beregnes i nettleseren med samme bilfysikk som spilleren.

## Utførte kontroller

- Hele Node-/inputpakken bestod i siste kjøring: 128 tester, inkludert 31
  racingtester med to lyd-/ressurstester. Katalogtabellen kontrolleres mot alle
  36 varianter slik at bane-/bilrekkefølge ikke kan omnummerere gamle ID-er.
- Ni frosne kontrolltracer i `tests/unit/fixtures/racing-traces.json` replays
  uten AI-kontroller: alle tre baner × alle tre bilklasser fullfører én runde
  uten barrieretreff eller avkjøring. Tid og antall simuleringssteg kontrolleres
  mot de lagrede forventningene.
- Ni separate firebilers simuleringer fullfører tre runder med alle baner/
  bilklasser. Dette verifiserer AI-progresjon, fysisk kontakt og at målet kan nås;
  det er ikke en måling av menneskelig vanskelighetsgrad.
- Resultat-/gate-/fysikktester dekker min/maks, kodingshull, delte plasseringer,
  DNF/null, falsk start, baklengs gate, gate utenfor segment, relativ styring,
  grep, brems over gass, overlapp, swept kontakt og to sekunders gjenoppretting.
- Fire rene Python-tester for AI-scorepresentasjon bestod. `read_store.py` og
  `model_client.py` ble syntakskontrollert; full backend-/database-/modellkjøring
  er ikke gjort her. Dette miljøet mangler backendens installerte avhengigheter.
- Desktop- og mobilbilder ble visuelt kontrollert. Roterende verdensvisning,
  nordorientert minikart, variantoppsett, HUD og fullskjerm inngår i browser-testene.

Alle 46 ulike appnettlesertester er verifisert: 45 bestod i full kjøring, og
full-runde-/innsendingscaset bestod i målrettet kjøring etter at testdriveren
ble endret fra åpen, tidsstyrt inputreplay til en skjermobserverende testpilot.
Piloten leser den tegnede kameratransformen og sender fysiske kontrollverdier
gjennom Web Serial-mocken; den får ikke tilgang til den monterte spillmotoren
og injiserer ingen målgang eller score. En faktisk full runde gir nøyaktig én
`completed`-innsending og bekreftet rekordrespons fra API-kontraktmocken.
De frosne, nøyaktige 120 Hz-kontrolltracene brukes fortsatt i rene modultester,
der serial-/renderingstiming ikke forskyver de faste inputtidspunktene.

Frontend/backend-grensekontrollen i `tests/integration/components.test.mjs`
bestod separat for alle 47 registrerte varianter: 1128 status-/type-/min-/maks-
tilfeller sammenlignes med backendens ekte Python-validator. Firmwaretestene i
samme fil ble ikke kjørt som del av denne avgrensede kontrollen.

## Dekning og gjenstående akseptanse

MR-01–MR-23 har automatisert deldekning. Test-ID betyr ikke at hvert kravs
fysiske del er bestått. MR-24 er ikke utført: faktisk V2-/USB, instrumentert
inputlatens, fem minutters fysisk forløp, kameraergonomi og menneskelig balanse
krever utstyr og operatør. Ingen FoM-punkt, UX-skår eller produksjonsbaseline
er opprettet som del av arbeidet.

Første lydleveranse er én valgfri motorstemme med volum. Forslagene om dekk-/
kontaktlyd og Micro:bit-tilstandsbilder er ikke implementert; grensesnittet viser
all nødvendig informasjon i nettleseren. Kameraet bruker gjeldende heading
uten ekstra rotasjonslagg, ikke en kamerafjær som kan snurre over vinkelgrensen.

De 36 racing-UUID-ene er definerte, men ikke registrert i en database. Tilkoblet
rangert start forblir sperret hvis katalogen mangler varianten eller har andre
regler. Registreringskommandoene kan skrives med
`node verification/catalog-commands.mjs --family=racing`; ingen kommando er
automatisk kjørt. Frontend-/AI-presentasjon dekoder race-resultatene; backendens
eksisterende generiske intervallvalidering er beholdt og er ikke en anti-cheat.
