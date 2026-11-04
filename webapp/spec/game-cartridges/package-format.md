# Pakkekontrakt v1

**Status:** Implementert manifestprofil v1, 2026-11-04. [Manifestskjemaet](game.schema.json) er maskinlesbart; kontrollene nedenfor kommer i tillegg til JSON Schema.

## Fast mappeoppsett

```text
webapp/src/games/my-game/
├── game.json          # påkrevd, UTF-8 JSON, ingen kjørbar kode
├── cover.png          # påkrevd omslag; cover.webp er også tillatt
├── index.js           # påkrevd standardeksport gjennom SDK-et
├── README.md          # påkrevd: styring, spillmål, forfatter, lisens
├── style.css          # valgfritt, brukes bare inne i spillrammen
├── assets/            # valgfritt, lokale bilder/lyd/fonter/data
├── lib/               # valgfritt, spillets egne JavaScript-moduler
└── tests/             # valgfritt, tas ikke med i publisert spillpakke
```

Bare undermapper med `game.json` er spill. Dagens `shared/` og `registry.js` blir ikke spilloppføringer. Undermappens navn er et arbeidsnavn og påvirker ikke identiteten. Installer nøyaktig én rotmappe per spill, ikke en ekstra ZIP-rot over `game.json`. Oppdatering erstatter hele mappen etter validering, slik at gamle filer ikke blir liggende i pakken.

Omslag er **512 × 512 piksler**, PNG eller WebP, høyst 1 MiB. Rasterformat gjør at launcheren kan vise bilder uten å kjøre spillkode eller laste et SVG-dokument. Spillnavn/kontrollforklaring vises også som tekst, og tittel brukes som alternativtekst. Manglende/korrupt omslag gir valideringsfeil; UI kan vise et felles reservebilde ved uventet lastingsfeil.

Startgrenser: 50 MiB publiserbart innhold per spill, 512 filer, høyst 10 MiB per fil og 256 moduser. Dette er plattformens driftsgrenser, ikke regler i spillets fysikk. Validering skal fortelle hvilken grense som ble overskredet. Ingen plattformavhengig kjørekode, symlenker, skjulte hemmeligheter eller referanser utenfor pakken tillates. Medfølgende tredjepartskode/lyd krever lisensopplysninger.

## Manifest

Se [komplett eksempel](example.game.json). Påkrevde felt:

| Felt | Betydning |
| --- | --- |
| `manifestVersion` | `1`, parserkontrakten. Ukjent versjon avvises. |
| `sdkVersion` | `1`, SDK-hovedversjon. Plattformen velger sin kompatible implementasjon. |
| `id` | Tilfeldig UUID, opprettes én gang når et nytt spill lages. Behold ved oppdatering/deling. |
| `slug` | Lesbar rutekey, f.eks. `star-sprint`. Unik i én installasjon; kollisjon er feil, ikke overskriving. |
| `version` | `major.minor.patch` uten prefiks, pakkeutgave. Separat fra konkurransereglene. |
| `title`, `description`, `author`, `license` | Ren tekst, aldri HTML. `license` er SPDX-navn eller lokal lisensreferanse. |
| `entry`, `cover` | `index.js` og `cover.png`/`cover.webp`. `styles` kan angi `style.css`. |
| `controls` | Kort forklaring, f.eks. «Vipp for å styre, B for gass, A for brems». |
| `viewport` | Designstørrelse, minimumsstørrelse og om spillet skal beholde proporsjonene. |
| `modes` | Eksplisitte konkurransevarianter med stabil ID, navn, `rulesVersion`, `config` og `score`. |

Valgfrie `genre` og `accent` gir presentasjon i det generiske kassetthjulet. Presentasjonsfelt er data; et spill kan ikke få global CSS eller velge en vilkårlig HTML-mal. Ukjente manifestfelt avvises i v1 for å oppdage skrivefeil.

## Moduser og oppsett

En modus er én konkurranse med én toppliste, ikke bare en tekstetikett. Micro Racer får fortsatt 36 moduser: 3 baner × 2 formater × 2 rundetall × 3 biler. Snake får fortsatt seks. Alle kombinasjoner angis eksplisitt i manifestet; byggverktøy kan generere JSON fra utviklerens data **før deling**, men mottakeren skal ikke måtte kjøre spillets generator.

Hver modus har `id` (f.eks. `harbor-race-3-formula`), `title`, positiv `rulesVersion`, frosset JSON-`config` og scoredefinisjon. SDK-et gir spillet den valgte konfigurasjonen. Et enkelt spill trenger bare `standard` med tom `config`.

Valgfri `selectors` beskriver nedtrekksfelt, med `key`, `label` og `options`. Modusens `selection` angir én option per selector. Hver kombinasjon skal identifisere nøyaktig én modus; ugyldige/udeklarerte kombinasjoner deaktiveres. Dette lar racing tilby bane/bil/runder/format uten et racing-import i `play.js`. Uten selectors viser verten én vanlig modusvelger. Detaljerte spillmenyer og forklarende statsgrafikk kan tegnes inne i spillet.

## Identitet og regelendringer

**Topplistenøkkel:** `(game.id, mode.id, mode.rulesVersion)`. Lokal lagerstruktur bruker hele denne nøkkelen. Nye online-ID-er avledes deterministisk med [UUIDv5](https://www.rfc-editor.org/rfc/rfc9562.html#section-5.5): namespace = spillets UUID, name = UTF-8 `mode.id + ":" + rulesVersion`. Mappenavn, slug, omslag, pakkeversjon og komprimering påvirker ikke denne nøkkelen. Samme delte spill gir samme ID ved flere utrullinger; forskjellige backendinstallasjoner deler ikke automatisk data.

Unntaket er migrerte spill: valgfri `legacyGameId` i modusen bevarer eksisterende backend-UUID, og `legacyScoreUnit` bevarer eksisterende enhetsnavn også ved oppsett av en tom database. De to feltene brukes sammen og kontrolleres for kollisjon/kontraktavvik. Ingen ny spillutvikler trenger å sette disse feltene.

Legacyfeltene gjelder bare den første migrerte regelutgaven (`rulesVersion: 1`). Ved regelendring fjernes feltene og ny regelutgave får en avledet ID. Den gamle backend-ID-en skal aldri peke til nye regler.

`rulesVersion` økes ved endringer i poengregler, banegeometri, fart, bilfysikk, konkurranserelevante options eller annen logikk som gjør gamle rekorder usammenlignbare. Kosmetikk/feilretting uten konkurransevirkning kan beholde regelutgaven. Server og byggverktøy beregner et deklarativt regelfingeravtrykk fra modusens config, selection og konkurransedelene av score (feltnøkler, rekkefølge, min/maks, retning, radix/offset). Etiketter, formatering og enhetstekst inngår ikke. Samme nøkkel med endret fingeravtrykk avvises; verktøy kan ikke bevise at utvikleren har husket å øke versjonen ved en ren kodeendring.

Et separat `contentHash` over normaliserte manifestdata og publiserte filers stier/innhold identifiserer den eksakte kjørbare utgaven. Hashen brukes til integritetskontroll, caching og å feste pågående runder, ikke til å nullstille rekorder ved hvert nytt omslag. To mapper med samme spill-ID i samme installasjon er en feil. Fjernede regelutgaver beholder historiske rekorder og blir ikke gjenbrukt for nye regler.

## Score uten pakkede heltall i spillkoden

Spillet leverer et objekt som `{ points: 1200 }`, `{ timeMs: 48321 }` eller `{ position: 2, timeMs: 48321 }`. `score.fields` er en ordnet liste med 1–4 felter. Alle feltene rangerer: første felt er viktigst, neste bryter likhet. Hvert felt har nøkkel, etikett, heltallsgrenser `min`/`max`, `direction` og `format` (`integer` eller `duration-ms`). `unit` er valgfri ren tekst. Tall må være ikke-negative sikre JavaScript-heltall, ikke strenger eller flyttall. Ukjente/manglende scorefelter avvises.

For et løp angis `position` med `lower_is_better`, så `timeMs` med samme retning. Det gir plassering før tid uten at spillforfatteren koder `1000000 + time` selv. Sammenligning skjer leksikografisk, og helt like feltverdier gir delt plass.

Transport til eksisterende API er fortsatt ett heltall. Standard for ett felt er identitet og feltets retning. Flere felt får blandet grunntall med retningen til første felt som global retning. SDK/server deler samme rene encoder/decoder. Valgfrie `radix` på felt etter det første og `offset` på score støtter eksisterende kodingsprofiler. **Bare migreringsmanifest trenger disse feltene.** Se [online-designet](online-leaderboards.md#scorekoding-og-eksisterende-api). Produktet av feltbreddene og eventuelle radix-er skal gi kodet maksimum innen `Number.MAX_SAFE_INTEGER`; ellers avvises manifestet med råd om å redusere scoregrenser.

## Lokale navn

Normaliser innsendt navn til Unicode NFC, trim Unicode-blanktegn i endene, og krev 1–32 Unicode-kodepunkter. Tillat bokstaver, kombinerende tegn, sifre, vanlig mellomrom, `_`, `-` og `.`; avvis kontrolltegn, kun blanktegn og usynlige formateringstegn. Behold indre mellomrom. Identitetsnøkkelen er `NFC(displayName.toLowerCase())`, uten språkavhengig locale. Dette er en presis, enkel normalisering, ikke full Unicode case folding eller beskyttelse mot visuelt like tegn.

`" Ole "`, `"OLE"` og `"ole"` er samme lokale navn. `"Anne  Marie"` og `"Anne Marie"` er forskjellige. Visningsnavnet settes ved første rekord og endres til innsendt stavemåte ved en faktisk forbedring. Ingen eierskapskontroll finnes lokalt: alle ved maskinen kan forbedre samme alias. Online brukes fortsatt kontoens brukernavn og eksisterende kontoregler.

## Pakkeressurser og moduler

JavaScript er ES-moduler med statiske relative importer inne i pakken og den eneste bare importen `@microbit-games/sdk`. V1 tillater ikke fjernimport, pakkebehandlere ved installasjon, `eval`, workers, dynamisk import eller `fetch` for spillressurser. JSON/data lastes gjennom `assets.readJson`/`readText`; bilder og lyd via `assets.url`. Tilfeldig nettverkstilgang er ikke del av API-et.

`style.css` gjelder bare spilldokumentet. V1 bruker lokale inline regler uten `@import` eller CSS-`url()`; last bilder/fonter gjennom SDK-et. Dette holder første modul-/ressursprofil liten nok til å valideres og kjøre likt fra alle installasjoner. Standard nettleser-Canvas/DOM/Web Audio kan brukes inne i rammen. Eventuelle biblioteker må leveres ferdig som lokale moduler med lisens; de må fungere innenfor sandboxprofilen.

## Semantisk validering utover JSON Schema

Valider unike pakke-/modus-/selector-/felt-ID-er, gyldige selectorverdier og entydig selection, sammenheng mellom legacyfeltene, `min <= max`, codecens eksakte tallgrenser/radix/offset, og at minste viewport får plass i designets tilsiktede oppsett. Config må være vanlige JSON-data uten farlige objektfeltnavn (`__proto__`, `prototype`, `constructor`), høyst åtte nivåer og 16 KiB per modus. Rene tekstfelt må inneholde annet enn blanktegn. Filkontroll følger canonical paths innen pakken, avviser symlenker og verifiserer bildeinnhold, modulimporter og filbudsjetter. JSON Schema alene beviser ikke disse egenskapene.

Hashing må bruke én spesifisert kanonisering på begge sider: [JSON Canonicalization Scheme (RFC 8785)](https://www.rfc-editor.org/rfc/rfc8785), UTF-8 og SHA-256. Normaliser hashrelevante defaults (`offset=0`, utledet radix) før hashing. `contentHash` beregnes fra det kanoniske manifestet og en stisortert liste over publiserbare filer med innholds-SHA-256; `README.md`/tests og ZIP-containerens metadata inngår ikke. Metadatafilen inkluderes ikke to ganger som både manifest og fil. Manifestets `version` inngår i contentHash, men ikke i topplistenøkkelen. Samme regler brukes av dev/build og synkroniseringsverktøy.
