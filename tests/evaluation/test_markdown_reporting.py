"""GitHub reports retain results, score explanations and diagnostic evidence."""
from pathlib import Path
import tempfile
import unittest

from test_evaluation import sample
from reporting import load_runs, save_json
from markdown_reporting import render_markdown


class MarkdownReportTests(unittest.TestCase):
    def test_github_report_separates_evidence_and_keeps_measured_sources_unchanged(self):
        with tempfile.TemporaryDirectory() as directory:
            root, data = Path(directory), sample()
            folder = root / 'runs' / data['id']
            folder.mkdir(parents=True)
            data['checks'][0]['id'] = 'web-unit'
            data['checks'][1]['id'] = 'games-benchmark'
            data['checks'].append(dict(id='cross-component', category='function', status='PASS', score=100, log='cross.log'))
            save_json(folder / 'report.json', data)
            save_json(folder / 'feedback-1.json', dict(timestamp='now', score=7, comment='Fix <pause>', reviewer='Team'))
            save_json(folder / 'games-benchmark.json', dict(measurements=[]))
            original = {path.name: path.read_bytes() for path in folder.iterdir()}
            render_markdown(root, load_runs(root))
            document = (folder / 'report.md').read_text(encoding='utf-8')
            for expected in ('## Enhetstester (unit tests)', '## Integrasjon og andre funksjonstester', '## Benchmarks',
                             '## Brukeropplevelse (UX)', '| F – funksjon | 100.00 | 50 % | 50.00 |',
                             '| P – benchmarks / ytelse | 80.00 | 30 % | 24.00 |',
                             '| U – brukeropplevelse | 70.00 | 20 % | 14.00 |',
                             '**Samlet FoM: 88.00 / 100', '[games-benchmark.json](games-benchmark.json)',
                             '![FoM-score gjennom iterasjoner](../../history.svg)', 'Fix <pause>'):
                self.assertIn(expected, document)
            self.assertIn(f'runs/{data["id"]}/report.md', (root / 'history.md').read_text(encoding='utf-8'))
            self.assertIn('![FoM-score gjennom iterasjoner](history.svg)', (root / 'history.md').read_text(encoding='utf-8'))
            for name, content in original.items():
                self.assertEqual((folder / name).read_bytes(), content)

    def test_blocked_and_failed_checks_keep_diagnostics_without_inventing_a_total(self):
        with tempfile.TemporaryDirectory() as directory:
            root, data = Path(directory), sample()
            folder = root / 'runs' / data['id']
            folder.mkdir(parents=True)
            data['checks'][0].update(status='FAIL', score=0)
            data['checks'][1].update(status='BLOCKED', score=None)
            save_json(folder / 'report.json', data)
            (folder / 'unit.log').write_text('AssertionError: mismatch\n```\nremaining checks ran', encoding='utf-8')
            (folder / 'speed.log').write_text('Missing executable', encoding='utf-8')
            render_markdown(root, load_runs(root))
            document = (folder / 'report.md').read_text(encoding='utf-8')
            for expected in ('Samlet FoM: — / 100 · BLOCKED', 'AssertionError: mismatch', 'remaining checks ran',
                             'Missing executable', '````text', '[Logg](unit.log)', '| unit | FAIL |', '| speed | BLOCKED |'):
                self.assertIn(expected, document)


if __name__ == '__main__':
    unittest.main()
