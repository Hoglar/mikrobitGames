#!/usr/bin/env python3
"""Run application checks and guide the team through a combined evaluation."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import signal
import subprocess
import sys
import time
import traceback
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tests/evaluation'))
from reporting import fmt, load_runs, render, save_json
from scoring import POLICY, latency_score, summarize, validate_feedback
from interaction import prompt_review, prompt_session

DEFAULT_OUTPUT = ROOT / 'results/fom/app'


def now():
    return datetime.now(timezone.utc).isoformat()


def stamp():
    return datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S.%fZ')


def probe(command):
    try:
        result = subprocess.run(command, cwd=ROOT, text=True, capture_output=True, timeout=10)
        return result.stdout.strip() if result.returncode == 0 else 'unavailable'
    except (OSError, subprocess.TimeoutExpired):
        return 'unavailable'


def digest_paths(directories, files=()):
    paths = set(ROOT / f for f in files)
    for directory in directories:
        paths.update(p for p in (ROOT / directory).rglob('*') if p.is_file()
                     and not any(x in p.parts for x in ('__pycache__', 'node_modules', 'build', 'runs'))
                     and p.suffix not in ('.pyc', '.log'))
    digest = hashlib.sha256()
    for path in sorted(paths):
        digest.update(str(path.relative_to(ROOT)).encode() + b'\0' + path.read_bytes() + b'\0')
    return digest.hexdigest()


def controls_digest():
    return digest_paths(['tests', 'webapp/tests', 'backend/tests', 'microbit/tests', 'spec/contracts', 'backend/verification'],
                        ['webapp/verification/benchmark.js', 'webapp/verification/benchmark-input.js', 'webapp/package-lock.json',
                         'webapp/playwright.config.js', 'webapp/playwright.app.config.js', 'microbit/CMakeLists.txt'])


def execute(command, cwd, log, env=None, timeout=300):
    """Bound the entire subprocess tree and retain diagnostics on failure."""
    began = time.monotonic()
    status, code = 'DONE', None
    try:
        with log.open('w', encoding='utf-8') as stream:
            process = subprocess.Popen(command, cwd=cwd, stdout=stream, stderr=subprocess.STDOUT,
                                       env={**os.environ, **(env or {})}, start_new_session=True)
            try:
                code = process.wait(timeout=timeout)
            except (subprocess.TimeoutExpired, KeyboardInterrupt) as error:
                if os.name == 'nt':
                    # Windows has no killpg; stop children as well as the runner.
                    subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'],
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10)
                    if process.poll() is None:
                        process.kill()
                else:
                    os.killpg(process.pid, signal.SIGKILL)
                process.wait()
                if isinstance(error, KeyboardInterrupt):
                    raise
                status = 'BLOCKED'
                stream.write(f'\nTimeout after {timeout}s\n')
    except OSError as error:
        log.write_text(str(error), encoding='utf-8')
        status = 'BLOCKED'
    return {'returncode': code, 'execution': status, 'seconds': round(time.monotonic() - began, 3),
            'command': list(map(str, command)), 'log': log.name}


def test_counts(log, kind):
    text = log.read_text(encoding='utf-8', errors='replace') if kind != 'junit' else ''
    if kind == 'tap':
        counts = {key: int(value) for key, value in re.findall(r'^# (tests|pass|fail|cancelled|skipped|todo) (\d+)\s*$', text, re.M)}
        return {'tests': counts.get('tests', 0), 'passed': counts.get('pass', 0),
                'failed': counts.get('fail', 0) + counts.get('cancelled', 0),
                'skipped': counts.get('skipped', 0) + counts.get('todo', 0)}
    if kind == 'python':
        for line in reversed(text.splitlines()):
            if line.startswith('{'):
                return json.loads(line)
    if kind == 'junit':
        tree = ET.parse(log.with_suffix('.xml')).getroot()
        cases = list(tree.iter('testcase'))
        failed = sum(c.find('failure') is not None or c.find('error') is not None for c in cases)
        skipped = sum(c.find('skipped') is not None for c in cases)
        return {'tests': len(cases), 'passed': len(cases) - failed - skipped, 'failed': failed, 'skipped': skipped}
    return {'tests': 0, 'passed': 0, 'failed': 0, 'skipped': 0}


def check_result(result, counts):
    # Empty discovery, skipped cases, or malformed reports cannot improve FoM.
    total = counts['tests']
    valid = total > 0 and counts['passed'] + counts['failed'] + counts['skipped'] == total
    if result['execution'] == 'BLOCKED' or not valid or counts['skipped']:
        return 'BLOCKED', None
    if result['returncode'] != 0 and counts['failed'] == 0:
        return 'BLOCKED', None  # server startup / runner failure, not measured product behavior
    return ('FAIL' if counts['failed'] else 'PASS'), 100 * counts['passed'] / total


class Evaluation:
    def __init__(self, args, folder):
        self.args, self.folder = args, folder
        self.checks, self.metrics = [], []
        self.errors = {}
        self.node = args.node
        venv = ROOT / ('.venv/Scripts/python.exe' if os.name == 'nt' else '.venv/bin/python')
        self.python = str(venv) if venv.exists() else sys.executable
        self.env = {'EVALUATION_PYTHON': self.python, 'CI': '1'}

    def run(self, name, command, cwd=ROOT, env=None, timeout=300):
        print(f'  {name} …', flush=True)
        return execute(command, cwd, self.folder / (name + '.log'), {**self.env, **(env or {})}, timeout)

    def step(self, name, action, category='function'):
        """Keep one broken runner/parser from cancelling independent measurements."""
        try:
            return action()
        except Exception as error:
            detail = f'{type(error).__name__}: {error}. Andre uavhengige tester fortsetter.'
            self.errors[name] = detail
            log = self.folder / (name + '.log')
            with log.open('a', encoding='utf-8') as stream:
                stream.write('\n' + traceback.format_exc())
            if category is not None:
                self.blocked(name, detail, category)
            else:
                print(f'    BLOCKED: {name}: {detail}', flush=True)
            return None

    def tests(self, name, command, kind, cwd=ROOT, env=None):
        result = self.run(name, command, cwd, env)
        counts = test_counts(self.folder / result['log'], kind)
        status, score = check_result(result, counts)
        text = (self.folder / result['log']).read_text(encoding='utf-8', errors='replace')
        if any(marker in text for marker in ('ModuleNotFoundError:', 'spawnSync git EPERM', 'listen EPERM:', 'ERR_MODULE_NOT_FOUND')):
            status, score = 'BLOCKED', None
        row = dict(result, id=name, category='function', status=status, score=score, counts=counts,
                   detail=f"{counts['passed']}/{counts['tests']} bestått, {counts['failed']} feil, {counts['skipped']} utelatt")
        self.checks.append(row)
        print(f'    {status}: {row["detail"]}', flush=True)
        return row

    def blocked(self, name, detail, category='function'):
        log = self.folder / (name + '.log')
        with log.open('a', encoding='utf-8') as stream:
            stream.write('\n' + detail + '\n')
        self.checks.append(dict(id=name, category=category, status='BLOCKED', score=None, detail=detail, log=log.name))
        print(f'    BLOCKED: {name}: {detail}', flush=True)

    def benchmark(self, name, command, report_name, extract, cwd=ROOT, env=None):
        result = self.run(name, command, cwd, env)
        row = dict(result, id=name, category='performance', status='BLOCKED', score=None)
        if result['execution'] == 'BLOCKED':
            raise ValueError('Kjøringen kunne ikke fullføres.')
        if result['returncode'] != 0:
            # An assertion is a measured failure; missing runtime dependencies are not.
            log = (self.folder / result['log']).read_text(encoding='utf-8')
            if 'AssertionError' in log:
                row.update(status='FAIL', score=0, detail='Benchmarkens korrekthetskrav feilet; se logg.')
            else:
                raise ValueError('Benchmark startet ikke eller avsluttet uten målinger; se logg.')
        else:
            data = json.loads((self.folder / report_name).read_text(encoding='utf-8'))
            metrics = extract(data)
            if not metrics:
                raise ValueError('Ingen målinger.')
            self.metrics.extend(metrics)
            row.update(score=sum(m['score'] for m in metrics) / len(metrics),
                       status='PASS' if all(m['value'] <= m['budget'] for m in metrics) else 'FAIL',
                       detail=f'{len(metrics)} målte profiler; rådata: {report_name}')
        self.checks.append(row)
        print(f'    {row["status"]}', flush=True)


def input_metrics(data):
    rows = data['measurements']
    if {(m['rateHz'], m['subscribers']) for m in rows} != {(50, 1), (50, 4), (500, 1), (500, 4)} or len(rows) != 4:
        raise ValueError('Mangler avtalte inputprofiler.')
    for m in rows:
        if m['callbacks'] != m['snapshots'] * m['subscribers'] or m['snapshots'] != m['rateHz'] * 300:
            raise ValueError('Ufullstendig replay.')
    return [metric(f"input-{m['rateHz']}Hz-{m['subscribers']}-abonnenter", m['propagationMs']['p95'], POLICY['input_p95_ms']) for m in rows]


def metric(name, value, budget):
    return {'name': name, 'value': value, 'budget': budget, 'unit': 'ms', 'score': latency_score(value, budget)}


def game_metrics(data):
    rows = data['measurements']
    if {m['name'] for m in rows} != {'snake', 'viking', 'stars', 'reaction', 'balance', 'tetris'} or len(rows) != 6:
        raise ValueError('Mangler spillprofiler.')
    if any(m['count'] != 1000 or len(m['samples']) != 1000 for m in rows):
        raise ValueError('Mangler spillprøver.')
    return [metric(m['name'], m['p95Ms'], POLICY['game_workload_p95_ms']) for m in rows]


def finished(result):
    return isinstance(result, dict) and result.get('execution') != 'BLOCKED' and result.get('returncode') == 0


def evaluation_selftest(evaluation, report):
    name = 'evaluation-selftest'
    report['selftest_log'] = name + '.log'

    def measure():
        result = evaluation.run(name, [evaluation.python, 'tests/evaluation/python-suite.py', 'tests/evaluation'])
        counts = test_counts(evaluation.folder / result['log'], 'python')
        report['selftest'] = check_result(result, counts)[0]
        report['selftest_counts'] = counts
        report['selftest_detail'] = f"{counts['passed']}/{counts['tests']} bestått, {counts['failed']} feil, {counts['skipped']} utelatt"
        print(f"    {report['selftest']}: {report['selftest_detail']}", flush=True)

    evaluation.step(name, measure, category=None)
    if name in evaluation.errors:
        report['selftest_detail'] = evaluation.errors[name]


def platform_capacity(evaluation):
    folder = evaluation.folder
    result = evaluation.run('platform-benchmark', [evaluation.node, 'verification/benchmark.js'], ROOT / 'webapp',
                            {'UNIT_BENCHMARK_REPORT': str(folder / 'platform-benchmark.json')})
    log = (folder / result['log']).read_text(encoding='utf-8', errors='replace')
    status = 'PASS' if finished(result) else 'FAIL' if result['execution'] != 'BLOCKED' and 'AssertionError' in log else 'BLOCKED'
    evaluation.checks.append(dict(result, id='platform-capacity', category='function', status=status,
                                 score=100 if status == 'PASS' else 0 if status == 'FAIL' else None,
                                 detail='50/500 Hz opptak, fast bufferkapasitet og eksport; tidsmålinger i platform-benchmark.json.'))
    print(f'    {status}', flush=True)


def browser_performance(evaluation, environment):
    data = json.loads((evaluation.folder / 'browser-benchmark.json').read_text(encoding='utf-8'))
    environment['browser'] = data['browser']
    metrics = input_metrics(data)
    evaluation.metrics.extend(dict(m, name='browser-' + m['name']) for m in metrics)
    status = 'PASS' if all(m['score'] == 100 for m in metrics) else 'FAIL'
    evaluation.checks.append(dict(id='browser-performance', category='performance', status=status,
                                 score=sum(m['score'] for m in metrics) / len(metrics),
                                 detail='Native Streams i Chromium; 50/500 Hz og 1/4 abonnenter.', log='browser-input.log'))
    print(f'    {status}: browser-performance', flush=True)


def browser_checks(evaluation, environment):
    folder = evaluation.folder
    cli = ROOT / 'webapp/node_modules/@playwright/test/cli.js'

    def preflight():
        if not cli.exists():
            return None
        return evaluation.run('browser-preflight', [evaluation.node, 'tests/evaluation/browser-preflight.mjs'], timeout=30)

    ready = evaluation.step('browser-preflight', preflight)
    if not finished(ready):
        for name, category in [('browser-app', 'function'), ('browser-input', 'function'), ('browser-performance', 'performance')]:
            evaluation.blocked(name, 'Chromium eller avhengigheter mangler. Se browser-preflight.log og oppsett i results/fom/app/README.md.', category)
        return
    build = evaluation.step('web-build', lambda: evaluation.run('web-build', [evaluation.node, 'verification/build.js'], ROOT / 'webapp'))
    if finished(build):
        evaluation.step('browser-app', lambda: evaluation.tests('browser-app',
                        [evaluation.node, str(cli), 'test', '--config', 'playwright.app.config.js', '--reporter=junit'],
                        'junit', ROOT / 'webapp', {'PLAYWRIGHT_JUNIT_OUTPUT_FILE': str(folder / 'browser-app.xml')}))
    else:
        evaluation.blocked('browser-app', 'Webapp-bygget feilet; se web-build.log.')
    evaluation.step('browser-input', lambda: evaluation.tests('browser-input',
                    [evaluation.node, str(cli), 'test', '--config', 'playwright.config.js', '--reporter=junit'],
                    'junit', ROOT / 'webapp', {'PLAYWRIGHT_JUNIT_OUTPUT_FILE': str(folder / 'browser-input.xml'),
                                            'INPUT_BROWSER_BENCHMARK_REPORT': str(folder / 'browser-benchmark.json')}))
    evaluation.step('browser-performance', lambda: browser_performance(evaluation, environment), 'performance')


def backend_full(evaluation, environment):
    folder = evaluation.folder
    before = set((ROOT / 'backend/results/runs').glob('*/report.json'))
    result = evaluation.run('backend-full', [sys.executable, 'backend/check', 'full'], timeout=3600)
    paths = set((ROOT / 'backend/results/runs').glob('*/report.json')) - before
    if len(paths) != 1:
        evaluation.blocked('backend-full', 'Backendkjøringen leverte ikke nøyaktig én ny rapport; se backend-full.log.')
        return
    raw = json.loads(paths.pop().read_text(encoding='utf-8'))
    save_json(folder / 'backend-full.json', raw)
    environment['backend'] = {k: v for k, v in raw.get('environment', {}).items() if k != 'fixture_clock'}
    environment['backend_controls'] = raw.get('control_digest')
    values = list(raw.get('controls', {}).values())
    complete = bool(values) and result['execution'] != 'BLOCKED' and not raw.get('blockers') and all(s in ('PASS', 'FAIL') for s in values)
    status = ('PASS' if all(v == 'PASS' for v in values) else 'FAIL') if complete else 'BLOCKED'
    evaluation.checks.append(dict(result, id='backend-full', category='function', status=status,
                                 score=100 * values.count('PASS') / len(values) if complete else None,
                                 detail='API/database/AI-integrasjon og backend-benchmarks; se backend-full.json.'))
    print(f'    {status}: backend-full', flush=True)


def automatic_checks(evaluation, report):
    """Run independent stages even if a preceding command or evidence parser fails."""
    folder, args = evaluation.folder, evaluation.args
    evaluation_selftest(evaluation, report)
    for name, pattern in [('web-unit', 'tests/unit/*.test.js'), ('input-unit', 'tests/microbit-input/*.test.js')]:
        def unit_suite():
            files = sorted(str(p.relative_to(ROOT / 'webapp')) for p in (ROOT / 'webapp').glob(pattern))
            return evaluation.tests(name, [evaluation.node, '--test', '--test-reporter=tap', '--test-timeout=10000', *files], 'tap', ROOT / 'webapp')
        evaluation.step(name, unit_suite)
    evaluation.step('backend-unit', lambda: evaluation.tests('backend-unit',
                    [evaluation.python, 'tests/evaluation/python-suite.py', 'backend/tests/unit'], 'python'))
    build = ROOT / 'microbit/build/evaluation'
    configured = evaluation.step('firmware-configure', lambda: evaluation.run('firmware-configure',
                                ['cmake', '-S', 'microbit', '-B', str(build), '-DCMAKE_BUILD_TYPE=Debug']))
    built = evaluation.step('firmware-build', lambda: evaluation.run('firmware-build', ['cmake', '--build', str(build)])) if finished(configured) else None
    if finished(built):
        evaluation.step('firmware', lambda: evaluation.tests('firmware',
                        ['ctest', '--test-dir', str(build), '--output-on-failure', '--output-junit', str(folder / 'firmware.xml')], 'junit'))
        evaluation.step('cross-component', lambda: evaluation.tests('cross-component',
                        [evaluation.node, '--test', '--test-reporter=tap', 'tests/integration/components.test.mjs'], 'tap',
                        env={'FIRMWARE_SIMULATOR': str(build / 'tests/firmware_simulator')}))
    else:
        evaluation.blocked('firmware', 'Bygging feilet; se firmware-configure.log og firmware-build.log.')
        evaluation.blocked('cross-component', 'Firmware-simulator mangler.')
    evaluation.step('platform-capacity', lambda: platform_capacity(evaluation))
    evaluation.step('input-benchmark', lambda: evaluation.benchmark('input-benchmark',
                    [evaluation.node, 'verification/benchmark-input.js'], 'input-benchmark.json', input_metrics,
                    ROOT / 'webapp', {'INPUT_BENCHMARK_REPORT': str(folder / 'input-benchmark.json')}), 'performance')
    evaluation.step('games-benchmark', lambda: evaluation.benchmark('games-benchmark',
                    [evaluation.node, 'tests/evaluation/benchmark-games.mjs', str(folder / 'games-benchmark.json')],
                    'games-benchmark.json', game_metrics), 'performance')
    if not args.no_browser:
        evaluation.step('browser-stage', lambda: browser_checks(evaluation, report['environment']))
    if args.backend_full:
        evaluation.step('backend-full', lambda: backend_full(evaluation, report['environment']))
    else:
        report['limitations'].append('Levende API, PostgreSQL og lokal AI er ikke kjørt. Bruk --backend-full i konfigurert backend-testmiljø for en egen utvidet serie.')


def feedback(root, run_id, score, comment, reviewer, *, details=None):
    validate_feedback(score, comment, reviewer)
    runs = load_runs(root)
    if not runs:
        raise ValueError('Ingen lagrede kjøringer. Kjør run først.')
    report = runs[-1] if run_id == 'latest' else next((r for r in runs if r['id'] == run_id), None)
    if report is None:
        raise ValueError('Ukjent kjørings-ID.')
    folder = root / 'runs' / report['id']
    review = dict(timestamp=now(), score=score, comment=comment.strip(), reviewer=reviewer.strip())
    if details:
        review.update({key: details[key] for key in ('tasks', 'worked', 'improve', 'priority') if key in details})
    save_json(folder / f'feedback-{stamp()}.json', review)
    render(root)
    print(f"Vurdering lagret for {report['label']} ({report['id']}).")


def guided_feedback(root, report, folder, unchanged=None):
    """Keep automated evidence intact, including when the manual review stops."""
    review = prompt_review(report.get('session', {}).get('reviewer', ''))
    if review['status'] == 'complete' and unchanged is not None and not unchanged():
        review['proposed_score'] = review.pop('score')
        review.update(status='source-changed',
                      reason='Kode eller testgrunnlag ble endret under brukervurderingen. Kjør en ny evaluering.')
    if review['status'] == 'complete':
        feedback(root, report['id'], review['score'], review['comment'], review['reviewer'], details=review)
        return review
    save_json(folder / f'user-input-{stamp()}.json', dict(review, timestamp=now()))
    render(root)
    print('Delvis brukervurdering og automatiske resultater er lagret.', flush=True)
    if review.get('reason'):
        print(review['reason'], flush=True)
    else:
        print('Fullfør vurderingen senere med feedback-kommandoen.', flush=True)
    return review


def run(args):
    folder = args.output / 'runs' / stamp()
    folder.mkdir(parents=True)
    evaluation = Evaluation(args, folder)
    profile = 'local-core' if args.no_browser else 'local-browser'
    if args.backend_full:
        profile += '+backend-full'
    environment = {'machine': platform.node(), 'platform': platform.platform(), 'python': probe([evaluation.python, '--version']),
                   'node': probe([args.node, '--version']), 'compiler': probe(['c++', '--version']).splitlines()[0],
                   'cmake': probe(['cmake', '--version']).splitlines()[0], 'cpu_count': os.cpu_count(),
                   'library_path': os.environ.get('LD_LIBRARY_PATH', '')}
    cpu = Path('/proc/cpuinfo')
    environment['cpu'] = next((line.split(':', 1)[1].strip() for line in cpu.read_text().splitlines() if line.startswith('model name')), platform.machine()) if cpu.exists() else platform.processor()
    environment['python_packages'] = probe([evaluation.python, '-c', 'import importlib.metadata as m, json; print(json.dumps(sorted((d.metadata["Name"], d.version) for d in m.distributions())))'])
    control_digest = controls_digest()
    sources = ['webapp/src', 'backend/api/src', 'backend/ai-service/src', 'backend/database/migrations', 'microbit/src']
    source_files = ['webapp/index.html']
    report = dict(id=folder.name, timestamp=now(), label=args.label, profile=profile, policy=POLICY,
                  commit=probe(['git', 'rev-parse', 'HEAD']), dirty=bool(probe(['git', 'status', '--porcelain'])),
                  source_digest=digest_paths(sources, source_files), control_digest=control_digest, environment=environment,
                  checks=evaluation.checks, metrics=evaluation.metrics, selftest='BLOCKED',
                  limitations=['Firmware kjøres på vertsmaskinen med simulert maskinvare; USB, fysisk knapp-til-piksel-latens og tillatelsesdialog er ikke målt.',
                               'Nettlesertester bruker mockede API-svar og Web Serial. Lokal backendkontroll tester reglene, ikke database eller AI-runtime.',
                               'Benchmark måler input-replay og spillenes simulering; FPS, tegning/GPU og nettverkslatens inngår ikke.',
                               'Maskinlast kan påvirke ytelsen. Kjør på samme maskin uten andre tunge oppgaver.'])
    if getattr(args, 'session', None):
        report['session'] = args.session
    print(f'Iterasjon: {args.label} · {profile}\nResultater: {folder}', flush=True)
    interrupted = False
    try:
        automatic_checks(evaluation, report)
    except KeyboardInterrupt:
        interrupted = True
        evaluation.blocked('interrupted', 'Kjøringen ble avbrutt. Delresultater er bevart.')
    except Exception as error:
        evaluation.blocked('runner-error', f'{type(error).__name__}: {error}\n{traceback.format_exc()}')

    def verify_sources():
        if digest_paths(sources, source_files) != report['source_digest']:
            evaluation.blocked('source-changed', 'Produktkoden endret seg under målingen. Kjør på nytt.')

    def verify_controls():
        if controls_digest() != control_digest:
            evaluation.blocked('controls-changed', 'Tester eller måleoppsett endret seg under kjøringen. Kjør på nytt.')

    evaluation.step('source-integrity', verify_sources)
    evaluation.step('controls-integrity', verify_controls)
    report['series'] = hashlib.sha256(json.dumps({'controls': control_digest, 'profile': profile, 'environment': environment, 'policy': POLICY}, sort_keys=True).encode()).hexdigest()[:12]
    report['finished_at'] = now()
    save_json(folder / 'report.json', report)
    render(args.output)
    summary = summarize(report)
    print(f"Automatiske tester ferdige. Teknisk skår: {fmt(summary['technical'])} · {summary['status']}", flush=True)
    review = None
    if getattr(args, 'interactive', False) and not interrupted:
        if summary['status'] == 'BLOCKED':
            print('Noen automatiske målinger er blokkert. Brukervurderingen blir bevart, '
                  'men samlet FoM krever komplette automatiske målinger.', flush=True)
        review = guided_feedback(args.output, report, folder,
                                 unchanged=lambda: digest_paths(sources, source_files) == report['source_digest']
                                 and controls_digest() == control_digest)
        if review['status'] == 'complete':
            summary = summarize(report, review)
    print(f"FoM: {fmt(summary['fom'])} · {summary['status']}\nRapport: {folder / 'report.html'}\nGraf: {args.output / 'index.html'}\nTil neste iterasjon: {folder / 'next-iteration.md'}", flush=True)
    if report['selftest'] == 'FAIL' or any(c['status'] == 'FAIL' for c in evaluation.checks):
        return 1
    if review and review['status'] == 'source-changed':
        return 2
    return 2 if summary['status'] == 'BLOCKED' else 0


def main(argv=None):
    parser = argparse.ArgumentParser(description='Felles tester, benchmark, FoM-graf og UX-tilbakemelding.')
    parser.add_argument('--output', type=Path, default=DEFAULT_OUTPUT, help='Rapportrot (standard: results/fom/app)')
    sub = parser.add_subparsers(dest='command', required=True)
    check = sub.add_parser('run', help='Kjør en ny iterasjon og bevar alle resultater')
    check.add_argument('--label', help='F.eks. 01 – baseline; etterspørres i veiledet kjøring')
    mode = check.add_mutually_exclusive_group()
    mode.add_argument('--interactive', dest='interactive', action='store_true', default=None,
                      help='Be om testkontekst og veiledet brukervurdering (standard i terminal)')
    mode.add_argument('--non-interactive', dest='interactive', action='store_false',
                      help='Kjør uten spørsmål, f.eks. i CI; krever --label')
    check.add_argument('--node', default='node', help='Node-binær; bruk prosjektets .nvmrc-versjon')
    check.add_argument('--no-browser', action='store_true', help='Egen local-core-serie uten Chromium')
    check.add_argument('--backend-full', action='store_true', help='Kjør også eksisterende backend/check full i konfigurert testmiljø')
    review = sub.add_parser('feedback', help='Legg UX-vurdering til en kjøring, uten å kjøre tester på nytt')
    review.add_argument('run_id', help='Kjørings-ID eller latest')
    review.add_argument('--score', required=True, type=float, help='Gruppens samlede UX-skår, 1–10')
    review.add_argument('--comment', required=True, help='Hvordan brukeropplevelsen var')
    review.add_argument('--reviewer', required=True, help='Vurderer eller gruppenavn')
    sub.add_parser('report', help='Regenerer graf og lesbare rapporter fra historikken')
    args = parser.parse_args(argv)
    args.output = args.output.resolve()
    try:
        if args.command == 'run':
            if args.interactive is None:
                args.interactive = sys.stdin.isatty()
            if args.interactive:
                try:
                    session = prompt_session(args.label)
                except (EOFError, KeyboardInterrupt):
                    print('\nAvbrutt før teststart. Ingen ny kjøring er opprettet.')
                    return 130
                args.label = session.pop('label')
                args.session = session
            elif not args.label or not args.label.strip():
                parser.error('--label må oppgis når kjøringen ikke er interaktiv.')
            return run(args)
        if args.command == 'feedback':
            feedback(args.output, args.run_id, args.score, args.comment, args.reviewer)
        else:
            args.output.mkdir(parents=True, exist_ok=True)
            render(args.output)
        print(f'Graf: {args.output / "index.html"}')
        return 0
    except (OSError, ValueError) as error:
        parser.error(str(error))


if __name__ == '__main__':
    raise SystemExit(main())
