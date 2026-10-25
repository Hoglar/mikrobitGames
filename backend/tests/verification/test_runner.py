"""The command must report incomplete coverage without manufacturing success."""
import contextlib
import io
from pathlib import Path
import tempfile
import unittest
from run_checks import exit_status, show_latest


class RunnerTests(unittest.TestCase):
    def test_exit_codes(self):
        self.assertEqual(exit_status([{'status': 'PASS'}]), 0)
        self.assertEqual(exit_status([{'status': 'FAIL'}]), 1)
        self.assertEqual(exit_status([{'status': 'BLOCKED'}]), 2)
        self.assertEqual(exit_status([{'status': 'SKIPPED'}]), 2)

    def test_known_failure_is_not_hidden_by_incomplete_run(self):
        self.assertEqual(exit_status([{'status': 'BLOCKED', 'observed_failures': 1}]), 1)

    def test_report_without_runs_does_not_create_files(self):
        with tempfile.TemporaryDirectory() as directory:
            runs = Path(directory) / 'runs'
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(show_latest(runs), 2)
            self.assertFalse(runs.exists())

    def test_report_reads_latest_without_modifying_it(self):
        with tempfile.TemporaryDirectory() as directory:
            runs = Path(directory)
            for name in ('20260101', '20260102'):
                (runs / name).mkdir()
                (runs / name / 'report.md').write_text(name)
            before = {str(p): p.stat().st_mtime_ns for p in runs.rglob('*')}
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                self.assertEqual(show_latest(runs), 0)
            self.assertIn('20260102', output.getvalue())
            self.assertEqual(before, {str(p): p.stat().st_mtime_ns for p in runs.rglob('*')})
