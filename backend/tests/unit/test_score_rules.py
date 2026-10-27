"""BE-003/004, TBE-03/04: pure score rules, independent of PostgreSQL."""
import unittest
from support import implementation


class ScoreRules(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.subject = implementation('backend/api/src/score_rules.py')

    def test_first_record_for_both_directions(self):
        for direction in ('higher_is_better', 'lower_is_better'):
            with self.subTest(direction=direction):
                self.assertIs(self.subject.is_improvement(100, None, direction), True)

    def test_higher_must_be_strictly_better(self):
        for value, expected in ((120, True), (100, False), (80, False)):
            with self.subTest(value=value):
                self.assertIs(self.subject.is_improvement(value, 100, 'higher_is_better'), expected)

    def test_lower_must_be_strictly_better(self):
        for value, expected in ((55000, True), (60000, False), (65000, False)):
            with self.subTest(value=value):
                self.assertIs(self.subject.is_improvement(value, 60000, 'lower_is_better'), expected)

    def test_unknown_direction_rejected(self):
        with self.assertRaises(ValueError):
            self.subject.is_improvement(120, 100, 'random')

    def test_valid_inclusive_bounds(self):
        for value in (0, 1, 100000):
            with self.subTest(value=value):
                self.subject.validate_score(value, 0, 100000)
        self.subject.validate_score(9007199254740991, 0, 9007199254740991)

    def test_invalid_scores_rejected(self):
        for value in (-1, 100001, 1.5, '120', True, False, None):
            with self.subTest(value=value), self.assertRaises((ValueError, TypeError)):
                self.subject.validate_score(value, 0, 100000)
        with self.assertRaises((ValueError, TypeError)):
            self.subject.validate_score(9007199254740992, 0, 9007199254740991)

    def test_competition_ranking_and_stable_tie_order(self):
        scores = [('c', 115), ('b', 120), ('a', 120)]
        self.assertEqual(self.subject.rank_scores(scores, 'higher_is_better'),
                         [(1, 'a', 120), (1, 'b', 120), (3, 'c', 115)])

    def test_completed_attempt_uses_game_bounds(self):
        for value in (1, 100):
            self.subject.validate_attempt('completed', value, 1, 100)
        for value in (None, 0, 101, True, False, 1.5, '10'):
            with self.subTest(value=value), self.assertRaises((ValueError, TypeError)):
                self.subject.validate_attempt('completed', value, 1, 100)

    def test_incomplete_value_is_optional_and_not_a_final_score(self):
        for value in (None, 0, 101, 9007199254740991):
            self.subject.validate_attempt('incomplete', value, 1, 100)
        for value in (-1, 9007199254740992, True, False, 1.5, '10'):
            with self.subTest(value=value), self.assertRaises((ValueError, TypeError)):
                self.subject.validate_attempt('incomplete', value, 1, 100)

    def test_unknown_attempt_status_rejected(self):
        for attempt_status in ('unknown', '', None, True):
            with self.subTest(status=attempt_status), self.assertRaises((ValueError, TypeError)):
                self.subject.validate_attempt(attempt_status, 10, 1, 100)

    def test_lower_ranking(self):
        self.assertEqual(self.subject.rank_scores([('nora', 58000), ('ada', 55000)], 'lower_is_better'),
                         [(1, 'ada', 55000), (2, 'nora', 58000)])

    def test_empty_ranking(self):
        self.assertEqual(self.subject.rank_scores([], 'higher_is_better'), [])
