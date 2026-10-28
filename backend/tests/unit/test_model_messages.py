"""Model wire replies: natural text is not an executable tool action."""
import json
from pathlib import Path
import sys
import time
import unittest
from unittest.mock import patch
import httpx
from support import ROOT
sys.path.insert(0, str(ROOT/'backend/ai-service/src'))
import model_client


class ModelMessages(unittest.TestCase):
    def generate(self, content, **metadata):
        payload = {'done': True, 'message': {'role': 'assistant', 'content': content}, **metadata}
        original = httpx.Client
        transport = httpx.MockTransport(lambda request: httpx.Response(200, json=payload))
        with patch.object(model_client.httpx, 'Client', side_effect=lambda **kwargs: original(transport=transport, **kwargs)):
            return model_client.Ollama('http://127.0.0.1:11434', 'fixture')([], time.monotonic()+5)

    def test_plain_and_json_string_greetings(self):
        for content in ('Hei hei! 😊', json.dumps('Hei hei! 😊')):
            with self.subTest(content=content):
                result = self.generate(content)
                self.assertEqual(result, {'type': 'answer', 'kind': 'chat', 'answer': 'Hei hei! 😊'})

    def test_structured_tools_remain_strict(self):
        good = {'type': 'tool', 'name': 'standings', 'args': {'game': 'Sprint'}}
        self.assertEqual(self.generate(json.dumps(good)), good)
        for value in ({'type': 'query', 'sql': 'DELETE FROM app.players'},
                      {**good, 'args': {'game': 'Sprint', 'sql': 'SELECT * FROM app.sessions'}},
                      {**good, 'name': 'shell'}, {'type': 'answer', 'kind': 'records', 'answer': 'x', 'extra': 1}):
            with self.subTest(value=value), self.assertRaises(model_client.InvalidModelMessage):
                self.generate(json.dumps(value))

    def test_broken_structures_are_not_converted_to_chat(self):
        for value in ('{"type":"tool",', '[broken', '```json\n{}', '<tool_call>bad', '42', 'null'):
            with self.subTest(value=value), self.assertRaises(model_client.InvalidModelMessage):
                self.generate(value)

    def test_incomplete_and_oversized_context_do_not_succeed(self):
        for metadata in ({'done': False}, {'done_reason': 'length'}, {'prompt_eval_count': 16384}):
            with self.subTest(metadata=metadata), self.assertRaises(model_client.ModelFailure):
                self.generate('Hei!', **metadata)


if __name__ == '__main__':
    unittest.main()
