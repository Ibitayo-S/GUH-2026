"""The only place Viva calls a model (Anthropic Messages API, structured output).

`structured()` returns a validated Pydantic object or raises LLMError with a learner-safe message
and a `retryable` flag. The API key is read by the SDK from the backend environment only.
"""
from __future__ import annotations

import logging
from typing import TypeVar

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


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        # Credentials come from ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN in the environment.
        _client = anthropic.Anthropic(timeout=config.timeout_seconds(), max_retries=1)
    return _client


def structured(schema: type[T], system: str, messages: list[dict], max_tokens: int = 16000) -> T:
    """One model call whose reply must match `schema`."""
    try:
        resp = _get_client().beta.messages.parse(
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
        raise LLMError("The model API rejected the key. Check ANTHROPIC_API_KEY on the server.", retryable=False)
    except anthropic.PermissionDeniedError:
        raise LLMError("The API key doesn't have access to this model. Check VIVA_MODEL.", retryable=False)
    except anthropic.NotFoundError:
        raise LLMError(f"Model '{config.model()}' wasn't found. Check VIVA_MODEL.", retryable=False)
    except anthropic.BadRequestError as e:
        log.warning("bad request: %s", e)
        raise LLMError("The model couldn't process these materials (they may be too long).", retryable=False)
    except anthropic.RateLimitError:
        raise LLMError("The model is busy right now (rate limited). Try again in a moment.")
    except anthropic.APIStatusError as e:
        log.warning("api status %s: %s", e.status_code, e)
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
