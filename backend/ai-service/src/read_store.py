"""One AI connection, read-only, policy checked and bounded without truncation."""
import json
import os
import time
from datetime import datetime, date
from decimal import Decimal
from uuid import UUID
import psycopg
from sqlglot import exp
import query_policy


class ResultTooLarge(ValueError):
    pass


class StoreUnavailable(Exception):
    pass


def encode(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, (UUID, Decimal)):
        return str(value)
    raise TypeError('Ukjent dataverdi.')


def query(sql, parameters, deadline):
    tree = query_policy.parse_query(sql)
    if type(parameters) is not list or len(parameters) > 100 or any(type(x) not in (str, int, float, bool, type(None)) for x in parameters):
        raise ValueError('Ugyldige parametere.')
    # RawServerCursor binds PostgreSQL $1 parameters natively. No textual SQL
    # replacement, interpolation or rewriting of quoted literals/operators.
    indices = set()
    for node in tree.find_all(exp.Parameter):
        try:
            index = int(node.this.name)
        except (ValueError, AttributeError):
            raise ValueError('Ugyldig parameterreferanse.') from None
        if not 1 <= index <= len(parameters):
            raise ValueError('Ugyldig parameterreferanse.')
        indices.add(index)
    if indices != set(range(1, len(parameters)+1)) or tree.find(exp.Placeholder):
        raise ValueError('Parametere må samsvare med nummererte referanser.')
    statement = tree.sql(dialect='postgres')
    remaining = deadline-time.monotonic()
    if remaining <= 0:
        raise TimeoutError()
    timeout_ms = max(1, min(2000, int(remaining*1000)))
    try:
        with psycopg.connect(os.environ['MBG_DATABASE_DSN'], connect_timeout=max(1, min(3, int(remaining))),
                             autocommit=True, options='-c search_path=pg_catalog,ai_read') as conn:
            with conn.transaction():
                conn.execute('SET TRANSACTION READ ONLY')
                conn.execute("SELECT set_config('statement_timeout', %s, true)", (str(timeout_ms),))
                conn.execute("SET LOCAL idle_in_transaction_session_timeout='5s'")
                query_deadline = min(deadline, time.monotonic()+2)
                with psycopg.RawServerCursor(conn, 'bounded_answer') as cursor:
                    cursor.execute(statement, parameters if parameters else None)
                    columns = [c.name for c in cursor.description]
                    rows = []
                    bytes_used = len(json.dumps({'columns': columns, 'rows': []}).encode('utf-8'))
                    while True:
                        remaining_query = query_deadline-time.monotonic()
                        if remaining_query <= 0:
                            raise StoreUnavailable('Spørringens tidsfrist er brukt opp.')
                        conn.execute("SELECT set_config('statement_timeout', %s, true)", (str(max(1, int(remaining_query*1000))),))
                        batch = cursor.fetchmany(100)
                        if not batch:
                            break
                        for row in batch:
                            if time.monotonic() >= query_deadline:
                                raise StoreUnavailable('Spørringens tidsfrist er brukt opp.')
                            if len(rows) >= 1000:
                                raise ResultTooLarge('RESULT_TOO_LARGE')
                            normalized = json.loads(json.dumps(row, default=encode, ensure_ascii=False, allow_nan=False))
                            bytes_used += len(json.dumps(normalized, ensure_ascii=False, allow_nan=False).encode('utf-8')) + 2
                            if bytes_used > 1048576:
                                raise ResultTooLarge('RESULT_TOO_LARGE')
                            rows.append(normalized)
                    return {'columns': columns, 'rows': rows}
    except psycopg.Error:
        raise StoreUnavailable('Databaseoperasjonen feilet.') from None


def game_exists(game_id, deadline):
    return bool(query('SELECT id FROM ai_read.games WHERE id = $1', [game_id], deadline)['rows'])
