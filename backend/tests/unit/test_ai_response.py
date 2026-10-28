"""AI-002/003, TBE-06: reject malformed responses before forwarding."""
import unittest
from support import implementation

REQUEST_ID = '33333333-3333-4333-8333-333333333333'


class AIResponse(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.subject = implementation('backend/api/src/ai_gateway.py')

    def response(self, **changes):
        return dict({'request_id': REQUEST_ID, 'status': 'ok', 'answer': 'Ada har 120 poeng.'}, **changes)

    def test_three_success_statuses(self):
        for status in ('ok', 'no_data', 'cannot_answer'):
            with self.subTest(status=status):
                self.subject.validate_response(self.response(status=status), REQUEST_ID)

    def test_unicode_codepoint_boundary(self):
        self.subject.validate_response(self.response(answer='😀' * 4000), REQUEST_ID)
        with self.assertRaises(ValueError):
            self.subject.validate_response(self.response(answer='😀' * 4001), REQUEST_ID)

    def test_wrong_request_id(self):
        with self.assertRaises(ValueError):
            self.subject.validate_response(self.response(request_id='44444444-4444-4444-8444-444444444444'), REQUEST_ID)

    def test_extra_field_rejected(self):
        with self.assertRaises(ValueError):
            self.subject.validate_response(self.response(sql='SELECT 1'), REQUEST_ID)

    def test_each_required_field(self):
        for name in ('request_id', 'status', 'answer'):
            payload = self.response()
            del payload[name]
            with self.subTest(field=name), self.assertRaises(ValueError):
                self.subject.validate_response(payload, REQUEST_ID)

    def test_invalid_field_values(self):
        for field, value in (('request_id', None), ('request_id', 3), ('status', 'success'),
                             ('status', None), ('answer', ''), ('answer', 120), ('answer', None)):
            with self.subTest(field=field, value=value), self.assertRaises(ValueError):
                self.subject.validate_response(self.response(**{field: value}), REQUEST_ID)

    def test_non_object_rejected(self):
        for payload in (None, [], 'text', 42):
            with self.subTest(payload=payload), self.assertRaises(ValueError):
                self.subject.validate_response(payload, REQUEST_ID)

    def test_memory_notices_are_bounded_and_optional(self):
        self.subject.validate_response(self.response(notices=['Eldste melding er glemt.']),REQUEST_ID)
        for notices in ('tekst',[1],[''],['x'*201],['x']*22):
            with self.subTest(notices=notices),self.assertRaises(ValueError):
                self.subject.validate_response(self.response(notices=notices),REQUEST_ID)
