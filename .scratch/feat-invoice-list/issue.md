---
title: "Feature: tela de gerenciamento de faturas enviadas"
labels: [ready-for-human]
status: open
created: 2026-06-27
priority: P1
---

## Contexto

O endpoint `GET /invoices` já existe e retorna a lista de invoices do usuário (`handler.py:128`). Mas não há nenhuma tela no frontend que consuma esse endpoint. O usuário não consegue ver o histórico de uploads nem identificar se uma fatura falhou.

## O que construir

Uma nova seção ou página "Minhas Faturas" com:

- Lista de invoices com: nome do arquivo, mês de referência, status (processing/done/error), número de transações
- Badge de status colorido (done=verde, processing=amarelo, error=vermelho)
- Botão "Reprocessar" para invoices com status `error`
- Botão "Excluir" para remover uma fatura e suas transações (requer endpoint DELETE)

## Backend necessário

Novo endpoint `DELETE /invoices/{invoiceId}` que:
1. Remove o item `INVOICE#{yearMonth}#{invoiceId}` do DynamoDB
2. Remove todas as transações `TRANSACTION#*` com `invoice_id == invoiceId`
3. Recalcula o summary do mês sem essas transações

## Arquivos afetados

- `backend/functions/invoices/handler.py` — adicionar handler para DELETE
- `frontend/src/hooks/useInvoices.ts` — novo hook TanStack Query
- `frontend/src/components/InvoiceList.tsx` — novo componente
- `frontend/src/pages/DashboardPage.tsx` — integrar componente
