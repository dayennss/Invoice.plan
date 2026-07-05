import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Invoice } from '@/types'

export function useInvoices(yearMonth: string) {
  const queryClient = useQueryClient()
  const prevProcessingIdsRef = useRef<Set<string>>(new Set())

  const query = useQuery({
    queryKey: ['invoices', yearMonth],
    queryFn: async () => {
      const { data } = await api.get<Invoice[]>(`/invoices?yearMonth=${yearMonth}`)
      return data
    },
    refetchInterval: (q) => {
      const data = q.state.data as Invoice[] | undefined
      const hasProcessing = data?.some((inv) => inv.status === 'processing') ?? false
      return hasProcessing ? 5000 : false
    },
  })

  // Se alguma invoice saiu de processing → done|error, invalida o dashboard
  useEffect(() => {
    const currentProcessingIds = new Set(
      (query.data ?? []).filter((i) => i.status === 'processing').map((i) => i.invoice_id),
    )
    const prev = prevProcessingIdsRef.current
    const anyFinished = [...prev].some((id) => !currentProcessingIds.has(id))
    if (anyFinished) {
      queryClient.invalidateQueries({ queryKey: ['dashboard', yearMonth] })
    }
    prevProcessingIdsRef.current = currentProcessingIds
  }, [query.data, yearMonth, queryClient])

  return query
}
