"""Conversation design revision: memory isolation, budgets and controlled tools."""
import unittest
from unittest.mock import Mock, patch
from pathlib import Path
import sys
from support import ROOT
sys.path.insert(0, str(ROOT / 'backend/ai-service/src'))
from orchestrator import Conversation
from model_client import pack
import read_store
from read_store import DataTools, InvalidTool
from model_client import MAX_TURNS, INPUT_BYTES
import orchestrator

ADA = '11111111-1111-4111-8111-111111111111'


def answer(text, kind='chat'):
    return {'type': 'answer', 'kind': kind, 'answer': text}


class ConversationChecks(unittest.TestCase):
    def test_greeting_does_not_require_database_and_followup_sees_history(self):
        model = Mock(side_effect=[answer('Hei, Ada!'), answer('Du sa hei.')])
        tools = Mock()
        chat = Conversation(model, tools, 'Ada')
        self.assertEqual(chat.ask('Hei')['status'], 'answer')
        chat.ask('Hva sa jeg?')
        messages = model.call_args.args[0]
        self.assertIn({'role': 'user', 'content': 'Hei'}, messages)
        tools.call.assert_not_called()

    def test_history_is_session_local_and_clear_removes_it(self):
        model = Mock(return_value=answer('Hei'))
        first = Conversation(model, Mock(), 'Ada')
        first.ask('Privat samtalemerke')
        second = Conversation(model, Mock(), 'Nora')
        second.ask('Hei')
        self.assertNotIn('Privat samtalemerke', pack(model.call_args.args[0]))
        first.clear()
        first.ask('Ny samtale')
        self.assertNotIn('Privat samtalemerke', pack(model.call_args.args[0]))

    def test_record_answer_requires_fresh_tool_result_each_turn(self):
        tool = {'type': 'tool', 'name': 'standings', 'args': {'game': 'Poengjakt'}}
        model = Mock(side_effect=[answer('Ada 120', 'records'), tool, answer('Ada 120', 'records'),
                                  answer('Ada 120', 'records'), tool, answer('Ada 120', 'records')])
        tools = Mock()
        tools.call.return_value = {'records': [{'player': 'Ada', 'value': 120}]}
        chat = Conversation(model, tools, 'Ada')
        self.assertEqual(chat.ask('Hvem leder?')['status'], 'answer')
        self.assertEqual(chat.ask('Og nå?')['status'], 'answer')
        self.assertEqual(tools.call.call_count, 2)

    def test_tool_and_model_budgets(self):
        model = Mock(return_value={'type': 'tool', 'name': 'shell', 'args': {'cmd': 'id'}})
        tools = Mock()
        tools.call.side_effect = InvalidTool('Ukjent verktøy')
        result = Conversation(model, tools, 'Ada').ask('Slett data')
        self.assertEqual(result['status'], 'limited')
        self.assertEqual(tools.call.call_count, 3)
        self.assertEqual(model.call_count, 4)

    def test_technical_error_is_not_no_data(self):
        model = Mock(return_value={'type': 'tool', 'name': 'standings', 'args': {'game': 'Sprint'}})
        tools = Mock()
        tools.call.side_effect = read_store.StoreUnavailable()
        chat = Conversation(model, tools, 'Ada')
        self.assertEqual(chat.ask('Hvem leder?')['status'], 'error')
        self.assertEqual(chat.turns, [])
        self.assertFalse(chat.busy.locked())

    def test_history_limit_notifies_and_does_not_keep_tool_data(self):
        model = Mock(return_value=answer('Hei'))
        chat = Conversation(model, Mock(), 'Ada')
        for i in range(MAX_TURNS+1):
            result = chat.ask(f'Hei {i}')
        self.assertEqual(len(chat.turns), MAX_TURNS)
        self.assertTrue(result['notices'])
        self.assertNotIn('Hei 0', pack(chat.turns))

    def test_oversized_current_tool_result_is_not_silently_truncated(self):
        model = Mock(return_value={'type': 'tool', 'name': 'games', 'args': {}})
        tools = Mock()
        tools.call.return_value = {'data': 'x'*(INPUT_BYTES+1)}
        result = Conversation(model, tools, 'Ada').ask('Hvilke spill?')
        self.assertEqual(result['status'], 'limited')
        self.assertEqual(model.call_count, 1)

    def test_tools_reject_sql_or_extra_identity_arguments_before_database(self):
        query = Mock()
        tools = DataTools(ADA, query)
        for name, args in [('sql', {'sql': 'SELECT * FROM app.sessions'}),
                           ('history', {'game': 'Sprint', 'player': 'me', 'player_id': 'fake'}),
                           ('games', {'schema': 'app'}), ('standings', {'game': ['Sprint']})]:
            with self.subTest(name=name), self.assertRaises(InvalidTool):
                tools.call(name, args, 0)
        query.assert_not_called()

    def test_model_text_is_bound_as_data(self):
        query = Mock(return_value={'columns': [], 'rows': []})
        value = "Sprint'; DELETE FROM app.players; --"
        DataTools(ADA, query).call('standings', {'game': value}, 100)
        sql, params, _ = query.call_args.args
        self.assertNotIn(value, sql)
        self.assertEqual(params, [value])


class SessionLifecycle(unittest.TestCase):
    def setUp(self):
        orchestrator._sessions.clear()

    def tearDown(self):
        orchestrator._sessions.clear()

    def payload(self, cid='33333333-3333-4333-8333-333333333333'):
        return {'request_id':cid,'conversation_id':cid,'player_id':ADA,'player_name':'Ada'}

    def test_idle_expiry_removes_memory(self):
        with patch.object(orchestrator.time, 'monotonic', return_value=100):
            original=orchestrator._conversation(self.payload())
            original.turns.append([{'role':'user','content':'MARKER'}, {'role':'assistant','content':'x'}])
        with patch.object(orchestrator.time, 'monotonic', return_value=100+orchestrator.SESSION_TTL):
            orchestrator.expire_sessions()
            self.assertEqual(orchestrator._sessions,{})
            self.assertEqual(orchestrator._conversation(self.payload()).turns,[])

    def test_capacity_and_ownership(self):
        with patch.object(orchestrator,'MAX_SESSIONS',2):
            for i in range(3):
                with patch.object(orchestrator.time,'monotonic',return_value=i+100):
                    orchestrator._conversation(self.payload(str(i)))
            self.assertEqual(set(orchestrator._sessions),{'1','2'})
            wrong={**self.payload('2'),'player_id':'22222222-2222-4222-8222-222222222222'}
            with patch.object(orchestrator.time,'monotonic',return_value=103), self.assertRaises(orchestrator.InvalidRequest):
                orchestrator._conversation(wrong)

    def test_reset_does_not_claim_success_while_worker_is_active(self):
        orchestrator._conversation(self.payload())
        orchestrator._active.acquire()
        try:
            with self.assertRaises(orchestrator.Busy):
                orchestrator.reset(self.payload())
            self.assertTrue(orchestrator._sessions)
        finally:
            orchestrator._active.release()
        orchestrator.reset(self.payload())
        self.assertEqual(orchestrator._sessions,{})


if __name__ == '__main__':
    unittest.main()
