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
  installment_current?: number
  installment_total?: number
  is_recurring?: boolean
}

export interface Invoice {
  id: string
  user_id: string
  bank: string
  year_month: string
  status: 'processing' | 'done' | 'error'
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
