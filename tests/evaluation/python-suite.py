"""Machine-readable unittest result; a skipped or empty suite is never a pass."""
import io
import json
from pathlib import Path
import sys
import unittest

root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(root / 'backend/tests'))
suite = unittest.defaultTestLoader.discover(str(root / sys.argv[1]))
output = io.StringIO()
result = unittest.TextTestRunner(stream=output, verbosity=2).run(suite)
print(output.getvalue(), file=sys.stderr)
print(json.dumps({'tests': result.testsRun,
                  'passed': result.testsRun - len(result.failures) - len(result.errors) - len(result.skipped)
                            - len(result.expectedFailures) - len(result.unexpectedSuccesses),
                  'failed': len(result.failures) + len(result.errors) + len(result.unexpectedSuccesses),
                  'skipped': len(result.skipped) + len(result.expectedFailures)}))
sys.exit(0 if result.wasSuccessful() else 1)
