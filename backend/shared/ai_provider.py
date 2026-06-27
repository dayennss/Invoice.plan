from abc import ABC, abstractmethod
from .models import Transaction


class AIProvider(ABC):
    """Interface para extração de transações de documentos financeiros."""

    @abstractmethod
    def extract_transactions(self, pdf_bytes: bytes, filename: str, password: str | None = None) -> list[Transaction]:
        ...
