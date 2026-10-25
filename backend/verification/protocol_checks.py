"""Check actual HTTP JSON against the independently written frontend contract."""
import re
from functools import lru_cache
from datetime import datetime
from uuid import UUID
from harness import ROOT
from model_checks import clean_schema


@lru_cache(maxsize=1)
def document():
    import yaml
    return yaml.safe_load((ROOT/'spec/contracts/webapp-backend/openapi.yaml').read_text())


def validate(method,path,response):
    import jsonschema
    status,headers,body=response
    doc=document();path=path.split('?',1)[0];operation=None
    for template,item in doc['paths'].items():
        expression=re.sub(r'\\\{[^}]+\\\}',r'[^/]+',re.escape(template))
        if re.fullmatch(expression,path):operation=item.get(method.lower());break
    if status==204:
        assert body is None,'204 skal ikke ha body'
        return
    if operation:
        expected=operation['responses'].get(str(status),operation['responses'].get('default'))
        assert expected is not None,'HTTP-status er ikke beskrevet i kontrakten'
        expected=clean_schema(expected,doc)
        schema=expected.get('content',{}).get('application/json',{}).get('schema')
    else:schema=clean_schema({'$ref':'#/components/schemas/Error'},doc)
    assert schema is not None,'Mangler kontraktskjema for JSON-svaret'
    assert 'application/json' in headers.get('content-type',''),'Svaret er ikke JSON'
    checker=jsonschema.FormatChecker()
    @checker.checks('uuid',raises=(ValueError,TypeError,AttributeError))
    def uuid_format(value):
        if not isinstance(value,str):return True
        UUID(value);return True
    @checker.checks('date-time',raises=(ValueError,TypeError))
    def timestamp(value):
        if not isinstance(value,str):return True
        return datetime.fromisoformat(value.replace('Z','+00:00')).tzinfo is not None
    jsonschema.Draft202012Validator(schema,format_checker=checker).validate(body)
    if status>=400:
        assert headers.get('x-request-id')==body['request_id']
        assert 'no-store' in headers.get('cache-control','')
