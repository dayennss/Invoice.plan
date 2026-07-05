# Agent brief — feat-duplicate-detector (Onda A)

Você é um agente de implementação para o projeto **invoice.plan** (SaaS de gestão financeira pessoal, stack serverless AWS + React + TanStack Query + Groq/Llama). Sua missão é implementar UMA issue específica dentro das regras de coordenação já definidas no repo.

## 1. Sua missão

Ler e implementar a issue em: `.scratch/feat-duplicate-detector/issue.md`

Feature 1D — detecção heurística de duplicatas, merchant novo e valor atípico. Flags salvas na transação, badges na `TransactionList`, dismiss por clique.

Trate a issue como especificação: siga UX, regras de detecção, modelo de dados, backend, arquivos afetados e "fora do escopo" à risca.

## 2. Coordenação obrigatória

Leia por completo `.scratch/PARALLEL_EXECUTION.md`. Você está na **Onda A**.

Outros agentes possíveis rodando em paralelo: **1A (feat-monthly-comparison)** e **4C (feat-share-readonly-link)**.

Pontos de atenção específicos desta issue:
- Você **adiciona 1 chamada** no pipeline de invoice: `transactions = flag_transactions(transactions, history)`. **Não** refatorar outras funções em `invoices/handler.py`.
- Em `backend/shared/models.py`, adicione **apenas** `flags: list[str] = []` e `flags_dismissed: list[str] = []` na classe `Transaction`. **Esse bloco vem primeiro** após os campos existentes (§5 do mapa mestre).
- Em `types/index.ts`, adicione `flags?: string[]` e `flags_dismissed?: string[]` em `Transaction`, no fim do bloco.
- Em `TransactionList.tsx`, adicione renderização de `<TransactionFlagBadge>` e chip de filtro no header. NÃO mexer na mecânica de edição de categoria (é de `feat-transaction-edit`).
- Em `infra/stacks/api_stack.py`, bloco `# --- feat-duplicate-detector (1D) ---` com `POST /transactions/{id}/dismiss-flag`.

**Arquivos exclusivos seus (zero risco):**
- `backend/shared/flag_detector.py`
- `frontend/src/components/TransactionFlagBadge.tsx`
- `frontend/src/hooks/useDismissFlag.ts`

## 3. Convenções do projeto

Layer Python: esta issue **cria `backend/shared/flag_detector.py`** e altera `models.py`. Ao final:

```powershell
Remove-Item -Recurse -Force backend/layer/python/shared
Copy-Item -Recurse backend/shared backend/layer/python/shared
```

Documente em `notes.md` que precisa `cdk deploy InvoicePlanApi`.

**Não rode `cdk deploy`** você mesmo.

**Estilo:** função de normalização de merchant deve ser pura e testável (mesma vai reusar em `feat-category-learning` no futuro). Sem comentários redundantes. Preserve PT-BR em rótulos, EN em código.

## 4. Fluxo de trabalho

1. `git status` + `git log --oneline -5`
2. Ler `.scratch/feat-duplicate-detector/issue.md` e `.scratch/PARALLEL_EXECUTION.md`
3. Confirmar que **Onda 0** (`feat-async-invoice-processing`, `feat-transaction-edit`) está mergeada
4. Implementar `backend/shared/flag_detector.py` com 3 regras isoladas
5. Adicionar campos em `models.py::Transaction`
6. Integrar `flag_transactions()` no pipeline do invoice
7. Adicionar `POST /transactions/{id}/dismiss-flag`
8. Frontend: badge + chip de filtro + hook
9. `cd frontend && npm run build`
10. Regenerar layer (§3)
11. `notes.md` com decisões (ex: threshold de "atypical_amount")
12. Commits: `feat(flags): detector de duplicatas`, `feat(flags): badge na lista`, etc.

## 5. Definição de pronto

- [ ] Arquivos da issue tocados
- [ ] Nenhum arquivo fora da lista
- [ ] 3 regras (`duplicate_suspect`, `new_merchant`, `atypical_amount`) implementadas
- [ ] Retrocompat: transações antigas sem `flags` funcionam
- [ ] Dismiss persiste (flag some pra sempre)
- [ ] `npm run build` passa
- [ ] Imports backend OK
- [ ] Layer regenerada
- [ ] Commits atômicos
- [ ] `notes.md` preenchido

## 6. Se travar

Pare e reporte. NUNCA rode git reset --hard, delete branches, force push, ou --no-verify por conta própria.
