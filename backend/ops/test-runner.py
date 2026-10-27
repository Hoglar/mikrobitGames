"""Drop ambient/inheritable capabilities BEFORE importing the test runner.

Only the supervisor retains read/kill permission for its cross-user services.
Executed as the developer, never as root; child executables inherit no capability.
"""
import ctypes
from pathlib import Path
import runpy
import sys

repo = Path(__file__).resolve().parents[2]
if Path(sys.prefix).resolve() != repo / '.venv':
    raise SystemExit('Testlederen bruker feil Python-miljø. Installer test-launch på nytt med setup-test-host.sh.')

libc = ctypes.CDLL(None, use_errno=True)
if libc.prctl(47, 4, 0, 0, 0) != 0:  # PR_CAP_AMBIENT_CLEAR_ALL
    raise OSError(ctypes.get_errno(), 'Cannot clear ambient capabilities')


class Header(ctypes.Structure):
    _fields_ = [('version', ctypes.c_uint32), ('pid', ctypes.c_int)]


class Data(ctypes.Structure):
    _fields_ = [('effective', ctypes.c_uint32), ('permitted', ctypes.c_uint32), ('inheritable', ctypes.c_uint32)]


header = Header(0x20080522, 0)
capabilities = (Data * 2)()
if libc.capget(ctypes.byref(header), capabilities) != 0:
    raise OSError(ctypes.get_errno(), 'Cannot read capabilities')
required = (1 << 19) | (1 << 5)  # CAP_SYS_PTRACE and CAP_KILL
if capabilities[0].effective & required != required:
    raise SystemExit('Testlederen mangler måle-/oppryddingsrettigheter. Start gjennom installert test-launch.')
for part in capabilities:
    part.inheritable = 0
if libc.capset(ctypes.byref(header), capabilities) != 0:
    raise OSError(ctypes.get_errno(), 'Cannot restrict child capabilities')

entrypoint = (Path(__file__).with_name('check-startup.py') if sys.argv[1:] == ['startup']
              else Path(__file__).resolve().parents[1] / 'check')
sys.argv = [str(entrypoint), *sys.argv[1:]]
runpy.run_path(str(entrypoint), run_name='__main__')
