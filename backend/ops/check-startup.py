"""Short host startup probe; no product test suite, inference or FoM report.

Run through: /usr/local/libexec/mbg-test-launch check startup
Uses the same isolated environment and service commands as backend/check.
"""
import json
import os
from pathlib import Path
import pwd
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'backend/verification'))
from harness import Environment, request
from process_metrics import process_metrics


def main():
    config = json.loads((ROOT / 'backend/check.local.json').read_text())
    environment = Environment(config, real_model=True)
    pids = []
    work = None
    try:
        environment.start()
        work = environment.work
        environment.require('db', 'api', 'ai', 'ollama')
        pg_pid = int((work / 'pg/postmaster.pid').read_text().splitlines()[0])
        pids.append(pg_pid)
        for name, account in [('api', 'mbg-test-api'), ('ai', 'mbg-test-ai'), ('ollama', 'mbg-test-model')]:
            process = environment.processes[name]
            pids.append(process.pid)
            status = Path(f'/proc/{process.pid}/status').read_text()
            fields = dict(line.split(':', 1) for line in status.splitlines() if ':' in line)
            if int(fields['Uid'].split()[0]) != pwd.getpwnam(account).pw_uid:
                raise RuntimeError(f'{name}: feil prosessbruker')
            if any(int(fields[key].strip(), 16) for key in ('CapEff', 'CapPrm', 'CapInh', 'CapAmb')):
                raise RuntimeError(f'{name}: uventede prosessrettigheter')
            print(f'{name}: startet som {account}, uten ekstra prosessrettigheter.', flush=True)
        measured = process_metrics(environment.processes['api'], work / 'pg/postmaster.pid')
        if measured['process_pss_bytes'] is None:
            raise RuntimeError(f'PSS-måling er utilgjengelig: {measured}')
        print('Testleder: kan måle samlet PSS for API og hele PostgreSQL-prosessfamilien.', flush=True)
        api = f'http://127.0.0.1:{environment.api_port}'
        for url in (api+'/api/v1/health', api+'/openapi.json', environment.ai_url+'/openapi.json', environment.ollama_url+'/api/tags'):
            if request(url, timeout=5)[0] != 200:
                raise RuntimeError('En oppstarts-/metadatarute svarte ikke 200')
        print('Helsesjekk, begge OpenAPI-uttrekk og lokal modelloversikt er tilgjengelige.', flush=True)
    finally:
        environment.close()
    if any(Path(f'/proc/{pid}').exists() for pid in pids):
        raise RuntimeError('En oppstartsprosess ble ikke stoppet')
    if work is not None and work.exists():
        raise RuntimeError('Den midlertidige databasen ble ikke ryddet')
    print('Oppstart og opprydding OK. Alle prosesser stoppet og midlertidige data fjernet.', flush=True)
    print('Ingen produktkontroller, modellspørsmål, benchmarks eller FoM-kjøring er utført.', flush=True)


if __name__ == '__main__':
    main()
