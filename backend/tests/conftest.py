import os

import pytest

# Tests never touch the network: force mock mode and drop any key.
os.environ["VIVA_MOCK"] = "1"
os.environ.pop("OPENAI_API_KEY", None)


@pytest.fixture()
def client():
    from fastapi.testclient import TestClient

    from main import app

    return TestClient(app)


@pytest.fixture()
def sample_code():
    from lab import load_lab

    return load_lab("bfs-grid").sample_code
