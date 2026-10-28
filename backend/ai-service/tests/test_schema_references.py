"""Semantic reference validation must preserve supported reading patterns."""
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
import time
import sqlglot

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))
import query_policy
import read_store


class SchemaReferences(unittest.TestCase):
    def test_invalid_references_never_open_database_connection(self):
        for sql in (
            'SELECT g.name FROM ai_read.games WHERE id=$1',
            'SELECT p.player_id FROM ai_read.players p',
            'SELECT password_hash FROM ai_read.players',
            'SELECT id FROM ai_read.players p JOIN ai_read.records r ON p.id=r.player_id',
            'WITH x AS (SELECT id FROM ai_read.players) SELECT x.password_hash FROM x',
            'SELECT p.id FROM ai_read.players p WHERE EXISTS (SELECT r.missing FROM ai_read.records r WHERE r.player_id=p.id)',
        ):
            with self.subTest(sql=sql), patch.object(read_store.psycopg, 'connect') as connect:
                with self.assertRaises(query_policy.InvalidReferences):
                    read_store.query(sql, [], time.monotonic()+5)
                connect.assert_not_called()

    def test_supported_queries_are_preserved_without_rewriting(self):
        for sql in (
            'SELECT g.name FROM ai_read.games AS g WHERE g.id=$1',
            'SELECT * FROM ai_read.games',
            'SELECT r.* FROM ai_read.records r',
            'SELECT COUNT(*) FROM ai_read.records',
            'WITH x AS (SELECT player_id, value FROM ai_read.records) SELECT player_id, MAX(value) AS best FROM x GROUP BY player_id ORDER BY best',
            'WITH x(pid, score) AS (SELECT player_id, value FROM ai_read.records) SELECT pid, score FROM x',
            'SELECT s.player_id FROM (SELECT player_id FROM ai_read.records) s',
            'SELECT p.id FROM ai_read.players p WHERE EXISTS (SELECT r.id FROM ai_read.records r WHERE r.player_id=p.id)',
            'SELECT id FROM ai_read.games UNION SELECT game_id FROM ai_read.records',
            'SELECT player_id, value, LAG(value) OVER (PARTITION BY player_id ORDER BY created_at) AS previous FROM ai_read.records',
            'SELECT CASE WHEN r.value > $1 THEN r.value ELSE 0 END AS score FROM ai_read.records r',
            'SELECT game_id, MAX(value) AS best FROM ai_read.records GROUP BY game_id HAVING MAX(value)>$1',
            'SELECT "g"."name" FROM "ai_read"."games" AS "g"',
        ):
            with self.subTest(sql=sql):
                actual = query_policy.parse_query(sql).sql(dialect='postgres')
                self.assertEqual(actual, sqlglot.parse_one(sql, read='postgres').sql(dialect='postgres'))


if __name__ == '__main__':
    unittest.main()
