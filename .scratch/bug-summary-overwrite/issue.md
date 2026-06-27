---
title: "Bug: second upload in the same month overwrites the summary"
status: closed
labels: [bug, backend]
---

## Problem

`_build_summary` computes a summary only from the current upload's transactions, and `put_item` replaces the `SUMMARY#{year_month}` item entirely.
A user with two credit cards loses the first upload's data when they upload the second card.

## Fix

Before saving the new summary, fetch the existing one with `get_summary(user_id, year_month)` and merge them via `_merge_summary(existing, new)`:

- Sum `total`
- Merge `by_category` summing float values per key (stored as strings in DynamoDB)
- Sum `transaction_count`

## Resolution

Added `_merge_summary` helper in `backend/functions/invoices/handler.py` and updated `_upload_invoice` to call it before persisting the summary.
