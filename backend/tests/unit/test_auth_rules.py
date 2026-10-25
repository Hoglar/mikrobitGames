"""UDB-03/04: deterministic username and session boundaries."""
from datetime import datetime, timedelta, timezone
import unittest
from support import implementation


class AuthRules(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.subject=implementation('backend/api/src/auth_service.py')

    def test_username_normalization(self):
        self.assertEqual(self.subject.normalize_username('Spiller_1'),'spiller_1')
        self.assertEqual(self.subject.normalize_username('ABC-123'),'abc-123')

    def test_invalid_usernames(self):
        for name in ('ab','a'*33,'spiller navn','æbc','abc!',''):
            with self.subTest(name=name),self.assertRaises(ValueError):self.subject.normalize_username(name)

    def test_initial_expiry(self):
        created=datetime(2026,10,24,tzinfo=timezone.utc)
        self.assertEqual(self.subject.session_expiry(created,created),created+timedelta(seconds=259200))

    def test_absolute_expiry_caps_renewal(self):
        created=datetime(2026,10,24,tzinfo=timezone.utc)
        self.assertEqual(self.subject.session_expiry(created,created+timedelta(days=29)),created+timedelta(seconds=2592000))

    def test_exact_expiry_boundary(self):
        expires=datetime(2026,10,27,tzinfo=timezone.utc)
        absolute=expires+timedelta(days=27)
        self.assertIs(self.subject.session_is_valid(expires,absolute,expires-timedelta(microseconds=1)),True)
        self.assertIs(self.subject.session_is_valid(expires,absolute,expires),False)
        self.assertIs(self.subject.session_is_valid(expires,absolute,expires+timedelta(microseconds=1)),False)

    def test_absolute_boundary(self):
        absolute=datetime(2026,11,23,tzinfo=timezone.utc)
        self.assertIs(self.subject.session_is_valid(absolute+timedelta(days=1),absolute,absolute),False)
