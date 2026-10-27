"""Run the current test foundation; incomplete checks never produce a FoM point."""
import argparse
import signal
from collections import Counter
from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path
import platform
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'backend/tests'))
from controls import CONTROL_VERSION, MODEL_COUNTS, REQUIREMENT_IDS, MODEL_IDS, aggregate, fom

RUNS = ROOT / 'backend/results/runs'


def git(*args):
    result = subprocess.run(['git', '-C', str(ROOT), *args], capture_output=True, text=True)
    return result.stdout.strip() if result.returncode == 0 else None


def control_digest():
    """Identify uncommitted control changes too, with paths and contents."""
    digest = hashlib.sha256()
    paths = [ROOT / 'backend/check']
    for directory in ('backend/tests', 'backend/verification', 'backend/spec', 'spec/contracts/webapp-backend'):
        paths.extend(p for p in (ROOT / directory).rglob('*')
                     if p.is_file() and '__pycache__' not in p.parts and p.suffix != '.pyc')
    for path in sorted(paths):
        digest.update(str(path.relative_to(ROOT)).encode() + b'\0')
        digest.update(path.read_bytes() + b'\0')
    return digest.hexdigest()


def flatten(suite):
    for item in suite:
        if isinstance(item, unittest.TestSuite):
            yield from flatten(item)
        else:
            yield item


def run_suite(directory):
    suite = unittest.TestLoader().discover(str(directory), pattern='test_*.py')
    rows = []
    # One test per suite gives each pending test its own BLOCKED result even
    # when the component is absent in setUpClass. Unit tests share no state.
    for test in flatten(suite):
        output = io.StringIO()
        result = unittest.TextTestRunner(stream=output, verbosity=2).run(unittest.TestSuite([test]))
        statuses = ['FAIL'] if result.errors or result.failures else []
        statuses.extend('BLOCKED' if reason.startswith('BLOCKED:') else 'SKIPPED'
                        for _, reason in result.skipped)
        status = aggregate(statuses or ['PASS'])
        rows.append({'id': test.id(), 'status': status,
                     'detail': '; '.join(reason for _, reason in result.skipped),
                     'observed_failures': len(result.errors) + len(result.failures),
                     'output': output.getvalue()})
    if not rows:
        rows.append({'id': 'discovery', 'status': 'BLOCKED', 'output': 'Ingen tester funnet.'})
    return rows


def summary(rows):
    return dict(Counter(row['status'] for row in rows))


def exit_status(rows):
    # A failed check remains an error even if another check was blocked.
    if any(row['status'] == 'FAIL' or row.get('observed_failures', 0) for row in rows):
        return 1
    if any(row['status'] in {'BLOCKED', 'SKIPPED'} for row in rows):
        return 2
    return 0


from reports import report_text, write_curves


def show_latest(runs):
    reports = sorted(runs.glob('*/report.md')) if runs.exists() else []
    if not reports:
        print('Ingen lagret rapport ennå. Kjør ./backend/check quick først.')
        return 2
    print(reports[-1].read_text())
    print(f'Rapport: {reports[-1]}')
    return 0


def main(argv=None):
    import base64
    import importlib.metadata
    from harness import Blocked
    from remote import CONFIG, MARKER, configure, run_remote
    parser = argparse.ArgumentParser(description='Én kommando for backendens testfase.')
    parser.add_argument('mode', nargs='?', default='full', choices=('selftest','quick','full','report','configure','setup'))
    parser.add_argument('--host')
    parser.add_argument('--repo')
    parser.add_argument('--server', action='store_true', help=argparse.SUPPRESS)
    parser.add_argument('--expected-commit', help=argparse.SUPPRESS)
    parser.add_argument('--expected-controls', help=argparse.SUPPRESS)
    args = parser.parse_args(argv)
    def interrupted(signum, frame):raise KeyboardInterrupt
    for name in ('SIGTERM','SIGHUP'):
        if hasattr(signal,name):signal.signal(getattr(signal,name),interrupted)
    if args.mode == 'setup':
        environment=ROOT/'.venv'
        if not (environment/'bin/python').exists():
            subprocess.run([sys.executable,'-m','venv',str(environment)],check=True)
        for requirements in (ROOT/'backend/verification/requirements.txt',ROOT/'backend/requirements.txt'):
            if requirements.exists():subprocess.run([str(environment/'bin/python'),'-m','pip','install','-r',str(requirements)],check=True)
        print('Python-miljø klart. Testkommandoen er ./backend/check')
        return 0
    if args.mode == 'configure':
        configure(args.host, args.repo or '')
        return 0
    if args.mode == 'report':
        return show_latest(RUNS)
    config=json.loads(CONFIG.read_text()) if CONFIG.exists() else {}
    commit=git('rev-parse','HEAD');state=git('status','--porcelain');digest=control_digest()
    now=datetime.now(timezone.utc)
    report={'format_version':2,'control_version':CONTROL_VERSION,'model_counts':MODEL_COUNTS,
            'mode':args.mode,'timestamp':now.isoformat(),
            'code_commit':commit,'working_tree_dirty':None if state is None else bool(state),
            'control_digest':digest,'python':platform.python_version(),'machine':platform.node(),
            'tool_tests':[],'product_tests':[],'integration_tests':[],'models':{},'measurements':{},
            'controls':dict.fromkeys(REQUIREMENT_IDS+MODEL_IDS,'BLOCKED'),'fom':None,'blockers':[]}
    try:
        if args.server:
            if state is None or state or commit!=args.expected_commit or digest!=args.expected_controls:
                raise Blocked('Serverens kode/arbeidsmappe/kontrollgrunnlag avviker. Ingen automatisk oppdatering utføres.')
        if config.get('remote') and not args.server and args.mode in ('quick','full'):
            if state is None or state:
                raise Blocked('Commit lokale endringer før serverkjøring; oppdater deretter klonen på Parrot til samme commit.')
            report=run_remote(config,commit,digest,args.mode)
        else:
            report['tool_tests']=run_suite(ROOT/'backend/tests/verification')
            if args.mode=='selftest':
                print(f"Kontrollverktøyenes egne tester: {summary(report['tool_tests'])}")
                for row in report['tool_tests']:
                    if row['status']!='PASS':print(row['output'])
                return exit_status(report['tool_tests'])
            report['product_tests']=run_suite(ROOT/'backend/tests/unit')
            from pipeline import execute
            report.update(execute(config,args.mode,report['product_tests']))
            report['environment']['packages']={dist.metadata['Name']:dist.version for dist in importlib.metadata.distributions() if dist.metadata['Name']}
            cpu=Path('/proc/cpuinfo');mem=Path('/proc/meminfo')
            report['environment']['cpu']=(next((line.split(':',1)[1].strip() for line in cpu.read_text().splitlines() if line.startswith('model name')),platform.machine()) if cpu.exists() else platform.machine())
            report['environment']['memory_total']=(mem.read_text().splitlines()[0] if mem.exists() else None)
            report['environment']['platform']=platform.platform()
            if state is None or state:
                report['blockers'].append('Arbeidsmappen er ikke en ren commit. Resultatene er foreløpige, uten FoM-punkt.')
                report['fom']=None
            if any(row['status']!='PASS' for row in report['tool_tests']):
                report['blockers'].append('Kontrollverktøyenes egne tester bestod ikke komplett.')
                report['fom']=None
    except Blocked as exc:
        report['blockers'].append(str(exc))
    except KeyboardInterrupt:
        report['blockers'].append('Avbrutt av brukeren. Ingen komplett måling.')
        report['fom']=None
    folder=RUNS/now.strftime('%Y%m%dT%H%M%S.%fZ')
    folder.mkdir(parents=True,exist_ok=False)
    (folder/'report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False,default=str)+'\n')
    (folder/'report.md').write_text(report_text(report))
    write_curves(folder,RUNS,report)
    for title,key in (('Kontrollverktøy','tool_tests'),('Enhetstester','product_tests'),('Integrasjon/benchmark','integration_tests')):
        print(f"{title}: {summary(report.get(key,[]))}")
    print('FoM: '+(json.dumps(report['fom']) if report.get('fom') else 'ikke komplett målbart'))
    for reason in report.get('blockers',[]):print('BLOCKED: '+reason)
    if report.get('setup_error'):print('BLOCKED: '+report['setup_error'])
    print(f'Rapport: {folder / "report.md"}')
    if args.server:
        print(MARKER+base64.b64encode(json.dumps(report,default=str).encode()).decode())
    rows=report.get('tool_tests',[])+report.get('product_tests',[])+report.get('integration_tests',[])+list(report.get('models',{}).values())
    result=exit_status(rows)
    if result==1:return 1
    if report.get('blockers') or any(s in ('BLOCKED','SKIPPED') for s in report['controls'].values()):return 2
    return result


if __name__ == '__main__':
    raise SystemExit(main())
