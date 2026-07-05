---
title: "Feature: comparativo mensal vs média (últimos N meses)"
labels: [needs-triage]
status: open
created: 2026-07-04
priority: P2
effort: baixo
group: intel-gastos
---

## Contexto

O dashboard hoje mostra o mês corrente isolado. O usuário não tem noção rápida se está gastando mais/menos que o normal em cada categoria. O endpoint `/dashboard/{yearMonth}` já retorna dados de até 6 meses (usados pelo `MonthlyTimeline`), então o custo marginal é baixíssimo — é praticamente cálculo no frontend.

## O que construir

Para cada categoria e para o total geral, mostrar:
- valor gasto no mês corrente
- média dos últimos N meses (default N=3, excluindo o mês corrente)
- variação percentual e ícone de tendência (↑ vermelho / ↓ verde / — cinza)

## UX

### Cards de categoria (dentro de `CategoryChart` ou nova seção "Comparativo")

```
┌─────────────────────────────────┐
│ 🍔 Alimentação                  │
│ R$ 1.240,00                     │
│ ↑ 23% vs média 3m (R$ 1.008)    │
└─────────────────────────────────┘
```

Regras visuais:
- Variação **>= +15%** → texto vermelho + ícone ↑
- Variação **<= -15%** → texto verde + ícone ↓
- Entre -15% e +15% → texto cinza + ícone —
- Se média = 0 (categoria nova), esconde a linha de comparativo

### Card de resumo (topo do dashboard)

Adicionar linha no `SummaryCard` existente:
- "Gasto total: R$ 4.520 — 12% acima da média (R$ 4.030)"

### Seletor de janela

Toggle discreto no dashboard: `3m | 6m | 12m` (default 3m). Persistir escolha em `localStorage`.

## Modelo de dados

**Sem mudanças no DynamoDB.** Toda a computação é feita a partir dos `SUMMARY#{yearMonth}` que o backend já retorna no `/dashboard`.

## Backend

Duas opções:

**Opção A (recomendada — zero backend):** o endpoint `/dashboard/{yearMonth}` já retorna 6 meses no timeline. Estender a resposta pra sempre incluir os últimos 12 `SUMMARY` (pequenos, ~500 bytes cada). Frontend calcula tudo.

**Opção B:** novo endpoint `/comparison/{yearMonth}?window=3` que retorna já calculado. Só vale a pena se a Opção A ficar > 100KB.

Ir com **A**.

## Frontend

- Novo hook `useMonthlyComparison(yearMonth, window)` — pura função a partir do resultado de `useDashboard`
- Novo componente `<CategoryComparisonCard>` ou extensão de `<CategoryChart>`
- Extensão de `<SummaryCard>` pra mostrar variação total
- Utilitário `frontend/src/lib/stats.ts` com `mean()`, `pctChange()`

## Dependências

- Nenhuma bloqueante.
- Melhora se combinado com `feat-smart-alerts` (usa mesmos números pra gerar avisos).

## Arquivos afetados

- `backend/functions/dashboard/handler.py` — retornar até 12 summaries (opção A)
- `frontend/src/hooks/useDashboard.ts` — tipar campo novo
- `frontend/src/hooks/useMonthlyComparison.ts` — **novo**
- `frontend/src/lib/stats.ts` — **novo**
- `frontend/src/components/CategoryChart.tsx` — badge de comparativo
- `frontend/src/components/SummaryCard.tsx` — linha de variação
- `frontend/src/types/index.ts` — tipo `MonthlySummary[]`

## Coordenação com outros agentes

Ver mapa mestre em [`.scratch/PARALLEL_EXECUTION.md`](../PARALLEL_EXECUTION.md).

**Onda:** A (paralelo com 1D e 4C).

**Arquivos compartilhados com outras issues:**

| Arquivo | Também tocado por | Como coexistir |
|---|---|---|
| `backend/functions/dashboard/handler.py` | `1C` (alerts no payload), `1B` (rota separada `/forecast`) | Esta issue **adiciona** o campo `history_summaries: [...]` ao objeto retornado. Não renomear/reorganizar o payload existente. |
| `frontend/src/pages/DashboardPage.tsx` | `1B`, `1C`, `4C`, `feat-invoice-list`, `feat-multiple-cards`, `feat-month-selector-upload` | Inserir `<CategoryComparisonCard>` conforme slot definido em §5 do mapa mestre (dentro/abaixo do `SummaryCard` e `CategoryChart`). |
| `frontend/src/components/CategoryChart.tsx` | Ninguém nesta onda | Extensão livre. |
| `frontend/src/components/SummaryCard.tsx` | Ninguém nesta onda | Extensão livre. |
| `frontend/src/types/index.ts` | Praticamente todos | Adicionar tipo `MonthlySummary[]` no fim do arquivo, sem reorganizar. |

**Arquivos exclusivos desta issue (zero risco):**
- `frontend/src/hooks/useMonthlyComparison.ts`
- `frontend/src/lib/stats.ts`
- `frontend/src/components/CategoryComparisonCard.tsx` (se optar por criar componente novo em vez de estender `CategoryChart`)

**Dependências de ordem:**
- **Deve rodar antes de:** `1C` (usa a mesma computação de médias — se 1A empurrar médias pro backend, 1C reusa)
- **Não bloqueia nem é bloqueada por:** 1D, 4C
- **Não rodar em paralelo com:** 4A (schema refactor total)

**Após merge:** owner da onda A rebase esta branch primeiro (adiciona `history_summaries`), depois 1D, depois 4C. Regenerar layer se tocou `backend/shared/*` (esta issue não deveria tocar).

## Fora do escopo

- Comparativo por dia da semana / dia do mês (é o `SpendingHeatmap`)
- Previsão de fim de mês (é `feat-invoice-forecast`)
- Alertas automáticos (é `feat-smart-alerts`)
