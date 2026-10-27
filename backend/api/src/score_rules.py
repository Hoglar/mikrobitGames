"""Pure score and competition ranking rules."""
MAX_SAFE_INTEGER = 9007199254740991


def validate_score(value, min_value, max_value):
    if type(value) is not int:
        raise TypeError('Resultatet må være et heltall.')
    if not 0 <= min_value <= value <= max_value <= MAX_SAFE_INTEGER:
        raise ValueError('Resultatet er utenfor intervallet.')


def validate_attempt(status, value, min_value, max_value):
    if status == 'completed':
        validate_score(value, min_value, max_value)
    elif status == 'incomplete':
        if value is not None:
            validate_score(value, 0, MAX_SAFE_INTEGER)
    else:
        raise ValueError('Ukjent forsøksstatus.')


def is_improvement(value, previous, direction):
    if direction not in ('higher_is_better', 'lower_is_better'):
        raise ValueError('Ukjent rangeringsretning.')
    return previous is None or (value > previous if direction == 'higher_is_better' else value < previous)


def rank_scores(scores, direction):
    if direction not in ('higher_is_better', 'lower_is_better'):
        raise ValueError('Ukjent rangeringsretning.')
    ordered = sorted(scores, key=lambda x: (-x[1] if direction == 'higher_is_better' else x[1], x[0]))
    result, previous, rank = [], None, 0
    for index, (player_id, value) in enumerate(ordered, 1):
        if index == 1 or value != previous:
            rank = index
        result.append((rank, player_id, value))
        previous = value
    return result
