---
title: "Bug: upload do mesmo PDF duas vezes duplica todas as transações"
labels: [ready-for-agent]
status: open
created: 2026-06-27
priority: P0
---

## Problema

Não existe nenhum mecanismo de deduplicação. Se o usuário subir o mesmo PDF duas vezes (por engano ou ao reprocessar), todas as transações são inseridas novamente com novos UUIDs, duplicando o total do mês.

## Impacto

- Totais incorretos no dashboard
- Transações duplicadas na `TransactionList`
- Summary com valor dobrado

## Solução sugerida

Duas camadas de defesa:

1. **Hash do conteúdo do PDF**: calcular `hashlib.sha256(pdf_bytes).hexdigest()` e armazenar no item `INVOICE#`. Antes de processar, verificar se já existe um invoice com esse hash para o usuário. Se sim, retornar erro 409 com mensagem clara.

2. **Aviso no frontend**: ao detectar 409, exibir mensagem "Esta fatura já foi enviada anteriormente" em vez de erro genérico.

```python
pdf_hash = hashlib.sha256(pdf_bytes).hexdigest()
# verificar se existe INVOICE com pdf_hash == pdf_hash
# se sim: return error("Fatura já processada", 409)
```

## Arquivos afetados

- `backend/functions/invoices/handler.py` — checar hash antes de processar
- `backend/shared/db.py` — query por hash (pode usar GSI ou scan limitado)
- `frontend/src/components/InvoiceUpload.tsx` — tratar 409
