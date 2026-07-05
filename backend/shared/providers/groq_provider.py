import os
import json
import uuid
import re
import time
import fitz  # PyMuPDF

import boto3
import requests

from ..ai_provider import AIProvider
from ..models import Transaction

_CACHED_API_KEYS: list[str] | None = None

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
- installment_current: number ou null
- installment_total: number ou null
- is_recurring: boolean

REGRAS CRÍTICAS:
1. DATAS: no Brasil o formato é DD/MM. "02/06" = 2 de junho (não 6 de fevereiro).
   Se o ano não estiver na linha, use o ano de referência da fatura (informado no user message).
   Se a compra parece ser de mês anterior à fatura (comum em faturas), use o mesmo ano da referência
   a menos que seja dezembro→janeiro (aí subtraia 1 ano).

2. PARCELAS: preencha installment_current/total SOMENTE quando aparecer explícito no formato
   "N/M" ou "PARC N/M" (ex: "3/12", "PARC 03/12"). Um número isolado antes da data
   (ex: "3 02/06 LOJA X 50,00") é código interno do banco (Santander usa "3"), NÃO é parcela.
   Se não tem "N/M" explícito na linha, use null para AMBOS.

3. is_recurring: true SOMENTE para assinaturas óbvias (Netflix, Spotify, iCloud, YouTube Premium,
   Amazon Prime, etc). NÃO marque true por default.

4. IGNORE linhas de: subtotal, saldo anterior, pagamentos recebidos, taxas do banco, IOF,
   encargos financeiros, rendimentos.

5. Retorne APENAS um array JSON válido, sem markdown, sem ```json, sem texto adicional."""


def _get_ssm_value(param_name: str) -> str:
    client = boto3.client("ssm", region_name=os.environ.get("AWS_ACCOUNT_REGION", "us-east-1"))
    resp = client.get_parameter(Name=param_name, WithDecryption=True)
    return resp["Parameter"]["Value"]


def _load_api_keys() -> list[str]:
    global _CACHED_API_KEYS
    if _CACHED_API_KEYS is None:
        keys: list[str] = []
        ssm_primary = os.environ.get("SSM_GROQ_API_KEY")
        primary = _get_ssm_value(ssm_primary) if ssm_primary else os.environ.get("GROQ_API_KEY", "")
        if primary:
            keys.append(primary)
        ssm_fallback = os.environ.get("SSM_GROQ_API_KEY_2")
        if ssm_fallback:
            try:
                fallback = _get_ssm_value(ssm_fallback)
                if fallback:
                    keys.append(fallback)
            except Exception:
                pass
        _CACHED_API_KEYS = keys
    return _CACHED_API_KEYS


class GroqProvider(AIProvider):
    _GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
    _MODEL = "llama-3.3-70b-versatile"  # 12k TPM no free tier
    # Groq TPM inclui input + max_tokens (reserva de output). Cálculo por chunk:
    # system(~240) + input(~4k) + max_tokens(4k) = ~8.3k tokens/req < 12k TPM.
    _MAX_CHARS = 12_000
    _MAX_OUTPUT_TOKENS = 6000  # cabe ~180 transações em JSON compacto
    _CHUNK_DELAY_SECONDS = 25  # async worker (Lambda 300s) pode esperar; TPM 12k/min resetado

    def __init__(self):
        self._api_keys = _load_api_keys()

    def extract_transactions(
        self,
        pdf_bytes: bytes,
        filename: str,
        password: str | None = None,
        year_month_hint: str | None = None,
    ) -> list[Transaction]:
        text = self._extract_text(pdf_bytes, password)
        items = self._call_groq_chunked(text, year_month_hint)
        return self._parse_items(items)

    # Padrões presentes em linhas de transação de faturas brasileiras
    _DATE_RE = re.compile(r"\d{2}/\d{2}(?:/\d{2,4})?")
    _AMOUNT_RE = re.compile(r"\d{1,3}(?:\.\d{3})*,\d{2}")

    def _extract_text(self, pdf_bytes: bytes, password: str | None = None) -> str:
        from ..exceptions import PDFPasswordRequired
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        if doc.needs_pass:
            if not password or not doc.authenticate(password):
                doc.close()
                raise PDFPasswordRequired()
        pages = [self._extract_page_text(page) for page in doc]
        doc.close()
        full_text = "\n".join(pages)

        filtered = self._filter_transaction_lines(full_text)
        print(f"[GROQ] chars: total={len(full_text)} filtrado={len(filtered)}")
        return filtered

    @staticmethod
    def _extract_page_text(page) -> str:
        """
        Reconstrói linhas visuais agrupando palavras pela coordenada Y.
        Necessário para PDFs (ex: Santander) onde cada célula é um objeto
        posicionado no PDF; get_text() padrão retorna em ordem de stream,
        podendo separar data/descrição/valor em linhas distintas.
        """
        words = page.get_text("words")  # (x0, y0, x1, y1, word, block, line, word_no)
        if not words:
            return page.get_text()  # fallback

        LINE_TOL = 3.0
        lines: list[tuple[float, list[tuple[float, str]]]] = []
        for x0, y0, _x1, _y1, word, *_ in words:
            matched = False
            for i, (line_y, line_words) in enumerate(lines):
                if abs(y0 - line_y) < LINE_TOL:
                    line_words.append((x0, word))
                    matched = True
                    break
            if not matched:
                lines.append((y0, [(x0, word)]))

        lines.sort(key=lambda l: l[0])
        return "\n".join(
            " ".join(w for _, w in sorted(line_words, key=lambda p: p[0]))
            for _, line_words in lines
        )

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

    def _call_groq_chunked(self, text: str, year_month_hint: str | None = None) -> list[dict]:
        """Divide texto grande em chunks e agrega o resultado JSON de cada chamada."""
        chunks = self._split_into_chunks(text, self._MAX_CHARS)
        if len(chunks) > 1:
            print(f"[GROQ] texto grande ({len(text)} chars) — dividido em {len(chunks)} chunks")

        # TEMP: log do primeiro chunk pra ver como a reconstrução por coordenadas ficou
        if chunks:
            print(f"[GROQ INPUT SAMPLE] {chunks[0][:2000]}")

        all_items: list[dict] = []
        for i, chunk in enumerate(chunks):
            if len(chunks) > 1:
                print(f"[GROQ] chunk {i + 1}/{len(chunks)} ({len(chunk)} chars)")
            raw = self._call_groq_single(chunk, year_month_hint)
            try:
                items = self._parse_json_array(raw)
                all_items.extend(items)
            except (ValueError, json.JSONDecodeError) as e:
                print(f"[GROQ WARN] chunk {i + 1} JSON inválido, pulando: {e}")
                continue
            # Pausa entre chunks para respeitar TPM 12k
            if i < len(chunks) - 1:
                time.sleep(self._CHUNK_DELAY_SECONDS)

        return all_items

    def _split_into_chunks(self, text: str, max_chars: int) -> list[str]:
        """Quebra o texto em blocos <= max_chars respeitando newlines."""
        if len(text) <= max_chars:
            return [text]

        chunks: list[str] = []
        current: list[str] = []
        current_len = 0
        for line in text.split("\n"):
            line_len = len(line) + 1  # +1 pelo '\n'
            if current_len + line_len > max_chars and current:
                chunks.append("\n".join(current))
                current = [line]
                current_len = line_len
            else:
                current.append(line)
                current_len += line_len
        if current:
            chunks.append("\n".join(current))
        return chunks

    _MAX_ATTEMPTS = 5
    _MAX_RETRY_WAIT = 60  # async worker aguenta; espera preciso do retry-after
    _ABORT_IF_WAIT_ABOVE = 90  # quota diária esgotada — tenta próxima chave

    def _call_groq_single(self, text: str, year_month_hint: str | None = None) -> str:
        hint_line = ""
        if year_month_hint and len(year_month_hint) == 7:
            hint_line = f"Ano/mês de referência da fatura: {year_month_hint}\n\n"

        for key_idx, api_key in enumerate(self._api_keys):
            result = self._try_key(api_key, key_idx, text, hint_line)
            if result is not None:
                return result
            print(f"[GROQ] chave {key_idx + 1}/{len(self._api_keys)} com quota esgotada, tentando próxima")

        raise Exception(
            "Todas as cotas do Groq estão esgotadas. Aguarde até a meia-noite (horário UTC) e tente novamente."
        )

    def _try_key(self, api_key: str, key_idx: int, text: str, hint_line: str) -> str | None:
        """Tenta processar com uma chave específica. Retorna None se quota esgotada."""
        for attempt in range(self._MAX_ATTEMPTS):
            resp = requests.post(
                self._GROQ_URL,
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": self._MODEL,
                    "messages": [
                        {"role": "system", "content": _SYSTEM},
                        {"role": "user", "content": f"{hint_line}Texto da fatura:\n\n{text}"},
                    ],
                    "temperature": 0.1,
                    "max_tokens": self._MAX_OUTPUT_TOKENS,
                },
                timeout=30,
            )
            if resp.status_code == 429:
                wait, requested = self._compute_retry_wait(resp, attempt)
                if attempt == 0:
                    print(f"[GROQ 429] chave {key_idx + 1}: {resp.text[:400]}")
                if requested > self._ABORT_IF_WAIT_ABOVE:
                    return None  # quota diária esgotada nesta chave
                print(f"[GROQ] rate limit chave {key_idx + 1} (tentativa {attempt + 1}/{self._MAX_ATTEMPTS}), aguardando {wait:.1f}s")
                time.sleep(wait)
                continue
            if not resp.ok:
                print(f"[GROQ ERROR] chave {key_idx + 1}: {resp.status_code}: {resp.text}")
                resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"].strip()
        return None  # esgotou tentativas de rate limit (per-minute)

    def _compute_retry_wait(self, resp: requests.Response, attempt: int) -> tuple[float, float]:
        """
        Retorna (wait_effective, wait_requested).
        wait_effective = quanto vamos esperar (capped)
        wait_requested = quanto o Groq pediu (pra decidir se aborta)
        """
        # Header retry-after
        retry_after = resp.headers.get("retry-after")
        if retry_after:
            try:
                requested = float(retry_after)
                return min(requested + 0.5, self._MAX_RETRY_WAIT), requested
            except ValueError:
                pass
        # Body: "try again in X.XXs"
        try:
            body = resp.json()
            msg = body.get("error", {}).get("message", "")
            m = re.search(r"try again in ([\d.]+)s", msg)
            if m:
                requested = float(m.group(1))
                return min(requested + 0.5, self._MAX_RETRY_WAIT), requested
        except (ValueError, KeyError):
            pass
        # Fallback: backoff exponencial 2, 4, 8
        w = min(2 ** (attempt + 1), self._MAX_RETRY_WAIT)
        return w, w

    def _parse_json_array(self, raw: str) -> list[dict]:
        """
        Parse tolerante: se a resposta foi truncada por max_tokens, o array
        fica sem `]` e/ou termina no meio de um objeto. Aí caímos num scanner
        que extrai os objetos completos antes do ponto de corte.
        """
        clean = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        try:
            items = json.loads(clean)
            if not isinstance(items, list):
                raise ValueError("resposta não é array JSON")
            return items
        except json.JSONDecodeError:
            recovered = self._recover_partial_objects(clean)
            if recovered:
                print(f"[GROQ] JSON truncado — recuperados {len(recovered)} objetos")
                return recovered
            raise

    @staticmethod
    def _recover_partial_objects(text: str) -> list[dict]:
        """Extrai objetos JSON completos de um array truncado."""
        items: list[dict] = []
        depth = 0
        start = -1
        in_string = False
        escape = False
        for i, ch in enumerate(text):
            if escape:
                escape = False
                continue
            if ch == "\\":
                escape = True
                continue
            if ch == '"':
                in_string = not in_string
                continue
            if in_string:
                continue
            if ch == "{":
                if depth == 0:
                    start = i
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0 and start >= 0:
                    obj_text = text[start : i + 1]
                    try:
                        obj = json.loads(obj_text)
                        if isinstance(obj, dict):
                            items.append(obj)
                    except json.JSONDecodeError:
                        pass
                    start = -1
        return items

    def _parse_items(self, items: list[dict]) -> list[Transaction]:
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
