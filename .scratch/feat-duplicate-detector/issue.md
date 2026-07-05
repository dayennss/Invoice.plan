---
title: "Feature: detector de duplicata e cobrança suspeita"
labels: [needs-triage]
status: open
created: 2026-07-04
priority: P2
effort: baixo
group: intel-gastos
---

## Contexto

Cobranças duplicadas (por erro do estabelecimento ou dupla passagem no cartão) e cobranças suspeitas (valores redondos, merchant desconhecido, primeira transação em novo lugar) são fontes reais de perda de dinheiro que passam despercebidas em faturas grandes. Uma flag sutil na `TransactionList` chama atenção pro usuário sem interromper o fluxo.

## O que construir

Detecção heurística de:
1. **Duplicata provável**: mesma `description` + mesmo `amount` + `date` a até 3 dias de distância
2. **Merchant novo**: descrição que nunca apareceu nos últimos 12 meses
3. **Valor atípico para o merchant**: transação de merchant conhecido cujo valor está fora de ±30% do valor típico dele

Cada transação recebe uma ou mais `flags` que a UI renderiza como badges.

## UX

### Badge inline na `TransactionList`

```
07/07  Uber Eats             R$ 48,90   🍔 alimentação
07/07  Uber Eats             R$ 48,90   🍔 alimentação  🔁 possível duplicata
15/07  Amazon Prime          R$ 14,90   📺 assinaturas
20/07  MERCHANT XYZ LTDA     R$ 199,00  ❓ outros        🆕 primeiro lançamento
25/07  Uber                  R$ 189,00  🚗 transporte    ⚠️ valor 3x acima do típico
```

### Filtro rápido

Adicionar no topo da lista um chip "⚠️ Só suspeitas" que filtra pra mostrar apenas transações com flags. Contador ao lado ("3").

### Ação: marcar como "OK"

Clique na badge → dropdown com opção "marcar como legítimo" — some a flag pra sempre pra aquela transação (persiste no item).

## Modelo de dados

Adicionar campo opcional ao item de `TRANSACTION`:

```python
"flags": ["duplicate_suspect", "new_merchant"],  # lista de códigos
"flags_dismissed": ["duplicate_suspect"],        # códigos que o usuário marcou como OK
```

Retrocompatível: transações antigas sem esses campos → tratado como `[]` no frontend.

## Backend

Duas partes:

### 1. Detecção no momento do upload (recomendado)

Após a IA extrair transações, antes de persistir, rodar:

```python
# backend/shared/flag_detector.py
def flag_transactions(new_txs: list[Transaction], history: list[dict]) -> list[Transaction]:
    """Enriquece cada transação com flags. history = últimos 12 meses de txs."""
```

Isso evita reprocessar em toda leitura do dashboard.

### 2. Rota de dismiss

`POST /transactions/{id}/dismiss-flag` com body `{"flag": "duplicate_suspect"}` → atualiza `flags_dismissed` no item.

## Frontend

- `<TransactionFlagBadge>` — componente com variantes por tipo de flag
- Extensão de `<TransactionList>` — renderizar badges, chip de filtro
- Hook `useDismissFlag` — mutation

## Regras de detecção — detalhamento

### `duplicate_suspect`

```
Para cada transação T no mês:
  Existe outra T' onde:
    T.description == T'.description (case-insensitive, trim)
    T.amount == T'.amount (2 casas)
    |T.date - T'.date| <= 3 dias
    T.id != T'.id
  → flag T e T'
```

### `new_merchant`

```
Normalizar description (upper, sem números, sem "**" mascarados, sem cidade).
Se a description normalizada não aparece nas últimas 12 x SUMMARY do usuário
  E o valor é >= R$ 30 (evita ruído em micro-transações)
  → flag T
```

Requer nova query nos últimos 12 meses de transações — pode ficar caro. Alternativa: manter um índice `MERCHANT#{merchant_hash}` (nova SK) por usuário atualizado no upload.

**Decisão sugerida:** começar sem esse índice, buscar transações dos últimos 3 meses só. Iterar depois.

### `atypical_amount`

```
Para merchant com >= 3 transações históricas:
  Se |T.amount - media(historico)| > 0.30 * media
  E T.amount > R$ 50
  → flag T
```

## Dependências

- Nenhuma bloqueante
- Se `feat-smart-alerts` estiver pronto, um resumo "3 possíveis duplicatas neste mês" pode virar um alerta consolidado

## Arquivos afetados

- `backend/shared/flag_detector.py` — **novo**
- `backend/shared/models.py` — adicionar `flags`, `flags_dismissed` em `Transaction`
- `backend/functions/invoices/handler.py` — chamar `flag_transactions()` antes de persistir
- `backend/functions/dashboard/handler.py` ou novo — `POST /transactions/{id}/dismiss-flag`
- `infra/stacks/api_stack.py` — rota nova
- `frontend/src/components/TransactionFlagBadge.tsx` — **novo**
- `frontend/src/components/TransactionList.tsx` — badges + chip de filtro
- `frontend/src/hooks/useDismissFlag.ts` — **novo**
- `frontend/src/types/index.ts` — flags no tipo `Transaction`

## Coordenação com outros agentes

Ver mapa mestre em [`.scratch/PARALLEL_EXECUTION.md`](../PARALLEL_EXECUTION.md).

**Onda:** A (paralelo com 1A e 4C).

**Arquivos compartilhados com outras issues:**

| Arquivo | Também tocado por | Como coexistir |
|---|---|---|
| `backend/functions/invoices/handler.py` | `feat-async-invoice-processing`, `feat-transaction-edit`, `feat-invoice-list`, `feat-month-selector-upload`, `feat-multiple-cards`, `1E` | **Pré-req:** `feat-async-invoice-processing` deve estar mergeado antes. Esta issue adiciona **1 linha** de pipeline no ponto de persistência da fatura: `transactions = flag_transactions(transactions, history)`. Não tocar em outras funções. |
| `backend/shared/models.py` | `1E`, `4A`, `4B` | Adicionar **apenas** os campos `flags: list[str] = []` e `flags_dismissed: list[str] = []` na classe `Transaction`. Ordem canônica em §5 do mapa mestre — **este bloco vem primeiro** após os campos existentes. |
| `frontend/src/components/TransactionList.tsx` | `feat-transaction-edit`, `feat-multiple-cards`, `1E`, `4B` | Adicionar renderização de `<TransactionFlagBadge>` e chip de filtro no header. Não mexer na mecânica de edição de categoria (mantida por `feat-transaction-edit`). |
| `infra/stacks/api_stack.py` | Todas | Bloco `# --- feat-duplicate-detector (1D) ---` com `POST /transactions/{id}/dismiss-flag`. |
| `frontend/src/types/index.ts` | Todos | Adicionar `flags?: string[]` e `flags_dismissed?: string[]` em `Transaction`. |

**Arquivos exclusivos desta issue (zero risco):**
- `backend/shared/flag_detector.py`
- `frontend/src/components/TransactionFlagBadge.tsx`
- `frontend/src/hooks/useDismissFlag.ts`

**Dependências de ordem:**
- **Bloqueada por:** `feat-async-invoice-processing` (mudou forma do handler) + `feat-transaction-edit` (opcional — pra ter a rota base pronta).
- **Paralelo com:** 1A (dashboard, sem colisão) e 4C (sem colisão).
- **Não rodar em paralelo com:** 1E (ambos mexem em `Transaction`, `TransactionList.tsx`), 4B (mexe em `Transaction`), 4A.

**Após merge:** regenerar layer (mexe em `backend/shared/models.py` e cria `flag_detector.py`).

## Fora do escopo

- Detecção de fraude via ML
- Notificação automática por email
- Detecção retroativa em faturas antigas (só faturas novas ganham flags)
