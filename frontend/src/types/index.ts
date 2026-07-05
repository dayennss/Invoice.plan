export interface User {
  id: string
  email: string
  name: string
  photoUrl?: string
  plan: 'free' | 'pro'
  createdAt: string
}

export type TransactionCategory =
  | 'alimentacao'
  | 'transporte'
  | 'moradia'
  | 'saude'
  | 'lazer'
  | 'educacao'
  | 'assinaturas'
  | 'vestuario'
  | 'transferencias'
  | 'outros'

export interface Transaction {
  id: string
  description: string
  amount: number
  date: string
  category: TransactionCategory
  invoice_id?: string
  invoice_label?: string
  installment_current?: number
  installment_total?: number
  is_recurring?: boolean
}

export interface Invoice {
  invoice_id: string
  user_id: string
  filename: string
  label: string
  year_month: string
  status: 'processing' | 'done' | 'error'
  transaction_count?: number
  created_at: string
}

export interface MonthlySummary {
  year_month: string
  total: number
  by_category: Record<string, number>
  transaction_count: number
}

export const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  alimentacao:   'Alimentação',
  transporte:    'Transporte',
  moradia:       'Moradia',
  saude:         'Saúde',
  lazer:         'Lazer',
  educacao:      'Educação',
  assinaturas:   'Assinaturas',
  vestuario:     'Vestuário',
  transferencias:'Transferências',
  outros:        'Outros',
}

export const CATEGORY_COLORS: Record<TransactionCategory, string> = {
  alimentacao:   'var(--chart-1)',
  transporte:    'var(--chart-2)',
  moradia:       'var(--chart-3)',
  saude:         'var(--chart-4)',
  lazer:         'var(--chart-5)',
  educacao:      'var(--chart-6)',
  assinaturas:   'var(--chart-7)',
  vestuario:     'var(--chart-8)',
  transferencias:'var(--chart-9)',
  outros:        'var(--chart-10)',
}

// Paleta de cores para distinguir múltiplas faturas de um mesmo mês.
// Ordenada por contraste — cores mais destacadas primeiro para o caso comum
// (usuário sobe 2-3 faturas), e as demais são fallback.
export const INVOICE_COLOR_PALETTE = [
  'var(--chart-1)',
  'var(--chart-3)',
  'var(--chart-5)',
  'var(--chart-7)',
  'var(--chart-9)',
  'var(--chart-2)',
  'var(--chart-4)',
  'var(--chart-6)',
  'var(--chart-8)',
  'var(--chart-10)',
]

export function invoiceColor(invoiceId: string | undefined, invoiceIds: string[]): string {
  if (!invoiceId) return 'var(--chart-10)'
  const idx = invoiceIds.indexOf(invoiceId)
  const safeIdx = idx >= 0 ? idx : 0
  return INVOICE_COLOR_PALETTE[safeIdx % INVOICE_COLOR_PALETTE.length]
}
