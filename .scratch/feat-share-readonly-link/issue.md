---
title: "Feature: share read-only por link (dashboard público)"
labels: [needs-triage]
status: open
created: 2026-07-04
priority: P3
effort: médio
group: colaboracao
---

## Contexto

Usuário quer mostrar o dashboard pra alguém (contador, cônjuge que não usa o app, planejador financeiro) sem criar conta pra essa pessoa. Um link público (com token opaco) resolve o caso e serve também como demo pública ("olha meu app funcionando").

Feature também vira **isca de crescimento** — quem vê o dashboard compartilhado descobre o produto.

## O que construir

Usuário gera um link `https://.../s/{token}` que dá acesso read-only ao dashboard de um mês específico. O link pode:
- ter modo "com valores" ou "só percentuais e categorias" (privacidade)
- ter data de expiração
- ser revogado a qualquer momento

## UX

### Botão de share no dashboard

Menu de ação no cabeçalho do mês:

```
📅 Julho 2026  [Compartilhar]  [Exportar CSV]
```

Modal ao clicar:

```
┌───────────────────────────────────────┐
│ Compartilhar dashboard                │
│                                       │
│ Mês: [Julho 2026 ▾]                   │
│                                       │
│ Modo:                                 │
│  ● Completo (valores em R$)           │
│  ○ Anônimo (só % e categorias)        │
│                                       │
│ Expira em: [7 dias ▾]                 │
│  (7 dias / 30 dias / 90 dias / nunca) │
│                                       │
│ 🔗 https://invoice.plan/s/a7f9c2e1    │
│                            [Copiar]   │
│                                       │
│              [Cancelar] [Criar link]  │
└───────────────────────────────────────┘
```

### Página `/s/{token}` — visualização pública

Mesmo layout do dashboard, sem:
- header com login/perfil (mostra logo + "Compartilhado por Ana Silva")
- botão de upload
- botão de exportar
- edição de qualquer item
- badge "Somente leitura" no topo
- Rodapé: "Criado com invoice.plan — [criar sua conta grátis]"

Modo "anônimo":
- Substitui todos os R$ por percentuais ("R$ 800 — 22% do total" vira "22%")
- Esconde descrição das transações (só categoria + valor%)

### Página "Meus compartilhamentos" (settings)

```
┌───────────────────────────────────────┐
│ Links compartilhados (3)              │
│                                       │
│ 🔗 Junho 2026 · completo              │
│    Criado há 2 dias · expira em 5     │
│    12 acessos                         │
│    [copiar] [revogar]                 │
│                                       │
│ 🔗 Maio 2026 · anônimo · expirado     │
│    [remover]                          │
└───────────────────────────────────────┘
```

## Modelo de dados

Novo item:

```
PK: USER#{user_id}
SK: SHARE#{token}

token: "a7f9c2e1..."         # 128-bit random hex
year_month: "2026-07"
mode: "full" | "anonymous"
created_at: ISO
expires_at: ISO | null
access_count: 0
revoked: false
```

### GSI necessário para lookup por token

`GSI_TOKEN`:
- `GSI_TOKEN_PK: SHARE_TOKEN#{token}`
- `GSI_TOKEN_SK: USER#{user_id}`

Ou (mais barato): armazenar também na PK como `PK: SHARE#{token}` com SK dummy e resolver por get direto — sem GSI. Preferir esta abordagem se possível.

**Recomendação:** dupla escrita — item canônico sob `USER#{id}` + item lookup sob `PK: SHARE_TOKEN#{token}` apontando pro canônico. Simples, sem GSI.

## Backend

### Endpoints privados (Firebase auth)

- `POST /shares` — body `{ year_month, mode, expires_in_days }` → cria token, retorna URL
- `GET /shares` — lista compartilhamentos do usuário
- `DELETE /shares/{token}` — revoga (soft delete: seta `revoked: true`)

### Endpoint público (sem auth)

- `GET /public/share/{token}` — retorna dashboard payload
  - checa: existe? não revogado? não expirado?
  - incrementa `access_count`
  - aplica transformação segundo `mode`:
    - `full`: retorna igual ao `/dashboard/{ym}` mas com dados congelados (snapshot no momento da criação? ou live?)
    - `anonymous`: rebuild com só percentuais, sem descrições

**Decisão de arquitetura:** live (atualiza quando o usuário lança novas transações) ou snapshot?
- **Live** é mais fácil (não precisa persistir dados extras) mas o convidado vê mudanças em tempo real (pode confundir).
- **Snapshot** protege privacy (usuário sabe exato o que compartilhou) mas exige persistir o payload no item de share.

**Recomendação:** snapshot. Persistir `payload_json` no item de share no momento de criação.

### Rate limiting

`/public/share/{token}` precisa de proteção contra scraping — CloudFront ou WAF. V1: sem proteção, monitorar.

## Frontend

### App

- Rota `/s/:token` fora do fluxo autenticado
- Reutilizar componentes do dashboard mas com `readOnly` prop
- `<PublicDashboardPage>` — chama `/public/share/{token}`

### Autenticado

- `<ShareDialog>` — modal com opções
- `<SharesPage>` — listagem
- Hook `useShares`, `useCreateShare`, `useRevokeShare`

## Dependências

- Nenhuma bloqueante. Compatível com estado atual do app.
- Melhora com `feat-monthly-comparison` (é interessante mostrar tendência no público)

## Riscos / gotchas

- **SEO**: público não deve ser indexado. `robots.txt` + `noindex` header no `/s/*`.
- **URL leak**: link compartilhado no WhatsApp fica em preview de link. Se contiver valores sensíveis... considerar bloquear crawlers de preview (`X-Robots-Tag`).
- **Modo anônimo mas descrições reveladoras**: mesmo sem valores, "Pagamento Advogado Marcos Silva" revela demais. Considerar remover descrições completamente no modo anônimo (só categoria).
- **Tokens vazam**: registrar `access_count` e mostrar pro dono ajuda ele a revogar se ver acesso anômalo.

## Arquivos afetados

- `backend/shared/models.py` — modelo `Share`
- `backend/shared/db.py` — `share_sk()`, queries
- `backend/functions/shares/handler.py` — **nova lambda**
- `backend/functions/public/handler.py` — **nova lambda pública** (sem authorizer)
- `infra/stacks/api_stack.py` — rotas privadas + rota pública separada + `noindex` header
- `frontend/src/hooks/useShares.ts` — **novo**
- `frontend/src/hooks/usePublicShare.ts` — **novo**
- `frontend/src/components/ShareDialog.tsx` — **novo**
- `frontend/src/pages/PublicDashboardPage.tsx` — **novo**
- `frontend/src/pages/SharesPage.tsx` — **novo**
- `frontend/src/App.tsx` — rota `/s/:token` fora do guard
- `frontend/src/pages/DashboardPage.tsx` — botão de share
- `frontend/index.html` — `<meta name="robots" content="noindex">` condicional? (verificar SSR/estático)

## Coordenação com outros agentes

Ver mapa mestre em [`.scratch/PARALLEL_EXECUTION.md`](../PARALLEL_EXECUTION.md).

**Onda:** A (paralelo com 1A e 1D — é a issue mais isolada da onda).

**Por quê baixo risco:** só cria arquivos novos + adiciona rotas isoladas. Toca `db.py` só pra somar helpers, sem modificar queries existentes.

**Arquivos compartilhados com outras issues:**

| Arquivo | Também tocado por | Como coexistir |
|---|---|---|
| `backend/shared/db.py` | `1E`, `4A`, `4B` | Adicionar apenas `share_sk()` e helper de lookup por token. Não tocar em queries de invoice/transaction/summary. |
| `infra/stacks/api_stack.py` | Todas | Bloco `# --- feat-share-readonly-link (4C) ---`. **Atenção:** a rota `GET /public/share/{token}` precisa ser configurada **sem authorizer** (contrário de todas as outras). |
| `frontend/src/pages/DashboardPage.tsx` | `1A`, `1B`, `1C`, outras | Adicionar botão "Compartilhar" no header do mês (junto ao "Exportar CSV" que já existe). Sem alterar estrutura do resto da página. |
| `frontend/src/App.tsx` | `1E`, 4A | Adicionar rota `/s/:token` **fora** do guard de autenticação (rota pública). Cuidado com o wrapper de `AuthProvider`. |
| `frontend/src/types/index.ts` | Todos | Adicionar tipo `Share` no fim. |

**Arquivos exclusivos desta issue (zero risco):**
- `backend/functions/shares/handler.py`
- `backend/functions/public/handler.py`
- `frontend/src/hooks/useShares.ts`, `usePublicShare.ts`
- `frontend/src/components/ShareDialog.tsx`
- `frontend/src/pages/PublicDashboardPage.tsx`, `SharesPage.tsx`

**Dependências de ordem:**
- **Não bloqueada por nada.** Pode entrar em qualquer momento (exceto durante 4A).
- **Não rodar em paralelo com:** 4A.
- Compatível com 1A e 1D na mesma onda A.

**Preocupação especial:**
- A criação de uma rota API Gateway **sem authorizer** exige mudança no `api_stack.py` que outras issues **não** fazem. Documentar bem no PR e no comentário do bloco.
- CloudFront + noindex header: pode exigir behavior novo — coordenar com owner de infra.

**Após merge:** deploy `InvoicePlanApi` (rotas novas) + deploy `InvoicePlanFrontend` (nova rota `/s/`).

## Fora do escopo

- Comentários / interação no público
- Compartilhamento de múltiplos meses num link
- Autenticação por senha no link (só token opaco)
- Compartilhar só uma categoria específica
