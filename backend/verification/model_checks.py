"""Deterministic extraction from PostgreSQL, OpenAPI and Python source."""
import ast
import copy
import json
import re
from pathlib import Path
from harness import ROOT, Blocked, request
from controls import compare_database


def plain_view(definition):
    import sqlglot
    from sqlglot import exp
    tree=sqlglot.parse_one(definition,read='postgres')
    allowed={'expressions','from','from_'}
    if not isinstance(tree,exp.Select) or any(v for k,v in tree.args.items() if k not in allowed):
        return {'unsupported_definition':tree.sql(dialect='postgres')}
    tables=list(tree.find_all(exp.Table))
    if len(tables)!=1 or len(list(tree.find_all(exp.Select)))!=1:
        return {'unsupported_definition':tree.sql(dialect='postgres')}
    table=tables[0]
    columns=[]
    for column in tree.expressions:
        if not isinstance(column,exp.Column) or isinstance(column.this,exp.Star):
            return {'unsupported_definition':tree.sql(dialect='postgres')}
        if column.table not in ('',table.name,table.alias):
            return {'unsupported_definition':tree.sql(dialect='postgres')}
        columns.append(column.name)
    return {'source':f'{table.db}.{table.name}','columns':columns,'row_filter':None}


def generated_expression(expression):
    # PostgreSQL inserts this widening cast for lower(varchar); no general SQL rewriting.
    simple=re.sub(r'\s+','',expression)
    if simple in ('lower(username)','lower((username)::text)','lower(username::text)'):
        return 'lower(username)'
    return expression


def database_snapshot(e):
    tables={};views={}
    objects=e.rows("SELECT n.nspname,c.relname,c.oid,c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('app','ai_read') AND c.relkind IN ('r','p','v','m','f') ORDER BY n.nspname,c.relname")
    for schema,name,oid,kind in objects:
        full=f'{schema}.{name}'
        if kind=='v':
            views[full]=plain_view(e.scalar('SELECT pg_get_viewdef(%s,true)',(oid,)))
            continue
        if kind not in ('r','p'):
            tables[full]={'unsupported_kind':kind}
            continue
        columns=e.rows('''SELECT a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,
                         a.attgenerated,pg_get_expr(d.adbin,d.adrelid)
                         FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
                         WHERE a.attrelid=%s AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum''',(oid,))
        table={'columns':{c[0]:c[1] for c in columns},'not_null_columns':[c[0] for c in columns if c[2]],
               'generated_columns':{c[0]:generated_expression(c[4]) for c in columns if c[3]},
               'primary_key':[],'unique_keys':[],'foreign_keys':[]}
        constraints=e.rows('''SELECT con.contype,
            ARRAY(SELECT a.attname FROM unnest(con.conkey) WITH ORDINALITY k(num,ord) JOIN pg_attribute a ON a.attrelid=con.conrelid AND a.attnum=k.num ORDER BY k.ord),
            rn.nspname,rc.relname,
            ARRAY(SELECT a.attname FROM unnest(con.confkey) WITH ORDINALITY k(num,ord) JOIN pg_attribute a ON a.attrelid=con.confrelid AND a.attnum=k.num ORDER BY k.ord),con.confdeltype
            FROM pg_constraint con LEFT JOIN pg_class rc ON rc.oid=con.confrelid LEFT JOIN pg_namespace rn ON rn.oid=rc.relnamespace
            WHERE con.conrelid=%s AND con.contype IN ('p','u','f')''',(oid,))
        for typ,cols,refschema,refname,refcols,delete in constraints:
            if typ=='p': table['primary_key']=cols
            elif typ=='u':table['unique_keys'].append(cols)
            else:table['foreign_keys'].append({'columns':cols,'references':f'{refschema}.{refname}','referenced_columns':refcols,
                                             'on_delete':{'a':'NO ACTION','r':'RESTRICT','c':'CASCADE','n':'SET NULL','d':'SET DEFAULT'}[delete]})
        # Unique indexes can enforce constraints without a pg_constraint entry.
        indexes=e.rows('''SELECT ARRAY(SELECT a.attname FROM unnest(i.indkey::smallint[]) WITH ORDINALITY k(num,ord)
                    JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.num WHERE k.ord<=i.indnkeyatts ORDER BY k.ord),
                    i.indexprs IS NULL AND i.indpred IS NULL,pg_get_indexdef(i.indexrelid)
                    FROM pg_index i WHERE i.indrelid=%s AND i.indisunique AND NOT i.indisprimary''',(oid,))
        for cols,plain,definition in indexes:
            if plain:
                if cols not in table['unique_keys']:table['unique_keys'].append(cols)
            else:table['unique_keys'].append(['UNSUPPORTED:'+definition])
        tables[full]=table
    return {'extraction_complete':True,'tables':tables,'views':views}


def clean_schema(value, document, depth=0):
    if depth>40:raise Blocked('Rekursivt/for dypt JSON-skjema må normaliseres eksplisitt.')
    if isinstance(value,list):return [clean_schema(x,document,depth+1) for x in value]
    if not isinstance(value,dict):return value
    if '$ref' in value:
        ref=value['$ref']
        if not ref.startswith('#/'):raise Blocked('Eksterne OpenAPI-referanser støttes ikke automatisk.')
        resolved=document
        for part in ref[2:].split('/'):resolved=resolved[part.replace('~1','/').replace('~0','~')]
        value={**resolved,**{k:v for k,v in value.items() if k!='$ref'}}
    result={k:clean_schema(v,document,depth+1) for k,v in value.items()
            if k not in ('title','description','example','examples','summary','operationId','tags','externalDocs')}
    union=result.get('anyOf')
    if isinstance(union,list) and len(union)==2 and {'type':'null'} in union:
        other=next(x for x in union if x!={'type':'null'})
        if isinstance(other,dict) and isinstance(other.get('type'),str):
            result={**other,**{k:v for k,v in result.items() if k!='anyOf'},'type':sorted([other['type'],'null'])}
    if isinstance(result.get('enum'),list) and len(result['enum'])==1:
        result['const']=result.pop('enum')[0]
    for key in ('required','enum'):
        if isinstance(result.get(key),list):result[key]=sorted(result[key],key=str)
    if isinstance(result.get('type'),list):result['type']=sorted(result['type'])
    return result


def operations(document):
    from urllib.parse import urlsplit
    base=urlsplit(document.get('servers',[{'url':''}])[0]['url']).path.rstrip('/')
    result={}
    for path,item in document['paths'].items():
        for method,operation in item.items():
            if method in ('get','post','put','patch','delete','head','options'):
                operation=copy.deepcopy(operation)
                operation['parameters']=item.get('parameters',[])+operation.get('parameters',[])
                result[(method,base+path)]=operation
    return result


def openapi_checks(expected,actual):
    left,right=operations(expected),operations(actual)
    rows={}
    def put(n,ok):rows[f'MAPI-{n}']={'status':'PASS' if ok else 'FAIL','detail':'OpenAPI-gruppe '+str(n)}
    put(1,set(left)==set(right))
    def extract(doc,ops,kind):
        values={}
        for key,op in ops.items():
            if kind=='request':v={'parameters':op.get('parameters',[]),'requestBody':op.get('requestBody')}
            elif kind=='response':v=op.get('responses',{})
            else:
                security=op.get('security',doc.get('security',[]))
                used={name for alternative in security for name in alternative}
                v={'security':security,'schemes':{name:doc.get('components',{}).get('securitySchemes',{}).get(name) for name in used}}
            values[key]=clean_schema(v,doc)
            if kind=='request':values[key]['parameters']=sorted(values[key]['parameters'],key=lambda x:(x.get('in',''),x.get('name','')))
        return values
    for n,kind in ((2,'request'),(3,'response'),(4,'auth')):put(n,extract(expected,left,kind)==extract(actual,right,kind))
    return rows


def component_check(model):
    directory=ROOT/model['implementation_root']
    if any(not (directory/c['module']).exists() for c in model['components'].values()):
        return {'status':'BLOCKED','detail':'Komponentfiler mangler.'}
    names={Path(c['module']).stem:name for name,c in model['components'].items()}
    errors=[];unknown=[];edges={name:set() for name in names.values()}
    for path in directory.rglob('*.py'):
        try:tree=ast.parse(path.read_text())
        except SyntaxError:return {'status':'FAIL','detail':'Python-syntaksfeil i '+str(path.relative_to(ROOT))}
        component=names.get(path.stem)
        for node in ast.walk(tree):
            imports=[]
            if isinstance(node,ast.Import):imports=[alias.name for alias in node.names]
            if isinstance(node,ast.ImportFrom):imports=[node.module or '']+[alias.name for alias in node.names]
            for imported in imports:
                for segment in imported.split('.'):
                    if segment in names and component and names[segment]!=component:edges[component].add(names[segment])
                top=imported.split('.')[0]
                io={'psycopg':'postgresql','psycopg2':'postgresql','asyncpg':'postgresql',
                    'httpx':'http','requests':'http','urllib':'http','aiohttp':'http','socket':'http'}
                if top in io:
                    allowed=model['components'].get(component,{}).get('external_access',[])
                    ok=(io[top]=='postgresql' and 'postgresql' in allowed) or (io[top]=='http' and any(x in allowed for x in ('ollama','ai_service')))
                    if not ok:errors.append(f'{path.name}: ekstern tilgang via {top}')
                if top in ('subprocess','ctypes'):errors.append(f'{path.name}: uavklart systemtilgang via {top}')
            if isinstance(node,ast.Call):
                called=ast.unparse(node.func)
                if called in ('__import__','eval','exec') or called.endswith('.import_module'):
                    unknown.append(f'{path.name}: dynamisk avhengighet {called}')
    for name,component in model['components'].items():
        if edges[name]!=set(component['depends_on']):errors.append(f'{name}: forventet {component["depends_on"]}, fant {sorted(edges[name])}')
    return {'status':'BLOCKED' if unknown else ('FAIL' if errors else 'PASS'),
            'detail':'; '.join(unknown+errors) or 'Importgraf samsvarer. Kjøreatferd kontrolleres separat.'}


def run_models(e):
    import yaml
    results={}
    schema=json.loads((ROOT/'backend/spec/models/database-schema.json').read_text())
    if e and e.db_ready:
        try:results.update(compare_database(schema,database_snapshot(e)))
        except Exception as exc:results.update({f'MDB-{n}':{'status':'BLOCKED','detail':type(exc).__name__+' ved uttrekk'} for n in range(1,21)})
    else:results.update(compare_database(schema,None))
    if e and e.api_ready:
        try:
            code,_,actual=request(f'http://127.0.0.1:{e.api_port}/openapi.json')
            if code!=200:raise Blocked('OpenAPI kunne ikke hentes')
            expected=yaml.safe_load((ROOT/'spec/contracts/webapp-backend/openapi.yaml').read_text())
            results.update(openapi_checks(expected,actual))
        except Exception as exc:results.update({f'MAPI-{n}':{'status':'BLOCKED','detail':type(exc).__name__+' ved API-uttrekk'} for n in range(1,5)})
    else:results.update({f'MAPI-{n}':{'status':'BLOCKED','detail':'API er ikke klart'} for n in range(1,5)})
    for n,file in ((3,'backend-components.json'),(4,'ai-components.json')):
        results[f'MAI-{n}']=component_check(json.loads((ROOT/'backend/spec/models'/file).read_text()))
    for n in (1,2):results[f'MAI-{n}']={'status':'BLOCKED','detail':'Internt AI-skjema kunne ikke hentes'}
    if e and e.ai_ready:
        try:
            code,_,actual=request(e.ai_url+'/openapi.json')
            if code!=200:raise Blocked('AI OpenAPI mangler')
            expected=json.loads((ROOT/'backend/tests/fixtures/ai-openapi.json').read_text())
            comparison=openapi_checks(expected,actual)
            results['MAI-1']=comparison['MAPI-2'];results['MAI-2']=comparison['MAPI-3']
        except Exception:pass
    return results
