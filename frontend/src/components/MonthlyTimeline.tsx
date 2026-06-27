import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { formatCurrency } from '@/lib/utils'
import { useHistory } from '@/hooks/useHistory'

interface Props {
  yearMonth: string
}

export default function MonthlyTimeline({ yearMonth }: Props) {
  const { points, isLoading } = useHistory(yearMonth, 6)

  const data = points.map((p) => ({
    label: format(new Date(p.year_month + '-01'), 'MMM', { locale: ptBR }),
    total: p.total,
  }))

  return (
    <div className="ip-card flex flex-col gap-4">
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        Evolução mensal (6 meses)
      </p>

      {isLoading ? (
        <div className="h-48 animate-pulse rounded-lg" style={{ background: 'var(--bg-elevated)' }} />
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="timelineGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-green)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-green)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border-subtle)"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) =>
                v === 0 ? '' : `R$${(v / 1000).toFixed(0)}k`
              }
              width={40}
            />
            <Tooltip
              formatter={(value: number) => [formatCurrency(value), 'Total']}
              contentStyle={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontSize: '13px',
              }}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke="var(--color-green)"
              strokeWidth={2}
              fill="url(#timelineGradient)"
              dot={{ fill: 'var(--color-green)', r: 3, strokeWidth: 0 }}
              activeDot={{ fill: 'var(--color-green-light)', r: 5, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
