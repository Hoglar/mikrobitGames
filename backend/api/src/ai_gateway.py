"""Only API HTTP client for the AI service. No database resource crosses this call."""
import asyncio
import os
import hashlib
import secrets
from uuid import UUID
import httpx
from errors import ServiceError

_conversation_key = secrets.token_bytes(32)


def conversation_id(token):
    # An opaque per-login handle, not the cookie, its hash, or a DB session ID.
    # It changes on API restart; no authentication secret reaches the AI.
    digest = hashlib.blake2b(token.encode(), key=_conversation_key, digest_size=16).digest()
    return str(UUID(bytes=digest, version=4))


def validate_response(payload, expected_request_id):
    if not isinstance(payload, dict) or not {'request_id', 'status', 'answer'} <= set(payload) or set(payload)-{'request_id', 'status', 'answer', 'notices'}:
        raise ValueError('Ugyldig svarformat.')
    try:
        if type(payload['request_id']) is not str or UUID(payload['request_id']) != UUID(str(expected_request_id)):
            raise ValueError('Feil forespørsels-ID.')
    except (TypeError, AttributeError, ValueError):
        raise ValueError('Feil forespørsels-ID.') from None
    if payload['status'] not in ('ok', 'no_data', 'cannot_answer') or type(payload['answer']) is not str or not 1 <= len(payload['answer']) <= 4000:
        raise ValueError('Ugyldig svar.')
    if 'notices' in payload and (type(payload['notices']) is not list or len(payload['notices']) > 21 or
            any(type(item) is not str or not 1 <= len(item) <= 200 for item in payload['notices'])):
        raise ValueError('Ugyldig minnevarsel.')
    return payload


async def answer(request_id, player_id, question=None, game_id=None, *, token, player_name, reset=False):
    payload = {'request_id': request_id, 'player_id': str(player_id), 'player_name': player_name,
               'conversation_id': conversation_id(token)}
    if not reset:
        payload['question'] = question.strip()
    if game_id is not None:
        payload['game_id'] = str(game_id)
    try:
        async with asyncio.timeout(60):
            async with httpx.AsyncClient(trust_env=False, timeout=60, follow_redirects=False) as client:
                path = '/v1/conversation/reset' if reset else '/v1/answer'
                async with client.stream('POST', os.environ['MBG_AI_URL'].rstrip('/')+path, json=payload) as response:
                    data = bytearray()
                    async for chunk in response.aiter_bytes():
                        data.extend(chunk)
                        if len(data) > 65536:
                            raise ValueError('For stort svar.')
                    import json
                    result = json.loads(data)
                    if response.status_code == 200:
                        return validate_response(result, request_id)
                    if not isinstance(result, dict) or set(result) != {'request_id', 'error'} or result['request_id'] != request_id:
                        raise ValueError('Ugyldig feilformat.')
                    if response.status_code == 503 and result['error'] == 'AI_BUSY':
                        raise ServiceError('AI_BUSY', 503)
                    if response.status_code == 400 and result['error'] == 'INVALID_REQUEST':
                        raise ServiceError('INVALID_REQUEST', 400)
                    if response.status_code == 500 and result['error'] == 'INTERNAL_ERROR':
                        raise ServiceError('AI_UNAVAILABLE', 503)
                    raise ValueError('Uventet AI-feil.')
    except (TimeoutError, httpx.TimeoutException):
        raise ServiceError('AI_TIMEOUT', 504) from None
    except httpx.RequestError:
        raise ServiceError('AI_UNAVAILABLE', 503) from None
    except (ValueError, UnicodeError):
        raise ServiceError('INVALID_AI_RESPONSE', 502) from None
