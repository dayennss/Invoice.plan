---
title: "Feature: split de despesa (contas a receber)"
labels: [needs-triage]
status: open
created: 2026-07-04
priority: P2
effort: médio
group: colaboracao
---

## Contexto

Muitas transações do cartão são compartilhadas — dividir jantar, comprar presente pra grupo, mercado com amigo. Sem uma forma de marcar isso, o dashboard superestima o gasto do usuário e ele não tem registro de quanto os outros devem.

**Versão leve nesta issue:** os "outros" são strings livres (nomes), sem conta no app. Isto prepara terreno pra `feat-shared-workspace` no futuro sem exigir refactor no schema.

## O que construir

Para qualquer transação, o usuário pode:
1. Marcar como parcialmente compartilhada (define % ou valor de cada pessoa)
2. Ver uma seção "Contas a receber" agregando o que cada pessoa deve
3. Marcar como pago (quita a pendência)

## UX

### Ação em transação

`TransactionList` — ícone `⇢` ao lado da categoria abre modal:

```
┌──────────────────────────────────────────┐
│ Dividir "Rest. Sushi Yassu" — R$ 240,00  │
│                                          │
│ Método:  ● Percentual   ○ Valor fixo     │
│                                          │
│ 👤 Você            [50] %  = R$ 120,00   │
│ 👤 [Ana         ]  [50] %  = R$ 120,00   │
│                                          │
│ [+ Adicionar pessoa]                     │
│                                          │
│                  [Cancelar]  [Salvar]    │
└──────────────────────────────────────────┘
```

Autocomplete no nome — sugere pessoas já cadastradas em splits anteriores.

### Indicador na lista

Transação com split ganha badge:

```
07/07  Rest. Sushi Yassu   R$ 240   🍔   ⇢ Ana +50%
```

O valor exibido na coluna principal se torna o **efetivo do usuário** (R$ 120) e o valor total vira tooltip. **Decisão de UX importante:** todos os totais/summaries do dashboard passam a considerar apenas o `share_amount` do usuário, não o `amount` bruto.

### Página "Contas a receber"

```
┌──────────────────────────────────────────┐
│ Contas a receber                         │
│                                          │
│ 👤 Ana                     R$ 380,00     │
│    ▸ Sushi Yassu (07/07)   R$ 120        │
│    ▸ Uber (12/07)          R$  15        │
│    ▸ Mercado (14/07)       R$ 245        │
│                     [Marcar tudo como pago] │
│                                          │
│ 👤 João                    R$  60,00     │
│    ▸ Cinema (10/07)        R$  60        │
│                                                 │
│ Total a receber:           R$ 440,00     │
│ Histórico já recebido:  ver mais         │
└──────────────────────────────────────────┘
```

### Estado "pago"

Split marcado como pago sai do agregado; transação individual mantém badge `⇢ Ana ✓` mais discreta.

## Modelo de dados

Adicionar campos ao item de `TRANSACTION`:

```python
"splits": [
    {"name": "Ana", "amount": 120.00, "paid": False, "paid_at": None},
    # opcional: identificar "eu" implicitamente por diferença; ou explícito
],
"share_amount": 120.00,  # o quanto conta pro dashboard/summary do user
```

Retrocompatível: transações sem `splits` → tratado como split integral do usuário.

### Impacto em summaries

O item `SUMMARY#{ym}` precisa ser recalculado com base em `share_amount`, não `amount`. Momento de recomputar:
- ao adicionar/editar split → atualizar summary daquele mês
- ao processar nova invoice → summary já calcula com `share_amount` (default = amount)

## Backend

Novos endpoints:

- `PUT /transactions/{id}/splits` — body `{ splits: [...] }` → recalcula `share_amount`, atualiza `SUMMARY#{ym}`
- `POST /transactions/{id}/splits/{name}/mark-paid` — muda `paid: true`
- `GET /receivables` — retorna agregado por pessoa: `[{name, total_open, transactions: [...]}]`

Helpers em `backend/shared/splits.py`:
- `compute_share_amount(amount, splits) -> float` — pega o que sobrou pro usuário
- `recompute_summary(user_id, year_month)` — usa share_amount pra somar

## Frontend

- `<SplitDialog>` novo
- Extensão de `<TransactionList>` — badge, valor efetivo, tooltip
- `<ReceivablesPage>` nova página + rota
- `<PersonAutocomplete>` — hook `usePeople()` (deriva de splits existentes)
- Hooks: `useUpdateSplits`, `useMarkSplitPaid`, `useReceivables`

## Dependências

- Requer `feat-transaction-edit` (pra ter a mecânica de edição no lugar) — recomendado
- Prepara terreno para `feat-shared-workspace` (semântica de "outras pessoas")

## Riscos / gotchas

- **Consistência de summary**: se o usuário edita split de uma transação antiga, o summary daquele mês precisa ser recomputado — atenção a race conditions se rodar concorrente com upload.
- **Percentual + arredondamento**: 33% de R$ 100 = R$ 33,00 vs R$ 33,33 vs R$ 34,00. Definir: valor do "eu" é sempre `total - soma(outros)` pra fechar exato.
- **Nome como string livre**: usuário pode escrever "Ana", "Aninha", "ana" e virar 3 pessoas diferentes nos agregados. Normalizar (upper + trim) na busca do autocomplete, mas manter grafia original na exibição.

## Arquivos afetados

- `backend/shared/models.py` — modelo `Split`
- `backend/shared/splits.py` — **novo**, cálculos
- `backend/shared/db.py` — query de receivables
- `backend/functions/transactions/handler.py` — **nova lambda** ou embutir em dashboard
- `infra/stacks/api_stack.py` — rotas
- `frontend/src/hooks/useUpdateSplits.ts` — **novo**
- `frontend/src/hooks/useMarkSplitPaid.ts` — **novo**
- `frontend/src/hooks/useReceivables.ts` — **novo**
- `frontend/src/hooks/usePeople.ts` — **novo**
- `frontend/src/components/SplitDialog.tsx` — **novo**
- `frontend/src/components/PersonAutocomplete.tsx` — **novo**
- `frontend/src/components/TransactionList.tsx` — badge/valor efetivo
- `frontend/src/pages/ReceivablesPage.tsx` — **novo**
- `frontend/src/App.tsx` — rota `/receivables`
- `frontend/src/components/AppHeader.tsx` — link
- `frontend/src/types/index.ts` — tipos

## Coordenação com outros agentes

Ver mapa mestre em [`.scratch/PARALLEL_EXECUTION.md`](../PARALLEL_EXECUTION.md).

**Onda:** C (roda sozinho na onda, após onda B).

**Por quê sozinho na onda:** toca `models.py::Transaction` (adiciona `splits`, `share_amount`), `TransactionList.tsx` (badge + valor efetivo), e o cálculo de `share_amount` afeta como todo `SUMMARY#{ym}` é agregado. Colidir com 1D ou 1E daria merge conflict semântico.

**Arquivos compartilhados com outras issues:**

| Arquivo | Também tocado por | Como coexistir |
|---|---|---|
| `backend/shared/models.py` | `1D`, `1E`, `4A` | Adicionar `splits: Optional[list[Split]] = None` e `share_amount: Optional[float] = None` em `Transaction`. Ordem em §5 do mapa mestre — este bloco vem **depois** dos campos de 1D. |
| `backend/shared/db.py` | `1E`, `4A`, `4C` | Adicionar `get_receivables()`, sem tocar em queries existentes. |
| `backend/functions/invoices/handler.py` (impacto indireto) | Muitas | Não precisa editar handler de upload — mas precisa que o `SUMMARY` novo seja calculado com `share_amount`. Verificar se `feat-async-invoice-processing` (que reformulou o handler) usa `amount` ou `share_amount or amount`. |
| `frontend/src/components/TransactionList.tsx` | `feat-transaction-edit`, `1D`, `1E`, `feat-multiple-cards` | Adicionar badge `⇢ Ana +50%` e trocar valor exibido pra `share_amount` quando presente. Não mexer em edição de categoria (1E) nem em flags (1D). |
| `frontend/src/App.tsx`, `AppHeader.tsx` | 4A, 1E | Adicionar rota `/receivables` e link. |
| `infra/stacks/api_stack.py` | Todas | Bloco `# --- feat-expense-split (4B) ---`. |
| `frontend/src/types/index.ts` | Todos | Adicionar `Split` e campos `splits?`, `share_amount?` em `Transaction`. |

**Arquivos exclusivos desta issue (zero risco):**
- `backend/shared/splits.py`
- `backend/functions/transactions/handler.py`
- `frontend/src/components/SplitDialog.tsx`, `PersonAutocomplete.tsx`
- `frontend/src/pages/ReceivablesPage.tsx`
- `frontend/src/hooks/useUpdateSplits.ts`, `useMarkSplitPaid.ts`, `useReceivables.ts`, `usePeople.ts`

**Dependências de ordem:**
- **Bloqueada por:** `feat-transaction-edit` (mecânica de edição), Ondas A e B mergeadas
- **Bloqueia:** `4A` (workspace consome semântica de "outras pessoas")
- **Não rodar em paralelo com:** 1D, 1E (mesma classe `Transaction` + mesmo componente `TransactionList`), 4A.

**Após merge:** regenerar layer + deploy.

## Fora do escopo

- Cobrança automatizada por email/WhatsApp
- Contas a pagar (inverso — alguém que te pagou uma despesa)
- Integração com apps de split (Splitwise)
- Split em cima de transação parcelada (versão 1 assume à vista)
