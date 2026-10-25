"""Load the real module when present; never substitute a passing fake."""
import importlib.util
from pathlib import Path
import unittest
import sys

ROOT = Path(__file__).resolve().parents[2]


def implementation(relative_path):
    path = ROOT / relative_path
    if not path.is_file():
        raise unittest.SkipTest(f'BLOCKED: komponenten er ikke implementert: {relative_path}')
    if str(path.parent) not in sys.path:sys.path.insert(0,str(path.parent))
    spec = importlib.util.spec_from_file_location('subject_' + path.stem, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module
