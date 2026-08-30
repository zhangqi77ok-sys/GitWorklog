import importlib.util
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "src-desktop" / "window_geometry.py"
_spec = importlib.util.spec_from_file_location("window_geometry", MODULE_PATH)
window_geometry = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(window_geometry)


center_window = window_geometry.center_window


def test_centers_window_in_available_work_area():
    assert center_window((0, 0, 1920, 1080), (1440, 900)) == (240, 90)


def test_respects_taskbar_offset_in_work_area():
    assert center_window((0, 40, 1920, 1040), (1440, 900)) == (240, 90)


def test_supports_negative_coordinates_on_secondary_monitor():
    assert center_window((-1920, 0, 0, 1080), (1440, 900)) == (-1680, 90)


def test_clamps_when_window_is_larger_than_work_area():
    assert center_window((100, 50, 900, 650), (1440, 900)) == (100, 50)
