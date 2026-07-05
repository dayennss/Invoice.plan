---
title: "Feature: processamento assíncrono de faturas grandes"
labels: [ready-for-agent, backend, frontend]
status: open
created: 2026-07-04
priority: P1
---

## Contexto

O free tier do Groq (`llama-3.3-70b-versatile`) impõe limite de **12k tokens/min (TPM)**.
O cálculo do Groq inclui `input_tokens + max_tokens` (reserva de output). Ou seja:

- system prompt (~240 tokens)
- fatura filtrada em texto
- `max_tokens` reservado pra resposta

Um único chunk grande estoura os 12k por request, e mesmo com chunking, a janela de 1 minuto
só cabe ~1.4 chunks antes de bater 429. Faturas grandes (5+ chunks) precisam de ~5 min de
processamento, o que:

1. Excede o timeout de 30s do API Gateway HTTP API (cliente cai)
2. Excede o timeout de 90s da Lambda (execução cai)

O quick fix atual (`groq_provider.py`: `_MAX_CHARS=12_000`, `max_tokens=4096`,
`_CHUNK_DELAY_SECONDS=10`) resolve faturas com até ~2 chunks. Faturas gigantes
continuam falhando com `429 Too Many Requests`.

## Solução: processamento assíncrono

### Fluxo desejado

1. `POST /invoices?filename=...&label=...` grava invoice em `status: processing` e retorna `202 Accepted` **imediatamente** (< 3s)
2. Antes de retornar, invoca a si mesma via `boto3.client('lambda').invoke(InvocationType='Event', ...)` com o payload do PDF (fire-and-forget)
3. A invocação `Event` processa em background — pode levar minutos, sem timeout de gateway
4. Frontend faz **polling** em `GET /invoices?yearMonth=...` a cada 3-5s enquanto houver invoice com `status=processing`
5. Quando o worker termina, atualiza o invoice pra `status: done` (ou `error`)

### Backend

**Novo modo de invocação da mesma Lambda:**
- Se `event.get("source") == "invoice-async-worker"`, roda `_process_invoice_async` (o que hoje é `_upload_invoice` sem HTTP framing)
- Caso contrário, roda o handler HTTP normal

**Payload assíncrono:**
- `pdf_bytes` codificados em base64 no S3 (evita limite de 256KB do Lambda invoke Event payload) OU
- Salvar PDF no S3 primeiro, worker lê S3

**S3 route (mais robusto):**
1. HTTP handler faz `PutObject` num bucket temporário com key `pending/{user_id}/{invoice_id}.pdf`
2. Grava invoice em DynamoDB status=processing
3. Invoca worker Lambda via Event com `{"user_id", "invoice_id", "s3_key", "year_month", "label"}`
4. Retorna 202 com invoice_id
5. Worker Lambda: baixa S3, roda Groq com chunking + sleep, persiste transactions, marca invoice done, deleta S3 object

### Frontend

- `useInvoices(yearMonth)` já existe — adicionar `refetchInterval` do TanStack Query condicional a haver invoices com `status=processing`
- `InvoiceList` já tem `status` — adicionar spinner nos chips com status=processing (ao invés do dot colorido)
- Botão "Enviar outra fatura" fica habilitado imediatamente após upload (retorna 202)
- Toast "Fatura em processamento — pode levar alguns minutos"

## Arquivos afetados

- `backend/functions/invoices/handler.py` — split em HTTP handler + async worker path
- `backend/shared/providers/groq_provider.py` — pode aumentar sleep entre chunks (~25s) já que não estoura mais gateway
- `infra/stacks/api_stack.py` — timeout da Lambda vai pra 300s+ (5 min pra Groq processar chunks lentos); adicionar S3 bucket pra pending PDFs; permitir `lambda:InvokeFunction` na role
- `frontend/src/hooks/useInvoices.ts` — refetchInterval condicional
- `frontend/src/components/InvoiceList.tsx` — spinner pros chips em processing

## Fora do escopo

- Não precisa Step Functions nem SQS — Lambda invocando a si mesma via Event é suficiente
- Não precisa notificação push — polling do frontend basta

## Dependência
Nenhuma — pode ser feito qualquer hora.
