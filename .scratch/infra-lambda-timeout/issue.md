---
title: Increase InvoicesFunction Lambda timeout from 60s to 90s
labels: [infra, reliability]
status: closed
created: 2026-06-27
---

## Problem

The invoice processing pipeline can exceed 60s in the worst case:

- Cold start SSM read (~200ms)
- PyMuPDF PDF parsing
- Groq API call with timeout=30s
- Possible retry on rate limit (up to 7s extra)

Combined, these can push total execution past the 60s Lambda limit, causing timeout errors.

## Solution

Increase `InvoicesFunction` timeout from 60s to 90s in `infra/stacks/api_stack.py`.

The `DashboardFunction` timeout (15s) is not affected.

## Changes

- `infra/stacks/api_stack.py`: `timeout=cdk.Duration.seconds(90)`
