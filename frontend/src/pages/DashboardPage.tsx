import AppHeader from '@/components/AppHeader'
import { useAuthState } from '@/hooks/useAuthState'

export default function DashboardPage() {
  const { user } = useAuthState()

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-base)' }}>
      <AppHeader />

      <main className="flex-1 p-6 max-w-6xl mx-auto w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Olá, {user?.displayName?.split(' ')[0]} 👋
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Seu painel financeiro está sendo construído.
          </p>
        </div>

        {/* Placeholder cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {['Total do Mês', 'Categorias', 'Transações'].map((label) => (
            <div key={label} className="ip-card">
              <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{label}</p>
              <div
                className="h-8 rounded"
                style={{ background: 'var(--border-default)', width: '60%' }}
              />
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
