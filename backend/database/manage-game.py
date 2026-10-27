#!/usr/bin/env python3
"""Developer-only administration; never exposed as an HTTP endpoint.

Use the separate migration/maintenance role via MBG_ADMIN_DSN. Rule changes and
deletions lock the game before checking both private attempts and public records.
"""
import argparse
import os
from uuid import UUID, uuid4
import psycopg

parser = argparse.ArgumentParser(description='Administrer spill med separat vedlikeholdsrolle.')
parser.add_argument('operation', choices=('create', 'rename', 'activate', 'deactivate', 'rules', 'delete'))
parser.add_argument('--id', type=UUID)
parser.add_argument('--name')
parser.add_argument('--unit')
parser.add_argument('--direction', choices=('higher_is_better', 'lower_is_better'))
parser.add_argument('--min', type=int, dest='minimum')
parser.add_argument('--max', type=int, dest='maximum')
args = parser.parse_args()

if args.operation in ('create', 'rules'):
    if not args.unit or not args.unit.strip() or len(args.unit) > 32 or not args.direction or args.minimum is None or args.maximum is None or not 0 <= args.minimum <= args.maximum <= 9007199254740991:
        parser.error('Oppgi --unit, --direction og gyldig --min/--max.')
if args.operation in ('create', 'rename') and (not args.name or not args.name.strip() or len(args.name) > 100):
    parser.error('Oppgi --name med 1–100 tegn.')
if args.operation != 'create' and args.id is None:
    parser.error('--id kreves.')

try:
    with psycopg.connect(os.environ['MBG_ADMIN_DSN'], connect_timeout=3) as conn:
        conn.execute("SET LOCAL lock_timeout='500ms'")
        conn.execute("SET LOCAL statement_timeout='1s'")
        if args.operation == 'create':
            args.id = args.id or uuid4()
            conn.execute('''INSERT INTO app.games(id,name,score_unit,ranking_direction,min_value,max_value,is_active)
                VALUES (%s,%s,%s,%s,%s,%s,true)''', (args.id, args.name, args.unit, args.direction, args.minimum, args.maximum))
        else:
            if not conn.execute('SELECT id FROM app.games WHERE id=%s FOR UPDATE', (args.id,)).fetchone():
                raise ValueError('Spillet finnes ikke.')
            if args.operation in ('rules', 'delete'):
                used = conn.execute('''SELECT EXISTS(SELECT FROM app.attempts WHERE game_id=%s)
                    OR EXISTS(SELECT FROM app.records WHERE game_id=%s)''', (args.id, args.id)).fetchone()[0]
                if used:
                    raise ValueError('Spillet har historikk. Deaktiver det eller opprett en ny spill-ID.')
            if args.operation == 'delete':
                conn.execute('DELETE FROM app.games WHERE id=%s', (args.id,))
            elif args.operation == 'rules':
                conn.execute('UPDATE app.games SET score_unit=%s,ranking_direction=%s,min_value=%s,max_value=%s WHERE id=%s',
                             (args.unit, args.direction, args.minimum, args.maximum, args.id))
            elif args.operation == 'rename':
                conn.execute('UPDATE app.games SET name=%s WHERE id=%s', (args.name, args.id))
            else:
                conn.execute('UPDATE app.games SET is_active=%s WHERE id=%s', (args.operation == 'activate', args.id))
    print('Endringen er bekreftet for spill', args.id)
except (ValueError, KeyError) as exc:
    raise SystemExit(str(exc)) from None
except psycopg.Error:
    raise SystemExit('Databaseoperasjonen feilet. Kontroller tilstanden før nytt forsøk.') from None
