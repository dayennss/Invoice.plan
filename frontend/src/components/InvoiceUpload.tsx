import { useRef, useState } from 'react'
import { useUploadInvoice } from '@/hooks/useUploadInvoice'

interface Props {
  variant?: 'card' | 'compact'
}

export default function InvoiceUpload({ variant = 'card' }: Props) {
  const { upload, submitPassword, passwordRequired, isLoading, error, result, reset, progress } = useUploadInvoice()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [password, setPassword] = useState('')
  const [label, setLabel] = useState('')

  function handleFile(file: File | undefined) {
    if (!file || file.type !== 'application/pdf') return
    reset()
    setPassword('')
    upload(file, label)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  function handleSubmitPassword() {
    if (!password.trim()) return
    submitPassword(password)
  }

  function handleReset() {
    reset()
    setPassword('')
    setLabel('')
  }

  if (result) {
    return (
      <div className={variant === 'compact' ? 'flex flex-col gap-3' : 'ip-card ip-card-accent flex flex-col gap-4'}>
        <div className="flex items-center gap-3">
          <div
            className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin flex-shrink-0"
            style={{ borderColor: 'var(--color-green)', borderTopColor: 'transparent' }}
          />
          <div>
            <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              {result.label} em processamento
            </p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              A IA está analisando o PDF. Pode levar até 2 minutos.
            </p>
          </div>
        </div>
        <button
          onClick={handleReset}
          className="text-sm self-start px-3 py-1.5 rounded-md"
          style={{
            color: 'var(--color-green)',
            border: '1px solid var(--border-accent)',
            background: 'var(--accent-subtle)',
            cursor: 'pointer',
          }}
        >
          + Enviar outra fatura deste mês
        </button>
      </div>
    )
  }

  if (passwordRequired) {
    return (
      <div className={variant === 'compact' ? 'flex flex-col gap-4' : 'ip-card flex flex-col gap-4'}>
        <div>
          <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
            PDF protegido por senha
          </p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Este PDF está protegido. Digite a senha para continuar.
          </p>
        </div>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmitPassword()}
          placeholder="Senha do PDF"
          disabled={isLoading}
          autoFocus
          className="w-full px-3 py-2 rounded-md text-sm"
          style={{
            background: 'var(--surface-secondary)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-primary)',
            outline: 'none',
          }}
        />

        {error && (
          <p className="text-sm px-4 py-2 rounded-md" style={{
            color: 'var(--financial-expense)',
            background: 'var(--financial-expense-bg)',
            border: '1px solid var(--financial-expense-border)',
          }}>
            Senha incorreta. Tente novamente.
          </p>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleSubmitPassword}
            disabled={isLoading || !password.trim()}
            className="flex-1 px-4 py-2 rounded-md text-sm font-medium"
            style={{
              background: 'var(--color-green)',
              color: '#000',
              cursor: isLoading || !password.trim() ? 'not-allowed' : 'pointer',
              opacity: isLoading || !password.trim() ? 0.6 : 1,
            }}
          >
            {isLoading ? 'Processando...' : 'Processar'}
          </button>
          <button
            onClick={handleReset}
            disabled={isLoading}
            className="px-4 py-2 rounded-md text-sm"
            style={{
              color: 'var(--text-muted)',
              border: '1px solid var(--border-default)',
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  const wrapperClass = variant === 'compact'
    ? 'flex flex-col gap-3'
    : 'ip-card flex flex-col gap-4'

  return (
    <div className={wrapperClass}>
      {variant === 'card' && (
        <div>
          <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
            Enviar fatura
          </p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Você pode enviar quantas faturas quiser em um mesmo mês.
          </p>
        </div>
      )}

      <div>
        <label
          className="text-xs font-medium mb-1.5 block"
          style={{ color: 'var(--text-muted)' }}
        >
          Apelido da fatura (opcional)
        </label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value.slice(0, 40))}
          disabled={isLoading}
          placeholder="Ex: Nubank, Itaú Platinum"
          className="w-full px-3 py-2 rounded-md text-sm"
          style={{
            background: 'var(--surface-secondary)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-primary)',
            outline: 'none',
          }}
        />
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !isLoading && inputRef.current?.click()}
        className="flex flex-col items-center justify-center gap-3 p-6 rounded-lg transition-all cursor-pointer"
        style={{
          border: `2px dashed ${dragging ? 'var(--border-accent)' : 'var(--border-default)'}`,
          background: dragging ? 'var(--accent-subtle)' : 'transparent',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        {isLoading ? (
          <>
            <div
              className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: 'var(--color-green)', borderTopColor: 'transparent' }}
            />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {progress === 'reading' ? 'Lendo PDF...' : 'Analisando com IA...'}
            </p>
          </>
        ) : (
          <>
            <PdfIcon />
            <div className="text-center">
              <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                Arraste o PDF aqui ou clique para selecionar
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Fatura de cartão de crédito (qualquer banco)
              </p>
            </div>
          </>
        )}
      </div>

      {error && (
        <p className="text-sm px-4 py-2 rounded-md" style={{
          color: 'var(--financial-expense)',
          background: 'var(--financial-expense-bg)',
          border: '1px solid var(--financial-expense-border)',
        }}>
          {(error as Error).message ?? 'Erro ao processar fatura. Tente novamente.'}
        </p>
      )}
    </div>
  )
}

function PdfIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"
        stroke="var(--color-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14 2v6h6M9 13h6M9 17h6M9 9h1"
        stroke="var(--color-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
