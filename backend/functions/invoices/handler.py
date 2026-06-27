import json
import base64
import uuid
import hashlib
import traceback
from datetime import datetime

from shared.auth import verify_token
from shared.response import ok, error
from shared.ai_factory import get_ai_provider
from shared.exceptions import PDFPasswordRequired
from shared.db import (
    get_table, user_pk, invoice_sk, transaction_sk, summary_sk, put_item, get_summary
)
from boto3.dynamodb.conditions import Key


def lambda_handler(event: dict, context) -> dict:
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return ok({})

    user_id, err = verify_token(event)
    if err:
        return err

    method = event.get("requestContext", {}).get("http", {}).get("method", "")

    if method == "POST":
        return _upload_invoice(event, user_id)
    if method == "GET":
        return _list_invoices(event, user_id)

    return error("Method not allowed", 405)


def _upload_invoice(event: dict, user_id: str) -> dict:
    # Parse multipart — API Gateway base64-encodes binary bodies
    body = event.get("body", "")
    is_b64 = event.get("isBase64Encoded", False)
    if is_b64:
        pdf_bytes = base64.b64decode(body)
    else:
        return error("PDF deve ser enviado em base64", 400)

    filename = (event.get("queryStringParameters") or {}).get("filename", "fatura.pdf")
    if not filename.lower().endswith(".pdf"):
        return error("Apenas arquivos PDF são aceitos", 400)

    # Bug 1 fix: use yearMonth from query string if provided and valid
    now = datetime.utcnow().isoformat()
    year_month = (event.get("queryStringParameters") or {}).get("yearMonth", "")
    if not year_month or len(year_month) != 7:
        year_month = now[:7]

    # Bug 3 fix: compute PDF hash and check for duplicate
    pdf_hash = hashlib.sha256(pdf_bytes).hexdigest()
    if _find_invoice_by_hash(user_id, pdf_hash):
        return error("Fatura já processada anteriormente", 409)

    invoice_id = str(uuid.uuid4())

    # Salva invoice como processing (including pdf_hash)
    put_item({
        "PK": user_pk(user_id),
        "SK": invoice_sk(year_month, invoice_id),
        "invoice_id": invoice_id,
        "user_id": user_id,
        "filename": filename,
        "year_month": year_month,
        "status": "processing",
        "pdf_hash": pdf_hash,
        "created_at": now,
    })

    # Extrai transações via IA
    try:
        provider = get_ai_provider()
        transactions = provider.extract_transactions(pdf_bytes, filename, password=pdf_password)
    except PDFPasswordRequired:
        _mark_invoice_error(user_id, year_month, invoice_id)
        return error("PDF_PASSWORD_REQUIRED", 422)
    except Exception as e:
        print(f"[ERROR] extract_transactions failed: {traceback.format_exc()}")
        _mark_invoice_error(user_id, year_month, invoice_id)
        return error(f"Falha ao processar PDF: {str(e)}", 500)

    # Persiste transações
    for tx in transactions:
        put_item({
            "PK": user_pk(user_id),
            "SK": transaction_sk(year_month, tx.id),
            "transaction_id": tx.id,
            "invoice_id": invoice_id,
            "user_id": user_id,
            "year_month": year_month,
            "description": tx.description,
            "amount": str(tx.amount),
            "date": tx.date,
            "category": tx.category,
            "installment_current": tx.installment_current,
            "installment_total": tx.installment_total,
            "is_recurring": tx.is_recurring,
        })

    # Bug 2 fix: merge with existing summary before saving
    new_summary = _build_summary(year_month, transactions)
    existing_summary = get_summary(user_id, year_month)
    merged_summary = _merge_summary(existing_summary, new_summary)

    put_item({
        "PK": user_pk(user_id),
        "SK": summary_sk(year_month),
        "year_month": year_month,
        "total": str(merged_summary["total"]),
        "by_category": merged_summary["by_category"],
        "transaction_count": merged_summary["transaction_count"],
    })

    # Marca invoice como done (including pdf_hash)
    put_item({
        "PK": user_pk(user_id),
        "SK": invoice_sk(year_month, invoice_id),
        "invoice_id": invoice_id,
        "user_id": user_id,
        "filename": filename,
        "year_month": year_month,
        "status": "done",
        "pdf_hash": pdf_hash,
        "transaction_count": len(transactions),
        "created_at": now,
    })

    return ok({
        "invoice_id": invoice_id,
        "year_month": year_month,
        "transaction_count": len(transactions),
        "total": merged_summary["total"],
    }, 201)


def _list_invoices(event: dict, user_id: str) -> dict:
    table = get_table()
    resp = table.query(
        KeyConditionExpression=Key("PK").eq(user_pk(user_id)) & Key("SK").begins_with("INVOICE#"),
    )
    invoices = resp.get("Items", [])
    invoices.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return ok(invoices)


def _build_summary(year_month: str, transactions) -> dict:
    by_category: dict[str, float] = {}
    total = 0.0
    for tx in transactions:
        total += tx.amount
        by_category[tx.category] = round(by_category.get(tx.category, 0.0) + tx.amount, 2)
    return {
        "year_month": year_month,
        "total": round(total, 2),
        "by_category": {k: str(v) for k, v in by_category.items()},
        "transaction_count": len(transactions),
    }


def _merge_summary(existing: dict | None, new: dict) -> dict:
    """Merge an existing DynamoDB summary item with a newly computed summary."""
    if existing is None:
        return new

    # by_category values are stored as strings in DynamoDB
    existing_by_cat: dict[str, float] = {
        k: float(v) for k, v in existing.get("by_category", {}).items()
    }
    new_by_cat: dict[str, float] = {
        k: float(v) for k, v in new.get("by_category", {}).items()
    }

    merged_by_cat: dict[str, float] = dict(existing_by_cat)
    for category, amount in new_by_cat.items():
        merged_by_cat[category] = round(merged_by_cat.get(category, 0.0) + amount, 2)

    merged_total = round(float(existing.get("total", 0)) + float(new.get("total", 0)), 2)
    merged_count = int(existing.get("transaction_count", 0)) + int(new.get("transaction_count", 0))

    return {
        "year_month": new["year_month"],
        "total": merged_total,
        "by_category": {k: str(v) for k, v in merged_by_cat.items()},
        "transaction_count": merged_count,
    }


def _find_invoice_by_hash(user_id: str, pdf_hash: str) -> bool:
    """Return True if any INVOICE# item for this user has the given pdf_hash."""
    table = get_table()
    resp = table.query(
        KeyConditionExpression=Key("PK").eq(user_pk(user_id)) & Key("SK").begins_with("INVOICE#"),
    )
    for item in resp.get("Items", []):
        if item.get("pdf_hash") == pdf_hash:
            return True
    return False


def _mark_invoice_error(user_id: str, year_month: str, invoice_id: str) -> None:
    from shared.db import update_item
    update_item(user_pk(user_id), invoice_sk(year_month, invoice_id), {"status": "error"})
