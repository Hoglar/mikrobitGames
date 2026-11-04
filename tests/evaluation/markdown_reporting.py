"""GitHub-readable evaluation evidence, alongside the offline HTML reports."""
import html
import re
from urllib.parse import quote
from evidence import scope, cases, benchmark_details


def text(value):
    value = html.escape(str(value), quote=False).replace('\n', ' ')
    return re.sub(r'([\\`*_[\]|])', r'\\\1', value)


def number(value):
    return '—' if value is None else f'{value:.2f}'


def block(value):
    value = str(value)
    fence = '`' * max(3, max((len(m) + 1 for m in re.findall(r'`+', value)), default=0))
    return f'{fence}text\n{value}\n{fence}'


def kind(check):
    name = check['id']
    if check['category'] == 'performance' or 'benchmark' in name or name == 'platform-capacity':
        return 'benchmark'
    if name.endswith('-unit') or name in ('unit', 'firmware'):
        return 'unit'
    return 'function'


def checks_table(checks):
    if not checks:
        return ['Ingen kontroller i denne profilen.', '']
    lines = ['| Kontroll | Status | Skår / 100 | Bidrar til | Detaljer / logg |',
             '| --- | --- | ---: | --- | --- |']
    for check in checks:
        contribution = 'P – ytelse' if check['category'] == 'performance' else 'F – funksjon'
        log = f"[Logg]({quote(check['log'])})" if check.get('log') else ''
        lines.append(f"| {text(check['id'])} | {text(check['status'])} | {number(check.get('score'))} | {contribution} | {text(check.get('detail', ''))} {log} |")
    return lines + ['']


def coverage_lines(report, folder):
    live = next((c['status'] for c in report['checks'] if c['id'] == 'backend-full'), 'IKKE KJØRT')
    lines = ['## Hva ble faktisk testet?', '', f'Levende API, PostgreSQL og Qwen i backend-testmiljø: **{live}**. '
             'Standardkjøringen bruker simulerte API-svar og Web Serial. Fysisk USB og produksjonsnettverk er ikke målt.', '',
             '| Område | Status | Hva kontrolleres? | Testmiljø og avgrensning |', '| --- | --- | --- | --- |']
    for check in report['checks']:
        title, purpose, environment = scope(check)
        lines.append(f'| {text(title)} ({text(check["id"])}) | {text(check["status"])} | {text(purpose)} | {text(environment)} |')
    lines += ['', '### Individuelle testnavn fra lagrede resultater', '',
              'Åpne gruppene nedenfor. Avbrutte kjøringer kan ha ufullstendige logger. Testlisten endrer ingen skår og er ikke et mål på kravdekning.', '']
    for check in report['checks']:
        recorded = cases(check, folder)
        if not recorded:
            continue
        lines += ['<details>', f'<summary>{html.escape(scope(check)[0])}: {len(recorded)} registrerte testtilfeller</summary>', '',
                  '| Fil / suite | Testnavn | Resultat |', '| --- | --- | --- |']
        lines += [f'| {text(c.get("suite", ""))} | {text(c["name"])} | {text(c["status"])} |' for c in recorded]
        lines += ['', '</details>', '']
    return lines


def benchmark_detail_lines(report, folder):
    lines = ['### Arbeidsmengde og råmålinger', '',
             'p95 betyr at 95 % av prøvene var like raske eller raskere. Logisk tid er simulert tid; throughput er målt '
             'avspillingshastighet. Dette måler ikke FPS, fysisk USB eller internett. Rådata fra ufullførte grupper gir ingen ny skår.', '']
    def value(v):
        return '—' if v is None else f'{v:.4f}' if isinstance(v, float) else text(v)
    for item in benchmark_details(report, folder):
        lines += [f'#### {text(item["title"])} · {text(item["status"])}', '', f'Lagret metode: {text(item["method"])}', '',
                  f'[Rådata]({item["filename"]})', '',
                  '| Profil | Prøver / meldinger | Logisk tid (s) | p50 ms | p95 ms | p99 ms | Maks ms | Operasjoner / meldinger per sekund |',
                  '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |']
        lines += ['| ' + ' | '.join(value(row[k]) for k in ('name', 'count', 'logical_seconds', 'p50', 'p95', 'p99', 'maximum', 'throughput')) + ' |' for row in item['rows']]
        lines.append('')
    return lines


def review_lines(review):
    status = review.get('status', 'complete')
    lines = [f"### {text(review.get('timestamp', ''))} · {text(review.get('reviewer', ''))}", '',
             f"Status: {text(status)}. UX-skår: {number(review.get('score'))} / 10.", '']
    if review.get('reason'):
        lines += [text(review['reason']), '']
    if 'proposed_score' in review:
        lines += [f"Foreslått UX-skår {number(review['proposed_score'])} / 10 brukes ikke i FoM.", '']
    generated = '\n'.join((f"Fungerte godt: {review.get('worked', '')}",
                           f"Forbedringsbehov: {review.get('improve', '')}",
                           f"Prioritet neste iterasjon: {review.get('priority', '')}"))
    if review.get('comment') and review['comment'] != generated:
        lines += [block(review['comment']), '']
    for key, title in [('worked', 'Det som fungerte'), ('improve', 'Forbedringsbehov'), ('priority', 'Neste prioritet')]:
        if review.get(key):
            lines += [f'**{title}**', '', block(review[key]), '']
    if review.get('tasks'):
        labels = {'done': 'Gjennomført', 'problem': 'Problem', 'skipped': 'Ikke prøvd'}
        lines += ['| Brukeroppgave | Resultat | Observasjon |', '| --- | --- | --- |']
        lines += [f"| {text(task['title'])} | {text(labels.get(task['status'], task['status']))} | {text(task.get('comment', ''))} |" for task in review['tasks']]
        lines.append('')
    return lines


def score_lines(report):
    summary, weights = report['summary'], report['policy']['weights']
    formula = ' + '.join(f"{100 * weights[key]:g} % × {symbol}" for key, symbol in [('function', 'F'), ('performance', 'P'), ('ux', 'U')])
    lines = ['## Slik beregnes samlet FoM', '', f'**FoM = {formula}**, på skalaen 0–100.', '',
             '| Del | Skår / 100 | Vekt | Vektet bidrag | Grunnlag |', '| --- | ---: | ---: | ---: | --- |']
    for key, title, description in (
        ('function', 'F – funksjon', 'Lik vekt mellom funksjonsgruppene: enhetstester, integrasjon/nettleser og plattformens kapasitetskontroll.'),
        ('performance', 'P – benchmarks / ytelse', 'Lik vekt mellom målte benchmarkgrupper; lik vekt mellom profilene i hver gruppe.'),
        ('ux', 'U – brukeropplevelse', 'Siste fullførte UX-skår multiplisert med 10.'),
    ):
        value = summary[key]
        groups = [check for check in report['checks'] if check['category'] == key]
        complete = key == 'ux' or bool(groups) and all(check['status'] in ('PASS', 'FAIL') and check.get('score') is not None for check in groups)
        contribution = value * weights[key] if value is not None and complete else None
        if not complete:
            description += ' Ufullstendig komponent; skåren viser bare et delgjennomsnitt.'
        lines.append(f'| {title} | {number(value)} | {weights[key] * 100:g} % | {number(contribution)} | {description} |')
    lines += ['', f"**Samlet FoM: {number(summary['fom'])} / 100 · {text(summary['status'])}.**", '',
              f"Teknisk skår uten UX: {number(summary['technical'])} / 100. "
              'Den normaliserer F og P etter deres samlede vekt og er et eget, åpent punkt i grafen.', '',
              'Hver funksjonsgruppes skår er beståttandel × 100. Kapasitetskontrollen gir 100 ved PASS og 0 ved FAIL. '
              'Hver ytelsesprofil får `100 × min(1, budsjett / målt p95)`, med 100 ved målt null.', '',
              'Målte feil (FAIL) trekker skåren ned og beholdes i grafen. BLOCKED betyr at en måling mangler eller ikke kan stoles på; '
              'da beregnes ingen samlet FoM. Delverdiene over kan være ufullstendige. UX fylles aldri inn automatisk.', '']
    for category, symbol in [('function', 'F'), ('performance', 'P')]:
        inputs = ', '.join(f"{text(check['id'])}: {number(check.get('score'))}" for check in report['checks'] if check['category'] == category)
        lines += [f'Grupper i {symbol}: {inputs or "Ingen"}.', '']
    return lines


def render_markdown(root, runs):
    history = ['# Appens FoM-historikk', '', '![FoM-score gjennom iterasjoner](history.svg)', '',
               '[Kort utviklingsoversikt](overview.md) · [HTML-oversikt](index.html) · [Kjøreguide og skårformel](README.md)', '',
               'F = funksjonstester, P = benchmarkytelse, U = brukeropplevelse (alle 0–100). '
               'Vektene står i hver rapport. Bare sammenlignbare målinger kobles i grafen.', '',
               '| # | Iterasjon / rapport | Tid (UTC) | F | P | U | FoM | Status |',
               '| --- | --- | --- | ---: | ---: | ---: | ---: | --- |']
    for index, report in enumerate(runs, 1):
        summary = report['summary']
        history.append(f"| {index} | [{text(report['label'])}](runs/{quote(report['id'])}/report.md) | {text(report['timestamp'])} | "
                       f"{number(summary['function'])} | {number(summary['performance'])} | {number(summary['ux'])} | {number(summary['fom'])} | {text(summary['status'])} |")
        folder = root / 'runs' / report['id']
        lines = [f"# {text(report['label'])}", '', '[Alle iterasjoner](../../history.md) · [HTML-rapport](report.html) · [Rårapport](report.json)', '',
                 f"Kjøring: {text(report['id'])}. Tid (UTC): {text(report['timestamp'])}.", '',
                 f"Profil: {text(report['profile'])}. Serie: {text(report['series'])}. Commit: {text(report['commit'])}. Lokale endringer: {report['dirty']}.", '',
                 '![FoM-score gjennom iterasjoner](../../history.svg)', '']
        session = report.get('session', {})
        if session:
            lines += ['## Testøkt', '', f"Vurderer / gruppe: {text(session.get('reviewer', ''))}.", '', block(session.get('context', '')), '']
        lines += score_lines(report)
        lines += coverage_lines(report, folder)
        selftest_log = report.get('selftest_log', 'evaluation-selftest.log')
        lines += ['## Måleverktøyets egenkontroll', '', f"Status: {text(report.get('selftest', 'BLOCKED'))}. "
                  + (f'[Logg]({quote(selftest_log)}).' if (folder / selftest_log).is_file() else 'Ingen logg tilgjengelig.'), '']
        if report.get('selftest_detail'):
            lines += [text(report['selftest_detail']), '']
        for classification, title in [('unit', 'Enhetstester (unit tests)'), ('function', 'Integrasjon og andre funksjonstester'), ('benchmark', 'Benchmarks')]:
            lines += [f'## {title}', '']
            lines += checks_table([check for check in report['checks'] if kind(check) == classification])
        lines += ['Plattformens kapasitetsbenchmark bidrar til F (korrekthet); dets rå tidsmålinger gis ingen oppdiktet ytelsesvekt.', '',
                  '### Målte ytelsesprofiler', '', '| Profil | p95 ms | Budsjett ms | Skår / 100 |', '| --- | ---: | ---: | ---: |']
        lines += [f"| {text(metric['name'])} | {metric['value']:.4f} | {metric['budget']:.4f} | {number(metric['score'])} |" for metric in report.get('metrics', [])]
        lines += ['', '### Rådata fra benchmarks', '']
        raw = sorted(folder.glob('*benchmark*.json'))
        if (folder / 'backend-full.json').is_file():
            raw.append(folder / 'backend-full.json')
        lines += [f'- [{text(path.name)}]({quote(path.name)})' for path in raw] or ['Ingen rådatafiler; se status og logger ovenfor.']
        lines += ['', *benchmark_detail_lines(report, folder)]
        lines += ['', '## Brukeropplevelse (UX)', '',
                  'Ny brukervurdering har to spørsmål: Beskriv brukeropplevelsen med egne ord, og gi en skår fra 1–10. '
                  'Delvise svar beholdes uten å gi UX-poeng.', '']
        inputs = sorted(report.get('reviews', []) + report.get('manual_inputs', []), key=lambda review: review.get('timestamp', ''))
        if not inputs:
            lines += ['Venter på gruppens UX-skår og kommentarer.', '']
        for review in inputs:
            lines += review_lines(review)
        lines += ['## Feil og blokkeringer', '']
        failed = [check for check in report['checks'] if check['status'] != 'PASS']
        lines += checks_table(failed) if failed else ['Ingen registrerte feil i produktkontrollene.', '']
        for check in failed:
            log = folder / check.get('log', '')
            if log.is_file():
                diagnostic = log.read_text(encoding='utf-8', errors='replace')
                # Keep Markdown readable; the linked log retains the entire output.
                excerpt = diagnostic[-6000:]
                lines += [f"### {text(check['id'])}: {text(check['status'])}", '',
                          ('Siste 6000 tegn fra loggen:' if len(diagnostic) > 6000 else 'Loggutdrag:'), '', block(excerpt), '']
        lines += ['## Måleomfang', '', *['- ' + text(value) for value in report.get('limitations', [])], '',
                  '[Til neste iterasjon](next-iteration.md) · [Maskinlesbar oppsummering](summary.json)', '']
        (folder / 'report.md').write_text('\n'.join(lines), encoding='utf-8')
    (root / 'history.md').write_text('\n'.join(history) + '\n', encoding='utf-8')
