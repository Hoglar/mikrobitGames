"""AI-005/006, TAI-03: SQL must be parsed, not accepted by text prefix."""
import json
import unittest
from support import ROOT, implementation

CASES = json.loads((ROOT / 'backend/tests/fixtures/sql-cases.json').read_text())


class QueryPolicy(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.subject = implementation('backend/ai-service/src/query_policy.py')


def case_test(case):
    def test(self):
        if case['allowed']:
            self.subject.validate_query(case['sql'])
        else:
            with self.assertRaises(ValueError):
                self.subject.validate_query(case['sql'])
    test.__doc__ = case['reason']
    return test


for case in CASES:
    setattr(QueryPolicy, 'test_' + case['id'], case_test(case))
