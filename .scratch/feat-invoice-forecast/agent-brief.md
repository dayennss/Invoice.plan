# Agent brief — feat-invoice-forecast (Onda B)

Você é um agente de implementação para o projeto **invoice.plan** (SaaS de gestão financeira pessoal, stack serverless AWS + React + TanStack Query + Groq/Llama). Sua missão é implementar UMA issue específica dentro das regras de coordenação já definidas no repo.

## 1. Sua missão

Ler e implementar a issue em: `.scratch/feat-invoice-forecast/issue.md`

Feature 1B — previsão de fechamento da fatura do mês corrente. Novo endpoint `/forecast/{yearMonth}` + card no dashboard com valor estimado, intervalo de confiança e breakdown.

Trate a issue como especificação: siga UX, modelo matemático, backend, arquivos afetados e "fora do escopo" à risca.

## 2. Coordenação obrigatória

Leia por completo `.scratch/PARALLEL_EXECUTION.md`. Você está na **Onda B**.

Outros agentes possíveis rodando em paralelo: **1C (feat-smart-alerts)**.

Pontos de atenção específicos desta issue:
- Você **NÃO altera** o handler `/dashboard/{yearMonth}` existente. Crie rota nova `/forecast/{yearMonth}` em bloco separado. Se optar por embutir na mesma Lambda, adicione novo ramo `if event["routeKey"] == ...` sem tocar nos existentes.
- Em `infra/stacks/api_stack.py`, bloco delimitado `# --- feat-invoice-forecast (1B) ---` no fim.
- Em `DashboardPage.tsx` você insere `<ForecastCard>` entre `<InsightsBar>` (se 1C estiver pronta) e `<SummaryCard>`. Ver §5 do mapa mestre. Só renderizar quando `yearMonth === mês corrente`.
- Em `types/index.ts`, adicione tipo `Forecast` no fim.

**Arquivos exclusivos seus (zero risco):**
- `backend/shared/forecast.py`
- `frontend/src/hooks/useForecast.ts`
- `frontend/src/components/ForecastCard.tsx`

## 3. Convenções do projeto

Layer Python: esta issue **cria `backend/shared/forecast.py`**. Ao final:

```powershell
Remove-Item -Recurse -Force backend/layer/python/shared
Copy-Item -Recurse backend/shared backend/layer/python/shared
```

Documente em `notes.md` que precisa `cdk deploy InvoicePlanApi`.

**Não rode `cdk deploy`** você mesmo.

**Estilo:** funções puras testáveis em `forecast.py` (uma função por regra do modelo matemático). Sem comentários redundantes. Preserve PT-BR em rótulos, EN em código.

## 4. Fluxo de trabalho

1. `git status` + `git log --oneline -5`
2. Ler `.scratch/feat-invoice-forecast/issue.md` e `.scratch/PARALLEL_EXECUTION.md`
3. Confirmar que **Onda A** (`feat-monthly-comparison`, `feat-duplicate-detector`, `feat-share-readonly-link`) está mergeada
4. Implementar `backend/shared/forecast.py` primeiro; se possível, testes de unidade simples pra funções de projeção
5. Adicionar rota nova em `api_stack.py` (bloco delimitado)
6. Adicionar handler (nova rota ou embutida na dashboard Lambda com ramo isolado)
7. Frontend: hook + componente + integração no `DashboardPage.tsx`
8. `cd frontend && npm run build`
9. Regenerar layer (§3)
10. `notes.md` com decisões
11. Commits: `feat(forecast): previsão de fechamento`, `infra(api): rota /forecast`, etc.

## 5. Definição de pronto

- [ ] Arquivos da issue tocados
- [ ] Nenhum arquivo fora da lista
- [ ] `npm run build` passa
- [ ] Imports `from backend.shared.forecast import *` OK
- [ ] Layer regenerada
- [ ] Rota `/forecast/{yearMonth}` responde payload conforme spec
- [ ] Card só aparece no mês corrente
- [ ] Commits atômicos
- [ ] `notes.md` preenchido

## 6. Se travar

Pare e reporte. NUNCA rode git reset --hard, delete branches, force push, ou --no-verify por conta própria.
