"""Pure control logic. Never imports the application or opens a database."""
from collections import Counter

STATUSES = frozenset({'PASS', 'FAIL', 'SKIPPED', 'BLOCKED'})
REQUIREMENT_IDS = tuple(f'K{area}-{n}' for area in ('DB', 'API', 'AI') for n in range(1, 5))
MODEL_IDS = tuple(f'M{area}-{n}' for area, total in (('DB', 20), ('API', 4), ('AI', 4)) for n in range(1, total + 1))


def aggregate(statuses):
    """A failure must not hide unmeasured subtests."""
    statuses = list(statuses)
    if any(s not in STATUSES for s in statuses):
        raise ValueError('Unknown control status')
    if not statuses or 'BLOCKED' in statuses:
        return 'BLOCKED'
    if 'SKIPPED' in statuses:
        return 'SKIPPED'
    return 'FAIL' if 'FAIL' in statuses else 'PASS'


def fom(results, *, full):
    """Only the exact, complete control set can produce a pair of FoM values."""
    expected = set(REQUIREMENT_IDS + MODEL_IDS)
    if set(results) != expected:
        raise ValueError('Missing or unexpected control IDs')
    if any(status not in STATUSES for status in results.values()):
        raise ValueError('Unknown control status')
    if not full or any(status not in {'PASS', 'FAIL'} for status in results.values()):
        return None
    def score(prefix, counts):
        return 100 / 3 * sum(
            sum(results[f'{prefix}{area}-{n}'] == 'PASS' for n in range(1, total + 1)) / total
            for area, total in zip(('DB', 'API', 'AI'), counts)
        )
    return {'requirements_percent': score('K', (4, 4, 4)),
            'model_percent': score('M', (20, 4, 4))}


def _type(value):
    value = value.lower().strip()
    return {'int8': 'bigint', 'bool': 'boolean',
            'timestamp with time zone': 'timestamptz'}.get(
                value, value.replace('character varying', 'varchar'))


def _keys(values):
    # Sort constraints, not the column order within each constraint.
    return sorted(tuple(value) for value in values)


def _foreign_keys(values):
    return sorted((tuple(fk['columns']), fk['references'],
                   tuple(fk['referenced_columns']), fk['on_delete'].upper()) for fk in values)


def compare_database(expected, observed):
    """Compare a NORMALIZED snapshot, not SQL/migrations. Extractor is separate.

    None or malformed extraction is BLOCKED, not twenty passing checks.
    Missing objects in an otherwise complete extraction are genuine FAILs.
    """
    ids = [f'MDB-{n}' for n in range(1, 21)]
    if len(expected['tables']) != 4 or len(expected['views']) != 3:
        raise ValueError('Changing the model requires a new control version')
    blocked = {id: {'status': 'BLOCKED', 'detail': 'Uttrekk mangler eller er ufullstendig.'} for id in ids}
    if not isinstance(observed, dict) or observed.get('extraction_complete') is not True:
        return blocked
    if not isinstance(observed.get('tables'), dict) or not isinstance(observed.get('views'), dict):
        return blocked
    results = {}
    def record(number, passed, detail):
        results[f'MDB-{number}'] = {'status': 'PASS' if passed else 'FAIL', 'detail': detail}
    try:
        for offset, (name, spec) in enumerate(expected['tables'].items()):
            actual = observed['tables'].get(name)
            labels = ('felt/typer/NOT NULL/genererte uttrykk', 'primærnøkkel', 'fremmednøkler', 'unike nøkler')
            if actual is None:
                for index, label in enumerate(labels, 1):
                    record(offset * 4 + index, False, f'{name}: tabell mangler ({label})')
                continue
            # Access every required metadata field, including empty key sets.
            checks = [
                ({k: _type(v) for k, v in actual['columns'].items()} ==
                 {k: _type(v) for k, v in spec['columns'].items()}
                 and set(actual['not_null_columns']) == set(spec['columns'])
                 and actual['generated_columns'] == spec['generated_columns']),
                actual['primary_key'] == spec['primary_key'],
                _foreign_keys(actual['foreign_keys']) == _foreign_keys(spec['foreign_keys']),
                _keys(actual['unique_keys']) == _keys(spec['unique_keys']),
            ]
            for index, (passed, label) in enumerate(zip(checks, labels), 1):
                record(offset * 4 + index, passed, f'{name}: {label}')
        for number, (name, spec) in enumerate(expected['views'].items(), 17):
            # Exact structure: extra joins, expressions, filters, etc. cannot disappear.
            record(number, observed['views'].get(name) == spec, f'{name}: nøyaktig kilde og projeksjon')
        record(20, set(observed['tables']) == set(expected['tables']) and
               set(observed['views']) == set(expected['views']), 'Nøyaktig tabell- og visningssett')
    except (KeyError, TypeError, AttributeError, ValueError):
        return blocked
    return results
