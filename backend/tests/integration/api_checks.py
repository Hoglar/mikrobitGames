"""Black-box HTTP + independent SQL inspection, without frontend/Micro:bit."""
from concurrent.futures import ThreadPoolExecutor
import hashlib
import threading
from uuid import uuid4
from check_registry import check
from harness import ADA, NORA, POINTS, SPRINT, PASSWORD, attempt_payload


def status(response, expected, code=None):
    actual,headers,body=response
    assert actual==expected, f'HTTP {actual}, forventet {expected}'
    if code:
        assert body['error']['code']==code
        assert body['request_id']==headers['x-request-id']
        assert 'no-store' in headers.get('cache-control','')
    return body


def result(e, game, payload, player=ADA, expected=201):
    body=status(e.api('POST',f'/games/{game}/results',payload,player),expected)
    attempt=body['attempt']
    assert (attempt['id'],attempt['player_id'],attempt['game_id'],attempt['status'],attempt['value']) == (
        payload['attempt_id'],player,game,payload['status'],payload['value'])
    assert body['outcome']==attempt['record_outcome']
    record=body['record']
    assert attempt['record_id']==(record['id'] if record else None)
    if record:
        assert (record['player_id'],record['game_id'],record['value'])==(player,game,payload['value'])
    if body['current_record']:
        assert (body['current_record']['player_id'],body['current_record']['game_id'])==(player,game)
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
    status(e.api('POST',f'/games/{POINTS}/results',attempt_payload(130),ADA),401,'AUTH_REQUIRED')
    assert e.scalar('SELECT max(value) FROM app.records WHERE player_id=%s AND game_id=%s',(ADA,POINTS))==120
    assert e.scalar('SELECT count(*) FROM app.attempts')==8


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
    assert e.scalar('SELECT count(*) FROM app.attempts WHERE player_id=%s',(ADA,))==0
    assert e.scalar('SELECT count(*) FROM app.attempts WHERE player_id=%s',(NORA,))==4


@check('TBE-03-records','KAPI-2',('db','api'))
def records(e):
    e.rows('DELETE FROM app.attempts WHERE player_id=%s',(ADA,))
    e.rows('DELETE FROM app.records WHERE player_id=%s',(ADA,))
    for game,values,expected in ((POINTS,[100,80,120,110],[100,120]),(SPRINT,[60000,65000,55000,58000],[60000,55000])):
        submitted=[]
        for index,value in enumerate(values):
            payload=attempt_payload(value)
            body=result(e,game,payload)
            submitted.append((payload,body))
            assert body['outcome']==('created' if index in (0,2) else 'not_improved')
        assert [row[0] for row in e.rows('SELECT value FROM app.records WHERE player_id=%s AND game_id=%s ORDER BY created_at,id',(ADA,game))]==expected
        assert e.scalar('SELECT count(*) FROM app.attempts WHERE player_id=%s AND game_id=%s',(ADA,game))==4
        for payload,original in submitted:
            replay=result(e,game,payload,expected=200)
            for key in ('attempt','outcome','record'):
                assert replay[key]==original[key], 'Omforsøk endret opprinnelig utfall'
            assert replay['current_record']['value']==expected[-1]
        duplicate_payload=attempt_payload(values[0])
        duplicate=result(e,game,duplicate_payload)
        assert duplicate['outcome']=='already_recorded'
        assert duplicate['record']['value']==expected[0] and duplicate['current_record']['value']==expected[-1]
        assert result(e,game,duplicate_payload,expected=200)==duplicate
        assert e.scalar('SELECT count(*) FROM app.attempts WHERE player_id=%s AND game_id=%s',(ADA,game))==5


@check('TBE-03-incomplete','KAPI-2',('db','api'))
def incomplete(e):
    e.rows('DELETE FROM app.attempts WHERE player_id=%s',(ADA,))
    e.rows('DELETE FROM app.records WHERE player_id=%s',(ADA,))
    for game,value in ((POINTS,None),(POINTS,9007199254740991),(SPRINT,0)):
        payload=attempt_payload(value,'incomplete')
        body=result(e,game,payload)
        assert body['outcome']=='not_eligible'
        assert body['record'] is None and body['current_record'] is None
        assert result(e,game,payload,expected=200)==body
    assert e.scalar('SELECT count(*) FROM app.attempts WHERE player_id=%s',(ADA,))==3
    assert e.scalar('SELECT count(*) FROM app.records WHERE player_id=%s',(ADA,))==0
    result(e,POINTS,attempt_payload(120))
    body=result(e,POINTS,attempt_payload(500,'incomplete'))
    assert body['outcome']=='not_eligible' and body['record'] is None
    assert body['current_record']['value']==120


@check('TBE-05-retry-conflict','KAPI-2',('db','api'))
def retry_conflict(e):
    payload=attempt_payload(150)
    original=result(e,POINTS,payload)
    result(e,POINTS,attempt_payload(170))
    e.rows('UPDATE app.games SET is_active=false WHERE id=%s',(POINTS,))
    replay=result(e,POINTS,payload,expected=200)
    assert replay['attempt']==original['attempt'] and replay['record']==original['record']
    assert replay['outcome']=='created' and replay['current_record']['value']==170
    for game,changed in ((POINTS,dict(payload,value=200)),(POINTS,dict(payload,status='incomplete')),
                         (SPRINT,payload)):
        status(e.api('POST',f'/games/{game}/results',changed,ADA),409,'ATTEMPT_CONFLICT')
    status(e.api('POST',f'/games/{POINTS}/results',attempt_payload(200),ADA),409,'GAME_INACTIVE')
    assert e.scalar('SELECT count(*) FROM app.attempts')==10
    assert e.scalar('SELECT count(*) FROM app.records')==10


@check('TBE-05-concurrent-records','KAPI-2',('db','api'))
def concurrent_records(e):
    barrier=threading.Barrier(8)
    values=[150,150,130,140,150,135,145,150]
    def submit(value):
        barrier.wait(timeout=5)
        return e.api('POST',f'/games/{POINTS}/results',attempt_payload(value),ADA)
    with ThreadPoolExecutor(max_workers=8) as pool: results=list(pool.map(submit,values))
    assert all(response[0]==201 for response in results)
    assert e.scalar('SELECT count(*) FROM app.attempts')==16
    history=[row[0] for row in e.rows('SELECT value FROM app.records WHERE player_id=%s AND game_id=%s ORDER BY created_at,id',(ADA,POINTS))]
    assert history[:2]==[100,120] and history[-1]==150
    assert all(a<b for a,b in zip(history,history[1:]))
    assert len(history)==len(set(history))


@check('TBE-05-concurrent-replay','KAPI-2',('db','api'))
def concurrent_replay(e):
    payload=attempt_payload(180)
    barrier=threading.Barrier(8)
    def submit(_):
        barrier.wait(timeout=5)
        return e.api('POST',f'/games/{POINTS}/results',payload,ADA)
    with ThreadPoolExecutor(max_workers=8) as pool:responses=list(pool.map(submit,range(8)))
    assert sorted(r[0] for r in responses)==[200]*7+[201]
    assert all(r[2]==responses[0][2] for r in responses)
    assert e.scalar('SELECT count(*) FROM app.attempts WHERE player_id=%s AND id=%s',(ADA,payload['attempt_id']))==1
    assert e.scalar('SELECT count(*) FROM app.records WHERE player_id=%s AND game_id=%s AND value=180',(ADA,POINTS))==1


@check('TBE-05-atomic-attempt-record','KAPI-2',('db','api'))
def atomic_attempt_record(e):
    # Inject failure on the second insert in the harness-owned database only.
    e.rows("""CREATE FUNCTION app.test_reject_attempt() RETURNS trigger LANGUAGE plpgsql AS
              $$ BEGIN RAISE EXCEPTION 'synthetic attempt failure' USING ERRCODE='23514'; END $$""")
    try:
        e.rows('CREATE TRIGGER test_reject_attempt BEFORE INSERT ON app.attempts FOR EACH ROW EXECUTE FUNCTION app.test_reject_attempt()')
        response=e.api('POST',f'/games/{POINTS}/results',attempt_payload(180),ADA)
        assert response[0]>=400, 'Feilet lagring ble bekreftet som vellykket'
        assert e.scalar('SELECT count(*) FROM app.records')==8, 'Rekord ble lagret uten forsøket'
        assert e.scalar('SELECT count(*) FROM app.attempts')==8
    finally:
        e.rows('DROP TRIGGER IF EXISTS test_reject_attempt ON app.attempts')
        e.rows('DROP FUNCTION app.test_reject_attempt()')


@check('TBE-04-private-history','KAPI-3',('db','api'))
def private_history(e):
    path='/account/results'
    own=status(e.api('GET',path,player=ADA),200)
    assert own['total']==4 and len(own['items'])==4
    assert all(item['player_id']==ADA for item in own['items'])
    from datetime import datetime
    keys=[(datetime.fromisoformat(item['created_at'].replace('Z','+00:00')),item['id']) for item in own['items']]
    assert keys==sorted(keys,reverse=True)
    filtered=status(e.api('GET',path+f'?game_id={POINTS}',player=ADA),200)
    assert filtered['total']==2 and [a['value'] for a in filtered['items']]==[120,100]
    pages=[status(e.api('GET',path+f'?page={page}&page_size=2',player=ADA),200) for page in (0,1,2)]
    assert all(page['total']==4 for page in pages)
    assert pages[0]['items']+pages[1]['items']==own['items'] and pages[2]['items']==[]
    attempt_id=own['items'][0]['id']
    assert status(e.api('GET',path+'/'+attempt_id,player=ADA),200)==own['items'][0]
    for route in (path,path+'/'+attempt_id):
        status(e.api('GET',route),401,'AUTH_REQUIRED')
    for unknown in (attempt_id,str(uuid4())):
        status(e.api('GET',path+'/'+unknown,player=NORA),404,'NOT_FOUND')
    for query in ('page=-1','page_size=101','game_id=invalid','player_id='+NORA):
        status(e.api('GET',path+'?'+query,player=ADA),400,'INVALID_REQUEST')
    status(e.api('GET',path+'?game_id='+str(uuid4()),player=ADA),404,'NOT_FOUND')
    e.rows('UPDATE app.games SET is_active=false WHERE id=%s',(POINTS,))
    assert status(e.api('GET',path+f'?game_id={POINTS}',player=ADA),200)==filtered
    # Client UUIDs are scoped to the owner, not globally reserved by another account.
    result(e,SPRINT,attempt_payload(None,'incomplete',attempt_id),player=NORA)
    other=status(e.api('GET',path+'/'+attempt_id,player=NORA),200)
    assert other['player_id']==NORA and other['status']=='incomplete'
    assert status(e.api('GET',path+'/'+attempt_id,player=ADA),200)==own['items'][0]
    player=status(e.api('POST','/auth/register',{'username':'NoHistory','password':PASSWORD}),201)
    login(e,'NoHistory')
    for route in (path,path+f'?game_id={SPRINT}'):
        empty=status(e.api('GET',route,player=player['id']),200)
        assert empty['items']==[] and empty['total']==0


@check('TBE-04-public','KAPI-3',('db','api'))
def public(e):
    from uuid import UUID
    third=str(UUID(int=999))
    e.rows("INSERT INTO app.players(id,username,password_hash,created_at) VALUES (%s,'Third','synthetic',now())",(third,))
    # Create the tied score through the API so the public fixture also has its private attempt.
    e.rows('UPDATE app.players SET password_hash=(SELECT password_hash FROM app.players WHERE id=%s) WHERE id=%s',(ADA,third))
    login(e,'Third')
    result(e,POINTS,attempt_payload(120),player=third)
    result(e,POINTS,attempt_payload(100),player=NORA)
    result(e,POINTS,attempt_payload(900000,'incomplete'),player=NORA)
    board=status(e.api('GET',f'/games/{POINTS}/leaderboard'),200)
    assert [x['rank'] for x in board['items']]==[1,1,3]
    assert [x['record']['value'] for x in board['items']]==[120,120,115]
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
        assert all(name not in encoded for name in ('password_hash','token_hash','sessions','attempt_id','record_outcome','attempts'))


@check('TBE-01-07-input','KAPI-4',('db','api'))
def bad_input(e):
    path=f'/games/{POINTS}/results'
    payload=attempt_payload(130)
    status(e.api('POST',path,payload),401,'AUTH_REQUIRED')
    for value in (True,1.5,'130',None,-1,100001,9007199254740992):
        response=e.api('POST',path,attempt_payload(value),ADA)
        assert response[0]==400
        assert response[2]['error']['code'] in ('INVALID_REQUEST','INVALID_RESULT')
    for value in (True,1.5,'130',-1,9007199254740992):
        response=e.api('POST',path,attempt_payload(value,'incomplete'),ADA)
        assert response[0]==400 and response[2]['error']['code'] in ('INVALID_REQUEST','INVALID_RESULT')
    invalid=[{k:v for k,v in payload.items() if k!=missing} for missing in payload]
    invalid += [dict(payload,attempt_id='invalid'),dict(payload,status='unknown'),dict(payload,player_id=NORA)]
    for body in invalid:
        status(e.api('POST',path,body,ADA),400,'INVALID_REQUEST')
    status(e.api('POST',path,payload,ADA,{'Origin':'https://foreign.invalid'}),403,'FORBIDDEN')
    status(e.api('POST',path,payload,ADA,{'X-MBG-Request':''}),403,'FORBIDDEN')
    for origin in (None,'null'):
        status(e.api('POST',path,payload,ADA,{'Origin':origin}),403,'FORBIDDEN')
    status(e.api('POST','/ai/questions',{'question':'Vis min utvikling'}),401,'AUTH_REQUIRED')
    status(e.api('POST','/ai/questions',{'question':'Vis min utvikling','player_id':NORA},ADA),400,'INVALID_REQUEST')
    status(e.api('POST',path,'x'*17000,ADA,{'Content-Type':'application/json'}),413,'REQUEST_TOO_LARGE')
    status(e.api('POST',path,'value=130',ADA,{'Content-Type':'text/plain'}),415,'UNSUPPORTED_MEDIA_TYPE')
    status(e.api('GET','/games?page=-1'),400,'INVALID_REQUEST')
    status(e.api('PUT','/games'),405,'METHOD_NOT_ALLOWED')
    assert e.scalar('SELECT count(*) FROM app.records')==8
    assert e.scalar('SELECT count(*) FROM app.attempts')==8
    status(e.api('POST',path,payload,ADA,{'Origin':None,'Referer':e.origin+'/index.html'}),201)


@check('TBE-07-rate-limit','KAPI-4',('db','api'))
def rate_limit(e):
    for _ in range(10):
        status(e.api('POST','/auth/login',{'username':'Ada','password':'wrong'}),401,'INVALID_CREDENTIALS')
    response=e.api('POST','/auth/login',{'username':'Ada','password':'wrong'})
    status(response,429,'RATE_LIMITED')
    assert int(response[1]['retry-after'])>=1


@check('TBE-05-unknown-commit','KAPI-2',('db','api'))
def unknown_commit(e):
    for value,attempt_status,outcome in ((180,'completed','created'),(None,'incomplete','not_eligible')):
        payload=attempt_payload(value,attempt_status)
        e.db_proxy.triggered.clear();e.db_proxy.arm.set()
        try:
            response=e.api('POST',f'/games/{POINTS}/results',payload,ADA)
            assert e.db_proxy.triggered.is_set(), 'Feilinjeksjonen nådde ikke COMMIT etter innsetting.'
            status(response,503,'OUTCOME_UNKNOWN')
            assert e.scalar('SELECT count(*) FROM app.attempts WHERE player_id=%s AND id=%s',(ADA,payload['attempt_id']))==1
            again=result(e,POINTS,payload,expected=200)
            assert again['outcome']==outcome
            assert e.scalar('SELECT count(*) FROM app.attempts WHERE player_id=%s AND id=%s',(ADA,payload['attempt_id']))==1
            assert e.scalar('SELECT count(*) FROM app.records WHERE player_id=%s AND game_id=%s AND value=180',(ADA,POINTS))==1
        finally:e.db_proxy.arm.clear()


@check('TBE-05-revocation-race','KAPI-2',('db','api'))
def revocation_race(e):
    import time
    with ThreadPoolExecutor(max_workers=1) as pool:
        with e.connect() as conn:
            with conn.transaction():
                conn.execute('SELECT id FROM app.players WHERE id=%s FOR UPDATE',(ADA,))
                pending=pool.submit(e.api,'POST',f'/games/{POINTS}/results',attempt_payload(190),ADA)
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
    assert e.scalar('SELECT count(*) FROM app.attempts')==8


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
