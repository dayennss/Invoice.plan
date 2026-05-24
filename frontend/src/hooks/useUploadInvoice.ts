import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface UploadResult {
  invoice_id: string
  year_month: string
  transaction_count: number
  total: number
}

async function uploadInvoice(file: File): Promise<UploadResult> {
  const buffer = await file.arrayBuffer()
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)))

  const { data } = await api.post<UploadResult>(
    `/invoices?filename=${encodeURIComponent(file.name)}`,
    base64,
    {
      headers: {
        'Content-Type': 'application/pdf',
        'X-Base64-Encoded': 'true',
      },
    },
  )
  return data
}

export function useUploadInvoice() {
  const queryClient = useQueryClient()
  const [progress, setProgress] = useState<'idle' | 'reading' | 'processing' | 'done'>('idle')

  const mutation = useMutation({
    mutationFn: async (file: File) => {
      setProgress('reading')
      const result = await uploadInvoice(file)
      setProgress('done')
      return result
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', data.year_month] })
    },
    onError: () => setProgress('idle'),
  })

  return {
    upload: mutation.mutate,
    progress,
    isLoading: mutation.isPending,
    error: mutation.error,
    result: mutation.data,
    reset: () => { mutation.reset(); setProgress('idle') },
  }
}
