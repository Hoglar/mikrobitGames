"""Regression tests for evidence handling, score calculations and saved feedback."""
import copy
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent))
from scoring import POLICY, latency_score, summarize, validate_feedback
from reporting import chart, load_runs, render, save_json

spec = importlib.util.spec_from_file_location('evaluate', Path(__file__).resolve().parents[1] / 'evaluate.py')
evaluate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(evaluate)


def sample():
    return dict(id='20261030T120000.000000Z', timestamp='2026-10-30T12:00:00Z', label='Baseline',
                profile='local-core', series='example', commit='abc', dirty=True, source_digest='source',
                policy=copy.deepcopy(POLICY), selftest='PASS', limitations=['Ingen fysisk USB'], metrics=[],
                checks=[dict(id='unit', category='function', status='PASS', score=100, log='unit.log'),
                        dict(id='speed', category='performance', status='PASS', score=80, log='speed.log')])


class ScoringTests(unittest.TestCase):
    def test_fixed_weight_formula_and_ux_scale(self):
        self.assertEqual(summarize(sample(), {'score': 7})['fom'], 88)
        self.assertEqual(summarize(sample())['technical'], 92.5)

    def test_missing_ux_is_not_invented(self):
        result = summarize(sample())
        self.assertIsNone(result['fom'])
        self.assertEqual(result['status'], 'AWAITING_UX')

    def test_failures_lower_score_and_remain_plottable(self):
        report = sample()
        report['checks'][0].update(status='FAIL', score=0)
        self.assertEqual(summarize(report, {'score': 7})['fom'], 38)

    def test_blocked_or_broken_selftest_produces_no_point(self):
        for kind in ('check', 'selftest'):
            report = sample()
            if kind == 'check':
                report['checks'][0].update(status='BLOCKED', score=None)
            else:
                report['selftest'] = 'BLOCKED'
            self.assertIsNone(summarize(report, {'score': 7})['fom'])
            self.assertIsNone(summarize(report)['technical'])

    def test_no_checks_is_not_success(self):
        report = sample()
        report['checks'] = []
        self.assertEqual(summarize(report)['status'], 'BLOCKED')

    def test_latency_budget_and_regression_are_bounded(self):
        self.assertEqual([latency_score(n, 5) for n in (0, 2, 5, 10, 20)], [100, 100, 100, 50, 25])
        for value in (-1, float('nan'), float('inf'), '5', True):
            with self.assertRaises(ValueError):
                latency_score(value, 5)

    def test_feedback_requires_finite_score_and_comment(self):
        for score in (-1, 11, float('nan'), float('inf'), True):
            with self.assertRaises(ValueError):
                validate_feedback(score, 'comment', 'team')
        for comment, reviewer in [('', 'team'), ('   ', 'team'), ('comment', '')]:
            with self.assertRaises(ValueError):
                validate_feedback(7, comment, reviewer)
        validate_feedback(0, 'Broken flow', 'Team')


class EvidenceTests(unittest.TestCase):
    def test_skips_and_empty_discovery_never_pass(self):
        result = {'execution': 'DONE', 'returncode': 0}
        for counts in [dict(tests=0, passed=0, failed=0, skipped=0), dict(tests=2, passed=1, failed=0, skipped=1)]:
            self.assertEqual(evaluate.check_result(result, counts), ('BLOCKED', None))

    def test_failed_assertions_and_runner_failure_are_distinct(self):
        result = {'execution': 'DONE', 'returncode': 1}
        self.assertEqual(evaluate.check_result(result, dict(tests=4, passed=3, failed=1, skipped=0)), ('FAIL', 75))
        self.assertEqual(evaluate.check_result(result, dict(tests=4, passed=4, failed=0, skipped=0)), ('BLOCKED', None))

    def test_tap_uses_final_counts_not_nested_ok_lines(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'node.log'
            path.write_text('    ok 1 - child\nok 1 - parent\n# tests 3\n# pass 2\n# fail 1\n# cancelled 0\n# skipped 0\n# todo 0\n')
            self.assertEqual(evaluate.test_counts(path, 'tap'), dict(tests=3, passed=2, failed=1, skipped=0))

    def test_junit_detects_error_failure_skip_and_empty_suite(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'suite.log'
            path.with_suffix('.xml').write_text('<testsuites><testsuite><testcase/><testcase><failure/></testcase><testcase><error/></testcase><testcase><skipped/></testcase></testsuite></testsuites>')
            self.assertEqual(evaluate.test_counts(path, 'junit'), dict(tests=4, passed=1, failed=2, skipped=1))

    def test_missing_executable_and_timeout_preserve_diagnostics(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'run.log'
            result = evaluate.execute(['/no/such/executable'], Path(directory), path)
            self.assertEqual(result['execution'], 'BLOCKED')
            result = evaluate.execute([sys.executable, '-c', 'import time; time.sleep(10)'], Path(directory), path, timeout=.05)
            self.assertEqual(result['execution'], 'BLOCKED')
            self.assertIn('Timeout', path.read_text())

    def test_incomplete_benchmark_profiles_rejected(self):
        with self.assertRaises(ValueError):
            evaluate.input_metrics({'measurements': []})
        with self.assertRaises(ValueError):
            evaluate.game_metrics({'measurements': []})


class PersistenceTests(unittest.TestCase):
    def test_feedback_is_append_only_and_raw_evidence_unchanged(self):
        with tempfile.TemporaryDirectory() as directory:
            root, report = Path(directory), sample()
            folder = root / 'runs' / report['id']
            folder.mkdir(parents=True)
            save_json(folder / 'report.json', report)
            original = (folder / 'report.json').read_bytes()
            evaluate.feedback(root, 'latest', 7, '<script>alert(1)</script> Improve controls', 'Team')
            evaluate.feedback(root, report['id'], 8, 'Corrected group score', 'Team')
            self.assertEqual((folder / 'report.json').read_bytes(), original)
            loaded = load_runs(root)[0]
            self.assertEqual(len(loaded['reviews']), 2)
            self.assertEqual(loaded['summary']['fom'], 90)
            self.assertIn('&lt;script&gt;', (folder / 'report.html').read_text())
            self.assertNotIn('<script>alert(1)</script>', (folder / 'report.html').read_text())
            self.assertIn('Corrected group score', (folder / 'next-iteration.md').read_text())

    def test_invalid_or_unknown_feedback_does_not_write(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with self.assertRaises(ValueError):
                evaluate.feedback(root, '../../outside', 7, 'comment', 'Team')
            self.assertEqual(list(root.rglob('*')), [])

    def test_graph_separates_series_and_leaves_gaps(self):
        rows = []
        for i in range(3):
            row = sample()
            row.update(id=f'run-{i}', summary=summarize(row, {'score': 7}))
            rows.append(row)
        self.assertIn('stroke-dasharray', chart(rows))
        rows[1]['summary']['technical'] = rows[1]['summary']['fom'] = None
        self.assertNotIn('stroke-dasharray', chart(rows))
        rows[1]['summary'] = summarize(sample(), {'score': 7})
        for i, row in enumerate(rows):
            row['series'] = str(i)
        self.assertNotIn('stroke-dasharray', chart(rows))

    def test_empty_history_renders(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.assertEqual(render(root), [])
            self.assertIn('<svg', (root / 'history.svg').read_text())


if __name__ == '__main__':
    unittest.main()
