"""Invoke actual backend score validation for the cross-language contract test."""
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'backend/api/src'))
from score_rules import validate_attempt

results = []
for case in json.load(sys.stdin):
    try:
        validate_attempt(case['status'], case['value'], case['min'], case['max'])
        results.append(True)
    except (ValueError, TypeError):
        results.append(False)
print(json.dumps(results))
