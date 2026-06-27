---
title: "Bug: year_month uses upload date instead of invoice period"
status: closed
labels: [bug, backend]
---

## Problem

`year_month = now[:7]` in `_upload_invoice` uses the UTC timestamp of the upload.
If the user uploads a May invoice in June, all data is stored under June.

## Fix

Read `yearMonth` from the query string. Use it if it is a valid `YYYY-MM` string (7 chars); otherwise fall back to `now[:7]`.

```python
year_month = (event.get("queryStringParameters") or {}).get("yearMonth", "")
if not year_month or len(year_month) != 7:
    year_month = now[:7]
```

## Resolution

Fixed in `backend/functions/invoices/handler.py`.
