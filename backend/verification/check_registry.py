"""Fixed test cases with explicit links to the agreed control groups."""
from dataclasses import dataclass

@dataclass
class Case:
    id: str
    group: str
    function: object
    needs: tuple
    slow: bool = False

CASES = []

def check(id, group, needs=('db',), slow=False):
    def register(function):
        if any(case.id == id for case in CASES):
            raise ValueError('Duplicate case ID: ' + id)
        CASES.append(Case(id, group, function, tuple(needs), slow))
        return function
    return register
