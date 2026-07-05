---
title: "Feature: alertas automáticos no dashboard"
labels: [needs-triage]
status: open
created: 2026-07-04
priority: P2
effort: médio
group: intel-gastos
---

## Contexto

Muitos padrões relevantes de gasto passam despercebidos porque exigem que o usuário faça a análise manualmente (comparar meses, notar aumentos de assinaturas, ver categoria explodindo). Um sistema de alertas gera esses insights automaticamente e os coloca no topo do dashboard.

## O que construir

Uma faixa de "insights" no topo do dashboard, com até 3-5 cards horizontais mostrando anomalias/observações do mês corrente. Sem toast, sem push — inline no dashboard.

## Tipos de alerta

| Código | Regra de detecção | Severidade | Exemplo |
|---|---|---|---|
| `category_spike` | Categoria X gastou >= 40% acima da média 3m | ⚠️ warning | "Delivery está 62% acima da média" |
| `subscription_price_up` | Transação recorrente teve aumento >= 10% vs último mês | ℹ️ info | "Netflix subiu de R$ 39,90 → R$ 44,90" |
| `new_recurring` | Transação recém identificada como `is_recurring=true` neste mês | ℹ️ info | "Nova assinatura detectada: Spotify" |
| `high_daily_spend` | Ritmo diário >= 25% acima da média histórica | ⚠️ warning | "Ritmo de gastos 30% acima do normal" |
| `installment_ending` | Uma parcela na `InstallmentTracker` está na última ou penúltima | 💚 positive | "Parcela do celular termina esse mês (–R$ 250/mês a partir de agosto)" |
| `budget_burn` (depende de `feat-spending-goals`) | Meta de categoria em 80%+ | ⚠️ warning | "Meta de Alimentação em 85%" |

## UX

### Faixa de insights (topo do dashboard, acima do `SummaryCard`)

```
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ ⚠️ Categoria      │ │ ℹ️ Assinatura    │ │ 💚 Parcela        │
│ Delivery 62%     │ │ Netflix subiu    │ │ Celular acaba    │
│ acima da média   │ │ R$ 39 → R$ 44    │ │ esse mês         │
│              [x] │ │              [x] │ │              [x] │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

- Máximo 5 cards visíveis, resto vira "ver mais (3)"
- Cada card com botão "x" pra dispensar (persistir dismiss no `PROFILE`)
- Se nenhum alerta relevante → faixa não aparece
- Ordenação: severidade (warning > positive > info) + magnitude do desvio

### Configuração (v2)

Página de configurações permite desligar tipos de alerta. **Fora do escopo desta issue.**

## Modelo de dados

Novo tipo de item no DynamoDB pra persistir "dismiss":

```
PK: USER#{user_id}
SK: ALERT_DISMISS#{yearMonth}#{alert_hash}
dismissed_at: ISO datetime
```

`alert_hash` = md5 do tipo + payload identificador (ex: `category_spike:delivery:2026-07`).

TTL: itens dismissed podem expirar depois de 90 dias (DynamoDB TTL attribute).

## Backend

Novo endpoint `GET /alerts/{yearMonth}` ou embutido em `/dashboard/{yearMonth}` como campo extra `alerts: [...]`.

**Recomendado: embutir no `/dashboard`** — evita round-trip e a lógica já precisa ler os mesmos dados (summaries, transações recorrentes).

Módulo `backend/shared/alerts.py` com uma função `detect_alerts(user_id, year_month, transactions, summaries) -> list[Alert]` que roda todas as regras.

Cada regra é uma função pura, testável em isolamento:

```python
def detect_category_spike(current: dict, avg_3m: dict) -> list[Alert]: ...
def detect_subscription_price_up(current_txs, prev_month_txs) -> list[Alert]: ...
```

Excluir alertas já `dismissed` antes de retornar.

## Frontend

- `<InsightsBar>` novo componente no topo do dashboard
- `<InsightCard>` sub-componente com variantes por severidade
- Hook `useDismissAlert` → POST `/alerts/dismiss` com `{alert_hash, year_month}`
- Atualização otimista: alerta some da UI imediatamente

## Dependências

- `feat-monthly-comparison` como pré-requisito lógico (compartilha cálculo de médias)
- `feat-spending-goals` desbloqueia `budget_burn`

## Arquivos afetados

- `backend/shared/alerts.py` — **novo**
- `backend/functions/dashboard/handler.py` — chamar `detect_alerts()`
- `backend/functions/dashboard/handler.py` ou nova rota — `POST /alerts/dismiss`
- `infra/stacks/api_stack.py` — rota de dismiss
- `frontend/src/hooks/useDismissAlert.ts` — **novo**
- `frontend/src/components/InsightsBar.tsx` — **novo**
- `frontend/src/components/InsightCard.tsx` — **novo**
- `frontend/src/pages/DashboardPage.tsx` — montar barra no topo
- `frontend/src/types/index.ts` — tipo `Alert`

## Coordenação com outros agentes

Ver mapa mestre em [`.scratch/PARALLEL_EXECUTION.md`](../PARALLEL_EXECUTION.md).

**Onda:** B (paralelo com 1B, após onda A).

**Arquivos compartilhados com outras issues:**

| Arquivo | Também tocado por | Como coexistir |
|---|---|---|
| `backend/functions/dashboard/handler.py` | `1A` (`history_summaries`), `1B` (rota separada) | Esta issue **adiciona** o campo `alerts: [...]` ao payload de `/dashboard/{yearMonth}`. **Não** tocar em `history_summaries` (contrato de 1A) nem criar rota nova (contrato de 1B). |
| `backend/functions/dashboard/handler.py` ou novo | `feat-transaction-edit` (PATCH) | Rota `POST /alerts/dismiss` — se `feat-transaction-edit` já mergeou uma nova rota lá, adicionar irmã. |
| `infra/stacks/api_stack.py` | Todas | Bloco `# --- feat-smart-alerts (1C) ---` no fim. |
| `frontend/src/pages/DashboardPage.tsx` | `1A`, `1B`, `4C` | Inserir `<InsightsBar>` no topo, acima de tudo (slot canônico §5). |
| `frontend/src/types/index.ts` | Todos | Adicionar tipo `Alert` no fim. |

**Arquivos exclusivos desta issue (zero risco):**
- `backend/shared/alerts.py`
- `frontend/src/hooks/useDismissAlert.ts`
- `frontend/src/components/InsightsBar.tsx`
- `frontend/src/components/InsightCard.tsx`

**Dependências de ordem:**
- **Bloqueada por:** `1A` (precisa das médias). Só entrar na onda B.
- **Paralelo com:** 1B (contrato claro no dashboard handler).
- **Não rodar em paralelo com:** 4A, 4B (4B pode tocar campo `share_amount` que altera cálculos de alertas — merge B antes de C).

**Após merge:** regenerar layer.

## Fora do escopo

- Notificação push / email (só inline)
- Configuração granular de tipos (v2)
- Alertas de risco (fraude, cobrança suspeita) — é `feat-duplicate-detector`
