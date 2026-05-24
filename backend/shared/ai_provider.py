from abc import ABC, abstractmethod
from .models import Transaction


class AIProvider(ABC):
    """Interface para extração de transações de documentos financeiros."""

    @abstractmethod
    def extract_transactions(self, pdf_bytes: bytes, filename: str) -> list[Transaction]:
        """
        Recebe o PDF em bytes, retorna lista de transações extraídas e categorizadas.
        """
        ...
