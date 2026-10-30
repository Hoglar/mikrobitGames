"""Versioned, bounded FoM; missing measurements never become zero or PASS."""
import math

POLICY = {'version': 1, 'weights': {'function': .5, 'performance': .3, 'ux': .2},
          'input_p95_ms': 5.0, 'game_workload_p95_ms': 1000 / 60}


def latency_score(value, budget):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
        raise ValueError('Latency must be a finite, nonnegative number')
    return 100.0 if value <= budget else 100.0 * budget / value


def validate_feedback(score, comment, reviewer):
    if isinstance(score, bool) or not isinstance(score, (int, float)) or not math.isfinite(score) or not 0 <= score <= 10:
        raise ValueError('UX-skår må være et endelig tall fra 0 til 10.')
    if not comment.strip() or not reviewer.strip():
        raise ValueError('Både kommentar og vurderer/gruppe må fylles ut.')


def summarize(report, feedback=None):
    groups = report['checks']
    measurable = bool(groups) and all(g['status'] in ('PASS', 'FAIL') and g.get('score') is not None for g in groups)
    functions = [g['score'] for g in groups if g['category'] == 'function' and g.get('score') is not None]
    performance = [g['score'] for g in groups if g['category'] == 'performance' and g.get('score') is not None]
    function = sum(functions) / len(functions) if functions else None
    speed = sum(performance) / len(performance) if performance else None
    measurable = measurable and function is not None and speed is not None and report.get('selftest') == 'PASS'
    weights = report['policy']['weights']
    technical = ((weights['function'] * function + weights['performance'] * speed)
                 / (weights['function'] + weights['performance'])) if measurable else None
    ux = feedback['score'] * 10 if feedback else None
    total = weights['function'] * function + weights['performance'] * speed + weights['ux'] * ux if measurable and feedback else None
    return {'function': function, 'performance': speed, 'technical': technical, 'ux': ux, 'fom': total,
            'status': 'BLOCKED' if not measurable else 'COMPLETE' if feedback else 'AWAITING_UX'}
