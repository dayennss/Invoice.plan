---
title: "Feature: suporte a múltiplos cartões de crédito"
labels: [needs-triage]
status: open
created: 2026-06-27
priority: P3
---

## Contexto

Usuários brasileiros tipicamente têm 2-3 cartões de crédito (Nubank, Itaú, C6, etc.). Atualmente, todas as transações de todos os cartões ficam misturadas sob o mesmo mês sem identificação de origem.

## O que construir

### Fase 1 — Associar cartão ao upload

- No upload, o usuário informa o nome do cartão (campo texto, ex: "Nubank", "Itaú Platinum")
- O `invoice_id` fica associado a um `card_name`
- Cada transação herda o `card_name`

### Fase 2 — Filtrar por cartão no dashboard

- Filtro "Todos os cartões / Nubank / Itaú" na `TransactionList`
- Cards de summary com breakdown por cartão
- `CategoryChart` com toggle por cartão

### Fase 3 — Gestão de cartões

- Tela de perfil com lista de cartões cadastrados
- Cor/ícone por cartão para identificação visual

## Modelo de dados (sem mudança de esquema)

```python
# Adicionar ao item de INVOICE e TRANSACTION
"card_name": "Nubank",
"card_id": "nubank-roxo",  # slug gerado no frontend
```

DynamoDB suporta novos campos sem migração — retrocompatível.

## Dependências

- Resolver `bug-summary-overwrite` primeiro (acumulação por mês)
- Resolver `feat-month-selector-upload` (período correto da fatura)

## Arquivos afetados

- `frontend/src/components/InvoiceUpload.tsx` — campo de nome do cartão
- `backend/functions/invoices/handler.py` — persistir `card_name`
- `frontend/src/components/TransactionList.tsx` — filtro por cartão
- `frontend/src/pages/DashboardPage.tsx` — estado de filtro ativo
