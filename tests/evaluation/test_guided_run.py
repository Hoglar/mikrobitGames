"""Verify that CLI modes and saved human input preserve the measured evidence."""
import contextlib
import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from test_evaluation import evaluate, sample
from reporting import load_runs, save_json


class GuidedPersistenceTests(unittest.TestCase):
    def prepare(self, root):
        report = sample()
        report['session'] = dict(reviewer='Gruppen', context='Windows med USB')
        folder = root / 'runs' / report['id']
        folder.mkdir(parents=True)
        save_json(folder / 'report.json', report)
        return report, folder

    def completed_review(self):
        return dict(status='complete', reviewer='Gruppen', score=8, comment='Tydelig start. Vis pause bedre.',
                    worked='Tydelig start', improve='Pause', priority='Vis pause bedre',
                    tasks=[dict(id='navigation', title='Finn et spill', status='done', comment='Lett')])

    def test_complete_review_updates_fom_without_modifying_raw_report(self):
        with tempfile.TemporaryDirectory() as directory, contextlib.redirect_stdout(io.StringIO()):
            root = Path(directory)
            report, folder = self.prepare(root)
            original = (folder / 'report.json').read_bytes()
            with patch.object(evaluate, 'prompt_review', return_value=self.completed_review()) as prompt:
                evaluate.guided_feedback(root, report, folder, unchanged=lambda: True)
            prompt.assert_called_once_with('Gruppen')
            self.assertEqual((folder / 'report.json').read_bytes(), original)
            saved = load_runs(root)[0]
            self.assertEqual(saved['summary']['fom'], 90)
            self.assertEqual(saved['reviews'][0]['priority'], 'Vis pause bedre')
            self.assertIn('<svg', (folder / 'report.html').read_text(encoding='utf-8'))

    def test_partial_answers_are_retained_without_creating_a_fom_point(self):
        for status in ('deferred', 'interrupted'):
            with self.subTest(status=status), tempfile.TemporaryDirectory() as directory, contextlib.redirect_stdout(io.StringIO()):
                root = Path(directory)
                report, folder = self.prepare(root)
                original = (folder / 'report.json').read_bytes()
                review = self.completed_review()
                review.update(status=status)
                del review['score']
                with patch.object(evaluate, 'prompt_review', return_value=review):
                    evaluate.guided_feedback(root, report, folder)
                saved = load_runs(root)[0]
                self.assertEqual(saved['reviews'], [])
                self.assertEqual(saved['manual_inputs'][0]['priority'], 'Vis pause bedre')
                self.assertIsNone(saved['summary']['fom'])
                self.assertEqual((folder / 'report.json').read_bytes(), original)

    def test_changed_sources_keep_observations_but_reject_the_proposed_score(self):
        with tempfile.TemporaryDirectory() as directory, contextlib.redirect_stdout(io.StringIO()):
            root = Path(directory)
            report, folder = self.prepare(root)
            with patch.object(evaluate, 'prompt_review', return_value=self.completed_review()):
                review = evaluate.guided_feedback(root, report, folder, unchanged=lambda: False)
            self.assertEqual(review['status'], 'source-changed')
            saved = load_runs(root)[0]
            self.assertEqual(saved['reviews'], [])
            self.assertIsNone(saved['summary']['fom'])
            self.assertEqual(saved['manual_inputs'][0]['proposed_score'], 8)
            self.assertNotIn('score', saved['manual_inputs'][0])


class GuidedCommandTests(unittest.TestCase):
    def test_terminal_default_and_forced_interactive_collect_session(self):
        for terminal, flags in ((True, []), (False, ['--interactive'])):
            with self.subTest(terminal=terminal), patch('sys.stdin.isatty', return_value=terminal), \
                    patch.object(evaluate, 'prompt_session', return_value=dict(label='Baseline', reviewer='Team', context='USB')) as prompt, \
                    patch.object(evaluate, 'run', return_value=0) as runner:
                self.assertEqual(evaluate.main(['run', *flags]), 0)
                prompt.assert_called_once_with(None)
                args = runner.call_args.args[0]
                self.assertEqual(args.label, 'Baseline')
                self.assertEqual(args.session, dict(reviewer='Team', context='USB'))
                self.assertTrue(args.interactive)

    def test_noninteractive_and_redirected_input_never_prompt(self):
        for terminal, flags in ((True, ['--non-interactive']), (False, [])):
            with self.subTest(terminal=terminal), patch('sys.stdin.isatty', return_value=terminal), \
                    patch.object(evaluate, 'prompt_session') as prompt, patch.object(evaluate, 'run', return_value=0) as runner:
                self.assertEqual(evaluate.main(['run', '--label', 'Baseline', *flags]), 0)
                prompt.assert_not_called()
                self.assertFalse(runner.call_args.args[0].interactive)

    def test_unattended_run_requires_a_label_before_starting_tests(self):
        with patch('sys.stdin.isatty', return_value=False), patch.object(evaluate, 'run') as runner, \
                contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit) as error:
            evaluate.main(['run'])
        self.assertEqual(error.exception.code, 2)
        runner.assert_not_called()

    def test_cancelled_session_never_starts_the_automatic_run(self):
        for error in (EOFError, KeyboardInterrupt):
            with self.subTest(error=error), patch.object(evaluate, 'prompt_session', side_effect=error), \
                    patch.object(evaluate, 'run') as runner, contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(evaluate.main(['run', '--interactive']), 130)
                runner.assert_not_called()

    def test_interruption_during_automatic_tests_does_not_ask_for_manual_input(self):
        with tempfile.TemporaryDirectory() as directory, contextlib.redirect_stdout(io.StringIO()):
            with patch.object(evaluate, 'probe', return_value='test'), \
                    patch.object(evaluate, 'controls_digest', return_value='controls'), \
                    patch.object(evaluate, 'digest_paths', return_value='source'), \
                    patch.object(evaluate.Evaluation, 'run', side_effect=KeyboardInterrupt), \
                    patch.object(evaluate, 'prompt_review') as prompt:
                self.assertEqual(self.run_interrupted(directory), 2)
                prompt.assert_not_called()
            saved = load_runs(Path(directory))[0]
            self.assertEqual(saved['checks'][0]['id'], 'interrupted')
            self.assertEqual(saved['summary']['status'], 'BLOCKED')

    @staticmethod
    def run_interrupted(directory):
        from argparse import Namespace
        return evaluate.run(Namespace(output=Path(directory), label='Baseline', node='node', no_browser=True,
                                      backend_full=False, interactive=True, session=dict(reviewer='Team', context='')))


if __name__ == '__main__':
    unittest.main()
