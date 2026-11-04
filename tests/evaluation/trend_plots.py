"""Portable Matplotlib figures; the report tables work without this optional extra."""
import os
from pathlib import Path
import tempfile

from trends import metric_result, number


def plots(root, runs, data):
    # Matplotlib's normal cache may be outside the writable test environment.
    with tempfile.TemporaryDirectory(prefix='mbg-report-plots-') as cache:
        previous = os.environ.get('MPLCONFIGDIR')
        os.environ['MPLCONFIGDIR'] = cache
        try:
            try:
                import matplotlib
                from matplotlib.figure import Figure
            except ImportError:
                return set()  # Never link stale figures from an earlier report.
            with matplotlib.rc_context({'font.family': 'DejaVu Sans', 'font.size': 11,
                                        'svg.fonttype': 'none', 'svg.hashsalt': 'mbg-trends',
                                        'axes.spines.top': False, 'axes.spines.right': False}):
                return draw(root, runs, data, Figure)
        finally:
            if previous is None:
                os.environ.pop('MPLCONFIGDIR', None)
            else:
                os.environ['MPLCONFIGDIR'] = previous


def draw(root, runs, data, Figure):
    written = set()
    ticks = list(range(len(runs)))
    labels = [f'K{i+1}\n{r["timestamp"][8:10]}.{r["timestamp"][5:7]}' for i, r in enumerate(runs)]

    def canvas(title, ylabel):
        fig = Figure(figsize=(10, 4.8), layout='constrained')
        ax = fig.subplots()
        ax.set_title(title, loc='left', fontsize=15, pad=18)
        ax.set_ylabel(ylabel)
        ax.set_xticks(ticks, labels)
        ax.set_xlim(-.6, max(.6, len(runs) - .4))
        ax.grid(axis='y', color='#e2e8f0')
        ax.set_axisbelow(True)
        return fig, ax

    def save(fig, filename, description):
        fig.savefig(Path(root) / filename, format='svg', metadata={'Date': None, 'Description': description})
        written.add(filename)

    fig, ax = canvas('FoM fra baseline', 'FoM / 100 · høyere er bedre')
    ax.set_ylim(0, 112)
    ax.set_yticks([0, 25, 50, 75, 100])
    previous = {}
    for i, row in enumerate(data['rows']):
        run, value = row['run'], row['run']['summary']['fom']
        key = run['series']
        if value is None:
            previous.pop(key, None)
            ax.text(i, 7, 'Venter på UX' if run['summary']['status'] == 'AWAITING_UX' else 'Ingen FoM', ha='center', color='#667085', fontsize=9)
            continue
        if key in previous:
            x, y = previous[key]
            ax.plot([x, i], [y, value], color='#1565c0', linewidth=2)
        ax.plot(i, value, 'o', color='#1565c0', markersize=8)
        ax.annotate(('Baseline · ' if row['baseline'] else '') + number(value), (i, value),
                    xytext=(0, 12), textcoords='offset points', ha='center', fontsize=10)
        previous[key] = (i, value)
    save(fig, 'fom-development.svg', data['message'])

    fig, ax = canvas('Enhetstester: bestått, feil og utelatt', 'Antall tester')
    seen = set()
    for i, row in enumerate(data['rows']):
        units = row['units']
        if not units['valid']:
            ax.text(i, .04, 'Uverifisert /\nmangler', transform=ax.get_xaxis_transform(), ha='center', color='#667085', fontsize=9)
            continue
        bottom = 0
        for key, title, color in [('passed', 'Bestått', '#087f5b'), ('failed', 'Feil', '#c92a2a'), ('skipped', 'Utelatt', '#e67700')]:
            count = units[key]
            ax.bar(i, count, bottom=bottom, width=.45, color=color, label=title if title not in seen else None)
            seen.add(title)
            bottom += count
        ax.annotate(f'{units["passed"]}/{units["tests"]}', (i, bottom), xytext=(0, 7), textcoords='offset points', ha='center')
    maximum = max((r['units']['tests'] for r in data['rows'] if r['units']['valid']), default=1)
    ax.set_ylim(0, max(1, maximum) * 1.3)
    if seen:
        ax.legend(loc='upper left', ncols=3, frameon=False)
    save(fig, 'unit-development.svg', 'Antall enhetstester for webapp, input og backend. Ingen grafverdi ved sviktende egenkontroll.')

    from trends import title
    for j, name in enumerate(data['metrics']):
        fig, ax = canvas(title(name), 'p95 (ms) · lavere er bedre')
        values, budgets, previous = [], set(), {}
        for i, run in enumerate(runs):
            result = metric_result(run, name)
            metric, key = result['metric'], run['series']
            if not result['valid']:
                previous.pop(key, None)
                ax.text(i, .04, 'Uverifisert' if metric else 'Ikke målt', transform=ax.get_xaxis_transform(), ha='center', fontsize=9, color='#667085')
                continue
            value = metric['value']
            values.append(value)
            budgets.add(metric['budget'])
            if key in previous:
                x, y = previous[key]
                ax.plot([x, i], [y, value], color='#1565c0', linewidth=1.5)
            ax.plot(i, value, marker='o', color='#1565c0', markersize=8,
                    markerfacecolor='white' if run['summary']['status'] == 'BLOCKED' else '#1565c0')
            ax.annotate(number(value, 4), (i, value), xytext=(0, 10), textcoords='offset points', ha='center', fontsize=10)
            previous[key] = (i, value)
        ceiling = max(values, default=1) * 1.4 or 1
        ax.set_ylim(0, ceiling)
        for budget in budgets:
            if budget <= ceiling:
                ax.axhline(budget, color='#c92a2a', linestyle='--', label=f'Budsjett {number(budget, 4)} ms')
        note = 'Budsjett: ' + (' / '.join(number(b, 4) for b in sorted(budgets)) or '—') + ' ms. Y-aksen er tilpasset målt tid.'
        ax.set_xlabel(note + '\nÅpent punkt: fullført delmåling i ufullstendig kjøring.', fontsize=10)
        save(fig, f'benchmark-{j+1:02d}.svg', title(name) + '. ' + note)
    return written
