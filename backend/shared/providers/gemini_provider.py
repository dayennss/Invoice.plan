import os
import json
import uuid
import fitz  # PyMuPDF
import google.generativeai as genai
from PIL import Image
import io

from ..ai_provider import AIProvider
from ..models import Transaction, TransactionCategory

_CATEGORIES = [
    "alimentacao", "transporte", "moradia", "saude",
    "lazer", "educacao", "assinaturas", "vestuario",
    "transferencias", "outros",
]

_PROMPT = """
Você é um especialista em finanças pessoais brasileiras.
Analise esta fatura de cartão de crédito e extraia TODAS as transações.

Para cada transação retorne um objeto JSON com:
- description: string (nome do estabelecimento/serviço, limpo e legível)
- amount: number (valor em reais, sempre positivo)
- date: string (formato YYYY-MM-DD)
- category: string (EXATAMENTE uma das opções: alimentacao, transporte, moradia, saude, lazer, educacao, assinaturas, vestuario, transferencias, outros)
- installment_current: number ou null (número da parcela atual, ex: 3)
- installment_total: number ou null (total de parcelas, ex: 12)
- is_recurring: boolean (true se parecer uma assinatura recorrente)

Retorne APENAS um array JSON válido, sem texto adicional, sem markdown, sem ```json.
Exemplo: [{"description":"Supermercado Pão de Açúcar","amount":187.50,"date":"2024-01-15","category":"alimentacao","installment_current":null,"installment_total":null,"is_recurring":false}]
"""


class GeminiProvider(AIProvider):
    def __init__(self):
        genai.configure(api_key=os.environ["GEMINI_API_KEY"])
        self._model = genai.GenerativeModel("gemini-2.0-flash")

    def extract_transactions(self, pdf_bytes: bytes, filename: str) -> list[Transaction]:
        images = self._pdf_to_images(pdf_bytes)
        raw = self._call_gemini(images)
        return self._parse_response(raw)

    def _pdf_to_images(self, pdf_bytes: bytes) -> list[Image.Image]:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        images = []
        for page in doc:
            pix = page.get_pixmap(dpi=150)
            img = Image.open(io.BytesIO(pix.tobytes("png")))
            images.append(img)
        doc.close()
        return images

    def _call_gemini(self, images: list[Image.Image]) -> str:
        content: list = [_PROMPT] + images
        response = self._model.generate_content(content)
        return response.text.strip()

    def _parse_response(self, raw: str) -> list[Transaction]:
        # Remove eventual markdown code fences
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
