"""Pure window geometry helpers for the Windows desktop host."""

from __future__ import annotations


def center_window(
    work_area: tuple[int, int, int, int],
    window_size: tuple[int, int],
) -> tuple[int, int]:
    """Return a safe centered top-left position inside a monitor work area."""
    left, top, right, bottom = work_area
    width, height = window_size
    work_width = max(0, right - left)
    work_height = max(0, bottom - top)

    x = left + max(0, (work_width - width) // 2)
    y = top + max(0, (work_height - height) // 2)
    return x, y
