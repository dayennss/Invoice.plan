import os
import json
import boto3
import firebase_admin
from firebase_admin import auth, credentials
from .response import error

_initialized = False


def _get_ssm_value(param_name: str) -> str:
    client = boto3.client("ssm", region_name=os.environ.get("AWS_ACCOUNT_REGION", "us-east-1"))
    resp = client.get_parameter(Name=param_name, WithDecryption=True)
    return resp["Parameter"]["Value"]


def _init_firebase():
    global _initialized
    if not _initialized:
        ssm_param = os.environ.get("SSM_FIREBASE_SERVICE_ACCOUNT_JSON")
        if ssm_param:
            sa_json = _get_ssm_value(ssm_param)
        else:
            sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON", "")
        cred = credentials.Certificate(json.loads(sa_json))
        firebase_admin.initialize_app(cred)
        _initialized = True


def verify_token(event: dict) -> tuple[str | None, dict | None]:
    """
    Returns (user_id, None) on success or (None, error_response) on failure.
    """
    _init_firebase()

    auth_header = (event.get("headers") or {}).get("authorization", "")
    if not auth_header.startswith("Bearer "):
        return None, error("Missing authorization header", 401)

    token = auth_header.split(" ", 1)[1]
    try:
        decoded = auth.verify_id_token(token)
        return decoded["uid"], None
    except Exception:
        return None, error("Invalid or expired token", 401)
