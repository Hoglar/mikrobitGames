"""Compatibility imports: the terminal now uses the production conversation engine."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'ai-service/src'))
from orchestrator import Conversation
from model_client import Ollama, ModelFailure, ContextFull, pack
