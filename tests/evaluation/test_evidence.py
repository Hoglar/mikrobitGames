"""Readable evidence must preserve failed/partial outcomes and raw measurements."""
import json
from pathlib import Path
import tempfile
import unittest

from evidence import cases_from_log
from reporting import render, save_json
from test_evaluation import sample


class EvidenceReportTests(unittest.TestCase):
    def test_inventory_preserves_pass_fail_skip_without_recounting_the_score(self):
        with tempfile.TemporaryDirectory() as directory:
            log = Path(directory) / 'suite.log'
            log.write_text('ok 1 - send <request>\nnot ok 2 - lost ack\nok 3 - optional # SKIP unavailable\n')
            rows = cases_from_log(log, 'tap')
            self.assertEqual([r['status'] for r in rows], ['PASS', 'FAIL', 'SKIP'])
            log.write_text('test_valid (test_api.Validation.test_valid) ... ok\ntest_bad (test_api.Validation.test_bad) ... FAIL\n')
            self.assertEqual([r['status'] for r in cases_from_log(log, 'python')], ['PASS', 'FAIL'])
            log.write_text('test_query (test_sql.Policy.test_query)\nOnly public views. ... ok\n')
            self.assertEqual(cases_from_log(log, 'python'), [dict(name='test_query', suite='test_sql.Policy.test_query', status='PASS')])
            log.with_suffix('.xml').write_text('<testsuite><testcase name="first" classname="browser"><failure/></testcase><testcase name="later"><skipped/></testcase></testsuite>')
            self.assertEqual([r['status'] for r in cases_from_log(log, 'junit')], ['FAIL', 'SKIP'])

    def test_both_report_formats_show_scope_cases_and_unscored_partial_benchmark(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            data = sample()
            folder = root / 'runs' / data['id']
            folder.mkdir(parents=True)
            data['checks'] = [dict(id='browser-app', category='function', status='FAIL', score=50,
                log='browser-app.log', cases=[dict(name='<start> fails', suite='game', status='FAIL')]),
                dict(id='input-benchmark', category='performance', status='PASS', score=100, log='input-benchmark.log')]
            save_json(folder / 'report.json', data)
            raw = {'method': '<saved method>', 'measurements': [dict(name='snake', count=1000, p50Ms=1, p95Ms=2, p99Ms=3, maxMs=4)]}
            save_json(folder / 'games-benchmark.json', raw)
            original = (folder / 'report.json').read_bytes()
            render(root)
            for suffix in ('html', 'md'):
                text = (folder / f'report.{suffix}').read_text()
                for phrase in ('Hva ble faktisk testet?', 'IKKE KJØRT', 'simulerte API-svar', 'IKKE FULLFØRT', 'p99 ms', '1000', '&lt;start&gt;'):
                    self.assertIn(phrase, text)
                self.assertNotIn('<start>', text)
            self.assertEqual((folder / 'report.json').read_bytes(), original)
            self.assertEqual(json.loads((folder / 'summary.json').read_text())['function'], 50)


if __name__ == '__main__':
    unittest.main()
