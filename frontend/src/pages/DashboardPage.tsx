import { useState } from 'react'
import { format, subMonths, addMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import AppHeader from '@/components/AppHeader'
import SummaryCard from '@/components/SummaryCard'
import CategoryChart from '@/components/CategoryChart'
import TransactionList from '@/components/TransactionList'
import InvoiceUpload from '@/components/InvoiceUpload'
import InvoiceList from '@/components/InvoiceList'
import MonthlyTimeline from '@/components/MonthlyTimeline'
import SpendingHeatmap from '@/components/SpendingHeatmap'
import RecurringSubscriptions from '@/components/RecurringSubscriptions'
import InstallmentTracker from '@/components/InstallmentTracker'
import { useDashboard } from '@/hooks/useDashboard'
import { useInvoices } from '@/hooks/useInvoices'
import { useAuthState } from '@/hooks/useAuthState'

export default function DashboardPage() {
  const { user } = useAuthState()
  const [currentDate, setCurrentDate] = useState(new Date())
  const yearMonth = format(currentDate, 'yyyy-MM')
  const { data, isLoading } = useDashboard(yearMonth)
  const { data: invoices = [] } = useInvoices(yearMonth)

  const monthLabel = format(currentDate, 'MMMM yyyy', { locale: ptBR })
  const firstName = user?.displayName?.split(' ')[0] ?? 'você'

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-base)' }}>
      <AppHeader />

      <main className="flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full flex flex-col gap-6">

        {/* Saudação + navegação de mês */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Olá, {firstName}
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Resumo financeiro de {monthLabel}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <MonthNavButton onClick={() => setCurrentDate(d => subMonths(d, 1))} direction="prev" />
            <span
              className="text-sm font-medium px-3 py-1.5 rounded-lg capitalize"
              style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)' }}
            >
              {monthLabel}
            </span>
            <MonthNavButton
              onClick={() => setCurrentDate(d => addMonths(d, 1))}
              direction="next"
              disabled={format(addMonths(currentDate, 1), 'yyyy-MM') > format(new Date(), 'yyyy-MM')}
            />
          </div>
        </div>

        {isLoading ? (
          <LoadingSkeleton />
        ) : (data?.summary?.transaction_count ?? 0) === 0 ? (
          /* Estado vazio — convida ao upload */
          <div className="flex flex-col gap-6">
            <EmptyState month={monthLabel} />
            <InvoiceUpload />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Lista de faturas do mês + botão adicionar */}
            <InvoiceList yearMonth={yearMonth} />

            {/* Cards de resumo */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <SummaryCard
                title="Total do mês"
                value={data?.summary?.total ?? 0}
                subtitle={`${data?.summary?.transaction_count ?? 0} transações`}
                highlight
              />
              <SummaryCard
                title="Maior categoria"
                value={topCategoryValue(data?.summary?.by_category)}
                subtitle={topCategoryName(data?.summary?.by_category)}
              />
              <SummaryCard
                title="Média por dia"
                value={(data?.summary?.total ?? 0) / daysInMonth(yearMonth)}
                subtitle="no período"
              />
            </div>

            {/* Gráfico de categorias */}
            <CategoryChart byCategory={data?.summary?.by_category ?? {}} />

            {/* Evolução mensal */}
            <MonthlyTimeline yearMonth={yearMonth} />

            {/* Heatmap */}
            <SpendingHeatmap
              transactions={data?.transactions ?? []}
              yearMonth={yearMonth}
            />

            {/* Assinaturas + Parcelas */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <RecurringSubscriptions transactions={data?.transactions ?? []} />
              <InstallmentTracker transactions={data?.transactions ?? []} />
            </div>

            {/* Lista de transações */}
            <TransactionList
              transactions={data?.transactions ?? []}
              invoices={invoices}
              yearMonth={yearMonth}
            />
          </div>
        )}
      </main>
    </div>
  )
}

/* ── Helpers ── */

function topCategoryValue(byCategory?: Record<string, number>): number {
  if (!byCategory) return 0
  return Math.max(...Object.values(byCategory), 0)
}

function topCategoryName(byCategory?: Record<string, number>): string {
  if (!byCategory) return '—'
  const top = Object.entries(byCategory).sort(([, a], [, b]) => b - a)[0]
  return top ? top[0] : '—'
}

function daysInMonth(yearMonth: string): number {
  const [y, m] = yearMonth.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

/* ── Sub-components ── */

function MonthNavButton({ onClick, direction, disabled }: {
  onClick: () => void
  direction: 'prev' | 'next'
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
      style={{
        background: 'var(--bg-card)',
        color: disabled ? 'var(--text-disabled)' : 'var(--text-secondary)',
        border: '1px solid var(--border-default)',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {direction === 'prev' ? '‹' : '›'}
    </button>
  )
}

function EmptyState({ month }: { month: string }) {
  return (
    <div className="ip-card flex flex-col items-center gap-3 py-10 text-center">
      <span className="text-4xl">📄</span>
      <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
        Nenhuma fatura em {month}
      </p>
      <p className="text-sm max-w-xs" style={{ color: 'var(--text-muted)' }}>
        Faça upload do PDF da sua fatura de cartão de crédito para ver seus gastos organizados.
      </p>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="ip-card h-24" style={{ background: 'var(--bg-card)' }} />
        ))}
      </div>
      <div className="ip-card h-72" style={{ background: 'var(--bg-card)' }} />
    </div>
  )
}
