---
title: Retry with exponential backoff on Groq 429 rate limit
labels: [performance, reliability]
status: closed
created: 2026-06-27
---

## Problem

When Groq returns HTTP 429 (rate limit exceeded), `_call_groq` immediately raises an exception via `resp.raise_for_status()`, propagating a 500 error to the user. The free tier limit is per 1-minute window, so a simple retry resolves the majority of burst scenarios without user-visible failure.

## Fix

Wrap the `requests.post` call in a retry loop (up to 3 attempts) with exponential backoff (1s, 2s, 4s). Non-429 errors still raise immediately. After exhausting all retries, a descriptive exception is raised.

## Affected file

`backend/shared/providers/groq_provider.py`
