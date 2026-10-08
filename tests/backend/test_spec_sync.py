"""The layout/design spec exists twice (backend/app/spec and frontend/src/design) so each side deploys on its own.
They must stay identical: edit one, copy it to the other."""

import json

import pytest
from conftest import BACKEND, FRONTEND


@pytest.mark.parametrize("name", ["layouts.json", "design.json"])
def test_spec_copies_are_identical(name):
    backend = json.loads((BACKEND / "app" / "spec" / name).read_text(encoding="utf-8"))
    frontend = json.loads((FRONTEND / "src" / "design" / name).read_text(encoding="utf-8"))
    assert backend == frontend, f"{name} differs: copy backend/app/spec/{name} to frontend/src/design/{name} (or vice versa)"
