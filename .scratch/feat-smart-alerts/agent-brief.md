# Agent brief — feat-smart-alerts (Onda B)

Você é um agente de implementação para o projeto **invoice.plan** (SaaS de gestão financeira pessoal, stack serverless AWS + React + TanStack Query + Groq/Llama). Sua missão é implementar UMA issue específica dentro das regras de coordenação já definidas no repo.

## 1. Sua missão

Ler e implementar a issue em: `.scratch/feat-smart-alerts/issue.md`

Feature 1C — barra de "insights" no topo do dashboard com alertas automáticos (spike de categoria, aumento de assinatura, nova recorrente, ritmo alto, parcela terminando, etc.).

Trate a issue como especificação: siga UX, tipos de alerta, modelo de dados, backend, arquivos afetados e "fora do escopo" à risca.

## 2. Coordenação obrigatória

Leia por completo `.scratch/PARALLEL_EXECUTION.md`. Você está na **Onda B**.

Outros agentes possíveis rodando em paralelo: **1B (feat-invoice-forecast)**.

Pontos de atenção específicos desta issue:
- Você **estende** o payload de `/dashboard/{yearMonth}` adicionando o campo `alerts: [...]`. NÃO tocar em `history_summaries` (contrato de 1A já mergeada) nem criar rota nova (contrato de 1B).
- Novo endpoint `POST /alerts/dismiss` — se `feat-transaction-edit` (Onda 0) já mergeou rota `PATCH /transactions/{id}` na mesma Lambda, adicione irmã sem tocar naquele handler.
- Em `infra/stacks/api_stack.py`, bloco `# --- feat-smart-alerts (1C) ---` no fim.
- Em `DashboardPage.tsx`, insira `<InsightsBar>` no topo, acima de tudo (slot canônico §5 do mapa mestre).
- Nova SK no Dynamo: `ALERT_DISMISS#{ym}#{alert_hash}` com TTL. Adicionar helper em `db.py` sem mexer em queries existentes.

**Arquivos exclusivos seus (zero risco):**
- `backend/shared/alerts.py`
- `frontend/src/hooks/useDismissAlert.ts`
- `frontend/src/components/InsightsBar.tsx`
- `frontend/src/components/InsightCard.tsx`

## 3. Convenções do projeto

Layer Python: esta issue **cria `backend/shared/alerts.py`** e toca `db.py`. Ao final:

```powershell
Remove-Item -Recurse -Force backend/layer/python/shared
Copy-Item -Recurse backend/shared backend/layer/python/shared
```

Documente em `notes.md` que precisa `cdk deploy InvoicePlanApi`.

**Não rode `cdk deploy`** você mesmo.

**Estilo:** cada regra de alerta é função pura testável (`detect_category_spike`, `detect_subscription_price_up`, etc.). Sem comentários redundantes. Preserve PT-BR em rótulos, EN em código.

## 4. Fluxo de trabalho

1. `git status` + `git log --oneline -5`
2. Ler `.scratch/feat-smart-alerts/issue.md` e `.scratch/PARALLEL_EXECUTION.md`
3. Confirmar que **Onda A** está mergeada (1A entregou `history_summaries` que você reusa)
4. Implementar `backend/shared/alerts.py` com uma função por tipo de alerta
5. Integrar no handler `/dashboard/{yearMonth}` (só adicionar `alerts` no return)
6. Adicionar `POST /alerts/dismiss` (nova rota, bloco delimitado)
7. Frontend: hook + `<InsightCard>` + `<InsightsBar>` + integração no `DashboardPage.tsx`
8. `cd frontend && npm run build`
9. Regenerar layer (§3)
10. `notes.md` com decisões (ex: thresholds escolhidos pra cada alerta)
11. Commits: `feat(alerts): detector de spike de categoria`, etc.

## 5. Definição de pronto

- [ ] Arquivos da issue tocados
- [ ] Nenhum arquivo fora da lista
- [ ] Todos os tipos de alerta da tabela da issue implementados (exceto `budget_burn` que depende de `feat-spending-goals`)
- [ ] Alerta dismissed persiste (não reaparece após reload)
- [ ] Ordenação por severidade correta
- [ ] `npm run build` passa
- [ ] Imports backend OK
- [ ] Layer regenerada
- [ ] Commits atômicos
- [ ] `notes.md` preenchido

## 6. Se travar

Pare e reporte. NUNCA rode git reset --hard, delete branches, force push, ou --no-verify por conta própria.
