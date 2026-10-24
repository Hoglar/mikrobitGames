# Enkel oversikt: testing, verifisering og FoM

**Dette er kjøreplanen. Kommandoene nedenfor finnes ikke ennå.** Første steg ved implementering er kontrollverktøyene. Se [full plan](../spec/implementation-plan.md) og [diagram](../../docs/presentation/iterative-development.drawio).

| Hva undersøker vi? | Hvordan? | Hva får du tilbake? |
| --- | --- | --- |
| Virker funksjonene og sikkerhetsreglene? | Enhetstester og integrasjonstester med fast fasit. | PASS/FAIL og konkret feil. |
| Følger koden modellene? | Trekk ut DB-struktur, API-skjemaer og komponentavhengigheter; sammenlign med avtalt modell. | Liste over modellavvik. |
| Hvor raskt virker det? | Benchmark på serveren, inkludert faktisk lokal AI. | Svartider, feil og målebetingelser. |
| Blir implementasjonen bedre? | Beregn krav-FoM og modell-FoM fra de faste kontrollene. | To prosentkurver over tid. |

Testing er en del av verifisering. Verktøyene avgjør resultatene etter faste regler, uten AI som dommer. Kontrollene av AI-svar dekker format, status og tidsgrenser; de beviser ikke alle påstander i fri tekst.

## Engangsoppsett

Klargjør privat SSH-tilgang fra denne PC-en til Linux-serveren, eventuelt via Tailscale, og isolerte testtjenester med egen database og syntetiske data. Virkelig modell må være installert for full kjøring. Installasjonssteg og konfigurasjon følger når verktøyene implementeres. Testene trenger ikke gruppens nettside eller Micro:bit.

## Hver kontrollrunde

1. Lagre kodeversjonen i git og klargjør samme versjon på serveren. Kontrollene stopper hvis versjonene ikke stemmer.
2. Velg én av de planlagte kommandoene fra prosjektroten:

   | Kommando | Når brukes den? |
   | --- | --- |
   | `./backend/check quick` | Rask tilbakemelding med modelladaptere; ingen komplett FoM. |
   | `./backend/check full` | Full kontroll med lokal AI og benchmarks; kan gi nytt målepunkt. |
   | `./backend/check report` | Vis siste rapport og kurver uten å starte tester. |

3. Les rapporten som hentes til denne PC-en: bestått, feil eller ikke undersøkt, modellavvik og svartider. Detaljer i [backend/results](../results/README.md), kurver i [results/fom](../../results/fom/README.md).
4. **Du bestemmer neste steg:** be AI rette konkrete feil, avklar modellen, eller stopp. Ingen automatisk rettingssløyfe.

Første komplette måling er baseline før forbedringsrundene. Oppgaven krever minst tre målepunkter totalt. Påviste feil beholdes i tallene; ufullstendige kjøringer lagres med begrunnelse, men gir ikke komplett FoM. Høy FoM overstyrer aldri sikkerhetsfeil.
