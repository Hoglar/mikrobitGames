"""Explicit SSH execution; never pulls, deploys, or fixes code."""
import base64
import json
from pathlib import Path
import shlex
import shutil
import subprocess
from harness import ROOT, Blocked

CONFIG=ROOT/'backend/check.local.json'
MARKER='MBG_REPORT_BASE64:'


def ssh_program():
    windows=Path('/mnt/c/Windows/System32/OpenSSH/ssh.exe')
    # Use Windows' key/alias configuration when it exists in this WSL workspace.
    if windows.exists() and Path('/mnt/c/Users/marti/.ssh/config').exists():return str(windows)
    return shutil.which('ssh') or 'ssh'


def configure(host,repo):
    if not host or not repo.startswith('/') or any(c in host for c in '\n\r\0') or host.startswith('-'):
        raise ValueError('Oppgi SSH-vertsnavn og absolutt prosjektsti.')
    config=json.loads(CONFIG.read_text()) if CONFIG.exists() else {}
    config['remote']={'host':host,'repo':repo,'ssh':ssh_program(),'python':'.venv/bin/python'}
    CONFIG.write_text(json.dumps(config,indent=2)+'\n')
    print('Lagret lokal tilkobling i backend/check.local.json (ikke i git).')


def run_remote(config,commit,digest,mode):
    remote=config['remote']
    command='cd '+shlex.quote(remote['repo'])+' && '+shlex.join([
        remote.get('python','.venv/bin/python'),'backend/check',mode,'--server',
        '--expected-commit',commit,'--expected-controls',digest])
    process=subprocess.Popen([remote.get('ssh',ssh_program()),'-o','BatchMode=yes','-o','ForwardX11=no',
                              '-o','ConnectTimeout=10',remote['host'],command],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
    report=None
    try:
        for line in process.stdout:
            if line.startswith(MARKER):
                report=json.loads(base64.b64decode(line[len(MARKER):].strip()))
            else:print(line.rstrip(),flush=True)
        code=process.wait()
    except BaseException:
        process.terminate()
        raise
    if report is None:raise Blocked(f'SSH/teststart feilet (kode {code}). Sjekk kloning, venv og SSH-tilgang.')
    if report.get('code_commit')!=commit or report.get('control_digest')!=digest:
        raise Blocked('Serverrapporten samsvarer ikke med bestilt kode/kontrollversjon.')
    return report
