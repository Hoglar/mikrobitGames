"""Isolated test infrastructure. No connection to the production database."""
import contextlib
import hashlib
import http.client
import json
import os
from pathlib import Path
import secrets
import shlex
import shutil
import signal
import socket
import ssl
import subprocess
import sys
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit
from uuid import UUID, uuid4

ROOT = Path(__file__).resolve().parents[2]
ADA = '11111111-1111-4111-8111-111111111111'
NORA = '22222222-2222-4222-8222-222222222222'
POINTS = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
SPRINT = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
PASSWORD = 'SyntheticPassword123!'
MODEL = 'qwen3:4b-instruct-2507-q4_K_M'


def attempt_payload(value, status='completed', attempt_id=None):
    """A new play gets a fresh ID; callers retain this body when retrying."""
    return {'attempt_id': attempt_id or str(uuid4()), 'status': status, 'value': value}


def history_fixtures(history):
    """Public records and their private originating attempts, with stable seed IDs."""
    from datetime import datetime, timezone, timedelta
    records = [(str(UUID(int=i+10000)), player, game, value,
                datetime(2026, 10, 1, 12, tzinfo=timezone.utc)+timedelta(days=day))
               for i, (player, game, value, day) in enumerate(history)]
    attempts = [(player, str(UUID(int=i+20000)), game, 'completed', value, created, 'created', record_id)
                for i, (record_id, player, game, value, created) in enumerate(records)]
    return records, attempts


class Blocked(Exception):
    pass


def port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]


def request(url, method='GET', body=None, headers=None, timeout=65, cafile=None):
    u = urlsplit(url)
    if u.scheme not in ('http', 'https') or u.hostname not in ('127.0.0.1', 'localhost'):
        raise ValueError('Test HTTP targets must be loopback addresses')
    cls = http.client.HTTPSConnection if u.scheme == 'https' else http.client.HTTPConnection
    kwargs = {'timeout': timeout}
    if u.scheme == 'https':
        kwargs['context'] = ssl.create_default_context(cafile=cafile)
    conn = cls(u.hostname, u.port, **kwargs)
    headers = dict(headers or {})
    if body is not None and not isinstance(body, (str, bytes)):
        body = json.dumps(body).encode()
        headers.setdefault('Content-Type', 'application/json')
    try:
        conn.request(method, u.path + ('?' + u.query if u.query else ''), body, headers)
        response = conn.getresponse()
        raw = response.read(8*1024*1024+1)
        if len(raw)>8*1024*1024:raise ValueError('Test response exceeded 8 MiB')
        try:
            data = json.loads(raw) if raw else None
        except (ValueError, UnicodeError):
            data = raw.decode(errors='replace')
        return response.status, dict((k.lower(), v) for k, v in response.getheaders()), data
    finally:
        conn.close()


class Relay:
    """Loopback HTTP relay, or scripted test double. Never handles DB credentials."""
    def __init__(self, target=None, cert=None, key=None):
        self.target, self.script, self.calls = target, None, []
        self.lock = threading.Lock()
        owner = self
        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args): pass
            def handle_request(self):
                raw = self.rfile.read(int(self.headers.get('Content-Length', '0')))
                try: payload = json.loads(raw) if raw else None
                except ValueError: payload = raw.decode(errors='replace')
                with owner.lock:
                    owner.calls.append({'method': self.command, 'path': self.path, 'body': payload})
                    script, index = owner.script, len(owner.calls) - 1
                try:
                    if script is not None:
                        status, headers, data = script(self.path, payload, index)
                    elif owner.target:
                        forwarded = {k: v for k, v in self.headers.items()
                                     if k.lower() not in ('host', 'connection', 'content-length')}
                        status, headers, data = request(owner.target + self.path, self.command,
                                                        raw or None, forwarded)
                    else:
                        status, headers, data = 503, {}, {'error': 'test upstream unavailable'}
                    out = b'' if data is None else (json.dumps(data).encode() if not isinstance(data, str) else data.encode())
                    self.send_response(status)
                    for k, v in headers.items():
                        if k.lower() not in ('connection', 'transfer-encoding', 'content-length', 'server', 'date'):
                            self.send_header(k, v)
                    if 'content-type' not in {k.lower() for k in headers}:
                        self.send_header('Content-Type', 'application/json')
                    self.send_header('Content-Length', str(len(out)))
                    self.end_headers()
                    self.wfile.write(out)
                except (OSError, TimeoutError):
                    self.close_connection = True
            do_GET = do_POST = do_PUT = do_DELETE = handle_request
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        self.server.daemon_threads = True
        scheme = 'http'
        if cert:
            ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            ctx.load_cert_chain(cert, key)
            self.server.socket = ctx.wrap_socket(self.server.socket, server_side=True)
            scheme = 'https'
        self.url = f'{scheme}://127.0.0.1:{self.server.server_port}'
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def reset(self, script=None):
        with self.lock:
            self.calls = []
            self.script = script

    def close(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)


class Environment:
    def __init__(self, config=None, real_model=False):
        self.real_model = real_model
        self.config = config or {}
        self.tmp = None
        self.processes = {}
        self.relays = []
        self.api_ready = self.ai_ready = self.db_ready = False
        self.notes = {}
        self.measurements = {}
        self.model_digest = None

    def command(self, args, *, env=None, timeout=60):
        result = subprocess.run(args, cwd=ROOT, env=env, capture_output=True, timeout=timeout)
        if result.returncode:
            # Do not put connection strings or service output into public reports.
            raise RuntimeError(f'{Path(args[0]).name} avsluttet med kode {result.returncode}')
        return result.stdout

    def start(self):
        try:
            import psycopg
            import argon2
            import jsonschema
            import yaml
            import sqlglot
        except ImportError as exc:
            raise Blocked('Installer backend/verification/requirements.txt i testmiljøet.') from exc
        candidates = [self.config.get('postgres_bin', '')]
        if shutil.which('pg_config'):
            candidates.append(subprocess.check_output(['pg_config', '--bindir'], text=True).strip())
        candidates.extend(str(p.parent) for p in sorted(Path('/usr/lib/postgresql').glob('*/bin/initdb'), reverse=True))
        self.pg = next((Path(p) for p in candidates if p and (Path(p) / 'initdb').is_file()), None)
        if self.pg is None:
            raise Blocked('PostgreSQL-serververktøyene initdb/pg_ctl mangler (psql alene er ikke nok).')
        if not shutil.which('openssl'):
            raise Blocked('openssl mangler for det lokale HTTPS-testsertifikatet.')
        if os.getuid() == 0:
            raise Blocked('Kjør testkommandoen som vanlig Linux-bruker, ikke root.')
        migrations = sorted((ROOT / 'backend/database/migrations').glob('*.sql'))
        if not migrations:
            raise Blocked('Ingen SQL-migreringer i backend/database/migrations ennå.')
        self.tmp = tempfile.TemporaryDirectory(prefix='mbg-tests-')
        self.work = Path(self.tmp.name)
        self.pg_port = port()
        self.admin_password = secrets.token_urlsafe(24)
        self.role_passwords = {name:secrets.token_urlsafe(24) for name in ('backend_app','ai_reader')}
        password_file = self.work / 'password'
        password_file.write_text(self.admin_password)
        password_file.chmod(0o600)
        self.command([str(self.pg / 'initdb'), '-D', str(self.work / 'pg'), '-U', 'test_admin',
                      '--auth=scram-sha-256', '--pwfile', str(password_file)])
        self.pg_start()
        from psycopg.conninfo import make_conninfo
        self.admin_dsn = make_conninfo(host='127.0.0.1', port=self.pg_port, dbname='postgres',
                                      user='test_admin', password=self.admin_password, connect_timeout=3)
        self.database = 'mbg_isolated_test'
        with psycopg.connect(self.admin_dsn, autocommit=True) as conn:
            conn.execute('CREATE DATABASE mbg_isolated_test')
            from psycopg import sql
            for role in ('backend_app', 'ai_reader'):
                conn.execute(sql.SQL('CREATE ROLE {} LOGIN PASSWORD {}').format(sql.Identifier(role), sql.Literal(self.role_passwords[role])))
        self.admin_dsn = make_conninfo(self.admin_dsn, dbname=self.database)
        from fault_proxy import CommitFaultProxy
        self.db_proxy = CommitFaultProxy(self.pg_port)
        self.backend_dsn = make_conninfo(self.admin_dsn, port=self.db_proxy.port, sslmode='disable', user='backend_app', password=self.role_passwords['backend_app'])
        self.ai_dsn = make_conninfo(self.admin_dsn, user='ai_reader', password=self.role_passwords['ai_reader'])
        with psycopg.connect(self.admin_dsn, autocommit=True) as conn:
            for path in migrations:
                conn.execute(path.read_text())
        self.db_ready = True
        self.pg_version = self.scalar('SHOW server_version')
        self.reset_data()
        self.cert, self.key = self.work / 'cert.pem', self.work / 'key.pem'
        self.command(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
                      '-keyout', str(self.key), '-out', str(self.cert), '-subj', '/CN=localhost',
                      '-addext', 'subjectAltName=IP:127.0.0.1,DNS:localhost'])
        self.api_port, self.ai_port = port(), port()
        self.ai_url = f'http://127.0.0.1:{self.ai_port}'
        self.start_model_runtime()
        self.model_relay = Relay(self.ollama_url)
        self.relays.append(self.model_relay)
        self.ai_relay = Relay(self.ai_url)
        self.relays.append(self.ai_relay)
        self.web = Relay(f'http://127.0.0.1:{self.api_port}', str(self.cert), str(self.key))
        self.relays.append(self.web)
        self.origin = self.web.url
        self.restart_services()

    def start_model_runtime(self):
        self.ollama_url = f'http://127.0.0.1:{port()}'
        self.ollama_ready = False
        if not self.real_model:return
        if not shutil.which('ollama'):
            self.notes['ollama']='Ollama er ikke installert.'
            return
        configured=self.config.get('model_directory')
        candidates=[Path(configured).expanduser()] if configured else [Path.home()/'.ollama/models',Path('/usr/share/ollama/.ollama/models')]
        model_dir=next((p for p in candidates if (p/'manifests').is_dir() and (p/'blobs').is_dir()),None)
        if model_dir is None:
            self.notes['ollama']='Nedlastede modellfiler mangler; angi model_directory i lokal konfigurasjon.'
            return
        env={k:v for k,v in os.environ.items() if not k.startswith(('MBG_','OLLAMA_'))}
        env.update(OLLAMA_HOST=self.ollama_url.removeprefix('http://'), OLLAMA_MODELS=str(model_dir),
                   OLLAMA_NO_CLOUD='1',OLLAMA_NOPRUNE='1')
        command=self.config.get('ollama_command',['ollama','serve'])
        with open(self.work/'ollama.log','ab') as log:
            process=subprocess.Popen(command,cwd=ROOT,env=env,stdout=log,stderr=log,start_new_session=True)
        self.processes['ollama']=process
        deadline=time.monotonic()+15
        while time.monotonic()<deadline and process.poll() is None:
            try:
                if request(self.ollama_url+'/api/version',timeout=1)[0]==200:
                    self.ollama_ready=True
                    return
            except OSError:time.sleep(.1)
        self.notes['ollama']='Isolert Ollama startet ikke; sjekk modellmappe og brukerrettigheter.'
        self.stop_service('ollama')

    def pg_start(self):
        self.command([str(self.pg / 'pg_ctl'), '-D', str(self.work / 'pg'), '-l', str(self.work / 'pg.log'),
                      '-o', f'-h 127.0.0.1 -p {self.pg_port} -k {self.work} -c log_statement=all -c '+shlex.quote('log_line_prefix=TESTSQL|%u|'), '-w', 'start'])

    def pg_stop(self):
        self.command([str(self.pg / 'pg_ctl'), '-D', str(self.work / 'pg'), '-m', 'fast', '-w', 'stop'])

    def connect(self, role='admin'):
        import psycopg
        return psycopg.connect({'admin': self.admin_dsn, 'backend': self.backend_dsn, 'ai': self.ai_dsn}[role], autocommit=True)

    def rows(self, sql, params=(), role='admin'):
        with self.connect(role) as conn:
            cur = conn.execute(sql, params)
            return cur.fetchall() if cur.description else []

    def scalar(self, sql, params=(), role='admin'):
        return self.rows(sql, params, role)[0][0]

    def reset_data(self, large=False):
        from argon2 import PasswordHasher
        from datetime import datetime, timezone, timedelta
        self.tokens = {}
        now = datetime.now(timezone.utc)
        self.fixture_clock = now.isoformat()
        password_hash = PasswordHasher().hash(PASSWORD)
        with self.connect() as conn:
            with conn.transaction():
                conn.execute('TRUNCATE app.attempts, app.records, app.sessions, app.players, app.games CASCADE')
                games = [(POINTS, 'Poengjakt', 'points', 'higher_is_better', 0, 100000, True),
                         (SPRINT, 'Sprint', 'milliseconds', 'lower_is_better', 1, 3600000, True)]
                if large:
                    games += [(str(UUID(int=i+300)), f'Spill{i}', 'points', 'higher_is_better', 0, 100000, True) for i in range(8)]
                conn.cursor().executemany('INSERT INTO app.games(id,name,score_unit,ranking_direction,min_value,max_value,is_active) VALUES (%s,%s,%s,%s,%s,%s,%s)', games)
                players = [(ADA, 'Ada'), (NORA, 'Nora')] if not large else [(str(UUID(int=i+1000)), f'Player{i:04d}') for i in range(1000)]
                conn.cursor().executemany('INSERT INTO app.players(id,username,password_hash,created_at) VALUES (%s,%s,%s,%s)',
                                         [(id, name, password_hash, now) for id, name in players])
                sessions = []
                for index, (id, name) in enumerate(players):
                    import base64
                    token = base64.urlsafe_b64encode(hashlib.sha256(f'test-token-{id}'.encode()).digest()).decode().rstrip('=')
                    self.tokens[id] = token
                    sessions.append((str(UUID(int=index+5000)), hashlib.sha256(token.encode()).digest(), id,
                                     now, now, now+timedelta(days=30), now+timedelta(days=3)))
                conn.cursor().executemany('INSERT INTO app.sessions(id,token_hash,player_id,created_at,renewed_at,absolute_expires_at,expires_at) VALUES (%s,%s,%s,%s,%s,%s,%s)', sessions)
                if large:
                    history = [(id, games[i % 10][0], (60010-j if i % 10 == 1 else 100+j), j)
                               for i, (id, _) in enumerate(players) for j in range(10)]
                else:
                    history = [(ADA, POINTS,100,0),(ADA,POINTS,120,1),(NORA,POINTS,110,0),(NORA,POINTS,115,1),
                               (ADA,SPRINT,60000,0),(ADA,SPRINT,55000,1),(NORA,SPRINT,65000,0),(NORA,SPRINT,58000,1)]
                records, attempts = history_fixtures(history)
                conn.cursor().executemany('INSERT INTO app.records(id,player_id,game_id,value,created_at) VALUES (%s,%s,%s,%s,%s)', records)
                conn.cursor().executemany('INSERT INTO app.attempts(player_id,id,game_id,status,value,created_at,record_outcome,record_id) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)', attempts)
        self.games, self.players = games, players
        self.fixture_counts = {'players':len(players), 'games':len(games),
                               'records':len(records), 'attempts':len(attempts)}

    def stop_service(self, name):
        process = self.processes.pop(name, None)
        if process and process.poll() is None:
            with contextlib.suppress(ProcessLookupError):os.killpg(process.pid, signal.SIGTERM)
            try: process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                with contextlib.suppress(ProcessLookupError):os.killpg(process.pid, signal.SIGKILL)
                process.wait(timeout=5)
        setattr(self, name + '_ready', False)

    def start_service(self, name):
        path = ROOT / ('backend/api/src/http_api.py' if name == 'api' else 'backend/ai-service/src/transport.py')
        if not path.exists():
            self.notes[name] = f'{path.relative_to(ROOT)} mangler.'
            return
        env = {k:v for k,v in os.environ.items() if not k.startswith('MBG_')}
        # Do not give the AI process backend/admin credentials.
        env.update(MBG_DATABASE_DSN=self.backend_dsn if name == 'api' else self.ai_dsn,
                   MBG_PUBLIC_ORIGIN=self.origin, MBG_AI_URL=self.ai_relay.url,
                   MBG_OLLAMA_URL=self.model_relay.url, MBG_MODEL=self.config.get('model', MODEL),
                   MBG_TEST_METRICS='1')
        command = self.config.get(name + '_command') or [sys.executable, '-m', 'uvicorn',
                   'http_api:app' if name == 'api' else 'transport:app', '--app-dir', str(path.parent),
                   '--host', '127.0.0.1', '--port', str(self.api_port if name == 'api' else self.ai_port)]
        replacements = {'{python}':sys.executable, '{port}':str(self.api_port if name=='api' else self.ai_port)}
        command = [replacements.get(part, part) for part in command]
        log = open(self.work / f'{name}.log', 'ab')
        try:
            process = subprocess.Popen(command, cwd=ROOT, env=env, stdout=log, stderr=log, start_new_session=True)
        finally: log.close()
        self.processes[name] = process
        deadline = time.monotonic()+15
        while time.monotonic()<deadline and process.poll() is None:
            try:
                with socket.create_connection(('127.0.0.1', self.api_port if name=='api' else self.ai_port), timeout=.2):
                    setattr(self,name+'_ready', True)
                    return
            except OSError: time.sleep(.1)
        self.notes[name] = 'Tjenesten startet ikke. Kontroller entrypoint, miljøvariabler og applikasjonsavhengigheter.'
        self.stop_service(name)

    def restart_services(self):
        for name in ('api','ai'): self.stop_service(name)
        for name in ('ai','api'): self.start_service(name)

    def reset(self):
        self.stop_service('api'); self.stop_service('ai')
        self.reset_data()
        self.ai_relay.reset(); self.model_relay.reset()
        self.restart_services()

    def require(self, *names):
        for name in names:
            if not getattr(self, name+'_ready', False):
                raise Blocked(self.notes.get(name, f'{name} er ikke klart.'))

    def api(self, method, path, body=None, player=None, headers=None, timeout=65, validate_response=True):
        h = {'Origin':self.origin, 'X-MBG-Request':'1'}
        if player: h['Cookie'] = '__Host-mbg_session=' + self.tokens[player]
        h.update(headers or {})
        h={k:v for k,v in h.items() if v is not None}
        response = request(self.origin+'/api/v1'+path, method, body, h, timeout, str(self.cert))
        from protocol_checks import validate
        if validate_response:validate(method,path,response)
        return response

    def ai(self, question='Hvordan har jeg utviklet meg i Poengjakt?', **changes):
        payload = {'request_id':'33333333-3333-4333-8333-333333333333', 'player_id':ADA, 'question':question}
        payload.update(changes)
        return request(self.ai_url+'/v1/answer','POST',payload)

    def close(self):
        for name in ('api','ai','ollama'): self.stop_service(name)
        for relay in self.relays: relay.close()
        if hasattr(self,'db_proxy'): self.db_proxy.close()
        if self.tmp:
            try:
                if (self.work/'pg/postmaster.pid').exists():self.pg_stop()
            except Exception:
                # Keep the private cluster directory if shutdown failed.
                self.tmp._finalizer.detach()
                self.tmp = None
                raise
            self.tmp.cleanup()
            self.tmp = None
