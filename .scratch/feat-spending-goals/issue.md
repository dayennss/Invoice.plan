---
title: "Feature: metas de gasto por categoria"
labels: [needs-triage]
status: open
created: 2026-06-27
priority: P3
---

## O que construir

Permitir que o usuário configure um teto de gasto mensal por categoria. O dashboard exibe alertas visuais quando o gasto se aproxima ou ultrapassa a meta.

## UX

- Nova seção "Metas" no dashboard ou tela dedicada
- Por categoria: input de valor-alvo (ex: Alimentação: R$ 800)
- No `CategoryChart` e `SummaryCard`, exibir barra de progresso (usado / meta)
- Badge de alerta: amarelo ao atingir 80%, vermelho ao ultrapassar
- Notificação visual no topo do dashboard quando alguma meta for ultrapassada

## Modelo de dados

```python
# Item DynamoDB
PK: "USER#{user_id}"
SK: "PROFILE"
goals: {
  "alimentacao": "800.00",
  "transporte": "300.00",
  ...
}
```

O item `PROFILE` já existe no design da single-table (ver memory do projeto). Apenas adicionar o campo `goals`.

## Backend

- `GET /profile` — retorna perfil do usuário incluindo goals
- `PUT /profile` — atualiza goals

## Dependências

- Nenhuma bloqueante, mas é mais útil após `feat-multiple-cards`

## Arquivos afetados

- `backend/functions/` — nova Lambda `profile` ou adicionar rotas na existente
- `infra/stacks/api_stack.py` — nova rota `/profile`
- `frontend/src/hooks/useProfile.ts` — novo hook
- `frontend/src/components/CategoryChart.tsx` — integrar metas
- `frontend/src/components/SummaryCard.tsx` — badge de alerta
