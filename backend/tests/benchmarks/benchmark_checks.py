"""Fixed open-loop benchmark: timing starts at the server, not across SSH."""
from concurrent.futures import ThreadPoolExecutor
import json
import math
from pathlib import Path
import re
import threading
import time
from check_registry import check
from harness import ADA, POINTS, MODEL, request, Blocked, attempt_payload
from process_metrics import process_metrics


def percentile(values, fraction=.95):
    if not values: return None
    values=sorted(values)
    return values[max(0,math.ceil(len(values)*fraction)-1)]


def summarize(samples):
    groups={}
    for op in ('leaderboard','session','result'):
        rows=[s for s in samples if s['operation']==op]
        groups[op]={'count':len(rows),'errors':sum(s['error'] is not None for s in rows),
                    'http_p95_ms':percentile([s['http_ms'] for s in rows]),
                    'db_p95_ms':percentile([s['db_ms'] for s in rows if s['db_ms'] is not None]),
                    'db_missing':sum(s['db_ms'] is None for s in rows),
                    'max_dispatch_lag_ms':max((s['dispatch_lag_ms'] for s in rows),default=None)}
    return groups


def sample(e,index,operation,scheduled,player_index=None):
    player_index=index%30 if player_index is None else player_index
    player=e.players[player_index][0];game=e.games[player_index%10][0]
    start=time.perf_counter();db_ms=None;error=None;code=None;http_ms=None;payload=None
    try:
        if operation=='leaderboard':
            method,path='GET',f'/games/{game}/leaderboard?page_size=30'
            response=e.api(method,path,timeout=10,validate_response=False)
        elif operation=='session':
            method,path='GET','/auth/session'
            response=e.api(method,path,player=player,timeout=10,validate_response=False)
        else:
            method,path='POST',f'/games/{game}/results'
            value=50000-index if player_index%10==1 else 1000+index
            payload=attempt_payload(value)
            response=e.api(method,path,payload,player,timeout=10,validate_response=False)
        http_ms=(time.perf_counter()-start)*1000
        code,headers,body=response
        if code != (201 if operation=='result' else 200):error='HTTP_'+str(code)
        # Required test instrumentation measures backend request for DB operation
        # (including pool wait) through committed completion, per contract 1.4.
        match=re.search(r'(?:^|,)\s*db\s*;\s*dur=([0-9]+(?:\.[0-9]+)?)',headers.get('server-timing',''))
        if match:db_ms=float(match.group(1))
        from protocol_checks import validate
        validate(method,path,response)
        if operation=='session' and code==200 and body['player']['id']!=player:error='WRONG_PLAYER'
        if operation=='result' and code in (200,201):
            attempt=body['attempt']
            if (attempt['player_id'],attempt['game_id'],attempt['id'],attempt['status'],attempt['value']) != (
                    player,game,payload['attempt_id'],'completed',value):error='WRONG_ATTEMPT'
            if body['current_record']['player_id']!=player:error='WRONG_PLAYER'
    except Exception as exc:error=type(exc).__name__
    return {'operation':operation,'http_ms':http_ms if http_ms is not None else (time.perf_counter()-start)*1000,'db_ms':db_ms,
            'dispatch_lag_ms':max(0,start-scheduled)*1000,'status':code,'error':error,
            'attempt_id':payload['attempt_id'] if payload else None}


def workload(e,seconds,offset=0):
    start=time.perf_counter();futures=[]
    pattern=['leaderboard']*6+['session']*2+['result']*2
    with ThreadPoolExecutor(max_workers=30) as pool:
        for index in range(int(seconds*6)):
            planned=start+index/6
            time.sleep(max(0,planned-time.perf_counter()))
            futures.append(pool.submit(sample,e,offset+index,pattern[index%10],planned))
    return [future.result() for future in futures]


def resources(e):
    # Enumerate PostgreSQL's children directly; opening an inspection connection
    # first creates another short-lived process while /proc is being sampled.
    measured=process_metrics(e.processes.get('api'), e.work/'pg/postmaster.pid')
    roles=e.rows("SELECT usename,count(*),count(*) FILTER (WHERE xact_start IS NOT NULL) FROM pg_stat_activity WHERE usename IN ('backend_app','ai_reader') GROUP BY usename")
    return {**measured,'roles':{name:{'connections':n,'transactions':tx} for name,n,tx in roles}}


@check('BENCH-HTTP-DB','BENCH',('db','api'),slow=True)
def http_db(e):
    all_results={}
    for phase in ('without_ai','with_ai'):
        if phase=='with_ai':
            e.require('ai');real_model_metadata(e)
        e.reset_data(large=True)
        fixture_counts=dict(e.fixture_counts)
        e.ai_relay.reset();e.model_relay.reset()
        samples=[];stop=threading.Event();ai_calls=[]
        def monitor():
            while not stop.is_set():
                try:samples.append(resources(e))
                except Exception as exc:samples.append({'error':type(exc).__name__})
                stop.wait(1)
        def ai_load():
            while not stop.is_set():
                start=time.perf_counter()
                try:
                    response=e.ai('Hvilke spill finnes?',player_id=e.players[0][0])
                    ai_calls.append({'status':response[0],'seconds':time.perf_counter()-start})
                except Exception as exc:ai_calls.append({'error':type(exc).__name__})
                stop.wait(.1)
        threads=[threading.Thread(target=monitor,daemon=True)]
        if phase=='with_ai':threads.append(threading.Thread(target=ai_load,daemon=True))
        for thread in threads:thread.start()
        try:
            print(f'  Benchmark {phase}: 2 min oppvarming + 15 min måling.',flush=True)
            warm=workload(e,120)
            normal=workload(e,900,720)
            peaks=[]
            next_index=6120
            for operation in ('leaderboard','session','result'):
                for repetition in range(10):
                    barrier=threading.Barrier(30)
                    def burst(i):
                        barrier.wait(timeout=5)
                        return sample(e,next_index+i,operation,time.perf_counter(),0 if operation=='result' and repetition%2==0 else i)
                    with ThreadPoolExecutor(max_workers=30) as pool:peaks.extend(pool.map(burst,range(30)))
                    next_index+=30
            all_results[phase]={'fixture_counts':fixture_counts,
                                'warmup':warm,'normal':normal,'peaks':peaks,'summary':summarize(normal),
                                'resource_samples':samples,'ai_calls':ai_calls}
            e.measurements['http_db']=all_results
        finally:
            stop.set()
            for thread in threads:thread.join(timeout=66)
        time.sleep(3)
        all_results[phase]['open_transactions_after_drain']=e.scalar("SELECT count(*) FROM pg_stat_activity WHERE usename IN ('backend_app','ai_reader') AND xact_start IS NOT NULL")
        all_results[phase]['final_counts']={table:e.scalar(f'SELECT count(*) FROM app.{table}')
                                           for table in ('records','attempts')}
    # Evaluate only after both phases have been recorded, including regressions.
    assessment=assess_http_db(all_results)
    e.measurements['http_db_assessment']=assessment
    if assessment['missing']:
        error=Blocked('Målinger mangler: '+'; '.join(assessment['missing'])+
                      '. Påviste avvik: '+('; '.join(assessment['failures']) or 'ingen'))
        error.observed_failures=len(assessment['failures'])
        raise error
    assert not assessment['failures'], '; '.join(assessment['failures'])


def assess_http_db(all_results):
    """Keep missing evidence and measured failures separate; neither hides the other."""
    missing=[];failures=[]
    if not any(row.get('status')==200 for row in all_results.get('with_ai',{}).get('ai_calls',[])):
        failures.append('Ingen vellykkede AI-kall under belastning')
    for phase in ('without_ai','with_ai'):
        if phase not in all_results:
            missing.append(phase);continue
        result=all_results[phase]
        for op,group in result['summary'].items():
            label=phase+'/'+op
            if not group['count']:missing.append(label+' uten målinger');continue
            if group['errors']:failures.append(label+' HTTP-feil')
            if group['http_p95_ms']>500:failures.append(label+' HTTP p95 > 500 ms')
            if group['db_missing']:missing.append(label+' DB-timing')
            elif group['db_p95_ms']>200:failures.append(label+' DB p95 > 200 ms')
        if not result['peaks']:missing.append(phase+' topper')
        if any(s['error'] is not None for s in result['peaks']):failures.append(phase+' feil under topper')
        if any(s['db_ms'] is None for s in result['peaks']):missing.append(phase+' DB-timing i topper')
        if any(s['db_ms']>1000 for s in result['peaks'] if s['db_ms'] is not None):failures.append(phase+' DB-topp > 1000 ms')
        if not result['resource_samples']:missing.append(phase+' ressursmålinger')
        for snap in result['resource_samples']:
            if 'error' in snap:missing.append(phase+' ressursuttrekk');continue
            if snap['process_pss_bytes'] is None:missing.append(phase+' PSS')
            elif snap['process_pss_bytes']>2*1024**3:failures.append(phase+' PSS > 2 GiB')
            if snap['roles'].get('backend_app',{}).get('connections',0)>5:failures.append(phase+' API-pool > 5')
            if snap['roles'].get('ai_reader',{}).get('connections',0)>1:failures.append(phase+' AI-pool > 1')
        remaining=result.get('open_transactions_after_drain')
        if remaining is None:missing.append(phase+' transaksjonskontroll')
        elif remaining:failures.append(phase+' åpne transaksjoner etter 3 s')
    return {'missing':sorted(set(missing)),'failures':sorted(set(failures))}


def real_model_metadata(e):
    if not e.ollama_ready:raise Blocked(e.notes.get('ollama','Isolert modellkjøring er ikke klar.'))
    url=e.ollama_url
    try:
        code,_,models=request(url+'/api/tags',timeout=5)
        version=request(url+'/api/version',timeout=5)
    except OSError as exc:raise Blocked('Ollama er ikke tilgjengelig lokalt.') from exc
    model=e.config.get('model',MODEL)
    entries=[entry for entry in models.get('models',[]) if entry.get('name')==model or entry.get('model')==model]
    if code!=200 or not entries:raise Blocked('Den avtalte lokale modellen er ikke installert.')
    if not entries[0].get('digest'):raise Blocked('Ollama oppga ingen modelldigest.')
    e.model_digest=entries[0]['digest']
    e.measurements['model']={'name':model,'digest':e.model_digest,'runtime':version[2],
                             'options':{'num_ctx':4096,'num_predict':512}}
    return url,model


@check('TAI-02-08-real-model','KAI-4',('db','ai'),slow=True)
def real_ai(e):
    url,model=real_model_metadata(e)
    e.model_relay.reset()
    # Unload explicitly so that "cold" isn't just a label on an already loaded model.
    code,_,_=request(url+'/api/generate','POST',{'model':model,'keep_alive':0},timeout=30)
    if code!=200:raise Blocked('Kunne ikke etablere kald modellstart.')
    questions=['Hvordan har jeg utviklet meg i Poengjakt?',
               'Hvordan ligger jeg an mot Nora i Sprint?',
               'Hvilke spill har Nora rekorder i?']
    samples=[];e.measurements['ai']=samples
    for phase,rounds in (('cold',1),('warm',3)):
        selected=questions[:1] if phase=='cold' else questions
        for round_index in range(rounds):
            for question in selected:
                start=time.perf_counter()
                try:
                    response=e.ai(question,game_id=POINTS)
                    seconds=time.perf_counter()-start
                    code,_,body=response
                    valid=code==200 and isinstance(body,dict) and set(body)=={'request_id','status','answer'}
                    valid=valid and body['status']=='ok' and body['request_id']=='33333333-3333-4333-8333-333333333333'
                    valid=valid and isinstance(body['answer'],str) and 1<=len(body['answer'])<=4000
                    samples.append({'phase':phase,'round':round_index,'question':question,'seconds':seconds,'status':code,
                                    'valid':bool(valid),'answer':body.get('answer') if isinstance(body,dict) else None})
                except Exception as exc:samples.append({'phase':phase,'round':round_index,'question':question,
                                                        'seconds':time.perf_counter()-start,'valid':False,'error':type(exc).__name__})
    assert e.model_relay.calls, 'Ingen faktiske modellkall ble observert.'
    for call in e.model_relay.calls:
        if call['path']=='/api/chat':
            assert call['body']['model']==model
            assert call['body']['options']['num_ctx']==4096
            assert call['body']['options']['num_predict']==512
    e.measurements['ollama_loaded']=request(url+'/api/ps',timeout=5)[2]
    assert all(s['valid'] and s['seconds']<=60 for s in samples)
