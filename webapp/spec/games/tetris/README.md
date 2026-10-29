# Micro Tetris

Moderne, endeløs Tetris med Micro:bit-styring, fargede retrobrikker, hold-visning på Micro:bit og Korobeiniki-melodi fra enhetens høyttaler. Nettleseren spiller separate handlingseffekter.

**Status 2026-10-29:** Implementert lokalt med automatiserte regel-, output- og nettlesertester. Se [kodeveiledningen](../../../src/games/tetris/README.md) og [valideringsrapporten](../../../results/tetris-validation.md). Fysisk V2-akseptanse, katalogregistrering og publisering av denne varianten gjenstår. Moderne endless-regler, poengstyrt fart, A = hard drop, B = 90° med klokken, logo = hold, rangert/øving, direkte restart og to separate lydvalg som starter på er avklart. Numeriske balanse-/effekt-/lydverdier er en versjonert startprofil til fysisk utprøving.

- [Spesifikasjon](specification.md): funksjon, styring, resultat og krav WEB-049–WEB-068.
- [Spillregler og presentasjon](game-design.md): brett, SRS, T-spins, poeng, progresjon, grafikk, displaybilder og musikk.
- [Implementasjonsdesign](implementation-design.md): motor, input, tidsmodell, outputplanlegging og integrasjon med dagens webapp.
- [Testplan](test-plan.md): TT-01–TT-20 og akseptanseevidens, inkludert fysisk musikk/display.

Dette er en eksplisitt prosjektprofil av moderne single-player-regler. «Alle Tetris-regler» brukes ikke som en udefinert fasit: spillutgaver varierer. Profilen inkluderer 7-bag, SRS-rotasjon/kicks, hold, ghost, fem next-brikker, T-spin/Mini, combo, back-to-back og perfect clear. Poengbaserte nivåer og Micro:bit-kontrollene er avtalte tilpasninger. Ingen multiplayer, garbage-angrep, soft-drop-knapp, motklokkerotasjon eller 180°-knapp inngår i første versjon.
