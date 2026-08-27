"""T-11 报销：发票校验与金额核对（gogo 里未完成的部分）。

真实发票识别要走多模态模型（见 NEEDS_LIVE.md），但识别之后的**校验规则**
完全是离线逻辑，也正是容易出错、最该有测试的部分：
  - 发票号重复提交（同一张票报两次）
  - 发票日期不在差旅期间
  - 报销总额超过已确认的预订金额

金额一律用「分」，避免浮点误差——报销对不上账是不能接受的。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime


def _parse_day(value: str) -> date | None:
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y%m%d"):
        try:
            return datetime.strptime((value or "").strip()[:10], fmt).date()
        except ValueError:
            continue
    return None


@dataclass
class Invoice:
    """一张发票。number 为发票号，用于查重。"""

    number: str
    amount: int  # 分
    issue_date: str
    category: str = "other"  # flight/hotel/train/meal/other


@dataclass
class ReimburseIssue:
    code: str
    message: str
    invoice_number: str = ""


@dataclass
class ReimburseResult:
    accepted: list[Invoice] = field(default_factory=list)
    issues: list[ReimburseIssue] = field(default_factory=list)
    total_amount: int = 0

    @property
    def ok(self) -> bool:
        return not self.issues


def validate_invoices(
    invoices: list[Invoice],
    *,
    trip_start: str = "",
    trip_end: str = "",
    booked_total: int | None = None,
    known_numbers: set[str] | None = None,
) -> ReimburseResult:
    """校验一组发票。逐条给出问题，不在第一个错误就停——
    一次性把所有问题告诉用户，比让他改一次提交一次强。
    """
    result = ReimburseResult()
    seen: set[str] = set(known_numbers or set())
    start, end = _parse_day(trip_start), _parse_day(trip_end)

    for inv in invoices:
        number = (inv.number or "").strip()
        if not number:
            result.issues.append(ReimburseIssue("missing_number", "发票号为空，无法查重"))
            continue
        if number in seen:
            result.issues.append(ReimburseIssue("duplicate", f"发票 {number} 重复提交", number))
            continue
        if inv.amount <= 0:
            result.issues.append(
                ReimburseIssue("bad_amount", f"发票 {number} 金额必须大于 0", number)
            )
            continue

        issued = _parse_day(inv.issue_date)
        if issued is None:
            result.issues.append(ReimburseIssue("bad_date", f"发票 {number} 日期无法解析", number))
            continue
        if start and end and not (start <= issued <= end):
            result.issues.append(
                ReimburseIssue(
                    "out_of_range",
                    f"发票 {number} 开票日 {inv.issue_date} 不在差旅期间 {trip_start}~{trip_end}",
                    number,
                )
            )
            continue

        seen.add(number)
        result.accepted.append(inv)
        result.total_amount += inv.amount

    if booked_total is not None and result.total_amount > booked_total:
        result.issues.append(
            ReimburseIssue(
                "exceeds_booking",
                f"报销总额 {result.total_amount} 分超过已确认预订金额 {booked_total} 分",
            )
        )
    return result
