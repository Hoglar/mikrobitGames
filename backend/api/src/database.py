"""The API's only PostgreSQL adapter; bounded pool and explicit transactions."""
from contextvars import ContextVar
from datetime import datetime, timezone
import hashlib
import logging
import os
import threading
import time
from uuid import uuid4

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool, PoolTimeout, TooManyRequests
from errors import ServiceError

metrics = ContextVar('db_metrics', default=None)
_pool = None
_pool_lock = threading.Lock()
# Pool diagnostics may contain DSNs. Application logs use safe error classes only.
logging.getLogger('psycopg.pool').disabled = True


def start():
    global _pool
    with _pool_lock:
        if _pool is None:
            _pool = ConnectionPool(
                os.environ['MBG_DATABASE_DSN'], min_size=0, max_size=5, max_waiting=60,
                timeout=1, open=True, kwargs={'autocommit': True, 'row_factory': dict_row,
                    'connect_timeout': 3, 'options': '-c search_path=pg_catalog,app -c statement_timeout=1000 -c lock_timeout=500 -c idle_in_transaction_session_timeout=5000'},
                check=ConnectionPool.check_connection)


def close():
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


class Operation:
    def __init__(self, conn, deadline):
        self.conn, self.deadline = conn, deadline

    def execute(self, sql, params=()):
        remaining = self.deadline - time.monotonic()
        if remaining <= 0:
            raise ServiceError('SERVICE_UNAVAILABLE', 503)
        self.conn.execute("SELECT set_config('statement_timeout', %s, true)", (str(max(1, min(1000, int(remaining*1000)))),))
        return self.conn.execute(sql, params)


def run(operation, write=False):
    """One bounded operation; retry only a confirmed deadlock rollback, once."""
    start_time = time.monotonic()
    deadline = start_time + 3
    try:
        start()
        for attempt in range(2):
            committing = False
            try:
                with _pool.connection(timeout=min(1, max(.001, deadline-time.monotonic()))) as conn:
                    try:
                        conn.execute('BEGIN ISOLATION LEVEL READ COMMITTED')
                        result = operation(Operation(conn, deadline))
                        if time.monotonic() >= deadline:
                            raise ServiceError('SERVICE_UNAVAILABLE', 503)
                        committing = write
                        conn.execute('COMMIT')
                        return result
                    except BaseException:
                        if not conn.closed:
                            try:
                                conn.execute('ROLLBACK')
                            except psycopg.Error:
                                conn.close()
                        raise
            except psycopg.errors.DeadlockDetected:
                if attempt or time.monotonic() >= deadline:
                    raise ServiceError('SERVICE_UNAVAILABLE', 503) from None
            except psycopg.errors.UniqueViolation:
                raise ServiceError('USERNAME_TAKEN', 409) from None
            except (psycopg.OperationalError, psycopg.InterfaceError, PoolTimeout, TooManyRequests):
                raise ServiceError('OUTCOME_UNKNOWN' if committing else 'SERVICE_UNAVAILABLE', 503) from None
            except psycopg.Error:
                raise ServiceError('SERVICE_UNAVAILABLE', 503) from None
    finally:
        bucket = metrics.get()
        if bucket is not None:
            bucket['ms'] += (time.monotonic() - start_time) * 1000
            bucket['calls'] += 1


def ready():
    return run(lambda tx: tx.execute('SELECT id FROM app.games LIMIT 1').fetchall())


def token_hash(token):
    return hashlib.sha256(token.encode('utf-8')).digest() if token else b''


def player_view(row):
    return {key: row[key] for key in ('id', 'username', 'created_at')}


def _session(tx, digest, lock=False):
    row = tx.execute('''SELECT p.id, p.username, p.created_at, p.password_hash,
        s.id AS session_id, s.created_at AS session_created_at, s.renewed_at,
        s.expires_at, s.absolute_expires_at FROM app.sessions s
        JOIN app.players p ON p.id=s.player_id WHERE s.token_hash=%s''', (digest,)).fetchone()
    if row and lock:
        # Player-before-session lock ordering shared by every protected write.
        tx.execute('SELECT id FROM app.players WHERE id=%s FOR UPDATE', (row['id'],)).fetchone()
        row = _session(tx, digest)
    now = datetime.now(timezone.utc)
    if row is None or now >= row['expires_at'] or now >= row['absolute_expires_at']:
        raise ServiceError('AUTH_REQUIRED', 401)
    return row


def session(token):
    return run(lambda tx: _session(tx, token_hash(token)))


def register(username, password_hash):
    def create(tx):
        return tx.execute('''INSERT INTO app.players(id,username,password_hash,created_at)
            VALUES (%s,%s,%s,%s) RETURNING id,username,created_at''',
            (uuid4(), username, password_hash, datetime.now(timezone.utc))).fetchone()
    return run(create, write=True)


def login_material(username_key):
    return run(lambda tx: tx.execute('SELECT * FROM app.players WHERE username_key=%s', (username_key,)).fetchone())


def create_session(player, digest):
    def create(tx):
        current = tx.execute('SELECT * FROM app.players WHERE id=%s FOR UPDATE', (player['id'],)).fetchone()
        if not current or current['password_hash'] != player['password_hash']:
            raise ServiceError('INVALID_CREDENTIALS', 401)
        now = datetime.now(timezone.utc)
        from datetime import timedelta
        expires, absolute = now + timedelta(seconds=259200), now + timedelta(seconds=2592000)
        tx.execute('''INSERT INTO app.sessions(id,token_hash,player_id,created_at,renewed_at,expires_at,absolute_expires_at)
                      VALUES (%s,%s,%s,%s,%s,%s,%s)''', (uuid4(), digest, player['id'], now, now, expires, absolute))
        return {'player': player_view(current), 'expires_at': expires, 'absolute_expires_at': absolute}
    return run(create, write=True)


def renew(token):
    def update(tx):
        from datetime import timedelta
        row = _session(tx, token_hash(token), lock=True)
        now = datetime.now(timezone.utc)
        expires = min(now + timedelta(seconds=259200), row['absolute_expires_at'])
        tx.execute('UPDATE app.sessions SET renewed_at=%s,expires_at=%s WHERE id=%s', (now, expires, row['session_id']))
        return {'player': player_view(row), 'expires_at': expires, 'absolute_expires_at': row['absolute_expires_at']}
    return run(update, write=True)


def logout(token):
    if not token:
        return
    digest = token_hash(token)
    def remove(tx):
        row = tx.execute('SELECT player_id FROM app.sessions WHERE token_hash=%s', (digest,)).fetchone()
        if row:
            tx.execute('SELECT id FROM app.players WHERE id=%s FOR UPDATE', (row['player_id'],))
            tx.execute('DELETE FROM app.sessions WHERE token_hash=%s', (digest,))
    run(remove, write=True)


def change_account(token, expected_hash, new_hash=None, delete=False):
    def change(tx):
        row = _session(tx, token_hash(token), lock=True)
        if row['password_hash'] != expected_hash:
            raise ServiceError('AUTH_REQUIRED', 401)
        if delete:
            tx.execute('DELETE FROM app.players WHERE id=%s', (row['id'],))
        else:
            tx.execute('UPDATE app.players SET password_hash=%s WHERE id=%s', (new_hash, row['id']))
            tx.execute('DELETE FROM app.sessions WHERE player_id=%s', (row['id'],))
    run(change, write=True)


def _best(tx, player_id, game):
    order = 'DESC' if game['ranking_direction'] == 'higher_is_better' else 'ASC'
    return tx.execute(f'''SELECT * FROM app.records WHERE player_id=%s AND game_id=%s
                          ORDER BY value {order}, created_at, id LIMIT 1''', (player_id, game['id'])).fetchone()


def submit(token, game_id, attempt_id, status, value, validate, improves):
    def save(tx):
        player = _session(tx, token_hash(token), lock=True)
        pid = player['id']
        previous = tx.execute('SELECT * FROM app.attempts WHERE player_id=%s AND id=%s', (pid, attempt_id)).fetchone()
        if previous:
            if (str(previous['game_id']), previous['status'], previous['value']) != (str(game_id), status, value):
                raise ServiceError('ATTEMPT_CONFLICT', 409)
            game = tx.execute('SELECT * FROM app.games WHERE id=%s', (game_id,)).fetchone()
            record = tx.execute('SELECT * FROM app.records WHERE id=%s', (previous['record_id'],)).fetchone() if previous['record_id'] else None
            return {'attempt': previous, 'outcome': previous['record_outcome'], 'record': record, 'current_record': _best(tx, pid, game)}, False
        game = tx.execute('SELECT * FROM app.games WHERE id=%s FOR SHARE', (game_id,)).fetchone()
        if not game:
            raise ServiceError('NOT_FOUND', 404)
        if not game['is_active']:
            raise ServiceError('GAME_INACTIVE', 409)
        validate(status, value, game['min_value'], game['max_value'])
        best = _best(tx, pid, game)
        record, outcome = None, 'not_eligible'
        now = datetime.now(timezone.utc)
        if status == 'completed':
            record = tx.execute('SELECT * FROM app.records WHERE player_id=%s AND game_id=%s AND value=%s', (pid, game_id, value)).fetchone()
            if record:
                outcome = 'already_recorded'
            elif improves(value, best['value'] if best else None, game['ranking_direction']):
                outcome = 'created'
                record = tx.execute('''INSERT INTO app.records(id,player_id,game_id,value,created_at)
                    VALUES (%s,%s,%s,%s,%s) RETURNING *''', (uuid4(), pid, game_id, value, now)).fetchone()
                best = record
            else:
                outcome = 'not_improved'
        attempt = tx.execute('''INSERT INTO app.attempts(player_id,id,game_id,status,value,created_at,record_outcome,record_id)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *''',
                    (pid, attempt_id, game_id, status, value, now, outcome, record['id'] if record else None)).fetchone()
        return {'attempt': attempt, 'outcome': outcome, 'record': record, 'current_record': best}, True
    return run(save, write=True)


def _required(row):
    if row is None:
        raise ServiceError('NOT_FOUND', 404)
    return row


def game(game_id):
    return run(lambda tx: _required(tx.execute('SELECT * FROM app.games WHERE id=%s', (game_id,)).fetchone()))


def player(player_id):
    return run(lambda tx: _required(tx.execute('SELECT id,username,created_at FROM app.players WHERE id=%s', (player_id,)).fetchone()))


def _page(tx, query, parameters, page, page_size, context=''):
    # Count and page use the SAME SQL statement/snapshot, including empty pages.
    row = tx.execute(f'''WITH data AS ({query}) SELECT
          (SELECT count(*) FROM data) AS total,
          COALESCE((SELECT jsonb_agg(to_jsonb(part)) FROM
              (SELECT * FROM data LIMIT %s OFFSET %s) part), '[]'::jsonb) AS items
          {context}''', (*parameters, page_size, min(page*page_size, 9223372036854775807))).fetchone()
    return {'items': row['items'], 'total': row['total'], 'page': page, 'page_size': page_size,
            **{k: v for k, v in row.items() if k not in ('items', 'total')}}


def games(page, page_size, include_inactive):
    return run(lambda tx: _page(tx, 'SELECT * FROM app.games WHERE (%s OR is_active) ORDER BY name,id', (include_inactive,), page, page_size))


def leaderboard(game_id, page, page_size):
    def read(tx):
        # Game, ranking, total and page are all read in this statement.
        result = tx.execute('''WITH g AS (SELECT * FROM app.games WHERE id=%s),
          best AS (SELECT DISTINCT ON (r.player_id) r.*,
             CASE WHEN g.ranking_direction='higher_is_better' THEN -r.value ELSE r.value END AS ordering
             FROM app.records r CROSS JOIN g WHERE r.game_id=g.id
             ORDER BY r.player_id, ordering, r.created_at, r.id),
          ranked AS (SELECT rank() OVER (ORDER BY ordering) AS rank,
             jsonb_build_object('id',p.id,'username',p.username,'created_at',p.created_at) AS player,
             to_jsonb(b)-'ordering' AS record, b.player_id
             FROM best b JOIN app.players p ON p.id=b.player_id),
          part AS (SELECT rank,player,record FROM ranked ORDER BY rank,player_id LIMIT %s OFFSET %s)
          SELECT (SELECT to_jsonb(g) FROM g) AS game,
            (SELECT count(*) FROM ranked) AS total,
            COALESCE((SELECT jsonb_agg(to_jsonb(part)) FROM part),'[]'::jsonb) AS items''', (game_id, page_size, min(page*page_size, 9223372036854775807))).fetchone()
        _required(result['game'])
        return {**result, 'page': page, 'page_size': page_size}
    return run(read)


def public_records(player_id, game_id, page, page_size):
    def read(tx):
        result = tx.execute('''WITH p AS (SELECT id,username,created_at FROM app.players WHERE id=%s),
          g AS (SELECT * FROM app.games WHERE id=%s),
          data AS (SELECT * FROM app.records WHERE player_id=%s AND game_id=%s ORDER BY created_at,id),
          part AS (SELECT * FROM data LIMIT %s OFFSET %s)
          SELECT (SELECT to_jsonb(p) FROM p) AS player, (SELECT to_jsonb(g) FROM g) AS game,
            (SELECT count(*) FROM data) AS total,
            COALESCE((SELECT jsonb_agg(to_jsonb(part)) FROM part),'[]'::jsonb) AS items''',
            (player_id, game_id, player_id, game_id, page_size, min(page*page_size, 9223372036854775807))).fetchone()
        _required(result['player']); _required(result['game'])
        return {**result, 'page': page, 'page_size': page_size}
    return run(read)


def player_records(player_id, page, page_size):
    def read(tx):
        result = tx.execute('''WITH p AS (SELECT id,username,created_at FROM app.players WHERE id=%s),
          best AS (SELECT DISTINCT ON (r.game_id) r.* FROM app.records r JOIN app.games g ON g.id=r.game_id
            WHERE r.player_id=%s ORDER BY r.game_id,
            CASE WHEN g.ranking_direction='higher_is_better' THEN -r.value ELSE r.value END,r.created_at,r.id),
          data AS (SELECT to_jsonb(g) AS game,to_jsonb(b) AS record,g.name,g.id FROM best b JOIN app.games g ON g.id=b.game_id),
          part AS (SELECT game,record FROM data ORDER BY name,id LIMIT %s OFFSET %s)
          SELECT (SELECT to_jsonb(p) FROM p) AS player,(SELECT count(*) FROM data) AS total,
            COALESCE((SELECT jsonb_agg(to_jsonb(part)) FROM part),'[]'::jsonb) AS items''',
            (player_id, player_id, page_size, min(page*page_size, 9223372036854775807))).fetchone()
        _required(result['player'])
        return {**result, 'page': page, 'page_size': page_size}
    return run(read)


def attempts(token, page=0, page_size=30, game_id=None, attempt_id=None):
    def read(tx):
        # Identity and private rows share one statement snapshot.
        result = tx.execute('''WITH owner AS (SELECT player_id FROM app.sessions WHERE token_hash=%s
            AND expires_at>clock_timestamp() AND absolute_expires_at>clock_timestamp()),
          g AS (SELECT id FROM app.games WHERE id=%s),
          data AS (SELECT a.* FROM app.attempts a JOIN owner o ON o.player_id=a.player_id
            WHERE (%s::uuid IS NULL OR a.game_id=%s) AND (%s::uuid IS NULL OR a.id=%s)
            ORDER BY a.created_at DESC,a.id DESC),
          part AS (SELECT * FROM data LIMIT %s OFFSET %s)
          SELECT EXISTS(SELECT FROM owner) AS authenticated, EXISTS(SELECT FROM g) AS game_exists,
            (SELECT count(*) FROM data) AS total,
            COALESCE((SELECT jsonb_agg(to_jsonb(part)) FROM part),'[]'::jsonb) AS items''',
            (token_hash(token), game_id, game_id, game_id, attempt_id, attempt_id, page_size, min(page*page_size, 9223372036854775807))).fetchone()
        if not result['authenticated']:
            raise ServiceError('AUTH_REQUIRED', 401)
        if game_id and not result['game_exists']:
            raise ServiceError('NOT_FOUND', 404)
        if attempt_id:
            return _required(result['items'][0] if result['items'] else None)
        return {'items': result['items'], 'total': result['total'], 'page': page, 'page_size': page_size}
    return run(read)
