"""Tests of verification tools with deliberately synthetic faults, not DB evidence."""
import copy
import json
import unittest
from pathlib import Path
from controls import REQUIREMENT_IDS, MODEL_IDS, aggregate, compare_database, fom

ROOT = Path(__file__).resolve().parents[3]


class FoMTests(unittest.TestCase):
    def results(self, status='PASS'):
        return dict.fromkeys(REQUIREMENT_IDS + MODEL_IDS, status)

    def test_all_pass_and_all_fail(self):
        self.assertEqual(fom(self.results(), full=True), {'requirements_percent': 100, 'model_percent': 100})
        self.assertEqual(fom(self.results('FAIL'), full=True), {'requirements_percent': 0, 'model_percent': 0})

    def test_each_area_has_equal_weight(self):
        for area in ('DB', 'API', 'AI'):
            result = self.results('FAIL')
            for id in result:
                if id.startswith(('K' + area + '-', 'M' + area + '-')):
                    result[id] = 'PASS'
            for value in fom(result, full=True).values():
                self.assertAlmostEqual(value, 100 / 3)

    def test_skipped_or_blocked_prevents_point(self):
        for status in ('SKIPPED', 'BLOCKED'):
            result = self.results()
            result['MDB-20'] = status
            self.assertIsNone(fom(result, full=True))

    def test_quick_never_creates_point(self):
        self.assertIsNone(fom(self.results(), full=False))

    def test_missing_extra_and_invalid_controls_rejected(self):
        result = self.results(); del result['KDB-1']
        with self.assertRaises(ValueError): fom(result, full=True)
        result = self.results(); result['extra'] = 'PASS'
        with self.assertRaises(ValueError): fom(result, full=True)
        result = self.results(); result['KDB-1'] = 'unknown'
        with self.assertRaises(ValueError): fom(result, full=True)

    def test_subtest_statuses_do_not_hide_missing_measurements(self):
        self.assertEqual(aggregate(['PASS', 'FAIL']), 'FAIL')
        self.assertEqual(aggregate(['FAIL', 'BLOCKED']), 'BLOCKED')
        self.assertEqual(aggregate(['FAIL', 'SKIPPED']), 'SKIPPED')
        self.assertEqual(aggregate([]), 'BLOCKED')
        self.assertEqual(aggregate(['PASS', 'PASS']), 'PASS')
        with self.assertRaises(ValueError): aggregate(['OK'])


class DatabaseModelTests(unittest.TestCase):
    def setUp(self):
        self.expected = json.loads((ROOT / 'backend/spec/models/database-schema.json').read_text())
        # Synthetic control fixture only. This is NEVER an extraction from PostgreSQL.
        self.actual = {'extraction_complete': True,
                       'tables': copy.deepcopy(self.expected['tables']),
                       'views': copy.deepcopy(self.expected['views'])}
        for table in self.actual['tables'].values():
            table['not_null_columns'] = list(table['columns'])

    def failed(self):
        return {id for id, result in compare_database(self.expected, self.actual).items() if result['status'] == 'FAIL'}

    def test_exact_synthetic_snapshot(self):
        results = compare_database(self.expected, self.actual)
        self.assertEqual(len(results), 20)
        self.assertTrue(all(r['status'] == 'PASS' for r in results.values()))

    def test_wrong_type(self):
        self.actual['tables']['app.records']['columns']['value'] = 'text'
        self.assertEqual(self.failed(), {'MDB-13'})

    def test_nullable_column(self):
        self.actual['tables']['app.players']['not_null_columns'].remove('username')
        self.assertEqual(self.failed(), {'MDB-1'})

    def test_extra_column(self):
        self.actual['tables']['app.players']['columns']['email'] = 'text'
        self.assertEqual(self.failed(), {'MDB-1'})

    def test_wrong_generated_expression(self):
        self.actual['tables']['app.players']['generated_columns']['username_key'] = 'upper(username)'
        self.assertEqual(self.failed(), {'MDB-1'})

    def test_missing_foreign_key(self):
        self.actual['tables']['app.records']['foreign_keys'].pop()
        self.assertEqual(self.failed(), {'MDB-15'})

    def test_wrong_delete_rule(self):
        self.actual['tables']['app.records']['foreign_keys'][0]['on_delete'] = 'RESTRICT'
        self.assertEqual(self.failed(), {'MDB-15'})

    def test_missing_unique_key(self):
        self.actual['tables']['app.sessions']['unique_keys'] = []
        self.assertEqual(self.failed(), {'MDB-8'})

    def test_missing_table_fails_four_checks_and_object_set(self):
        del self.actual['tables']['app.records']
        self.assertEqual(self.failed(), {'MDB-13', 'MDB-14', 'MDB-15', 'MDB-16', 'MDB-20'})

    def test_missing_view(self):
        del self.actual['views']['ai_read.players']
        self.assertEqual(self.failed(), {'MDB-17', 'MDB-20'})

    def test_secret_projection(self):
        self.actual['views']['ai_read.players']['columns'].append('password_hash')
        self.assertEqual(self.failed(), {'MDB-17'})

    def test_filtered_view(self):
        self.actual['views']['ai_read.games']['row_filter'] = 'is_active = true'
        self.assertEqual(self.failed(), {'MDB-18'})

    def test_extra_join(self):
        self.actual['views']['ai_read.records']['joins'] = ['app.sessions']
        self.assertEqual(self.failed(), {'MDB-19'})

    def test_type_aliases_and_constraint_order(self):
        self.actual['tables']['app.records']['columns']['value'] = 'int8'
        self.actual['tables']['app.records']['foreign_keys'].reverse()
        self.actual['tables']['app.games']['columns']['is_active'] = 'bool'
        self.assertEqual(self.failed(), set())

    def test_missing_or_incomplete_extraction_is_blocked(self):
        for snapshot in (None, {}, {'extraction_complete': False}, {'extraction_complete': True, 'tables': {}}):
            self.assertTrue(all(r['status'] == 'BLOCKED' for r in compare_database(self.expected, snapshot).values()))
        del self.actual['tables']['app.records']['foreign_keys']
        self.assertTrue(all(r['status'] == 'BLOCKED' for r in compare_database(self.expected, self.actual).values()))

    def test_missing_metadata_not_hidden_by_type_failure(self):
        self.actual['tables']['app.players']['columns']['id'] = 'text'
        del self.actual['tables']['app.players']['not_null_columns']
        self.assertTrue(all(r['status'] == 'BLOCKED' for r in compare_database(self.expected, self.actual).values()))

    def test_json_object_order_does_not_change_control_ids(self):
        self.expected['tables'] = dict(reversed(list(self.expected['tables'].items())))
        self.expected['views'] = dict(reversed(list(self.expected['views'].items())))
        self.actual['tables']['app.records']['columns']['value'] = 'text'
        self.assertEqual(self.failed(), {'MDB-13'})
