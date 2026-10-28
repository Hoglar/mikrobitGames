"""Supplementary regression checks; the fixed FoM control set is unchanged."""
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))
import query_policy


class PredicatePolicyTests(unittest.TestCase):
    def test_combined_filters_are_allowed(self):
        for connector in ('AND', 'OR'):
            with self.subTest(connector=connector):
                query_policy.validate_query(f'''SELECT r.value, r.created_at
                    FROM ai_read.records r JOIN ai_read.games g ON r.game_id=g.id
                    WHERE r.player_id=$1 {connector} g.name=$2 ORDER BY r.created_at''')

    def test_correlated_exists_is_allowed(self):
        query_policy.validate_query('''SELECT p.username FROM ai_read.players p
            WHERE EXISTS (SELECT r.id FROM ai_read.records r WHERE r.player_id=p.id)''')

    def test_nested_forbidden_sources_still_fail(self):
        for source in ('app.sessions', 'app.attempts', 'pg_catalog.pg_authid'):
            with self.subTest(source=source):
                with self.assertRaises(ValueError):
                    query_policy.validate_query(f'''SELECT p.id FROM ai_read.players p
                        WHERE p.username_key=$1 OR EXISTS (SELECT * FROM {source})''')

    def test_nested_forbidden_functions_and_writes_still_fail(self):
        for sql in (
            "SELECT id FROM ai_read.players WHERE username_key=$1 AND pg_sleep(1) IS NULL",
            "SELECT id FROM ai_read.players WHERE username_key=$1 OR app.secret_function(id)=1",
            "SELECT id FROM ai_read.players WHERE EXISTS (SELECT pg_read_file('/etc/passwd'))",
            "WITH gone AS (DELETE FROM app.records RETURNING id) SELECT id FROM ai_read.players WHERE id IN (SELECT id FROM gone)",
        ):
            with self.subTest(sql=sql):
                with self.assertRaises(ValueError):
                    query_policy.validate_query(sql)


if __name__ == '__main__':
    unittest.main()
