import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface Args {
  invoiceId: string
  yearMonth: string
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ invoiceId, yearMonth }: Args) => {
      const { data } = await api.delete(
        `/invoices/${invoiceId}?yearMonth=${yearMonth}`,
      )
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoices', variables.yearMonth] })
      queryClient.invalidateQueries({ queryKey: ['dashboard', variables.yearMonth] })
    },
  })
}
