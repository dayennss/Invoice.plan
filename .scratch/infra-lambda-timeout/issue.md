---
title: "Infra: aumentar timeout da Lambda de invoices para 90s"
labels: [ready-for-agent]
status: open
created: 2026-06-27
priority: P1
---

## Problema

A Lambda `InvoicesFunction` tem timeout de 60s (`api_stack.py:39`). O pipeline de processamento inclui:

- Chamada SSM (~100-200ms cold start)
- PyMuPDF extract (~200ms para PDFs grandes)
- Chamada Groq com `timeout=30` (`groq_provider.py:115`)
- Se retry por rate limit: até 7s adicionais de sleep
- Parse + DynamoDB writes

No pior caso (cold start + rate limit retry + Groq lento), o total pode superar 60s.

## Solução

Aumentar o timeout para 90s em `infra/stacks/api_stack.py`:

```python
invoices_fn = lambda_.Function(
    ...
    timeout=cdk.Duration.seconds(90),  # era 60
    ...
)
```

O API Gateway HTTP v2 suporta até 30s de timeout por padrão, mas pode ser configurado para até 29s. **Atenção**: se o API GW tiver timeout menor que a Lambda, o cliente recebe 504 mesmo que a Lambda complete. Verificar se há timeout configurado no API GW (atualmente não parece ter).

## Arquivos afetados

- `infra/stacks/api_stack.py` — linha 39
