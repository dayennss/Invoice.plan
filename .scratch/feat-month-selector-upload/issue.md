---
title: "Feature: seletor de período no upload de fatura"
labels: [ready-for-agent]
status: open
created: 2026-06-27
priority: P2
---

## Contexto

Depende da resolução do bug `bug-year-month-upload-date`. Esta issue trata da interface para o usuário informar o período da fatura.

## O que construir

No componente `InvoiceUpload`, antes de confirmar o upload (ou na tela de drop), exibir um seletor de mês:

```
[ Período da fatura ] [ Maio 2026 ▼ ]
```

- Default: mês atual
- Range: últimos 6 meses até mês atual
- Ao confirmar o upload, passar `?yearMonth=2026-05` na query string

Se o usuário já estiver navegando em um mês específico no dashboard, pré-selecionar esse mês automaticamente (receber `currentYearMonth` como prop).

## Mudanças necessárias

**Frontend:**
- `InvoiceUpload.tsx` — adicionar prop `defaultYearMonth?: string` e seletor de mês
- `useUploadInvoice.ts` — passar `yearMonth` no POST

**Backend:**
- `handler.py` — ler `yearMonth` dos query params: `(event.get("queryStringParameters") or {}).get("yearMonth")` com fallback para `now[:7]`

## Arquivos afetados

- `frontend/src/components/InvoiceUpload.tsx`
- `frontend/src/hooks/useUploadInvoice.ts`
- `frontend/src/pages/DashboardPage.tsx` — passar `yearMonth={yearMonth}` para `InvoiceUpload`
- `backend/functions/invoices/handler.py`
