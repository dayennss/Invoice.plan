import os
import boto3
from boto3.dynamodb.conditions import Key

_table = None


def get_table():
    global _table
    if _table is None:
        dynamodb = boto3.resource("dynamodb", region_name=os.environ.get("AWS_REGION", "sa-east-1"))
        _table = dynamodb.Table(os.environ["DYNAMODB_TABLE"])
    return _table


# ── Key helpers ──────────────────────────────────────────────

def user_pk(user_id: str) -> str:
    return f"USER#{user_id}"

def invoice_sk(year_month: str, invoice_id: str) -> str:
    return f"INVOICE#{year_month}#{invoice_id}"

def transaction_sk(year_month: str, transaction_id: str) -> str:
    return f"TRANSACTION#{year_month}#{transaction_id}"

def summary_sk(year_month: str) -> str:
    return f"SUMMARY#{year_month}"


# ── Queries ──────────────────────────────────────────────────

def get_transactions(user_id: str, year_month: str) -> list[dict]:
    table = get_table()
    resp = table.query(
        KeyConditionExpression=Key("PK").eq(user_pk(user_id)) & Key("SK").begins_with(f"TRANSACTION#{year_month}"),
    )
    return resp.get("Items", [])


def get_summary(user_id: str, year_month: str) -> dict | None:
    table = get_table()
    resp = table.get_item(Key={"PK": user_pk(user_id), "SK": summary_sk(year_month)})
    return resp.get("Item")


def put_item(item: dict) -> None:
    get_table().put_item(Item=item)


def update_item(pk: str, sk: str, updates: dict) -> None:
    expr = "SET " + ", ".join(f"#{k} = :{k}" for k in updates)
    names = {f"#{k}": k for k in updates}
    values = {f":{k}": v for k, v in updates.items()}
    get_table().update_item(
        Key={"PK": pk, "SK": sk},
        UpdateExpression=expr,
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=values,
    )
