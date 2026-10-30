"""Explain packed racing records without calling their numeric gaps durations."""


def racing_details(value):
    if type(value) is not int or value < 1:
        return {'result_valid': False}
    position, milliseconds = value // 1000000 + 1, value % 1000000
    if not 1 <= position <= 4 or not 1 <= milliseconds <= 600000:
        return {'result_valid': False}
    minutes, remainder = divmod(milliseconds, 60000)
    seconds, fraction = divmod(remainder, 1000)
    return {'result_valid': True, 'race_position': position,
            'race_time_ms': milliseconds,
            'display_value': f'{position}. plass · {minutes:02}:{seconds:02}.{fraction:03}'}


def describe_racing(result):
    if result.get('unit') != 'racing_rank_v1':
        return result
    output = {**result, 'ranking_meaning': 'Lavest løpsplassering først, deretter lavest totaltid. Råverdien er kodet, ikke millisekunder eller poeng.'}
    if 'records' in result:
        records = [{**row, **racing_details(row['value']), 'gap_to_best': None}
                   for row in result['records']]
        best = records[0] if records else None
        for row in records:
            row['position_gap_to_best'] = None
            row['time_gap_to_best_ms'] = None
            if best and best['result_valid'] and row['result_valid']:
                row['position_gap_to_best'] = row['race_position'] - best['race_position']
                if row['race_position'] == best['race_position']:
                    row['time_gap_to_best_ms'] = row['race_time_ms'] - best['race_time_ms']
        output['records'] = records
    if 'history' in result:
        output['history'] = [{**row, **racing_details(row['value'])} for row in result['history']]
        # A change in the packed value can cross placement buckets. It is not a
        # duration; the explicit decoded history explains the improvement.
        output['improvement'] = None
    return output
