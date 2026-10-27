# Testplan for webappens plattform

**Status:** Planlagt kontrollgrunnlag, samordnet 2026-10-27. Frontend og disse produkttestene er ikke implementert. Fasiten er [komponentspesifikasjonen](Komponentspesifikasjon_webapplikasjon_forklart.md) og [API 0.2.0](../../spec/contracts/webapp-backend/contract.md).

| ID | Scenario og forventet resultat |
| --- | --- |
| TWEB-01 | Registrering logger ikke automatisk inn. Sesjonsoppslag styrer beskyttede sider. POST bruker JSON, cookie og `X-MBG-Request: 1`. Ingen passord/token i lokal lagring. |
| TWEB-02 | Ordinært spill starter først etter klar Micro:bit og godkjent sesjonsfornyelse. Aktiv spilling fornyer omtrent hvert femte minutt; inaktiv fane gjør det ikke. Ukjent modul, inaktivt spill eller mislykket fornyelse blokkerer start. |
| TWEB-03 | Frakobling pauser spill. Gjenoppkobling venter på spillerens fortsettvalg. Avslutning gir `incomplete`, med delverdi eller `null`; aldri rekord. Test også frivillig avslutning uten frakobling. |
| TWEB-04 | Fullførte forsøk 100, 80, 120, 110 vises alle i privat historikk. Rekordhistorikk er 100 → 120. 201 betyr lagret forsøk, ikke nødvendigvis ny rekord. |
| TWEB-05 | Mistet svar og OUTCOME_UNKNOWN beholder samme ID og body ved omforsøk. 200 bekrefter lagring. ATTEMPT_CONFLICT lager ingen ny ID automatisk. Like verdier i ulike forsøk får ulike ID-er. |
| TWEB-06 | Nettbrudd/sesjonsutløp beholder spill/resultat midlertidig. Innlogging som annen spiller kan ikke sende forsøket. Tilbake til samme spiller kan gjenta det. Ubekreftet lagring merkes; lukking/oppdatering kan miste data. |
| TWEB-07 | Dashboard fremhever forsøks-ID etter spill, også uten rekord. Direkte åpning viser oversikt, nyeste først med spillfilter og sideinndeling. Tom historikk og manglende delverdi vises tydelig. Annen eiers forsøks-ID gir 404 uten datalekkasje. |
| TWEB-08 | Profil viser skrivebeskyttede felt. Passordendring/sletting krever gjeldende passord og avslutter sesjoner. Kontosletting fjerner privat og offentlig historikk. |
| TWEB-09 | AI viser ren tekst, håndterer ok/no_data/cannot_answer og tekniske feil uten å stoppe spilling. Spørsmål er selvstendige, uten automatiske omforsøk. Privat forsøkshistorikk sendes ikke som kontekst. |
| TWEB-10 | Testlab kan åpnes fra Launcher uten konto eller backend, også mens katalogkallet feiler. Ingen sesjonsfornyelse eller resultatinnsending. Sensor/output krever klar forbindelse. |
| TWEB-11 | Åpne Launcher, et spills toppliste og valgt spillers offentlige rekordhistorikk uten cookie. Sesjonsoppslag med 401 skal ikke sende brukeren bort fra offentlig visning. Kontroller rangering, enhet, sideinndeling, tom liste og feiltilstand. Spilling og privat Dashboard krever fortsatt innlogging; ingen private forsøk vises offentlig. |
| TWEB-12 | Bygg fra en ren utsjekking med `npm ci` og `npm run build` i `webapp/`, og server bare `dist/` gjennom Caddy med API-ruting. Med tom nettleserbuffer og eksterne ressursdomener blokkert: åpne hovedsidene, Testlab og hvert levert spill; kontroller at kode, CSS, bilder, lyd, fonter og filer som lastes ved behov kommer fra egen adresse uten manglende filer. Bruk kontrollerte API-/Micro:bit-adaptere for automatisk kontroll av lasting; faktisk spilling demonstreres også med Micro:bit. Direkte navigasjon og oppdatering av en frontendrute skal virke; ukjent API-rute skal gi avtalt API-feil fremfor HTML. Kontroller også oppdatering av hele pakken og tilbakeføring til forrige bygg på testoppsettet. |

Bruk kontrollerte API-svar for frontendtester og faktisk backend ved systemintegrasjon. Test også proxy-/nettverksfeil uten JSON. Micro:bit-bibliotekets GI-tester og Testlabs TLAB-tester beholdes som egne kontrollsett. Rapporter PASS/FAIL/SKIPPED/BLOCKED med versjon og miljø; planen er ikke bevis på beståtte tester.
