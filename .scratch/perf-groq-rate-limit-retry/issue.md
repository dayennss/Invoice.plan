---
title: "Perf: retry com backoff ao receber 429 do Groq"
labels: [ready-for-agent]
status: open
created: 2026-06-27
priority: P1
---

## Problema

Em `backend/shared/providers/groq_provider.py:116`, quando o Groq retorna HTTP 429 (rate limit do free tier: 12k TPM), o código chama `resp.raise_for_status()` imediatamente. Isso propaga um 500 para o usuário sem tentar novamente.

O free tier limita por janela de 1 minuto — um retry simples com 2-3s de espera resolve a maioria dos casos de burst.

## Solução

Adicionar retry com backoff exponencial, máximo de 3 tentativas:

```python
import time

def _call_groq(self, text: str) -> str:
    for attempt in range(3):
        resp = requests.post(...)
        if resp.status_code == 429:
            wait = 2 ** attempt  # 1s, 2s, 4s
            print(f"[GROQ] rate limit, aguardando {wait}s (tentativa {attempt+1}/3)")
            time.sleep(wait)
            continue
        if not resp.ok:
            resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"].strip()
    raise Exception("Groq rate limit excedido após 3 tentativas")
```

## Observação sobre timeout Lambda

O Lambda de invoices tem timeout de 60s (`api_stack.py:39`). Com 3 tentativas e até 7s de espera total + 30s de timeout do requests, o pior caso é ~37s — dentro do limite mas próximo. Considerar aumentar o timeout para 90s (ver issue relacionada).

## Arquivos afetados

- `backend/shared/providers/groq_provider.py` — método `_call_groq`
