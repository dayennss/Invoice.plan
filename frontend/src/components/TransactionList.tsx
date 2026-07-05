import { useMemo, useState } from 'react'
import {
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  invoiceColor,
  type Invoice,
  type Transaction,
  type TransactionCategory,
} from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { exportTransactionsToCSV } from '@/lib/export'

interface Props {
  transactions: Transaction[]
  invoices: Invoice[]
  yearMonth: string
}

type Filter =
  | { type: 'all' }
  | { type: 'category'; value: string }
  | { type: 'invoice'; value: string }

export default function TransactionList({ transactions, invoices, yearMonth }: Props) {
  const [filter, setFilter] = useState<Filter>({ type: 'all' })

  const categories = useMemo(
    () => [...new Set(transactions.map((t) => t.category))],
    [transactions],
  )

  const doneInvoices = useMemo(
    () => invoices.filter((i) => i.status === 'done'),
    [invoices],
  )
  const invoiceIds = doneInvoices.map((i) => i.invoice_id)
  const showInvoiceFilter = doneInvoices.length > 1

  const filtered = useMemo(() => {
    if (filter.type === 'all') return transactions
    if (filter.type === 'category') return transactions.filter((t) => t.category === filter.value)
    return transactions.filter((t) => t.invoice_id === filter.value)
  }, [transactions, filter])

  const isActive = (f: Filter): boolean => {
    if (f.type !== filter.type) return false
    if (f.type === 'all') return true
    return (f as { value: string }).value === (filter as { value: string }).value
  }

  return (
    <div className="ip-card flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          Transações ({filtered.length})
        </p>
        <button
          onClick={() => exportTransactionsToCSV(transactions, yearMonth)}
          disabled={transactions.length === 0}
          className="text-xs px-2.5 py-1 rounded-md"
          style={{
            color: 'var(--text-muted)',
            border: '1px solid var(--border-default)',
            cursor: transactions.length === 0 ? 'not-allowed' : 'pointer',
            opacity: transactions.length === 0 ? 0.4 : 1,
          }}
        >
          Exportar CSV
        </button>
      </div>

      {showInvoiceFilter && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Fatura:
          </span>
          <FilterChip
            label="Todas"
            active={filter.type === 'all'}
            onClick={() => setFilter({ type: 'all' })}
          />
          {doneInvoices.map((inv) => (
            <FilterChip
              key={inv.invoice_id}
              label={inv.label}
              dotColor={invoiceColor(inv.invoice_id, invoiceIds)}
              active={isActive({ type: 'invoice', value: inv.invoice_id })}
              onClick={() => setFilter({ type: 'invoice', value: inv.invoice_id })}
            />
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Categoria:
        </span>
        {!showInvoiceFilter && (
          <FilterChip
            label="Todas"
            active={filter.type === 'all'}
            onClick={() => setFilter({ type: 'all' })}
          />
        )}
        {categories.map((cat) => (
          <FilterChip
            key={cat}
            label={CATEGORY_LABELS[cat as TransactionCategory] ?? cat}
            active={isActive({ type: 'category', value: cat })}
            onClick={() => setFilter({ type: 'category', value: cat })}
          />
        ))}
      </div>

      <div className="flex flex-col gap-1">
        {filtered.length === 0 && (
          <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
            Nenhuma transação encontrada.
          </p>
        )}
        {filtered.map((tx) => (
          <TransactionRow
            key={tx.id}
            tx={tx}
            invoiceIds={invoiceIds}
            showInvoiceBadge={doneInvoices.length > 1}
          />
        ))}
      </div>
    </div>
  )
}

function TransactionRow({ tx, invoiceIds, showInvoiceBadge }: {
  tx: Transaction
  invoiceIds: string[]
  showInvoiceBadge: boolean
}) {
  const invColor = invoiceColor(tx.invoice_id, invoiceIds)
  const catColor = CATEGORY_COLORS[tx.category as TransactionCategory] ?? 'var(--chart-10)'
  const catLabel = CATEGORY_LABELS[tx.category as TransactionCategory] ?? tx.category

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
          style={{ background: showInvoiceBadge ? invColor : catColor }}
          title={showInvoiceBadge ? tx.invoice_label : catLabel}
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
          <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
            {catLabel}
            {showInvoiceBadge && tx.invoice_label && (
              <> · <span style={{ color: invColor }}>{tx.invoice_label}</span></>
            )}
            {' · '}
            {formatDate(tx.date)}
          </p>
        </div>
      </div>
      <p className="text-sm font-semibold financial-value flex-shrink-0 ml-4 value-expense">
        -{formatCurrency(tx.amount)}
      </p>
    </div>
  )
}

function FilterChip({ label, active, onClick, dotColor }: {
  label: string
  active: boolean
  onClick: () => void
  dotColor?: string
}) {
  return (
    <button
      onClick={onClick}
      className="text-xs px-3 py-1 rounded-full transition-all inline-flex items-center gap-1.5"
      style={{
        background: active ? 'var(--accent-subtle)' : 'transparent',
        color: active ? 'var(--color-green)' : 'var(--text-muted)',
        border: `1px solid ${active ? 'var(--border-accent)' : 'var(--border-default)'}`,
        cursor: 'pointer',
      }}
    >
      {dotColor && (
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: dotColor }}
        />
      )}
      {label}
    </button>
  )
}
