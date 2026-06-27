import os
from .ai_provider import AIProvider


def get_ai_provider() -> AIProvider:
    """
    Retorna o provider configurado via env var AI_PROVIDER.
    Padrão: gemini. Trocar para 'claude' quando necessário sem alterar o pipeline.
    """
    provider = os.environ.get("AI_PROVIDER", "gemini").lower()

    if provider == "gemini":
        from .providers.gemini_provider import GeminiProvider
        return GeminiProvider()

    if provider == "claude":
        from .providers.claude_provider import ClaudeProvider
        return ClaudeProvider()

    if provider == "groq":
        from .providers.groq_provider import GroqProvider
        return GroqProvider()

    raise ValueError(f"AI_PROVIDER desconhecido: {provider}")
