from typing import Generic, TypeVar, Any
from pydantic import BaseModel

T = TypeVar("T")

class R(BaseModel, Generic[T]):
    code: int = 0
    message: str = "ok"
    data: T | None = None

    @classmethod
    def ok(cls, data: T = None, message: str = "ok") -> "R[T]":
        return cls(code=0, message=message, data=data)

    @classmethod
    def fail(cls, code: int = 1, message: str = "error", data: Any = None) -> "R[Any]":
        return cls(code=code, message=message, data=data)
