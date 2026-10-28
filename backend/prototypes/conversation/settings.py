"""The prototype and production use the same reviewed limits and action schema."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'ai-service/src'))
from model_client import MAX_TURNS, CONTEXT_TOKENS, INPUT_BYTES, OUTPUT_TOKENS, ACTION_SCHEMA, TOOL_ARGUMENTS, obj
