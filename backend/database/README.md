# Database

Databaseimplementasjonen er en intern del av backend.

- [migrations/](migrations/README.md): versjonerte endringer i skjema, visninger og tilgangsrettigheter.
- [seeds/](seeds/README.md): syntetiske test- og demodata.

PostgreSQL **17** er valgt for både test og senere drift. Datamodeller ligger i [backend/spec/models](../spec/models/README.md), og tester i [backend/tests](../tests/README.md). [Oppsett](../SETUP.md) beskriver filplasseringer og tjenestebrukere.

`001_initial.sql` oppretter tabeller, begrensninger, indekser, AI-visninger og rettigheter. En separat administrator oppretter først innloggingsrollene `backend_app` og `ai_reader` med forskjellige SCRAM-passord. Migreringene kjøres i filnavnrekkefølge på tom database med `psql -X -v ON_ERROR_STOP=1`. Testpakken håndterer dette automatisk; migrering er aldri automatisk del av tjenesteoppstart eller reboot.

`manage-game.py` er et separat vedlikeholdsverktøy med `MBG_ADMIN_DSN`, uten HTTP-endepunkt. Eksempel: `.venv/bin/python backend/database/manage-game.py create --name Poengjakt --unit points --direction higher_is_better --min 0 --max 100000`. Det låser spill før regelendring/sletting og avviser slike endringer etter første forsøk eller rekord.

For sikkerhetskopi: `MBG_ADMIN_DSN` leses fra beskyttet konfigurasjon; kjør `backend/database/backup.sh /beskyttet/sti/ny-kopi.dump`. Filen opprettes privat og eksisterende filer overskrives ikke. Oppbevar minst én kopi på en annen disk.

For gjenoppretting: stopp tjenesten, opprett en separat tom måldatabase med de samme rollene, sett `MBG_ADMIN_DSN` til målet, og kjør `backend/database/restore.sh /beskyttet/sti/kopi.dump`. Verktøyet stopper ved feil og sletter gjenopprettede sesjoner. Kontroller og utfør kontoslettinger som skjedde etter kopitidspunktet før en eventuell offentlig gjenåpning. Ingen automatisk gjenåpning inngår. `MBG_POSTGRES_BIN` kan overstyre standard `/usr/lib/postgresql/17/bin`.
