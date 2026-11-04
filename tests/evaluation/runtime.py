"""Own the evaluation process and let browser runners clean up their servers."""
from contextlib import contextmanager
import os
from pathlib import Path
import signal
import subprocess


@contextmanager
def evaluation_lock(path):
    """One evaluation per checkout; the OS releases the lock after a crash."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('a+b') as stream:
        if stream.tell() == 0:
            stream.write(b'0')
            stream.flush()
        stream.seek(0)
        try:
            if os.name == 'nt':
                import msvcrt
                msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            raise ValueError('En evaluering kjører allerede i denne arbeidsmappen. Vent til den er ferdig eller avbryt den i dens terminal.') from None
        try:
            yield
        finally:
            stream.seek(0)
            if os.name == 'nt':
                msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(stream, fcntl.LOCK_UN)


def stop_process(process):
    """SIGINT gives Playwright time to stop its detached web servers first."""
    if os.name == 'nt':
        subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10)
        if process.poll() is None:
            process.kill()
        process.wait()
        return
    for sig, grace in ((signal.SIGINT, 8), (signal.SIGTERM, 2), (signal.SIGKILL, None)):
        try:
            os.killpg(process.pid, sig)
        except ProcessLookupError:
            break
        try:
            process.wait(timeout=grace)
            return
        except subprocess.TimeoutExpired:
            continue
    process.wait()
