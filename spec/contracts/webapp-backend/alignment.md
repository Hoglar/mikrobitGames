# Samordning av webapp og backend

**Dato:** 2026-10-27. **Grunnlag:** Gjennomgang av eksisterende spesifikasjoner og brukerens eksplisitte valg i denne samtalen. Arbeidet gjelder kontrakter, spesifikasjoner, modeller og testplaner; tjenester og kjørbare produkttester er ikke implementert i denne revisjonen.

## Konflikter og løsninger

Tabellen beskriver motstridene som fantes før samordningen. Lenker peker til dokumentene slik de nå er rettet.

| Punkt | Tidligere motstrid eller manglende kobling | Samordnet beslutning og kilde |
| --- | --- | --- |
| Resultatlagring | Webapp krevde alle fullførte/ufullførte resultater; backend og API lagret bare personlige rekorder. | Alle avsluttede forsøk lagres privat. Bare fullførte kan gi offentlig rekord. [Webapp §2.5–2.7](../../../webapp/spec/Komponentspesifikasjon_webapplikasjon_forklart.md), [DB-kontrakt §2/6](../../../backend/spec/contracts/backend-database/contract.md). |
| Ufullført verdi | Webapp forutsatte alltid poengsum; tidsspill kan mangle meningsfull sluttverdi, og API manglet status. | `completed` krever sluttverdi innen spillreglene; `incomplete` har sikker ikke-negativ delverdi eller `null`, aldri rekord. [API-skjemaer](openapi.yaml). |
| Dashboard og synlighet | Webapp beskrev siste spill og spillhistorikk, men API tilbød bare offentlig rekordhistorikk. | Egen forsøkshistorikk er privat og leses gjennom `/account/results`; offentlige rekordruter beholdes. Siste spill identifiseres med forsøks-ID. [Frontendguide](contract.md). |
| Omforsøk | Backend brukte spiller/spill/verdi for duplikatkontroll; det ville slått sammen ulike forsøk med lik verdi. | Stabil forsøks-ID per spiller; identisk innhold kan gjentas uten ny skriving. Endret spill/status/verdi gir `ATTEMPT_CONFLICT`. [DB-kontrakt §6–7](../../../backend/spec/contracts/backend-database/contract.md). |
| Lagringsbekreftelse | 201 betydde ny rekord, 200 ingen ny lagret rad; webappen trenger bekreftelse også for andre forsøk. | 201 betyr nytt forsøk lagret; 200 identisk forsøk allerede lagret. Body viser rekordeffekt, inkludert `not_eligible`. [OpenAPI](openapi.yaml). |
| Profil | Webapp lovet redigering av brukeropplysninger; backend tilbød ingen profilredigering eller brukernavnendring. | Vis kontofelt; tilby eksisterende passordendring og kontosletting. Ingen brukernavnendring i første versjon. [Webapp §2.8](../../../webapp/spec/Komponentspesifikasjon_webapplikasjon_forklart.md). |
| AI-grunnlag | Webapp begrenset AI til highscore-lister; backend tillot offentlig rekordhistorikk og sammenligninger på tvers av spill. | AI bruker offentlige rekorder og rekordhistorikk, uten private forsøk, heller ikke egne. [AI–DB-kontrakt](../../../backend/spec/contracts/ai-database/contract.md). |
| Chat og sesjon | «Samtale» kunne tolkes som AI-hukommelse; webappen manglet de konkrete sesjons-/fornyelsesreglene. | Selvstendige spørsmål uten samtalehistorikk. Sesjonsoppslag, fornyelse før ordinært spill og ved aktiv spilling, og samme eier ved ny innlogging. [Frontendguide](contract.md). |
| Katalog og Testlab | Backend leverte spillmetadata uten modulkobling; generelle innloggings-/startkrav stemte ikke med lokalt Testlab uten backend. | Lokalt register kobler stabile backend-ID-er til spillmoduler. Testlab er et lokalt verktøy uten backend-ID, konto eller resultatlagring. [Webapp](../../../webapp/spec/Komponentspesifikasjon_webapplikasjon_forklart.md), [Testlab](../../../webapp/spec/games/microbit-testlab/specification.md). |
| Modell og testgrunnlag | Fire tabeller, alle felt NOT NULL og 20 DB-kontroller kunne ikke beskrive private forsøk med nullable felt. | Fem tabeller, eksplisitt nullbarhet per tabell og planlagt 24-kontrollsett. Eksisterende verktøy må tilpasses før produktmåling. [Datamodell](../../../backend/spec/models/data-model.md), [DB-testplan](../../../backend/spec/test-plan.md). |

## Revisjoner og kompatibilitet

- Webapp–backend: **0.2.0**, med endret resultatforespørsel, svar og HTTP-semantikk samt to private leseruter. En klient som bare sender `value` er ikke kompatibel.
- Backend–database: **1.2**. API–AI: **1.2**, og AI–database: **1.1**; AI-meldingsformat og de tre offentlige visningene er uendret, men privat forsøkstilgang er uttrykkelig forbudt.
- Databasefasit: **format_version 2**, med `app.attempts` og eksplisitte `not_null_columns` for hver tabell. Ingen migrering, eksisterende produksjonsdata eller publisert tjeneste inngår her. Implementer første skjema fra denne modellen når backend bestilles.
- Tidligere godkjenninger gjelder tidligere dokumentversjoner. Denne revisjonen følger de avklarte produktvalgene og den bestilte samordningen; den er ikke en ny påstand om beståtte tester eller godkjent implementasjon.

## Presiseringer for implementering

Forsøket lagrer opprinnelig rekordutfall og rekordreferanse. Disse beholdes ved identisk omforsøk, mens `current_record` leses på nytt. Forsøkene eksponerer ingen offentlig kobling tilbake fra rekorder. Ett forsøk og eventuell rekord committes atomisk; kontosletting fjerner begge historikkene. Første forsøk låser spillets enhet, rangeringsretning og intervall; historikk hindrer spillsletting.

Nettbrudd og utløpt sesjon bevarer forsøket midlertidig i frontendminnet med opprinnelig eier og ID. Bare samme konto kan sende det. Lukking/oppdatering kan miste ulagrede data. Ingen automatisk generell retry av konto- eller AI-operasjoner innføres. Inaktivt spill avviser nye forsøk, men identisk omforsøk kan fortsatt bekrefte tidligere lagring.

## Tilpasning av eksisterende kjørbare tester

Disse endringene er **planlagt, ikke utført i testkoden**. Produktbaseline/FoM kan ikke rapporteres for denne revisjonen før de er gjennomført. Dokumentasjonsvalidering av YAML/JSON/XML er et eget kontrollnivå.

| Eksisterende del | Nødvendig tilpasning før implementasjonen verifiseres |
| --- | --- |
| `backend/tests/integration/api_checks.py` | Send forsøks-ID og status; skill 201/200 fra rekordutfall. Dekk ulike forsøk med lik verdi, replay etter bedre rekord/deaktivering, konflikt, ufullført/null, eierfiltrert liste/detalj, sideinndeling og kontosletting av begge historikkene. |
| `backend/tests/integration/database_checks.py` | Seed åtte fullførte forsøk til de åtte rekordene; kontroller nye nøkler, nullable felt/statusutfall, kaskader, spill med bare ufullførte forsøk, og ingen AI-lesetilgang til forsøk. |
| `backend/tests/integration/ai_checks.py` og `backend/tests/fixtures/sql-cases.json` | Legg til forsøk på direkte og modellforeslått lesing av `app.attempts`, også for spørsmålsstilleren. Behold fasit for offentlig rekordhistorikk. |
| `backend/tests/benchmarks/benchmark_checks.py` og `backend/verification/harness.py` | Seed sammenhengende forsøk/rekorder, bruk ny ID per virkelig forsøk og samme ID ved omforsøk. Behold HTTP-/DB-tidsmål; dokumenter forsøksvolum i tillegg til rekordvolum. |
| `backend/verification/controls.py` og `model_checks.py` | Støtt modellformat 2 og eksplisitt nullbarhet. Fire kontroller for hver av fem tabeller (MDB-1–20), tre uendrede AI-visninger (MDB-21–23), objektsjekk MDB-24. Manglende eller ufullstendig uttrekk gir BLOCKED. |
| `backend/verification/check_registry.py`, `pipeline.py`, `reports.py`, runner og egne tester | Oppdater alle hardkodede antall/ID-er, modellvekter fra 20/4/4 til 24/4/4, rapporter og bevisste avviksfixturer. Lag ny kontrollversjon/måleserie; gamle resultater skal ikke omtolkes. |
| Frontendtester | Implementer [TWEB-01–10](../../../webapp/spec/platform-test-plan.md) sammen med webappen. GI-/TLAB-testene beholdes for sine egne ansvarsområder. |

Rene rekordfunksjoner for streng forbedring og rangering beholder sine forventninger. Utvid status-/forsøksvalidering i stedet for å gjøre ufullførte delverdier til rekorder.

## Utført dokumentasjonskontroll

Kontrollert 2026-10-27 med `openapi-spec-validator` 0.7.2 og `jsonschema` 4.25.1:

- OpenAPI 3.1-dokumentet er gyldig, og alle 43 request-/response-eksempler følger skjemaene.
- 16 gyldige/ugyldige resultatforespørsler og fem ugyldige svarkombinasjoner gir forventet skjemautfall, inkludert manglende ID/status, ufullført/null, usikre tall og motstridende rekordutfall.
- Eksisterende offentlige ruteoperasjoner er uendret; de to nye private leserutene krever sesjon i OpenAPI.
- De to endrede JSON-modellene og tre endrede diagramfiler kan parses. Diagram-ID-er er unike og alle piler/foreldre refererer til eksisterende elementer. Nullable forsøksfelt og fravær av AI-visning for forsøk er kontrollert i modellfasiten.
- Lokale lenker i endrede Markdown-dokumenter finnes, og `git diff --check` er uten avvik.

Dette validerer dokumentstruktur og kontrakteksempler. Det beviser ikke fungerende eierskapskontroll, atomisk lagring, diagrammenes visuelle utforming eller produktoppførsel; disse kontrolleres ved implementering etter testplanene.
