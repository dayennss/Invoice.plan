---
title: "Feature: categorização com aprendizado (regras merchant → categoria)"
labels: [needs-triage]
status: open
created: 2026-07-04
priority: P3
effort: alto
group: intel-gastos
---

## Contexto

Hoje, toda transação é categorizada pela IA (Groq/Llama). Isso tem 3 problemas:
1. **Custo**: cada upload gasta tokens do free tier (12k TPM).
2. **Precisão**: a IA erra em merchants ambíguos ("Aliza" pode ser lanchonete ou salão).
3. **Consistência**: mesmo merchant pode virar categorias diferentes em meses diferentes.

Se o usuário corrigir uma categoria e o app **aprender** a regra, o próximo upload aplica direto — mais barato, mais preciso, mais consistente.

**Depende de:** `feat-transaction-edit` (usuário precisa poder editar categoria antes que esta feature faça sentido).

## O que construir

Duas partes:

### Parte A — Edição de categoria persiste como regra

Quando o usuário edita a categoria de uma transação, um dialog pergunta:
- "Aplicar só nesta transação"
- "Aplicar a esta e todas futuras de **{merchant}**" ← cria a regra
- "Aplicar a esta, futuras E as N transações passadas de {merchant}" ← retroativo

### Parte B — Pipeline aplica regras antes da IA

No processamento do PDF, após extração de linhas mas antes de chamar Groq:
1. Buscar regras do usuário (uma leitura Dynamo)
2. Para cada linha, tentar match com merchants conhecidos
3. Linhas com match → categoria já definida, não vai pro prompt
4. Só linhas sem match vão pra IA
5. Após IA retornar, opcional: sugerir criação de regras pra merchants novos com N ocorrências

Isso reduz drasticamente o número de tokens enviados ao Groq → mais faturas caem dentro do free tier.

## UX

### Dialog de edição (Parte A)

```
┌────────────────────────────────────────────┐
│ Alterar categoria                          │
│                                            │
│ Transação: "IFOOD JOAO MARCENIER LTDA"     │
│ Categoria: [🍔 Alimentação ▾]              │
│                                            │
│ ○ Aplicar apenas nesta transação           │
│ ● Aplicar a esta e futuras de "IFOOD"      │
│ ○ Aplicar a esta, futuras e às 12 passadas │
│                                            │
│                     [Cancelar] [Salvar]    │
└────────────────────────────────────────────┘
```

### Página "Minhas regras"

```
┌────────────────────────────────────────────┐
│ Regras de categorização (14)               │
│                                            │
│ IFOOD         → 🍔 Alimentação   [editar]  │
│ UBER          → 🚗 Transporte    [editar]  │
│ NETFLIX       → 📺 Assinaturas   [editar]  │
│ ...                                        │
│                                            │
│           [+ Nova regra manual]            │
└────────────────────────────────────────────┘
```

Botão dispara delete/edit; regra removida = próxima fatura volta a usar IA.

### Feedback pós-upload

Depois de processar fatura, banner discreto:
> "Detectamos 3 merchants novos que apareceram várias vezes. Quer criar regras?"

## Modelo de dados

Nova SK:

```
PK: USER#{user_id}
SK: RULE#{merchant_normalized}

merchant_pattern: "IFOOD"      # que casa em substring (case-insensitive)
category: "alimentacao"
created_at: ISO
match_count: 12                # quantas vezes já aplicou
```

Normalização do merchant (função pura):
- upper
- remove números soltos, "**" mascarados, sufixos "LTDA", "EIRELI", "S.A."
- remove cidade (última palavra em CAIXA se for cidade conhecida — heurística)
- reduz a max 20 chars significativos

Exemplo: `"IFOOD *JOAO MARCENIER LTDA SAO PAULO"` → `"IFOOD"`

## Backend

### Novos endpoints

- `GET /rules` → lista todas as regras do usuário
- `POST /rules` → cria regra `{merchant_pattern, category}`
- `PUT /rules/{merchant_pattern}` → atualiza categoria
- `DELETE /rules/{merchant_pattern}` → remove
- `POST /transactions/{id}/update-category` → body `{category, apply_mode: "single"|"future"|"past_and_future"}`
  - se `future` ou `past_and_future`: cria regra atomicamente
  - se `past_and_future`: também dispara um batch update das transações passadas

### Pipeline de invoice atualizado

```python
# backend/functions/invoices/handler.py
rules = load_user_rules(user_id)                          # NOVO
raw_lines = extract_lines_from_pdf(pdf)
pre_categorized, remaining = split_by_rules(raw_lines, rules)  # NOVO
ai_categorized = groq.categorize(remaining)               # menos tokens
transactions = merge(pre_categorized, ai_categorized)
```

## Frontend

- `<CategoryEditDialog>` com radio buttons de escopo
- Página `/rules` com listagem editável
- Hook `useRules` (GET/POST/PUT/DELETE)
- Hook `useUpdateCategory` — mutation

## Dependências

- **Bloqueado por `feat-transaction-edit`** (precisa editar categoria antes)
- Beneficia de `feat-duplicate-detector` (merchants já normalizados)

## Riscos / gotchas

- Merchant com espelhamento diferente ("IFOOD*XYZ" vs "IFOOD *XYZ") pode não casar — a função de normalização precisa ser robusta e testada com fixtures reais de várias operadoras.
- Regra pode ficar errada (usuário categoriza uma vez errado, sempre erra depois). Solução: mostrar `match_count` na tela de regras e permitir "resetar" com um clique.
- Regra "IFOOD" pode pegar "IFOODY DELIVERY" se for substring. Decidir: matching por token exato após normalização, não substring.

## Métricas de sucesso

Instrumentar (log Lambda):
- % de linhas do PDF categorizadas por regra (vs IA)
- Tokens Groq usados por fatura antes/depois
- Nº de correções manuais de categoria por semana

## Arquivos afetados

- `backend/shared/normalizer.py` — **novo**, função de normalização de merchant
- `backend/shared/rules.py` — **novo**, load/save/apply rules
- `backend/shared/models.py` — modelo `Rule`
- `backend/shared/db.py` — helpers `rule_sk()`, queries
- `backend/functions/invoices/handler.py` — integrar rules no pipeline
- `backend/functions/rules/handler.py` — **nova lambda** (ou embutir em profile)
- `infra/stacks/api_stack.py` — rotas `/rules`, `/transactions/{id}/update-category`
- `frontend/src/hooks/useRules.ts` — **novo**
- `frontend/src/hooks/useUpdateCategory.ts` — **novo**
- `frontend/src/components/CategoryEditDialog.tsx` — **novo**
- `frontend/src/pages/RulesPage.tsx` — **novo**
- `frontend/src/App.tsx` — rota nova
- `frontend/src/components/AppHeader.tsx` — link pra `/rules`

## Coordenação com outros agentes

Ver mapa mestre em [`.scratch/PARALLEL_EXECUTION.md`](../PARALLEL_EXECUTION.md).

**Onda:** D1 (roda sozinho, sem nenhum outro agente ativo).

**Por quê sozinho:** integra em múltiplos arquivos "quentes" simultaneamente (`invoices/handler.py`, `models.py`, `db.py`, `TransactionList.tsx`) e o custo de merge concorrente supera o benefício de paralelismo.

**Arquivos compartilhados com outras issues:**

| Arquivo | Também tocado por | Como coexistir |
|---|---|---|
| `backend/functions/invoices/handler.py` | `feat-async-invoice-processing`, `feat-transaction-edit`, `1D`, `feat-multiple-cards`, `feat-invoice-list` | **Todas devem estar mergeadas antes.** Esta issue insere passo `pre_categorize_by_rules()` no pipeline, entre extract e Groq. |
| `backend/shared/models.py` | `1D`, `4A`, `4B` | Adiciona modelo `Rule` (novo, não afeta os outros). Não toca em `Transaction`. |
| `backend/shared/db.py` | `4A`, `4B`, `4C` | Adiciona `rule_sk()`, `get_user_rules()`. Ondas B/C devem estar mergeadas antes; 4A ainda não deve ter começado. |
| `frontend/src/components/TransactionList.tsx` | `feat-transaction-edit`, `1D`, `4B`, `feat-multiple-cards` | Substitui o dropdown de edição inline por `<CategoryEditDialog>` (mais rico). Cuidado com regressão da mecânica de `feat-transaction-edit`. |
| `frontend/src/App.tsx`, `AppHeader.tsx` | 4A | Adicionar rota `/rules` e link. Se 4A já entrou, coordenar com `<WorkspaceSwitcher>`. |
| `infra/stacks/api_stack.py` | Todas | Bloco `# --- feat-category-learning (1E) ---`. |

**Arquivos exclusivos desta issue (zero risco):**
- `backend/shared/normalizer.py`
- `backend/shared/rules.py`
- `backend/functions/rules/handler.py`
- `frontend/src/hooks/useRules.ts`, `useUpdateCategory.ts`
- `frontend/src/components/CategoryEditDialog.tsx`
- `frontend/src/pages/RulesPage.tsx`

**Dependências de ordem (obrigatórias):**
1. `feat-async-invoice-processing` (fundação do handler)
2. `feat-transaction-edit` (mecânica de edição)
3. Ondas A, B, C mergeadas
4. **Antes de 4A** — se 4A rodar primeiro, esta issue precisa refactor total pra `workspace_id`.

**Após merge:** regenerar layer + deploy `InvoicePlanApi`.

## Fora do escopo

- Regras condicionais (ex: "IFOOD acima de R$ 100 = jantar de negócios")
- Sub-categorias
- Aprendizado sem correção explícita (auto-clustering)
