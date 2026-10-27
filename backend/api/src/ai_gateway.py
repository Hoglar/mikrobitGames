"""Only API HTTP client for the AI service. No database resource crosses this call."""
import asyncio
import os
from uuid import UUID
import httpx
from errors import ServiceError


def validate_response(payload, expected_request_id):
    if not isinstance(payload, dict) or set(payload) != {'request_id', 'status', 'answer'}:
        raise ValueError('Ugyldig svarformat.')
    try:
        if type(payload['request_id']) is not str or UUID(payload['request_id']) != UUID(str(expected_request_id)):
            raise ValueError('Feil forespørsels-ID.')
    except (TypeError, AttributeError, ValueError):
        raise ValueError('Feil forespørsels-ID.') from None
    if payload['status'] not in ('ok', 'no_data', 'cannot_answer') or type(payload['answer']) is not str or not 1 <= len(payload['answer']) <= 4000:
        raise ValueError('Ugyldig svar.')
    return payload


async def answer(request_id, player_id, question, game_id=None):
    payload = {'request_id': request_id, 'player_id': str(player_id), 'question': question.strip()}
    if game_id is not None:
        payload['game_id'] = str(game_id)
    try:
        async with asyncio.timeout(60):
            async with httpx.AsyncClient(trust_env=False, timeout=60, follow_redirects=False) as client:
                async with client.stream('POST', os.environ['MBG_AI_URL'].rstrip('/')+'/v1/answer', json=payload) as response:
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
                    if response.status_code == 500 and result['error'] == 'INTERNAL_ERROR':
                        raise ServiceError('AI_UNAVAILABLE', 503)
                    raise ValueError('Uventet AI-feil.')
    except (TimeoutError, httpx.TimeoutException):
        raise ServiceError('AI_TIMEOUT', 504) from None
    except httpx.RequestError:
        raise ServiceError('AI_UNAVAILABLE', 503) from None
    except (ValueError, UnicodeError):
        raise ServiceError('INVALID_AI_RESPONSE', 502) from None
