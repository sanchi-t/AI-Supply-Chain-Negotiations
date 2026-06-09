from __future__ import annotations

from contextlib import contextmanager
from typing import Any

from backend.app.core.config import Settings


class _NoopObservation:
    def update(self, **_: Any) -> None:
        return None


class LangfuseTraceWrapper:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._client: Any | None = None
        self._init_error: str | None = None
        self._client_initialized = False

    def get_status(self) -> tuple[bool, bool, str]:
        if not self.settings.langfuse_enabled:
            return False, False, "LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY are not configured."

        client = self._get_client()
        if client is None:
            return True, False, self._init_error or "Langfuse client is unavailable."

        return True, True, "Configured for tracing."

    @contextmanager
    def start_span(
        self,
        *,
        name: str,
        input: Any | None = None,
        output: Any | None = None,
        metadata: dict[str, Any] | None = None,
        status_message: str | None = None,
        level: str | None = None,
    ):
        with self._start_observation(
            name=name,
            as_type="span",
            input=input,
            output=output,
            metadata=metadata,
            status_message=status_message,
            level=level,
        ) as observation:
            yield observation

    @contextmanager
    def start_tool(
        self,
        *,
        name: str,
        input: Any | None = None,
        output: Any | None = None,
        metadata: dict[str, Any] | None = None,
        status_message: str | None = None,
        level: str | None = None,
    ):
        with self._start_observation(
            name=name,
            as_type="tool",
            input=input,
            output=output,
            metadata=metadata,
            status_message=status_message,
            level=level,
        ) as observation:
            yield observation

    @contextmanager
    def start_generation(
        self,
        *,
        name: str,
        model: str,
        input: Any | None = None,
        output: Any | None = None,
        metadata: dict[str, Any] | None = None,
        model_parameters: dict[str, Any] | None = None,
        usage_details: dict[str, int] | None = None,
        status_message: str | None = None,
        level: str | None = None,
    ):
        with self._start_observation(
            name=name,
            as_type="generation",
            input=input,
            output=output,
            metadata=metadata,
            model=model,
            model_parameters=model_parameters,
            usage_details=usage_details,
            status_message=status_message,
            level=level,
        ) as observation:
            yield observation

    def get_current_trace_id(self) -> str | None:
        client = self._get_client()
        if client is None:
            return None

        try:
            return client.get_current_trace_id()
        except Exception:
            return None

    def get_trace_url(self, trace_id: str | None = None) -> str | None:
        client = self._get_client()
        if client is None:
            return None

        try:
            return client.get_trace_url(trace_id=trace_id)
        except Exception:
            return None

    def flush(self) -> None:
        client = self._get_client()
        if client is None:
            return

        for method_name in ("flush", "shutdown"):
            method = getattr(client, method_name, None)
            if callable(method):
                try:
                    method()
                except Exception:
                    return
                return

    @contextmanager
    def _start_observation(
        self,
        *,
        name: str,
        as_type: str,
        input: Any | None = None,
        output: Any | None = None,
        metadata: dict[str, Any] | None = None,
        model: str | None = None,
        model_parameters: dict[str, Any] | None = None,
        usage_details: dict[str, int] | None = None,
        status_message: str | None = None,
        level: str | None = None,
    ):
        client = self._get_client()
        if client is None:
            yield _NoopObservation()
            return

        kwargs: dict[str, Any] = {
            "name": name,
            "as_type": as_type,
            "input": input,
            "output": output,
            "metadata": metadata,
            "status_message": status_message,
            "level": level,
        }
        if model is not None:
            kwargs["model"] = model
        if model_parameters is not None:
            kwargs["model_parameters"] = model_parameters
        if usage_details is not None:
            kwargs["usage_details"] = usage_details

        try:
            with client.start_as_current_observation(**kwargs) as observation:
                yield observation
        except Exception as exc:
            self._init_error = f"Langfuse tracing failed: {exc}"
            yield _NoopObservation()

    def _get_client(self) -> Any | None:
        if self._client_initialized:
            return self._client

        self._client_initialized = True
        if not self.settings.langfuse_enabled:
            return None

        try:
            try:
                from langfuse import Langfuse  # type: ignore
            except ImportError:
                from langfuse.otel import Langfuse  # type: ignore

            self._client = Langfuse(
                public_key=self.settings.langfuse_public_key,
                secret_key=self.settings.langfuse_secret_key,
                host=self.settings.langfuse_host,
            )
            return self._client
        except ImportError:
            self._init_error = "Langfuse package is not installed."
        except Exception as exc:
            self._init_error = f"Langfuse client initialization failed: {exc}"

        return None
