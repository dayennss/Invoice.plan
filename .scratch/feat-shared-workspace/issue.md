---
title: "Feature: workspace compartilhado (casal/família)"
labels: [needs-triage]
status: open
created: 2026-07-04
priority: P3
effort: alto
group: colaboracao
---

## Contexto

Muita gestão financeira é feita em conjunto (casal, família). Hoje cada Firebase user tem seu Dynamo isolado. Casal quer: cada um faz upload da sua fatura, mas dashboard consolidado. Esta é uma mudança estrutural — introduz o conceito de **workspace** entre o usuário e os dados.

**Não fazer sem antes:** ter `feat-expense-split` funcionando (permite operações menos invasivas de compartilhamento) e ter estabilidade no schema atual.

## O que construir

Um usuário pode criar/entrar em um workspace com outros usuários. Todos os dados (invoices, transactions, summaries) passam a viver sob `WORKSPACE#{id}` em vez de `USER#{id}`. O usuário mantém um `PROFILE` individual (preferências, regras).

## UX

### Onboarding no primeiro login (sem breaking)

Ao logar pela primeira vez, cria-se automaticamente um workspace pessoal `WS-{uuid}` com o próprio usuário como owner. Do ponto de vista do UX inicial, nada muda.

### Página "Workspace"

Nova aba em configurações:

```
┌─────────────────────────────────────────────┐
│ Workspace: "Casa da Ana"                    │
│                                             │
│ Membros (2)                                 │
│  👤 Ana Silva (você)             owner      │
│  👤 João Silva                    member    │
│                                             │
│ [+ Convidar por email]                      │
│                                             │
│ Convites pendentes (1)                      │
│  📧 pedro@email.com  enviado ontem  [x]     │
│                                             │
│ ⚠️ Sair do workspace                        │
└─────────────────────────────────────────────┘
```

### Fluxo de convite

1. Owner clica "Convidar por email"
2. Backend cria item `INVITE#{token}` com TTL 7 dias
3. Envia email (SES — nova dependência) com link `/join?token=xyz`
4. Convidado faz login com Google → aceita → é migrado pro workspace

### Indicador visual "de quem veio"

Cada transação passa a ter avatar/inicial do membro que fez upload:

```
07/07  Uber Eats      R$ 48   🍔   👤A
07/07  Amazon         R$ 89   📦   👤J
```

Filtro no `TransactionList`: "Todos / Ana / João".

### Mudança de workspace

Dropdown no `AppHeader` pra alternar entre workspaces (usuário pode participar de vários — ex: casal + família dos pais).

## Modelo de dados

### Antes

```
PK: USER#{firebase_uid}
SK: INVOICE#... | TRANSACTION#... | SUMMARY#... | PROFILE
```

### Depois

```
PK: WORKSPACE#{ws_id}
SK: INVOICE#{ym}#{id}    (com uploaded_by: user_id)
    TRANSACTION#{ym}#{id} (com uploaded_by: user_id)
    SUMMARY#{ym}
    MEMBER#{user_id}      (role: owner|member, joined_at)
    INVITE#{token}         (email, invited_by, ttl)

PK: USER#{firebase_uid}
SK: PROFILE                  (mantém preferências individuais)
    WORKSPACE#{ws_id}         (index reverso: workspaces do user)
```

### GSI necessário

Para email → invite lookup, precisamos de um GSI (`GSI1PK: EMAIL#{email}`, `GSI1SK: INVITE#{token}`).

## Migração

**Crítico.** Existe usuário em produção. Estratégia:

1. Deploy do código novo tolerante aos DOIS schemas (lê `USER#` e `WORKSPACE#`).
2. Script de migração: para cada `USER#{id}`, cria `WORKSPACE#{new_id}` correspondente com membership.
3. Duplica os items (não move — permite rollback). Frontend passa a preferir workspace.
4. Após 30 dias sem regressão, script apaga `USER#` legado (exceto `PROFILE`).

Documentar detalhadamente em `notes.md` da issue quando implementar.

## Backend

### Novos endpoints

- `GET /workspaces` — workspaces que o user participa
- `POST /workspaces` — criar novo (para famílias adicionais)
- `PUT /workspaces/{id}` — renomear
- `POST /workspaces/{id}/invites` — convidar
- `DELETE /workspaces/{id}/invites/{token}` — cancelar
- `POST /invites/{token}/accept` — aceitar (usa auth do convidado)
- `POST /workspaces/{id}/leave` — sair

### Autorização

Middleware em toda rota: extrair `workspace_id` do path/header, verificar que o usuário autenticado é membro. Nova helper `require_workspace_member(user_id, ws_id) -> role`.

### Email

Precisa integração SES. Setup: dominio verificado (usar Firebase project domain?), template básico HTML. Custo trivial ($0.10 / 1k emails).

## Frontend

- `<WorkspaceSwitcher>` no `AppHeader`
- Página `<WorkspaceSettingsPage>`
- Fluxo `/join?token=xyz` (nova rota, aceita convite)
- Hook `useWorkspaces`, `useInvites`
- Todos os hooks existentes passam a incluir `workspaceId` implícito
- `<MemberAvatar>` renderizado em transactions

## Dependências

- Requer estabilidade do schema atual
- `feat-expense-split` como precursor (aprende como lidar com "quem gastou o quê")
- Ativa uso mais rico de `feat-smart-alerts` (alerta "João já gastou 60% da meta compartilhada")

## Riscos / gotchas

- **Data model refactor massivo.** Toda query/write do backend precisa ser reescrita. Tempo estimado só do backend: 3-5 dias focados.
- **Privacidade**: um membro consegue ver transações do outro. Deixar explícito no aceite do convite.
- **Firebase auth**: convite por email precisa checar se o email já tem conta Firebase; se não tiver, fluxo é "faça login com Google usando este email".
- **Cobrança/freemium**: workspace com 2 membros deveria contar como 1 assinatura ou 2? (definir quando entrar no freemium).

## Arquivos afetados

Praticamente todo o backend + partes do frontend. Alta lista.

**Backend:**
- `backend/shared/db.py` — key helpers novos, todas as queries
- `backend/shared/models.py` — modelos `Workspace`, `Member`, `Invite`
- `backend/shared/auth.py` — helper `require_workspace_member`
- `backend/shared/email.py` — **novo**, SES sender
- `backend/functions/invoices/handler.py` — usar `workspace_id`
- `backend/functions/dashboard/handler.py` — idem
- `backend/functions/workspaces/handler.py` — **nova lambda**
- `backend/functions/invites/handler.py` — **nova lambda**

**Infra:**
- `infra/stacks/api_stack.py` — rotas novas + GSI + IAM SES + verified identity
- `infra/stacks/storage_stack.py` — GSI1

**Frontend:**
- `frontend/src/hooks/useWorkspaces.ts` — **novo**
- `frontend/src/hooks/useInvites.ts` — **novo**
- `frontend/src/components/WorkspaceSwitcher.tsx` — **novo**
- `frontend/src/components/MemberAvatar.tsx` — **novo**
- `frontend/src/pages/WorkspaceSettingsPage.tsx` — **novo**
- `frontend/src/pages/JoinWorkspacePage.tsx` — **novo**
- `frontend/src/App.tsx` — rotas novas
- Todos hooks existentes — passar `workspace_id`
- `frontend/src/lib/api.ts` — refactor pra injetar workspace no path

## Coordenação com outros agentes

Ver mapa mestre em [`.scratch/PARALLEL_EXECUTION.md`](../PARALLEL_EXECUTION.md).

**Onda:** D2 (roda por último e sozinho — TRAVA O REPO).

**Por quê trava o repo:** refatora a **PK** de TODOS os itens Dynamo (`USER#` → `WORKSPACE#`). Todo handler backend, todo hook frontend, toda query precisa ser reescrita. Rodar em paralelo com qualquer outra feature garante conflitos irreversíveis.

**Regra de despacho:**
- Todas as outras issues (Ondas 0, A, B, C, D1) devem estar **100% mergeadas e testadas em produção** antes.
- Nenhum outro agente pode ter branch aberta enquanto esta rodar.
- Merge freeze de tudo mais durante a execução.

**Arquivos afetados (praticamente todos os quentes):**

| Arquivo | Impacto |
|---|---|
| `backend/functions/invoices/handler.py` | Reescrever queries pra `WORKSPACE#` |
| `backend/functions/dashboard/handler.py` | Reescrever |
| `backend/functions/*/handler.py` (todas as lambdas existentes) | Reescrever |
| `backend/shared/db.py` | Refactor massivo dos key helpers |
| `backend/shared/models.py` | Adicionar `Workspace`, `Member`, `Invite`; adicionar `uploaded_by` em `Transaction` e `Invoice` |
| `infra/stacks/api_stack.py` | GSI novo, IAM SES, verified identity, rotas novas |
| `infra/stacks/storage_stack.py` | GSI1 na tabela |
| Todos os hooks frontend | Injetar `workspace_id` no path/header |
| `frontend/src/lib/api.ts` | Middleware pra prefixar workspace |

**Migração (bloqueante):**
- Documentar em `notes.md` da issue antes de rodar
- Deploy do código **tolerante aos DOIS schemas** (USER# e WORKSPACE#) primeiro
- Script de migração dedicado
- Validação de dados em ambiente staging (se existir) ou em fixture de produção
- Rollback plan explícito

**Após merge:** regenerar layer + deploy full + monitorar CloudWatch por 48h.

## Fora do escopo

- Permissões granulares (só owner/member por ora)
- Notificação de atividade de outros membros
- Workspace com > 5 membros (sem otimização de performance nesta versão)
