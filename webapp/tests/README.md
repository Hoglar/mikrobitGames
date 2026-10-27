# Tester for webappen

Fra `webapp/`, med Node 24.22.1 og npm 11.19.1:

```sh
npm ci
npm test
npm run benchmark
```

Ingen tredjepartsavhengigheter eller fysisk enhet kreves. `tests/unit/` tester det leverte regel-/opptaksgrunnlaget mot deler av TWEB/TLAB. Se [implementasjonsplanens dekningsmatrise](../spec/implementation-plan.md). Test-ID i testnavn betyr deldekning, ikke at hele akseptansescenarioet er bestått.

Adapter/fake transport, nettlesermock, ekte backend og fysiske tester er ikke implementert. [GI-planen](../spec/game-input-test-plan.md), [plattformplanen](../spec/platform-test-plan.md) og [TLAB-planen](../spec/games/microbit-testlab/test-plan.md) styrer videre utvidelse. Programvaretester skal alltid kjøre uten hardware.
