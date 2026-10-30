# Micro Racer

Top-down arkaderacing med Micro:bit: vipp som et ratt, hold B for gass og A for brems. Velg bane, én eller tre runder, bilklasse og enten tidskjøring eller løp mot tre AI-biler. Kameraet følger og roterer med spillerens bil.

**Status 2026-10-30:** Spesifikasjon og foreslått implementasjonsdesign. Ingen spillkode, katalogregistrering eller målte testresultater inngår i denne leveransen. Dokumentasjonen er skrevet på norsk i tråd med [prosjektstrukturen](../../../../docs/project-structure.md).

- [Spesifikasjon](specification.md): funksjon, styring, resultatregler og krav WEB-069–WEB-092.
- [Spilldesign](game-design.md): tre foreslåtte baner, bilprofiler, fysikk, AI, kamera og presentasjon.
- [Implementasjonsdesign](implementation-design.md): moduler, simulering, input, plattform og katalogintegrasjon.
- [Testplan](test-plan.md): MR-01–MR-24, konkrete resultatvektorer og fysisk akseptanse.

## Avklarte produktvalg

| Tema | Avklart med brukeren |
| --- | --- |
| Løpsformater | Både solo tidskjøring og løp mot AI. |
| Løpslengde | Én og tre runder på hver bane. |
| Styring | Relativ venstre/høyre-styring med tilt; B gir gass, A bremser. |
| Kamera | Ovenfra, følger bilen og roterer med bilens retning. |
| Bilklasser | Driftbil, racerbil og formelbil med forskjellig grep, akselerasjon og toppfart. |
| AI-løp | Fire biler totalt: spilleren og tre AI-biler, én fast vanskelighetsgrad. |
| Kontakt | Fysiske kollisjoner mellom bilene i AI-løp. |
| Rangering | Tidskjøring: lavest totaltid. AI-løp: plassering først, deretter lavest totaltid. |
| Topplister | Separate per bilklasse, bane, rundetall og løpsformat. |

Tre startbaner, detaljert fysikk/balanse, startoppstilling, banegjenoppretting, lyd og grafikk er **forslag til første profil**, ikke ytterligere bekreftede brukerkrav eller fysisk kalibrerte verdier. Ingen lisensiert bilmodell eller virkelig racingserie er nødvendig; formelbilen kan ha et eget F1-inspirert arkadeutseende.

Med de tre foreslåtte banene blir det `3 baner × 2 rundetall × 3 bilklasser × 2 formater = 36` konkurransevarianter. De grupperes som én kassett i spillhyllen. Før implementasjon starter bør brukeren gjennomgå forslagene i [spilldesignet](game-design.md); videre balansejustering dokumenteres som endringer av profilen.
