#!/usr/bin/env python3
"""Trusted deployment catalogue synchronization; never exposed over HTTP."""
import argparse
import json
import os
from pathlib import Path
import sys

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'api/src'))
from cartridge_rules import metadata


def validate_catalog(catalog):
    if catalog.get('formatVersion') != 1 or catalog.get('errors') or not isinstance(catalog.get('games'),list) or not 1 <= len(catalog['games']) <= 10000:
        raise ValueError('Ugyldig eller tom katalog.')
    rows, ids, keys = [], set(), set()
    for game in catalog['games']:
        meta=metadata(game)
        key=(meta['packageId'],meta['modeId'],meta['rulesVersion'])
        if game['id'] in ids or key in keys: raise ValueError('Kolliderende katalog-ID.')
        ids.add(game['id']);keys.add(key);rows.append((game,meta))
    return rows


def synchronize(conn,rows):
    from psycopg.types.json import Jsonb
    conn.execute("SET LOCAL lock_timeout='2s'")
    conn.execute("SET LOCAL statement_timeout='15s'")
    conn.execute('LOCK TABLE app.games IN SHARE ROW EXCLUSIVE MODE')
    for game,meta in rows:
        current=conn.execute('SELECT score_unit,ranking_direction,min_value,max_value,sdk_metadata FROM app.games WHERE id=%s FOR UPDATE',(game['id'],)).fetchone()
        values=(game['score_unit'],game['ranking_direction'],game['min_value'],game['max_value'])
        if current:
            if tuple(current[:4])!=values or current[4] and any(current[4].get(k)!=meta[k] for k in ('packageId','modeId','rulesVersion','rulesFingerprint')):
                raise ValueError('Eksisterende spill har andre regler. Øk rulesVersion.')
            conn.execute('UPDATE app.games SET name=%s,sdk_metadata=%s WHERE id=%s',(game['name'],Jsonb(meta),game['id']))
        else:
            conn.execute('INSERT INTO app.games(id,name,score_unit,ranking_direction,min_value,max_value,is_active,sdk_metadata) VALUES (%s,%s,%s,%s,%s,%s,true,%s)',(game['id'],game['name'],*values,Jsonb(meta)))


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('catalog',type=Path);p.add_argument('--runtime-local',action='store_true');args=p.parse_args()
    if args.catalog.stat().st_size>32*1024*1024:raise ValueError('Katalogen er for stor.')
    rows=validate_catalog(json.loads(args.catalog.read_text(encoding='utf-8')))
    import psycopg
    dsn='host=/run/mbg-db port=5433 dbname=mikrobit_games user=mbg-db' if args.runtime_local else os.environ['MBG_ADMIN_DSN']
    with psycopg.connect(dsn,connect_timeout=3) as conn:synchronize(conn,rows)
    print(f'Katalog synkronisert: {len(rows)} topplister. Eksisterende rekorder er beholdt.')


if __name__=='__main__':
    try:main()
    except Exception as error:
        # Never print connection/SQL exceptions, which may include secrets.
        print(str(error) if isinstance(error,(ValueError,KeyError)) else 'Katalogsynkronisering feilet. Kontroller migrering, katalog og database.',file=sys.stderr)
        raise SystemExit(1) from None
