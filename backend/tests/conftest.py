import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Tests never touch the network: no credentials unless a test stubs the model explicitly.
for var in ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "VIVA_DEMO"):
    os.environ.pop(var, None)


@pytest.fixture()
def client():
    from fastapi.testclient import TestClient

    from main import app

    return TestClient(app)

