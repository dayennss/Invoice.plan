import { formatCurrency } from '@/lib/utils'

interface Props {
  title: string
  value: number
  subtitle?: string
  highlight?: boolean
}

export default function SummaryCard({ title, value, subtitle, highlight }: Props) {
  return (
    <div className={`ip-card ${highlight ? 'ip-card-accent' : ''} flex flex-col gap-1`}>
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        {title}
      </p>
      <p
        className="text-3xl font-bold financial-value"
        style={{ color: highlight ? 'var(--color-green)' : 'var(--text-primary)' }}
      >
        {formatCurrency(value)}
      </p>
      {subtitle && (
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}
