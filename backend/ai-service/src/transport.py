"""Local API–AI HTTP contract; no database or model access outside orchestrator."""
from copy import deepcopy
from contextlib import asynccontextmanager, suppress
import asyncio
import json
from uuid import UUID
from fastapi import FastAPI, Request
from starlette.responses import JSONResponse
import orchestrator

UUID_SCHEMA = {'type': 'string', 'format': 'uuid'}
IDENTITY = {'request_id': UUID_SCHEMA, 'player_id': UUID_SCHEMA, 'conversation_id': UUID_SCHEMA,
            'player_name': {'type': 'string', 'minLength': 3, 'maxLength': 32, 'pattern': '^[A-Za-z0-9_-]+$'}}
REQUEST = {'type': 'object', 'additionalProperties': False, 'required': [*IDENTITY, 'question'],
    'properties': {**IDENTITY,
        'question': {'type': 'string', 'minLength': 1, 'maxLength': 1000},
        'game_id': {'type': ['string', 'null'], 'format': 'uuid'}}}
ANSWER = {'type': 'object', 'additionalProperties': False, 'required': ['request_id', 'status', 'answer'],
    'properties': {'request_id': UUID_SCHEMA, 'status': {'type': 'string', 'enum': ['ok', 'no_data', 'cannot_answer']},
        'answer': {'type': 'string', 'minLength': 1, 'maxLength': 4000},
        'notices': {'type': 'array', 'maxItems': 21, 'items': {'type': 'string', 'minLength': 1, 'maxLength': 200}}}}
RESET = {'type': 'object', 'additionalProperties': False, 'required': list(IDENTITY), 'properties': IDENTITY}


def failure(code, request_id, status):
    return JSONResponse({'request_id': request_id, 'error': code}, status_code=status, headers={'Cache-Control': 'no-store'})


@asynccontextmanager
async def lifespan(app):
    async def clean():
        while True:
            await asyncio.sleep(60)
            orchestrator.expire_sessions()
    task = asyncio.create_task(clean())
    try:
        yield
    finally:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


app = FastAPI(title='Mikrobit Games AI', version='1.3', lifespan=lifespan, docs_url=None, redoc_url=None)


@app.post('/v1/answer')
@app.post('/v1/conversation/reset')
async def answer(request: Request):
    request_id = None
    try:
        chunks, size = [], 0
        async for chunk in request.stream():
            size += len(chunk)
            if size > 16384:
                raise ValueError()
            chunks.append(chunk)
        value = json.loads(b''.join(chunks))
        if isinstance(value, dict) and type(value.get('request_id')) is str:
            try:
                request_id = str(UUID(value['request_id']))
            except ValueError:
                pass
        if request.headers.get('content-type', '').split(';')[0] != 'application/json' or request.query_params:
            raise ValueError()
        from jsonschema import Draft202012Validator, FormatChecker
        resetting = request.url.path == '/v1/conversation/reset'
        Draft202012Validator(RESET if resetting else REQUEST, format_checker=FormatChecker()).validate(value)
        for key in ('player_id', 'conversation_id'):
            value[key] = str(UUID(value[key]))
        if not resetting and not value['question'].strip():
            raise ValueError()
    except Exception:
        return failure('INVALID_REQUEST', request_id, 400)
    try:
        if resetting:
            result = orchestrator.reset(value)
        else:
            value['question'] = value['question'].strip()
            result = await orchestrator.answer(value)
        Draft202012Validator(ANSWER, format_checker=FormatChecker()).validate(result)
        return JSONResponse(result, headers={'Cache-Control': 'no-store'})
    except orchestrator.Busy:
        return failure('AI_BUSY', request_id, 503)
    except orchestrator.InvalidRequest:
        return failure('INVALID_REQUEST', request_id, 400)
    except Exception:
        return failure('INTERNAL_ERROR', request_id, 500)


def openapi():
    responses = {'200': {'description': 'Svar', 'content': {'application/json': {'schema': ANSWER}}}}
    for status, code in [('400', 'INVALID_REQUEST'), ('503', 'AI_BUSY'), ('500', 'INTERNAL_ERROR')]:
        schema = {'type': 'object', 'additionalProperties': False, 'required': ['request_id', 'error'],
            'properties': {'request_id': {'type': ['string', 'null'], 'format': 'uuid'}, 'error': {'type': 'string', 'const': code}}}
        responses[status] = {'description': 'Feil', 'content': {'application/json': {'schema': schema}}}
    return {'openapi': '3.1.0', 'info': {'title': app.title, 'version': app.version}, 'paths': {
        path: {'post': {'requestBody': {'required': True, 'content': {'application/json': {'schema': schema}}}, 'responses': deepcopy(responses)}}
        for path, schema in (('/v1/answer', REQUEST), ('/v1/conversation/reset', RESET))}}


app.openapi = openapi
