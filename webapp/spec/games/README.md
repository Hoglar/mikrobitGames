# Spillspesifikasjoner

Hvert spill får en egen mappe under `games/<game-name>/`, med spesifikasjon, teoretisk implementasjon og testplan. Felles kontrakter refereres fremfor å kopieres.

- [Micro:bit Testlab](microbit-testlab/README.md): fri testflate for input, output og kommunikasjon med Micro:bit.
- [Viking Dash](viking-dash/README.md): endless runner med vikingtema, seed-baserte baner og rangert/øving.
- [Micro Snake](micro-snake/README.md): Snake med tre moduser, Competitive/Random og rangering etter mat og steg.
- [Micro Tetris](tetris/README.md): implementert moderne endless-spill med tilt, SRS/T-spins, hold-display og nivåstyrt Micro:bit-musikk. Programvaretestet; fysisk akseptanse og utrulling gjenstår.
- [Micro Racer](micro-racer/README.md): lokalt implementert top-down racing med roterende følgekamera, tre bilklasser/baner, 1/3 runder, tidskjøring og firebilers AI-løp. Fysisk akseptanse og utrulling gjenstår.

[Spillkassett-/SDK-spesifikasjonen](../game-cartridges/README.md) gjelder felles integrasjon av alle spill: mapper med manifest og omslag, én bibliotekinngang, lokale rekorder og automatisk katalogoppdatering. Den endrer ikke spillreglene i dokumentene over.

Krav følger webappens felles `WEB-xxx`-nummerering. Testlab bruker WEB-001–WEB-016, Viking Dash WEB-017–WEB-032, Micro Snake WEB-033–WEB-048, Micro Tetris WEB-049–WEB-068, Micro Racer WEB-069–WEB-092 og spillkassetter/SDK WEB-093–WEB-124; neste ledige ID er WEB-125. Øvrig organisering følger [prosjektstrukturen](../../../docs/project-structure.md).
