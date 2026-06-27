import { useMemo } from 'react'
import { formatCurrency } from '@/lib/utils'
import type { Transaction } from '@/types'

interface Props {
  transactions: Transaction[]
  yearMonth: string
}

const WEEK_DAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

export default function SpendingHeatmap({ transactions, yearMonth }: Props) {
  const { cells, maxSpend } = useMemo(() => {
    const [y, m] = yearMonth.split('-').map(Number)
    const daysInMonth = new Date(y, m, 0).getDate()
    const firstWeekday = new Date(y, m - 1, 1).getDay()

    const byDay: Record<number, number> = {}
    for (const tx of transactions) {
      const day = parseInt(tx.date.split('-')[2], 10)
      byDay[day] = (byDay[day] ?? 0) + tx.amount
    }

    const maxSpend = Math.max(...Object.values(byDay), 1)

    const cells: Array<{ day: number | null; amount: number }> = []
    for (let i = 0; i < firstWeekday; i++) cells.push({ day: null, amount: 0 })
    for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, amount: byDay[d] ?? 0 })

    return { cells, maxSpend }
  }, [transactions, yearMonth])

  const intensity = (amount: number) => {
    if (amount === 0) return 0
    return Math.max(0.12, Math.min(1, amount / maxSpend))
  }

  return (
    <div className="ip-card flex flex-col gap-4">
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        Gastos por dia
      </p>

      <div className="grid grid-cols-7 gap-1.5">
        {WEEK_DAYS.map((d, i) => (
          <div
            key={i}
            className="text-center text-xs font-medium pb-1"
            style={{ color: 'var(--text-disabled)' }}
          >
            {d}
          </div>
        ))}

        {cells.map((cell, i) => {
          if (!cell.day) {
            return <div key={i} />
          }

          const alpha = intensity(cell.amount)
          const isToday =
            new Date().toISOString().slice(0, 7) === yearMonth &&
            new Date().getDate() === cell.day

          return (
            <div
              key={i}
              title={cell.amount > 0 ? `${cell.day}: ${formatCurrency(cell.amount)}` : `${cell.day}`}
              className="relative aspect-square rounded-md flex items-center justify-center cursor-default transition-transform hover:scale-110"
              style={{
                background:
                  cell.amount > 0
                    ? `rgba(25, 196, 99, ${alpha})`
                    : 'var(--bg-elevated)',
                outline: isToday ? '2px solid var(--color-green)' : undefined,
              }}
            >
              <span
                className="text-xs font-medium"
                style={{
                  color: alpha > 0.5 ? 'var(--color-black)' : 'var(--text-muted)',
                }}
              >
                {cell.day}
              </span>
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-2 mt-1">
        <span className="text-xs" style={{ color: 'var(--text-disabled)' }}>
          Sem gasto
        </span>
        <div className="flex gap-1">
          {[0.12, 0.3, 0.5, 0.7, 1].map((a) => (
            <div
              key={a}
              className="w-4 h-4 rounded-sm"
              style={{ background: `rgba(25, 196, 99, ${a})` }}
            />
          ))}
        </div>
        <span className="text-xs" style={{ color: 'var(--text-disabled)' }}>
          Alto gasto
        </span>
      </div>
    </div>
  )
}
