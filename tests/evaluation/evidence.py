"""Readable descriptions and inventories from the evidence saved in each run."""
import json
import re
import xml.etree.ElementTree as ET


SCOPES = {
    'web-unit': ('Webapp og spillregler', 'API-klient, resultatkø og omforsøk, spillregister, spillmotorer og lyd/livssyklus.', 'JavaScript i Node; ingen nettleser, levende API eller fysisk micro:bit.'),
    'input-unit': ('Inputbibliotek', 'Protokoll, meldingsframing, tilstand, knapper, sensorer, sesjoner og reconnect.', 'Simulert transport og klokke; ingen USB.'),
    'backend-unit': ('Backendregler', 'Innlogging, validering, poeng/rangering, AI-samtale og tillatte databaseoppslag.', 'Enhetstester; ingen levende PostgreSQL eller Qwen.'),
    'firmware': ('Firmware på vertsmaskinen', 'C++-kjerne, protokollfixtures og serialharness gjennom CTest.', 'Simulert maskinvare; ingen fysisk micro:bit.'),
    'cross-component': ('Koblinger mellom komponenter', 'C++-meldinger gjennom ekte webapp-parser, kommando/kvittering og spillgrenser mot Python-validering.', 'Vertssimulator og testdata; ingen fysisk USB eller produksjonsdatabase.'),
    'browser-app': ('Brukerforløp i nettleseren', 'Spillstart, pause/reconnect, poenginnsending, konto, Dashboard, topplister, AI-visning og mobiloppsett.', 'Chromium med simulerte API-svar og Web Serial; verifiserer ikke produksjonsinnlogging eller AI-svarkvalitet.'),
    'browser-input': ('Input i nettleseren', 'Produksjonsadapter, native Streams, sesjoner, feil/opprydding og input-replay.', 'Chromium med simulert Web Serial; ingen fysisk USB.'),
    'platform-capacity': ('Kapasitet og opptak', '50/500 Hz, bufferomløp og eksport. Korrekthetskravene inngår i F.', 'Akselerert logisk tid; rå CPU-tider har ikke eget ytelsesbudsjett.'),
    'input-benchmark': ('Inputytelse i Node', '50/500 Hz × én/fire abonnenter; 300 sekunder logisk tid per profil etter oppvarming.', 'Fra komplett linje til callback; ingen USB eller nettverk. Budsjett hentes fra den lagrede målingen.'),
    'games-benchmark': ('Spillsimulering på CPU', 'Fast seed, opprettelse og simuleringssteg; 100 oppvarminger og 1000 prøver per spill.', 'Ingen Canvas/GPU eller målt FPS. Budsjettet gjelder hele arbeidsmengden.'),
    'browser-performance': ('Inputytelse i Chromium', 'Samme fire replayprofiler med native Streams og lagrede percentiler.', 'Ingen fysisk USB eller nettverkslatens.'),
    'backend-full': ('Levende API, database og AI i testmiljø', 'Backendens integrasjonstester og HTTP-/DB-/AI-benchmarks; egen rårapport.', 'Isolert backend-testmiljø; dette er et tillegg til standardprofilen.'),
}


def scope(check):
    saved = check.get('scope')
    return saved or SCOPES.get(check['id'], (check['id'], 'Se registrert kommando og logg.', 'Ingen videre dekning utledes fra gruppenavnet.'))


def cases_from_log(log, kind):
    if kind == 'junit':
        path = log.with_suffix('.xml')
        if not path.is_file():
            return []
        rows = []
        for case in ET.parse(path).getroot().iter('testcase'):
            status = 'FAIL' if case.find('failure') is not None or case.find('error') is not None else 'SKIP' if case.find('skipped') is not None else 'PASS'
            rows.append(dict(name=case.get('name', ''), suite=case.get('classname', ''),
                             status=status, seconds=case.get('time')))
        return rows
    if not log.is_file():
        return []
    text = log.read_text(encoding='utf-8', errors='replace')
    if kind == 'tap':
        return [dict(name=m[2], status='SKIP' if m[3] else 'FAIL' if m[1] else 'PASS')
                for m in re.finditer(r'^(not )?ok \d+ - (.*?)(\s+# (?:SKIP|TODO).*)?$', text, re.M)]
    if kind == 'python':
        rows = []
        starts = list(re.finditer(r'^(\w+) \(([^\n]+)\)', text, re.M))
        for i, match in enumerate(starts):
            end = starts[i + 1].start() if i + 1 < len(starts) else len(text)
            # unittest puts a test's docstring on a separate line before "... ok".
            result = re.search(r'\.\.\. (ok|FAIL|ERROR|skipped[^\n]*|expected failure|unexpected success)\s*$', text[match.end():end], re.M)
            if result:
                status = result[1]
                rows.append(dict(name=match[1], suite=match[2], status='PASS' if status == 'ok' else 'SKIP' if status.startswith(('skipped', 'expected failure')) else 'FAIL'))
        return rows
    return []


def cases(check, folder):
    if 'cases' in check and len(check['cases']) >= check.get('counts', {}).get('tests', 0):
        return check['cases']
    name = check['id']
    kind = 'junit' if name in ('browser-app', 'browser-input', 'firmware') else 'python' if name == 'backend-unit' else 'tap'
    try:
        parsed = cases_from_log(folder / check.get('log', 'missing.log'), kind)
        return parsed if len(parsed) > len(check.get('cases', [])) else check.get('cases', [])
    except (OSError, ET.ParseError):
        return check.get('cases', [])  # Interrupted XML cannot supply a complete inventory.


BENCHMARKS = {
    'platform-benchmark.json': ('platform-capacity', 'Plattform og opptak'),
    'input-benchmark.json': ('input-benchmark', 'Input i Node'),
    'games-benchmark.json': ('games-benchmark', 'Spillsimulering'),
    'browser-benchmark.json': ('browser-performance', 'Input i Chromium'),
}


def benchmark_details(report, folder):
    """Raw data may exist after interruption without a completed/scored group."""
    checks = {c['id']: c for c in report['checks']}
    output = []
    for filename, (check_id, title) in BENCHMARKS.items():
        path = folder / filename
        if not path.is_file():
            continue
        try:
            data = json.loads(path.read_text(encoding='utf-8'))
        except (OSError, ValueError):
            continue
        rows = []
        for row in data.get('measurements', []):
            latency = row.get('propagationMs', row.get('latencyMs', {}))
            name = row.get('name', f"{row.get('rateHz', '?')} Hz · {row.get('subscribers', '?')} abonnenter")
            rows.append(dict(name=name, count=row.get('count', row.get('snapshots')),
                             logical_seconds=row.get('logicalDurationSeconds'),
                             p50=latency.get('p50', row.get('p50Ms')), p95=latency.get('p95', row.get('p95Ms')),
                             p99=latency.get('p99', row.get('p99Ms')), maximum=latency.get('max', row.get('maxMs')),
                             throughput=row.get('messagesPerSecond', row.get('operationsPerSecond'))))
        output.append(dict(title=title, filename=filename, method=data.get('method', ''),
                           status=checks.get(check_id, {}).get('status', 'IKKE FULLFØRT'), rows=rows))
    return output
