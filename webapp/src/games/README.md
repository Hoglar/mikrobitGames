# Spillkode

Hvert spill har en egen mappe med `index.js` som inngang. Spillspesifikke filer,
som grafikk og lyd, ligger sammen med spillmotoren.

```text
games/
├── registry.js
├── shared/
│   ├── random.js
│   └── canvas.js
├── viking-dash/
│   ├── index.js
│   ├── scene.js
│   ├── audio.js
│   └── style.css
├── snake/index.js
├── stars/index.js
├── reaction/index.js
└── balance/index.js
```

`registry.js` kobler stabile katalog-ID-er og spillnøkler til riktig modul.
`shared/` inneholder hjelpefunksjoner som flere spill bruker. Spillmotorer følger
det felles grensesnittet beskrevet i [implementasjonsnotatet](../../spec/webapp-implementation.md).
Spillets CSS ligger også i spillmappen og importeres fra appens stilark.
Spesifikasjoner ligger under [spec/games](../../spec/games/README.md), og tester
under `webapp/tests/`.
