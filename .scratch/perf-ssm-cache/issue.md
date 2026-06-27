---
title: "Perf: cache da chave SSM em memória entre invocações warm"
labels: [ready-for-agent]
status: open
created: 2026-06-27
priority: P1
---

## Problema

Em `backend/shared/providers/groq_provider.py:46-47`, a chave de API do Groq é buscada no SSM Parameter Store **a cada instanciação do `GroqProvider`**. Isso adiciona 100-200ms de latência desnecessária em toda invocação Lambda (incluindo warm invocations).

```python
def __init__(self):
    ssm_param = os.environ.get("SSM_GROQ_API_KEY")
    self._api_key = _get_ssm_value(ssm_param) if ssm_param else os.environ["GROQ_API_KEY"]
```

## Solução

Cachear o valor em uma variável de módulo. O Lambda reutiliza o processo entre invocações warm, então o valor é lido apenas uma vez por container:

```python
_CACHED_API_KEY: str | None = None

class GroqProvider(AIProvider):
    def __init__(self):
        global _CACHED_API_KEY
        if _CACHED_API_KEY is None:
            ssm_param = os.environ.get("SSM_GROQ_API_KEY")
            _CACHED_API_KEY = _get_ssm_value(ssm_param) if ssm_param else os.environ["GROQ_API_KEY"]
        self._api_key = _CACHED_API_KEY
```

## Benefício

- Elimina chamada SSM em invocações warm (~100-200ms por request)
- Reduz custo de chamadas SSM

## Arquivos afetados

- `backend/shared/providers/groq_provider.py`
