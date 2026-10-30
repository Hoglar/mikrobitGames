"""Offline HTML/SVG history and a portable handoff for the next iteration."""
import html
import json
from collections import defaultdict
from pathlib import Path
from scoring import summarize


def save_json(path, data):
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False, allow_nan=False) + '\n', encoding='utf-8')


def load_runs(root):
    runs = []
    for path in sorted((root / 'runs').glob('*/report.json')):
        report = json.loads(path.read_text(encoding='utf-8'))
        reviews = [json.loads(p.read_text(encoding='utf-8')) for p in sorted(path.parent.glob('feedback-*.json'))]
        report['reviews'] = reviews
        report['manual_inputs'] = [json.loads(p.read_text(encoding='utf-8')) for p in sorted(path.parent.glob('user-input-*.json'))]
        report['summary'] = summarize(report, reviews[-1] if reviews else None)
        runs.append(report)
    return runs


def chart(runs, report_prefix='runs/'):
    esc = html.escape
    out = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 400" role="img" aria-labelledby="chart-title" aria-describedby="chart-description">',
           '<title id="chart-title">FoM per iterasjon. Heltrukket: samlet FoM. Stiplet: teknisk skår uten UX.</title>',
           '<desc id="chart-description">Skala fra 0 til 100. Punktene lenker til rapportene. Bare sammenlignbare kjøringer kobles sammen; manglende målinger gir hull. BLOCKED under aksen markerer en kjøring uten skår.</desc>',
           '<rect width="960" height="400" fill="white"/>']
    for value in (0, 25, 50, 75, 100):
        y = 310 - value * 2.5
        out.append(f'<path d="M55 {y}H920" stroke="#e2e8f0"/><text x="15" y="{y+5}" font-size="13">{value}</text>')
    series = defaultdict(list)
    for i, run in enumerate(runs):
        series[run['series']].append((i, run))
    colors = ['#1565c0', '#b45309', '#7e22ce', '#047857', '#be123c']
    for n, (key, rows) in enumerate(series.items()):
        color = colors[n % len(colors)]
        for metric, dashed in [('technical', True), ('fom', False)]:
            previous = None
            for i, run in rows:
                value = run['summary'][metric]
                if value is None:
                    previous = None
                    continue
                x, y = 70 + i * 820 / max(1, len(runs) - 1), 310 - value * 2.5
                if previous:
                    dash = 'stroke-dasharray="6,5"' if dashed else ''
                    out.append(f'<path d="M{previous[0]} {previous[1]}L{x} {y}" stroke="{color}" stroke-width="2" {dash}/>')
                failed = sum(c['status'] == 'FAIL' for c in run.get('checks', []))
                label = esc(f"{run['label']} · {run['timestamp']} · {metric}: {value:.2f} · FAIL: {failed} · serie {key}")
                href = esc(f'{report_prefix}{run["id"]}/report.html', quote=True)
                out.append(f'<a href="{href}" target="_top" aria-label="{label}"><circle cx="{x}" cy="{y}" r="{6 if dashed else 4}" fill="{"white" if dashed else color}" stroke="{color}" stroke-width="2"><title>{label}</title></circle></a>')
                previous = (x, y)
    for i, run in enumerate(runs):
        x = 70 + i * 820 / max(1, len(runs) - 1)
        if len(runs) <= 20 or i % max(1, len(runs)//15) == 0:
            out.append(f'<text x="{x}" y="337" text-anchor="middle" font-size="12">{i+1}</text>')
        if run['summary']['status'] == 'BLOCKED':
            label = esc(f"{run['label']} · BLOCKED · Ingen FoM-skår; åpne rapporten for feil og manglende målinger.")
            href = esc(f'{report_prefix}{run["id"]}/report.html', quote=True)
            out.append(f'<a href="{href}" target="_top" aria-label="{label}"><text x="{x}" y="355" text-anchor="middle" font-size="10" fill="#a12222">BLOCKED<title>{label}</title></text></a>')
    if not any(run['summary']['technical'] is not None or run['summary']['fom'] is not None for run in runs):
        out.append('<text x="480" y="180" text-anchor="middle" font-size="16">Ingen komplette målepunkter ennå</text>')
    out.append('<text x="55" y="385" font-size="14">Iterasjon · Fylt: FoM · Åpent: teknisk skår · BLOCKED: ingen skår</text></svg>')
    return ''.join(out)


STYLE = '''body{font:16px system-ui,sans-serif;color:#14263b;background:#f4f7fb;max-width:1160px;margin:40px auto;padding:0 24px}h1{font-size:32px}h2{font-size:23px}a{color:#1459a6}section,.card{background:white;border:1px solid #d9e2ed;border-radius:12px;padding:24px;margin:20px 0}table{border-collapse:collapse;width:100%;font-size:14px}td,th{padding:12px 8px;border-bottom:1px solid #d9e2ed;text-align:left;vertical-align:top}pre{white-space:pre-wrap;overflow-wrap:anywhere}svg{width:100%;height:auto}.scroll{overflow:auto}.score{font-size:28px;font-weight:700}.muted{color:#526174}code{overflow-wrap:anywhere}input{font:inherit;padding:9px;width:min(100%,440px)}.FAIL,.BLOCKED{color:#a12222}.PASS{color:#086143}'''


def page(title, body):
    return f'<!doctype html><html lang="nb"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{html.escape(title)}</title><style>{STYLE}</style><body>{body}</body></html>'


def fmt(value):
    return '—' if value is None else f'{value:.2f}'


TASK_STATUS = {'done': 'Gjennomført', 'problem': 'Problem', 'skipped': 'Ikke prøvd'}
INPUT_STATUS = {'deferred': 'Utsatt vurdering; ingen UX-skår registrert.',
                'interrupted': 'Avbrutt vurdering; delvise svar er bevart uten UX-skår.',
                'source-changed': 'Kode eller testgrunnlag endret; vurderingen brukes ikke i FoM.'}


def review_heading(review):
    result = INPUT_STATUS.get(review.get('status'))
    if result is None:
        result = f"{review['score']}/10" if 'score' in review else 'Ufullført vurdering uten UX-skår.'
    return f"{review['timestamp']} · {review.get('reviewer', '')} · {result}"


def review_comment(review):
    comment = review.get('comment', '')
    if all(key in review for key in ('worked', 'improve', 'priority')):
        generated = '\n'.join((f"Fungerte godt: {review['worked']}",
                               f"Forbedringsbehov: {review['improve']}",
                               f"Prioritet neste iterasjon: {review['priority']}"))
        if comment == generated:
            return ''
    return comment


def review_text(review):
    """Keep all supplied human observations in the portable handoff."""
    lines = [review_heading(review), review_comment(review)]
    if review.get('reason'):
        lines.append(review['reason'])
    if 'proposed_score' in review:
        lines.append(f"Foreslått UX-skår: {review['proposed_score']}/10 (ikke brukt i FoM).")
    for key, title in [('worked', 'Det som fungerte'), ('improve', 'Det som bør forbedres'), ('priority', 'Prioritet til neste iterasjon')]:
        if review.get(key):
            lines.extend(['', f"{title}: {review[key]}"])
    for task in review.get('tasks', []):
        status = TASK_STATUS.get(task['status'], task['status'])
        lines.extend(['', f"- {task['title']}: {status}"])
        if task.get('comment'):
            lines.append(f"  {task['comment']}")
    return '\n'.join(lines)


def review_html(review):
    esc = lambda value: html.escape(str(value))
    body = f'<p>{esc(review_heading(review))}</p>'
    if review_comment(review):
        body += f'<pre>{esc(review_comment(review))}</pre>'
    if review.get('reason'):
        body += f'<pre>{esc(review["reason"])}</pre>'
    if 'proposed_score' in review:
        body += f'<p>Foreslått UX-skår: {esc(review["proposed_score"])}/10 (ikke brukt i FoM).</p>'
    for key, title in [('worked', 'Det som fungerte'), ('improve', 'Det som bør forbedres'), ('priority', 'Prioritet til neste iterasjon')]:
        if review.get(key):
            body += f'<h3>{title}</h3><pre>{esc(review[key])}</pre>'
    if review.get('tasks'):
        rows = ''.join(f'<tr><td>{esc(task["title"])}</td><td>{esc(TASK_STATUS.get(task["status"], task["status"]))}</td><td><pre>{esc(task.get("comment", ""))}</pre></td></tr>' for task in review['tasks'])
        body += f'<div class="scroll"><table><tr><th>Manuell oppgave</th><th>Resultat</th><th>Observasjon</th></tr>{rows}</table></div>'
    return '<article>' + body + '</article>'


def esc(value):
    return html.escape(str(value))


def percentage(weight):
    return f'{weight * 100:g} %'


def scoring_html(report):
    """Explain the stored policy using exactly the inputs used by summarize()."""
    summary, weights = report['summary'], report['policy']['weights']
    rows = []
    for category, symbol, title, key in [('function', 'F', 'Funksjonelle tester', 'function'),
                                         ('performance', 'P', 'Ytelsesbenchmarks', 'performance')]:
        groups = [c for c in report['checks'] if c['category'] == category]
        measured = [c for c in groups if c.get('score') is not None]
        complete = bool(groups) and all(c['status'] in ('PASS', 'FAIL') and c.get('score') is not None for c in groups)
        expression = ' + '.join(fmt(c['score']) for c in measured)
        calculation = f'({expression}) / {len(measured)} = {fmt(summary[key])}' if measured else 'Ingen målte grupper.'
        if not complete:
            calculation += f' · Delgjennomsnitt: {len(measured)} av {len(groups)} grupper målt; komponenten er ufullstendig.'
        inputs = ', '.join(f'{c["id"]}: {fmt(c.get("score"))} ({c["status"]})' for c in groups) or 'Ingen kontrollgrupper registrert.'
        contribution = weights[category] * summary[key] if complete else None
        rows.append(f'<tr><th>{symbol} – {title}</th><td>{esc(inputs)}<br><code>{esc(calculation)}</code></td><td>{percentage(weights[category])}</td><td>{fmt(contribution)}</td></tr>')
    last = report['reviews'][-1] if report.get('reviews') else None
    ux_input = f"Siste vurdering: {last['score']:g}/10 × 10 = {fmt(summary['ux'])}. Vurderer: {last['reviewer']}" if last else 'Ingen fullført brukervurdering; U mangler.'
    ux_contribution = weights['ux'] * summary['ux'] if summary['ux'] is not None else None
    rows.append(f'<tr><th>U – Brukeropplevelse (UX)</th><td>{esc(ux_input)}</td><td>{percentage(weights["ux"])}</td><td>{fmt(ux_contribution)}</td></tr>')
    formula = f"{percentage(weights['function'])} × F + {percentage(weights['performance'])} × P + {percentage(weights['ux'])} × U"
    denominator = weights['function'] + weights['performance']
    technical_formula = f"({percentage(weights['function'])} × F + {percentage(weights['performance'])} × P) / {denominator:g}"
    return f'''<section id="fom-calculation" class="scroll"><h2>Slik beregnes FoM</h2>
<p>Lagret formel, versjon {esc(report['policy'].get('version', 'ukjent'))}: <strong>FoM = {formula}</strong>. Alle komponenter bruker skala 0–100.</p>
<p>F er gjennomsnittet av funksjonsgruppene, inkludert enhetstester, integrasjon og kapasitetskontroll. P er gjennomsnittet av ytelsesgruppene; hver benchmarkgruppe bruker gjennomsnittet av sine profiler. U er gruppens UX-skår multiplisert med 10. Gruppene innenfor F og P vektes likt.</p>
<table><thead><tr><th>Komponent</th><th>Inndata og gjennomsnitt</th><th>Vekt</th><th>Bidrag i FoM-poeng</th></tr></thead><tbody>{''.join(rows)}<tr><th colspan="3">Samlet FoM</th><td>{fmt(summary['fom'])}</td></tr></tbody></table>
<p>Teknisk skår uten UX = {technical_formula} = {fmt(summary['technical'])}.</p>
<p>Målte feil gir FAIL og trekker skåren ned. BLOCKED, manglende målinger eller selvtest som ikke bestod hindrer samlet FoM; de blir aldri erstattet med null. Delbidrag over gir bare samlet FoM når alle nødvendige grupper og UX er målt. En komplett måling kan inneholde testfeil.</p></section>'''


def log_excerpt(folder, log_name, limit=5000):
    if not log_name:
        return ''
    path = folder / Path(log_name).name
    try:
        with path.open('rb') as stream:
            stream.seek(0, 2)
            size = stream.tell()
            stream.seek(max(0, size - limit))
            text = stream.read(limit).decode('utf-8', errors='replace')
        return ('… siste del av loggen …\n' if size > limit else '') + text
    except OSError:
        return ''


def check_table(checks, folder):
    if not checks:
        return '<p>Ingen kontroller registrert i denne gruppen.</p>'
    rows = []
    for check in checks:
        detail = esc(check.get('detail', ''))
        log = check.get('log')
        if log:
            detail += f'<br><a href="{esc(log)}">Logg: {esc(log)}</a>'
        counts = check.get('counts')
        if counts:
            detail += f'<p>{counts["passed"]}/{counts["tests"]} bestått · {counts["failed"]} feil · {counts["skipped"]} utelatt</p>'
        if check['status'] != 'PASS':
            excerpt = log_excerpt(folder, log)
            if excerpt:
                detail += f'<details><summary>Vis diagnostikk</summary><pre>{esc(excerpt)}</pre></details>'
        component = 'F – funksjon / kapasitet' if check['category'] == 'function' else 'P – ytelse'
        if check['id'] == 'backend-full' and (folder / 'backend-full.json').is_file():
            detail += '<p><a href="backend-full.json">Rårapport for backend-integrasjon og benchmark</a></p>'
        rows.append(f'<tr id="check-{esc(check["id"])}"><td>{esc(check["id"])}</td><td class="{esc(check["status"])}">{esc(check["status"])}</td><td>{fmt(check.get("score"))}</td><td>{component}</td><td>{detail}</td></tr>')
    return '<table><thead><tr><th>Kontroll</th><th>Status</th><th>Skår / 100</th><th>Bidrar til</th><th>Detaljer og bevis</th></tr></thead><tbody>' + ''.join(rows) + '</tbody></table>'


def benchmark_files(check):
    return {'platform-capacity': ['platform-benchmark.json'],
            'input-benchmark': ['input-benchmark.json'],
            'games-benchmark': ['games-benchmark.json'],
            'browser-input': ['browser-benchmark.json'],
            'browser-performance': ['browser-benchmark.json']}.get(check['id'], [check['id'] + '.json'])


def benchmark_html(checks, metrics, folder):
    evidence = []
    for check in checks:
        files = [name for name in benchmark_files(check) if (folder / name).is_file()]
        links = ' · '.join(f'<a href="{esc(name)}">{esc(name)}</a>' for name in files) or 'Rådata ikke produsert; se status og logg.'
        evidence.append(f'<li>{esc(check["id"])} ({esc(check["status"])}): {links}</li>')
    values = ''.join(f'<tr><td>{esc(m["name"])}</td><td>{m["value"]:.4f}</td><td>{m["budget"]:.4f}</td><td>{m["score"]:.2f}</td></tr>' for m in metrics)
    measured = f'<table><thead><tr><th>Måling</th><th>p95 ms</th><th>Budsjett ms</th><th>Skår / 100</th></tr></thead><tbody>{values}</tbody></table>' if metrics else '<p>Ingen ytelsesmålinger registrert. Feil og blokkeringer vises i kontrolltabellen over.</p>'
    return f'''<section id="benchmarks" class="scroll"><h2>Benchmarks og ytelse</h2>
<p>Benchmarkenes status beholdes også når kjøringen fortsetter etter en feil. <code>platform-capacity</code> kontrollerer kapasitet og korrekthet og bidrar til F; ytelsesgruppene bidrar til P.</p>
{check_table(checks, folder)}<h3>Rådata</h3><ul>{''.join(evidence)}</ul><h3>Målte profiler</h3>
<p>p95 i millisekunder; lavere er bedre. Hver profil bruker 100 × min(1, budsjett / p95), med 100 ved målt null. Gjennomsnitt per benchmarkgruppe inngår i P. Råfiler inneholder metode og prøveantall.</p>{measured}</section>'''


def diagnostic_html(report, folder):
    failed = [c for c in report['checks'] if c['status'] == 'FAIL']
    blocked = [c for c in report['checks'] if c['status'] == 'BLOCKED']
    items = ''.join(f'<li><a href="#check-{esc(c["id"])}">{esc(c["id"])}: {esc(c["status"])}</a> — {esc(c.get("detail", ""))}</li>' for c in failed + blocked)
    message = f'<ul>{items}</ul>' if items else '<p>Ingen registrerte produktfeil eller blokkerte kontroller.</p>'
    status = report.get('selftest', 'BLOCKED')
    log = report.get('selftest_log', 'evaluation-selftest.log')
    detail = esc(report.get('selftest_detail', ''))
    excerpt = log_excerpt(folder, log) if status != 'PASS' else ''
    if excerpt:
        detail += f'<details><summary>Vis selvtestens diagnostikk</summary><pre>{esc(excerpt)}</pre></details>'
    log_link = f'<a href="{esc(log)}">Selvtestlogg</a>' if (folder / Path(log).name).is_file() else 'Selvtestlogg finnes ikke i denne rapporten.'
    css = 'BLOCKED' if blocked or status != 'PASS' else 'FAIL' if failed else 'PASS'
    return f'''<section id="diagnostics"><h2>Feil, blokkeringer og måleverktøy</h2>
<p class="{css}"><strong>{len(failed)} FAIL · {len(blocked)} BLOCKED · Selvtest: {esc(status)}</strong></p>
<p>Alle registrerte kontroller vises nedenfor, også etter feil. Selvtesten kontrollerer måleverktøyet og inngår ikke som en poenggruppe. En selvtest som ikke bestod hindrer FoM.</p>{message}<p>Selvtest: <strong class="{esc(status)}">{esc(status)}</strong> · {log_link}</p>{detail}</section>'''


def render(root):
    runs = load_runs(root)
    svg = chart(runs)
    (root / 'history.svg').write_text(svg, encoding='utf-8')
    rows = []
    for index, report in enumerate(runs, 1):
        s, folder = report['summary'], root / 'runs' / report['id']
        last = report['reviews'][-1] if report['reviews'] else None
        inputs = sorted(report['reviews'] + report['manual_inputs'], key=lambda r: r['timestamp'])
        comments = '\n\n'.join(review_text(r) for r in inputs) or 'Venter på gruppens UX-skår og kommentar.'
        reviews = ''.join(review_html(r) for r in inputs) or '<p>Venter på gruppens UX-skår og kommentar.</p>'
        session = report.get('session', {})
        session_html = ''
        if session.get('reviewer') or session.get('context'):
            session_html = f'<section><h2>Testøkt</h2><p>Vurderer / gruppe: {esc(session.get("reviewer", ""))}</p><pre>{esc(session.get("context", ""))}</pre></section>'
        failed = sum(c['status'] == 'FAIL' for c in report['checks'])
        blocked = sum(c['status'] == 'BLOCKED' for c in report['checks'])
        weights = report['policy']['weights']
        weight_label = ' / '.join(percentage(weights[key]) for key in ('function', 'performance', 'ux'))
        rows.append(f'<tr data-search="{esc(report["label"] + " " + comments).lower()}"><td>{index}</td><td><a href="runs/{esc(report["id"])}/report.html">{esc(report["label"])}</a><br>{esc(report["timestamp"])}</td><td>{esc(report["profile"])}<br><code>{esc(report["series"])}</code><br>Vekter F/P/U: {weight_label}</td><td>{fmt(s["function"])}</td><td>{fmt(s["performance"])}</td><td>{fmt(s["ux"])}</td><td>{fmt(s["technical"])}</td><td>{fmt(s["fom"])}</td><td>{esc(s["status"])}<br><strong>{failed} FAIL · {blocked} BLOCKED · Selvtest: {esc(report.get("selftest", "BLOCKED"))}</strong><br>{esc(last["comment"] if last else "Venter på UX")}</td></tr>')
        units, functions, benchmarks = [], [], []
        for check in report['checks']:
            if check['category'] == 'performance' or 'benchmark' in check['id'] or check['id'] == 'platform-capacity':
                benchmarks.append(check)
            elif check['id'] in ('web-unit', 'input-unit', 'backend-unit', 'firmware', 'unit') or check['id'].endswith('-unit'):
                units.append(check)
            else:
                functions.append(check)
        body = f'''<a href="../../index.html">← Alle iterasjoner</a><h1>{esc(report['label'])}</h1>
<p>{esc(report['timestamp'])} · {esc(report['profile'])} · commit <code>{esc(report['commit'])}</code> · lokale endringer: {report['dirty']}</p>
<p><a href="report.md">GitHub / Markdown</a> · <a href="report.json">Rårapport</a></p>
<section><div class="score">FoM {fmt(s['fom'])} / 100</div><p>{esc(s['status'])} · F – funksjon {fmt(s['function'])} · P – ytelse {fmt(s['performance'])} · U – UX {fmt(s['ux'])}</p><p>Teknisk skår uten UX: {fmt(s['technical'])}. Se registrerte feil og den nøyaktige beregningen nedenfor.</p></section>
{diagnostic_html(report, folder)}
{scoring_html(report)}
<section><h2>FoM-score gjennom iterasjoner</h2>{chart(runs, report_prefix='../')}<p class="muted">Bare samme testgrunnlag, profil og miljø kobles sammen. Manglende målinger gir hull; BLOCKED under aksen er en statusmarkør uten skår.</p><a href="../../history.svg">Åpne graf som SVG</a></section>
{session_html}
<section id="unit-tests" class="scroll"><h2>Enhetstester</h2><p>Kontroller av avgrensede deler av webapp, input, backend og firmware. Hver registrert gruppe inngår i F.</p>{check_table(units, folder)}</section>
<section id="functional-tests" class="scroll"><h2>Øvrige funksjons-, integrasjons- og nettlesertester</h2><p>Kontroller av samspill, brukerforløp og testkjøring. Disse gruppene inngår også i F. Enhetstester alene er derfor ikke hele F-komponenten.</p>{check_table(functions, folder)}</section>
{benchmark_html(benchmarks, report.get('metrics', []), folder)}
<section id="ux"><h2>Brukeropplevelse (UX) og neste iterasjon</h2><p>Ny brukervurdering har to spørsmål: Beskriv brukeropplevelsen med egne ord, og gi en skår fra 1–10. Siste fullførte UX-skår multipliseres med 10 og inngår som U; delvise svar beholdes uten å gi UX-poeng.</p>{reviews}<p><a href="next-iteration.md">Last ned overlevering</a></p>
<p>Registrer eller korriger gruppens vurdering fra prosjektroten:</p><pre>python3 tests/evaluate.py feedback {report['id']} --score 7 --reviewer "Gruppen" --comment "Hvordan var brukeropplevelsen?"</pre></section>
<section><h2>Måleomfang</h2><ul>{''.join('<li>'+esc(x)+'</li>' for x in report['limitations'])}</ul><p>Serie: <code>{report['series']}</code>. Nye tester, budsjetter eller målemiljø starter en ny serie.</p></section>'''
        (folder / 'report.html').write_text(page(report['label'], body), encoding='utf-8')
        handoff = [f"# Neste iterasjon etter {report['label']}", '', f"Kjøring: {report['id']}", f"Commit: {report['commit']}; lokale endringer: {report['dirty']}",
                   f"Kildehash: {report['source_digest']}", f"Serie: {report['series']} · Profil: {report['profile']}",
                   f"FoM: {fmt(s['fom'])}; teknisk: {fmt(s['technical'])}; status: {s['status']}"]
        if session.get('reviewer') or session.get('context'):
            handoff += ['', '## Testøkt', '', f"Vurderer / gruppe: {session.get('reviewer', '')}", session.get('context', '')]
        handoff += ['', '## Brukeropplevelse og prioriteringer', '', comments, '', '## Feil og manglende målinger', '']
        handoff += [f"- {c['id']}: {c['status']} — {c.get('detail', '')}; logg: {c.get('log', 'ikke registrert')}" for c in report['checks'] if c['status'] != 'PASS'] or ['Ingen registrerte testfeil.']
        handoff += ['', f"Selvtest: {report.get('selftest', 'BLOCKED')}; logg: {report.get('selftest_log', 'evaluation-selftest.log')}", report.get('selftest_detail', '')]
        handoff += ['', '## Avgrensning', '', *['- '+x for x in report['limitations']], '']
        (folder / 'next-iteration.md').write_text('\n'.join(handoff), encoding='utf-8')
        save_json(folder / 'summary.json', s)
    body = f'''<h1>Appens utvikling gjennom iterasjoner</h1><p>FoM kombinerer F – funksjonelle tester, P – ytelsesbenchmarks og U – brukeropplevelse. Hver kjøring bruker sine lagrede vekter, vist som F/P/U nedenfor.</p>
<p>F er gjennomsnitt av funksjonsgruppene: enhetstester, integrasjon, nettleserforløp og kapasitetskorrekthet. P er gjennomsnitt av ytelsesgruppene. U er siste fullførte UX-skår × 10. Alle har skala 0–100. Klikk på rapporten for inndata, vekter og bidrag til FoM. Ved blokkering kan F og P være delgjennomsnitt; samlet FoM holdes tilbake.</p>
<section>{svg}<p class="muted">Bare samme testgrunnlag, profil og miljø kobles sammen. Manglende målinger gir hull. Åpne punkter er tekniske resultater før UX-vurdering. BLOCKED er en statusmarkør uten skår; feil og blokkeringer beholdes i historikken.</p><a href="history.svg">Åpne graf som SVG</a> · <a href="history.md">GitHub / Markdown</a></section>
<section><h2>Historikk og kommentarer</h2><label>Filtrer navn eller tilbakemelding <input id="filter" type="search"></label><div class="scroll"><table><thead><tr><th>#</th><th>Iterasjon</th><th>Profil / serie / vekter</th><th>F / 100</th><th>P / 100</th><th>U / 100</th><th>Teknisk</th><th>FoM</th><th>Status, feil og kommentar</th></tr></thead><tbody>{''.join(rows)}</tbody></table></div></section>
<script>document.getElementById('filter').addEventListener('input', e => {{for (const row of document.querySelectorAll('tr[data-search]')) row.hidden = !row.dataset.search.includes(e.target.value.toLowerCase());}});</script>'''
    (root / 'index.html').write_text(page('App-FoM', body), encoding='utf-8')
    from markdown_reporting import render_markdown
    render_markdown(root, runs)
    return runs
