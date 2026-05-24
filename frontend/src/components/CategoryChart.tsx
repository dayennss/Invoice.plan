import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { CATEGORY_LABELS, CATEGORY_COLORS, type TransactionCategory } from '@/types'
import { formatCurrency } from '@/lib/utils'

interface Props {
  byCategory: Record<string, number>
}

export default function CategoryChart({ byCategory }: Props) {
  const data = Object.entries(byCategory)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([key, value]) => ({
      key,
      name: CATEGORY_LABELS[key as TransactionCategory] ?? key,
      value,
      color: CATEGORY_COLORS[key as TransactionCategory] ?? 'var(--chart-10)',
    }))

  if (data.length === 0) {
    return (
      <div className="ip-card flex items-center justify-center h-64">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Nenhum dado disponível
        </p>
      </div>
    )
  }

  return (
    <div className="ip-card flex flex-col gap-4">
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        Gastos por categoria
      </p>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry) => (
              <Cell key={entry.key} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            contentStyle={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: '13px',
            }}
          />
          <Legend
            formatter={(value) => (
              <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
