export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
      <div className="ip-card w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
          <span style={{ color: 'var(--color-green)' }}>invoice</span>.plan
        </h1>
        <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
          planeje. emita. cresça.
        </p>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          autenticação em breve — Task #2
        </p>
      </div>
    </div>
  )
}
