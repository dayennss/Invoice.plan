import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { api } from '@/lib/api'

interface UploadResult {
  invoice_id: string
  year_month: string
  label: string
  status: 'processing' | 'done' | 'error'
}

interface UploadArgs {
  file: File
  password?: string
  label?: string
}

async function uploadInvoice({ file, password, label }: UploadArgs): Promise<UploadResult> {
  const params = new URLSearchParams({ filename: file.name })
  if (label && label.trim()) params.set('label', label.trim())

  const { data } = await api.post<UploadResult>(
    `/invoices?${params.toString()}`,
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
  const [pendingLabel, setPendingLabel] = useState<string | undefined>(undefined)

  const mutation = useMutation({
    mutationFn: async (args: UploadArgs) => {
      setProgress('reading')
      const result = await uploadInvoice(args)
      setProgress('done')
      return result
    },
    onSuccess: (data) => {
      setPasswordRequired(false)
      setPendingFile(null)
      setPendingLabel(undefined)
      queryClient.invalidateQueries({ queryKey: ['dashboard', data.year_month] })
      queryClient.invalidateQueries({ queryKey: ['invoices', data.year_month] })
    },
    onError: (err) => {
      setProgress('idle')
      if (isPDFPasswordRequired(err)) {
        setPasswordRequired(true)
      } else {
        setPasswordRequired(false)
        setPendingFile(null)
        setPendingLabel(undefined)
      }
    },
  })

  function upload(file: File, label?: string) {
    setPendingFile(file)
    setPendingLabel(label)
    setPasswordRequired(false)
    mutation.mutate({ file, label })
  }

  function submitPassword(password: string) {
    if (pendingFile) {
      mutation.mutate({ file: pendingFile, password, label: pendingLabel })
    }
  }

  function reset() {
    mutation.reset()
    setProgress('idle')
    setPasswordRequired(false)
    setPendingFile(null)
    setPendingLabel(undefined)
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
