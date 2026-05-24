import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { format } from 'date-fns'
import type { MonthlySummary, Transaction } from '@/types'

interface DashboardData {
  year_month: string
  summary: MonthlySummary
  transactions: Transaction[]
}

export function useDashboard(yearMonth?: string) {
  const ym = yearMonth ?? format(new Date(), 'yyyy-MM')

  return useQuery({
    queryKey: ['dashboard', ym],
    queryFn: async () => {
      const { data } = await api.get<DashboardData>(`/dashboard/${ym}`)
      return data
    },
  })
}
