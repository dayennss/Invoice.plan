---
title: Export transactions to CSV
status: closed
---

## Summary

Add a "Exportar CSV" button to `TransactionList` that downloads all transactions for the current month as a CSV file, with BOM for correct encoding in Brazilian Excel.

## Implementation

- Created `frontend/src/lib/export.ts` — `exportTransactionsToCSV` utility
- Modified `frontend/src/components/TransactionList.tsx` — added `yearMonth` prop and "Exportar CSV" button
- Modified `frontend/src/pages/DashboardPage.tsx` — passed `yearMonth` to `<TransactionList>`
