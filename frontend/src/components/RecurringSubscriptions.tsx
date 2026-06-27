import { useMemo } from 'react'
import { formatCurrency } from '@/lib/utils'
import { CATEGORY_LABELS, CATEGORY_COLORS, type Transaction, type TransactionCategory } from '@/types'

interface Props {
  transactions: Transaction[]
}

export default function RecurringSubscriptions({ transactions }: Props) {
  const recurring = useMemo(
    () => transactions.filter((t) => t.is_recurring),
    [transactions],
  )

  if (recurring.length === 0) {
    return (
      <div className="ip-card flex flex-col gap-2">
        <SectionHeader />
        <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
          Nenhuma assinatura detectada
        </p>
      </div>
    )
  }

  const total = recurring.reduce((acc, t) => acc + t.amount, 0)

  return (
    <div className="ip-card flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <SectionHeader />
        <span className="text-sm font-semibold financial-value" style={{ color: 'var(--financial-expense)' }}>
          {formatCurrency(total)}/mês
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {recurring.map((tx) => {
          const color = CATEGORY_COLORS[tx.category as TransactionCategory] ?? 'var(--chart-10)'
          const label = CATEGORY_LABELS[tx.category as TransactionCategory] ?? tx.category

          return (
            <li
              key={tx.id}
              className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg"
              style={{ background: 'var(--bg-elevated)' }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: color }}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {tx.description}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {label}
                  </p>
                </div>
              </div>
              <span className="text-sm font-semibold financial-value flex-shrink-0" style={{ color: 'var(--text-primary)' }}>
                {formatCurrency(tx.amount)}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function SectionHeader() {
  return (
    <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
      Assinaturas recorrentes
    </p>
  )
}
