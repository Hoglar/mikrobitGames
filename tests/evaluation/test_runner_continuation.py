"""Failures in one measured stage must not discard later independent evidence."""
from argparse import Namespace
import contextlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from test_evaluation import evaluate
from reporting import load_runs


PASS_COUNTS = dict(tests=2, passed=2, failed=0, skipped=0)
TAP_PASS = '# tests 2\n# pass 2\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n'
METRICS = [dict(name='fixture', value=1, budget=5, unit='ms', score=100)]


class ContinuationTests(unittest.TestCase):
    def exercise(self, root, *, execute_errors=None, test_errors=None, outputs=None, game_error=None):
        """Use real orchestration/reporting with controlled subprocess evidence."""
        execute_errors, test_errors, outputs = execute_errors or {}, test_errors or {}, outputs or {}
        events = []
        original_tests, original_exists = evaluate.Evaluation.tests, Path.exists

        def execute(command, cwd, log, env=None, timeout=300):
            name = log.stem
            events.append(name)
            text = json.dumps(PASS_COUNTS) if name in ('evaluation-selftest', 'backend-unit', 'backend-full') else TAP_PASS
            returncode, text = outputs.get(name, (0, text))
            log.write_text(text, encoding='utf-8')
            if name in execute_errors:
                raise execute_errors[name]
            if name == 'firmware':
                log.with_suffix('.xml').write_text('<testsuite><testcase/><testcase/></testsuite>', encoding='utf-8')
            if name in ('browser-app', 'browser-input'):
                log.with_suffix('.xml').write_text('<testsuite><testcase/><testcase/></testsuite>', encoding='utf-8')
            if name in ('input-benchmark', 'games-benchmark'):
                (log.parent / (name + '.json')).write_text('{}', encoding='utf-8')
            if name == 'browser-input':
                (log.parent / 'browser-benchmark.json').write_text('{"browser":"fixture Chromium"}', encoding='utf-8')
            return dict(returncode=returncode, execution='DONE', seconds=0, command=list(command), log=log.name)

        def tests(instance, name, *args, **kwargs):
            if name in test_errors:
                events.append(name)
                raise test_errors[name]
            return original_tests(instance, name, *args, **kwargs)

        def backend(instance, environment):
            return instance.tests('backend-full', ['fixture-backend'], 'python')

        def review(reviewer):
            events.append('human-input')
            return dict(status='deferred', reviewer=reviewer, tasks=[], worked='Observasjoner beholdes')

        def exists(path):
            return str(path).replace('\\', '/').endswith('/@playwright/test/cli.js') or original_exists(path)

        args = Namespace(output=root, label='Continuation', node='node', no_browser=False,
                         backend_full=True, interactive=True, session=dict(reviewer='Gruppen', context='Fixture'))
        with contextlib.ExitStack() as stack:
            stack.enter_context(contextlib.redirect_stdout(io.StringIO()))
            stack.enter_context(patch.object(evaluate, 'probe', return_value='fixture'))
            stack.enter_context(patch.object(evaluate, 'controls_digest', return_value='controls'))
            stack.enter_context(patch.object(evaluate, 'digest_paths', return_value='source'))
            stack.enter_context(patch.object(evaluate, 'execute', side_effect=execute))
            stack.enter_context(patch.object(evaluate.Evaluation, 'tests', new=tests))
            stack.enter_context(patch.object(Path, 'exists', new=exists))
            stack.enter_context(patch.object(evaluate, 'input_metrics', return_value=METRICS))
            stack.enter_context(patch.object(evaluate, 'game_metrics', side_effect=game_error, return_value=METRICS))
            stack.enter_context(patch.object(evaluate, 'backend_full', side_effect=backend))
            stack.enter_context(patch.object(evaluate, 'prompt_review', side_effect=review))
            code = evaluate.run(args)
        report = load_runs(root)[0]
        folder = root / 'runs' / report['id']
        for path in (root / 'index.html', root / 'history.svg', folder / 'report.json', folder / 'report.html',
                     folder / 'summary.json', folder / 'next-iteration.md'):
            self.assertTrue(path.is_file(), path)
        return code, events, report, folder

    def assert_later_measurements(self, events):
        for name in ('backend-unit', 'firmware', 'cross-component', 'platform-benchmark', 'input-benchmark',
                     'games-benchmark', 'browser-app', 'browser-input', 'backend-full', 'human-input'):
            self.assertIn(name, events)

    def test_early_unit_runner_exception_is_reported_and_all_later_stages_run(self):
        with tempfile.TemporaryDirectory() as directory:
            code, events, report, folder = self.exercise(Path(directory), test_errors={'web-unit': RuntimeError('unit parser broke')})
            self.assertEqual(code, 2)
            self.assert_later_measurements(events)
            row = next(row for row in report['checks'] if row['id'] == 'web-unit')
            self.assertEqual(row['status'], 'BLOCKED')
            self.assertIsNone(row['score'])
            self.assertIn('unit parser broke', row['detail'])
            self.assertIn('Traceback', (folder / row['log']).read_text(encoding='utf-8'))
            self.assertIn('unit parser broke', (folder / 'report.html').read_text(encoding='utf-8'))
            self.assertEqual(report['manual_inputs'][0]['worked'], 'Observasjoner beholdes')

    def test_malformed_selftest_counts_keep_original_diagnostics_and_do_not_stop_measurements(self):
        with tempfile.TemporaryDirectory() as directory:
            code, events, report, folder = self.exercise(Path(directory), outputs={'evaluation-selftest': (0, '{invalid json\n')})
            self.assertEqual(code, 2)
            self.assert_later_measurements(events)
            self.assertEqual(report['selftest'], 'BLOCKED')
            self.assertIn('JSONDecodeError', report['selftest_detail'])
            diagnostic = (folder / report['selftest_log']).read_text(encoding='utf-8')
            self.assertIn('{invalid json', diagnostic)
            self.assertIn('Traceback', diagnostic)
            self.assertIsNone(report['summary']['fom'])

    def test_measured_benchmark_assertion_is_fail_and_later_stages_continue(self):
        with tempfile.TemporaryDirectory() as directory:
            code, events, report, folder = self.exercise(Path(directory), outputs={'input-benchmark': (1, 'AssertionError: lost frame\n')})
            self.assertEqual(code, 1)
            self.assert_later_measurements(events)
            row = next(row for row in report['checks'] if row['id'] == 'input-benchmark')
            self.assertEqual((row['status'], row['score']), ('FAIL', 0))
            self.assertIn('lost frame', (folder / row['log']).read_text(encoding='utf-8'))

    def test_unexpected_benchmark_extractor_error_keeps_both_command_log_and_traceback(self):
        with tempfile.TemporaryDirectory() as directory:
            code, events, report, folder = self.exercise(Path(directory), game_error=RuntimeError('unexpected extractor error'))
            self.assertEqual(code, 2)
            self.assert_later_measurements(events)
            row = next(row for row in report['checks'] if row['id'] == 'games-benchmark')
            self.assertEqual(row['status'], 'BLOCKED')
            diagnostic = (folder / row['log']).read_text(encoding='utf-8')
            self.assertIn('# pass 2', diagnostic)
            self.assertIn('RuntimeError: unexpected extractor error', diagnostic)

    def test_broken_browser_app_does_not_skip_browser_input_backend_or_manual_review(self):
        with tempfile.TemporaryDirectory() as directory:
            code, events, report, folder = self.exercise(Path(directory), test_errors={'browser-app': ValueError('malformed JUnit')})
            self.assertEqual(code, 2)
            for name in ('browser-input', 'backend-full', 'human-input'):
                self.assertGreater(events.index(name), events.index('browser-app'))
            self.assertEqual(next(row['status'] for row in report['checks'] if row['id'] == 'browser-app'), 'BLOCKED')

    def test_failed_tool_selftest_is_visible_and_does_not_stop_product_tests(self):
        counts = dict(tests=2, passed=1, failed=1, skipped=0)
        with tempfile.TemporaryDirectory() as directory:
            code, events, report, folder = self.exercise(Path(directory), outputs={'evaluation-selftest': (1, json.dumps(counts))})
            self.assertEqual(code, 1)
            self.assert_later_measurements(events)
            self.assertEqual(report['selftest'], 'FAIL')
            self.assertEqual(report['selftest_counts']['failed'], 1)
            self.assertIsNone(report['summary']['fom'])

    def test_explicit_interrupt_stops_execution_but_keeps_existing_evidence(self):
        with tempfile.TemporaryDirectory() as directory:
            code, events, report, folder = self.exercise(Path(directory), execute_errors={'input-unit': KeyboardInterrupt()})
            self.assertEqual(code, 2)
            self.assertIn('web-unit', events)
            self.assertNotIn('backend-unit', events)
            self.assertNotIn('human-input', events)
            self.assertEqual(next(row['status'] for row in report['checks'] if row['id'] == 'web-unit'), 'PASS')
            self.assertEqual(next(row['status'] for row in report['checks'] if row['id'] == 'interrupted'), 'BLOCKED')


if __name__ == '__main__':
    unittest.main()
