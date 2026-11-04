"""A plain-language overview derived from saved runs; never fills missing scores."""
import html
import json

UNITS = {'web-unit': 'Webapp og spill', 'input-unit': 'Inputbibliotek', 'backend-unit': 'Backend'}


def number(value, digits=2):
    return '—' if value is None else f'{value:.{digits}f}'.replace('.', ',')


def unit_result(run):
    checks = {c['id']: c for c in run['checks']}
    groups = [checks.get(name, {}) for name in UNITS]
    valid = run.get('selftest') == 'PASS' and all(
        c.get('status') in ('PASS', 'FAIL') and c.get('counts', {}).get('tests', 0) > 0 for c in groups)
    totals = {key: sum(c.get('counts', {}).get(key, 0) for c in groups)
              for key in ('tests', 'passed', 'failed', 'skipped')}
    return dict(valid=valid, groups=groups, **totals)


def metric_group(name):
    return 'browser-performance' if name.startswith('browser-input-') else 'input-benchmark' if name.startswith('input-') else 'games-benchmark'


def metric_result(run, name):
    metric = next((m for m in run.get('metrics', []) if m['name'] == name), None)
    check = next((c for c in run['checks'] if c['id'] == metric_group(name)), {})
    valid = metric is not None and run.get('selftest') == 'PASS' and check.get('status') in ('PASS', 'FAIL')
    return dict(metric=metric, valid=valid)


def title(name):
    games = {'snake': 'Micro Snake', 'viking': 'Viking Dash', 'stars': 'Stjernefangst',
             'reaction': 'Reaksjonsjakt', 'balance': 'Balanseløypa', 'tetris': 'Micro Tetris'}
    if name in games:
        return games[name]
    return name.replace('browser-input-', 'Chromium · ').replace('input-', 'Node · ').replace('-abonnenter', ' abonnenter').replace('Hz-', ' Hz · ').replace('1 abonnenter', '1 abonnent')


def baseline_indices(runs):
    first = {}
    for i, run in enumerate(runs):
        if run['summary']['fom'] is not None:
            first.setdefault(run['series'], i)
    return set(first.values())


def state(run):
    if run.get('selftest') != 'PASS':
        return 'Måleverktøyets egenkontroll feilet / mangler'
    return {'BLOCKED': 'Ufullstendig kjøring', 'AWAITING_UX': 'Venter på brukerskår',
            'COMPLETE': 'Komplett måling'}.get(run['summary']['status'], run['summary']['status'])


def run_label(index, run):
    stamp = run['timestamp']
    return f'K{index + 1} · {stamp[:10]} {stamp[11:16]} UTC'


def build_overview(runs):
    baselines = baseline_indices(runs)
    complete = [r for r in runs if r['summary']['fom'] is not None]
    latest = complete[-1] if complete else None
    metrics = list(dict.fromkeys(m['name'] for r in runs for m in r.get('metrics', [])))
    rows = []
    for i, run in enumerate(runs):
        rows.append(dict(run=run, label=run_label(i, run), baseline=i in baselines,
                         units=unit_result(run), state=state(run)))
    if not complete:
        message = 'Ingen komplett FoM ennå. Første komplette måling med brukerskår blir baseline for sin serie.'
    elif len(complete) == 1:
        message = (f'Baseline er {number(latest["summary"]["fom"])} av 100. Vi har bare én komplett FoM-måling. '
                   'Derfor viser grafen ett punkt; utvikling i samlet FoM er ennå ikke målt.')
    else:
        message = (f'Vi har {len(complete)} komplette FoM-målinger fordelt på {len(baselines)} serier. '
                   'Første komplette punkt i hver serie er baseline. Bare punkter med samme målegrunnlag kobles sammen.')
    return dict(rows=rows, metrics=metrics, latest=latest, message=message)


def table(headers, rows):
    return '<div class="scroll"><table><thead><tr>' + ''.join(f'<th>{h}</th>' for h in headers) + '</tr></thead><tbody>' + ''.join(
        '<tr>' + ''.join(f'<td>{v}</td>' for v in row) + '</tr>' for row in rows) + '</tbody></table></div>'


def overview(root, runs):
    """Return the HTML dashboard, write its GitHub version and portable plots."""
    from trend_plots import plots
    data = build_overview(runs)
    available = plots(root, runs, data)
    esc = lambda value: html.escape(str(value), quote=True)
    md = ['# Resultatutvikling', '', data['message'], '',
          '[Åpne den interaktive oversikten](index.html) · [Detaljert historikk](history.md)', '',
          '## 1. FoM – samlet kvalitet', '',
          'Høyere er bedre. FoM kombinerer funksjonstester (50 %), benchmarkytelse (30 %) og brukeropplevelse (20 %). '
          'En komplett måling kan fortsatt ha feil. Avbrutte kjøringer er ikke null poeng.', '']

    def figure(filename, description):
        if filename not in available:
            return '<p>Grafen kunne ikke genereres uten Matplotlib. Alle tall er tilgjengelige i tabellen.</p>'
        return f'<figure><img class="trend-plot" src="{filename}" alt="{esc(description)}"><figcaption><a href="{filename}">Last ned graf (SVG)</a></figcaption></figure>'

    def md_figure(filename, description):
        if filename in available:
            md.extend([f'![{description}]({filename})', ''])

    def md_table(headers, rows):
        def cell(v):
            return str(v).replace('|', '\\|').replace('\n', ' ')
        md.extend(['| ' + ' | '.join(headers) + ' |', '| ' + ' | '.join('---' for _ in headers) + ' |'])
        md.extend('| ' + ' | '.join(cell(v) for v in row) + ' |' for row in rows)
        md.append('')

    # An archived summary is evidence, not a replacement for an original run.
    # Keep it out of load_runs(), scoring, baseline selection and connected curves.
    archive_path = root / 'baseline-summary-2026-10-30.json'
    archive = json.loads(archive_path.read_text(encoding='utf-8')) if archive_path.is_file() else None

    fom_rows, plain_fom, unit_rows, plain_units = [], [], [], []
    for row in data['rows']:
        run, s = row['run'], row['run']['summary']
        link = f'runs/{run["id"]}/report.html'
        status = row['state'] + (' · Baseline for serien' if row['baseline'] else '')
        failures = sum(c['status'] == 'FAIL' for c in run['checks'])
        if failures:
            status += f' · {failures} {"testgruppe" if failures == 1 else "testgrupper"} med feil'
        # Partial F/P averages are intentionally kept in detailed reports only.
        values = [number(s['fom']), number(s['function']) if s['technical'] is not None else 'Ufullstendig',
                  number(s['performance']) if s['technical'] is not None else 'Ufullstendig',
                  number(s['ux'] / 10, 1) if s['ux'] is not None else '—', status]
        fom_rows.append([f'<a href="{esc(link)}">{esc(row["label"])}</a>'] + [esc(v) for v in values])
        plain_fom.append([f'[{row["label"]}](runs/{run["id"]}/report.md)'] + values)
        u = row['units']
        counts = [f'{c["counts"]["passed"]}/{c["counts"]["tests"]}' if c.get('counts', {}).get('tests') else '—' for c in u['groups']]
        recorded = f'{u["passed"]}/{u["tests"]}' if u['tests'] else '—'
        note = ('Gjennomført; samlet kjøring ufullstendig' if s['status'] == 'BLOCKED' else 'Gjennomført') if u['valid'] else 'Uverifiserte / manglende tall'
        unit_values = counts + [recorded, str(u['failed']) if u['tests'] else '—', str(u['skipped']) if u['tests'] else '—', note]
        unit_rows.append([esc(row['label'])] + [esc(v) for v in unit_values])
        plain_units.append([row['label']] + unit_values)

    headers = ['Kjøring', 'FoM / 100', 'Funksjon / 100', 'Ytelse / 100', 'Brukerskår / 10', 'Forklaring']
    md_figure('fom-development.svg', 'FoM fra baseline; ingen poeng for ufullstendige kjøringer')
    md_table(headers, plain_fom)
    body = f'''<h1>Hvordan utvikler prosjektet seg?</h1>
<p class="lead">{esc(data['message'])}</p>
<nav class="trend-nav"><a href="#fom">1. FoM</a><a href="#unit-development">2. Enhetstester</a><a href="#benchmark-development">3. Benchmarks</a><a href="#run-key">Kjøringer og detaljer</a></nav>
<p><a href="overview.md">Les oversikten i GitHub / Markdown</a></p>
<section id="fom"><h2>1. FoM – samlet kvalitet</h2><p>Høyere er bedre. Funksjonstester teller 50 %, benchmarkytelse 30 % og brukeropplevelse 20 %. En komplett måling kan fortsatt ha feil.</p>
{figure('fom-development.svg', 'FoM-punkter fra første komplette måling i hver serie')}
{table(headers, fom_rows)}<p>Ufullstendig betyr at nødvendige målinger mangler. Det betyr ikke null poeng. Første komplette punkt i hver serie er baseline; det endrer ingen lagrede resultater.</p></section>'''
    if archive:
        archive_summary = archive['summary']
        reference = (f'Det finnes også en eldre teknisk baseline fra {archive["timestamp"][:10]}: '
                     f'teknisk skår {number(archive_summary["technical"])}/100, '
                     f'FoM {number(archive_summary["fom"])}. Den mangler brukerskår. '
                     f'Dette er et arkivert sammendrag fra en annen maskin ({archive["environment"]["cpu"]}), '
                     'ikke en ny kjøring. Den kobles ikke til punktene ovenfor.')
        body += f'<section id="archived-baseline"><h2>Den tidligere tekniske baselinen</h2><p>{esc(reference)}</p><p><a href="baseline-summary-2026-10-30.json">Lagret målesammendrag</a> · <a href="validation-2026-10-30.md">Forklaring av første verifisering</a></p></section>'
        md.extend(['### Den tidligere tekniske baselinen', '', reference, '',
                   '[Lagret målesammendrag](baseline-summary-2026-10-30.json) · [Første verifisering](validation-2026-10-30.md)', ''])

    unit_intro = ('Her teller vi enhetstestene for webapp, inputbibliotek og backend. Tallene er bestått / antall tester. '
                  'Firmware, integrasjon, nettleserforløp og måleverktøyets egenkontroll vises separat i detaljrapportene. '
                  'Flere tester viser et større testsett, ikke automatisk bedre kode eller høyere testdekning.')
    valid_units = [r['units'] for r in data['rows'] if r['units']['valid']]
    change = ''
    if valid_units:
        first, last = valid_units[0], valid_units[-1]
        change = (f'Første registrerte enhetstestmåling: {first["passed"]}/{first["tests"]}. '
                  f'Siste: {last["passed"]}/{last["tests"]}. Antall tester har endret seg med {last["tests"]-first["tests"]:+d}. '
                  f'Siste måling har {last["failed"]} feil og {last["skipped"]} utelatte tester.')
    if archive:
        archive_counts = [c['counts'] for c in archive['checks'] if c['id'] in UNITS]
        change += (f' Den arkiverte tekniske baselinen hadde også '
                   f'{sum(c["passed"] for c in archive_counts)}/{sum(c["tests"] for c in archive_counts)} enhetstester bestått.')
    unit_headers = ['Kjøring', *UNITS.values(), 'Totalt bestått / antall', 'Feil', 'Utelatt', 'Datagrunnlag']
    body += f'''<section id="unit-development"><h2>2. Enhetstester – antall og resultat</h2><p>{esc(change)}</p><p>{esc(unit_intro)}</p>
{figure('unit-development.svg', 'Beståtte og feilede enhetstester per kjøring')}{table(unit_headers, unit_rows)}</section>'''
    md.extend(['## 2. Enhetstester – antall og resultat', '', change, '', unit_intro, ''])
    md_figure('unit-development.svg', 'Utvikling i antall enhetstester')
    md_table(unit_headers, plain_units)

    benchmark_intro = ('Lavere p95 i millisekunder er bedre: 95 % av prøvene var like raske eller raskere enn dette. '
                       'Vi viser rå tid fordi ytelsesskåren stopper på 100 når budsjettet er nådd. '
                       'To målinger kan derfor få 100 poeng og likevel ha forskjellig kjøretid.')
    caveat = ('Tall fra fullførte delmålinger i avbrutte kjøringer vises med åpne punkter. '
              'Tall fra en kjøring der måleverktøyets egenkontroll feilet, er merket uverifisert og utelates fra grafene. '
              'Bare samme serie kobles med linjer. Endret testgrunnlag eller miljø gir ny serie; forskjeller alene beviser ikke at produktet ble raskere. '
              'Dette måler CPU-arbeid og input med testdata, ikke FPS, fysisk USB eller responstid over internett.')
    benchmark_summary = ''
    if data['latest']:
        measured = [m for m in data['latest'].get('metrics', []) if metric_result(data['latest'], m['name'])['valid']]
        if measured:
            within = sum(m['value'] <= m['budget'] for m in measured)
            benchmark_summary = (f'I siste komplette FoM-måling ligger {within} av {len(measured)} benchmarkprofiler innenfor tidsbudsjettet. '
                                 'Se utviklingen for hver profil nedenfor; ikke sammenlign ulike arbeidsmengder direkte.')
    body += f'<section id="benchmark-development"><h2>3. Benchmarks – faktisk kjøretid</h2><p>{esc(benchmark_summary)}</p><p>{esc(benchmark_intro)}</p><p>{esc(caveat)}</p>'
    md.extend(['## 3. Benchmarks – faktisk kjøretid', '', benchmark_summary, '', benchmark_intro, '', caveat, ''])
    choices, panels, metric_rows, plain_metrics = [], [], [], []
    for j, name in enumerate(data['metrics']):
        filename = f'benchmark-{j+1:02d}.svg'
        choices.append(f'<option value="benchmark-panel-{j}">{esc(title(name))}</option>')
        panels.append(f'<div id="benchmark-panel-{j}" class="benchmark-panel" {"hidden" if j else ""}>{figure(filename, title(name) + ": p95 i millisekunder")}</div>')
        values = []
        for row in data['rows']:
            result = metric_result(row['run'], name)
            metric = result['metric']
            value = '—' if metric is None else number(metric['value'], 4) + (' †' if not result['valid'] else ' *' if row['run']['summary']['status'] == 'BLOCKED' else '')
            values.append(value)
        budgets = sorted({m['budget'] for r in runs for m in r.get('metrics', []) if m['name'] == name})
        budget = ' / '.join(number(v, 4) for v in budgets)
        label = f'<a href="{filename}">{esc(title(name))}</a>' if filename in available else esc(title(name))
        if archive:
            reference_metric = next((m for m in archive.get('metrics', []) if m['name'] == name), None)
            values.insert(0, number(reference_metric['value'], 4) if reference_metric else '—')
        metric_rows.append([label, esc(budget)] + [esc(v) for v in values])
        plain_metrics.append([f'[{title(name)}]({filename})' if filename in available else title(name), budget] + values)
    bench_headers = ['Profil', 'Budsjett ms'] + (['Arkivbaseline p95 ms'] if archive else []) + [f'K{i+1} p95 ms' for i in range(len(runs))]
    if choices:
        body += '<label for="benchmark-select">Velg målingen du vil se i grafen</label><br><select id="benchmark-select">' + ''.join(choices) + '</select>' + ''.join(panels)
    body += table(bench_headers, metric_rows) + '<p>* Fullført delmåling, men samlet kjøring er ufullstendig. † Uverifisert; egenkontroll eller delmåling manglet/bestod ikke. — Ikke målt.</p><p>Spillbenchmarken dekker de lagrede spillprofilene i tabellen. Micro Racer har foreløpig ingen CPU-benchmarkprofil.</p></section>'
    md_table(bench_headers, plain_metrics)
    if archive:
        note = 'Kolonnen «Arkivbaseline» er fra det tidligere målesammendraget på en annen PC. Den er en referanse, ikke et punkt i disse grafene eller bevis for en ytelsesforbedring.'
        body += f'<p>{esc(note)}</p>'
        md.extend([note, ''])
    md.extend(['Klikk på en profil for grafen. * Fullført delmåling i ufullstendig kjøring. † Uverifisert, ikke et grafpunkt. — Ikke målt.', '',
               'Micro Racer har foreløpig ingen CPU-benchmarkprofil.', ''])

    publication_path = root / 'publication.json'
    if publication_path.is_file():
        publication = json.loads(publication_path.read_text(encoding='utf-8'))
        heading = 'Nyeste publiseringskontroll – separat fra FoM'
        note = (f'{publication["date"]}: versjon {publication["commit"][:8]} er publisert. '
                'Dette er avgrensede kontroller før og etter utrulling, ikke en ny full evaluering. '
                'FoM-grafen endres først etter ny evaluering og brukervurdering.')
        values = [[item['area'], item['result'], item['detail']] for item in publication['checks']]
        body += (f'<section id="publication"><h2>{heading}</h2><p>{esc(note)}</p>'
                 + table(['Kontroll', 'Resultat', 'Forklaring'], [[esc(v) for v in row] for row in values])
                 + f'<p>{esc(publication["deviation"])}</p><p>{esc(publication["limitations"])}</p>'
                 + f'<p><a href="{esc(publication["report"])}">Full utrullingsrapport</a></p></section>')
        md.extend(['## ' + heading, '', note, ''])
        md_table(['Kontroll', 'Resultat', 'Forklaring'], values)
        md.extend([publication['deviation'], '', publication['limitations'], '',
                   f'[Full utrullingsrapport]({publication["report"]})', ''])

    key_rows = []
    md.extend(['## Kjøringer og sammenlignbarhet', ''])
    for row in data['rows']:
        run = row['run']
        key_rows.append([esc(row['label']), f'<a href="runs/{esc(run["id"])}/report.html">{esc(run["label"])}</a>', esc(run['commit'][:8]), esc(run['series']), esc(row['state'])])
        md.append(f'- **{row["label"]}**: [{run["label"].replace("[", "(").replace("]", ")")}](runs/{run["id"]}/report.md), commit `{run["commit"][:8]}`, serie `{run["series"]}`. {row["state"]}.')
    explanation = ('K betyr kjøring, ikke forbedringsrunde. Flere kjøringer kan tilhøre samme kodeversjon. '
                   'En serie har samme testgrunnlag, profil, miljø og skårformel. '
                   'Den eldre backend-FoM-en bruker en annen formel og inngår ikke i appens utviklingskurve.')
    body += f'<section id="run-key"><h2>Hvilke kjøringer ser vi på?</h2><p>{esc(explanation)}</p>{table(["Kjøring (UTC)", "Opprinnelig navn / detaljrapport", "Commit", "Serie", "Status"], key_rows)}<p><a href="../README.md">Tidligere backendmålinger</a> · <a href="README.md">Målemetode og kjøreguide</a></p></section>'
    md.extend(['', explanation, '', '[Tidligere backendmålinger](../README.md) · [Målemetode](README.md)', ''])
    (root / 'overview.md').write_text('\n'.join(md), encoding='utf-8')
    return body + '''<script>const select = document.getElementById('benchmark-select');
if (select) select.addEventListener('change', () => {for (const panel of document.querySelectorAll('.benchmark-panel')) panel.hidden = panel.id !== select.value;});</script>'''
