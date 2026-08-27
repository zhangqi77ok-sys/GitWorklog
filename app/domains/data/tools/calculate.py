"""计算工具（替代 dodo 的 CalculateTool / exp4j）。

用于同环比/占比/贡献度等最终标量计算。聚合(SUM/AVG/COUNT)应推给 SQL，
本工具只做基于已得数值的算术。用 AST 白名单求值，杜绝任意代码执行。
"""

from __future__ import annotations

import ast
import math
import operator
from collections.abc import Callable
from typing import Any

_BIN_OPS: dict[type[ast.operator], Callable[[Any, Any], Any]] = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
    ast.FloorDiv: operator.floordiv,
}
_UNARY_OPS: dict[type[ast.unaryop], Callable[[Any], Any]] = {
    ast.UAdd: operator.pos,
    ast.USub: operator.neg,
}
_FUNCS: dict[str, Any] = {
    "round": round,
    "abs": abs,
    "min": min,
    "max": max,
    "sqrt": math.sqrt,
}


class CalculateError(Exception):
    pass


def calculate(expression: str) -> float:
    """求值算术表达式。仅支持数字、四则、幂/取模、round/abs/min/max/sqrt。"""
    try:
        tree = ast.parse(expression, mode="eval")
    except SyntaxError as e:
        raise CalculateError(f"表达式无法解析: {e}") from e
    return float(_eval(tree.body))


def _eval(node: ast.AST) -> Any:
    if isinstance(node, ast.Constant):
        if isinstance(node.value, (int, float)):
            return node.value
        raise CalculateError("只允许数字常量")
    if isinstance(node, ast.BinOp):
        bin_op = _BIN_OPS.get(type(node.op))
        if bin_op is None:
            raise CalculateError("不支持的运算符")
        return bin_op(_eval(node.left), _eval(node.right))
    if isinstance(node, ast.UnaryOp):
        un_op = _UNARY_OPS.get(type(node.op))
        if un_op is None:
            raise CalculateError("不支持的一元运算符")
        return un_op(_eval(node.operand))
    if isinstance(node, ast.Call):
        if not isinstance(node.func, ast.Name) or node.func.id not in _FUNCS:
            raise CalculateError("不支持的函数")
        args = [_eval(a) for a in node.args]
        return _FUNCS[node.func.id](*args)
    raise CalculateError(f"不允许的表达式节点: {type(node).__name__}")
