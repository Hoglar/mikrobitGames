"""Pure control logic. Never imports the application or opens a database."""

CONTROL_VERSION = 2  # API 0.2.0, database model format 2; never reuse the v1 series.
TABLE_ORDER = ('app.players', 'app.sessions', 'app.games', 'app.records', 'app.attempts')
VIEW_ORDER = ('ai_read.players', 'ai_read.games', 'ai_read.records')
MODEL_COUNTS = (24, 4, 4)
DB_MODEL_IDS = tuple(f'MDB-{n}' for n in range(1, MODEL_COUNTS[0] + 1))

STATUSES = frozenset({'PASS', 'FAIL', 'SKIPPED', 'BLOCKED'})
REQUIREMENT_IDS = tuple(f'K{area}-{n}' for area in ('DB', 'API', 'AI') for n in range(1, 5))
MODEL_IDS = tuple(f'M{area}-{n}' for area, total in zip(('DB', 'API', 'AI'), MODEL_COUNTS) for n in range(1, total + 1))


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
            'model_percent': score('M', MODEL_COUNTS)}


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

    None or malformed extraction is BLOCKED, not twenty-four passing checks.
    Missing objects in an otherwise complete extraction are genuine FAILs.
    """
    ids = DB_MODEL_IDS
    if (expected.get('format_version') != 2 or
            set(expected['tables']) != set(TABLE_ORDER) or set(expected['views']) != set(VIEW_ORDER)):
        raise ValueError('Changing the model requires a new control version')
    for spec in expected['tables'].values():
        if not set(spec['not_null_columns']) <= set(spec['columns']):
            raise ValueError('NOT NULL expectation names an unknown column')
    blocked = {id: {'status': 'BLOCKED', 'detail': 'Uttrekk mangler eller er ufullstendig.'} for id in ids}
    if not isinstance(observed, dict) or observed.get('extraction_complete') is not True:
        return blocked
    if not isinstance(observed.get('tables'), dict) or not isinstance(observed.get('views'), dict):
        return blocked
    results = {}
    def record(number, passed, detail):
        results[f'MDB-{number}'] = {'status': 'PASS' if passed else 'FAIL', 'detail': detail}
    try:
        for offset, name in enumerate(TABLE_ORDER):
            spec = expected['tables'][name]
            actual = observed['tables'].get(name)
            labels = ('felt/typer/NOT NULL/genererte uttrykk', 'primærnøkkel', 'fremmednøkler', 'unike nøkler')
            if name not in observed['tables']:
                for index, label in enumerate(labels, 1):
                    record(offset * 4 + index, False, f'{name}: tabell mangler ({label})')
                continue
            # Read every field before comparisons: short-circuiting must not hide
            # an incomplete extraction behind a known type mismatch.
            for field in ('columns', 'not_null_columns', 'generated_columns',
                          'primary_key', 'foreign_keys', 'unique_keys'):
                actual[field]
            checks = [
                ({k: _type(v) for k, v in actual['columns'].items()} ==
                 {k: _type(v) for k, v in spec['columns'].items()}
                 and set(actual['not_null_columns']) == set(spec['not_null_columns'])
                 and actual['generated_columns'] == spec['generated_columns']),
                actual['primary_key'] == spec['primary_key'],
                _foreign_keys(actual['foreign_keys']) == _foreign_keys(spec['foreign_keys']),
                _keys(actual['unique_keys']) == _keys(spec['unique_keys']),
            ]
            for index, (passed, label) in enumerate(zip(checks, labels), 1):
                record(offset * 4 + index, passed, f'{name}: {label}')
        for number, name in enumerate(VIEW_ORDER, 21):
            spec = expected['views'][name]
            if name in observed['views'] and not isinstance(observed['views'][name], dict):
                return blocked
            # Exact structure: extra joins, expressions, filters, etc. cannot disappear.
            record(number, observed['views'].get(name) == spec, f'{name}: nøyaktig kilde og projeksjon')
        record(24, set(observed['tables']) == set(expected['tables']) and
               set(observed['views']) == set(expected['views']), 'Nøyaktig tabell- og visningssett')
    except (KeyError, TypeError, AttributeError, ValueError):
        return blocked
    return results
