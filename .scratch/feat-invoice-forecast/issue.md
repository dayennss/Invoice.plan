---
title: "Feature: previsão de fechamento da fatura do mês"
labels: [needs-triage]
status: open
created: 2026-07-04
priority: P2
effort: médio
group: intel-gastos
---

## Contexto

Durante o mês corrente, o usuário ainda não tem a fatura fechada. Ele vê "R$ 1.200 até agora" mas não sabe se está no ritmo pra fechar em R$ 2.500 ou R$ 4.000. Uma previsão bem calibrada transforma o app de "diário do passado" em "ferramenta de decisão".

## O que construir

Um card no topo do dashboard exibindo:
- valor previsto de fechamento do mês
- intervalo de confiança (min/max)
- breakdown do cálculo (o que já foi gasto + projeção + recorrentes esperadas)

## UX

### Card "Previsão de fechamento"

```
┌─────────────────────────────────────────┐
│ 📊 Previsão de fechamento               │
│ R$ 3.400  (±R$ 320)                     │
│                                         │
│ ▸ Já gasto até dia 15:      R$ 1.680    │
│ ▸ Projeção dos 15 dias restantes:       │
│                            + R$ 1.400   │
│ ▸ Recorrentes esperadas:   + R$ 320     │
│                             ─────────   │
│                             R$ 3.400    │
│                                         │
│ 💡 Ritmo atual: R$ 112/dia              │
│    (média 6m: R$ 98/dia — 14% acima)    │
└─────────────────────────────────────────┘
```

Estados:
- **Início do mês (dia 1-5)**: exibe "previsão indisponível — poucos dados" com placeholder
- **Meio do mês (dia 6-25)**: previsão completa como acima
- **Fim do mês (dia 26+)**: previsão vira "estimativa de fechamento (mês quase terminado)"
- **Mês passado**: card some ou vira "gasto real: R$ X"

Só aparece se o `yearMonth` selecionado for o corrente.

## Modelo matemático

```
projecao_diaria_futuro = ritmo_atual_dia * (dias_no_mes - hoje)

ritmo_atual_dia = gasto_do_mes_ate_hoje / dias_transcorridos

# Ajuste sazonal (v2): ponderar por dia da semana usando histórico
# Ex: sábado historicamente = 1.8x da média → ajustar projeção

recorrentes_esperadas = soma(transacoes.is_recurring do mês anterior
                              cuja data ainda não passou este mês)

previsao = gasto_ate_hoje + projecao_diaria_futuro + recorrentes_esperadas

# Intervalo de confiança
desvio = stddev(gastos_diarios_ultimos_90d)
ic = 1.96 * desvio * sqrt(dias_restantes)
```

## Backend

Novo endpoint `GET /forecast/{yearMonth}`:

```json
{
  "year_month": "2026-07",
  "as_of_date": "2026-07-15",
  "spent_so_far": 1680.00,
  "projected_remaining": 1400.00,
  "expected_recurring": 320.00,
  "forecast_total": 3400.00,
  "confidence_interval": {"min": 3080, "max": 3720},
  "daily_rate_current": 112.00,
  "daily_rate_avg_6m": 98.00,
  "daily_rate_delta_pct": 0.14
}
```

Implementação: nova lambda ou rota adicional na `DashboardFunction`.

Cache: computar sob demanda; TTL implícito de 1h no CloudFront (query params).

## Modelo de dados

Sem mudanças. Usa `TRANSACTION#{ym}#*` do mês corrente e `SUMMARY#{ym}` dos meses passados.

## Frontend

- Hook `useForecast(yearMonth)`
- Componente `<ForecastCard>` novo, posicionado acima do `<SummaryCard>` quando `yearMonth === mês corrente`
- Ícone de "?" com tooltip explicando o cálculo (transparência)

## Dependências

- Requer que `is_recurring` esteja preenchido corretamente (já está)
- Melhora com `feat-monthly-comparison` (compartilha `daily_rate_avg_6m`)

## Riscos / gotchas

- Se o usuário fez upload da fatura do mês inteiro no dia 20 (fatura já fechou dia 15), o "mês" no app não corresponde ao "mês do calendário" — a previsão pode não fazer sentido. **Só ativar se houver pelo menos uma transação com data >= hoje - 5 dias**.
- Recorrentes: usar heurística "mesma descrição + dia do mês similar + valor ±10%" pra decidir se já entrou este mês ou não.

## Arquivos afetados

- `backend/functions/dashboard/handler.py` — nova rota `/forecast/{yearMonth}` (ou lambda separada)
- `backend/shared/forecast.py` — **novo**, com a lógica de projeção
- `infra/stacks/api_stack.py` — rota nova
- `frontend/src/hooks/useForecast.ts` — **novo**
- `frontend/src/components/ForecastCard.tsx` — **novo**
- `frontend/src/pages/DashboardPage.tsx` — montar card
- `frontend/src/types/index.ts` — tipo `Forecast`

## Coordenação com outros agentes

Ver mapa mestre em [`.scratch/PARALLEL_EXECUTION.md`](../PARALLEL_EXECUTION.md).

**Onda:** B (paralelo com 1C, após onda A).

**Arquivos compartilhados com outras issues:**

| Arquivo | Também tocado por | Como coexistir |
|---|---|---|
| `backend/functions/dashboard/handler.py` | `1A` (adicionou `history_summaries`), `1C` (alerts) | **Esta issue não altera o handler `/dashboard/{yearMonth}`.** Criar rota nova `/forecast/{yearMonth}` em bloco separado. Se optar por embutir na mesma Lambda, adicionar novo `if event["routeKey"] == ...` sem tocar nos ramos existentes. |
| `infra/stacks/api_stack.py` | Praticamente todas | Bloco isolado marcado `# --- feat-invoice-forecast (1B) ---` no fim do arquivo. |
| `frontend/src/pages/DashboardPage.tsx` | `1A`, `1C`, `4C`, `feat-invoice-list` | Inserir `<ForecastCard>` no slot canônico (§5 do mapa mestre): entre `<InsightsBar>` (1C) e `<SummaryCard>`. Só renderizar se `yearMonth === mês corrente`. |
| `frontend/src/types/index.ts` | Todos | Adicionar tipo `Forecast` no fim. |

**Arquivos exclusivos desta issue (zero risco):**
- `backend/shared/forecast.py`
- `frontend/src/hooks/useForecast.ts`
- `frontend/src/components/ForecastCard.tsx`

**Dependências de ordem:**
- **Beneficia-se de (não bloqueia):** `1A` já mergeada — reusa `daily_rate_avg_6m` de médias históricas.
- **Independente de:** 1C — ambos rodam juntos na onda B com contrato claro.
- **Não rodar em paralelo com:** 4A.

**Após merge:** regenerar layer (mexe em `backend/shared/`).

## Fora do escopo

- Previsão de vários meses à frente (só o mês corrente)
- Recomendações de "corte R$ X pra fechar dentro da meta" (é feature futura, depende de `feat-spending-goals`)
