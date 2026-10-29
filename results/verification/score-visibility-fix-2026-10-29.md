# Rettelse: synlige topplister og AI-oppslag, 2026-10-29

**Publisert på https://parrot.tail106c62.ts.net.** Kildegrunnlag er commit `a0a56ea16b79ed71bccad6e244966d3ac4abfba9` med lokale, ennå ikke committede endringer. Backendutslipp: `20261029T140016413536Z-a0a56ea1`. Webutslipp: `20261029T140034785852Z`. Ingen commit eller push er gjort av assistenten.

## Problem og rettelse

Brukerens skrivebeskyttede databasekontroll kl. 14:33:52 norsk tid viste 15 fullførte forsøk og 12 rekordhistorikkrader. AI-rollen kunne lese alle 12 rekordradene. Lagringen fungerte for disse rundene. Dashboard var med hensikt privat, men den implementerte offentlige topplistesiden manglet navigasjonslenker.

Frontend har nå «Topplister» i hovedmenyen, lenker på spillkortene og fra Dashboard, og en lenke fra spillsiden som følger valgt Snake-variant. Oversikten viser de ti kompatible spillvariantene. Private forsøk ligger fortsatt bare i eierens Dashboard; topplistene viser alle spilleres offentlige rekorder.

AI-verktøyene skilte tidligere ikke mellom ukjent spillnavn og kjent spill uten rekorder. Begge ga samme tomresultat. `standings` og `history` bevarer nå spillkatalogtreff også når rekordtreff mangler, og skiller mellom `unknown_game`, `ambiguous_game` og `found: false`. Et mislykket eller tvetydig spilloppslag kan ikke støtte et strukturert faktasvar om manglende rekorder. Navn som «Snake» blir ikke automatisk koblet til en tilfeldig variant. Presiseringen er ført i [AI–database-kontrakten](../../backend/spec/contracts/ai-database/contract.md).

Hvert dataverktøy bruker fortsatt én parameterbundet, skrivebeskyttet spørring mot de samme offentlige visningene. API-felter, private grenser, poengregler, modellinnstillinger og budsjetter er beholdt. Ingen lagrede resultater ble endret av rettelsen.

## Kontrollresultater og begrensninger

| Kontroll | Resultat |
| --- | --- |
| Samtaleminne, nye avklaringsregresjoner og modellmeldinger | 19 enhetstester bestod. |
| SQL-tillatelsesliste og avvisning av private data/skriving | 27 enhetstester bestod. |
| Isolert PostgreSQL/AI: navneoppslag, transport og budsjetter | Tre målrettede integrasjonskontroller bestod. Navnetesten dekker ukjent spill, kjent tomt spill, eget/ukjent spillernavn, dublerte navn med ett tomt spill, og entydig UUID. |
| Nettleser: offentlig toppliste/historikk, navigasjon og valgt Snake-variant | Tre målrettede tester bestod i Chromium 156 / Playwright 1.64.1. |
| Eksisterende mobiltest | Feilet to ganger på femsekundersfristen for lasting av spillkort. Kravet ble ikke endret. Separat diagnose viste at også opprinnelig spillvelger fra HEAD brukte 8,13 s på første lasting. Rettet side i samme nettleser brukte 0,21 s etter oppvarming; begge hadde bredde 390 px og ingen JavaScript-feil. Tallene er ikke et bevis for ytelsesforbedring, siden oppvarming/cache påvirker sammenligningen. Mobiltesten rapporteres fortsatt ikke som bestått. |
| Faktisk Qwen med isolerte, syntetiske data og endelig instruks | Viking Dash: brukte `standings` og oppga korrekt Ada 120 / Nora 115, 14,6 s. «Hvem leder i Snake?»: oppslaget returnerte ukjent navn, og modellen ba om presisering, 10,4 s. Dette er to enkeltobservasjoner, ikke en generell faktakvalitetsmåling. |
| Publisert løsning i nettleser, uten innlogging | PASS: meny → ti topplister → Viking Dash med to rekordholdere → tilbake til oversikten. Ingen JavaScript-feil. |
| Installert kode | SHA-256 for rettet AI-oppslag og frontendmeny samsvarer med arbeidsmappen. |

Miljø: Parrot, Python 3.13, eksisterende Node 20.19.2/npm 9.2.0 og låst Playwright 1.64.1 med Ubuntu 24.04-reservebygget av Chromium 156. Frontend anbefaler Node 24.22.1/npm 11.19.1; denne avgrensede kontrollen hevdes ikke kjørt i det anbefalte miljøet. Modellen er den eksisterende lokale `qwen3:4b-instruct-2507-q4_K_M`.

Tre forslag til utvidet modellinstruks ble undersøkt med de samme syntetiske spørsmålene. De ga flere svar uten dataoppslag og ble forkastet. **Den opprinnelige modellinstruksen er beholdt uendret.** [Observasjonene](score-visibility-fix-2026-10-29.json) bevarer både disse utfallene og kontrollen av endelig løsning. Ingen ekte spillerdata, passord eller sesjonscookies er med i filen.

Brukerens opprinnelige AI-spørsmål/svar var ikke tilgjengelig i diagnosen. Den påviste oppslagsfeilen er rettet, men det er ikke bevist at den forklarer alle tidligere AI-svar. Modellen kan fremdeles hoppe over verktøy eller formulere et upresist fritekstsvar. Topplistene er den direkte visningen av registrerte rekorder. Ingen ny full `./backend/check`, benchmark eller FoM er kjørt. Nye regresjonskontroller endrer kontrollgrunnlaget ved neste brukerstartede fullkjøring; gamle rapporter beholdes.

## Git-feilen ved oppdatering

Oppsettsskriptet kjørte `git status` under sudo med umask 077. Git kunne dermed oppdatere `.git/index` med en annen eier og modus 0600. Etter oppdateringen var indeksen ikke lesbar for `hoglar`; ingen andre filer under `.git` hadde feil eier.

Brukeren gjenopprettet bare eierskapet med `sudo chown --reference=.git/HEAD .git/index`. Deretter var Git lesbart, `main` var oppdatert mot `origin/main`, og de forventede rettelsene var ustagede. Ingen reset, sletting av indeks, commit, merge eller push ble gjort.

`backend/ops/runtime/setup.py` bruker nå `git --no-optional-locks ... status`, slik at statuskontrollen ikke oppdaterer indeksen. En separat midlertidig Git-repositorykontroll bekreftet bevart indeksinnhold, inode, mtime og rettigheter etter et stat-avvik i en sporet fil. Denne siste skriptrettelsen ligger i arbeidsmappen for neste oppsett; kjørende tjenester trenger ingen ny publisering for den.

## Bruk

Oppdater nettlesersiden etter at en pågående runde er ferdig. Velg **Topplister** for alle spillere, eller **Toppliste for valgt variant** på spillsiden. Dashboard viser fortsatt bare egne forsøk. Ved spørsmål om Snake-rekorder må riktig variant avklares; et kjent spill uten rekorder er et annet utfall enn et ukjent navn.
