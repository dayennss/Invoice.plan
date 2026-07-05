# Agent brief — feat-monthly-comparison (Onda A)

Você é um agente de implementação para o projeto **invoice.plan** (SaaS de gestão financeira pessoal, stack serverless AWS + React + TanStack Query + Groq/Llama). Sua missão é implementar UMA issue específica dentro das regras de coordenação já definidas no repo.

## 1. Sua missão

Ler e implementar a issue em: `.scratch/feat-monthly-comparison/issue.md`

Feature 1A do roadmap — comparativo do mês corrente vs. média dos últimos N meses, por categoria e no total. Custo baixíssimo porque o `/dashboard/{yearMonth}` já tem 6 meses de dados; a issue estende pra 12 e o frontend faz o cálculo.

Trate a issue como especificação: siga UX, modelo de dados, backend, arquivos afetados e "fora do escopo" à risca.

## 2. Coordenação obrigatória

Leia por completo `.scratch/PARALLEL_EXECUTION.md`. Você está na **Onda A**.

Outros agentes possíveis rodando em paralelo nesta onda: **1D (feat-duplicate-detector)** e **4C (feat-share-readonly-link)**.

Pontos de atenção específicos desta issue:
- Você **estende o payload** de `/dashboard/{yearMonth}` adicionando o campo `history_summaries: [...]`. NÃO renomeie/reorganize o payload existente.
- Em `DashboardPage.tsx` você insere `<CategoryComparisonCard>` (ou estende `CategoryChart`) sem reordenar outros filhos. Ver §5 do mapa mestre pro slot canônico.
- Em `types/index.ts`, adicione tipo `MonthlySummary[]` no fim do arquivo, sem reorganizar.

**Arquivos exclusivos seus (zero risco de colisão):**
- `frontend/src/hooks/useMonthlyComparison.ts`
- `frontend/src/lib/stats.ts`
- `frontend/src/components/CategoryComparisonCard.tsx` (se optar por componente novo)

## 3. Convenções do projeto

Layer Python: esta issue **provavelmente não toca** `backend/shared/`. Se tocar, ao final:

```powershell
Remove-Item -Recurse -Force backend/layer/python/shared
Copy-Item -Recurse backend/shared backend/layer/python/shared
```

Documente em `notes.md` que precisa `cdk deploy InvoicePlanApi` na revisão.

**Não rode `cdk deploy`** você mesmo.

**Estilo:** sem comentários redundantes, sem código de compatibilidade fantasma, sem feature flags que a issue não pediu. Preserve PT-BR nos rótulos, EN em código.

## 4. Fluxo de trabalho

1. `git status` + `git log --oneline -5`
2. Ler `.scratch/feat-monthly-comparison/issue.md` e `.scratch/PARALLEL_EXECUTION.md` inteiros
3. Confirmar que a Onda 0 (feat-async-invoice-processing, feat-transaction-edit) está mergeada
4. Implementar
5. Testar: `cd frontend && npm run build`
6. Se tocou `backend/shared/`, regenerar layer (§3)
7. Registrar decisões em `.scratch/feat-monthly-comparison/notes.md`
8. Commit(s): `feat(dashboard): comparativo mensal por categoria`, etc.

## 5. Definição de pronto

- [ ] Arquivos da seção "Arquivos afetados" da issue tocados
- [ ] Nenhum arquivo fora dessa lista tocado
- [ ] `npm run build` passa
- [ ] Imports backend OK (se aplicável)
- [ ] Layer regenerada se necessário
- [ ] Commits atômicos no padrão do projeto
- [ ] `notes.md` documenta decisões fora da spec

## 6. Se travar

Pare e reporte. NUNCA rode git reset --hard, delete branches, force push, ou --no-verify por conta própria.
