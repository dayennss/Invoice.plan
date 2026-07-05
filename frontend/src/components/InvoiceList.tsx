import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useInvoices } from '@/hooks/useInvoices'
import { useDeleteInvoice } from '@/hooks/useDeleteInvoice'
import { invoiceColor, type Invoice } from '@/types'
import InvoiceUpload from './InvoiceUpload'

interface Props {
  yearMonth: string
}

export default function InvoiceList({ yearMonth }: Props) {
  const { data: invoices = [], isLoading } = useInvoices(yearMonth)
  const [adding, setAdding] = useState(false)

  const monthLabel = format(new Date(`${yearMonth}-01`), "MMMM 'de' yyyy", { locale: ptBR })
  const doneInvoices = invoices.filter((i) => i.status === 'done')
  const processingInvoices = invoices.filter((i) => i.status === 'processing')
  const errorInvoices = invoices.filter((i) => i.status === 'error')
  const visibleInvoices = [...processingInvoices, ...doneInvoices, ...errorInvoices]
  const invoiceIds = doneInvoices.map((i) => i.invoice_id)

  if (isLoading) {
    return (
      <div className="ip-card">
        <div className="h-6 w-40 rounded animate-pulse" style={{ background: 'var(--surface-secondary)' }} />
      </div>
    )
  }

  return (
    <div className="ip-card flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            Faturas de {monthLabel}
          </p>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {visibleInvoices.length === 0
              ? 'Nenhuma fatura ainda'
              : `${doneInvoices.length} concluída${doneInvoices.length === 1 ? '' : 's'}` +
                (processingInvoices.length > 0
                  ? ` · ${processingInvoices.length} processando`
                  : '') +
                (errorInvoices.length > 0
                  ? ` · ${errorInvoices.length} com erro`
                  : '')}
          </p>
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-sm px-3 py-1.5 rounded-md font-medium"
            style={{
              color: 'var(--color-green)',
              background: 'var(--accent-subtle)',
              border: '1px solid var(--border-accent)',
              cursor: 'pointer',
            }}
          >
            + Adicionar fatura
          </button>
        )}
      </div>

      {visibleInvoices.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {visibleInvoices.map((inv) => (
            <InvoiceChip
              key={inv.invoice_id}
              invoice={inv}
              color={invoiceColor(inv.invoice_id, invoiceIds)}
              yearMonth={yearMonth}
            />
          ))}
        </div>
      )}

      {adding && (
        <div className="pt-2" style={{ borderTop: '1px solid var(--border-default)' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Nova fatura
            </p>
            <button
              onClick={() => setAdding(false)}
              className="text-xs px-2 py-1 rounded"
              style={{ color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              Fechar
            </button>
          </div>
          <InvoiceUpload variant="compact" />
        </div>
      )}
    </div>
  )
}

function InvoiceChip({ invoice, color, yearMonth }: {
  invoice: Invoice
  color: string
  yearMonth: string
}) {
  const [confirming, setConfirming] = useState(false)
  const { mutate: deleteInvoice, isPending } = useDeleteInvoice()

  function handleDelete() {
    deleteInvoice(
      { invoiceId: invoice.invoice_id, yearMonth },
      { onSuccess: () => setConfirming(false) },
    )
  }

  if (confirming) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg"
        style={{
          background: 'var(--financial-expense-bg)',
          border: '1px solid var(--financial-expense-border)',
        }}
      >
        <span className="text-xs" style={{ color: 'var(--financial-expense)' }}>
          Excluir "{invoice.label}"?
        </span>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="text-xs font-medium px-2 py-0.5 rounded"
          style={{
            background: 'var(--financial-expense)',
            color: '#fff',
            cursor: isPending ? 'not-allowed' : 'pointer',
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {isPending ? '...' : 'Sim'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={isPending}
          className="text-xs px-2 py-0.5 rounded"
          style={{ color: 'var(--text-muted)', cursor: 'pointer' }}
        >
          Não
        </button>
      </div>
    )
  }

  const isProcessing = invoice.status === 'processing'
  const isError = invoice.status === 'error'

  const bgColor = isError ? 'var(--financial-expense-bg)' : 'var(--surface-secondary)'
  const borderColor = isError ? 'var(--financial-expense-border)' : 'var(--border-default)'

  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg group"
      style={{ background: bgColor, border: `1px solid ${borderColor}` }}
    >
      {isProcessing ? (
        <div
          className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin flex-shrink-0"
          style={{ borderColor: 'var(--color-green)', borderTopColor: 'transparent' }}
        />
      ) : isError ? (
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ background: 'var(--financial-expense)' }}
        />
      ) : (
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ background: color }}
        />
      )}
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {invoice.label}
        </span>
        <span className="text-xs" style={{ color: isError ? 'var(--financial-expense)' : 'var(--text-muted)' }}>
          {isProcessing
            ? 'Processando…'
            : isError
              ? 'Falha ao processar'
              : `${invoice.transaction_count ?? 0} transações`}
        </span>
      </div>
      <button
        onClick={() => setConfirming(true)}
        aria-label={`Excluir fatura ${invoice.label}`}
        className="ml-1 w-6 h-6 flex items-center justify-center rounded-md text-sm transition-colors"
        style={{
          color: 'var(--text-muted)',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--financial-expense-bg)'
          e.currentTarget.style.color = 'var(--financial-expense)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = 'var(--text-muted)'
        }}
      >
        ×
      </button>
    </div>
  )
}
