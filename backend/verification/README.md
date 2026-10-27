# Testfasen – én kommando

**Revisjon 2026-10-27:** Spesifikasjonene er oppdatert til API 0.2.0, databasekontrakt 1.2 og modellformat 2. Eksisterende kjørbar test-/kontrollkode gjelder tidligere rekordmodell og kan ikke verifisere denne revisjonen før [tilpasningene](../../spec/contracts/webapp-backend/alignment.md#tilpasning-av-eksisterende-kjørbare-tester) er gjennomført. Modellsettet skal bli 24/4/4; dagens verktøy er fortsatt 20/4/4. Dette er dokumentasjonskontroll, ikke bestått produkttest.

**Vanlig bruk:** Kjør `./backend/check` fra prosjektroten. Den starter hele den automatiserte backend-testpakken. Du trenger ikke starte database, API, AI eller flere testprogrammer manuelt.

Testkode og benchmark er skrevet før komponentene. Så lenge migreringer eller tjenester mangler, viser rapporten **BLOCKED**. Det er ikke en bestått test eller en baseline.

## 1. Engangsoppsett på Parrot

Commit og push arbeidet på utviklings-PC-en først. Deretter, i terminalen du vanligvis bruker for SSH:

```bash
ssh parrot
```

På Parrot:

```bash
git clone https://github.com/Hoglar/mikrobitGames.git
cd mikrobitGames
./backend/check setup
```

`setup` oppretter `.venv` og installerer testbibliotekene. Når implementasjonen har fått `backend/requirements.txt`, installerer samme kommando også applikasjonens avhengigheter. Kjør `setup` på nytt når avhengighetene endres.

Parrot må ha Python 3.10+, støtte for `python3 -m venv`, OpenSSL og PostgreSQL-serververktøyene `initdb`, `pg_ctl`, `pg_dump` og `pg_restore`. Test og drift skal bruke samme PostgreSQL-hovedversjon. `psql` alene er ikke nok. Kommandoen melder tydelig fra hvis noe mangler; den installerer ikke systempakker eller endrer brannmur.

Ollama og den avtalte Qwen-modellen må være installert én gang før ekte AI kan testes. Testkjøringen bruker eksisterende modellfiler og starter en egen lokal Ollama-prosess; den laster ikke ned modeller og stopper ikke den vanlige modellserveren. Den finner standardmappen automatisk. Ved annen plassering lager du `backend/check.local.json` på Parrot:

```json
{
  "model_directory": "/sti/til/ollama/models",
  "model": "qwen3:4b-instruct-2507-q4_K_M"
}
```

Filen holdes utenfor git. [Oppstartskravene til implementasjonen](test-runtime.md) beskriver miljøvariabler, migreringer og interne testgrensesnitt som AI skal bygge etter. Dette er del av implementeringsgrunnlaget, ikke noe du skal fylle ut for hver testkjøring.

## 2. For hver utviklingsrunde

Lagre implementasjonen i git. Hvis du endret koden på den andre PC-en: push der, og oppdater Parrot-klonen før testing:

```bash
git pull --ff-only
./backend/check
```

**Det er `./backend/check` som kjører hele testfasen.** `git pull` trengs bare for å hente ny kode. Testkommandoen oppdaterer aldri koden selv.

En full kjøring inkluderer en belastningsprofil med **2 minutter oppvarming og 15 minutter måling**, både uten og med AI-belastning, samt samtidige topper og kald/varm AI. Regn med omtrent **40–60 minutter**, avhengig av maskinen og eventuelle tidsavbrudd. Manglende komponenter gir rask BLOCKED-rapport fremfor å vente gjennom benchmarken.

Verktøyet gjør følgende:

1. Kontrollerer testverktøyene og kjører enhetstestene.
2. Lager en egen, midlertidig PostgreSQL-instans med syntetiske data og kjører prosjektets migreringer.
3. Starter testversjonene av API, AI og lokal modell på egne loopback-porter, samt en lokal HTTPS-testinngang.
4. Kjører integrasjon, feilinjeksjon, modelluttrekk og benchmarks. Hver funksjonstest får tilbakestilt datasett.
5. Lagrer resultater og eventuelle FoM-punkter/kurver, og stopper testprosessene.

Databasens omstart og gjenoppretting berører bare denne testinstansen. Alle forventninger hentes fra spesifikasjonene og testfilene. Ingen utviklings-AI starter eller retter kode under kjøringen.

## 3. Les resultatet

Terminalen viser en oppsummering og stien til rapporten. Du kan alltid hente den frem igjen med:

```bash
./backend/check report
```

Rapportmappen under `backend/results/runs/` inneholder:

| Fil | Innhold |
| --- | --- |
| `report.md` | Kort oversikt, feil, blokkeringer og benchmarkresultater. |
| `report.json` | Alle delresultater, råmålinger, commit, kontrollversjon og miljø. |
| `requirements.svg`, `model.svg` | To fremgangskurver når et komplett FoM-punkt finnes. |

| Status | Betydning |
| --- | --- |
| PASS | Utført og forventningen oppfylt. |
| FAIL | Utført og fant et avvik. |
| BLOCKED | Kunne ikke utføres/vurderes; rapporten forklarer hva som mangler. |
| SKIPPED | Utelatt ved hurtigkjøring. |

Returkode 0 betyr at den kjørte pakken bestod, 1 betyr påvist feil, og 2 betyr ufullstendig/blokkert kjøring. Første komplette måling er baseline. Deretter velger **du** om AI skal rette konkrete feil, og kjører samme kommando på neste versjon. Oppgaven krever minst tre målepunkter over tid.

FoM krever full kjøring, målbare kontroller og en ren git-versjon. Feil kan gi et målepunkt, mens manglende målinger ikke kan det. Endret kontrollgrunnlag, modell eller miljø gir en egen kurveserie. Ikke endre testfasiten bare for å få grønt resultat.

Rapportmappene er ignorert av git. Behold kjøringene på maskinen. Til presentasjonen kan utvalgte rapporter/kurver kopieres til `results/fom/` og committes; inkluder også regresjoner. Sikkerhetsfeil blokkerer godkjenning uavhengig av FoM.

## Valgfritt: start alt fra utviklings-PC-en

Etter kloning og `setup` på Parrot lagrer du tilkoblingen én gang fra prosjektmappen på utviklings-PC-en:

```bash
./backend/check configure --host parrot --repo /home/hoglar/mikrobitGames
```

Deretter er kommandoen fortsatt **`./backend/check`**. Den bruker SSH, krever samme rene commit og kontrollgrunnlag på begge maskinene, kjører kontrollene på Parrot og henter rapporten tilbake. Windows sin SSH-klient brukes når Windows-konfigurasjonen er tilgjengelig i dette WSL-oppsettet. Ingen databaseport åpnes på internett.

## Kortere kjøringer

- `./backend/check quick`: enhetstester, raske integrasjonstester og modellkontroll. De lange benchmark-/tidsavbruddstestene hoppes over; ingen komplett FoM.
- `./backend/check selftest`: bare kontroll av selve testverktøyene.

Den automatiserte pakken trenger verken nettsiden eller Micro:bit. Faktisk nettleseroppførsel, offentlig HTTPS/ruting, full maskinoppstart og den samlede Micro:bit-demonstrasjonen verifiseres også ved systemleveransen. Automatiske AI-kontroller måler format, status og tid; fri norsk tekst er ikke fullstendig faktaverifisert av disse testene.
