"""Known-good and deliberately wrong inputs exercise the test infrastructure."""
import copy
import json
from pathlib import Path
import socket
import struct
import tempfile
import threading
import unittest
from unittest.mock import patch

from harness import Relay, request, ROOT, Blocked
from model_checks import plain_view, openapi_checks, component_check
from pipeline import load_cases
from reports import series_key, write_curves

# Import registries once; the command uses the same registered case objects.
load_cases()
from benchmark_checks import percentile, summarize, sample, assess_http_db


class ModelExtractionTests(unittest.TestCase):
    def setUp(self):
        self.document=json.loads((ROOT/'backend/tests/fixtures/ai-openapi.json').read_text())

    def test_plain_projection(self):
        actual=plain_view('SELECT p.id, p.username FROM app.players AS p')
        self.assertEqual(actual,{'source':'app.players','columns':['id','username'],'row_filter':None})

    def test_non_plain_views_cannot_pass(self):
        for sql in ('SELECT id FROM app.players WHERE true',
                    'SELECT p.id FROM app.players p JOIN app.sessions s ON p.id=s.player_id',
                    'SELECT lower(username) FROM app.players','SELECT * FROM app.players',
                    'SELECT DISTINCT id FROM app.players','SELECT id FROM app.players LIMIT 3'):
            with self.subTest(sql=sql):self.assertIn('unsupported_definition',plain_view(sql))

    def test_openapi_same_document(self):
        self.assertTrue(all(x['status']=='PASS' for x in openapi_checks(self.document,copy.deepcopy(self.document)).values()))

    def test_effective_path_normalization(self):
        other=copy.deepcopy(self.document)
        other['servers']=[{'url':'http://127.0.0.1:8001/v1'}]
        other['paths']={path.removeprefix('/v1'): operation for path, operation in other['paths'].items()}
        self.assertTrue(all(x['status']=='PASS' for x in openapi_checks(self.document,other).values()))

    def test_request_bound_change_is_detected(self):
        other=copy.deepcopy(self.document)
        other['paths']['/v1/answer']['post']['requestBody']['content']['application/json']['schema']['properties']['question']['maxLength']=2000
        self.assertEqual(openapi_checks(self.document,other)['MAPI-2']['status'],'FAIL')

    def test_missing_error_status_is_detected(self):
        other=copy.deepcopy(self.document);del other['paths']['/v1/answer']['post']['responses']['503']
        self.assertEqual(openapi_checks(self.document,other)['MAPI-3']['status'],'FAIL')

    def test_dependency_and_unauthorized_io(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/'src').mkdir()
            (root/'src/a.py').write_text('from b import function\n')
            (root/'src/b.py').write_text('def function(): pass\n')
            model={'implementation_root':'src','components':{'a':{'module':'a.py','depends_on':['b'],'external_access':[]},'b':{'module':'b.py','depends_on':[],'external_access':[]}}}
            with patch('model_checks.ROOT',root):
                self.assertEqual(component_check(model)['status'],'PASS')
                (root/'src/b.py').write_text('import psycopg\n')
                self.assertEqual(component_check(model)['status'],'FAIL')
                (root/'src/b.py').write_text("__import__('os')\n")
                self.assertEqual(component_check(model)['status'],'BLOCKED')


class BenchmarkToolsTests(unittest.TestCase):
    def measured_phases(self):
        samples=[{'operation':op,'http_ms':5,'db_ms':2,'error':None,'dispatch_lag_ms':0}
                 for op in ('leaderboard','session','result')]
        phase={'summary':summarize(samples),'peaks':samples,
               'resource_samples':[{'process_pss_bytes':1000,'roles':{}}],
               'ai_calls':[{'status':200}],'open_transactions_after_drain':0}
        return {name:copy.deepcopy(phase) for name in ('without_ai','with_ai')}

    def test_complete_benchmark_is_measurable(self):
        self.assertEqual(assess_http_db(self.measured_phases()),{'missing':[],'failures':[]})

    def test_failures_do_not_hide_missing_measurements(self):
        phases=self.measured_phases()
        phases['without_ai']['summary']['session'].update(errors=1,http_p95_ms=800,db_missing=1)
        phases['with_ai']['resource_samples'][0]['process_pss_bytes']=None
        result=assess_http_db(phases)
        self.assertEqual(len(result['missing']),2)
        self.assertEqual(len(result['failures']),2)

    def test_missing_phase_and_resources_cannot_pass(self):
        phases=self.measured_phases()
        del phases['with_ai']
        phases['without_ai']['resource_samples']=[]
        self.assertIn('with_ai',assess_http_db(phases)['missing'])
        self.assertIn('without_ai ressursmålinger',assess_http_db(phases)['missing'])

    def test_nearest_rank_percentile(self):
        self.assertEqual(percentile(list(range(1,101))),95)
        self.assertEqual(percentile([7]),7)
        self.assertIsNone(percentile([]))

    def test_errors_and_missing_db_time_remain_visible(self):
        row={'operation':'session','http_ms':5,'db_ms':None,'error':'HTTP_500','dispatch_lag_ms':10}
        result=summarize([row])['session']
        self.assertEqual(result['errors'],1)
        self.assertEqual(result['db_missing'],1)
        self.assertEqual(result['http_p95_ms'],5)

    def test_http_clock_is_not_used_as_db_clock(self):
        class Env:
            players=[('id','Ada')]*30
            games=[('game',)]*10
            def api(self,*args,**kwargs):return 200,{}, {'player':{'id':'id'}}
        with patch('protocol_checks.validate'):
            row=sample(Env(),0,'session',0)
        self.assertIsNone(row['db_ms'])
        self.assertIsNone(row['error'])


class HTTPHarnessTests(unittest.TestCase):
    def test_relay_and_script_are_real_http(self):
        upstream=Relay();downstream=Relay(upstream.url)
        try:
            upstream.reset(lambda path,body,index:(200,{}, {'request':body,'index':index}))
            result=request(downstream.url+'/answer','POST',{'question':'test'})
            self.assertEqual(result[2],{'request':{'question':'test'},'index':0})
            self.assertEqual(len(downstream.calls),1)
        finally:downstream.close();upstream.close()

    def test_http_contract_checks_actual_shape(self):
        from protocol_checks import validate
        validate('GET','/health',(200,{'content-type':'application/json'},{'status':'ok'}))
        with self.assertRaises(Exception):
            validate('GET','/health',(200,{'content-type':'application/json'},{'status':'ok','password':'leak'}))
        with self.assertRaises(AssertionError):validate('POST','/auth/logout',(204,{},'unexpected'))

    def test_commit_fault_drops_ack_after_record_insert(self):
        self.check_commit_fault(b'INSERT INTO app.records VALUES (1)')

    def test_commit_fault_drops_ack_after_incomplete_attempt_insert(self):
        self.check_commit_fault(b'INSERT INTO app.attempts VALUES (1)')

    def check_commit_fault(self, insert):
        from fault_proxy import CommitFaultProxy
        listener=socket.socket();listener.bind(('127.0.0.1',0));listener.listen()
        errors=[]
        def peer():
            try:
                conn,_=listener.accept()
                with conn:
                    conn.recv(4096)
                    tag=b'COMMIT\0';packet=b'C'+struct.pack('!I',len(tag)+4)+tag
                    conn.sendall(packet[:3]);conn.sendall(packet[3:])
            except Exception as exc:errors.append(exc)
        thread=threading.Thread(target=peer);thread.start()
        proxy=CommitFaultProxy(listener.getsockname()[1]);proxy.arm.set()
        try:
            with socket.create_connection(('127.0.0.1',proxy.port),timeout=3) as conn:
                conn.sendall(insert)
                self.assertEqual(conn.recv(1024),b'')
            self.assertTrue(proxy.triggered.wait(2))
        finally:proxy.close();listener.close();thread.join(timeout=3)
        self.assertEqual(errors,[])


class ReportingTests(unittest.TestCase):
    def test_blocked_reason_is_visible_in_markdown(self):
        from reports import report_text
        report={'timestamp':'selftest','mode':'full','product_tests':[
            {'id':'missing_component','status':'BLOCKED','detail':'Modulen mangler.',
             'output':'OK (skipped=1)'}]}
        rendered=report_text(report)
        self.assertIn('Modulen mangler.',rendered)
        self.assertNotIn('OK (skipped=1)',rendered)

    def test_changed_control_or_model_starts_new_series(self):
        a={'control_digest':'a','environment':{'model_digest':'m','fixture_clock':'one'},'machine':'host'}
        b=copy.deepcopy(a);b['environment']['fixture_clock']='two'
        self.assertEqual(series_key(a),series_key(b))
        b['environment']['model_digest']='different'
        self.assertNotEqual(series_key(a),series_key(b))

    def test_changed_control_version_never_joins_legacy_series(self):
        old={'control_digest':'same','environment':{},'machine':'host'}
        current=dict(old,control_version=2)
        self.assertNotEqual(series_key(old),series_key(current))
        self.assertNotEqual(series_key(dict(old,control_version=1)),series_key(current))

    def test_no_curve_for_incomplete_run(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)
            write_curves(path,path,{'fom':None})
            self.assertEqual(list(path.iterdir()),[])

    def test_curves_use_only_matching_real_report_points(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            report={'timestamp':'synthetic-selftest','control_digest':'a','environment':{},'machine':'selftest',
                    'fom':{'requirements_percent':50,'model_percent':60}}
            folder=root/'run';folder.mkdir();(folder/'report.json').write_text(json.dumps(report))
            write_curves(folder,root,report)
            self.assertIn('50.00%',(folder/'requirements.svg').read_text())
            self.assertIn('60.00%',(folder/'model.svg').read_text())
