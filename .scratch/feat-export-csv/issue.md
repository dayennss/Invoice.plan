---
title: "Feature: exportar transações do mês como CSV"
labels: [ready-for-agent]
status: open
created: 2026-06-27
priority: P2
---

## O que construir

Botão "Exportar CSV" na `TransactionList` que baixa as transações do mês atual em formato CSV, direto no browser — sem chamada ao backend.

## Formato do CSV

```
Data,Descrição,Categoria,Valor,Parcela,Recorrente
2026-05-10,Supermercado Pão de Açúcar,alimentacao,245.80,,false
2026-05-12,Netflix,assinaturas,55.90,,true
2026-05-15,Amazon Prime 3/12,assinaturas,19.90,3/12,false
```

## Implementação

Função utilitária pura no frontend:

```typescript
function exportToCSV(transactions: Transaction[], yearMonth: string) {
  const header = 'Data,Descrição,Categoria,Valor,Parcela,Recorrente'
  const rows = transactions.map(tx => [
    tx.date,
    `"${tx.description.replace(/"/g, '""')}"`,
    tx.category,
    tx.amount.toFixed(2),
    tx.installment_current ? `${tx.installment_current}/${tx.installment_total}` : '',
    tx.is_recurring ? 'sim' : 'não',
  ].join(','))
  const csv = [header, ...rows].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  // download via URL.createObjectURL
}
```

O BOM `﻿` garante que o Excel brasileiro abra corretamente com acentos.

## Arquivos afetados

- `frontend/src/components/TransactionList.tsx` — botão + trigger
- `frontend/src/lib/export.ts` — novo utilitário (ou inline no componente)
