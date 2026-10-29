"""Run as mbg-db on the private Unix socket; secrets arrive via stdin only."""
import hashlib
import json
from pathlib import Path
import sys
import psycopg
from psycopg import sql


def main():
    passwords = json.load(sys.stdin)
    common = {'host': '/run/mbg-db', 'port': 5433, 'user': 'mbg-db', 'autocommit': True}
    with psycopg.connect(dbname='postgres', **common) as conn:
        for role in ('backend_app', 'ai_reader'):
            if not conn.execute('SELECT 1 FROM pg_roles WHERE rolname=%s', (role,)).fetchone():
                conn.execute(sql.SQL('CREATE ROLE {} LOGIN PASSWORD {}').format(sql.Identifier(role), sql.Literal(passwords[role])))
        if not conn.execute("SELECT 1 FROM pg_database WHERE datname='mikrobit_games'").fetchone():
            conn.execute('CREATE DATABASE mikrobit_games')
    with psycopg.connect(dbname='mikrobit_games', **common) as conn:
        conn.execute('CREATE TABLE IF NOT EXISTS public.mbg_migrations (name text PRIMARY KEY, sha256 text NOT NULL)')
        directory = Path(__file__).resolve().parents[2] / 'database/migrations'
        for path in sorted(directory.glob('*.sql')):
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            done = conn.execute('SELECT sha256 FROM public.mbg_migrations WHERE name=%s', (path.name,)).fetchone()
            if done:
                if done[0] != digest:
                    raise RuntimeError('En allerede kjørt migrering er endret; manuell avklaring kreves.')
                continue
            if path.name == '001_initial.sql' and conn.execute("SELECT to_regclass('app.players')").fetchone()[0]:
                raise RuntimeError('Dataskjema finnes uten migreringsmarkør; oppsettet sletter eller overskriver det ikke.')
            conn.execute(path.read_text())
            conn.execute('INSERT INTO public.mbg_migrations VALUES (%s,%s)', (path.name, digest))
        # Only catalog entries, no known-password accounts or borrowed test sessions.
        if passwords.get('demo_games'):
            for id, name, unit, direction, maximum in (
                ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Poengjakt (demo)', 'points', 'higher_is_better', 1000000),
                ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Sprint (demo)', 'milliseconds', 'lower_is_better', 3600000)):
                conn.execute('''INSERT INTO app.games(id,name,score_unit,ranking_direction,min_value,max_value,is_active)
                    VALUES (%s,%s,%s,%s,0,%s,true) ON CONFLICT (id) DO NOTHING''', (id,name,unit,direction,maximum))
    print('Database og versjonerte migreringer er klare; eksisterende data er beholdt.')


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        # Database errors can echo SQL values including role passwords.
        print('Databaseoppsettet stoppet ('+type(exc).__name__+'). Ingen automatisk sletting er utført.', file=sys.stderr)
        sys.exit(1)
