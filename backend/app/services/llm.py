"""Gemini (Vertex AI) client with retry/backoff. Every call returns validated pydantic models or text."""

import asyncio
import logging
import random
from typing import TypeVar

from google import genai
from google.genai import errors, types
from google.oauth2 import service_account
from pydantic import BaseModel, ValidationError

from ..config import get_settings

log = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

_clients: dict[str, genai.Client] = {}
_sem: asyncio.Semaphore | None = None
RETRYABLE = (429, 500, 502, 503, 504)


def _credentials():
    s = get_settings()
    if not s.google_application_credentials:
        return None  # Application Default Credentials (Workload Identity on GCP)
    return service_account.Credentials.from_service_account_file(
        s.google_application_credentials, scopes=["https://www.googleapis.com/auth/cloud-platform"]
    )


def get_client(location: str | None = None) -> genai.Client:
    """One cached client per region (Imagen may live in a different region than Gemini)."""
    s = get_settings()
    loc = location or s.gcp_location
    if loc not in _clients:
        _clients[loc] = genai.Client(vertexai=True, project=s.gcp_project, location=loc, credentials=_credentials())
    return _clients[loc]


def _semaphore() -> asyncio.Semaphore:
    global _sem
    if _sem is None:
        _sem = asyncio.Semaphore(get_settings().max_concurrent_llm)
    return _sem


async def _with_retry(fn, what: str):
    s = get_settings()
    last: Exception | None = None
    for attempt in range(s.llm_max_retries):
        try:
            async with _semaphore():
                return await fn()
        except errors.APIError as e:
            # Retry only on rate limits / transient server errors
            if e.code not in RETRYABLE:
                raise
            last = e
        except (ValueError, ValidationError) as e:  # bad / truncated JSON
            last = e
        delay = (2**attempt) + random.random()
        log.warning("%s attempt %d failed (%s); retrying in %.1fs", what, attempt + 1, str(last)[:200], delay)
        await asyncio.sleep(delay)
    raise RuntimeError(f"{what} failed after {s.llm_max_retries} attempts: {last}")


async def generate_json(
    prompt: str, schema: type[T], system: str, temperature: float = 0.7, what: str = "gemini", thinking: int = 0
) -> T:
    """One structured-output call; `schema` is a flat pydantic model (Gemini handles simple shapes best)."""
    s = get_settings()
    config = types.GenerateContentConfig(
        system_instruction=system,
        response_mime_type="application/json",
        response_schema=schema,
        temperature=temperature,
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        thinking_config=types.ThinkingConfig(thinking_budget=thinking),
    )

    async def call():
        resp = await get_client().aio.models.generate_content(model=s.gemini_model, contents=prompt, config=config)
        if isinstance(resp.parsed, schema):
            return resp.parsed
        if not resp.text:
            raise ValueError("empty response")
        return schema.model_validate_json(resp.text)

    return await _with_retry(call, what)


async def generate_text(prompt: str, system: str, grounded: bool = False, temperature: float = 0.4, what: str = "gemini") -> str:
    """Plain-text call. With grounded=True, Google Search grounding is enabled (cannot be combined with JSON schema)."""
    s = get_settings()
    config = types.GenerateContentConfig(
        system_instruction=system,
        temperature=temperature,
        tools=[types.Tool(google_search=types.GoogleSearch())] if grounded else None,
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
    )

    async def call():
        resp = await get_client().aio.models.generate_content(model=s.gemini_model, contents=prompt, config=config)
        if not resp.text:
            raise ValueError("empty response")
        return resp.text

    return await _with_retry(call, what)
