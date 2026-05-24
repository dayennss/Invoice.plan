from pydantic import BaseModel
from typing import Literal, Optional
from datetime import datetime

TransactionCategory = Literal[
    "alimentacao", "transporte", "moradia", "saude",
    "lazer", "educacao", "assinaturas", "vestuario",
    "transferencias", "outros"
]


class Transaction(BaseModel):
    id: str
    description: str
    amount: float
    date: str
    category: TransactionCategory
    installment_current: Optional[int] = None
    installment_total: Optional[int] = None
    is_recurring: bool = False


class Invoice(BaseModel):
    id: str
    user_id: str
    bank: str
    year_month: str
    status: Literal["processing", "done", "error"]
    created_at: str


class MonthlySummary(BaseModel):
    year_month: str
    total: float
    by_category: dict[str, float]
    transaction_count: int
