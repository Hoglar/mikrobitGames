"""Black-box HTTP + independent SQL inspection, without frontend/Micro:bit."""
from concurrent.futures import ThreadPoolExecutor
import hashlib
import threading
from uuid import uuid4
from check_registry import check
from harness import ADA, NORA, POINTS, SPRINT, PASSWORD


def status(response, expected, code=None):
    actual,headers,body=response
    assert actual==expected, f'HTTP {actual}, forventet {expected}'
    if code:
        assert body['error']['code']==code
        assert body['request_id']==headers['x-request-id']
        assert 'no-store' in headers.get('cache-control','')
    return body


def login(e, username='Ada', password=PASSWORD):
    response=e.api('POST','/auth/login',{'username':username,'password':password})
    body=status(response,200)
    cookie=response[1]['set-cookie']
    for flag in ('Secure','HttpOnly','SameSite=Lax','Path=/'):
        assert flag.lower() in cookie.lower()
    assert 'domain=' not in cookie.lower()
    token=cookie.split(';',1)[0].split('=',1)[1]
    e.tokens[body['player']['id']]=token
    return body,token


@check('TBE-02-account','KAPI-1',('db','api'))
def account(e):
    payload={'username':'TestPlayer','password':PASSWORD}
    registered=e.api('POST','/auth/register',payload)
    player=status(registered,201)
    assert 'set-cookie' not in registered[1]
    assert set(player)=={'id','username','created_at'}
    password_hash=e.scalar('SELECT password_hash FROM app.players WHERE id=%s',(player['id'],))
    from argon2 import PasswordHasher
    assert password_hash.startswith('$argon2id$') and PasswordHasher().verify(password_hash,PASSWORD)
    status(e.api('POST','/auth/register',dict(payload,username='testplayer')),409,'USERNAME_TAKEN')
    for name in ('TestPlayer','UnknownPlayer'):
        status(e.api('POST','/auth/login',{'username':name,'password':'WrongPassword123!'}),401,'INVALID_CREDENTIALS')
    body,token=login(e,'TestPlayer')
    row=e.rows('SELECT token_hash,extract(epoch from expires_at-created_at),extract(epoch from absolute_expires_at-created_at) FROM app.sessions WHERE player_id=%s',(player['id'],))[0]
    assert bytes(row[0])==hashlib.sha256(token.encode()).digest()
    assert row[1]==259200 and row[2]==2592000
    first_token=token
    login(e,'TestPlayer')
    status(e.api('POST','/auth/logout',{},player['id']),204)
    status(e.api('GET','/auth/session',player=player['id']),401,'AUTH_REQUIRED')
    status(e.api('GET','/auth/session',headers={'Cookie':'__Host-mbg_session='+first_token}),200)
    status(e.api('POST','/auth/logout',{},player['id']),204)


@check('TBE-02-renew-expiry','KAPI-1',('db','api'))
def renew(e):
    original=status(e.api('GET','/auth/session',player=ADA),200)
    renewed=status(e.api('POST','/auth/renew',{},ADA),200)
    assert renewed['player']['id']==ADA
    assert renewed['absolute_expires_at']==original['absolute_expires_at']
    e.rows("UPDATE app.sessions SET created_at=now()-interval '29 days', renewed_at=now()-interval '1 day', absolute_expires_at=now()+interval '1 day', expires_at=now()+interval '1 day' WHERE player_id=%s",(ADA,))
    renewed=status(e.api('POST','/auth/renew',{},ADA),200)
    assert renewed['expires_at']==renewed['absolute_expires_at']
    e.rows("UPDATE app.sessions SET created_at=now()-interval '5 days',renewed_at=now()-interval '4 days',absolute_expires_at=now()+interval '25 days',expires_at=now()-interval '1 day' WHERE player_id=%s",(ADA,))
    status(e.api('POST','/auth/renew',{},ADA),401,'AUTH_REQUIRED')
    status(e.api('POST',f'/games/{POINTS}/results',{'value':130},ADA),401,'AUTH_REQUIRED')
    assert e.scalar('SELECT max(value) FROM app.records WHERE player_id=%s AND game_id=%s',(ADA,POINTS))==120


@check('TBE-02-password-delete','KAPI-1',('db','api'))
def password_delete(e):
    _,first=login(e); _,second=login(e)
    assert first!=second
    status(e.api('POST','/account/password',{'current_password':'wrong','new_password':'NewPassword123!'},ADA),403,'CURRENT_PASSWORD_INCORRECT')
    status(e.api('POST','/account/password',{'current_password':PASSWORD,'new_password':'NewPassword123!'},ADA),204)
    assert e.scalar('SELECT count(*) FROM app.sessions WHERE player_id=%s',(ADA,))==0
    status(e.api('POST','/auth/login',{'username':'Ada','password':PASSWORD}),401,'INVALID_CREDENTIALS')
    login(e,password='NewPassword123!')
    status(e.api('POST','/account/delete',{'current_password':'wrong'},ADA),403,'CURRENT_PASSWORD_INCORRECT')
    status(e.api('POST','/account/delete',{'current_password':'NewPassword123!'},ADA),204)
    assert e.scalar('SELECT count(*) FROM app.players WHERE id=%s',(ADA,))==0
    assert e.scalar('SELECT count(*) FROM app.records WHERE player_id=%s',(ADA,))==0
    assert e.scalar('SELECT count(*) FROM app.records WHERE player_id=%s',(NORA,))==4


@check('TBE-03-records','KAPI-2',('db','api'))
def records(e):
    e.rows('DELETE FROM app.records WHERE player_id=%s',(ADA,))
    for game,values,expected in ((POINTS,[100,80,120,110],[100,120]),(SPRINT,[60000,65000,55000,58000],[60000,55000])):
        for index,value in enumerate(values):
            response=e.api('POST',f'/games/{game}/results',{'value':value},ADA)
            body=status(response,201 if index in (0,2) else 200)
            assert body['outcome']==('created' if index in (0,2) else 'not_improved')
        assert [row[0] for row in e.rows('SELECT value FROM app.records WHERE player_id=%s AND game_id=%s ORDER BY created_at,id',(ADA,game))]==expected
        duplicate=status(e.api('POST',f'/games/{game}/results',{'value':values[0]},ADA),200)
        assert duplicate['outcome']=='already_recorded'
        assert duplicate['record']['value']==expected[0] and duplicate['current_record']['value']==expected[-1]
    e.rows('UPDATE app.games SET is_active=false WHERE id=%s',(POINTS,))
    status(e.api('POST',f'/games/{POINTS}/results',{'value':200},ADA),409,'GAME_INACTIVE')


@check('TBE-05-concurrent-records','KAPI-2',('db','api'))
def concurrent_records(e):
    barrier=threading.Barrier(8)
    values=[150,150,130,140,150,135,145,150]
    def submit(value):
        barrier.wait(timeout=5)
        return e.api('POST',f'/games/{POINTS}/results',{'value':value},ADA)
    with ThreadPoolExecutor(max_workers=8) as pool: results=list(pool.map(submit,values))
    assert all(response[0] in (200,201) for response in results)
    history=[row[0] for row in e.rows('SELECT value FROM app.records WHERE player_id=%s AND game_id=%s ORDER BY created_at,id',(ADA,POINTS))]
    assert history[:2]==[100,120] and history[-1]==150
    assert all(a<b for a,b in zip(history,history[1:]))
    assert len(history)==len(set(history))


@check('TBE-04-public','KAPI-3',('db','api'))
def public(e):
    from uuid import UUID
    third=str(UUID(int=999))
    e.rows("INSERT INTO app.players(id,username,password_hash,created_at) VALUES (%s,'Third','synthetic',now())",(third,))
    e.rows('INSERT INTO app.records(id,player_id,game_id,value,created_at) VALUES (%s,%s,%s,120,now())',(str(uuid4()),third,POINTS))
    board=status(e.api('GET',f'/games/{POINTS}/leaderboard'),200)
    assert [x['rank'] for x in board['items']]==[1,1,3]
    assert [x['player']['id'] for x in board['items'][:2]]==sorted([ADA,third])
    page=status(e.api('GET',f'/games/{POINTS}/leaderboard?page=1&page_size=2'),200)
    assert page['total']==3 and page['items'][0]['rank']==3
    board=status(e.api('GET',f'/games/{SPRINT}/leaderboard'),200)
    assert [x['record']['value'] for x in board['items']]==[55000,58000]
    history=status(e.api('GET',f'/players/{ADA}/games/{POINTS}/records'),200)
    assert [row['value'] for row in history['items']]==[100,120]
    e.rows('UPDATE app.games SET is_active=false WHERE id=%s',(POINTS,))
    status(e.api('GET',f'/games/{POINTS}'),200)
    status(e.api('GET',f'/players/{uuid4()}'),404,'NOT_FOUND')
    empty=status(e.api('GET',f'/players/{third}/games/{SPRINT}/records'),200)
    assert empty['items']==[] and empty['total']==0
    for payload in (board,history,empty):
        import json
        encoded=json.dumps(payload)
        assert all(name not in encoded for name in ('password_hash','token_hash','sessions'))


@check('TBE-01-07-input','KAPI-4',('db','api'))
def bad_input(e):
    path=f'/games/{POINTS}/results'
    status(e.api('POST',path,{'value':130}),401,'AUTH_REQUIRED')
    for value in (True,1.5,'130',None,-1,100001,9007199254740992):
        response=e.api('POST',path,{'value':value},ADA)
        assert response[0]==400
        assert response[2]['error']['code'] in ('INVALID_REQUEST','INVALID_RESULT')
    status(e.api('POST',path,{'value':130,'player_id':NORA},ADA),400,'INVALID_REQUEST')
    status(e.api('POST',path,{'value':130},ADA,{'Origin':'https://foreign.invalid'}),403,'FORBIDDEN')
    status(e.api('POST',path,{'value':130},ADA,{'X-MBG-Request':''}),403,'FORBIDDEN')
    for origin in (None,'null'):
        status(e.api('POST',path,{'value':130},ADA,{'Origin':origin}),403,'FORBIDDEN')
    status(e.api('POST','/ai/questions',{'question':'Vis min utvikling'}),401,'AUTH_REQUIRED')
    status(e.api('POST','/ai/questions',{'question':'Vis min utvikling','player_id':NORA},ADA),400,'INVALID_REQUEST')
    status(e.api('POST',path,'x'*17000,ADA,{'Content-Type':'application/json'}),413,'REQUEST_TOO_LARGE')
    status(e.api('POST',path,'value=130',ADA,{'Content-Type':'text/plain'}),415,'UNSUPPORTED_MEDIA_TYPE')
    status(e.api('GET','/games?page=-1'),400,'INVALID_REQUEST')
    status(e.api('PUT','/games'),405,'METHOD_NOT_ALLOWED')
    assert e.scalar('SELECT count(*) FROM app.records')==8
    status(e.api('POST',path,{'value':130},ADA,{'Origin':None,'Referer':e.origin+'/index.html'}),201)


@check('TBE-07-rate-limit','KAPI-4',('db','api'))
def rate_limit(e):
    for _ in range(10):
        status(e.api('POST','/auth/login',{'username':'Ada','password':'wrong'}),401,'INVALID_CREDENTIALS')
    response=e.api('POST','/auth/login',{'username':'Ada','password':'wrong'})
    status(response,429,'RATE_LIMITED')
    assert int(response[1]['retry-after'])>=1


@check('TBE-05-unknown-commit','KAPI-2',('db','api'))
def unknown_commit(e):
    e.db_proxy.triggered.clear();e.db_proxy.arm.set()
    try:
        response=e.api('POST',f'/games/{POINTS}/results',{'value':180},ADA)
        assert e.db_proxy.triggered.is_set(), 'Feilinjeksjonen nådde ikke COMMIT etter innsetting.'
        status(response,503,'OUTCOME_UNKNOWN')
        assert e.scalar('SELECT count(*) FROM app.records WHERE player_id=%s AND game_id=%s AND value=180',(ADA,POINTS))==1
        again=status(e.api('POST',f'/games/{POINTS}/results',{'value':180},ADA),200)
        assert again['outcome']=='already_recorded'
        assert e.scalar('SELECT count(*) FROM app.records WHERE player_id=%s AND game_id=%s AND value=180',(ADA,POINTS))==1
    finally:e.db_proxy.arm.clear()


@check('TBE-05-revocation-race','KAPI-2',('db','api'))
def revocation_race(e):
    import time
    with ThreadPoolExecutor(max_workers=1) as pool:
        with e.connect() as conn:
            with conn.transaction():
                conn.execute('SELECT id FROM app.players WHERE id=%s FOR UPDATE',(ADA,))
                pending=pool.submit(e.api,'POST',f'/games/{POINTS}/results',{'value':190},ADA)
                deadline=time.monotonic()+.35
                while time.monotonic()<deadline:
                    waiting=e.scalar("SELECT count(*) FROM pg_stat_activity WHERE usename='backend_app' AND wait_event_type='Lock'")
                    if waiting:break
                    time.sleep(.01)
                assert waiting,'Innsendingen ventet ikke på spillerlåsen.'
                conn.execute('DELETE FROM app.sessions WHERE player_id=%s',(ADA,))
            response=pending.result(timeout=5)
        status(response,401,'AUTH_REQUIRED')
    assert e.scalar('SELECT max(value) FROM app.records WHERE player_id=%s AND game_id=%s',(ADA,POINTS))==120


@check('TBE-09-db-outage','DRIFT',('db','api'))
def database_outage(e):
    e.pg_stop()
    try:status(e.api('GET','/health'),503,'SERVICE_UNAVAILABLE')
    finally:e.pg_start()
    import time
    deadline=time.monotonic()+10
    while time.monotonic()<deadline:
        if e.api('GET','/health')[0]==200:return
        time.sleep(.2)
    raise AssertionError('API ble ikke klart igjen etter DB-tilkoblingen kom tilbake.')
