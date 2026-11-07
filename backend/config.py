"""Environment configuration. Values are read on every call so tests can override them."""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _load_dotenv() -> None:
    """Minimal .env loader (repo root, then backend/). Existing env vars win."""
    for path in (ROOT / ".env", Path(__file__).parent / ".env"):
        if not path.exists():
            continue
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_dotenv()


def openai_key() -> str:
    return os.getenv("OPENAI_API_KEY", "").strip()


def openai_model() -> str:
    return os.getenv("OPENAI_MODEL", "gpt-4.1-mini").strip()


def mock_forced() -> bool:
    return os.getenv("VIVA_MOCK", "").strip().lower() in ("1", "true", "yes")


def llm_timeout() -> float:
    return float(os.getenv("VIVA_LLM_TIMEOUT", "8"))
