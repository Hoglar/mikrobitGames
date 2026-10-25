"""Run every registered check, retain failures, and always stop test services."""
import importlib
import json
from pathlib import Path
import sys
import time
from check_registry import CASES
from controls import REQUIREMENT_IDS, MODEL_IDS, aggregate, fom
from harness import Environment, Blocked, ROOT


def load_cases():
    for directory in ('integration','benchmarks'):
        path=str(ROOT/'backend/tests'/directory)
        if path not in sys.path:sys.path.insert(0,path)
    for name in ('database_checks','api_checks','ai_checks','benchmark_checks'):
        importlib.import_module(name)
    return CASES


def unit_group(id):
    if 'test_auth_rules' in id:return 'KAPI-1'
    if 'test_score_rules' in id:
        return 'KAPI-3' if 'ranking' in id or 'tie_order' in id else 'KAPI-2'
    if 'test_query_policy' in id:return 'KAI-2'
    if 'test_ai_response' in id:return 'KAI-1'
    return None


def execute(config, mode, unit_rows):
    cases=load_cases();rows=[];measurements={};model_rows={}
    environment=Environment(config, real_model=mode=='full')
    setup_error=None
    try:
        try:environment.start()
        except Blocked as exc:setup_error=str(exc)
        except Exception as exc:setup_error='Oppsett feilet: '+type(exc).__name__+': '+str(exc)
        for case in cases:
            row={'id':case.id,'group':case.group,'status':'BLOCKED','detail':''}
            start=time.perf_counter()
            try:
                if mode=='quick' and case.slow:
                    row.update(status='SKIPPED',detail='Lang kontroll inngår i full kjøring.')
                    continue
                if setup_error:raise Blocked(setup_error)
                environment.reset()
                environment.require(*case.needs)
                print('  '+case.id,flush=True)
                case.function(environment)
                row['status']='PASS'
            except Blocked as exc:
                row['detail']=str(exc)
                row['observed_failures']=getattr(exc,'observed_failures',0)
            except AssertionError as exc:row.update(status='FAIL',detail=str(exc) or 'Forventningen var ikke oppfylt.')
            except Exception as exc:row.update(status='FAIL',detail=type(exc).__name__+': testen kunne ikke fullføres som forventet.')
            finally:
                row['seconds']=time.perf_counter()-start
                rows.append(row)
        try:
            from model_checks import run_models
            model_rows=run_models(environment if environment.db_ready else None)
        except ImportError:
            model_rows={id:{'status':'BLOCKED','detail':'Installer testavhengighetene.'} for id in MODEL_IDS}
        except Exception as exc:
            model_rows={id:{'status':'BLOCKED','detail':'Modelluttrekk: '+type(exc).__name__} for id in MODEL_IDS}
        measurements=environment.measurements
        metadata={'postgresql':getattr(environment,'pg_version',None),'model_digest':environment.model_digest,
                  'fixture_clock':getattr(environment,'fixture_clock',None),
                  'model':environment.measurements.get('model'),
                  'configuration_digest':__import__('hashlib').sha256(json.dumps(config,sort_keys=True).encode()).hexdigest()}
    finally:
        try:environment.close()
        except Exception as exc:rows.append({'id':'cleanup','group':'ENV','status':'FAIL','detail':'Opprydding feilet: '+type(exc).__name__})
    for row in unit_rows:
        row['group']=unit_group(row['id'])
        if row['group'] is None:
            row['status']='BLOCKED';row['detail']='Enhetstesten mangler kobling til kontrollgruppe.'
    groups={}
    for id in REQUIREMENT_IDS:
        statuses=[row['status'] for row in rows+unit_rows if row.get('group')==id]
        groups[id]=aggregate(statuses)
    for id in MODEL_IDS:groups[id]=model_rows.get(id,{'status':'BLOCKED'})['status']
    all_measurable=all(row['status'] in ('PASS','FAIL') for row in rows+unit_rows)
    point=fom(groups,full=mode=='full' and all_measurable)
    return {'integration_tests':rows,'models':model_rows,'controls':groups,'measurements':measurements,
            'environment':metadata,'fom':point,'setup_error':setup_error}
