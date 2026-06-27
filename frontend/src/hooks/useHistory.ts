import { useQueries } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { format, subMonths } from 'date-fns'

interface MonthPoint {
  year_month: string
  total: number
  by_category: Record<string, number>
  transaction_count: number
}

export function useHistory(currentYearMonth: string, count = 6) {
  const [year, month] = currentYearMonth.split('-').map(Number)
  const baseDate = new Date(year, month - 1, 1)

  const months = Array.from({ length: count }, (_, i) =>
    format(subMonths(baseDate, count - 1 - i), 'yyyy-MM'),
  )

  const results = useQueries({
    queries: months.map((ym) => ({
      queryKey: ['dashboard', ym],
      queryFn: async () => {
        const { data } = await api.get(`/dashboard/${ym}`)
        return data
      },
      staleTime: 5 * 60 * 1000,
    })),
  })

  const points: MonthPoint[] = months.map((ym, i) => ({
    year_month: ym,
    total: results[i].data?.summary?.total ?? 0,
    by_category: results[i].data?.summary?.by_category ?? {},
    transaction_count: results[i].data?.summary?.transaction_count ?? 0,
  }))

  return {
    points,
    isLoading: results.some((r) => r.isLoading),
  }
}
