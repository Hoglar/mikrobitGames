# Krav, modeller og testplan

Utarbeid requirements.md med funksjonelle krav og kvalitetskrav. [Testplanen](game-input-test-plan.md) beskriver testing og benchmarking av det felles spillinput-biblioteket. Modeller lagres under [models/](models/README.md). Referer til relevante felles kontrakter fremfor å kopiere dem.

[Spillspesifikasjoner](games/README.md) samles i `games/<game-name>/`. Første spill er [Micro:bit Testlab](games/microbit-testlab/README.md).

[Implementeringsplanen for JavaScript-biblioteket](game-input-implementation-plan.md) beskriver modulstruktur, leveranserekkefølge, tester og integrasjon med spillplattformen. Planen følger [Micro:bit-grensesnittet](../../spec/contracts/microbit-webapp/web-page-developer-interface.md) og bruker V2-only ES-moduler uten frontendrammeverk som kjøretidsavhengighet. Bibliotek og verktøy er ennå ikke implementert.
