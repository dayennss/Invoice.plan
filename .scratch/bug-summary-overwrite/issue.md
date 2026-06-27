---
title: "Bug: segundo upload no mesmo mês sobrescreve o summary anterior"
labels: [ready-for-agent]
status: open
created: 2026-06-27
priority: P0
---

## Problema

Em `backend/functions/invoices/handler.py:97-105`, o `_build_summary` constrói o resumo **apenas das transações do upload atual** e `put_item` substitui completamente o item de summary existente no DynamoDB.

Um usuário com dois cartões de crédito que sobe dois PDFs no mesmo mês terá apenas os dados do segundo upload no dashboard.

```python
# Calcula summary só das transações deste upload
summary = _build_summary(year_month, transactions)
put_item({  # ← substitui o summary anterior inteiramente
    "PK": user_pk(user_id),
    "SK": summary_sk(year_month),
    ...
})
```

## Impacto

- Usuários com múltiplos cartões perdem dados ao fazer o segundo upload
- Total e by_category ficam incorretos
- Não há nenhum aviso ao usuário

## Solução sugerida

Ao calcular o summary, ler o summary existente do DynamoDB e **acumular** os valores:

```python
existing = get_summary(user_id, year_month)
summary = _merge_summary(existing, _build_summary(year_month, transactions))
```

A função `_merge_summary` soma `total`, merge `by_category` somando por chave, e soma `transaction_count`.

## Arquivos afetados

- `backend/functions/invoices/handler.py` — função `_upload_invoice` e nova `_merge_summary`
- `backend/shared/db.py` — importar `get_summary` no handler
