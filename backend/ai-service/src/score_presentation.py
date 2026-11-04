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
    if result.get('sdk_metadata'):
        return describe_sdk(result)
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


def describe_sdk(result):
    definition=result['sdk_metadata']['score']
    fields=definition['fields']
    direction=fields[0]['direction']
    def explain(row):
        try:
            value=row['value']
            if type(value) is not int:raise ValueError()
            n=value-definition.get('offset',0)
            decoded={}
            for i in range(len(fields)-1,-1,-1):
                f=fields[i]
                if len(fields)==1:digit=value-f['min']
                elif i:n,digit=divmod(n,f.get('radix',f['max']-f['min']+1))
                else:digit=n
                if not 0<=digit<=f['max']-f['min']:raise ValueError()
                decoded[f['key']]=(f['min']+digit if f['direction']==direction else f['max']-digit)
            texts=[]
            for f in fields:
                v=decoded[f['key']]
                if f['format']=='duration-ms':
                    minutes,rest=divmod(v,60000);seconds,ms=divmod(rest,1000);text=f'{minutes:02}:{seconds:02}.{ms:03}'
                else:text=str(v)+(('' if f['unit'].startswith('.') else ' ')+f['unit'] if f.get('unit') else '')
                texts.append(text)
            return {**row,'score':decoded,'display_value':' · '.join(texts),'result_valid':True,'gap_to_best':None}
        except (ValueError,KeyError,TypeError):return {**row,'result_valid':False,'gap_to_best':None}
    out={**result,'ranking_meaning':'Feltene rangeres i oppgitt rekkefølge etter sine retninger. Råverdien kan være kodet; bruk display_value og score.'}
    out['score_fields']=[{k:f[k] for k in ('key','label','direction','format')} for f in fields]
    for key in ('records','history'):
        if key in result:out[key]=[explain(r) for r in result[key]]
    if 'improvement' in out:out['improvement']=None
    return out
