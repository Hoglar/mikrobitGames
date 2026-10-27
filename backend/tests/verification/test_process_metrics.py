"""Process churn must not become a partial, apparently valid memory sample."""
import errno
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch

from process_metrics import process_metrics


class ProcessMetricsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.pidfile = self.root / 'postmaster.pid'
        self.pidfile.write_text('20\n')
        self.children = self.root / '20/task/20/children'
        self.children.parent.mkdir(parents=True)
        self.children.write_text('30')
        self.api = Mock(pid=10)
        self.api.poll.return_value = None
        for pid, kib in ((10, 100), (20, 200), (30, 300)):
            folder = self.root / str(pid)
            folder.mkdir(exist_ok=True)
            (folder / 'smaps_rollup').write_text(f'Pss:   {kib} kB\n')
            self.write_stat(pid)

    def write_stat(self, pid, start=1000):
        fields = ['S'] + ['0'] * 19
        fields[11], fields[12], fields[19] = '7', '3', str(start)
        (self.root / str(pid) / 'stat').write_text(f'{pid} (name with ) parentheses) ' + ' '.join(fields))

    def measure(self):
        with patch('process_metrics.time.sleep'):
            return process_metrics(self.api, self.pidfile, self.root)

    def test_complete_sum_and_cpu_with_complex_process_name(self):
        result = self.measure()
        self.assertEqual(result['process_pss_bytes'], 600 * 1024)
        self.assertEqual(result['cpu_ticks'], 30)
        self.assertEqual(len(result['process_measurement_attempts']), 1)

    def test_departing_child_retries_whole_snapshot(self):
        original = Path.read_text
        gone = False

        def read(path, *args, **kwargs):
            nonlocal gone
            if path == self.root / '30/smaps_rollup' and not gone:
                gone = True
                self.children.write_text('')
                raise ProcessLookupError(errno.ESRCH, 'Process exited')
            return original(path, *args, **kwargs)

        with patch.object(Path, 'read_text', read):
            result = self.measure()
        self.assertEqual(result['process_pss_bytes'], 300 * 1024)
        attempts = result['process_measurement_attempts']
        self.assertEqual(len(attempts), 2)
        self.assertEqual(attempts[0]['pid'], 30)
        self.assertEqual(attempts[0]['errno'], errno.ESRCH)
        self.assertTrue(attempts[0]['retryable'])
        self.assertEqual(len(attempts[0]['processes']), 2)

    def test_unending_churn_stays_missing_after_three_attempts(self):
        (self.root / '30/stat').unlink()
        result = self.measure()
        self.assertIsNone(result['process_pss_bytes'])
        self.assertIsNone(result['cpu_ticks'])
        self.assertEqual(len(result['process_measurement_attempts']), 3)

    def test_permission_denied_is_not_retried_or_omitted(self):
        original = Path.read_text

        def read(path, *args, **kwargs):
            if path == self.root / '30/smaps_rollup':
                raise PermissionError(errno.EACCES, 'Access denied')
            return original(path, *args, **kwargs)

        with patch.object(Path, 'read_text', read):
            result = self.measure()
        self.assertIsNone(result['process_pss_bytes'])
        self.assertEqual(len(result['process_measurement_attempts']), 1)
        self.assertFalse(result['process_measurement_attempts'][0]['retryable'])

    def test_missing_api_or_master_is_not_treated_as_departing_child(self):
        for pid in (10, 20):
            with self.subTest(pid=pid):
                (self.root / str(pid) / 'stat').unlink()
                result = self.measure()
                self.assertIsNone(result['process_pss_bytes'])
                self.assertEqual(len(result['process_measurement_attempts']), 1)
                self.write_stat(pid)

    def test_bad_pss_or_stat_stays_missing(self):
        for name in ('smaps_rollup', 'stat'):
            with self.subTest(name=name):
                path = self.root / '30' / name
                old = path.read_text()
                path.write_text('malformed')
                result = self.measure()
                self.assertIsNone(result['process_pss_bytes'])
                self.assertEqual(len(result['process_measurement_attempts']), 1)
                path.write_text(old)

    def test_pid_reuse_retries(self):
        original = Path.read_text
        replaced = False

        def read(path, *args, **kwargs):
            nonlocal replaced
            if path == self.root / '30/smaps_rollup' and not replaced:
                replaced = True
                self.write_stat(30, start=2000)
            return original(path, *args, **kwargs)

        with patch.object(Path, 'read_text', read):
            result = self.measure()
        self.assertEqual(result['process_pss_bytes'], 600 * 1024)
        self.assertEqual(len(result['process_measurement_attempts']), 2)
        self.assertEqual(result['process_measurement_attempts'][1]['processes'][-1]['start_ticks'], 2000)

    def test_new_child_requires_new_snapshot(self):
        self.children.write_text('')
        original = Path.read_text
        changed = False

        def read(path, *args, **kwargs):
            nonlocal changed
            if path == self.root / '20/smaps_rollup' and not changed:
                changed = True
                self.children.write_text('30')
            return original(path, *args, **kwargs)

        with patch.object(Path, 'read_text', read):
            result = self.measure()
        self.assertEqual(result['process_pss_bytes'], 600 * 1024)
        self.assertEqual(len(result['process_measurement_attempts']), 2)

    def test_dead_api_and_missing_pidfile_stay_missing(self):
        self.api.poll.return_value = 1
        self.assertIsNone(self.measure()['process_pss_bytes'])
        self.api.poll.return_value = None
        self.pidfile.unlink()
        self.assertIsNone(self.measure()['process_pss_bytes'])
