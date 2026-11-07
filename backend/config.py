"""Environment configuration, read on every call so tests can override it."""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _load_dotenv() -> None:
    """Minimal .env loader (repo root, then backend/). Real environment variables win."""
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


def has_credentials() -> bool:
    return bool(os.getenv("ANTHROPIC_API_KEY", "").strip() or os.getenv("ANTHROPIC_AUTH_TOKEN", "").strip())


def demo_forced() -> bool:
    """VIVA_DEMO=1 ignores any key and serves the built-in example lab's prewritten quiz (e.g. bad venue Wi-Fi)."""
    return os.getenv("VIVA_DEMO", "").strip().lower() in ("1", "true", "yes")


def live_enabled() -> bool:
    return has_credentials() and not demo_forced()


def model() -> str:
    # Same default as backend/parse.py; override with VIVA_MODEL.
    return os.getenv("VIVA_MODEL", "claude-sonnet-5-5").strip()


def effort() -> str:
    # One generation call per quiz, so spend a bit more for better distractors.
    return os.getenv("VIVA_EFFORT", "medium").strip()


def timeout_seconds() -> float:
    return float(os.getenv("VIVA_TIMEOUT", "180"))
