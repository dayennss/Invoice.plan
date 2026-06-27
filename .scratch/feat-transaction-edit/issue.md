---
title: "Feature: edição inline de categoria em transações"
labels: [ready-for-human]
status: open
created: 2026-06-27
priority: P1
---

## Contexto

A IA categoriza as transações automaticamente, mas comete erros (ex: "Netflix" como "alimentacao", "Uber" como "transporte" quando foi Uber Eats). Não há como corrigir sem acessar o DynamoDB diretamente.

## O que construir

Edição inline de categoria na `TransactionList`:

- Ao clicar na categoria de uma transação, abre um `<select>` com as 10 categorias disponíveis
- Ao confirmar, chama `PATCH /transactions/{transactionId}` com o novo valor
- Otimistic update via TanStack Query para resposta imediata
- Recalcular o summary do mês após a mudança

## Categorias disponíveis

```
alimentacao, transporte, moradia, saude, lazer,
educacao, assinaturas, vestuario, transferencias, outros
```

## Backend necessário

Novo endpoint `PATCH /transactions/{transactionId}` que:
1. Atualiza o campo `category` no item `TRANSACTION#*`
2. Recalcula e atualiza o summary do mês (by_category mudou)

Precisa de `year_month` para recalcular o summary — pode vir como query param ou ser derivado do SK da transação.

## Arquivos afetados

- `backend/functions/invoices/handler.py` — adicionar rota no handler (ou novo arquivo)
- `frontend/src/components/TransactionList.tsx` — adicionar edição inline
- `frontend/src/hooks/useUpdateTransaction.ts` — novo hook de mutation
