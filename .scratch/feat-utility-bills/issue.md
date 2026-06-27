---
title: "Feature: suporte a contas de consumo (luz, água, internet)"
labels: [needs-triage]
status: open
created: 2026-06-27
priority: P3
---

## Contexto

Issue #12 do backlog original. Usuários têm despesas fixas mensais fora do cartão de crédito — conta de luz (Enel, Light), água (Sabesp, Cedae), internet (Claro, Vivo), gás.

## Desafio técnico

Contas de consumo têm formato radicalmente diferente de faturas de cartão:
- Uma única "transação" (o valor da conta)
- Campos relevantes: fornecedor, mês de referência, vencimento, valor
- PDFs não padronizados por fornecedor (cada concessionária tem layout próprio)
- Alguns são boletos, outros PDFs nativos

## Abordagem sugerida

### Opção A — Pipeline unificado (mesmo prompt, detecção automática)
Adicionar ao prompt do Groq instruções para detectar se é fatura de cartão ou conta de consumo e extrair adequadamente. Mais simples, mas prompt mais complexo.

### Opção B — Tipo de documento selecionável no upload
O usuário indica "Fatura de cartão" ou "Conta de consumo" antes do upload. Prompt e parsing diferentes por tipo. Mais robusto.

**Recomendação:** Opção B, com campo de seleção no `InvoiceUpload`.

## Modelo de dados

Contas de consumo são uma transação única com campos extras:
```python
{
  "category": "moradia",  # ou "outros"
  "description": "Enel - Energia Elétrica",
  "amount": 189.50,
  "date": "2026-05-10",  # vencimento
  "utility_provider": "Enel",
  "utility_type": "energia",  # agua, internet, gas
  "reference_month": "2026-04",
}
```

## Dependências

- `feat-month-selector-upload` (período de referência)
- Decisão de arquitetura sobre Opção A vs B

## Arquivos afetados

- `backend/shared/providers/groq_provider.py` — novo prompt para contas
- `backend/functions/invoices/handler.py` — parâmetro `document_type`
- `frontend/src/components/InvoiceUpload.tsx` — seletor de tipo de documento
