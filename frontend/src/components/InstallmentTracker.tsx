import { useMemo } from 'react'
import { formatCurrency } from '@/lib/utils'
import { CATEGORY_COLORS, type Transaction, type TransactionCategory } from '@/types'

interface Props {
  transactions: Transaction[]
}

interface InstallmentGroup {
  key: string
  description: string
  amount: number
  current: number
  total: number
  category: TransactionCategory
  remaining: number
}

export default function InstallmentTracker({ transactions }: Props) {
  const groups = useMemo<InstallmentGroup[]>(() => {
    return transactions
      .filter((t) => t.installment_total && t.installment_total > 1)
      .map((t) => ({
        key: t.id,
        description: t.description,
        amount: t.amount,
        current: t.installment_current ?? 1,
        total: t.installment_total ?? 1,
        category: t.category as TransactionCategory,
        remaining: (t.installment_total ?? 1) - (t.installment_current ?? 1),
      }))
      .sort((a, b) => b.remaining - a.remaining)
  }, [transactions])

  if (groups.length === 0) {
    return (
      <div className="ip-card flex flex-col gap-2">
        <SectionHeader />
        <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
          Nenhuma parcela no período
        </p>
      </div>
    )
  }

  return (
    <div className="ip-card flex flex-col gap-4">
      <SectionHeader />

      <ul className="flex flex-col gap-3">
        {groups.map((g) => {
          const progress = g.current / g.total
          const color = CATEGORY_COLORS[g.category] ?? 'var(--chart-10)'

          return (
            <li key={g.key} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                  {g.description}
                </p>
                <span className="text-sm financial-value flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>
                  {formatCurrency(g.amount)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div
                  className="flex-1 h-1.5 rounded-full overflow-hidden"
                  style={{ background: 'var(--bg-elevated)' }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${progress * 100}%`, background: color }}
                  />
                </div>
                <span className="text-xs tabular-nums flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                  {g.current}/{g.total}
                </span>
              </div>

              {g.remaining > 0 && (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Ainda {g.remaining}x de {formatCurrency(g.amount)} restando
                </p>
              )}
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
      Parcelas em andamento
    </p>
  )
}
