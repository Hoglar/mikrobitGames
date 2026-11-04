"""Interruptions must allow runner cleanup and concurrent runs must be rejected."""
from pathlib import Path
import os
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import Mock, patch

from runtime import evaluation_lock, stop_process


class RuntimeTests(unittest.TestCase):
    def test_lock_rejects_another_process_and_releases_after_exit(self):
        with tempfile.TemporaryDirectory() as directory:
            lock = Path(directory) / 'evaluation.lock'
            code = 'from runtime import evaluation_lock; import sys\nwith evaluation_lock(sys.argv[1]): print("acquired")'
            env = {**os.environ, 'PYTHONPATH': str(Path(__file__).parent)}
            with evaluation_lock(lock):
                result = subprocess.run([sys.executable, '-c', code, str(lock)], capture_output=True, text=True, env=env)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('En evaluering kjører allerede', result.stderr)
            result = subprocess.run([sys.executable, '-c', code, str(lock)], capture_output=True, text=True, env=env)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn('acquired', result.stdout)

    def test_interrupt_allows_cleanup_of_a_detached_server(self):
        if os.name == 'nt':
            process = Mock(pid=123)
            process.poll.return_value = None
            with patch('runtime.subprocess.run') as taskkill:
                stop_process(process)
            self.assertEqual(taskkill.call_args.args[0], ['taskkill', '/PID', '123', '/T', '/F'])
            process.kill.assert_called_once()
            process.wait.assert_called_once()
            return
        with tempfile.TemporaryDirectory() as directory:
            ready, cleaned = Path(directory) / 'ready', Path(directory) / 'cleaned'
            code = '''import subprocess, signal, sys, time
from pathlib import Path
child = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(60)'], start_new_session=True)
def stop(*args):
    child.terminate()
    child.wait(timeout=3)
    Path(sys.argv[2]).write_text('cleaned')
    raise SystemExit(0)
signal.signal(signal.SIGINT, stop)
Path(sys.argv[1]).write_text('ready')
time.sleep(60)
'''
            process = subprocess.Popen([sys.executable, '-c', code, str(ready), str(cleaned)], start_new_session=True)
            try:
                deadline = time.monotonic() + 5
                while not ready.exists() and time.monotonic() < deadline:
                    time.sleep(.01)
                self.assertTrue(ready.exists())
                stop_process(process)
                self.assertEqual(process.returncode, 0)
                self.assertEqual(cleaned.read_text(), 'cleaned')
            finally:
                if process.poll() is None:
                    stop_process(process)


if __name__ == '__main__':
    unittest.main()
