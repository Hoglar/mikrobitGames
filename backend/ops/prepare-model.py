"""One-time model installation, never called by the verification suite.

Runs the existing local model server as its own user on a temporary loopback
port, pulls only the agreed model, then stops that process. No inference/tests.
"""
import json
import os
from pathlib import Path
import signal
import socket
import subprocess
import time
from urllib.request import Request, urlopen
from urllib.error import URLError

repo = Path(__file__).resolve().parents[2]
if os.geteuid() != 0:
    raise SystemExit('Kjøres fra setup-test-host.sh med --download-model.')
config = json.loads((repo / 'backend/check.local.json').read_text())
with socket.socket() as candidate:
    candidate.bind(('127.0.0.1', 0))
    port = candidate.getsockname()[1]
url = f'http://127.0.0.1:{port}'
env = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'LANG': 'C.UTF-8', 'HOME': '/var/lib/mbg-test-model'}
env.update(OLLAMA_HOST=f'127.0.0.1:{port}', OLLAMA_MODELS=config['model_directory'], OLLAMA_NO_CLOUD='1', OLLAMA_NOPRUNE='1')
process = subprocess.Popen(['/usr/sbin/runuser', '-u', 'mbg-test-model', '--', '/usr/local/bin/ollama', 'serve'], env=env, start_new_session=True,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for _ in range(150):
        if process.poll() is not None:
            raise RuntimeError('Isolert modellserver startet ikke.')
        try:
            with urlopen(url+'/api/version', timeout=1) as response:
                print('Lokal Ollama:', json.load(response)['version'], flush=True)
            break
        except URLError:
            time.sleep(.1)
    else:
        raise RuntimeError('Isolert modellserver startet ikke innen 15 sekunder.')
    data = json.dumps({'model': config['model'], 'stream': True}).encode()
    request = Request(url+'/api/pull', data=data, headers={'Content-Type': 'application/json'})
    print('Klargjør avtalt modell (omtrent 2,5 GB). Ingen modellspørsmål eller tester kjøres.', flush=True)
    previous = None
    with urlopen(request, timeout=1800) as response:
        for line in response:
            status = json.loads(line)
            if 'error' in status:
                raise RuntimeError(status['error'])
            progress = int(100 * status.get('completed', 0) / max(1, status.get('total', 1)))
            marker = (status.get('status'), progress//10)
            if marker != previous:
                print(status.get('status'), f'{progress}%' if status.get('total') else '', flush=True)
                previous = marker
    with urlopen(url+'/api/tags', timeout=10) as response:
        models = json.load(response)['models']
    selected = next(m for m in models if m['name'] == config['model'])
    print('Modell klar:', selected['name'], selected['digest'], flush=True)
finally:
    if process.poll() is None:
        os.killpg(process.pid, signal.SIGTERM)
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        os.killpg(process.pid, signal.SIGKILL)
        process.wait(timeout=5)
