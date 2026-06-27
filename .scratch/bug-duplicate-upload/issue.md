---
title: "Bug: uploading the same PDF twice duplicates all transactions"
status: closed
labels: [bug, backend]
---

## Problem

Uploading the same PDF file a second time duplicates every transaction and doubles the monthly total.
There is no deduplication mechanism.

## Fix

1. Compute `pdf_hash = hashlib.sha256(pdf_bytes).hexdigest()` at the start of `_upload_invoice`.
2. Call `_find_invoice_by_hash(user_id, pdf_hash)` which queries all `INVOICE#` items for the user and checks for a matching `pdf_hash`.
3. If a match is found, return `error("Fatura já processada anteriormente", 409)` before any write.
4. Store `pdf_hash` in both the initial "processing" item and the final "done" item.

## Resolution

Fixed in `backend/functions/invoices/handler.py`: added `hashlib` import, `_find_invoice_by_hash` helper, and `pdf_hash` field stored on invoice items.
