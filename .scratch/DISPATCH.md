# Playbook de disparo — invoice.plan

Ordem cronológica de disparo dos agentes. Cada mensagem é **curta e pontual** — o detalhe fica no `agent-brief.md` da issue (que é longo e completo). O agente só precisa dessa mensagem curta pra saber por onde começar.

**Como usar:**
1. Confirmar que a onda anterior está mergeada em `main` e testada
2. Copiar a mensagem da seção correspondente
3. Enviar como prompt inicial pro agente (via `Agent` tool, worktree novo, etc.)
4. Anotar branch/agente na tabela final desta doc
5. Aguardar merge antes de disparar a próxima onda

---

## Onda 0 — sequencial

Rodar 0.1 **primeiro**. Só disparar 0.2 depois que 0.1 estiver mergeado em `main`.

### 🎯 Onda 0.1 — feat-async-invoice-processing

```
Você é um agente de implementação para o projeto invoice.plan.

Sua missão: implementar a issue `feat-async-invoice-processing` (Onda 0, sequencial).

INSTRUÇÃO OBRIGATÓRIA — leia INTEGRALMENTE, na ordem, antes de tocar código:
1. `.scratch/feat-async-invoice-processing/issue.md` (a especificação da feature)
2. `.scratch/PARALLEL_EXECUTION.md` (regras de coordenação — Onda 0)
3. `CLAUDE.md` (convenções do projeto)

Você está SOZINHO nesta onda. Nenhum outro agente ativo. Este é um refactor
estrutural do `backend/functions/invoices/handler.py` — split entre HTTP handler
e async worker via `boto3.client('lambda').invoke(InvocationType='Event')`.

Regras críticas:
- Nunca reescreva arquivos inteiros. Use Edit cirúrgico. Write só pra arquivos
  novos.
- Não rode `cdk deploy` — deixe pra revisão manual, documente comandos em
  `notes.md`.
- Se `backend/shared/` for alterado, regenerar layer no fim (comandos em §3 do
  brief).
- Se algo travar ou for ambíguo, pare e reporte — não invente e nunca use
  git reset --hard, force push ou --no-verify.

Fluxo:
1. git status + git log --oneline -5
2. Ler os 3 arquivos acima
3. Implementar
4. Testar: cd frontend && npm run build; imports Python
5. Regenerar layer se aplicável
6. Commits atômicos padrão `feat(async): ...`, `infra(api): ...`
7. Registrar decisões em `.scratch/feat-async-invoice-processing/notes.md`

Reporte ao final: arquivos tocados, comandos de deploy pendentes, riscos.
```

### 🎯 Onda 0.2 — feat-transaction-edit

**Só disparar após 0.1 estar mergeado.**

```
Você é um agente de implementação para o projeto invoice.plan.

Sua missão: implementar a issue `feat-transaction-edit` (Onda 0, sequencial).

INSTRUÇÃO OBRIGATÓRIA — leia INTEGRALMENTE, na ordem, antes de tocar código:
1. `.scratch/feat-transaction-edit/issue.md`
2. `.scratch/PARALLEL_EXECUTION.md` (você está na Onda 0)
3. `CLAUDE.md`

Confirme antes de começar: `feat-async-invoice-processing` está mergeada em
main? Se não, pare e reporte.

Você está SOZINHO nesta onda. Edição inline de categoria — introduz mecânica
usada depois por 1D, 1E, 4B. Adiciona `PATCH /transactions/{id}` e recalcula
summary do mês.

Regras críticas:
- Nunca reescreva arquivos inteiros. Edit cirúrgico. Write só pra novos.
- Não rode `cdk deploy` — documente em `notes.md`.
- Regenerar layer se `backend/shared/` mudou.
- Se travar, pare e reporte. Sem git reset --hard, force push, --no-verify.

Fluxo:
1. git status + git log --oneline -5
2. Ler os 3 arquivos
3. Implementar backend + hook + edição inline no TransactionList
4. Testar: npm run build; imports Python
5. Regenerar layer se aplicável
6. Commits `feat(transactions): PATCH categoria`, etc.
7. Notes em `.scratch/feat-transaction-edit/notes.md`

Reporte ao final: arquivos tocados, comandos de deploy pendentes, riscos.
```

---

## Onda A — 3 agentes em paralelo

**Só disparar depois que Onda 0 estiver 100% mergeada.**
Os 3 agentes abaixo podem ser disparados **simultaneamente**, em worktrees separadas.

### 🎯 Onda A1 — feat-monthly-comparison

```
Você é um agente de implementação para o projeto invoice.plan.

Sua missão: implementar a issue `feat-monthly-comparison` (1A, Onda A, paralelo).

INSTRUÇÃO OBRIGATÓRIA — leia INTEGRALMENTE, na ordem:
1. `.scratch/feat-monthly-comparison/agent-brief.md` (contexto completo)
2. `.scratch/feat-monthly-comparison/issue.md` (spec)
3. `.scratch/PARALLEL_EXECUTION.md` (você está na Onda A junto com 1D e 4C)

Confirme antes: Onda 0 (feat-async-invoice-processing, feat-transaction-edit)
está mergeada?

Nesta onda rodam em paralelo com você: 1D (feat-duplicate-detector) e
4C (feat-share-readonly-link). NÃO edite arquivos fora da sua lista. Se
precisar tocar em hotspot (dashboard/handler.py, DashboardPage.tsx, types),
siga o contrato da §5 do mapa mestre (extensão em bloco isolado, sem
reorganizar).

Regras críticas:
- Edit cirúrgico. Write só pra arquivos novos.
- Antes de cada Edit, sempre Read (outro agente pode ter tocado).
- Não rode `cdk deploy`.
- Se travar, pare e reporte. Sem git reset --hard, force push, --no-verify.

Reporte ao final: arquivos tocados, decisões em notes.md, riscos.
```

### 🎯 Onda A2 — feat-duplicate-detector

```
Você é um agente de implementação para o projeto invoice.plan.

Sua missão: implementar a issue `feat-duplicate-detector` (1D, Onda A, paralelo).

INSTRUÇÃO OBRIGATÓRIA — leia INTEGRALMENTE, na ordem:
1. `.scratch/feat-duplicate-detector/agent-brief.md`
2. `.scratch/feat-duplicate-detector/issue.md`
3. `.scratch/PARALLEL_EXECUTION.md` (você está na Onda A junto com 1A e 4C)

Confirme antes: Onda 0 mergeada?

Nesta onda rodam em paralelo: 1A (feat-monthly-comparison) e
4C (feat-share-readonly-link). Seu impacto crítico: adiciona campos em
Transaction (models.py + types/index.ts). Bloco reservado a 1D vem PRIMEIRO
após campos existentes — ver §5 do mapa mestre. Adiciona 1 chamada no
pipeline de invoices/handler.py, sem refatorar outras funções.

Regras críticas:
- Edit cirúrgico. Write só pra arquivos novos.
- Antes de cada Edit, sempre Read (outro agente pode ter tocado).
- Regenerar layer no fim — você toca backend/shared/models.py e cria
  backend/shared/flag_detector.py.
- Não rode `cdk deploy`.
- Se travar, pare e reporte. Sem git reset --hard, force push, --no-verify.

Reporte ao final: arquivos tocados, decisões em notes.md, riscos.
```

### 🎯 Onda A3 — feat-share-readonly-link

```
Você é um agente de implementação para o projeto invoice.plan.

Sua missão: implementar a issue `feat-share-readonly-link` (4C, Onda A, paralelo).

INSTRUÇÃO OBRIGATÓRIA — leia INTEGRALMENTE, na ordem:
1. `.scratch/feat-share-readonly-link/agent-brief.md`
2. `.scratch/feat-share-readonly-link/issue.md`
3. `.scratch/PARALLEL_EXECUTION.md` (você está na Onda A junto com 1A e 1D)

Confirme antes: Onda 0 mergeada?

Nesta onda rodam em paralelo: 1A e 1D. Sua issue é a mais isolada da onda —
só cria arquivos novos + adiciona helpers em db.py + rotas API isoladas.
ATENÇÃO ESPECIAL: você adiciona rota `GET /public/share/{token}` SEM
authorizer — única rota pública do projeto. Documente com destaque no PR e
em notes.md.

Decisão arquitetural a tomar e documentar em notes.md: snapshot vs live
(recomendação do brief: snapshot). Faça isso antes de codar o handler.

Regras críticas:
- Edit cirúrgico. Write só pra arquivos novos.
- Antes de cada Edit, sempre Read.
- Não rode `cdk deploy`.
- Se `api_stack.py` não expõe mecanismo pra rota sem authorizer, pare e
  reporte antes de improvisar.
- Se travar, pare e reporte. Sem git reset --hard, force push, --no-verify.

Reporte ao final: arquivos tocados, decisões em notes.md, riscos.
```

---

## Onda B — 2 agentes em paralelo

**Só disparar depois que Onda A estiver 100% mergeada.**

### 🎯 Onda B1 — feat-invoice-forecast

```
Você é um agente de implementação para o projeto invoice.plan.

Sua missão: implementar a issue `feat-invoice-forecast` (1B, Onda B, paralelo).

INSTRUÇÃO OBRIGATÓRIA — leia INTEGRALMENTE, na ordem:
1. `.scratch/feat-invoice-forecast/agent-brief.md`
2. `.scratch/feat-invoice-forecast/issue.md`
3. `.scratch/PARALLEL_EXECUTION.md` (Onda B, junto com 1C)

Confirme antes: Onda A (1A, 1D, 4C) mergeada?

Contrato crítico com 1C (que roda em paralelo com você): você NÃO altera o
handler `/dashboard/{yearMonth}` existente. Cria rota nova `/forecast/{ym}`
em bloco separado no api_stack.py (`# --- feat-invoice-forecast (1B) ---`).
Em DashboardPage.tsx, insere `<ForecastCard>` no slot canônico (§5) —
entre InsightsBar (1C) e SummaryCard. Só renderizar quando yearMonth === mês
corrente.

Cria `backend/shared/forecast.py` — regenerar layer no fim.

Regras críticas:
- Edit cirúrgico. Write só pra arquivos novos.
- Antes de cada Edit, sempre Read.
- Não rode `cdk deploy`.
- Se travar, pare e reporte. Sem git reset --hard, force push, --no-verify.

Reporte ao final: arquivos tocados, decisões em notes.md, riscos.
```

### 🎯 Onda B2 — feat-smart-alerts

```
Você é um agente de implementação para o projeto invoice.plan.

Sua missão: implementar a issue `feat-smart-alerts` (1C, Onda B, paralelo).

INSTRUÇÃO OBRIGATÓRIA — leia INTEGRALMENTE, na ordem:
1. `.scratch/feat-smart-alerts/agent-brief.md`
2. `.scratch/feat-smart-alerts/issue.md`
3. `.scratch/PARALLEL_EXECUTION.md` (Onda B, junto com 1B)

Confirme antes: Onda A mergeada? (1A adicionou `history_summaries` que você
reusa pra calcular médias).

Contrato crítico com 1B: você ADICIONA apenas o campo `alerts: [...]` no
payload de `/dashboard/{yearMonth}`. NÃO tocar em `history_summaries` (é
de 1A já mergeado) nem criar rota nova (contrato de 1B). Em DashboardPage,
`<InsightsBar>` vai no topo, acima de tudo (slot canônico §5).

Cria `backend/shared/alerts.py` e nova SK `ALERT_DISMISS#`. Regenerar layer.

Regras críticas:
- Edit cirúrgico. Write só pra arquivos novos.
- Antes de cada Edit, sempre Read.
- Não rode `cdk deploy`.
- Se travar, pare e reporte. Sem git reset --hard, force push, --no-verify.

Reporte ao final: arquivos tocados, decisões em notes.md, riscos.
```

---

## Onda C — 1 agente sozinho

**Só disparar depois que Onda B estiver 100% mergeada.**

### 🎯 Onda C1 — feat-expense-split

```
Você é um agente de implementação para o projeto invoice.plan.

Sua missão: implementar a issue `feat-expense-split` (4B, Onda C, sozinho na onda).

INSTRUÇÃO OBRIGATÓRIA — leia INTEGRALMENTE, na ordem:
1. `.scratch/feat-expense-split/agent-brief.md`
2. `.scratch/feat-expense-split/issue.md`
3. `.scratch/PARALLEL_EXECUTION.md` (Onda C — você trabalha sozinho)

Confirme antes: Ondas 0, A e B mergeadas?

Você é o ÚNICO agente ativo. Toca `models.py::Transaction` (bloco de 4B
vem DEPOIS do bloco de 1D — §5 do mapa mestre), TransactionList.tsx (badge
+ valor efetivo), db.py (helpers de receivables sem tocar em queries
existentes). Impacto semântico: SUMMARY do mês passa a ser calculado com
`share_amount or amount`.

Regras críticas:
- Edit cirúrgico. Write só pra arquivos novos.
- Antes de cada Edit, sempre Read.
- Regenerar layer no fim (cria splits.py, altera models.py).
- Não rode `cdk deploy`.
- Cuidado com regressão em edição de categoria (feat-transaction-edit)
  e flags (feat-duplicate-detector) no TransactionList — extensão sem
  regressão.
- Se travar, pare e reporte. Sem git reset --hard, force push, --no-verify.

Reporte ao final: arquivos tocados, decisões em notes.md, riscos.
```

---

## Onda D1 — 1 agente sozinho

**Só disparar depois que Onda C estiver mergeada.**

### 🎯 Onda D1 — feat-category-learning

```
Você é um agente de implementação para o projeto invoice.plan.

Sua missão: implementar a issue `feat-category-learning` (1E, Onda D1, sozinho).

INSTRUÇÃO OBRIGATÓRIA — leia INTEGRALMENTE, na ordem:
1. `.scratch/feat-category-learning/agent-brief.md`
2. `.scratch/feat-category-learning/issue.md`
3. `.scratch/PARALLEL_EXECUTION.md` (Onda D1 — você trabalha sozinho)

Confirme antes: TODAS as ondas anteriores (0, A, B, C) mergeadas?

Você é o ÚNICO agente ativo. Refactor do pipeline de invoice — insere
`pre_categorize_by_rules()` entre extract e Groq. Adiciona modelo `Rule`
NOVO em models.py (não toca em Transaction). Substitui dropdown inline
de edição de categoria (de feat-transaction-edit) por CategoryEditDialog
com radio de escopo — CUIDADO com regressão. Se feat-duplicate-detector
já criou função de normalização de merchant, REUSAR — não duplicar.

Regras críticas:
- Edit cirúrgico. Write só pra arquivos novos.
- Antes de cada Edit, sempre Read.
- Regenerar layer no fim (cria normalizer.py, rules.py, altera models.py e db.py).
- Não rode `cdk deploy`.
- Instrumentar logs pra métricas: % linhas categorizadas por regra vs IA,
  tokens Groq por fatura antes/depois.
- Se travar, pare e reporte. Sem git reset --hard, force push, --no-verify.

Reporte ao final: arquivos tocados, decisões em notes.md, métricas se
possível, riscos.
```

---

## Onda D2 — 1 agente sozinho, MERGE FREEZE

**⚠️ Não disparar sem confirmar backup do DynamoDB `invoice-plan` e merge freeze anunciado.**

### 🎯 Onda D2 — feat-shared-workspace

```
Você é um agente de implementação para o projeto invoice.plan.

Sua missão: implementar a issue `feat-shared-workspace` (4A, Onda D2, sozinho, MERGE FREEZE).

⚠️ AVISO: esta é a issue mais estrutural do roadmap. Refatora a PK do
DynamoDB (USER# → WORKSPACE#) e afeta praticamente todo backend + frontend.

INSTRUÇÃO OBRIGATÓRIA — leia INTEGRALMENTE, na ordem:
1. `.scratch/feat-shared-workspace/agent-brief.md` (leia o AVISO)
2. `.scratch/feat-shared-workspace/issue.md`
3. `.scratch/PARALLEL_EXECUTION.md`
4. `CLAUDE.md`

CONFIRMAR ANTES DE TOCAR CÓDIGO:
- Todas as outras issues mergeadas em produção
- Nenhum outro agente com branch aberta
- Merge freeze declarado
- Backup do DynamoDB invoice-plan recente

Se qualquer condição acima não estiver satisfeita, PARE E REPORTE. Não
tente confirmar isso lendo o código — pergunte ao owner.

Fluxo obrigatório:
1. Rascunhar em notes.md ANTES DE CODAR:
   - Ordem de migração
   - Contrato dual-schema (como db.py lê USER# e WORKSPACE#)
   - Plano de rollback
   - Comandos que owner precisa rodar
2. Implementar em ordem: modelos → db.py dual → handlers → email/SES → infra
   → frontend hooks → componentes → fluxo de convite
3. Script de migração em `scripts/migrate-user-to-workspace.py` (separado)
4. NÃO rodar migração nem `cdk deploy` — deixar tudo documentado

Regras críticas (nunca violar):
- Edit cirúrgico. Write só pra arquivos novos.
- Antes de cada Edit, sempre Read.
- Regenerar layer no fim.
- Se travar, pare e reporte. Sem git reset --hard, force push, --no-verify.
- Zero decisões destrutivas. Esta issue tem risco de perda de dados — SEGURANÇA
  > VELOCIDADE.

Reporte ao final: arquivos tocados, script de migração, plano de rollback,
comandos pendentes de owner, riscos.
```

---

## Registro de execução

Preencher conforme dispara agentes:

| Onda | Slug | Branch/Worktree | Agente | Status | Merged? |
|---|---|---|---|---|---|
| 0.1 | feat-async-invoice-processing | | | | |
| 0.2 | feat-transaction-edit | | | | |
| A1 | feat-monthly-comparison | | | | |
| A2 | feat-duplicate-detector | | | | |
| A3 | feat-share-readonly-link | | | | |
| B1 | feat-invoice-forecast | | | | |
| B2 | feat-smart-alerts | | | | |
| C1 | feat-expense-split | | | | |
| D1 | feat-category-learning | | | | |
| D2 | feat-shared-workspace | | | | |

## Checklist entre ondas

Antes de disparar a próxima onda:
- [ ] Todas branches da onda anterior mergeadas em `main`
- [ ] Layer regenerada se algum agente tocou `backend/shared/`
- [ ] `cdk deploy InvoicePlanApi` rodado (backend novo em prod)
- [ ] `cdk deploy InvoicePlanFrontend` se frontend mudou
- [ ] Smoke test: login → upload fatura → dashboard → nova feature funciona
- [ ] Nenhum erro novo no CloudWatch da Lambda
- [ ] Notes.md de cada issue lido pra saber se há surpresas
