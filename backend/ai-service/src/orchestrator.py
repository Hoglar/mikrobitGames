"""Session-bound conversations, one active worker and unchanged per-request budgets."""
import asyncio
import threading
import time
from concurrent.futures import ThreadPoolExecutor
import model_client
import read_store

SESSION_TTL = 1800
MAX_SESSIONS = 64
_sessions = {}
_sessions_lock = threading.Lock()
_active = threading.Lock()
_worker = ThreadPoolExecutor(max_workers=1, thread_name_prefix='answer')


class Busy(Exception): pass
class InvalidRequest(Exception): pass


def empty_result(result):
    if result.get('found') is False:
        return True
    if 'rows' in result:
        return not result['rows']
    if isinstance(result.get('games'), dict):
        return not result['games']['rows']
    return False


class Conversation:
    """Memory belongs to one trusted player selection and lives only in RAM."""
    def __init__(self, model, tools, player_name, game='Poengjakt'):
        self.model, self.tools = model, tools
        self.player_name, self.game = player_name, game
        self.turns = []
        self.busy = threading.Lock()

    def clear(self):
        self.turns.clear()

    def messages(self, current, notices):
        system = {'role': 'system', 'content': model_client.SYSTEM+'\nKontekst fra tjenesten: '+model_client.pack({'player': self.player_name, 'selected_game': self.game})}
        while True:
            messages = [system] + [message for pair in self.turns for message in pair] + current
            if sum(len(message['content'].encode()) for message in messages) <= model_client.INPUT_BYTES:
                return messages
            if not self.turns:
                raise model_client.ContextFull()
            self.turns.pop(0)
            notices.append('Den eldste utvekslingen ble glemt for å gi plass i samtalen.')

    def ask(self, question, *, deadline=None, tool_budget=3):
        if type(question) is not str or not 1 <= len(question.strip()) <= 1000:
            raise ValueError('Skriv 1–1000 tegn.')
        if not self.busy.acquire(blocking=False):
            return {'status': 'busy', 'answer': 'Assistenten arbeider allerede.', 'notices': [], 'tools': []}
        notices, trace = [], []
        user = {'role': 'user', 'content': question.strip()}
        current = [user]
        deadline = deadline or time.monotonic()+60
        attempts, evidence, no_data = 0, False, False
        try:
            for _ in range(4):
                try:
                    message = self.model(self.messages(current, notices), deadline)
                except model_client.InvalidModelMessage:
                    current.append({'role': 'user', 'content': 'Ugyldig handling. Bruk oppgitt JSON-format for verktøy eller et vanlig tekstsvar uten verktøykode.'})
                    continue
                if time.monotonic() >= deadline:
                    raise TimeoutError()
                if not isinstance(message, dict):
                    raise model_client.ModelFailure('Modellen returnerte ikke et JSON-objekt.')
                if message.get('type') == 'answer' and set(message) == {'type', 'kind', 'answer'}:
                    if message['kind'] not in ('chat', 'records') or type(message['answer']) is not str or not 1 <= len(message['answer']) <= 4000:
                        raise model_client.ModelFailure('Ugyldig svarformat.')
                    if message['kind'] == 'records' and not evidence:
                        current.append({'role': 'user', 'content': 'Hent relevante data med verktøy før faktasvaret.'})
                        continue
                    # Retain dialogue, not database snapshots or internal tool messages.
                    self.turns.append([user, {'role': 'assistant', 'content': model_client.pack(message)}])
                    if len(self.turns) > model_client.MAX_TURNS:
                        self.turns.pop(0)
                        notices.append(f'Den eldste utvekslingen ble glemt. Maks {model_client.MAX_TURNS} utvekslinger huskes.')
                    return {'status': 'answer', 'kind': message['kind'], 'outcome': 'no_data' if no_data and message['kind'] == 'records' else 'ok', 'answer': message['answer'], 'notices': notices, 'tools': trace}
                if message.get('type') != 'tool' or set(message) != {'type', 'name', 'args'}:
                    raise model_client.ModelFailure('Ukjent modellhandling.')
                if attempts >= tool_budget:
                    break
                attempts += 1
                try:
                    result = self.tools.call(message['name'], message['args'], deadline)
                    evidence = not (result.get('unknown_game') or result.get('ambiguous_game'))
                    no_data = empty_result(result)
                except read_store.InvalidTool as exc:
                    result = {'error': 'INVALID_TOOL', 'instruction': str(exc)}
                trace.append({'name': message['name'], 'args': message['args'], 'result': result})
                current.extend([{'role': 'assistant', 'content': model_client.pack(message)},
                                {'role': 'user', 'content': model_client.pack({'tool_result': result})}])
            return {'status': 'limited', 'answer': 'Jeg fikk ikke fullført svaret innen forsøksgrensen.', 'notices': notices, 'tools': trace}
        except model_client.ContextFull:
            return {'status': 'limited', 'answer': 'Dette spørsmålet eller datagrunnlaget er for stort for modellkonteksten. Prøv et smalere spørsmål.', 'notices': notices, 'tools': trace}
        except read_store.ResultTooLarge:
            return {'status': 'limited', 'answer': 'Datagrunnlaget er for stort. Ingen delresultater brukes.', 'notices': notices, 'tools': trace}
        except (model_client.ModelFailure, read_store.StoreUnavailable, TimeoutError):
            return {'status': 'error', 'answer': 'Modell- eller datahentingen feilet. Dette betyr ikke at rekorder mangler.', 'notices': notices, 'tools': trace}
        finally:
            self.busy.release()


def _expire_locked(now):
    for key in [key for key, entry in _sessions.items() if now-entry['used'] >= SESSION_TTL]:
        del _sessions[key]


def expire_sessions():
    with _sessions_lock:
        _expire_locked(time.monotonic())


def _conversation(payload):
    now = time.monotonic()
    key = payload['conversation_id']
    with _sessions_lock:
        _expire_locked(now)
        entry = _sessions.get(key)
        if entry is not None and entry['player_id'] != payload['player_id']:
            raise InvalidRequest()
        if entry is None:
            if len(_sessions) >= MAX_SESSIONS:
                del _sessions[min(_sessions, key=lambda item: _sessions[item]['used'])]
            entry = {'player_id': payload['player_id'], 'used': now,
                     'chat': Conversation(model_client.generate, read_store.DataTools(payload['player_id']), payload['player_name'], None)}
            _sessions[key] = entry
        entry['used'] = now
        entry['chat'].player_name = payload['player_name']
        return entry['chat']


def reset(payload):
    if not _active.acquire(blocking=False):
        raise Busy()
    try:
        with _sessions_lock:
            entry = _sessions.get(payload['conversation_id'])
            if entry is not None and entry['player_id'] != payload['player_id']:
                raise InvalidRequest()
            _sessions.pop(payload['conversation_id'], None)
        return {'request_id': payload['request_id'], 'status': 'ok', 'answer': 'Samtalen er slettet.'}
    finally:
        _active.release()


def work(payload, deadline):
    try:
        context = None
        tool_budget = 3
        if payload.get('game_id') is not None:
            tool_budget -= 1
            context = read_store.game_context(payload['game_id'], deadline)
            if context is None:
                raise InvalidRequest()
        chat = _conversation(payload)
        chat.game = context['name'] if context else None
        result = chat.ask(payload['question'], deadline=deadline, tool_budget=tool_budget)
        if result['status'] == 'error':
            raise RuntimeError('AI operation failed')
        if result['status'] == 'busy':
            raise Busy()
        status = result.get('outcome', 'ok') if result['status'] == 'answer' else 'cannot_answer'
        response = {'request_id': payload['request_id'], 'status': status, 'answer': result['answer']}
        if result['notices']:
            response['notices'] = result['notices']
        return response
    finally:
        _active.release()


async def answer(payload):
    if not _active.acquire(blocking=False):
        raise Busy()
    try:
        pending = _worker.submit(work, payload, time.monotonic()+60)
    except BaseException:
        _active.release()
        raise
    future = asyncio.wrap_future(pending)
    try:
        return await asyncio.wait_for(asyncio.shield(future), timeout=60)
    except (TimeoutError, asyncio.CancelledError):
        future.add_done_callback(lambda done: None if done.cancelled() else done.exception())
        raise
