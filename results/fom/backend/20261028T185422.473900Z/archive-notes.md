# Arkivnotat til kjøring 20261028T185422.473900Z

Kjøringen ble utført av brukeren med `./backend/check`, på ren commit `3bd5d07f3ec92375c55cf3695e15a4e21516cdfc`, kontrollversjon 3. Tidspunktet 2026-10-28 18:54:22 UTC er 19:54:22 norsk tid. Alle 72 kontrollverktøytester, 69 enhetstester, 42 integrasjons-/benchmarkkontroller og 32 modellkontroller bestod. Ingen blokkeringsårsaker er registrert. Krav-FoM og modell-FoM er begge 100 %.

`report.md`, `report.json`, `requirements.svg` og `model.svg` er uendrede kopier av originalene. SHA-256 og filstørrelser finnes i [manifestet](../manifest.json). Dette notatet er lagt til ved arkivering og er ikke en del av den opprinnelige testrapporten.

## Avvik i registrert modellkonfigurasjon

`measurements.model.options.num_ctx` og `environment.model.options.num_ctx` i JSON-rapporten er feilaktig registrert som **4096**. I den testede commiten har `real_model_metadata` i `backend/tests/benchmarks/benchmark_checks.py` fortsatt denne hardkodede verdien.

Samtidig bruker `backend/ai-service/src/model_client.py` **16384**, og `real_ai` i benchmarkfilen kontrollerer eksplisitt at `options.num_ctx == 16384` i de observerte `/api/chat`-kallene. Denne kontrollen bestod. Den korrekte opplysningen om forespurt kontekststørrelse for kjøringen er derfor **16384**, ikke 4096. Det er ikke en måling av antall tokens som faktisk var brukt i hvert kall.

Avviket gjelder rapportmetadata, ikke registrerte svartider, teststatuser eller FoM-beregningen. Originalrapporten og måleseriens metadata er bevart uten omskriving. Metadatafeilen i testkoden er dokumentert, men ikke rettet her, i tråd med avtalen om ingen automatisk ny rettingsrunde. Fremtidig retting vil endre kontrollgrunnlagets digest og må håndteres som egen måleserie.

## Hva resultatet viser

HTTP-/DB-belastning med og uten AI, isolasjon, kontrollert datahenting og det faste spørsmålssettet mot virkelig Qwen bestod de automatiserte kontrollene. Kaldt AI-kall tok omtrent 50,75 sekunder; de ni varme kallene tok omtrent 10,64–16,40 sekunder.

Kontrollene av virkelig AI vurderer blant annet format, status, forespørsels-ID, modellinnstillinger og tidsfrist. Fri samtale og alle faktapåstander er ikke fullstendig kontrollert. De lagrede svarene gjengir blant annet Poengjakt 100 → 120, Sprint 55 000 mot 58 000 ms og Noras spill Poengjakt/Sprint. Hele svarteksten finnes i `measurements.ai` i [rårapporten](report.json).

Denne kjøringen er første komplette arkiverte målepunkt for samtaleløsningens kontrollversjon 3. Eldre målinger beholdes, men skal ikke tegnes inn som om kontrollgrunnlag og modellinnstillinger var uendret. Frontendintegrasjon og faktisk demonstrasjon gjenstår; ingen tjenester er publisert eller nettverksporter åpnet av arkiveringen.
