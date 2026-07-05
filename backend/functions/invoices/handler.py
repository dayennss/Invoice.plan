import os
import json
import base64
import uuid
import hashlib
import traceback
from datetime import datetime

import boto3
import fitz  # PyMuPDF

from shared.auth import verify_token
from shared.response import ok, error
from shared.ai_factory import get_ai_provider
from shared.exceptions import PDFPasswordRequired
from shared.db import (
    get_table, user_pk, invoice_sk, transaction_sk, summary_sk,
    put_item, get_summary, get_invoice, delete_item, batch_delete,
    get_transactions, update_item,
)
from boto3.dynamodb.conditions import Key


MAX_LABEL_LEN = 40
ASYNC_SOURCE = "invoice-async-worker"

_s3_client = None
_lambda_client = None


def _s3():
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client("s3", region_name=os.environ.get("AWS_ACCOUNT_REGION", "us-east-1"))
    return _s3_client


def _lambda():
    global _lambda_client
    if _lambda_client is None:
        _lambda_client = boto3.client("lambda", region_name=os.environ.get("AWS_ACCOUNT_REGION", "us-east-1"))
    return _lambda_client


def lambda_handler(event: dict, context) -> dict:
    # Path async: Lambda invocando a si mesma
    if event.get("source") == ASYNC_SOURCE:
        return _process_invoice_async(event)

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
    if method == "DELETE":
        return _delete_invoice(event, user_id)

    return error("Method not allowed", 405)


def _sanitize_label(raw: str | None, filename: str) -> str:
    if raw:
        label = raw.strip()[:MAX_LABEL_LEN]
        if label:
            return label
    base = filename.rsplit(".", 1)[0] if filename else "Fatura"
    return base.strip()[:MAX_LABEL_LEN] or "Fatura"


def _pdf_needs_password(pdf_bytes: bytes, password: str | None) -> bool:
    """True se PDF exige senha e a fornecida não abre."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        if not doc.needs_pass:
            return False
        if password and doc.authenticate(password):
            return False
        return True
    finally:
        doc.close()


# ── HTTP handlers ────────────────────────────────────────────

def _upload_invoice(event: dict, user_id: str) -> dict:
    body = event.get("body", "")
    is_b64 = event.get("isBase64Encoded", False)
    if not is_b64:
        return error("PDF deve ser enviado em base64", 400)
    pdf_bytes = base64.b64decode(body)

    qs = event.get("queryStringParameters") or {}
    filename = qs.get("filename", "fatura.pdf")
    if not filename.lower().endswith(".pdf"):
        return error("Apenas arquivos PDF são aceitos", 400)

    label = _sanitize_label(qs.get("label"), filename)

    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    pdf_password = headers.get("x-pdf-password") or None

    # Detecta senha ANTES de persistir/subir S3 — sem lixo se cancelar
    try:
        if _pdf_needs_password(pdf_bytes, pdf_password):
            return error("PDF_PASSWORD_REQUIRED", 422)
    except Exception as e:
        return error(f"Falha ao ler PDF: {str(e)}", 400)

    now = datetime.utcnow().isoformat()
    year_month = qs.get("yearMonth", "")
    if not year_month or len(year_month) != 7:
        year_month = now[:7]

    pdf_hash = hashlib.sha256(pdf_bytes).hexdigest()
    if _find_invoice_by_hash(user_id, pdf_hash):
        return error("Fatura já processada anteriormente", 409)

    invoice_id = str(uuid.uuid4())
    s3_key = f"pending/{user_id}/{invoice_id}.pdf"

    # Upload PDF pro S3
    bucket = os.environ["PENDING_PDFS_BUCKET"]
    _s3().put_object(Bucket=bucket, Key=s3_key, Body=pdf_bytes, ContentType="application/pdf")

    # Cria invoice em processing
    put_item({
        "PK": user_pk(user_id),
        "SK": invoice_sk(year_month, invoice_id),
        "invoice_id": invoice_id,
        "user_id": user_id,
        "filename": filename,
        "label": label,
        "year_month": year_month,
        "status": "processing",
        "pdf_hash": pdf_hash,
        "created_at": now,
    })

    # Dispara worker async (fire-and-forget)
    _lambda().invoke(
        FunctionName=os.environ["INVOICES_FUNCTION_NAME"],
        InvocationType="Event",
        Payload=json.dumps({
            "source": ASYNC_SOURCE,
            "user_id": user_id,
            "invoice_id": invoice_id,
            "year_month": year_month,
            "s3_bucket": bucket,
            "s3_key": s3_key,
            "filename": filename,
            "label": label,
            "pdf_password": pdf_password,
        }).encode("utf-8"),
    )

    return ok({
        "invoice_id": invoice_id,
        "year_month": year_month,
        "label": label,
        "status": "processing",
    }, 202)


def _list_invoices(event: dict, user_id: str) -> dict:
    year_month = (event.get("queryStringParameters") or {}).get("yearMonth")
    prefix = f"INVOICE#{year_month}#" if year_month and len(year_month) == 7 else "INVOICE#"

    table = get_table()
    resp = table.query(
        KeyConditionExpression=Key("PK").eq(user_pk(user_id)) & Key("SK").begins_with(prefix),
    )
    invoices = resp.get("Items", [])
    invoices.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return ok([_serialize_invoice(inv) for inv in invoices])


def _delete_invoice(event: dict, user_id: str) -> dict:
    invoice_id = (event.get("pathParameters") or {}).get("invoiceId")
    if not invoice_id:
        return error("invoiceId é obrigatório", 400)

    year_month = (event.get("queryStringParameters") or {}).get("yearMonth")
    invoice = _find_invoice(user_id, invoice_id, year_month)
    if not invoice:
        return error("Fatura não encontrada", 404)

    ym = invoice["year_month"]

    all_txs = get_transactions(user_id, ym)
    to_delete_txs = [tx for tx in all_txs if tx.get("invoice_id") == invoice_id]
    keys_to_delete = [{"PK": tx["PK"], "SK": tx["SK"]} for tx in to_delete_txs]
    if keys_to_delete:
        batch_delete(keys_to_delete)

    delete_item(user_pk(user_id), invoice_sk(ym, invoice_id))

    remaining = [tx for tx in all_txs if tx.get("invoice_id") != invoice_id]
    _rewrite_summary(user_id, ym, remaining)

    return ok({"invoice_id": invoice_id, "deleted_transactions": len(to_delete_txs)})


# ── Async worker ─────────────────────────────────────────────

def _process_invoice_async(event: dict) -> dict:
    user_id = event["user_id"]
    invoice_id = event["invoice_id"]
    year_month = event["year_month"]
    s3_bucket = event["s3_bucket"]
    s3_key = event["s3_key"]
    filename = event["filename"]
    label = event["label"]
    pdf_password = event.get("pdf_password")

    try:
        obj = _s3().get_object(Bucket=s3_bucket, Key=s3_key)
        pdf_bytes = obj["Body"].read()

        provider = get_ai_provider()
        transactions = provider.extract_transactions(
            pdf_bytes, filename,
            password=pdf_password,
            year_month_hint=year_month,
        )

        for tx in transactions:
            put_item({
                "PK": user_pk(user_id),
                "SK": transaction_sk(year_month, tx.id),
                "transaction_id": tx.id,
                "invoice_id": invoice_id,
                "invoice_label": label,
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

        update_item(user_pk(user_id), invoice_sk(year_month, invoice_id), {
            "status": "done",
            "transaction_count": len(transactions),
        })

        print(f"[ASYNC] invoice {invoice_id} done — {len(transactions)} transações")
        return {"ok": True, "invoice_id": invoice_id, "transactions": len(transactions)}

    except PDFPasswordRequired:
        _mark_invoice(user_id, year_month, invoice_id, "error", error_message="Senha do PDF inválida")
        return {"ok": False, "reason": "PDF_PASSWORD_REQUIRED"}
    except Exception as e:
        print(f"[ASYNC ERROR] {traceback.format_exc()}")
        _mark_invoice(user_id, year_month, invoice_id, "error", error_message=str(e)[:200])
        return {"ok": False, "reason": str(e)}
    finally:
        # Sempre deleta o PDF temporário — mesmo em erro (usuário pode re-upload)
        try:
            _s3().delete_object(Bucket=s3_bucket, Key=s3_key)
        except Exception as e:
            print(f"[ASYNC] falha ao deletar S3 key {s3_key}: {e}")


def _mark_invoice(user_id: str, year_month: str, invoice_id: str, status: str, error_message: str = "") -> None:
    updates = {"status": status}
    if error_message:
        updates["error_message"] = error_message
    update_item(user_pk(user_id), invoice_sk(year_month, invoice_id), updates)


# ── Helpers compartilhados ───────────────────────────────────

def _find_invoice(user_id: str, invoice_id: str, year_month: str | None) -> dict | None:
    if year_month:
        item = get_invoice(user_id, year_month, invoice_id)
        if item:
            return item
    table = get_table()
    resp = table.query(
        KeyConditionExpression=Key("PK").eq(user_pk(user_id)) & Key("SK").begins_with("INVOICE#"),
    )
    for item in resp.get("Items", []):
        if item.get("invoice_id") == invoice_id:
            return item
    return None


def _rewrite_summary(user_id: str, year_month: str, transactions: list[dict]) -> None:
    if not transactions:
        delete_item(user_pk(user_id), summary_sk(year_month))
        return

    by_category: dict[str, float] = {}
    total = 0.0
    for tx in transactions:
        try:
            amount = float(tx.get("amount", 0))
        except (TypeError, ValueError):
            amount = 0.0
        total += amount
        cat = tx.get("category", "outros")
        by_category[cat] = round(by_category.get(cat, 0.0) + amount, 2)

    put_item({
        "PK": user_pk(user_id),
        "SK": summary_sk(year_month),
        "year_month": year_month,
        "total": str(round(total, 2)),
        "by_category": {k: str(v) for k, v in by_category.items()},
        "transaction_count": len(transactions),
    })


def _serialize_invoice(item: dict) -> dict:
    out = {k: v for k, v in item.items() if k not in ("PK", "SK", "pdf_hash")}
    if not out.get("label"):
        filename = out.get("filename") or "Fatura"
        out["label"] = filename.rsplit(".", 1)[0] if "." in filename else filename
    if "transaction_count" in out:
        try:
            out["transaction_count"] = int(out["transaction_count"])
        except (TypeError, ValueError):
            out["transaction_count"] = 0
    return out


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
    if existing is None:
        return new

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
    table = get_table()
    resp = table.query(
        KeyConditionExpression=Key("PK").eq(user_pk(user_id)) & Key("SK").begins_with("INVOICE#"),
    )
    for item in resp.get("Items", []):
        if item.get("pdf_hash") == pdf_hash and item.get("status") == "done":
            return True
    return False
