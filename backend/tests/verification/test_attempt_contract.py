"""Contract/fixture checks only: these do not count as product verification."""
import copy
import unittest
from uuid import UUID
from unittest.mock import patch

from controls import DB_MODEL_IDS, MODEL_IDS, REQUIREMENT_IDS, fom
from harness import ADA, NORA, POINTS, attempt_payload, history_fixtures
from model_checks import clean_schema, openapi_checks, run_models
from protocol_checks import document, validate
from pipeline import load_cases

load_cases()
from benchmark_checks import sample


class AttemptContractTests(unittest.TestCase):
    def setUp(self):
        import jsonschema
        self.doc = document()
        schema = clean_schema({'$ref': '#/components/schemas/ResultRequest'}, self.doc)
        self.validator = jsonschema.Draft202012Validator(schema, format_checker=jsonschema.FormatChecker())

    def test_valid_requests_and_explicit_null(self):
        for status, value in (('completed', 0), ('completed', 9007199254740991),
                              ('incomplete', None), ('incomplete', 9007199254740991)):
            self.validator.validate(attempt_payload(value, status))

    def test_missing_identity_status_value_and_invalid_types_are_rejected(self):
        payload = attempt_payload(120)
        invalid = [{k: v for k, v in payload.items() if k != missing} for missing in payload]
        invalid += [dict(payload, attempt_id='invalid'), dict(payload, status='unknown'),
                    dict(payload, player_id=ADA)]
        for value in (None, True, False, '120', 1.5, -1, 9007199254740992):
            invalid.append(dict(payload, value=value))
        for value in (True, '120', -1, 1.5, 9007199254740992):
            invalid.append(dict(payload, status='incomplete', value=value))
        for body in invalid:
            with self.subTest(body=body):
                self.assertFalse(self.validator.is_valid(body))

    def response(self, outcome='created'):
        record = {'id': str(UUID(int=10000)), 'player_id': ADA, 'game_id': POINTS,
                  'value': 120, 'created_at': '2026-10-01T12:00:00Z'}
        attempt = dict(record, id=str(UUID(int=20000)), status='completed',
                       record_outcome=outcome, record_id=record['id'])
        body = {'attempt': attempt, 'outcome': outcome, 'record': record, 'current_record': record}
        if outcome in ('not_improved', 'not_eligible'):
            body['record'] = None
            attempt['record_id'] = None
        if outcome == 'not_eligible':
            attempt.update(status='incomplete', value=None)
            body['current_record'] = None
        return body

    def assert_response(self, body, code=201):
        validate('POST', f'/games/{POINTS}/results',
                 (code, {'content-type': 'application/json'}, body))

    def test_new_and_replayed_attempt_can_have_each_outcome(self):
        for outcome in ('created', 'already_recorded', 'not_improved', 'not_eligible'):
            for code in (200, 201):
                with self.subTest(outcome=outcome, code=code):
                    self.assert_response(self.response(outcome), code)

    def test_contradictory_status_record_and_outcome_fail(self):
        import jsonschema
        cases = []
        body = self.response(); body['attempt']['status'] = 'incomplete'; cases.append(body)
        body = self.response(); body['attempt']['value'] = None; cases.append(body)
        body = self.response(); body['record'] = None; cases.append(body)
        body = self.response(); body['outcome'] = 'not_improved'; cases.append(body)
        body = self.response('not_eligible'); body['attempt']['record_id'] = str(UUID(int=10000)); cases.append(body)
        for body in cases:
            with self.subTest(body=body), self.assertRaises(jsonschema.ValidationError):
                self.assert_response(body)

    def test_new_private_routes_and_auth_are_part_of_model_comparison(self):
        actual = copy.deepcopy(self.doc)
        self.assertTrue(all(row['status'] == 'PASS' for row in openapi_checks(self.doc, actual).values()))
        del actual['paths']['/account/results/{attempt_id}']
        self.assertEqual(openapi_checks(self.doc, actual)['MAPI-1']['status'], 'FAIL')
        actual = copy.deepcopy(self.doc)
        actual['paths']['/account/results']['get']['security'] = []
        self.assertEqual(openapi_checks(self.doc, actual)['MAPI-4']['status'], 'FAIL')

    def test_no_database_returns_24_blocked_checks(self):
        rows = run_models(None)
        self.assertEqual(set(rows), set(MODEL_IDS))
        self.assertEqual(len(DB_MODEL_IDS), 24)
        self.assertTrue(all(rows[id]['status'] == 'BLOCKED' for id in DB_MODEL_IDS))

    def test_database_weight_is_one_third_with_24_checks(self):
        rows = dict.fromkeys(REQUIREMENT_IDS + MODEL_IDS, 'PASS')
        rows['MDB-24'] = 'FAIL'
        self.assertAlmostEqual(fom(rows, full=True)['model_percent'], 100 - 100 / 3 / 24)
        for n in range(21, 25):
            del rows[f'MDB-{n}']
        with self.assertRaises(ValueError):
            fom(rows, full=True)


class AttemptFixtureTests(unittest.TestCase):
    def test_seed_links_each_record_to_one_completed_private_attempt(self):
        history = [(ADA, POINTS, 100, 0), (ADA, POINTS, 120, 1), (NORA, POINTS, 115, 1)]
        records, attempts = history_fixtures(history)
        self.assertEqual(history_fixtures(history), (records, attempts))
        self.assertEqual(len(records), 3)
        self.assertEqual(len({(row[0], row[1]) for row in attempts}), 3)
        by_id = {row[0]: row for row in records}
        for player, id, game, status, value, created, outcome, record_id in attempts:
            UUID(id)
            self.assertEqual((status, outcome), ('completed', 'created'))
            self.assertEqual((player, game, value, created), by_id[record_id][1:])
            self.assertEqual(created.hour, 12)

    def test_benchmark_creates_new_attempt_even_for_same_value(self):
        class Env:
            players = [(ADA, 'Ada')] * 30
            games = [(POINTS,)] * 10
            def __init__(self): self.bodies = []
            def api(self, method, path, body, player, **kwargs):
                self.bodies.append(body)
                return 201, {'server-timing': 'db;dur=1.5'}, {
                    'attempt': {'id': body['attempt_id'], 'status': body['status'], 'value': body['value'],
                                'player_id': player, 'game_id': POINTS},
                    'current_record': {'player_id': player}}
        e = Env()
        with patch('protocol_checks.validate'):
            first = sample(e, 0, 'result', 0)
            second = sample(e, 0, 'result', 0)
        self.assertIsNone(first['error'])
        self.assertIsNone(second['error'])
        self.assertNotEqual(first['attempt_id'], second['attempt_id'])
        self.assertEqual(e.bodies[0]['value'], e.bodies[1]['value'])
        self.assertEqual(e.bodies[0]['status'], 'completed')
        self.assertEqual(first['db_ms'], 1.5)
