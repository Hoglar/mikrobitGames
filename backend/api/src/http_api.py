"""Local HTTP API. Executable schema declarations drive validation and extraction."""
from collections import OrderedDict, deque
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import asyncio
import json
import math
import os
import re
import time
from uuid import UUID, uuid4

from fastapi import FastAPI, Request
from starlette.exceptions import HTTPException
from starlette.responses import JSONResponse, Response
from starlette.concurrency import run_in_threadpool
from jsonschema import ValidationError
import auth_service
import score_service
import ai_gateway
import database
import schemas
from errors import ServiceError

COOKIE = '__Host-mbg_session'


@asynccontextmanager
async def lifespan(app):
    database.start()
    yield
    database.close()


app = FastAPI(title='Mikrobit Games API', version='0.2.0', lifespan=lifespan, docs_url=None, redoc_url=None)
_declared = {}


def normalize(value, key=None):
    if isinstance(value, dict):
        return {k: normalize(v, k) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [normalize(v) for v in value]
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')
    if isinstance(value, str) and key in ('created_at', 'expires_at', 'absolute_expires_at'):
        return datetime.fromisoformat(value).astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')
    return value


def error_response(exc, request_id):
    headers = {'X-Request-ID': request_id, 'Cache-Control': 'no-store'}
    if exc.retry_after:
        headers['Retry-After'] = str(exc.retry_after)
    return JSONResponse({'request_id': request_id, 'error': {'code': exc.code, 'message': exc.message}}, status_code=exc.status, headers=headers)


class WindowLimiter:
    """Bounded memory, expiry cleanup, no permanent account lockouts."""
    def __init__(self):
        self.windows = OrderedDict()

    def check(self, key, maximum, seconds, add=True):
        now = time.monotonic()
        # At most 10,000 keys, each at most 60 timestamps; key length is bounded.
        for stale in list(self.windows):
            queue, duration = self.windows[stale]
            while queue and queue[0] <= now-duration:
                queue.popleft()
            if not queue:
                del self.windows[stale]
        if key not in self.windows:
            if len(self.windows) >= 10000:
                raise ServiceError('RATE_LIMITED', 429, retry_after=60)
            if not add:
                return
            self.windows[key] = (deque(), seconds)
        queue, _ = self.windows[key]
        if len(queue) >= maximum:
            raise ServiceError('RATE_LIMITED', 429, retry_after=max(1, math.ceil(queue[0]+seconds-now)))
        if add:
            queue.append(now)

    def failure(self, key):
        self.check(key, 10, 300)


limiter = WindowLimiter()
SENSITIVE = {'/api/v1/auth/register', '/api/v1/auth/login', '/api/v1/account/password', '/api/v1/account/delete'}


@app.middleware('http')
async def envelope(request, call_next):
    request_id = str(uuid4())
    request.state.request_id = request_id
    bucket = {'ms': 0., 'calls': 0}
    marker = database.metrics.set(bucket)
    try:
        if request.method == 'POST':
            origin = request.headers.get('origin')
            if origin is None:
                match = re.match(r'^(https?://[^/?#]+)(?:[/?#]|$)', request.headers.get('referer', ''))
                origin = match[1] if match else None
            if request.headers.get('x-mbg-request') != '1' or origin != os.environ.get('MBG_PUBLIC_ORIGIN') or origin in (None, 'null'):
                raise ServiceError('FORBIDDEN', 403)
            if request.headers.get('content-type', '').split(';')[0].strip().lower() != 'application/json':
                raise ServiceError('UNSUPPORTED_MEDIA_TYPE', 415)
            if request.url.path in SENSITIVE:
                limiter.check(('ip', request.client.host if request.client else 'unknown'), 60, 60)
        # Consume incrementally so a missing/forged Content-Length cannot bypass the cap.
        chunks, size = [], 0
        async for chunk in request.stream():
            size += len(chunk)
            if size > 16384:
                raise ServiceError('REQUEST_TOO_LARGE', 413)
            chunks.append(chunk)
        request._body = b''.join(chunks)
        response = await call_next(request)
    except ServiceError as exc:
        response = error_response(exc, request_id)
    except Exception:
        # Do not log arbitrary exception messages: drivers/frameworks may include secrets.
        response = error_response(ServiceError('INTERNAL_ERROR', 500), request_id)
    finally:
        database.metrics.reset(marker)
    response.headers['X-Request-ID'] = request_id
    response.headers['Cache-Control'] = 'no-store'
    if os.environ.get('MBG_TEST_METRICS') == '1' and bucket['calls']:
        response.headers['Server-Timing'] = f"db;dur={bucket['ms']:.3f}"
    return response


@app.exception_handler(ServiceError)
async def service_error(request, exc):
    return error_response(exc, request.state.request_id)


@app.exception_handler(HTTPException)
async def http_error(request, exc):
    return error_response(ServiceError('METHOD_NOT_ALLOWED' if exc.status_code == 405 else 'NOT_FOUND', exc.status_code), request.state.request_id)


def session_cookie(response, token, expires):
    seconds = max(0, math.floor((expires-datetime.now(timezone.utc)).total_seconds()))
    response.set_cookie(COOKIE, token, max_age=seconds, expires=expires,
                        secure=True, httponly=True, samesite='lax', path='/')


def clear_cookie(response):
    response.delete_cookie(COOKIE, path='/', secure=True, httponly=True, samesite='lax')


async def parse_request(request, operation):
    params = operation.get('parameters', [])
    allowed = {p['name']: p for p in params if p['in'] == 'query'}
    if set(request.query_params) - set(allowed) or any(len(request.query_params.getlist(k)) != 1 for k in request.query_params):
        raise ServiceError('INVALID_REQUEST', 400)
    query = {}
    for name, param in allowed.items():
        rule = param['schema']
        raw = request.query_params.get(name)
        if raw is None:
            if 'default' in rule:
                query[name] = rule['default']
            continue
        try:
            if rule['type'] == 'integer':
                if not re.fullmatch(r'[0-9]+', raw):
                    raise ValueError()
                value = int(raw)
                if value < rule.get('minimum', 0) or value > rule.get('maximum', value):
                    raise ValueError()
            elif rule['type'] == 'boolean':
                if raw not in ('true', 'false'):
                    raise ValueError()
                value = raw == 'true'
            else:
                value = str(UUID(raw))
            query[name] = value
        except (ValueError, TypeError):
            raise ServiceError('INVALID_REQUEST', 400) from None
    try:
        paths = {k: str(UUID(v)) for k, v in request.path_params.items()}
        body = None
        if 'requestBody' in operation:
            body = json.loads((await request.body()).decode('utf-8'), parse_constant=lambda _: (_ for _ in ()).throw(ValueError()))
            name = operation['requestBody']['content']['application/json']['schema']['$ref'].rsplit('/', 1)[1]
            schemas.validate(name, body)
            if 'username' in body:
                auth_service.normalize_username(body['username'])
    except (ValueError, UnicodeError, ValidationError):
        raise ServiceError('INVALID_REQUEST', 400) from None
    return paths, query, body


def route(path, method, action, success, **options):
    op = schemas.operation(method, path, success, **options)
    full_path = '/api/v1'+path
    _declared.setdefault(full_path, {})[method] = op

    async def endpoint(request: Request):
        paths, query, body = await parse_request(request, op)
        token = request.cookies.get(COOKIE)
        if token and len(token) > 256:
            token = None
        status = options.get('status', 200)
        auth_token, clear = None, False
        password_key = None
        if full_path in SENSITIVE and action != 'register':
            if action == 'login':
                username = body['username'].lower()
            else:
                identity = await run_in_threadpool(auth_service.identity, token)
                username = identity['username'].lower()
            password_key = ('password', request.client.host if request.client else 'unknown', username)
            limiter.check(password_key, 10, 300, add=False)
        try:
            if action == 'register':
                result = await run_in_threadpool(auth_service.register, **body)
            elif action == 'login':
                result, auth_token = await run_in_threadpool(auth_service.login, **body)
            elif action == 'session':
                result = await run_in_threadpool(auth_service.session, token)
            elif action == 'renew':
                result = await run_in_threadpool(auth_service.renew, token)
                auth_token = token
            elif action == 'logout':
                await run_in_threadpool(auth_service.logout, token)
                result, clear = None, True
            elif action in ('change_password', 'delete_account'):
                func = auth_service.change_password if action == 'change_password' else auth_service.delete_account
                await run_in_threadpool(func, token, **body)
                result, clear = None, True
            elif action == 'submit':
                result, created = await run_in_threadpool(score_service.submit, token, paths['game_id'], body)
                status = 201 if created else 200
            elif action == 'attempts':
                result = await run_in_threadpool(score_service.attempts, token, **query)
            elif action == 'attempt':
                result = await run_in_threadpool(score_service.attempt, token, paths['attempt_id'])
            elif action == 'ai':
                identity = await run_in_threadpool(auth_service.identity, token)
                # The session operation has committed and released its pool slot.
                result = await ai_gateway.answer(request.state.request_id, identity['id'], **body)
            elif action == 'health':
                await run_in_threadpool(database.ready)
                result = {'status': 'ok'}
            else:
                result = await run_in_threadpool(getattr(score_service, action), **paths, **query)
        except ServiceError as exc:
            if password_key and exc.code in ('INVALID_CREDENTIALS', 'CURRENT_PASSWORD_INCORRECT'):
                limiter.failure(password_key)
            raise
        if status == 204:
            response = Response(status_code=204)
        else:
            result = normalize(result)
            schemas.validate(success, result)
            response = JSONResponse(result, status_code=status)
        if auth_token:
            session_cookie(response, auth_token, result['expires_at'] if isinstance(result['expires_at'], datetime) else datetime.fromisoformat(result['expires_at']))
        if clear:
            clear_cookie(response)
        return response

    app.add_api_route(full_path, endpoint, methods=[method.upper()], name=action)


WRITE = {429: ['RATE_LIMITED']}
route('/auth/register', 'post', 'register', 'Player', status=201, body='Credentials', extra_errors={409: ['USERNAME_TAKEN'], **WRITE})
route('/auth/login', 'post', 'login', 'Session', body='Credentials', cookie=True, extra_errors={401: ['INVALID_CREDENTIALS'], **WRITE})
route('/auth/session', 'get', 'session', 'Session', private=True)
route('/auth/renew', 'post', 'renew', 'Session', body='EmptyRequest', private=True, cookie=True)
route('/auth/logout', 'post', 'logout', None, status=204, body='EmptyRequest', optional_auth=True, cookie=True)
route('/account/password', 'post', 'change_password', None, status=204, body='PasswordChange', private=True, cookie=True,
      extra_errors={403: ['FORBIDDEN', 'CURRENT_PASSWORD_INCORRECT'], **WRITE})
route('/account/delete', 'post', 'delete_account', None, status=204, body='PasswordConfirmation', private=True, cookie=True,
      extra_errors={403: ['FORBIDDEN', 'CURRENT_PASSWORD_INCORRECT'], **WRITE})
route('/games', 'get', 'games', 'GamePage', paged=True,
      extra_query=[schemas.parameter('include_inactive', 'query', {'type': 'boolean', 'default': False})])
route('/games/{game_id}', 'get', 'game', 'Game')
route('/games/{game_id}/leaderboard', 'get', 'leaderboard', 'LeaderboardPage', paged=True)
route('/games/{game_id}/results', 'post', 'submit', 'ResultResponse', status=201, body='ResultRequest', private=True,
      extra_errors={400: ['INVALID_REQUEST', 'INVALID_RESULT'], 409: ['GAME_INACTIVE', 'ATTEMPT_CONFLICT']})
_declared['/api/v1/games/{game_id}/results']['post']['responses']['200'] = schemas.response('ResultResponse')
route('/account/results', 'get', 'attempts', 'AttemptPage', private=True, paged=True,
      extra_query=[schemas.parameter('game_id', 'query', schemas.UUID, False)], extra_errors={404: ['NOT_FOUND']})
route('/account/results/{attempt_id}', 'get', 'attempt', 'Attempt', private=True)
route('/players/{player_id}', 'get', 'player', 'Player')
route('/players/{player_id}/records', 'get', 'player_records', 'PlayerRecordPage', paged=True)
route('/players/{player_id}/games/{game_id}/records', 'get', 'history', 'HistoryPage', paged=True)
route('/ai/questions', 'post', 'ai', 'AIAnswer', body='AIQuestion', private=True,
      extra_errors={503: ['SERVICE_UNAVAILABLE', 'AI_BUSY', 'AI_UNAVAILABLE'], 502: ['INVALID_AI_RESPONSE'], 504: ['AI_TIMEOUT']})
route('/health', 'get', 'health', 'Health')


def openapi():
    # Extract the declarations actually used by the registered handlers.
    return {'openapi': '3.1.0', 'info': {'title': app.title, 'version': app.version},
            'paths': _declared, 'security': [], 'components': {'schemas': schemas.SCHEMAS,
            'securitySchemes': {'sessionCookie': {'type': 'apiKey', 'in': 'cookie', 'name': COOKIE}}}}


app.openapi = openapi
