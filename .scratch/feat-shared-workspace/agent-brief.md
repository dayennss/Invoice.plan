# Agent brief — feat-shared-workspace (Onda D2 — TRAVA O REPO)

Você é um agente de implementação para o projeto **invoice.plan** (SaaS de gestão financeira pessoal, stack serverless AWS + React + TanStack Query + Groq/Llama). Sua missão é implementar UMA issue específica dentro das regras de coordenação já definidas no repo.

## ⚠️ AVISO — LEIA ANTES DE COMEÇAR

Esta é a issue **mais estrutural** do roadmap. Refatora a PK do Dynamo (`USER#` → `WORKSPACE#`) e afeta praticamente todo backend + hooks frontend. É a **última** onda por design.

**Antes de começar, confirme com o owner:**
- Todas as outras issues (Ondas 0, A, B, C, D1) estão mergeadas e em produção
- Nenhum outro agente tem branch aberta
- Merge freeze declarado
- Existe backup do DynamoDB `invoice-plan` recente

Se qualquer condição acima não estiver satisfeita, **pare e reporte antes de tocar código**.

## 1. Sua missão

Ler e implementar a issue em: `.scratch/feat-shared-workspace/issue.md`

Feature 4A — workspace compartilhado (casal/família). Usuário convida outro por email, ambos veem mesmo dashboard/invoices, cada transação mostra quem fez upload.

## 2. Coordenação obrigatória

Leia por completo `.scratch/PARALLEL_EXECUTION.md`. Você está na **Onda D2**.

Esta issue **é incompatível com qualquer paralelismo**. Nenhum outro agente pode estar ativo.

Escopo do refactor:
- **Backend:** todo `db.py` reescrito. Todos os handlers (invoices, dashboard, transactions, alerts, shares, etc.) reescritos pra usar `workspace_id`. Novos handlers `workspaces/` e `invites/`.
- **Infra:** GSI1 na tabela (`GSI1PK: EMAIL#`, `GSI1SK: INVITE#`), IAM para SES, verified identity, rotas novas.
- **Frontend:** todos os hooks passam a incluir `workspace_id` implícito, novo `<WorkspaceSwitcher>`, novo `<MemberAvatar>` em transactions, filtro por membro, páginas de settings e join.
- **Migração:** deploy do código **tolerante aos DOIS schemas** primeiro. Depois script separado migra dados. Depois janela de 30 dias antes de deletar `USER#` legado.

**Arquivos exclusivos seus:**
- `backend/shared/email.py` (SES sender)
- `backend/functions/workspaces/handler.py`, `backend/functions/invites/handler.py`
- `frontend/src/hooks/useWorkspaces.ts`, `useInvites.ts`
- `frontend/src/components/WorkspaceSwitcher.tsx`, `MemberAvatar.tsx`
- `frontend/src/pages/WorkspaceSettingsPage.tsx`, `JoinWorkspacePage.tsx`

## 3. Convenções do projeto

Layer Python: **massiva alteração** em `backend/shared/`. Ao final:

```powershell
Remove-Item -Recurse -Force backend/layer/python/shared
Copy-Item -Recurse backend/shared backend/layer/python/shared
```

Documente em `notes.md`:
- Ordem de deploy
- Script de migração (código + dry-run + como rodar em prod)
- Rollback plan explícito
- Comandos do owner pós-merge

**Não rode `cdk deploy` nem o script de migração** você mesmo.

**Estilo:**
- Helper `require_workspace_member(user_id, ws_id) -> role` em `backend/shared/auth.py` — todo handler usa
- Zero código morto: se refactor deixa função órfã, remova
- Preserve PT-BR em rótulos de UI e emails, EN em código

## 4. Fluxo de trabalho

1. `git status` + `git log --oneline -5` + `git branch --all`
2. Ler `.scratch/feat-shared-workspace/issue.md` inteiro
3. Confirmar dependências §"AVISO"
4. Rascunhar em `.scratch/feat-shared-workspace/notes.md` **antes de codar**:
   - Ordem de migração
   - Contrato do dual-schema (como `db.py` lê ambos)
   - Rotas afetadas e ordem de reescrita
   - Plano de rollback
5. Implementar em ordem:
   1. Modelos novos (`Workspace`, `Member`, `Invite`)
   2. `db.py` — key helpers duais (USER# e WORKSPACE#), leitura tolerante
   3. Handlers backend — um por vez, com testes de imports após cada
   4. Novo `email.py` + integração SES
   5. Infra: GSI + SES + rotas
   6. Frontend hooks — refactor pra injetar workspace
   7. Componentes novos + páginas
   8. Fluxo de convite
6. `cd frontend && npm run build`
7. Regenerar layer
8. Script de migração em `scripts/migrate-user-to-workspace.py` (separado do deploy)
9. Commits em lotes lógicos: `refactor(db): dual-schema USER/WORKSPACE`, `feat(workspaces): CRUD`, `feat(invites): fluxo de aceite`, etc.

## 5. Definição de pronto

- [ ] Backend dual-schema — lê `USER#` e `WORKSPACE#` sem quebrar
- [ ] Todos os handlers migrados
- [ ] Novo fluxo de convite funcional (send → email → accept)
- [ ] Frontend renderiza `<WorkspaceSwitcher>` no header
- [ ] Filtro por membro em `TransactionList`
- [ ] Página de settings (invite, revoke, leave)
- [ ] Script de migração escrito, testado em dry-run
- [ ] `notes.md` completo com rollback plan
- [ ] `npm run build` passa
- [ ] Imports backend OK
- [ ] Layer regenerada
- [ ] Commits atômicos por lote lógico

## 6. Se travar

Pare e reporte imediatamente. **Nenhuma decisão destrutiva** por conta própria (git reset --hard, delete branches, force push, --no-verify, drop table). Esta issue tem risco de perda de dados irreversível — segurança > velocidade.
