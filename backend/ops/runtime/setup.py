"""Explicit root setup of durable backend services; no Funnel publication here."""
import argparse
from datetime import datetime, timezone
import fcntl
import json
import os
from pathlib import Path
import pwd
import re
import secrets
import shutil
import socket
import subprocess
import sys
import time
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[3]
BASE = Path('/opt/mikrobit-games')
DATA = Path('/var/lib/mikrobit-games')
CONFIG = Path('/etc/mikrobit-games')
PG = Path('/usr/lib/postgresql/17/bin')
ENV = {key: value for key, value in os.environ.items()
       if not key.startswith(('MBG_', 'OLLAMA_')) and key not in ('DISPLAY', 'WAYLAND_DISPLAY', 'XAUTHORITY')}


def run(args, **kwargs):
    return subprocess.run([str(a) for a in args], check=True, env=ENV, **kwargs)


def write(path, content, mode=0o600):
    temporary = path.with_name(path.name+'.new')
    with open(temporary, 'w', encoding='utf-8') as f:
        os.chmod(temporary, mode)
        f.write(content)
        f.flush(); os.fsync(f.fileno())
    os.replace(temporary, path)


def directory(path, mode=0o755, owner=None):
    path.mkdir(parents=True, exist_ok=True)
    path.chmod(mode)
    if owner:
        account = pwd.getpwnam(owner)
        os.chown(path, account.pw_uid, account.pw_gid)


def switch(link, target):
    temporary = link.with_name(link.name+'.new')
    if temporary.is_symlink(): temporary.unlink()
    temporary.symlink_to(target)
    os.replace(temporary, link)


def ready(url):
    for _ in range(100):
        try:
            with urlopen(url, timeout=1) as response:
                if response.status == 200: return
        except OSError:
            pass
        time.sleep(.2)
    raise RuntimeError('Tjenesten ble ikke klar: '+url)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--origin', required=True, help='Full HTTPS-origin from Tailscale, without a trailing slash')
    parser.add_argument('--demo-games', action='store_true', help='Add two catalog entries; no test accounts/records')
    args = parser.parse_args()
    if os.geteuid() != 0: parser.error('Kjør med sudo /usr/bin/python3.')
    if not re.fullmatch(r'https://[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.ts\.net', args.origin):
        parser.error('Bruk maskinens eksakte https://navn.tailnet.ts.net-origin.')
    for command in ('/usr/bin/caddy', '/usr/bin/tailscale', '/usr/local/bin/ollama', PG/'initdb'):
        if not Path(command).is_file(): raise RuntimeError('Mangler avhengighet: '+str(command))
    # Verify identity instead of guessing a hostname that will invalidate CSRF.
    status=json.loads(run(['/usr/bin/tailscale','status','--json'], capture_output=True, text=True).stdout)
    host=status.get('Self',{}).get('DNSName','').rstrip('.')
    if status.get('BackendState')!='Running' or args.origin!='https://'+host:
        raise RuntimeError('Tailscale må være innlogget, og --origin må samsvare med maskinens DNSName.')
    for port, service in ((5433,'mbg-db'),(8000,'mbg-api'),(8001,'mbg-ai'),(11435,'mbg-model'),(8080,'mbg-web')):
        if subprocess.run(['systemctl','is-active','--quiet',service],env=ENV).returncode != 0:
            with socket.socket() as probe:
                probe.bind(('127.0.0.1',port))  # Refuse to replace an unrelated listener.
    directory(BASE);directory(BASE/'releases');directory(DATA);directory(CONFIG)
    for role in ('db','api','ai','model','web'):
        name='mbg-'+role
        try: pwd.getpwnam(name)
        except KeyError:
            run(['/usr/sbin/useradd','--system','--user-group','--home-dir',DATA/(role+'-home'),
                 '--shell','/usr/sbin/nologin',name])
    directory(DATA/'postgresql',0o700,'mbg-db')
    directory(DATA/'models',0o700,'mbg-model');directory(DATA/'model-home',0o700,'mbg-model')
    directory(DATA/'web-home',0o700,'mbg-web')
    directory(Path('/var/backups/mikrobit-games'),0o700,'mbg-db')
    credentials=CONFIG/'database-passwords.json'
    if credentials.exists():
        passwords=json.loads(credentials.read_text())
    else:
        if (DATA/'postgresql/PG_VERSION').exists():
            raise RuntimeError('Database finnes, men passordfil mangler. Ikke generer nye legitimasjoner automatisk.')
        passwords={name:secrets.token_hex(32) for name in ('backend_app','ai_reader')}
        write(credentials,json.dumps(passwords)+'\n')
    if set(passwords)!= {'backend_app','ai_reader'} or not all(re.fullmatch('[0-9a-f]{64}',p) for p in passwords.values()):
        raise RuntimeError('Uventet format i lokal passordfil.')
    credentials.chmod(0o600)
    commit=run(['git','-C',ROOT,'rev-parse','HEAD'],capture_output=True,text=True).stdout.strip()
    revision=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')+'-'+commit[:8]
    release=BASE/'releases'/revision;directory(release)
    for relative in ('backend/api/src','backend/ai-service/src','backend/database','backend/ops/runtime'):
        shutil.copytree(ROOT/relative,release/relative,ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
    shutil.copyfile(ROOT/'backend/requirements.txt',release/'backend/requirements.txt')
    run(['/usr/bin/python3','-m','venv',release/'.venv'])
    run([release/'.venv/bin/python','-m','pip','install','--disable-pip-version-check','-r',release/'backend/requirements.txt'])
    run([release/'.venv/bin/python','-m','pip','check'])
    dirty=bool(run(['git','-C',ROOT,'status','--porcelain'],capture_output=True,text=True).stdout)
    write(release/'deployment.json',json.dumps({'source_commit':commit,'source_worktree_dirty':dirty,'release':revision})+'\n',0o644)
    # Services get read-only code. They cannot modify or deploy their own implementation.
    for path in release.rglob('*'):
        if path.is_symlink(): continue
        path.chmod(0o755 if path.is_dir() or os.access(path,os.X_OK) else 0o644)
    source=Path('/var/lib/mikrobit-games-test/models')
    run(['/usr/bin/python3',ROOT/'backend/ops/copy-model.py',source,DATA/'models'])
    model=pwd.getpwnam('mbg-model')
    for path in [DATA/'models',*(DATA/'models').rglob('*')]:
        if path.is_symlink(): raise RuntimeError('Modellageret skal ikke inneholde symlinker.')
        os.chown(path,model.pw_uid,model.pw_gid);path.chmod(0o700 if path.is_dir() else 0o600)
    if not (DATA/'postgresql/PG_VERSION').exists():
        run(['/usr/sbin/runuser','-u','mbg-db','--',PG/'initdb','-D',DATA/'postgresql','-U','mbg-db',
             '--auth-local=peer','--auth-host=scram-sha-256'])
        with (DATA/'postgresql/postgresql.conf').open('a') as f:
            f.write("\nlisten_addresses='127.0.0.1'\nport=5433\nunix_socket_directories='/run/mbg-db'\n"
                    "unix_socket_permissions=0700\npassword_encryption='scram-sha-256'\n"
                    "log_statement='none'\nlog_min_error_statement='panic'\n")
    elif (DATA/'postgresql/PG_VERSION').read_text().strip()!='17':
        raise RuntimeError('Driftsdatabasen må bruke PostgreSQL 17.')
    write(CONFIG/'api.env',f'MBG_DATABASE_DSN="host=127.0.0.1 port=5433 dbname=mikrobit_games user=backend_app password={passwords["backend_app"]}"\nMBG_AI_URL=http://127.0.0.1:8001\nMBG_PUBLIC_ORIGIN={args.origin}\n')
    write(CONFIG/'ai.env',f'MBG_DATABASE_DSN="host=127.0.0.1 port=5433 dbname=mikrobit_games user=ai_reader password={passwords["ai_reader"]}"\nMBG_OLLAMA_URL=http://127.0.0.1:11435\nMBG_MODEL=qwen3:4b-instruct-2507-q4_K_M\n')
    write(CONFIG/'public-origin',args.origin+'\n',0o644)
    write(CONFIG/'Caddyfile',(ROOT/'backend/ops/runtime/Caddyfile').read_text(),0o644)
    web=Path('/var/www/mikrobit-games');directory(web);directory(web/'releases')
    if not (web/'current').exists():
        if (web/'current').is_symlink(): raise RuntimeError('Publiseringslenken er brutt; avklar eksisterende bygg først.')
        welcome=web/'releases'/'welcome';directory(welcome)
        shutil.copyfile(ROOT/'backend/ops/runtime/welcome/index.html',welcome/'index.html')
        (welcome/'index.html').chmod(0o644)
        switch(web/'current',welcome)
    run(['/usr/bin/caddy','validate','--config',CONFIG/'Caddyfile','--adapter','caddyfile'])
    for unit in (ROOT/'backend/ops/runtime/systemd').glob('*.service'):
        write(Path('/etc/systemd/system')/unit.name,unit.read_text(),0o644)
    previous=(BASE/'current').resolve() if (BASE/'current').is_symlink() else None
    if previous: switch(BASE/'previous',previous)
    switch(BASE/'current',release)
    run(['systemctl','daemon-reload'])
    run(['systemctl','enable','--now','mbg-db.service'])
    run(['/usr/sbin/runuser','-u','mbg-db','--',release/'.venv/bin/python',release/'backend/ops/runtime/bootstrap-db.py'],
        input=json.dumps({**passwords,'demo_games':args.demo_games}),text=True)
    for service in ('mbg-model','mbg-ai','mbg-api','mbg-web'):
        run(['systemctl','enable',service]);run(['systemctl','restart',service])
    ready('http://127.0.0.1:8000/api/v1/health');ready('http://127.0.0.1:8080/api/v1/health')
    ready('http://127.0.0.1:11435/api/tags')
    print('Driftstjenestene er klare på loopback. Database og kode er adskilt fra testmiljøet.')
    print('Funnel er ikke aktivert av dette oppsettet. Offentlig origin: '+args.origin)
    print('Publisering etter kontroll: sudo tailscale funnel --bg http://127.0.0.1:8080')


if __name__=='__main__':
    if os.geteuid()!=0: raise SystemExit('Kjør med sudo /usr/bin/python3 backend/ops/runtime/setup.py --origin https://…ts.net')
    os.umask(0o077)
    with open('/run/lock/mbg-runtime-setup.lock','w') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        try: main()
        except (OSError,ValueError,RuntimeError,subprocess.CalledProcessError) as exc:
            print('Driftsoppsettet stoppet: '+str(exc),file=sys.stderr)
            print('Ingen automatisk sletting av database. Tidligere kode finnes under /opt/mikrobit-games/releases.',file=sys.stderr)
            sys.exit(1)
