from fastapi import APIRouter
from app.core.response import R

router = APIRouter(tags=["health"])

@router.get("/health")
def health() -> R[dict[str, str]]:
    return R.ok({"status": "up", "platform": "RunCabinet Vite Coding Studio"})
