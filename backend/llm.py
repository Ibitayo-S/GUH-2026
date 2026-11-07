"""The only place Viva calls a model (Anthropic Messages API, structured output).

`structured()` returns a validated Pydantic object or raises LLMError with a learner-safe message
and a `retryable` flag.

Keys: the server's own ANTHROPIC_API_KEY (if set) is read by the SDK from the environment. A visitor may
instead send their own key with a request ("bring your own key"); it is used for that call only: never
cached, stored, or logged.
"""
from __future__ import annotations

import logging
from typing import Optional, TypeVar

import anthropic
from pydantic import BaseModel

import config

log = logging.getLogger("viva.llm")
T = TypeVar("T", bound=BaseModel)


class LLMError(RuntimeError):
    def __init__(self, message: str, retryable: bool = True):
        super().__init__(message)
        self.retryable = retryable


_client: anthropic.Anthropic | None = None


def _get_client(api_key: Optional[str]) -> anthropic.Anthropic:
    if api_key:
        # A visitor's own key: a fresh client for this request only, not kept anywhere.
        return anthropic.Anthropic(api_key=api_key, timeout=config.timeout_seconds(), max_retries=1)
    global _client
    if _client is None:
        # The server's key comes from ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN in the environment.
        _client = anthropic.Anthropic(timeout=config.timeout_seconds(), max_retries=1)
    return _client


def structured(schema: type[T], system: str, messages: list[dict], max_tokens: int = 16000,
               api_key: Optional[str] = None) -> T:
    """One model call whose reply must match `schema`."""
    whose = "your API key" if api_key else "the server's API key"
    try:
        resp = _get_client(api_key).beta.messages.parse(
            model=config.model(),
            max_tokens=max_tokens,
            system=system,
            messages=messages,
            output_format=schema,
            output_config={"effort": config.effort()},
            cache_control={"type": "ephemeral"},  # a retry re-sends the same materials: cache them
            # If the model declines a request, let the API retry it on a suitable fallback model.
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        )
    except anthropic.AuthenticationError:
        raise LLMError(f"Anthropic rejected {whose}. Check it's a valid key and try again.", retryable=False)
    except anthropic.PermissionDeniedError:
        raise LLMError(f"{whose.capitalize()} doesn't have access to the model '{config.model()}'.", retryable=False)
    except anthropic.NotFoundError:
        raise LLMError(f"Model '{config.model()}' wasn't found. Check VIVA_MODEL.", retryable=False)
    except anthropic.BadRequestError as e:
        log.warning("bad request (%s)", type(e).__name__)
        msg = str(getattr(e, "message", "")).lower()
        if "credit" in msg or "billing" in msg:
            raise LLMError(f"The Anthropic account for {whose} is out of credit.", retryable=False)
        raise LLMError("The model couldn't process these materials (they may be too long).", retryable=False)
    except anthropic.RateLimitError:
        raise LLMError("The model is busy right now (rate limited). Try again in a moment.")
    except anthropic.APIStatusError as e:
        log.warning("api status %s", e.status_code)
        raise LLMError("The model service had a problem. Try again.")
    except anthropic.APITimeoutError:
        raise LLMError("The model took too long to respond. Try again.")
    except anthropic.APIConnectionError:
        raise LLMError("Couldn't reach the model service. Check the server's network connection.")

    if resp.stop_reason == "refusal":
        raise LLMError("The model declined to respond to this request. Try rephrasing.", retryable=False)
    if resp.stop_reason == "max_tokens":
        raise LLMError("The quiz was cut off before it was finished. Try again, or upload less material.")
    parsed = resp.parsed_output
    if parsed is None:
        raise LLMError("The model's reply wasn't in the expected format. Try again.")
    return parsed
