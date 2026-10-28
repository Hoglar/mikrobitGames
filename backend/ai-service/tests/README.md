# Supplerende regresjonskontroller for AI-implementasjonen

Disse kontrollene dekker feilen der SQLGlot klassifiserer `AND`, `OR` og `EXISTS`
som funksjoner, og kontrollerer at nestet forbudt SQL fortsatt avvises.
De kontrollerer også at ukjente kolonner, udefinerte tabellalias og tvetydige
referanser avvises før en databaseforbindelse åpnes. Gyldige JOIN-er, CTE-er,
delspørringer, aggregater og vindusfunksjoner skal fortsatt tillates, uten at
referansekontrollen omskriver SQL-en som kjøres.

Kjør fra prosjektroten:

```bash
.venv/bin/python -m unittest discover -s backend/ai-service/tests -v
```

De kjøres separat fra det faste, versjonerte FoM-kontrollsettet under
`backend/tests/`. De gir ingen FoM-poeng og endrer ikke nevneren eller
forventningene i baseline. `./backend/check` brukes fortsatt for full måling.
