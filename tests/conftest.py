r"""Shared pytest setup: run from the repo root with the backend virtualenv, e.g.
    backend\.venv\Scripts\python -m pytest tests
"""

import os
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
BACKEND = REPO / "backend"
FRONTEND = REPO / "frontend"
sys.path.insert(0, str(BACKEND))

# Unit tests never call Vertex: keep the optional-service probes off.
os.environ.setdefault("ENABLE_GROUNDING", "false")
os.environ.setdefault("ENABLE_IMAGE_GENERATION", "false")
