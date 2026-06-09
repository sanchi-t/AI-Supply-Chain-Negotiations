import json

from backend.app.clients.langfuse_client import LangfuseTraceWrapper
from backend.app.core.config import Settings


class OpenAIDecisionError(Exception):
    pass


class OpenAIClientWrapper:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def get_status(self) -> tuple[bool, bool, str]:
        if not self.settings.openai_enabled:
            return False, False, "OPENAI_API_KEY is not configured."

        try:
            from openai import OpenAI  # noqa: F401
        except ImportError:
            return True, False, "OpenAI package is not installed."

        return True, True, f"Configured with model {self.settings.openai_model}."

    def decide_action(
        self,
        prompt: str,
        *,
        metadata: dict | None = None,
        langfuse_wrapper: LangfuseTraceWrapper | None = None,
    ) -> dict:
        configured, available, _ = self.get_status()
        if not configured or not available:
            raise OpenAIDecisionError("OpenAI is not configured or available.")

        tracer = langfuse_wrapper or _NoopLangfuseWrapper()
        with tracer.start_generation(
            name="openai-decision",
            model=self.settings.openai_model,
            input=prompt,
            metadata=metadata or {},
            model_parameters={"api": "responses.create"},
        ) as generation:
            try:
                from openai import OpenAI

                client = OpenAI(api_key=self.settings.openai_api_key)
                response = client.responses.create(
                    model=self.settings.openai_model,
                    input=prompt,
                )
                output_text = getattr(response, "output_text", "")
                if not output_text:
                    raise OpenAIDecisionError("OpenAI returned an empty decision response.")

                parsed = _parse_json_response(output_text)
                usage = _extract_usage(response)
                generation.update(
                    output=parsed,
                    metadata={
                        **(metadata or {}),
                        "raw_output_preview": output_text[:500],
                    },
                    usage_details=usage or None,
                    status_message="OpenAI decision completed.",
                )
                return parsed
            except OpenAIDecisionError as exc:
                generation.update(
                    output={"error": str(exc)},
                    status_message=str(exc),
                    level="ERROR",
                )
                raise
            except json.JSONDecodeError as exc:
                generation.update(
                    output={"error": "OpenAI returned invalid JSON."},
                    status_message="OpenAI returned invalid JSON.",
                    level="ERROR",
                )
                raise OpenAIDecisionError("OpenAI returned invalid JSON.") from exc
            except Exception as exc:
                detail = str(exc).strip() or exc.__class__.__name__
                message = f"OpenAI decision call failed: {detail}"
                generation.update(
                    output={"error": message},
                    status_message=message,
                    level="ERROR",
                )
                raise OpenAIDecisionError(message) from exc


def _parse_json_response(output_text: str) -> dict:
    cleaned_output = output_text.strip()
    if not cleaned_output:
        raise OpenAIDecisionError("OpenAI returned an empty decision response.")

    try:
        return json.loads(cleaned_output)
    except json.JSONDecodeError:
        pass

    if cleaned_output.startswith("```"):
        lines = cleaned_output.splitlines()
        if len(lines) >= 3 and lines[-1].strip() == "```":
            fenced_payload = "\n".join(lines[1:-1]).strip()
            if fenced_payload.lower().startswith("json"):
                fenced_payload = fenced_payload[4:].strip()
            return json.loads(fenced_payload)

    first_brace = cleaned_output.find("{")
    last_brace = cleaned_output.rfind("}")
    if first_brace != -1 and last_brace != -1 and first_brace < last_brace:
        return json.loads(cleaned_output[first_brace : last_brace + 1])

    raise OpenAIDecisionError("OpenAI returned invalid JSON.")


def _extract_usage(response: object) -> dict[str, int]:
    usage = getattr(response, "usage", None)
    if usage is None:
        return {}

    usage_details: dict[str, int] = {}
    for source_name, target_name in (
        ("input_tokens", "input_tokens"),
        ("output_tokens", "output_tokens"),
        ("total_tokens", "total_tokens"),
    ):
        value = getattr(usage, source_name, None)
        if isinstance(value, int):
            usage_details[target_name] = value

    return usage_details


class _NoopLangfuseWrapper:
    def start_generation(self, **_: object):
        class _NoopObservation:
            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, tb):
                return False

            def update(self, **__: object) -> None:
                return None

        return _NoopObservation()
