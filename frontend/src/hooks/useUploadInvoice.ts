import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { api } from '@/lib/api'

interface UploadResult {
  invoice_id: string
  year_month: string
  transaction_count: number
  total: number
}

async function uploadInvoice(file: File, password?: string): Promise<UploadResult> {
  const { data } = await api.post<UploadResult>(
    `/invoices?filename=${encodeURIComponent(file.name)}`,
    file,
    {
      headers: {
        'Content-Type': 'application/pdf',
        ...(password ? { 'X-PDF-Password': password } : {}),
      },
    },
  )
  return data
}

function isPDFPasswordRequired(err: unknown): boolean {
  return (
    isAxiosError(err) &&
    err.response?.status === 422 &&
    err.response?.data?.error === 'PDF_PASSWORD_REQUIRED'
  )
}

export function useUploadInvoice() {
  const queryClient = useQueryClient()
  const [progress, setProgress] = useState<'idle' | 'reading' | 'processing' | 'done'>('idle')
  const [passwordRequired, setPasswordRequired] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  const mutation = useMutation({
    mutationFn: async ({ file, password }: { file: File; password?: string }) => {
      setProgress('reading')
      const result = await uploadInvoice(file, password)
      setProgress('done')
      return result
    },
    onSuccess: (data) => {
      setPasswordRequired(false)
      setPendingFile(null)
      queryClient.invalidateQueries({ queryKey: ['dashboard', data.year_month] })
    },
    onError: (err) => {
      setProgress('idle')
      if (isPDFPasswordRequired(err)) {
        setPasswordRequired(true)
      } else {
        setPasswordRequired(false)
        setPendingFile(null)
      }
    },
  })

  function upload(file: File) {
    setPendingFile(file)
    setPasswordRequired(false)
    mutation.mutate({ file })
  }

  function submitPassword(password: string) {
    if (pendingFile) {
      mutation.mutate({ file: pendingFile, password })
    }
  }

  function reset() {
    mutation.reset()
    setProgress('idle')
    setPasswordRequired(false)
    setPendingFile(null)
  }

  return {
    upload,
    submitPassword,
    passwordRequired,
    progress,
    isLoading: mutation.isPending,
    error: passwordRequired ? null : mutation.error,
    result: mutation.data,
    reset,
  }
}
