---
title: "Bug: year_month usa data de upload, não o período da fatura"
labels: [ready-for-agent]
status: open
created: 2026-06-27
priority: P0
---

## Problema

Em `backend/functions/invoices/handler.py:53`, o `year_month` é derivado de `datetime.utcnow()` — ou seja, a data em que o usuário fez o upload. Se o usuário sobe a fatura de maio em junho, todas as transações e o summary ficam registrados em junho.

```python
now = datetime.utcnow().isoformat()
year_month = now[:7]  # YYYY-MM  ← usa data de hoje, não da fatura
```

## Impacto

- Dashboard mostra dados no mês errado
- Navegação por mês fica inconsistente
- Summary de junho vai acumular dados de maio indevidamente

## Solução sugerida

Duas abordagens possíveis (em ordem de preferência):

1. **Perguntar ao usuário no upload**: adicionar query param `?yearMonth=2026-05` opcional. O frontend exibe um seletor de mês antes/durante o upload. Se omitido, usa o mês atual como fallback.
2. **Extrair do PDF**: tentar extrair o período da fatura do texto do PDF via regex antes de chamar a IA. Complexo e não confiável para todos os bancos.

A abordagem 1 é a mais simples e 100% confiável.

## Arquivos afetados

- `backend/functions/invoices/handler.py` — linha 53
- `frontend/src/hooks/useUploadInvoice.ts` — adicionar parâmetro `yearMonth`
- `frontend/src/components/InvoiceUpload.tsx` — adicionar seletor de mês
