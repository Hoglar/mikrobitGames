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
        report['summary'] = summarize(report, reviews[-1] if reviews else None)
        runs.append(report)
    return runs


def chart(runs):
    esc = html.escape
    out = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 390" role="img" aria-labelledby="chart-title">',
           '<title id="chart-title">FoM per iterasjon. Heltrukket: samlet FoM. Stiplet: teknisk skår uten UX.</title>',
           '<rect width="960" height="390" fill="white"/>']
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
                label = esc(f"{run['label']} · {run['timestamp']} · {metric}: {value:.2f} · serie {key}")
                out.append(f'<a href="runs/{run["id"]}/report.html" target="_top"><circle cx="{x}" cy="{y}" r="{6 if dashed else 4}" fill="{"white" if dashed else color}" stroke="{color}" stroke-width="2"><title>{label}</title></circle></a>')
                previous = (x, y)
    for i, run in enumerate(runs):
        x = 70 + i * 820 / max(1, len(runs) - 1)
        if len(runs) <= 20 or i % max(1, len(runs)//15) == 0:
            out.append(f'<text x="{x}" y="337" text-anchor="middle" font-size="12">{i+1}</text>')
    out.append('<text x="55" y="365" font-size="14">Iterasjon · Fylt punkt: samlet FoM · Åpent punkt: teknisk skår uten UX</text></svg>')
    return ''.join(out)


STYLE = '''body{font:16px system-ui,sans-serif;color:#14263b;background:#f4f7fb;max-width:1160px;margin:40px auto;padding:0 24px}h1{font-size:32px}h2{font-size:23px}a{color:#1459a6}section,.card{background:white;border:1px solid #d9e2ed;border-radius:12px;padding:24px;margin:20px 0}table{border-collapse:collapse;width:100%;font-size:14px}td,th{padding:12px 8px;border-bottom:1px solid #d9e2ed;text-align:left;vertical-align:top}pre{white-space:pre-wrap;overflow-wrap:anywhere}svg{width:100%;height:auto}.scroll{overflow:auto}.score{font-size:28px;font-weight:700}.muted{color:#526174}code{overflow-wrap:anywhere}input{font:inherit;padding:9px;width:min(100%,440px)}.FAIL,.BLOCKED{color:#a12222}.PASS{color:#086143}'''


def page(title, body):
    return f'<!doctype html><html lang="nb"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{html.escape(title)}</title><style>{STYLE}</style><body>{body}</body></html>'


def fmt(value):
    return '—' if value is None else f'{value:.2f}'


def render(root):
    runs = load_runs(root)
    svg = chart(runs)
    (root / 'history.svg').write_text(svg, encoding='utf-8')
    rows = []
    esc = lambda value: html.escape(str(value))
    for index, report in enumerate(runs, 1):
        s, folder = report['summary'], root / 'runs' / report['id']
        last = report['reviews'][-1] if report['reviews'] else None
        comments = '\n\n'.join(f"{r['timestamp']} · {r['reviewer']} · {r['score']}/10\n{r['comment']}" for r in report['reviews']) or 'Venter på gruppens UX-skår og kommentar.'
        rows.append(f'<tr data-search="{esc(report["label"] + " " + comments).lower()}"><td>{index}</td><td><a href="runs/{report["id"]}/report.html">{esc(report["label"])}</a><br>{esc(report["timestamp"])}</td><td>{esc(report["profile"])}<br><code>{report["series"]}</code></td><td>{fmt(s["technical"])}</td><td>{fmt(s["ux"])}</td><td>{fmt(s["fom"])}</td><td>{s["status"]}<br>{esc(last["comment"] if last else "Venter på UX")}</td></tr>')
        details = ''.join(f'<tr><td>{esc(c["id"])}</td><td class="{c["status"]}">{c["status"]}</td><td>{fmt(c.get("score"))}</td><td>{esc(c.get("detail", ""))}<br><a href="{esc(c["log"])}">Logg</a></td></tr>' for c in report['checks'])
        metrics = ''.join(f'<tr><td>{esc(m["name"])}</td><td>{m["value"]:.4f}</td><td>{m["budget"]:.4f}</td><td>{m["score"]:.2f}</td></tr>' for m in report.get('metrics', []))
        body = f'''<a href="../../index.html">← Alle iterasjoner</a><h1>{esc(report['label'])}</h1>
<p>{esc(report['timestamp'])} · {esc(report['profile'])} · commit <code>{esc(report['commit'])}</code> · lokale endringer: {report['dirty']}</p>
<section><div class="score">FoM {fmt(s['fom'])} / 100</div><p>{s['status']} · Funksjon {fmt(s['function'])} · Ytelse {fmt(s['performance'])} · UX {fmt(s['ux'])}</p><p>Teknisk skår uten UX: {fmt(s['technical'])}. Samlet FoM = 50 % funksjon + 30 % ytelse + 20 % UX.</p></section>
<section><h2>Til neste iterasjon</h2><pre>{esc(comments)}</pre><p><a href="next-iteration.md">Last ned overlevering</a> · <a href="report.json">Rårapport</a></p>
<p>Registrer eller korriger gruppens vurdering fra prosjektroten:</p><pre>python3 tests/evaluate.py feedback {report['id']} --score 7 --reviewer "Gruppen" --comment "Hva fungerte, hva bør forbedres, og hva prioriteres først?"</pre></section>
<section class="scroll"><h2>Tester</h2><table><tr><th>Kontroll</th><th>Status</th><th>Skår</th><th>Detaljer</th></tr>{details}</table></section>
<section class="scroll"><h2>Benchmark</h2><p>p95 i millisekunder. Lavere er bedre. Rådata, metode og prøveantall ligger i JSON-filene.</p><table><tr><th>Måling</th><th>p95 ms</th><th>Budsjett ms</th><th>Skår</th></tr>{metrics}</table></section>
<section><h2>Måleomfang</h2><ul>{''.join('<li>'+esc(x)+'</li>' for x in report['limitations'])}</ul><p>Serie: <code>{report['series']}</code>. Nye tester, budsjetter eller målemiljø starter en ny serie.</p></section>'''
        (folder / 'report.html').write_text(page(report['label'], body), encoding='utf-8')
        handoff = [f"# Neste iterasjon etter {report['label']}", '', f"Kjøring: {report['id']}", f"Commit: {report['commit']}; lokale endringer: {report['dirty']}",
                   f"Kildehash: {report['source_digest']}", f"Serie: {report['series']} · Profil: {report['profile']}",
                   f"FoM: {fmt(s['fom'])}; teknisk: {fmt(s['technical'])}; status: {s['status']}", '', '## Brukeropplevelse og prioriteringer', '', comments, '', '## Feil og manglende målinger', '']
        handoff += [f"- {c['id']}: {c['status']} — {c.get('detail', '')}; logg: {c['log']}" for c in report['checks'] if c['status'] != 'PASS'] or ['Ingen registrerte testfeil.']
        handoff += ['', '## Avgrensning', '', *['- '+x for x in report['limitations']], '']
        (folder / 'next-iteration.md').write_text('\n'.join(handoff), encoding='utf-8')
        save_json(folder / 'summary.json', s)
    body = f'''<h1>Appens utvikling gjennom iterasjoner</h1><p>50 % funksjon · 30 % ytelse · 20 % brukeropplevelse. Klikk på et punkt eller en iterasjon for detaljer.</p>
<section>{svg}<p class="muted">Bare samme testgrunnlag, profil og miljø kobles sammen. Manglende målinger gir hull. Åpne punkter er tekniske resultater før UX-vurdering.</p><a href="history.svg">Åpne graf som SVG</a></section>
<section><h2>Historikk og kommentarer</h2><label>Filtrer navn eller tilbakemelding <input id="filter" type="search"></label><div class="scroll"><table><thead><tr><th>#</th><th>Iterasjon</th><th>Profil / serie</th><th>Teknisk</th><th>UX / 100</th><th>FoM</th><th>Status / kommentar</th></tr></thead><tbody>{''.join(rows)}</tbody></table></div></section>
<script>document.getElementById('filter').addEventListener('input', e => {{for (const row of document.querySelectorAll('tr[data-search]')) row.hidden = !row.dataset.search.includes(e.target.value.toLowerCase());}});</script>'''
    (root / 'index.html').write_text(page('App-FoM', body), encoding='utf-8')
    return runs
