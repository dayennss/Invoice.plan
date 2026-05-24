from shared.auth import verify_token
from shared.response import ok, error
from shared.db import get_transactions, get_summary, user_pk


def lambda_handler(event: dict, context) -> dict:
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return ok({})

    user_id, err = verify_token(event)
    if err:
        return err

    year_month = (event.get("pathParameters") or {}).get("yearMonth", "")
    if not year_month or len(year_month) != 7:
        return error("yearMonth inválido. Use o formato YYYY-MM", 400)

    summary = get_summary(user_id, year_month)
    transactions = get_transactions(user_id, year_month)

    # Converte Decimal para float (DynamoDB retorna Decimal)
    def to_float(v):
        try:
            return float(v)
        except (TypeError, ValueError):
            return 0.0

    return ok({
        "year_month": year_month,
        "summary": {
            "total": to_float(summary.get("total", 0)) if summary else 0,
            "by_category": {
                k: to_float(v)
                for k, v in (summary.get("by_category", {}) if summary else {}).items()
            },
            "transaction_count": int(summary.get("transaction_count", 0)) if summary else 0,
        },
        "transactions": [
            {
                **{k: v for k, v in tx.items() if k not in ("PK", "SK")},
                "amount": to_float(tx.get("amount", 0)),
            }
            for tx in sorted(transactions, key=lambda x: x.get("date", ""), reverse=True)
        ],
    })
