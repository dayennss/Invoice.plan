import { useState } from 'react'
import { CATEGORY_LABELS, CATEGORY_COLORS, type Transaction, type TransactionCategory } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'

interface Props {
  transactions: Transaction[]
}

export default function TransactionList({ transactions }: Props) {
  const [filter, setFilter] = useState<string>('all')

  const categories = [...new Set(transactions.map((t) => t.category))]

  const filtered = filter === 'all'
    ? transactions
    : transactions.filter((t) => t.category === filter)

  return (
    <div className="ip-card flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          Transações ({filtered.length})
        </p>
        <div className="flex gap-2 flex-wrap">
          <FilterChip label="Todas" active={filter === 'all'} onClick={() => setFilter('all')} />
          {categories.map((cat) => (
            <FilterChip
              key={cat}
              label={CATEGORY_LABELS[cat as TransactionCategory] ?? cat}
              active={filter === cat}
              onClick={() => setFilter(cat)}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        {filtered.length === 0 && (
          <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
            Nenhuma transação encontrada.
          </p>
        )}
        {filtered.map((tx) => (
          <TransactionRow key={tx.id} tx={tx} />
        ))}
      </div>
    </div>
  )
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const color = CATEGORY_COLORS[tx.category as TransactionCategory] ?? 'var(--chart-10)'
  const label = CATEGORY_LABELS[tx.category as TransactionCategory] ?? tx.category

  return (
    <div
      className="flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors"
      style={{ background: 'transparent' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--hover-overlay)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: color }}
        />
        <div className="min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
            {tx.description}
            {tx.installment_current && tx.installment_total && (
              <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                {tx.installment_current}/{tx.installment_total}x
              </span>
            )}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {label} · {formatDate(tx.date)}
          </p>
        </div>
      </div>
      <p className="text-sm font-semibold financial-value flex-shrink-0 ml-4 value-expense">
        -{formatCurrency(tx.amount)}
      </p>
    </div>
  )
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-xs px-3 py-1 rounded-full transition-all"
      style={{
        background: active ? 'var(--accent-subtle)' : 'transparent',
        color: active ? 'var(--color-green)' : 'var(--text-muted)',
        border: `1px solid ${active ? 'var(--border-accent)' : 'var(--border-default)'}`,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}
