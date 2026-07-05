# Agent brief — feat-expense-split (Onda C)

Você é um agente de implementação para o projeto **invoice.plan** (SaaS de gestão financeira pessoal, stack serverless AWS + React + TanStack Query + Groq/Llama). Sua missão é implementar UMA issue específica dentro das regras de coordenação já definidas no repo.

## 1. Sua missão

Ler e implementar a issue em: `.scratch/feat-expense-split/issue.md`

Feature 4B — split de despesa. Usuário divide uma transação com outras pessoas (strings livres — sem conta no app), vê agregado "contas a receber" e marca como pago.

Trate a issue como especificação: siga UX, modelo de dados, backend, arquivos afetados e "fora do escopo" à risca.

## 2. Coordenação obrigatória

Leia por completo `.scratch/PARALLEL_EXECUTION.md`. Você está na **Onda C** — roda SOZINHO na onda. Nenhum outro agente ativo.

Pontos de atenção específicos desta issue:
- Em `models.py::Transaction`, adicione `splits: Optional[list[Split]] = None` e `share_amount: Optional[float] = None`. Esse bloco vem **depois** dos campos de 1D (flags) — ver §5 do mapa mestre.
- Em `types/index.ts`, adicione tipo `Split` e campos `splits?`, `share_amount?` em `Transaction` no fim.
- `SUMMARY#{ym}` passa a ser calculado com `share_amount or amount`. Verificar se `feat-async-invoice-processing` (Onda 0) usa o valor certo.
- Em `TransactionList.tsx`, adicione badge `⇢ Ana +50%` e troque valor exibido pra `share_amount` quando presente. **Não** mexer em edição de categoria (é de `feat-transaction-edit` / `feat-category-learning`) nem em flags (de 1D).
- Em `App.tsx` e `AppHeader.tsx`, adicionar rota `/receivables` e link.
- Em `infra/stacks/api_stack.py`, bloco `# --- feat-expense-split (4B) ---` no fim.

**Arquivos exclusivos seus (zero risco):**
- `backend/shared/splits.py`
- `backend/functions/transactions/handler.py`
- `frontend/src/components/SplitDialog.tsx`, `PersonAutocomplete.tsx`
- `frontend/src/pages/ReceivablesPage.tsx`
- `frontend/src/hooks/useUpdateSplits.ts`, `useMarkSplitPaid.ts`, `useReceivables.ts`, `usePeople.ts`

## 3. Convenções do projeto

Layer Python: esta issue **cria `backend/shared/splits.py`** e altera `models.py`. Ao final:

```powershell
Remove-Item -Recurse -Force backend/layer/python/shared
Copy-Item -Recurse backend/shared backend/layer/python/shared
```

Documente em `notes.md` que precisa `cdk deploy InvoicePlanApi`.

**Não rode `cdk deploy`** você mesmo.

**Estilo:**
- `compute_share_amount(amount, splits) -> float` deve ser função pura testável
- Regra de arredondamento explícita: valor do "eu" é `total - soma(outros)` pra fechar exato
- Normalização de nome no autocomplete (upper + trim) — não gerar 3 pessoas de "Ana"/"ana"/"Aninha"
- Sem comentários redundantes. Preserve PT-BR em rótulos, EN em código

## 4. Fluxo de trabalho

1. `git status` + `git log --oneline -5`
2. Ler `.scratch/feat-expense-split/issue.md` e `.scratch/PARALLEL_EXECUTION.md`
3. Confirmar que **Ondas 0, A e B** estão mergeadas
4. Implementar em ordem:
   1. `backend/shared/splits.py` — funções puras
   2. `models.py::Split` + campos em `Transaction`
   3. `backend/functions/transactions/handler.py` — endpoints
   4. `db.py` — `get_receivables()`, sem tocar em queries existentes
   5. Frontend: hooks, `SplitDialog`, `PersonAutocomplete`, `ReceivablesPage`, integração no `TransactionList`
5. `cd frontend && npm run build`
6. Regenerar layer (§3)
7. `notes.md` com decisões (ex: como resolver arredondamento, formato do autocomplete)
8. Commits: `feat(splits): dividir transação`, `feat(splits): página contas a receber`, etc.

## 5. Definição de pronto

- [ ] Arquivos da issue tocados
- [ ] Nenhum arquivo fora da lista
- [ ] Dividir transação por % ou valor fixo funciona
- [ ] Summary do mês recalcula com `share_amount`
- [ ] Retrocompat: transações antigas sem `splits` seguem funcionando
- [ ] Página `/receivables` agrega por pessoa e permite marcar pago
- [ ] `npm run build` passa
- [ ] Imports backend OK
- [ ] Layer regenerada
- [ ] Commits atômicos
- [ ] `notes.md` preenchido

## 6. Se travar

Pare e reporte. NUNCA rode git reset --hard, delete branches, force push, ou --no-verify por conta própria.
