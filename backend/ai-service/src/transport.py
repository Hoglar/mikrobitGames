"""Local API–AI HTTP contract; no database or model access outside orchestrator."""
from copy import deepcopy
import json
from uuid import UUID
from fastapi import FastAPI, Request
from starlette.responses import JSONResponse
import orchestrator

UUID_SCHEMA = {'type': 'string', 'format': 'uuid'}
REQUEST = {'type': 'object', 'additionalProperties': False, 'required': ['request_id', 'player_id', 'question'],
    'properties': {'request_id': UUID_SCHEMA, 'player_id': UUID_SCHEMA,
        'question': {'type': 'string', 'minLength': 1, 'maxLength': 1000},
        'game_id': {'type': ['string', 'null'], 'format': 'uuid'}}}
ANSWER = {'type': 'object', 'additionalProperties': False, 'required': ['request_id', 'status', 'answer'],
    'properties': {'request_id': UUID_SCHEMA, 'status': {'type': 'string', 'enum': ['ok', 'no_data', 'cannot_answer']},
        'answer': {'type': 'string', 'minLength': 1, 'maxLength': 4000}}}


def failure(code, request_id, status):
    return JSONResponse({'request_id': request_id, 'error': code}, status_code=status, headers={'Cache-Control': 'no-store'})


app = FastAPI(title='Mikrobit Games AI', version='1.2', docs_url=None, redoc_url=None)


@app.post('/v1/answer')
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
        Draft202012Validator(REQUEST, format_checker=FormatChecker()).validate(value)
        if not value['question'].strip():
            raise ValueError()
    except Exception:
        return failure('INVALID_REQUEST', request_id, 400)
    try:
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
    return {'openapi': '3.1.0', 'info': {'title': app.title, 'version': app.version}, 'paths': {'/v1/answer': {'post': {
        'requestBody': {'required': True, 'content': {'application/json': {'schema': REQUEST}}}, 'responses': responses}}}}


app.openapi = openapi
