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
        ("INSERT INTO app.attempts SELECT * FROM app.attempts WHERE player_id=%s LIMIT 1",(ADA,)),
        ("UPDATE app.attempts SET player_id=%s WHERE player_id=%s",(str(uuid4()),ADA)),
        ("UPDATE app.attempts SET game_id=%s WHERE player_id=%s",(str(uuid4()),ADA)),
        ("UPDATE app.attempts SET record_id=%s WHERE player_id=%s",(str(uuid4()),ADA)),
    ]
    for assignment in ("status=NULL", "status='unknown'", "created_at=NULL", "value=-1",
                       "value=9007199254740992", "value=NULL", "record_id=NULL",
                       "record_outcome=NULL", "record_outcome='unknown'",
                       "record_outcome='not_improved'", "status='incomplete'",
                       "status='incomplete', record_outcome='not_eligible'",
                       "record_outcome='not_eligible', record_id=NULL"):
        attempts.append((f'UPDATE app.attempts SET {assignment} WHERE player_id=%s',(ADA,)))
    for sql, params in attempts:
        with e.connect() as conn:
            try:
                with conn.transaction(): conn.execute(sql,params)
            except psycopg.IntegrityError: continue
        raise AssertionError('Databasen godtok ugyldige testdata: ' + sql.split(' SET ')[0])


@check('TDB-03-valid-attempts', 'KDB-1')
def valid_attempts(e):
    sql='INSERT INTO app.attempts(player_id,id,game_id,status,value,created_at,record_outcome,record_id) VALUES (%s,%s,%s,%s,%s,now(),%s,%s)'
    shared_id=str(uuid4())
    for player in (ADA,NORA):
        e.rows(sql,(player,shared_id,POINTS,'incomplete',None,'not_eligible',None),'backend')
    for value in (0,9007199254740991):
        e.rows(sql,(ADA,str(uuid4()),SPRINT,'incomplete',value,'not_eligible',None),'backend')
    for _ in range(2):
        e.rows(sql,(ADA,str(uuid4()),POINTS,'completed',80,'not_improved',None),'backend')
    record=e.scalar('SELECT id FROM app.records WHERE player_id=%s AND game_id=%s AND value=100',(ADA,POINTS))
    e.rows(sql,(ADA,str(uuid4()),POINTS,'completed',100,'already_recorded',record),'backend')
    assert e.scalar('SELECT count(*) FROM app.attempts')==15
    assert e.scalar('SELECT count(*) FROM app.records')==8
    assert e.scalar('SELECT count(*) FROM app.attempts',role='backend')==15


@check('TDB-04-cascade', 'KDB-2')
def cascade(e):
    import psycopg
    e.rows('DELETE FROM app.players WHERE id=%s',(ADA,),'backend')
    assert e.scalar('SELECT count(*) FROM app.sessions WHERE player_id=%s',(ADA,)) == 0
    assert e.scalar('SELECT count(*) FROM app.records WHERE player_id=%s',(ADA,)) == 0
    assert e.scalar('SELECT count(*) FROM app.records WHERE player_id=%s',(NORA,)) == 4
    assert e.scalar('SELECT count(*) FROM app.attempts WHERE player_id=%s',(ADA,)) == 0
    assert e.scalar('SELECT count(*) FROM app.attempts WHERE player_id=%s',(NORA,)) == 4
    assert e.scalar('SELECT count(*) FROM app.games') == 2
    try: e.rows('DELETE FROM app.games WHERE id=%s',(POINTS,))
    except psycopg.errors.ForeignKeyViolation: return
    raise AssertionError('Spill med historikk kunne slettes.')


@check('TDB-04-incomplete-game', 'KDB-2')
def incomplete_game(e):
    import psycopg
    game=str(uuid4())
    e.rows("INSERT INTO app.games(id,name,score_unit,ranking_direction,min_value,max_value,is_active) VALUES (%s,'Kun forsøk','points','higher_is_better',0,100,true)",(game,))
    e.rows("INSERT INTO app.attempts(player_id,id,game_id,status,value,created_at,record_outcome,record_id) VALUES (%s,%s,%s,'incomplete',NULL,now(),'not_eligible',NULL)",(ADA,str(uuid4()),game),'backend')
    assert e.scalar('SELECT count(*) FROM app.records WHERE game_id=%s',(game,))==0
    try:e.rows('DELETE FROM app.games WHERE id=%s',(game,))
    except psycopg.errors.ForeignKeyViolation:return
    raise AssertionError('Spill med bare et ufullført forsøk kunne slettes.')


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
    assert e.scalar('SELECT count(*) FROM app.attempts') == 8


@check('TDB-05-reader', 'KDB-3')
def reader(e):
    e.rows('UPDATE app.games SET is_active=false WHERE id=%s',(POINTS,))
    assert e.scalar('SELECT count(*) FROM ai_read.players',role='ai') == 2
    assert e.scalar('SELECT count(*) FROM ai_read.games',role='ai') == 2
    assert e.scalar('SELECT count(*) FROM ai_read.records',role='ai') == 8
    for sql in ('SELECT password_hash FROM app.players','SELECT * FROM app.sessions',
                'SELECT * FROM app.attempts',f"SELECT * FROM app.attempts WHERE player_id='{ADA}'",
                'SELECT * FROM app.records','DELETE FROM ai_read.records',
                "UPDATE ai_read.players SET username='Changed'",'CREATE TABLE app.forbidden(id integer)',
                'CREATE TEMP TABLE forbidden(id integer)','SET ROLE backend_app',
                f"COPY ai_read.players TO '{e.work}/forbidden-export'",
                f"SELECT pg_read_file('{e.work}/password')"):
        denied(e,sql)
    assert e.scalar('SELECT count(*) FROM app.records') == 8
    assert e.scalar('SELECT count(*) FROM app.attempts') == 8
    for role in ('ai_reader','backend_app'):
        flags=e.rows('SELECT rolsuper,rolcreaterole,rolcreatedb,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=%s',(role,))[0]
        assert not any(flags), f'{role} har privilegert rolleflagg'
    dangerous=('backend_app','pg_read_all_data','pg_write_all_data','pg_read_server_files','pg_write_server_files','pg_execute_server_program')
    for role in dangerous:
        assert not e.scalar('SELECT pg_has_role(%s,%s,\'MEMBER\')',('ai_reader',role))


@check('TDB-05-backend', 'KDB-3')
def backend_privileges(e):
    for sql in ('CREATE TABLE app.forbidden(id integer)', 'DROP TABLE app.records',
                'DELETE FROM app.attempts', "UPDATE app.attempts SET status='incomplete'",
                'DELETE FROM app.records', 'UPDATE app.records SET value=999',
                "UPDATE app.games SET name='Changed'", 'DELETE FROM app.games',
                'SET ROLE test_admin'):
        denied(e,sql,role='backend')


@check('TDB-07-restart', 'KDB-4')
def restart(e):
    before={table:e.rows(f'SELECT * FROM app.{table} ORDER BY '+('player_id,id' if table=='attempts' else 'id'))
            for table in ('players','sessions','games','records','attempts')}
    e.stop_service('api');e.stop_service('ai')
    e.pg_stop();e.pg_start()
    for table,rows in before.items():
        assert e.rows(f'SELECT * FROM app.{table} ORDER BY '+('player_id,id' if table=='attempts' else 'id'))==rows


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
    expected={table:e.rows(f'SELECT * FROM app.{table} ORDER BY '+('player_id,id' if table=='attempts' else 'id'))
              for table in ('players','games','records','attempts')}
    e.rows('CREATE DATABASE mbg_restore_test')
    env['MBG_ADMIN_DSN']=make_conninfo(e.admin_dsn,dbname='mbg_restore_test')
    start=time.perf_counter()
    e.command(['bash',str(script),str(backup)],env=env,timeout=1800)
    import psycopg
    with psycopg.connect(env['MBG_ADMIN_DSN'],autocommit=True) as conn:
        for table,rows in expected.items():
            assert conn.execute(f'SELECT * FROM app.{table} ORDER BY '+('player_id,id' if table=='attempts' else 'id')).fetchall()==rows
        assert conn.execute('SELECT count(*) FROM app.sessions').fetchone()[0]==0
    e.measurements['restore_seconds']=time.perf_counter()-start
    assert e.measurements['restore_seconds']<=1800
    e.rows('DROP DATABASE mbg_restore_test WITH (FORCE)')
