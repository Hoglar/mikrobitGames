# Micro Tetris: utilsiktet logo-hold

**Dato:** 2026-11-05. Brukeren reproduserte logo-press ved å berøre et lite punkt
på en komponent på baksiden, nær øvre venstre hjørne av micro:bit. Dette forklarer
de observerte utilsiktede hold-handlingene som fysiske inputrapporter.

Det midlertidige filteret som krevde lengre logoberøring og stabilt slipp er
fjernet fordi det gjorde kontrollene mindre responsive. Logo-press gir igjen
hold i neste simuleringssteg, også for raske berøringer som er avsluttet før
snapshot mottas. Samtidig logo+B+A bruker rekkefølgen hold, rotasjon og drop.

Tiltforbedringene med stabilisering, langsommere repetisjon og beskyttelse mot
sideflytting ved drop er beholdt. Firmware og det delte inputbiblioteket er uendret.

Webbygget, 29 Tetris-spesifikke Node-tester og fem browser-tester bestod etter
fjerningen. Testen for samtidig logo+B+A verifiserer hold uten ekstra ventetid.
