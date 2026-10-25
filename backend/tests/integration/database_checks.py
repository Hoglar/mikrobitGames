"""TDB-02–07: real role connections and independent reads after commit."""
import time
from pathlib import Path
from uuid import uuid4
from check_registry import check
from harness import ADA, NORA, POINTS, SPRINT, Blocked, ROOT


def denied(e, sql, params=(), role='ai'):
    import psycopg
    try:
        e.rows(sql, params, role)
    except psycopg.errors.InsufficientPrivilege:
        return
    raise AssertionError('En forbudt handling ble ikke avvist med manglende rettighet.')


@check('TDB-02-crud', 'KDB-1')
def crud(e):
    id = str(uuid4())
    e.rows("INSERT INTO app.players(id,username,password_hash,created_at) VALUES (%s,'TestPlayer','test-hash',now())", (id,), 'backend')
    assert e.scalar('SELECT username FROM app.players WHERE id=%s',(id,)) == 'TestPlayer'
    e.rows("UPDATE app.players SET password_hash='changed' WHERE id=%s",(id,),'backend')
    assert e.scalar('SELECT password_hash FROM app.players WHERE id=%s',(id,)) == 'changed'
    e.rows('DELETE FROM app.players WHERE id=%s',(id,),'backend')
    assert e.scalar('SELECT count(*) FROM app.players WHERE id=%s',(id,)) == 0


@check('TDB-03-constraints', 'KDB-1')
def constraints(e):
    import psycopg
    attempts = [
        ("INSERT INTO app.players(id,username,password_hash,created_at) VALUES (%s,'ADA','x',now())",(str(uuid4()),)),
        ("UPDATE app.players SET username='a b' WHERE id=%s",(ADA,)),
        ("UPDATE app.players SET password_hash='' WHERE id=%s",(ADA,)),
        ("UPDATE app.players SET username=NULL WHERE id=%s",(ADA,)),
        ("UPDATE app.games SET ranking_direction='random' WHERE id=%s",(POINTS,)),
        ("UPDATE app.games SET max_value=-1 WHERE id=%s",(POINTS,)),
        ("UPDATE app.games SET name='   ' WHERE id=%s",(POINTS,)),
        ("UPDATE app.games SET score_unit='' WHERE id=%s",(POINTS,)),
        ("UPDATE app.games SET min_value=-1 WHERE id=%s",(POINTS,)),
        ("UPDATE app.games SET max_value=9007199254740992 WHERE id=%s",(POINTS,)),
        ("UPDATE app.records SET value=-1 WHERE player_id=%s",(ADA,)),
        ("UPDATE app.records SET value=9007199254740992 WHERE player_id=%s",(ADA,)),
        ("UPDATE app.records SET player_id=%s WHERE player_id=%s",(str(uuid4()),ADA)),
        ("UPDATE app.sessions SET token_hash='x'::bytea WHERE player_id=%s",(ADA,)),
        ("UPDATE app.sessions SET expires_at=absolute_expires_at+interval '1 day' WHERE player_id=%s",(ADA,)),
        ("INSERT INTO app.records(id,player_id,game_id,value,created_at) VALUES (%s,%s,%s,120,now())",(str(uuid4()),ADA,POINTS)),
    ]
    for sql, params in attempts:
        with e.connect() as conn:
            try:
                with conn.transaction(): conn.execute(sql,params)
            except psycopg.IntegrityError: continue
        raise AssertionError('Databasen godtok ugyldige testdata: ' + sql.split(' SET ')[0])


@check('TDB-04-cascade', 'KDB-2')
def cascade(e):
    import psycopg
    e.rows('DELETE FROM app.players WHERE id=%s',(ADA,),'backend')
    assert e.scalar('SELECT count(*) FROM app.sessions WHERE player_id=%s',(ADA,)) == 0
    assert e.scalar('SELECT count(*) FROM app.records WHERE player_id=%s',(ADA,)) == 0
    assert e.scalar('SELECT count(*) FROM app.records WHERE player_id=%s',(NORA,)) == 4
    assert e.scalar('SELECT count(*) FROM app.games') == 2
    try: e.rows('DELETE FROM app.games WHERE id=%s',(POINTS,))
    except psycopg.errors.ForeignKeyViolation: return
    raise AssertionError('Spill med historikk kunne slettes.')


@check('TDB-06-rollback', 'KDB-2')
def rollback(e):
    import psycopg
    with e.connect('backend') as conn:
        try:
            with conn.transaction():
                conn.execute('DELETE FROM app.players WHERE id=%s',(ADA,))
                conn.execute('SELECT 1/0')
        except psycopg.errors.DivisionByZero: pass
    assert e.scalar('SELECT count(*) FROM app.players') == 2
    assert e.scalar('SELECT count(*) FROM app.sessions') == 2
    assert e.scalar('SELECT count(*) FROM app.records') == 8


@check('TDB-05-reader', 'KDB-3')
def reader(e):
    e.rows('UPDATE app.games SET is_active=false WHERE id=%s',(POINTS,))
    assert e.scalar('SELECT count(*) FROM ai_read.players',role='ai') == 2
    assert e.scalar('SELECT count(*) FROM ai_read.games',role='ai') == 2
    assert e.scalar('SELECT count(*) FROM ai_read.records',role='ai') == 8
    for sql in ('SELECT password_hash FROM app.players','SELECT * FROM app.sessions',
                'SELECT * FROM app.records','DELETE FROM ai_read.records',
                "UPDATE ai_read.players SET username='Changed'",'CREATE TABLE app.forbidden(id integer)',
                'CREATE TEMP TABLE forbidden(id integer)','SET ROLE backend_app',
                f"COPY ai_read.players TO '{e.work}/forbidden-export'",
                f"SELECT pg_read_file('{e.work}/password')"):
        denied(e,sql)
    assert e.scalar('SELECT count(*) FROM app.records') == 8
    for role in ('ai_reader','backend_app'):
        flags=e.rows('SELECT rolsuper,rolcreaterole,rolcreatedb,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=%s',(role,))[0]
        assert not any(flags), f'{role} har privilegert rolleflagg'
    dangerous=('backend_app','pg_read_all_data','pg_write_all_data','pg_read_server_files','pg_write_server_files','pg_execute_server_program')
    for role in dangerous:
        assert not e.scalar('SELECT pg_has_role(%s,%s,\'MEMBER\')',('ai_reader',role))


@check('TDB-05-backend', 'KDB-3')
def backend_privileges(e):
    for sql in ('CREATE TABLE app.forbidden(id integer)', 'DROP TABLE app.records',
                "UPDATE app.games SET name='Changed'", 'DELETE FROM app.games',
                'SET ROLE test_admin'):
        denied(e,sql,role='backend')


@check('TDB-07-restart', 'KDB-4')
def restart(e):
    before=e.rows('SELECT id,player_id,game_id,value,created_at FROM app.records ORDER BY id')
    e.stop_service('api');e.stop_service('ai')
    e.pg_stop();e.pg_start()
    assert e.rows('SELECT id,player_id,game_id,value,created_at FROM app.records ORDER BY id') == before


@check('TDB-07-restore', 'KDB-4')
def restore(e):
    import os
    from psycopg.conninfo import make_conninfo
    script=ROOT/'backend/database/restore.sh'
    if not script.is_file(): raise Blocked('backend/database/restore.sh er ikke implementert ennå.')
    backup=e.work/'backup.dump'
    env=os.environ.copy()
    env.update(PGHOST='127.0.0.1',PGPORT=str(e.pg_port),PGUSER='test_admin',PGPASSWORD=e.admin_password)
    e.command([str(e.pg/'pg_dump'),'-Fc','-d',e.database,'-f',str(backup)],env=env)
    expected={table:e.rows(f'SELECT * FROM app.{table} ORDER BY id') for table in ('players','games','records')}
    e.rows('CREATE DATABASE mbg_restore_test')
    env['MBG_ADMIN_DSN']=make_conninfo(e.admin_dsn,dbname='mbg_restore_test')
    start=time.perf_counter()
    e.command(['bash',str(script),str(backup)],env=env,timeout=1800)
    import psycopg
    with psycopg.connect(env['MBG_ADMIN_DSN'],autocommit=True) as conn:
        for table,rows in expected.items():
            assert conn.execute(f'SELECT * FROM app.{table} ORDER BY id').fetchall()==rows
        assert conn.execute('SELECT count(*) FROM app.sessions').fetchone()[0]==0
    e.measurements['restore_seconds']=time.perf_counter()-start
    assert e.measurements['restore_seconds']<=1800
    e.rows('DROP DATABASE mbg_restore_test WITH (FORCE)')
