"""Workspace root registry & path boundary enforcement."""
import os

_roots: list[str] = []


def _norm(path: str) -> str:
    return os.path.normcase(os.path.normpath(os.path.realpath(path)))


def register_roots(paths) -> int:
    added = 0
    for p in paths or []:
        if not p:
            continue
        real = _norm(str(p))
        if real and real not in _roots:
            _roots.append(real)
            added += 1
    return added


def clear_roots() -> None:
    _roots.clear()


def is_within_roots(target) -> bool:
    if not target:
        return False
    real = _norm(str(target))
    for root in _roots:
        if real == root or real.startswith(root + os.sep):
            return True
    return False


class PathSandboxError(Exception):
    pass


def assert_path_allowed(target: str) -> None:
    if not is_within_roots(target):
        raise PathSandboxError(f"Path outside registered workspaces: {target}")
