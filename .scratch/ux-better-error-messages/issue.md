---
title: "UX: mensagens de erro mais descritivas no upload"
labels: [ready-for-agent]
status: open
created: 2026-06-27
priority: P1
---

## Problema

Em `frontend/src/components/InvoiceUpload.tsx:185`, o erro exibido é `(error as Error).message`, que geralmente é "Request failed with status code 500" — inútil para o usuário.

O backend já retorna mensagens em português no body (`error("Falha ao processar PDF: ...", 500)`), mas o frontend não as lê.

## Solução

No frontend, extrair a mensagem do body da resposta do Axios:

```tsx
function getErrorMessage(err: unknown): string {
  if (isAxiosError(err)) {
    const msg = err.response?.data?.error
    if (msg && msg !== 'PDF_PASSWORD_REQUIRED') return msg
  }
  return 'Erro ao processar fatura. Tente novamente.'
}
```

No backend, melhorar as mensagens de erro:
- PDF sem texto extraível (escaneado): "PDF escaneado não é suportado. Utilize um PDF nativo do banco."
- Groq retornou JSON inválido: "Não foi possível interpretar as transações. Tente novamente."
- Rate limit esgotado: "Serviço temporariamente sobrecarregado. Tente em 1 minuto."

## Arquivos afetados

- `frontend/src/components/InvoiceUpload.tsx` — extrair mensagem do response body
- `backend/shared/providers/groq_provider.py` — mensagens mais específicas
- `backend/functions/invoices/handler.py` — distinção de erros conhecidos
