"""Declarative cartridge scores; no package code or network access."""
import hashlib
import json
import re
from uuid import UUID, uuid5

MAX = 9007199254740991


def canonical(value):
    # Fingerprint data consists only of safe integer competition metadata.
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)


def contract(score):
    if type(score) is not dict or set(score) - {'fields', 'offset'}:
        raise ValueError('Ugyldig scoredefinisjon.')
    fields = score.get('fields')
    if type(fields) is not list or not 1 <= len(fields) <= 4:
        raise ValueError('Ugyldige scorefelt.')
    keys = set()
    maximum = 0
    for i, field in enumerate(fields):
        if type(field) is not dict or set(field) - {'key','label','min','max','direction','format','unit','radix'}:
            raise ValueError('Ugyldig scorefelt.')
        key = field.get('key')
        if type(key) is not str or not re.fullmatch(r'[a-z][a-zA-Z0-9]{0,31}', key) or key in keys:
            raise ValueError('Ugyldig feltnøkkel.')
        keys.add(key)
        lo, hi = field.get('min'), field.get('max')
        if type(lo) is not int or type(hi) is not int or not 0 <= lo <= hi <= MAX:
            raise ValueError('Ugyldige feltgrenser.')
        if field.get('direction') not in ('higher_is_better','lower_is_better') or field.get('format') not in ('integer','duration-ms'):
            raise ValueError('Ugyldig rangering.')
        width = hi - lo + 1
        radix = field.get('radix', width)
        if type(radix) is not int or (i and not width <= radix <= MAX) or (not i and 'radix' in field):
            raise ValueError('Ugyldig radix.')
        maximum = maximum * radix + width - 1 if i else width - 1
    offset = score.get('offset', 0)
    if type(offset) is not int or offset < 0 or (len(fields) == 1 and 'offset' in score):
        raise ValueError('Ugyldig offset.')
    maximum = fields[0]['max'] if len(fields) == 1 else maximum + offset
    if maximum > MAX:
        raise ValueError('Score overskrider sikkert heltall.')
    return (fields[0]['min'] if len(fields) == 1 else offset, maximum, fields[0]['direction'])


def decode(score, value):
    lo, hi, direction = contract(score)
    if type(value) is not int or not lo <= value <= hi:
        raise ValueError('Ugyldig score.')
    fields = score['fields']
    if len(fields) == 1:
        return {fields[0]['key']: value}
    n, result = value - score.get('offset', 0), {}
    for i in range(len(fields)-1, -1, -1):
        field = fields[i]
        radix = field.get('radix', field['max']-field['min']+1)
        if i:
            n, digit = divmod(n, radix)
        else:
            digit = n
        if not 0 <= digit <= field['max']-field['min']:
            raise ValueError('Ugyldig kodingshull.')
        result[field['key']] = field['min']+digit if field['direction']==direction else field['max']-digit
    return result


def metadata(game):
    mode, package_id = game['mode'], str(UUID(game['packageId']))
    if not re.fullmatch(r'[a-z][a-z0-9]*(?:-[a-z0-9]+)*', mode['id']) or type(mode['rulesVersion']) is not int or not 1 <= mode['rulesVersion'] <= 2147483647:
        raise ValueError('Ugyldig modus.')
    expected_id = mode.get('legacyGameId') or str(uuid5(UUID(package_id), mode['id']+':'+str(mode['rulesVersion'])))
    if game['id'] != expected_id or mode.get('legacyGameId') and mode['rulesVersion'] != 1:
        raise ValueError('Modus-ID stemmer ikke.')
    score = mode['score']
    lo, hi, direction = contract(score)
    if (lo, hi, direction) != (game['min_value'],game['max_value'],game['ranking_direction']):
        raise ValueError('Scorekontrakten stemmer ikke.')
    if not 1 <= len(game['name'].strip()) <= 100 or not 1 <= len(game['score_unit']) <= 32:
        raise ValueError('Ugyldig katalognavn/enhet.')
    rule = {'config': mode['config'], 'selection': mode.get('selection', {}),
            'score': {'offset': score.get('offset',0), 'fields': [
                {**{k:f[k] for k in ('key','min','max','direction')},
                 **({'radix':f.get('radix',f['max']-f['min']+1)} if i else {})}
                for i,f in enumerate(score['fields'])]}}
    # The trusted JS builder includes its exact canonical UTF-8 representation.
    # Verify the parsed data as well as its hash; Python float serialization must
    # not accidentally give 1.0, exponents, or Unicode keys another identity.
    def safe(value, depth=0, limit=8):
        if depth > limit: raise ValueError('For dype data.')
        if isinstance(value, dict):
            for key,item in value.items():
                if key in ('__proto__','prototype','constructor'): raise ValueError('Ugyldig config.')
                safe(item,depth+1,limit)
        elif isinstance(value,list):
            for item in value: safe(item,depth+1,limit)
    safe(rule,limit=16)
    safe(mode['config'])
    serialized=game.get('rulesCanonical')
    if type(serialized) is not str or len(serialized.encode())>32768 or json.loads(serialized)!=rule:
        raise ValueError('Kanoniske konkurransedata stemmer ikke.')
    fingerprint = hashlib.sha256(serialized.encode()).hexdigest()
    if fingerprint != game['rulesFingerprint'] or not re.fullmatch('[a-f0-9]{64}',game['contentHash']):
        raise ValueError('Ugyldig fingeravtrykk.')
    return {'codecVersion':1,'packageId':package_id,'modeId':mode['id'],'rulesVersion':mode['rulesVersion'],
            'rulesFingerprint':fingerprint,'contentHash':game['contentHash'],'score':score}
