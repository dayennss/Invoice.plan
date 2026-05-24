import { useAuth } from '@/hooks/useAuth'
import { useAuthState } from '@/hooks/useAuthState'

export default function AppHeader() {
  const { user } = useAuthState()
  const { signOut } = useAuth()

  return (
    <header
      className="flex items-center justify-between px-6 py-4 border-b"
      style={{
        background: 'var(--bg-subtle)',
        borderColor: 'var(--border-default)',
      }}
    >
      {/* Logo */}
      <span className="text-lg font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
        <span style={{ color: 'var(--color-green)' }}>invoice</span>.plan
      </span>

      {/* User */}
      <div className="flex items-center gap-3">
        {user?.photoURL && (
          <img
            src={user.photoURL}
            alt={user.displayName ?? 'avatar'}
            className="w-8 h-8 rounded-full"
          />
        )}
        <span className="text-sm hidden sm:block" style={{ color: 'var(--text-secondary)' }}>
          {user?.displayName ?? user?.email}
        </span>
        <button
          onClick={signOut}
          className="text-sm px-3 py-1.5 rounded-md transition-colors"
          style={{
            color: 'var(--text-muted)',
            background: 'transparent',
            border: '1px solid var(--border-default)',
            cursor: 'pointer',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-strong)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-default)')}
        >
          Sair
        </button>
      </div>
    </header>
  )
}
