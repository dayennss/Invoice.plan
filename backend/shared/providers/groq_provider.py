import os
import json
import uuid
import re
import fitz  # PyMuPDF

import boto3
import requests

from ..ai_provider import AIProvider
from ..models import Transaction

_CATEGORIES = [
    "alimentacao", "transporte", "moradia", "saude",
    "lazer", "educacao", "assinaturas", "vestuario",
    "transferencias", "outros",
]

_SYSTEM = """Você é um especialista em finanças pessoais brasileiras.
Analise o texto extraído de uma fatura de cartão de crédito e extraia TODAS as transações.

Para cada transação retorne um objeto JSON com:
- description: string (nome do estabelecimento/serviço, limpo e legível)
- amount: number (valor em reais, sempre positivo)
- date: string (formato YYYY-MM-DD)
- category: string (EXATAMENTE uma de: alimentacao, transporte, moradia, saude, lazer, educacao, assinaturas, vestuario, transferencias, outros)
- installment_current: number ou null (ex: 3 para "3/12")
- installment_total: number ou null (ex: 12 para "3/12")
- is_recurring: boolean (true para assinaturas mensais)

Retorne APENAS um array JSON válido, sem texto adicional, sem markdown, sem ```json."""


def _get_ssm_value(param_name: str) -> str:
    client = boto3.client("ssm", region_name=os.environ.get("AWS_ACCOUNT_REGION", "us-east-1"))
    resp = client.get_parameter(Name=param_name, WithDecryption=True)
    return resp["Parameter"]["Value"]


class GroqProvider(AIProvider):
    _GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
    _MODEL = "llama-3.3-70b-versatile"  # 12k TPM no free tier
    _MAX_CHARS = 28_000  # ~9.3k tokens (português ≈ 3 chars/token), margem p/ prompt

    def __init__(self):
        ssm_param = os.environ.get("SSM_GROQ_API_KEY")
        self._api_key = _get_ssm_value(ssm_param) if ssm_param else os.environ["GROQ_API_KEY"]

    def extract_transactions(self, pdf_bytes: bytes, filename: str) -> list[Transaction]:
        text = self._extract_text(pdf_bytes)
        raw = self._call_groq(text)
        return self._parse_response(raw)

    # Padrões presentes em linhas de transação de faturas brasileiras
    _DATE_RE = re.compile(r"\d{2}/\d{2}(?:/\d{2,4})?")
    _AMOUNT_RE = re.compile(r"\d{1,3}(?:\.\d{3})*,\d{2}")

    def _extract_text(self, pdf_bytes: bytes) -> str:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        pages = [page.get_text() for page in doc]
        doc.close()
        full_text = "\n".join(pages)

        filtered = self._filter_transaction_lines(full_text)
        print(f"[GROQ] chars: total={len(full_text)} filtrado={len(filtered)}")
        return filtered

    def _filter_transaction_lines(self, text: str) -> str:
        """
        Mantém apenas linhas com padrão de transação (data + valor monetário).
        Alguns bancos quebram descrição em linha separada: inclui a linha
        imediatamente anterior a cada match para não perder o nome do estabelecimento.
        Fallback para texto completo truncado se nenhuma linha casar.
        """
        lines = text.splitlines()
        matched_indices: set[int] = set()

        for i, line in enumerate(lines):
            if self._DATE_RE.search(line) and self._AMOUNT_RE.search(line):
                if i > 0:
                    matched_indices.add(i - 1)  # linha anterior (descrição separada)
                matched_indices.add(i)

        if not matched_indices:
            # Fallback: texto completo normalizado e truncado
            text = re.sub(r"[ \t]+", " ", text)
            text = re.sub(r"\n{3,}", "\n\n", text).strip()
            if len(text) > self._MAX_CHARS:
                print(f"[GROQ] fallback truncado para {self._MAX_CHARS} chars")
                text = text[: self._MAX_CHARS]
            return text

        result = "\n".join(lines[i] for i in sorted(matched_indices))
        return result

    def _call_groq(self, text: str) -> str:
        resp = requests.post(
            self._GROQ_URL,
            headers={"Authorization": f"Bearer {self._api_key}"},
            json={
                "model": self._MODEL,
                "messages": [
                    {"role": "system", "content": _SYSTEM},
                    {"role": "user", "content": f"Texto da fatura:\n\n{text}"},
                ],
                "temperature": 0.1,
                "max_tokens": 8192,
            },
            timeout=30,
        )
        if not resp.ok:
            print(f"[GROQ ERROR] {resp.status_code}: {resp.text}")
            resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"].strip()

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
