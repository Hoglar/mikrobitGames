"""Compatibility imports: no separate copy of the data tools."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'ai-service/src'))
import read_store
from read_store import DataTools, InvalidTool
