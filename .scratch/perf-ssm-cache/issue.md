---
title: Cache Groq API key from SSM in module scope
labels: [performance]
status: closed
created: 2026-06-27
---

## Problem

`GroqProvider.__init__` calls `_get_ssm_value(ssm_param)` on every instantiation. Since Lambda creates a new provider instance per invocation, this adds 100-200ms of SSM Parameter Store latency even on warm invocations where the process is already running.

## Fix

Add a module-level `_CACHED_API_KEY` variable. On the first warm invocation the key is fetched from SSM and stored; subsequent warm invocations reuse the cached value with no network call.

## Affected file

`backend/shared/providers/groq_provider.py`
