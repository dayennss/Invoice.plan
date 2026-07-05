# Execução paralela — mapa de coordenação

Este doc mapeia **quais issues tocam nos mesmos arquivos** e define **ondas de execução** que podem rodar simultaneamente sem colidir. Consulte antes de despachar agentes.

> **Regra de ouro:** um agente **nunca** roda em paralelo com outro que edite as mesmas funções/símbolos. Se a colisão for só em imports ou seções distintas do mesmo arquivo, aceitável — mas prefira sequenciamento quando dúvida.

---

## 1. Convenções de segurança para agentes

Todo agente que for pegar uma issue **deve seguir**:

1. **Nunca reescrever arquivos inteiros** — usar Edit no ponto exato. `Write` só em arquivos novos.
2. **Adicionar campos opcionais em `models.py`, nunca renomear/remover.** Pydantic aceita novos campos com default sem quebrar.
3. **Adicionar campos opcionais em `types/index.ts` como `field?: T` no fim do bloco.** Sem reorganizar.
4. **Handlers Python novos** → criar `backend/functions/<nome>/handler.py` novo em vez de amontoar rotas em `invoices/handler.py`.
5. **Rotas API Gateway** → adicionar bloco no fim de `infra/stacks/api_stack.py`, agrupado com um comentário `# --- <feature-slug> ---`.
6. **Componentes React novos** sempre em arquivo separado. Extensão de componente existente exige Edit cirúrgico.
7. **Sempre reler o arquivo com Read imediatamente antes de Edit** — outro agente pode ter tocado.
8. **Migrações de schema Dynamo** → apenas na onda dedicada (D). Nunca em paralelo com outras ondas.
9. **Rebase antes de merge**, testar smoke local (upload + dashboard) antes de PR.
10. **`backend/layer/python/shared/` é gerado** — não editar direto. Regerar após consolidar (ver CLAUDE.md).

---

## 2. Hotspots (arquivos altamente disputados)

Ordem por severidade da disputa.

### 🔴 `backend/functions/invoices/handler.py`
Editam este arquivo:
- `feat-async-invoice-processing` (split HTTP/worker — **refactor estrutural**)
- `feat-transaction-edit` (`PATCH /transactions/{id}`)
- `feat-invoice-list` (`DELETE /invoices/{id}`)
- `feat-month-selector-upload` (leitura de `yearMonth` no query param)
- `feat-multiple-cards` (persistir `card_name`)
- `feat-utility-bills` (novo tipo)
- **1D `feat-duplicate-detector`** (chamar `flag_transactions()` antes de persistir)
- **1E `feat-category-learning`** (integrar `rules` no pipeline)

**Estratégia:** `feat-async-invoice-processing` deve ir **primeiro e sozinho**, pois muda a forma da função. Depois dele, os outros editam pontos específicos (novas rotas, novos steps do pipeline).

### 🟠 `backend/functions/dashboard/handler.py`
- **1A `feat-monthly-comparison`** (retornar 12 summaries)
- **1B `feat-invoice-forecast`** (nova rota `/forecast/*`)
- **1C `feat-smart-alerts`** (retornar `alerts` no payload)

**Estratégia:** 1A e 1C editam o mesmo payload de retorno — 1A entra primeiro (adiciona `history_summaries`), 1C entra depois (adiciona `alerts`). 1B cria rota separada, pode rodar em paralelo desde que respeite o `api_stack.py`.

### 🟠 `backend/shared/models.py`
- **1D** (`Transaction.flags`, `Transaction.flags_dismissed`)
- **1E** (`Rule`)
- **4A `feat-shared-workspace`** (`Workspace`, `Member`, `Invite`)
- **4B `feat-expense-split`** (`Split`, `Transaction.splits`, `Transaction.share_amount`)

**Estratégia:** todos adicionam campos/modelos novos. Só existe conflito real se editarem a mesma linha da `class Transaction`. Ordem sugerida: **1D → 4B → 1E** (Transaction). 4A adiciona modelos novos separados, sem tocar em Transaction.

### 🟠 `backend/shared/db.py`
- **1E** (`rule_sk`, queries)
- **4A** (refactor massivo pra `WORKSPACE#`)
- **4B** (query de receivables)
- **4C `feat-share-readonly-link`** (`share_sk`)

**Estratégia:** 4A é incompatível com qualquer outro. 1E/4B/4C só adicionam funções novas.

### 🟠 `infra/stacks/api_stack.py`
**Praticamente todas as issues.** Cada uma adiciona uma ou mais rotas.

**Estratégia:** cada agente adiciona bloco isolado no final, delimitado por comentário `# --- <feature-slug> ---`. Conflitos de merge serão triviais de resolver (concat).

### 🟠 `frontend/src/components/TransactionList.tsx`
- `feat-transaction-edit` (edição inline de categoria)
- `feat-multiple-cards` (filtro por cartão)
- **1D** (badges de flags + chip de filtro)
- **1E** (dispara `CategoryEditDialog` no clique)
- **4B** (badge de split + valor efetivo)

**Estratégia:** este é o componente mais disputado do frontend. Sequenciamento estrito:
1. `feat-transaction-edit` (define a mecânica de edição)
2. **1D** (adiciona badges — extensível)
3. **4B** (adiciona badge de split — outra dimensão)
4. **1E** (troca o handler de edição pra abrir `CategoryEditDialog`)
5. `feat-multiple-cards` (filtro no header do componente)

Não rodar dois destes em paralelo.

### 🟡 `frontend/src/pages/DashboardPage.tsx`
- `feat-invoice-list`, `feat-multiple-cards`, `feat-month-selector-upload`
- **1A** (integrar `<CategoryComparisonCard>`)
- **1B** (integrar `<ForecastCard>` acima do summary)
- **1C** (integrar `<InsightsBar>` no topo)
- **4C** (botão de share no header do mês)

**Estratégia:** cada um adiciona um componente em posição definida. Definir a ordem visual **no momento** de fazer edit (não dá pra reservar posições em paralelo). Rodar sequencial.

### 🟡 `frontend/src/types/index.ts`
Quase todas. Cada agente adiciona tipos novos no fim do arquivo — colisão de merge trivial.

### 🟡 `frontend/src/hooks/useInvoices.ts`
- `feat-async-invoice-processing` (`refetchInterval` condicional)
- `feat-invoice-list` (extensão pra suportar delete)

**Estratégia:** sequencial. `feat-async` primeiro (muda forma do hook).

### 🟡 `frontend/src/components/InvoiceList.tsx`
- `feat-async-invoice-processing` (spinner)
- `feat-invoice-list` (é literalmente o próprio componente que já existe)
- `feat-multiple-cards` (breakdown por cartão)

**Estratégia:** `feat-invoice-list` primeiro (foi criado nele), `feat-async` depois (adiciona spinner), `feat-multiple-cards` por último.

---

## 3. Zonas seguras (sem conflito com nada mais)

Estes arquivos são **exclusivos** da issue que os cria. Podem rodar em paralelo sem risco.

| Issue | Arquivos exclusivos |
|---|---|
| 1A | `frontend/src/hooks/useMonthlyComparison.ts`, `frontend/src/lib/stats.ts`, `frontend/src/components/CategoryComparisonCard.tsx` |
| 1B | `backend/shared/forecast.py`, `frontend/src/hooks/useForecast.ts`, `frontend/src/components/ForecastCard.tsx` |
| 1C | `backend/shared/alerts.py`, `frontend/src/hooks/useDismissAlert.ts`, `frontend/src/components/InsightsBar.tsx`, `frontend/src/components/InsightCard.tsx` |
| 1D | `backend/shared/flag_detector.py`, `frontend/src/components/TransactionFlagBadge.tsx`, `frontend/src/hooks/useDismissFlag.ts` |
| 1E | `backend/shared/normalizer.py`, `backend/shared/rules.py`, `backend/functions/rules/handler.py`, `frontend/src/hooks/useRules.ts`, `frontend/src/hooks/useUpdateCategory.ts`, `frontend/src/components/CategoryEditDialog.tsx`, `frontend/src/pages/RulesPage.tsx` |
| 4A | `backend/shared/email.py`, `backend/functions/workspaces/`, `backend/functions/invites/`, `frontend/src/hooks/useWorkspaces.ts`, `frontend/src/hooks/useInvites.ts`, `frontend/src/components/WorkspaceSwitcher.tsx`, `frontend/src/components/MemberAvatar.tsx`, `frontend/src/pages/WorkspaceSettingsPage.tsx`, `frontend/src/pages/JoinWorkspacePage.tsx` |
| 4B | `backend/shared/splits.py`, `backend/functions/transactions/handler.py`, `frontend/src/components/SplitDialog.tsx`, `frontend/src/components/PersonAutocomplete.tsx`, `frontend/src/pages/ReceivablesPage.tsx`, `frontend/src/hooks/useUpdateSplits.ts`, `frontend/src/hooks/useMarkSplitPaid.ts`, `frontend/src/hooks/useReceivables.ts`, `frontend/src/hooks/usePeople.ts` |
| 4C | `backend/functions/shares/handler.py`, `backend/functions/public/handler.py`, `frontend/src/hooks/useShares.ts`, `frontend/src/hooks/usePublicShare.ts`, `frontend/src/components/ShareDialog.tsx`, `frontend/src/pages/PublicDashboardPage.tsx`, `frontend/src/pages/SharesPage.tsx` |

---

## 4. Ondas de execução (o cronograma)

Definição: uma **onda** é um conjunto de issues que podem rodar em paralelo sem coordenação intermediária. Entre ondas há um merge + rebase de todas as branches na main.

### Onda 0 — pré-requisitos (SEQUENCIAL, roda antes de tudo)

Devem terminar antes das ondas paralelas começarem:

1. `feat-async-invoice-processing` — refatora `invoices/handler.py`. Tudo que edita esse arquivo depois é mais seguro.
2. `feat-transaction-edit` — introduz mecânica de edição de transação usada por 1D, 1E, 4B.

**Por quê sequencial:** ambos alteram fundações; deixar pronto evita rebase infernal nas ondas seguintes.

### Onda A — quick wins paralelos (3 agentes simultâneos)

Zero colisão real. Podem rodar **totalmente em paralelo** em branches diferentes.

| Agente | Issue | Arquivos compartilhados |
|---|---|---|
| Agente A1 | **1A** `feat-monthly-comparison` | `dashboard/handler.py` (extensão do payload), `DashboardPage.tsx` (adiciona card) |
| Agente A2 | **1D** `feat-duplicate-detector` | `invoices/handler.py` (adiciona 1 chamada no pipeline), `models.py`, `TransactionList.tsx` (badges) |
| Agente A3 | **4C** `feat-share-readonly-link` | `db.py` (só adiciona helpers), `api_stack.py` (rota nova) |

**Coordenação:** 1A e 4C não colidem. 1D toca `models.py` e `TransactionList.tsx` sozinho na onda.

**Merge da onda:** rebase A1 → main, depois A2 → main, depois A3 → main. Testar dashboard após cada merge.

### Onda B — inteligência (2 agentes simultâneos)

Depende da Onda A estar mergeada.

| Agente | Issue | Arquivos compartilhados |
|---|---|---|
| Agente B1 | **1B** `feat-invoice-forecast` | `dashboard/handler.py` (rota nova separada), `DashboardPage.tsx` (adiciona card) |
| Agente B2 | **1C** `feat-smart-alerts` | `dashboard/handler.py` (payload — depende de 1A já ter estendido) |

**Coordenação:** ambos tocam `dashboard/handler.py` e `DashboardPage.tsx`. **Distribuir função:**
- B1 adiciona rota nova `/forecast/{yearMonth}` em bloco isolado. **Não** toca no handler `/dashboard/{yearMonth}` existente.
- B2 edita **apenas** o handler `/dashboard/{yearMonth}` pra incluir `alerts`.
- No `DashboardPage.tsx`, B1 insere `<ForecastCard>` **acima** do `<SummaryCard>`; B2 insere `<InsightsBar>` **acima** de tudo. Definir slots antes de rodar (ver seção 5).

### Onda C — colaboração leve (1 agente sozinho)

| Agente | Issue |
|---|---|
| Agente C1 | **4B** `feat-expense-split` |

**Por quê sozinho:** toca `TransactionList.tsx`, `models.py`, `db.py`. Se rodar em paralelo com Onda B, colisão em `models.py` é grande.

### Onda D — refactors grandes (1 agente sozinho, uma issue por vez)

Cada uma dessas roda **sem NENHUM outro agente** ativo.

| Ordem | Issue | Por quê sozinho |
|---|---|---|
| D1 | **1E** `feat-category-learning` | Refactor do pipeline de invoice, mexe em `models.py`, `db.py`, integra em vários pontos |
| D2 | **4A** `feat-shared-workspace` | Refactor total do schema Dynamo, todos os handlers, migração de dados. **Trava o repo.** |

**Ordem D1 antes de D2** porque D2 vai mexer em tudo que D1 tocou — melhor não gastar dobrado.

---

## 5. Contratos entre agentes (sinais explícitos)

### Slots de layout no `DashboardPage.tsx`

Quando dois agentes precisam inserir componentes no mesmo pai, decidir a ordem visual **antes** de rodar. Ordem canônica top-down após todas as ondas:

```tsx
<DashboardPage>
  <AppHeader />
  <MonthNavigation />
  <InsightsBar />          {/* 1C */}
  <ForecastCard />         {/* 1B (só mês corrente) */}
  <SummaryCard />          {/* existente + comparativo 1A */}
  <CategoryChart />        {/* existente + comparativo 1A */}
  <MonthlyTimeline />
  <SpendingHeatmap />
  <RecurringSubscriptions />
  <InstallmentTracker />
  <InvoiceList />
  <TransactionList />
</DashboardPage>
```

Cada issue insere seu componente **exatamente** nessa posição, sem reordenar os vizinhos.

### Extensão do payload `/dashboard/{yearMonth}`

Contrato de campos que cada issue adiciona (todos opcionais, backward-compat):

```jsonc
{
  // existente
  "summary": {...},
  "transactions": [...],
  "timeline": [...],

  // 1A adiciona
  "history_summaries": [ {year_month, total, by_category}, ... ],

  // 1C adiciona
  "alerts": [ {code, severity, title, body, hash}, ... ]
}
```

### Extensão do modelo `Transaction`

Ordem de campos adicionados (mesma ordem no `models.py` e no `types/index.ts`):

```python
class Transaction(BaseModel):
    # existente
    id: str
    description: str
    amount: float
    date: str
    category: TransactionCategory
    installment_current: Optional[int] = None
    installment_total: Optional[int] = None
    is_recurring: bool = False

    # 1D
    flags: list[str] = []
    flags_dismissed: list[str] = []

    # 4B
    splits: Optional[list[Split]] = None
    share_amount: Optional[float] = None
```

Cada agente adiciona **só o seu bloco**, respeitando a ordem. Merge trivial.

### Rotas em `api_stack.py`

Bloco por feature com comentário. Ordem no arquivo = ordem de execução das ondas:

```python
# --- feat-async-invoice-processing ---
# rotas...

# --- feat-transaction-edit ---
# rotas...

# --- feat-invoice-list ---
# rotas...

# --- feat-monthly-comparison (1A) ---
# (nenhuma rota nova — só payload)

# --- feat-duplicate-detector (1D) ---
# POST /transactions/{id}/dismiss-flag

# --- feat-share-readonly-link (4C) ---
# POST /shares
# GET /shares
# DELETE /shares/{token}
# GET /public/share/{token}   (sem authorizer!)

# ...e assim por diante
```

### Layer Python

**Regra crítica** (do CLAUDE.md): após qualquer alteração em `backend/shared/*`, é necessário regenerar `backend/layer/python/shared/`. **Não** rodar isso em paralelo. Convenção:
- Cada onda tem um **owner de merge** responsável por regenerar a layer após consolidar todos os PRs da onda.
- Cada issue documenta se alterou `backend/shared/`.

---

## 6. Matriz de conflito rápida

Legenda: 🟥 conflito estrutural (não paralelo) · 🟨 pontos distintos do mesmo arquivo (coordenar) · 🟩 sem conflito

|  | 1A | 1B | 1C | 1D | 1E | 4A | 4B | 4C |
|---|---|---|---|---|---|---|---|---|
| **1A** | — | 🟨 | 🟨 | 🟩 | 🟩 | 🟥 | 🟩 | 🟩 |
| **1B** | 🟨 | — | 🟨 | 🟩 | 🟩 | 🟥 | 🟩 | 🟩 |
| **1C** | 🟨 | 🟨 | — | 🟨 | 🟩 | 🟥 | 🟨 | 🟩 |
| **1D** | 🟩 | 🟩 | 🟨 | — | 🟥 | 🟥 | 🟨 | 🟩 |
| **1E** | 🟩 | 🟩 | 🟩 | 🟥 | — | 🟥 | 🟨 | 🟩 |
| **4A** | 🟥 | 🟥 | 🟥 | 🟥 | 🟥 | — | 🟥 | 🟥 |
| **4B** | 🟩 | 🟩 | 🟨 | 🟨 | 🟨 | 🟥 | — | 🟩 |
| **4C** | 🟩 | 🟩 | 🟩 | 🟩 | 🟩 | 🟥 | 🟩 | — |

Interpretação:
- **4A trava todo mundo** — só rodar sozinho.
- **1A, 1B, 1C** compartilham o dashboard mas com contrato claro (seção 5) rodam juntos.
- **1D vs 1E:** ambos tocam `TransactionList.tsx` e `models.py::Transaction` — sequenciar.
- **4C é o mais isolado** — pode rodar praticamente com qualquer coisa.

---

## 7. Checklist do owner da onda

Antes de despachar agentes em paralelo:
- [ ] Todas as issues da onda foram lidas e marcadas com `labels: [ready-for-agent]`
- [ ] Cada agente recebe: (1) a issue, (2) o link pra este doc, (3) sua onda e coordenadas
- [ ] Branch de cada agente segue padrão `worktree-agent-<slug>-<hash>`
- [ ] Sem edição concomitante do mesmo arquivo por agentes da mesma onda (exceto pontos definidos em §5)

Após a onda:
- [ ] Merge sequencial das branches (não em paralelo)
- [ ] Regenerar layer se `backend/shared/*` mudou
- [ ] Deploy `cdk deploy InvoicePlanApi`
- [ ] Smoke test: login → upload fatura → dashboard
- [ ] Atualizar `MEMORY.md` do projeto com o que foi entregue
