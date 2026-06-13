import json

from backend.app.clients.langfuse_client import LangfuseTraceWrapper
from backend.app.core.config import Settings


class OllamaDecisionError(Exception):
    pass


class OllamaClientWrapper:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def get_status(self) -> tuple[bool, bool, str]:
        base_url = self.settings.ollama_base_url
        if not base_url or not base_url.strip():
            return False, False, "OLLAMA_BASE_URL is not configured."

        try:
            from openai import OpenAI  # noqa: F401
        except ImportError:
            return True, False, "OpenAI package is not installed (required for Ollama compat layer)."

        try:
            import urllib.request

            req = urllib.request.urlopen(f"{base_url.rstrip('/')}/api/tags", timeout=3)
            req.read()
        except Exception as exc:
            return (
                True,
                False,
                f"Ollama is not reachable at {base_url}: {exc}",
            )

        return True, True, f"Ollama configured with model {self.settings.ollama_model} at {base_url}."

    def decide_action(
        self,
        prompt: str,
        *,
        metadata: dict | None = None,
        langfuse_wrapper: LangfuseTraceWrapper | None = None,
    ) -> dict:
        configured, available, message = self.get_status()
        if not configured or not available:
            raise OllamaDecisionError(message)

        tracer = langfuse_wrapper or _NoopLangfuseWrapper()
        with tracer.start_generation(
            name="ollama-decision",
            model=self.settings.ollama_model,
            input=prompt,
            metadata=metadata or {},
            model_parameters={"provider": "ollama", "base_url": self.settings.ollama_base_url},
        ) as generation:
            try:
                from openai import OpenAI

                client = OpenAI(
                    base_url=f"{self.settings.ollama_base_url.rstrip('/')}/v1",
                    api_key="ollama",
                )
                response = client.chat.completions.create(
                    model=self.settings.ollama_model,
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"},
                )
                output_text = response.choices[0].message.content or ""
                if not output_text:
                    raise OllamaDecisionError("Ollama returned an empty decision response.")

                parsed = _parse_json_response(output_text)
                generation.update(
                    output=parsed,
                    metadata={
                        **(metadata or {}),
                        "raw_output_preview": output_text[:500],
                    },
                    status_message="Ollama decision completed.",
                )
                return parsed
            except OllamaDecisionError as exc:
                generation.update(
                    output={"error": str(exc)},
                    status_message=str(exc),
                    level="ERROR",
                )
                raise
            except json.JSONDecodeError as exc:
                generation.update(
                    output={"error": "Ollama returned invalid JSON."},
                    status_message="Ollama returned invalid JSON.",
                    level="ERROR",
                )
                raise OllamaDecisionError("Ollama returned invalid JSON.") from exc
            except Exception as exc:
                detail = str(exc).strip() or exc.__class__.__name__
                message = f"Ollama decision call failed: {detail}"
                generation.update(
                    output={"error": message},
                    status_message=message,
                    level="ERROR",
                )
                raise OllamaDecisionError(message) from exc


def _parse_json_response(output_text: str) -> dict:
    cleaned_output = output_text.strip()
    if not cleaned_output:
        raise OllamaDecisionError("Ollama returned an empty decision response.")

    # 1. Direct JSON parse (works when response_format=json_object is honoured)
    try:
        return json.loads(cleaned_output)
    except json.JSONDecodeError:
        pass

    # 2. Search for ```json ... ``` or ``` ... ``` fences anywhere in the text
    import re
    fence_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", cleaned_output, re.DOTALL)
    if fence_match:
        try:
            return json.loads(fence_match.group(1))
        except json.JSONDecodeError:
            pass

    # 3. Extract outermost {...} block
    first_brace = cleaned_output.find("{")
    last_brace = cleaned_output.rfind("}")
    if first_brace != -1 and last_brace != -1 and first_brace < last_brace:
        try:
            return json.loads(cleaned_output[first_brace : last_brace + 1])
        except json.JSONDecodeError:
            pass

    # 4. YAML-style "key: value" fallback for models that ignore JSON mode
    #    e.g.  "action: make_offer\nprice: 2.4\nnote: ...\nreason: ..."
    yaml_result: dict = {}
    for line in cleaned_output.splitlines():
        if ":" in line:
            key, _, val = line.partition(":")
            key = key.strip().strip('"').strip("'")
            val = val.strip().strip('"').strip("'")
            if not key:
                continue
            # coerce types
            if val.lower() == "null" or val == "":
                yaml_result[key] = None
            else:
                try:
                    yaml_result[key] = float(val) if "." in val else int(val)
                except ValueError:
                    yaml_result[key] = val
    if {"action", "note", "reason"}.issubset(yaml_result.keys()):
        return yaml_result

    raise OllamaDecisionError("Ollama returned invalid JSON.")


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
