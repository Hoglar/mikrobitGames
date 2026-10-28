"""Executable JSON Schema declarations used by HTTP validation and OpenAPI.

Kept in application code: no runtime reading of contracts or test fixtures.
"""
from copy import deepcopy
from jsonschema import Draft202012Validator, FormatChecker, validators

UUID = {'type': 'string', 'format': 'uuid'}
TIME = {'type': 'string', 'format': 'date-time', 'pattern': 'Z$'}
VALUE = {'type': 'integer', 'minimum': 0, 'maximum': 9007199254740991}
USERNAME = {'type': 'string', 'minLength': 3, 'maxLength': 32, 'pattern': '^[A-Za-z0-9_-]+$'}
OUTCOMES = ['created', 'already_recorded', 'not_improved', 'not_eligible']
CODES = ['INVALID_REQUEST', 'INVALID_RESULT', 'AUTH_REQUIRED', 'INVALID_CREDENTIALS', 'FORBIDDEN',
         'CURRENT_PASSWORD_INCORRECT', 'NOT_FOUND', 'METHOD_NOT_ALLOWED', 'USERNAME_TAKEN',
         'GAME_INACTIVE', 'REQUEST_TOO_LARGE', 'UNSUPPORTED_MEDIA_TYPE', 'RATE_LIMITED',
         'INTERNAL_ERROR', 'SERVICE_UNAVAILABLE', 'OUTCOME_UNKNOWN', 'AI_BUSY', 'AI_UNAVAILABLE',
         'AI_TIMEOUT', 'INVALID_AI_RESPONSE', 'ATTEMPT_CONFLICT']


def obj(properties, required=None):
    return {'type': 'object', 'additionalProperties': False,
            'required': list(properties) if required is None else required, 'properties': properties}


def ref(name):
    return {'$ref': '#/components/schemas/'+name}


def nullable(schema):
    return {'anyOf': [schema, {'type': 'null'}]}


def password(minimum=12):
    return {'type': 'string', 'minLength': minimum, 'maxLength': 128, 'writeOnly': True}


SCHEMAS = {
    'Player': obj({'id': UUID, 'username': USERNAME, 'created_at': TIME}),
    'Game': obj({'id': UUID, 'name': {'type': 'string', 'minLength': 1, 'maxLength': 100},
        'score_unit': {'type': 'string', 'minLength': 1, 'maxLength': 32},
        'ranking_direction': {'type': 'string', 'enum': ['higher_is_better', 'lower_is_better']},
        'min_value': VALUE, 'max_value': VALUE, 'is_active': {'type': 'boolean'}}),
    'Record': obj({'id': UUID, 'player_id': UUID, 'game_id': UUID, 'value': VALUE, 'created_at': TIME}),
    'Session': obj({'player': ref('Player'), 'expires_at': TIME, 'absolute_expires_at': TIME}),
    'Credentials': obj({'username': USERNAME, 'password': password()}),
    'PasswordChange': obj({'current_password': password(1), 'new_password': password()}),
    'PasswordConfirmation': obj({'current_password': password(1)}),
    'EmptyRequest': obj({}),
    'ResultRequest': obj({'attempt_id': UUID, 'status': {'type': 'string', 'enum': ['completed', 'incomplete']},
                          'value': {**VALUE, 'type': ['integer', 'null']}}),
    'Attempt': obj({'id': UUID, 'player_id': UUID, 'game_id': UUID,
        'status': {'type': 'string', 'enum': ['completed', 'incomplete']},
        'value': {**VALUE, 'type': ['integer', 'null']}, 'created_at': TIME,
        'record_outcome': {'type': 'string', 'enum': OUTCOMES}, 'record_id': {**UUID, 'type': ['string', 'null']}}),
    'LeaderboardEntry': obj({'rank': {'type': 'integer', 'minimum': 1}, 'player': ref('Player'), 'record': ref('Record')}),
    'GameRecord': obj({'game': ref('Game'), 'record': ref('Record')}),
    'AIQuestion': obj({'question': {'type': 'string', 'minLength': 1, 'maxLength': 1000, 'pattern': r'\S'},
                       'game_id': {**UUID, 'type': ['string', 'null']}}, ['question']),
    'AIAnswer': obj({'request_id': UUID, 'status': {'type': 'string', 'enum': ['ok', 'no_data', 'cannot_answer']},
                     'answer': {'type': 'string', 'minLength': 1, 'maxLength': 4000},
                     'notices': {'type': 'array', 'maxItems': 21, 'items': {'type': 'string', 'minLength': 1, 'maxLength': 200}}},
                    ['request_id', 'status', 'answer']),
    'Health': obj({'status': {'type': 'string', 'const': 'ok'}}),
    'Error': obj({'request_id': UUID, 'error': obj({'code': {'type': 'string', 'enum': CODES},
                                                  'message': {'type': 'string', 'minLength': 1}})}),
    'ResultResponse': obj({'attempt': ref('Attempt'), 'outcome': {'type': 'string', 'enum': OUTCOMES},
        'record': nullable(ref('Record')), 'current_record': nullable(ref('Record'))}),
}
SCHEMAS['ResultRequest']['oneOf'] = [
    {'properties': {'status': {'const': 'completed'}, 'value': VALUE}},
    {'properties': {'status': {'const': 'incomplete'}}}]
SCHEMAS['Attempt']['oneOf'] = [
    {'properties': {'status': {'const': 'completed'}, 'value': VALUE,
        'record_outcome': {'enum': ['created', 'already_recorded']}, 'record_id': UUID}},
    {'properties': {'status': {'const': 'completed'}, 'value': VALUE,
        'record_outcome': {'const': 'not_improved'}, 'record_id': {'type': 'null'}}},
    {'properties': {'status': {'const': 'incomplete'}, 'record_outcome': {'const': 'not_eligible'}, 'record_id': {'type': 'null'}}}]
SCHEMAS['ResultResponse']['oneOf'] = []
for outcome in OUTCOMES:
    properties = {'outcome': {'const': outcome}, 'attempt': {'properties': {'record_outcome': {'const': outcome}}},
                  'record': ref('Record') if outcome in ('created', 'already_recorded') else {'type': 'null'}}
    if outcome != 'not_eligible':
        properties['current_record'] = ref('Record')
    SCHEMAS['ResultResponse']['oneOf'].append({'properties': properties})

for name, item, context in [
    ('GamePage', 'Game', {}), ('AttemptPage', 'Attempt', {}),
    ('LeaderboardPage', 'LeaderboardEntry', {'game': ref('Game')}),
    ('PlayerRecordPage', 'GameRecord', {'player': ref('Player')}),
    ('HistoryPage', 'Record', {'player': ref('Player'), 'game': ref('Game')})]:
    SCHEMAS[name] = obj({**context, 'page': {'type': 'integer', 'minimum': 0},
        'page_size': {'type': 'integer', 'minimum': 1, 'maximum': 100},
        'total': {'type': 'integer', 'minimum': 0}, 'items': {'type': 'array', 'items': ref(item)}})

# JSON Schema normally treats 1.0 as integer; the product explicitly forbids floats.
StrictValidator = validators.extend(Draft202012Validator,
    type_checker=Draft202012Validator.TYPE_CHECKER.redefine('integer', lambda checker, value: type(value) is int))


def validate(name, value):
    document = {**ref(name), 'components': {'schemas': SCHEMAS}}
    StrictValidator(document, format_checker=FormatChecker()).validate(value)


HEADERS = {'X-Request-ID': {'schema': UUID}, 'Cache-Control': {'schema': {'type': 'string', 'const': 'no-store'}}}


def response(name=None, codes=None, cookie=False, retry=False):
    result = {'description': 'Svar', 'headers': deepcopy(HEADERS)}
    if cookie:
        result['headers']['Set-Cookie'] = {'schema': {'type': 'string'}}
    if retry:
        result['headers']['Retry-After'] = {'schema': {'type': 'integer', 'minimum': 1}}
    if name:
        schema = ref(name)
        if codes:
            schema = {'allOf': [schema, {'properties': {'error': {'properties': {'code': {'enum': codes}}}}}]}
        result['content'] = {'application/json': {'schema': schema}}
    return result


def parameter(name, location, schema, required=None):
    result = {'name': name, 'in': location, 'schema': schema}
    if required is not None:
        result['required'] = required
    return result


def operation(method, path, success, status=200, body=None, private=False, paged=False, extra_query=None, extra_errors=None, cookie=False, optional_auth=False):
    params = [parameter(name, 'path', UUID, True) for name in ('player_id', 'game_id', 'attempt_id') if '{'+name+'}' in path]
    if paged:
        params += [parameter('page', 'query', {'type': 'integer', 'minimum': 0, 'default': 0}),
                   parameter('page_size', 'query', {'type': 'integer', 'minimum': 1, 'maximum': 100, 'default': 30})]
    params += extra_query or []
    errors = {400: ['INVALID_REQUEST'], 500: ['INTERNAL_ERROR'], 503: ['SERVICE_UNAVAILABLE']}
    if private:
        errors[401] = ['AUTH_REQUIRED']
    if '{' in path:
        errors[404] = ['NOT_FOUND']
    if method == 'post':
        params.append(parameter('X-MBG-Request', 'header', {'type': 'string', 'const': '1'}, True))
        errors.update({403: ['FORBIDDEN'], 413: ['REQUEST_TOO_LARGE'], 415: ['UNSUPPORTED_MEDIA_TYPE']})
        errors[503] = ['SERVICE_UNAVAILABLE', 'OUTCOME_UNKNOWN']
    errors.update(extra_errors or {})
    responses = {str(status): response(success, cookie=cookie),
                 **{str(code): response('Error', codes=codes, retry=code == 429) for code, codes in errors.items()},
                 'default': response('Error')}
    op = {'responses': responses, 'security': ([{}, {'sessionCookie': []}] if optional_auth else [{'sessionCookie': []}] if private else [])}
    if params:
        op['parameters'] = params
    if body:
        op['requestBody'] = {'required': True, 'content': {'application/json': {'schema': ref(body)}}}
    return op
