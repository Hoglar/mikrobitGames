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
from score_presentation import describe_racing

InvalidReferences = query_policy.InvalidReferences


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


class InvalidTool(ValueError):
    pass


def text_arg(value):
    if type(value) is not str or not 1 <= len(value.strip()) <= 100:
        raise InvalidTool('Verktøyargumentet må være tekst med 1–100 tegn.')
    return value.strip()


class DataTools:
    def __init__(self, player_id, query=query):
        self.player_id = str(UUID(player_id))
        self.query = query

    def call(self, name, args, deadline):
        allowed = {'games': set(), 'standings': {'game'},
                   'history': {'game', 'player'}, 'player_games': {'player'}}
        if type(name) is not str or name not in allowed or type(args) is not dict or set(args) != allowed[name]:
            raise InvalidTool('Bruk et oppgitt verktøy med akkurat de oppgitte argumentene.')
        args = {key: text_arg(value) for key, value in args.items()}
        if name == 'games':
            return self.query('SELECT id, name, score_unit, ranking_direction, is_active FROM ai_read.games ORDER BY name, id', [], deadline)
        if name == 'player_games':
            predicate, parameter = self.player(args['player'])
            result = self.query('''SELECT DISTINCT g.id, g.name, g.score_unit, g.ranking_direction
                FROM ai_read.games g JOIN ai_read.records r ON r.game_id=g.id
                JOIN ai_read.players p ON p.id=r.player_id WHERE ''' + predicate + ' ORDER BY g.name, g.id', [parameter], deadline)
            return {'player': args['player'], 'games': result}
        if name == 'standings':
            result = self.query('''WITH latest AS (
                SELECT g.id AS game_id, g.name AS game, g.score_unit AS unit,
                    g.ranking_direction AS direction, p.username AS player, r.value,
                    ROW_NUMBER() OVER (PARTITION BY r.game_id, r.player_id ORDER BY r.created_at DESC, r.id DESC) AS position
                FROM ai_read.games g LEFT JOIN ai_read.records r ON r.game_id=g.id
                LEFT JOIN ai_read.players p ON p.id=r.player_id
                WHERE LOWER(g.name)=LOWER($1) OR CAST(g.id AS TEXT)=$1)
                SELECT game_id, game, unit, direction, player, value FROM latest WHERE position=1''', [args['game']], deadline)
        else:
            predicate, parameter = self.player(args['player'])
            result = self.query('''WITH selected_records AS (
                SELECT r.game_id, r.value, r.created_at, r.id, p.username AS player
                FROM ai_read.records r JOIN ai_read.players p ON p.id=r.player_id
                WHERE ''' + predicate.replace('$1', '$2') + ''')
                SELECT g.id AS game_id, g.name AS game, g.score_unit AS unit,
                g.ranking_direction AS direction, r.player, r.value, r.created_at
                FROM ai_read.games g LEFT JOIN selected_records r ON r.game_id=g.id
                WHERE LOWER(g.name)=LOWER($1) OR CAST(g.id AS TEXT)=$1
                ORDER BY r.created_at, r.id''', [args['game'], parameter], deadline)
        rows = [dict(zip(result['columns'], row)) for row in result['rows']]
        if not rows:
            return {'unknown_game': True, 'instruction': 'Spillnavnet eller ID-en traff ikke katalogen. Dette betyr ikke at rekorder mangler. Bruk games for nøyaktig navn/ID; spør om variant ved flere muligheter.'}
        if len({row['game_id'] for row in rows}) != 1:
            return {'ambiguous_game': True, 'instruction': 'Flere spill har dette navnet. Bruk games og be om spill-ID.'}
        header = {key: rows[0][key] for key in ('game', 'unit', 'direction')}
        rows = [row for row in rows if row['player'] is not None]
        if not rows:
            return {**header, 'found': False, 'explanation': 'Spillet finnes, men ingen offentlig rekord traff oppgitt spill/spiller. Dette viser ikke om private forsøk finnes.'}
        if name == 'standings':
            reverse = header['direction'] == 'higher_is_better'
            rows.sort(key=lambda row: ((-row['value'] if reverse else row['value']), row['player'].lower()))
            records, rank, previous = [], 0, None
            for index, row in enumerate(rows, 1):
                if row['value'] != previous:
                    rank = index
                previous = row['value']
                records.append({'player': row['player'], 'value': row['value'], 'rank': rank,
                                'gap_to_best': abs(rows[0]['value'] - row['value'])})
            return describe_racing({**header, 'meaning': 'Gjeldende personlig rekord per spiller, beste først. Antallet gjelder spillere med offentlig rekord, ikke alle som kan ha prøvd spillet.',
                    'players_with_records': len(records), 'total_participants': None,
                    'total_participants_known': False, 'records': records})
        change = rows[-1]['value'] - rows[0]['value']
        improvement = change if header['direction'] == 'higher_is_better' else -change
        return describe_racing({**header, 'player': rows[0]['player'], 'meaning': 'Offentlig rekordhistorikk, ikke alle forsøk.',
                'history': [{'value': row['value'], 'at': row['created_at']} for row in rows],
                'improvement': improvement if len(rows) > 1 else None})

    def player(self, value):
        # Identity comes from the local session, never from a model-supplied UUID.
        if value.lower() == 'me':
            return 'p.id=$1', self.player_id
        return 'p.username_key=$1', value.lower()


def game_context(game_id, deadline):
    rows = query('SELECT id, name FROM ai_read.games WHERE id=$1', [game_id], deadline)['rows']
    return {'id': rows[0][0], 'name': rows[0][1]} if rows else None
