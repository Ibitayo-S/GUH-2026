"""The only place Viva talks to a model.

`call_json` returns a validated Pydantic object, or None on *any* problem (no key, mock mode,
network error, timeout, refusal, schema mismatch). Callers always have an authored fallback.
The API key is read from the backend environment only and never sent to the frontend.
"""
from __future__ import annotations

import logging
from typing import Optional, TypeVar

from pydantic import BaseModel

import config

log = logging.getLogger("viva.llm")
T = TypeVar("T", bound=BaseModel)

_client = None
_client_key = None


def available() -> bool:
    return bool(config.openai_key()) and not config.mock_forced()


def _client_for_key():
    global _client, _client_key
    key = config.openai_key()
    if _client is None or _client_key != key:
        from openai import OpenAI  # imported lazily so mock mode needs no network setup

        _client = OpenAI(api_key=key, timeout=config.llm_timeout(), max_retries=0)
        _client_key = key
    return _client


def call_json(schema: type[T], system: str, user: str, temperature: float = 0.2) -> Optional[T]:
    if not available():
        return None
    try:
        resp = _client_for_key().responses.parse(
            model=config.openai_model(),
            instructions=system,
            input=user,
            text_format=schema,
            temperature=temperature,
        )
        parsed = resp.output_parsed
        if parsed is None:
            log.warning("model returned no parsed output for %s", schema.__name__)
        return parsed
    except Exception as exc:  # noqa: BLE001 - any failure means "use the fallback"
        log.warning("model call failed for %s: %s", schema.__name__, exc)
        return None
