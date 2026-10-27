"""One active question, shared deadline and explicit query/model budgets."""
import asyncio
import json
import threading
import time
from concurrent.futures import ThreadPoolExecutor
import model_client
import read_store

_active = threading.Lock()
_worker = ThreadPoolExecutor(max_workers=1, thread_name_prefix='answer')


class Busy(Exception):
    pass


class InvalidRequest(Exception):
    pass


def fallback(request_id):
    return {'request_id': request_id, 'status': 'cannot_answer',
            'answer': 'Jeg kan ikke besvare spørsmålet med de tilgjengelige, tillatte dataene innen grensene.'}


def work(payload, deadline):
    try:
        queries = 0
        if payload.get('game_id') is not None:
            queries += 1
            if not read_store.game_exists(payload['game_id'], deadline):
                raise InvalidRequest()
        messages = [{'role': 'system', 'content': model_client.SYSTEM},
                    {'role': 'user', 'content': json.dumps(payload, ensure_ascii=False)}]
        data_retrieved = False
        for _ in range(4):
            if time.monotonic() >= deadline:
                raise TimeoutError()
            try:
                message = model_client.generate(messages, deadline)
            except model_client.ContextTooLarge:
                return fallback(payload['request_id'])
            except model_client.InvalidModelMessage:
                messages.append({'role': 'user', 'content': 'Ugyldig modellformat. Returner ett objekt etter avtalt JSON-skjema.'})
                continue
            if message['type'] == 'answer':
                if message['status'] in ('ok', 'no_data') and not data_retrieved:
                    messages.append({'role': 'user', 'content': 'Hent faktisk relevant datagrunnlag før du svarer ok eller no_data.'})
                    continue
                return {'request_id': payload['request_id'], 'status': message['status'], 'answer': message['answer']}
            if queries >= 3:
                return fallback(payload['request_id'])
            queries += 1  # Rejected policy proposals also consume the budget.
            try:
                result = read_store.query(message['sql'], message['parameters'], deadline)
                data_retrieved = True
            except read_store.ResultTooLarge:
                result = {'error': 'RESULT_TOO_LARGE', 'instruction': 'Avgrens eller aggreger. Ingen delrader er gitt.'}
            except ValueError:
                result = {'error': 'QUERY_REJECTED', 'instruction': 'Bruk bare tillatt lesende SQL og separate parametere.'}
            messages.append({'role': 'assistant', 'content': json.dumps(message, ensure_ascii=False)})
            messages.append({'role': 'user', 'content': json.dumps({'database_result': result, 'queries_remaining': 3-queries}, ensure_ascii=False)})
        return fallback(payload['request_id'])
    finally:
        # A client disconnect/deadline cannot free this slot while a worker lives.
        _active.release()


async def answer(payload):
    if not _active.acquire(blocking=False):
        raise Busy()
    deadline = time.monotonic()+60
    try:
        pending = _worker.submit(work, payload, deadline)
    except BaseException:
        _active.release()
        raise
    future = asyncio.wrap_future(pending)
    # Shield work from client cancellation. The worker owns the slot until done.
    try:
        return await asyncio.wait_for(asyncio.shield(future), timeout=60)
    except (TimeoutError, asyncio.CancelledError):
        future.add_done_callback(lambda done: None if done.cancelled() else done.exception())
        raise
