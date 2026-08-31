# -*- coding: utf-8 -*-
"""Checkpoint snapshot & rollback service for Tcode Agent sessions.

Design:
- Every checkpoint stores a point-in-time snapshot of files that were written.
- Snapshots are stored under the app storage checkpoint dir:
      <storage>/checkpoints/<session_id>/<checkpoint_id>.json
- The checkpoint file itself is a JSON manifest:
      { "id", "session_id", "created_at" (epoch ms), "kind": "before_write",
        "files": [ { "path", "content_b64" | null (deleted), "encoding": "utf-8"|"latin-1" } ] }
- Rollback = restore the stored content back to the files (idempotent).
"""
from __future__ import annotations

import base64
import difflib
import json
import os
import threading
import time
import uuid
from pathlib import Path
from typing import List, Optional


class CheckpointError(RuntimeError):
    """Raised when a checkpoint operation cannot be completed safely."""


def _b64(s: str) -> str:
    return base64.b64encode(s.encode("utf-8")).decode("ascii")


def _unb64(s: str) -> str:
    return base64.b64decode(s).decode("utf-8")


def _read_text(path: Path) -> Optional[str]:
    """Return file text or None if file does not exist."""
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except FileNotFoundError:
        return None
    except OSError:
        return None


class CheckpointManager:
    """Thread-safe checkpoint store keyed by session id.

    A lock-per-session guarantees that snapshot/list/rollback are atomic
    for a given agent session, while different sessions can proceed in parallel.
    """

    _INSTANCE: Optional["CheckpointManager"] = None
    _INSTANCE_LOCK = threading.Lock()
    _SESSION_LOCKS: dict[str, threading.RLock] = {}
    _SESSION_LOCKS_GUARD = threading.Lock()

    def __init__(self, storage_root: Optional[Path] = None) -> None:
        if storage_root is None:
            app_data = os.environ.get("APPDATA") or os.path.expanduser("~")
            storage_root = Path(app_data) / "Tcode" / "checkpoints"
        self._root = Path(storage_root)

    @classmethod
    def get_instance(cls) -> "CheckpointManager":
        with cls._INSTANCE_LOCK:
            if cls._INSTANCE is None:
                cls._INSTANCE = cls()
            return cls._INSTANCE

    def _lock(self, session_id: str) -> threading.RLock:
        with self._SESSION_LOCKS_GUARD:
            lock = self._SESSION_LOCKS.get(session_id)
            if lock is None:
                lock = threading.RLock()
                self._SESSION_LOCKS[session_id] = lock
            return lock

    def _session_dir(self, session_id: str) -> Path:
        # Neutralize any path traversal attempts in the session id itself.
        safe = "".join(c if c.isalnum() or c in "-_." else "_" for c in session_id)
        d = self._root / safe
        d.mkdir(parents=True, exist_ok=True)
        return d

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #
    def snapshot(self, session_id: str, paths: List[str], kind: str = "before_write",
                 metadata: Optional[dict] = None) -> dict:
        """Create a snapshot of the CURRENT content of `paths` (i.e. the
        pre-write state). Returns the checkpoint manifest dict.

        If a path does not exist yet, its content is recorded as None and
        rollback will delete the file.
        """
        if not isinstance(paths, list) or not paths:
            raise CheckpointError("snapshot() requires a non-empty list of paths")

        with self._lock(session_id):
            checkpoint_id = uuid.uuid4().hex[:12]
            snap_path = self._session_dir(session_id) / f"{checkpoint_id}.json"

            files_payload = []
            for raw in paths:
                p = Path(raw)
                content = _read_text(p)
                files_payload.append({
                    "path": os.path.normpath(str(p)),
                    "content_b64": _b64(content) if content is not None else None,
                    "existed": content is not None,
                })

            manifest = {
                "id": checkpoint_id,
                "session_id": session_id,
                "created_at": int(time.time() * 1000),
                "kind": kind,
                "metadata": metadata or {},
                "files": files_payload,
            }
            self._atomic_write_json(snap_path, manifest)
            return manifest

    def list(self, session_id: str) -> List[dict]:
        """Return checkpoint timeline (newest first) for a session."""
        session_dir = self._session_dir(session_id)
        out = []
        if not session_dir.is_dir():
            return out
        for f in sorted(session_dir.glob("*.json"), reverse=True):
            try:
                m = json.loads(f.read_text(encoding="utf-8"))
                out.append({
                    "id": m.get("id"),
                    "created_at": m.get("created_at"),
                    "kind": m.get("kind", "unknown"),
                    "file_count": len(m.get("files", [])),
                    "metadata": m.get("metadata", {}),
                })
            except (json.JSONDecodeError, OSError):
                continue  # skip corrupt snapshot, do not crash timeline
        return out

    def get(self, session_id: str, checkpoint_id: str) -> Optional[dict]:
        with self._lock(session_id):
            p = self._session_dir(session_id) / f"{checkpoint_id}.json"
            if not p.exists():
                return None
            try:
                return json.loads(p.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                return None

    def diff(self, session_id: str, checkpoint_id: str) -> List[dict]:
        """Unified diff between checkpoint snapshot and the current file state."""
        manifest = self.get(session_id, checkpoint_id)
        if manifest is None:
            raise CheckpointError(f"checkpoint {checkpoint_id} not found")

        diffs = []
        for f in manifest["files"]:
            path = Path(f["path"])
            snapshot_text: Optional[str]
            if f.get("content_b64") is not None:
                snapshot_text = _unb64(f["content_b64"])
            else:
                snapshot_text = None

            current_text = _read_text(path)
            if snapshot_text is None and current_text is None:
                continue  # no change
            if snapshot_text is None:
                diffs.append({"path": str(path), "status": "deleted", "diff": None})
                continue
            if current_text is None:
                diffs.append({"path": str(path), "status": "added", "diff": None})
                continue
            if snapshot_text == current_text:
                continue
            ud = difflib.unified_diff(
                snapshot_text.splitlines(keepends=True),
                current_text.splitlines(keepends=True),
                fromfile=f"{path} (checkpoint)",
                tofile=f"{path} (current)",
            )
            diffs.append({"path": str(path), "status": "modified",
                          "diff": "".join(ud)})
        return diffs

    def rollback(self, session_id: str, checkpoint_id: str,
                 target_paths: Optional[List[str]] = None) -> List[str]:
        """Restore the checkpoint content over the current files.

        Returns the list of paths that were restored.
        """
        with self._lock(session_id):
            manifest = self.get(session_id, checkpoint_id)
            if manifest is None:
                raise CheckpointError(f"checkpoint {checkpoint_id} not found")

            restored = []
            for f in manifest["files"]:
                path = Path(f["path"])
                if target_paths is not None:
                    norm_targets = {os.path.normpath(t) for t in target_paths}
                    if os.path.normpath(str(path)) not in norm_targets:
                        continue

                if f.get("content_b64") is not None:
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_text(_unb64(f["content_b64"]), encoding="utf-8")
                    restored.append(str(path))
                else:
                    # File did not exist at snapshot time: remove if present.
                    if path.exists():
                        path.unlink()
                        restored.append(str(path))
            return restored

    def delete_session(self, session_id: str) -> int:
        """Drop all checkpoints of a session; returns number of files removed."""
        with self._lock(session_id):
            session_dir = self._session_dir(session_id)
            count = 0
            if session_dir.is_dir():
                for f in session_dir.glob("*.json"):
                    try:
                        f.unlink()
                        count += 1
                    except OSError:
                        pass
            return count

    # ------------------------------------------------------------------ #
    # Helpers
    # ------------------------------------------------------------------ #
    def _atomic_write_json(self, path: Path, payload: dict) -> None:
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, path)