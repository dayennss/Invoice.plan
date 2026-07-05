# Agent brief — feat-share-readonly-link (Onda A)

Você é um agente de implementação para o projeto **invoice.plan** (SaaS de gestão financeira pessoal, stack serverless AWS + React + TanStack Query + Groq/Llama). Sua missão é implementar UMA issue específica dentro das regras de coordenação já definidas no repo.

## 1. Sua missão

Ler e implementar a issue em: `.scratch/feat-share-readonly-link/issue.md`

Feature 4C — link público read-only pro dashboard mensal. Usuário gera token, escolhe modo (completo com valores ou anônimo só com percentuais) e expiração. Página `/s/:token` renderiza sem login. Também dá pra revogar.

Trate a issue como especificação: siga UX, modelo de dados, backend, arquivos afetados e "fora do escopo" à risca.

## 2. Coordenação obrigatória

Leia por completo `.scratch/PARALLEL_EXECUTION.md`. Você está na **Onda A** — é a issue mais isolada da onda.

Outros agentes possíveis rodando em paralelo: **1A (feat-monthly-comparison)** e **1D (feat-duplicate-detector)**.

Pontos de atenção específicos desta issue:
- Em `db.py`, adiciona apenas `share_sk()` + helper de lookup por token. **Não** toca em queries de invoice/transaction/summary.
- Em `DashboardPage.tsx`, adiciona botão "Compartilhar" no header do mês (junto ao "Exportar CSV" que já existe). Não alterar estrutura do resto da página.
- Em `App.tsx`, adiciona rota `/s/:token` **fora** do guard de autenticação. Cuidado com o wrapper de `AuthProvider`.
- Em `types/index.ts`, tipo `Share` no fim.
- Em `infra/stacks/api_stack.py`, bloco `# --- feat-share-readonly-link (4C) ---`. **Atenção**: a rota `GET /public/share/{token}` precisa ser configurada **sem authorizer** (única rota pública do projeto). Documentar bem no PR.

**Decisão arquitetural a tomar (documentar em `notes.md`):** snapshot vs live?
- **Recomendado**: snapshot. Persistir `payload_json` no item de share no momento de criação. Protege privacidade e evita mudança em tempo real.

**Arquivos exclusivos seus (zero risco):**
- `backend/functions/shares/handler.py`
- `backend/functions/public/handler.py`
- `frontend/src/hooks/useShares.ts`, `usePublicShare.ts`
- `frontend/src/components/ShareDialog.tsx`
- `frontend/src/pages/PublicDashboardPage.tsx`, `SharesPage.tsx`

## 3. Convenções do projeto

Layer Python: esta issue **provavelmente não toca** `backend/shared/` (só helpers em `db.py`). Se tocar, ao final:

```powershell
Remove-Item -Recurse -Force backend/layer/python/shared
Copy-Item -Recurse backend/shared backend/layer/python/shared
```

Documente em `notes.md` que precisa `cdk deploy InvoicePlanApi` (rotas novas) e `cdk deploy InvoicePlanFrontend` (rota `/s/*`).

**Não rode `cdk deploy`** você mesmo.

**Estilo:**
- Token: 128-bit random hex via `secrets.token_hex(16)`
- No modo anônimo, **remover descrições completamente** (só categoria + %) — descrições revelam demais mesmo sem valor
- Header `X-Robots-Tag: noindex` + `robots.txt` pra `/s/*` (evitar indexação)
- Sem comentários redundantes. Preserve PT-BR em rótulos, EN em código

## 4. Fluxo de trabalho

1. `git status` + `git log --oneline -5`
2. Ler `.scratch/feat-share-readonly-link/issue.md` e `.scratch/PARALLEL_EXECUTION.md`
3. Confirmar que **Onda 0** está mergeada
4. Rascunhar em `notes.md` a decisão snapshot vs live e o layout do item Dynamo
5. Implementar em ordem:
   1. `db.py` — helpers de share
   2. `backend/functions/shares/handler.py` — CRUD privado (Firebase auth)
   3. `backend/functions/public/handler.py` — endpoint público
   4. Infra: rotas + configuração sem authorizer pra `/public/*`
   5. Frontend: hooks + `ShareDialog` + `SharesPage` + botão no `DashboardPage`
   6. Rota `/s/:token` + `PublicDashboardPage` (reusa componentes com `readOnly`)
6. `cd frontend && npm run build`
7. Regenerar layer se aplicável (§3)
8. `notes.md` com decisões (snapshot vs live, política de expiração, headers noindex)
9. Commits: `feat(shares): CRUD privado`, `feat(shares): endpoint público`, `feat(shares): página pública read-only`, etc.

## 5. Definição de pronto

- [ ] Arquivos da issue tocados
- [ ] Nenhum arquivo fora da lista
- [ ] Rota `/public/share/{token}` responde SEM authorizer
- [ ] Rota `/s/:token` renderiza sem exigir login
- [ ] Modo anônimo: sem valores absolutos, sem descrições
- [ ] Expiração respeitada (token expirado retorna 410 Gone)
- [ ] Revogação funciona (`revoked: true`)
- [ ] Página `/shares` lista + revoga
- [ ] Header `noindex` presente
- [ ] `npm run build` passa
- [ ] Imports backend OK
- [ ] Layer regenerada (se tocou)
- [ ] Commits atômicos
- [ ] `notes.md` preenchido

## 6. Se travar

Pare e reporte. NUNCA rode git reset --hard, delete branches, force push, ou --no-verify por conta própria. Configurar rota API Gateway sem authorizer requer atenção — se o `api_stack.py` não expõe o mecanismo, pare e reporte antes de improvisar.
