import os
import json
import uuid
import base64
import fitz  # PyMuPDF
import anthropic

from ..ai_provider import AIProvider
from ..models import Transaction

_CATEGORIES = [
    "alimentacao", "transporte", "moradia", "saude",
    "lazer", "educacao", "assinaturas", "vestuario",
    "transferencias", "outros",
]

_SYSTEM = """
Você é um especialista em finanças pessoais brasileiras.
Analise a fatura de cartão de crédito nas imagens e extraia TODAS as transações.

Para cada transação retorne um objeto JSON com:
- description: string
- amount: number (valor positivo em reais)
- date: string (YYYY-MM-DD)
- category: string (uma de: alimentacao, transporte, moradia, saude, lazer, educacao, assinaturas, vestuario, transferencias, outros)
- installment_current: number ou null
- installment_total: number ou null
- is_recurring: boolean

Retorne APENAS um array JSON válido, sem texto adicional.
"""


class ClaudeProvider(AIProvider):
    def __init__(self):
        self._client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    def extract_transactions(self, pdf_bytes: bytes, filename: str) -> list[Transaction]:
        images_b64 = self._pdf_to_base64(pdf_bytes)
        raw = self._call_claude(images_b64)
        return self._parse_response(raw)

    def _pdf_to_base64(self, pdf_bytes: bytes) -> list[str]:
        import fitz, io
        from PIL import Image
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        result = []
        for page in doc:
            pix = page.get_pixmap(dpi=150)
            result.append(base64.b64encode(pix.tobytes("png")).decode())
        doc.close()
        return result

    def _call_claude(self, images_b64: list[str]) -> str:
        content = [
            {
                "type": "image",
                "source": {"type": "base64", "media_type": "image/png", "data": img},
            }
            for img in images_b64
        ]
        content.append({"type": "text", "text": "Extraia todas as transações desta fatura."})

        response = self._client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=4096,
            system=_SYSTEM,
            messages=[{"role": "user", "content": content}],
        )
        return response.content[0].text.strip()

    def _parse_response(self, raw: str) -> list[Transaction]:
        clean = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        items = json.loads(clean)
        transactions = []
        for item in items:
            category = item.get("category", "outros")
            if category not in _CATEGORIES:
                category = "outros"
            transactions.append(Transaction(
                id=str(uuid.uuid4()),
                description=item["description"],
                amount=float(item["amount"]),
                date=item["date"],
                category=category,
                installment_current=item.get("installment_current"),
                installment_total=item.get("installment_total"),
                is_recurring=bool(item.get("is_recurring", False)),
            ))
        return transactions
