import json
import base64
import uuid
import traceback
from datetime import datetime

from shared.auth import verify_token
from shared.response import ok, error
from shared.ai_factory import get_ai_provider
from shared.exceptions import PDFPasswordRequired
from shared.db import (
    get_table, user_pk, invoice_sk, transaction_sk, summary_sk, put_item
)


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

    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    pdf_password = headers.get("x-pdf-password") or None

    invoice_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    year_month = now[:7]  # YYYY-MM

    # Salva invoice como processing
    put_item({
        "PK": user_pk(user_id),
        "SK": invoice_sk(year_month, invoice_id),
        "invoice_id": invoice_id,
        "user_id": user_id,
        "filename": filename,
        "year_month": year_month,
        "status": "processing",
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

    # Calcula e persiste summary do mês
    summary = _build_summary(year_month, transactions)
    put_item({
        "PK": user_pk(user_id),
        "SK": summary_sk(year_month),
        "year_month": year_month,
        "total": str(summary["total"]),
        "by_category": summary["by_category"],
        "transaction_count": summary["transaction_count"],
    })

    # Marca invoice como done
    put_item({
        "PK": user_pk(user_id),
        "SK": invoice_sk(year_month, invoice_id),
        "invoice_id": invoice_id,
        "user_id": user_id,
        "filename": filename,
        "year_month": year_month,
        "status": "done",
        "transaction_count": len(transactions),
        "created_at": now,
    })

    return ok({
        "invoice_id": invoice_id,
        "year_month": year_month,
        "transaction_count": len(transactions),
        "total": summary["total"],
    }, 201)


def _list_invoices(event: dict, user_id: str) -> dict:
    from shared.db import get_table
    from boto3.dynamodb.conditions import Key

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


def _mark_invoice_error(user_id: str, year_month: str, invoice_id: str) -> None:
    from shared.db import update_item
    update_item(user_pk(user_id), invoice_sk(year_month, invoice_id), {"status": "error"})
