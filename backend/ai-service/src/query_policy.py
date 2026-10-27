"""Version 1 allowlist for PostgreSQL read expressions. Unknown syntax fails closed."""
import sqlglot
from sqlglot import exp

VIEWS = {'players', 'games', 'records'}
NODES = frozenset('''Select From Table Identifier Column Star Alias TableAlias Where
    And Or Not Paren EQ NEQ GT GTE LT LTE Is In Between Like ILike Literal Boolean Null
    Parameter Placeholder Order Ordered Group Having Limit Offset Distinct Join With CTE
    Subquery Union Intersect Except Add Sub Mul Div Mod Neg Case If Cast DataType
    DataTypeParam Window WindowSpec Tuple Exists Filter Extract Interval Var'''.split())
FUNCTIONS = frozenset('''COUNT SUM MIN MAX AVG ABS ROUND LOWER UPPER LENGTH COALESCE
    NULLIF DATE_TRUNC EXTRACT LAG LEAD FIRST_VALUE LAST_VALUE ROW_NUMBER RANK DENSE_RANK'''.split())
TYPES = frozenset('BIGINT INT SMALLINT DECIMAL DOUBLE FLOAT TEXT VARCHAR CHAR BOOLEAN DATE TIMESTAMP TIMESTAMPTZ UUID INTERVAL'.split())


def parse_query(sql):
    if type(sql) is not str or not sql.strip() or len(sql.encode('utf-8')) > 32768:
        raise ValueError('Ugyldig SQL.')
    try:
        statements = sqlglot.parse(sql, read='postgres')
    except sqlglot.errors.SqlglotError:
        raise ValueError('SQL kunne ikke parses.') from None
    if len(statements) != 1 or not isinstance(statements[0], (exp.Select, exp.Union, exp.Intersect, exp.Except)):
        raise ValueError('Bare én lesespørring tillates.')
    tree = statements[0]
    ctes = {cte.alias for cte in tree.find_all(exp.CTE)}
    allowed_source = False
    for node in tree.walk():
        if isinstance(node, exp.Func):
            name = node.name.upper() if isinstance(node, exp.Anonymous) else node.sql_name()
            if name not in FUNCTIONS and type(node).__name__ not in ('Cast', 'Case', 'If'):
                raise ValueError('Funksjonen er ikke tillatt.')
        elif type(node).__name__ not in NODES:
            raise ValueError('SQL-konstruksjonen er ikke tillatt.')
        if isinstance(node, exp.Select):
            if not node.expressions or node.args.get('into') or node.args.get('locks'):
                raise ValueError('Ugyldig eller låsende SELECT.')
        if isinstance(node, exp.With) and node.args.get('recursive'):
            raise ValueError('Rekursjon er ikke tillatt.')
        if isinstance(node, exp.Table):
            if not isinstance(node.this, exp.Identifier) or node.catalog:
                raise ValueError('Ukjent databaseobjekt.')
            if node.db == 'ai_read' and node.name in VIEWS:
                allowed_source = True
            elif node.db or node.name not in ctes:
                raise ValueError('Bare avtalte visninger og lesende CTE tillates.')
        if isinstance(node, exp.DataType):
            kind = node.this.value if hasattr(node.this, 'value') else str(node.this)
            if kind not in TYPES:
                raise ValueError('Typen er ikke tillatt.')
        if isinstance(node, exp.Join):
            if node.args.get('method') or node.args.get('kind') not in (None, '', 'INNER', 'OUTER', 'CROSS'):
                raise ValueError('JOIN-konstruksjonen er ikke tillatt.')
        if isinstance(node, exp.Column) and (node.db or node.catalog):
            raise ValueError('Kolonner skal bruke tabellalias.')
    if not allowed_source:
        raise ValueError('Spørringen må lese tillatt datagrunnlag.')
    return tree


def validate_query(sql):
    parse_query(sql)
