"""Pure window geometry helpers and monitor resolution for the Windows desktop host."""

from __future__ import annotations
import ctypes
from ctypes import wintypes


def fit_window_size(
    work_area: tuple[int, int, int, int],
    preferred_size: tuple[int, int] = (1440, 900),
    minimum_size: tuple[int, int] = (1024, 640),
) -> tuple[int, int]:
    """
    Fits the window width and height within the work area.
    If the screen is smaller than preferred, scales down gracefully while respecting minimum size.
    """
    left, top, right, bottom = work_area
    work_width = max(0, right - left)
    work_height = max(0, bottom - top)

    # Use up to 92% of available work area if smaller than preferred
    max_w = max(minimum_size[0], int(work_width * 0.95))
    max_h = max(minimum_size[1], int(work_height * 0.95))

    target_w = min(preferred_size[0], max_w)
    target_h = min(preferred_size[1], max_h)

    return target_w, target_h


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


def get_monitor_work_area() -> tuple[int, int, int, int]:
    """
    Fetches the true DPI-aware available work area (excluding taskbars/docks)
    for the primary or active monitor.
    """
    try:
        user32 = ctypes.windll.user32
        # Set Per-Monitor DPI Aware
        try:
            user32.SetProcessDpiAwarenessContext(-4)  # DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2
        except Exception:
            try:
                user32.SetProcessDPIAware()
            except Exception:
                pass

        class RECT(ctypes.Structure):
            _fields_ = [
                ("left", wintypes.LONG),
                ("top", wintypes.LONG),
                ("right", wintypes.LONG),
                ("bottom", wintypes.LONG),
            ]

        # 1. Try to get monitor under cursor
        class POINT(ctypes.Structure):
            _fields_ = [("x", wintypes.LONG), ("y", wintypes.LONG)]

        class MONITORINFO(ctypes.Structure):
            _fields_ = [
                ("cbSize", wintypes.DWORD),
                ("rcMonitor", RECT),
                ("rcWork", RECT),
                ("dwFlags", wintypes.DWORD),
            ]

        pt = POINT()
        if user32.GetCursorPos(ctypes.byref(pt)):
            h_monitor = user32.MonitorFromPoint(pt, 2)  # MONITOR_DEFAULTTONEAREST = 2
            if h_monitor:
                mi = MONITORINFO()
                mi.cbSize = ctypes.sizeof(MONITORINFO)
                if user32.GetMonitorInfoW(h_monitor, ctypes.byref(mi)):
                    w = mi.rcWork
                    return (w.left, w.top, w.right, w.bottom)

        # Fallback to SystemParametersInfoW SPI_GETWORKAREA = 48
        wa = RECT()
        if user32.SystemParametersInfoW(48, 0, ctypes.byref(wa), 0):
            return (wa.left, wa.top, wa.right, wa.bottom)

        # Ultimate fallback to system metrics
        sw = user32.GetSystemMetrics(0)
        sh = user32.GetSystemMetrics(1)
        return (0, 0, sw, sh)
    except Exception:
        return (0, 0, 1920, 1080)
