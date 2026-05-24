import os
import firebase_admin
from firebase_admin import auth, credentials
from .response import error

_initialized = False


def _init_firebase():
    global _initialized
    if not _initialized:
        cred = credentials.Certificate(os.environ["FIREBASE_SERVICE_ACCOUNT_JSON"])
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
