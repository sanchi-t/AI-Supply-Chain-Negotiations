from backend.app.clients.ollama_client import OllamaClientWrapper
from backend.app.clients.openai_client import OpenAIClientWrapper
from backend.app.core.config import Settings


def get_ai_client(settings: Settings) -> OllamaClientWrapper | OpenAIClientWrapper:
    """Return the configured AI decision client.

    Uses AI_PROVIDER env var to pick:
      - "ollama"  (default) → OllamaClientWrapper
      - "openai"            → OpenAIClientWrapper
    """
    if settings.ai_provider == "openai":
        return OpenAIClientWrapper(settings)
    return OllamaClientWrapper(settings)


def get_ai_decision_error_types() -> tuple[type[Exception], ...]:
    """Return the exception types that represent a failed AI decision call."""
    from backend.app.clients.ollama_client import OllamaDecisionError
    from backend.app.clients.openai_client import OpenAIDecisionError

    return (OllamaDecisionError, OpenAIDecisionError)
