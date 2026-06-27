import { CATEGORY_LABELS, type Transaction, type TransactionCategory } from '@/types'

export function exportTransactionsToCSV(transactions: Transaction[], yearMonth: string): void {
  const header = 'Data,Descrição,Categoria,Valor (R$),Parcela,Recorrente'
  const rows = transactions.map((tx) => {
    const category = CATEGORY_LABELS[tx.category as TransactionCategory] ?? tx.category
    const installment = tx.installment_current && tx.installment_total
      ? `${tx.installment_current}/${tx.installment_total}`
      : ''
    const recurring = tx.is_recurring ? 'sim' : 'não'
    const description = `"${tx.description.replace(/"/g, '""')}"`
    return [tx.date, description, category, tx.amount.toFixed(2), installment, recurring].join(',')
  })

  // BOM garante que Excel brasileiro abra com acentos corretos
  const csv = '﻿' + [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `transacoes-${yearMonth}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
