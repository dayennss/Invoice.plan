# Agent brief — feat-category-learning (Onda D1)

Você é um agente de implementação para o projeto **invoice.plan** (SaaS de gestão financeira pessoal, stack serverless AWS + React + TanStack Query + Groq/Llama). Sua missão é implementar UMA issue específica dentro das regras de coordenação já definidas no repo.

## 1. Sua missão

Ler e implementar a issue em: `.scratch/feat-category-learning/issue.md`

Feature 1E — categorização com aprendizado. Usuário corrige categoria de uma transação → app cria regra `merchant→categoria` → próxima fatura aplica antes de chamar a IA (menos tokens Groq, mais consistência).

Trate a issue como especificação: siga UX, modelo de dados, backend, pipeline, arquivos afetados e "fora do escopo" à risca.

## 2. Coordenação obrigatória

Leia por completo `.scratch/PARALLEL_EXECUTION.md`. Você está na **Onda D1** — roda SOZINHO. Nenhum outro agente deve estar ativo.

Pontos de atenção específicos desta issue:
- Insere passo `pre_categorize_by_rules()` no pipeline de `invoices/handler.py` entre extract e Groq. Cuidado com o refactor de `feat-async-invoice-processing` (HTTP handler + async worker).
- Em `models.py`, adiciona **modelo `Rule` novo**. **Não** toca em `Transaction` (diferente de 1D e 4B).
- Em `db.py`, adiciona `rule_sk()`, `get_user_rules()`. **Não** toca em queries existentes.
- Em `TransactionList.tsx`, **substitui** o dropdown inline de edição (de `feat-transaction-edit`) por abrir `<CategoryEditDialog>` (mais rico, com radio de escopo). Cuidado com regressão da mecânica original.
- Em `App.tsx` e `AppHeader.tsx`, adiciona rota `/rules` e link. Se 4A já entrou (não deveria — 1E vem antes de 4A), coordenar com `<WorkspaceSwitcher>`.
- Em `infra/stacks/api_stack.py`, bloco `# --- feat-category-learning (1E) ---` no fim.

**Arquivos exclusivos seus (zero risco):**
- `backend/shared/normalizer.py`
- `backend/shared/rules.py`
- `backend/functions/rules/handler.py`
- `frontend/src/hooks/useRules.ts`, `useUpdateCategory.ts`
- `frontend/src/components/CategoryEditDialog.tsx`
- `frontend/src/pages/RulesPage.tsx`

## 3. Convenções do projeto

Layer Python: esta issue **cria vários arquivos em `backend/shared/`**. Ao final:

```powershell
Remove-Item -Recurse -Force backend/layer/python/shared
Copy-Item -Recurse backend/shared backend/layer/python/shared
```

Documente em `notes.md` que precisa `cdk deploy InvoicePlanApi`.

**Não rode `cdk deploy`** você mesmo.

**Estilo:**
- Função de normalização de merchant deve ser pura, testável, e casar com fixtures reais de faturas brasileiras. Se `feat-duplicate-detector` (1D) já normalizou, **reusar** — não duplicar.
- Sem comentários redundantes. Preserve PT-BR em rótulos, EN em código.
- Instrumentar (log Lambda) métricas de sucesso: % de linhas categorizadas por regra vs IA, tokens Groq usados por fatura, nº de correções manuais por semana.

## 4. Fluxo de trabalho

1. `git status` + `git log --oneline -5`
2. Ler `.scratch/feat-category-learning/issue.md` e `.scratch/PARALLEL_EXECUTION.md`
3. **Confirmar que NENHUM outro agente está ativo** (você trava o repo pra esta issue)
4. Confirmar dependências mergeadas:
   - Onda 0: `feat-async-invoice-processing`, `feat-transaction-edit`
   - Onda A: 1A, 1D, 4C
   - Onda B: 1B, 1C
   - Onda C: 4B
5. Implementar em ordem:
   1. `normalizer.py` (função pura) + testes básicos se possível
   2. `rules.py` (load/save/apply)
   3. `models.py::Rule`, `db.py` helpers
   4. Integrar no pipeline de `invoices/handler.py`
   5. Nova Lambda `rules/handler.py` + rotas
   6. Frontend: hooks + `CategoryEditDialog` + `RulesPage` + integração no `TransactionList`
6. `cd frontend && npm run build`
7. Regenerar layer (§3)
8. `notes.md` com decisões (ex: regra de match — token exato após normalização, não substring)
9. Commits atômicos: `feat(rules): normalizer`, `feat(rules): pipeline pre-categorize`, `feat(rules): dialog de escopo`, etc.

## 5. Definição de pronto

- [ ] Arquivos da issue tocados
- [ ] Nenhum arquivo fora da lista
- [ ] Fluxo: editar categoria → escolher escopo (single/future/past+future) → regra criada → próximo upload aplica
- [ ] Página `/rules` funcional (list, edit, delete)
- [ ] Retrocompat: usuário sem regras funciona normal
- [ ] `npm run build` passa
- [ ] Imports backend OK
- [ ] Layer regenerada
- [ ] Commits atômicos
- [ ] `notes.md` preenchido, incluindo métricas antes/depois se possível

## 6. Se travar

Pare e reporte. NUNCA rode git reset --hard, delete branches, force push, ou --no-verify por conta própria.
