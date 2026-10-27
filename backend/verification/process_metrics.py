"""Bounded /proc snapshots of the API and PostgreSQL process family.

Retry a whole snapshot on process churn, never omit an unreadable process or
substitute an earlier measurement. Keep failed attempts in the raw report.
"""
import errno
from pathlib import Path
import re
import time


class ProcessChanged(Exception):
    pass


def process_metrics(api, pidfile, proc=Path('/proc')):
    attempts = []
    for number in range(3):
        attempt = {'started_at': time.monotonic(), 'processes': []}
        pid = None
        required = set()
        retry = False
        try:
            if api is None or api.poll() is not None:
                raise ValueError('API is not running')
            master = int(pidfile.read_text().splitlines()[0])
            required = {api.pid, master}
            if min(required) <= 0:
                raise ValueError('Invalid process ID')

            def members():
                return required | set(map(int, (proc / str(master) / 'task' /
                                                str(master) / 'children').read_text().split()))

            def stat(process):
                # Fields after comm (which may contain spaces and parentheses).
                fields = (proc / str(process) / 'stat').read_text().rsplit(')', 1)[1].split()
                return int(fields[19]), int(fields[11]) + int(fields[12])

            pids = members()
            attempt['pids'] = sorted(pids)
            for pid in sorted(pids):
                identity, _ = stat(pid)
                text = (proc / str(pid) / 'smaps_rollup').read_text()
                match = re.search(r'^Pss:\s+(\d+)\s+kB$', text, re.M)
                if match is None:
                    raise ValueError('Missing Pss field')
                after, ticks = stat(pid)
                if identity != after:
                    raise ProcessChanged('Process ID reused')
                attempt['processes'].append({'pid': pid, 'start_ticks': identity,
                                             'pss_bytes': int(match.group(1)) * 1024,
                                             'cpu_ticks': ticks})
            pid = master
            if members() != pids:
                raise ProcessChanged('PostgreSQL process membership changed')
            # Also detect replacement after an individual process was sampled.
            for measurement in attempt['processes']:
                pid = measurement['pid']
                if stat(pid)[0] != measurement['start_ticks']:
                    raise ProcessChanged('Process ID reused')
            if api.poll() is not None:
                raise ValueError('API stopped during measurement')
        except (OSError, ValueError, IndexError, ProcessChanged) as exc:
            retry = isinstance(exc, ProcessChanged) or (
                isinstance(exc, OSError) and exc.errno in (errno.ENOENT, errno.ESRCH)
                and pid is not None and pid not in required)
            attempt.update(error=type(exc).__name__, pid=pid,
                           errno=getattr(exc, 'errno', None), retryable=retry)
        attempt['finished_at'] = time.monotonic()
        attempts.append(attempt)
        if 'error' not in attempt:
            return {'at': attempt['finished_at'],
                    'process_pss_bytes': sum(p['pss_bytes'] for p in attempt['processes']),
                    'cpu_ticks': sum(p['cpu_ticks'] for p in attempt['processes']),
                    'process_measurement_attempts': attempts}
        if not retry or number == 2:
            break
        time.sleep(.01)
    return {'at': time.monotonic(), 'process_pss_bytes': None, 'cpu_ticks': None,
            'process_measurement_attempts': attempts}
