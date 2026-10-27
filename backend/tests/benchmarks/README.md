# Benchmark

Inngår automatisk i `./backend/check`; hoppes over ved `quick`. Full belastningsprofil følger kontrakt 1.4. Målinger gjøres på serveren og lagres i rapportens rådata, også når terskler overskrides.

Hver fase starter med 1 000 spillere, 10 spill, 10 000 rekorder og 10 000 tilhørende fullførte forsøk. Hver resultatforespørsel bruker ny forsøks-ID, `status: completed` og en gyldig verdi; HTTP 201 kreves også når forsøket ikke forbedrer rekorden. Omforsøk med samme ID testes separat i integrasjonstestene. Rapporten viser både startvolum og sluttvolum for rekorder/forsøk.

HTTP-tid, DB-tid, utsendingsforsinkelse og feil er forskjellige felter. API-ets DB-instrumentering måler poolventing til ferdig operasjon/commit. En rask feil teller fortsatt som feil. P95 bruker nærmeste rang: sortér målingene og velg `ceil(0.95 × antall)`.

Virkelig AI prøves med ett separat kaldt kall, deretter tre varme runder av de tre faste spørsmålene fra AI-planen. Format, ID, status, lengde og 60-sekundersgrense kontrolleres. Modellens faktapåstander er ikke fullstendig vurdert av disse maskinkontrollene.

Se [kjøreguiden](../../verification/README.md) for oppsett og forventet varighet.
