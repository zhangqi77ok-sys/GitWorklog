# -*- coding: utf-8 -*-
"""Policy engine for Tcode Agent actions.

Decision model (three-tier, matching frontend AgentAction contract):

    allow  -> action may proceed silently
    deny   -> action is blocked before execution
    ask    -> action is suspended until a human approves (or trust glob is set)

Default security baseline (industrial grade):
  * DENY   : outbound network commands (re-uses airgap), write outside workspace,
             sensitive system directories, destructive commands on protected roots.
  * ASK    : git push / merges, rm -rf / del / Remove-Item, writes under src/, core/.
  * ALLOW  : read-only commands, writes under tests/, docs/, *.md, logs/, tmp/.

Policies are layered, first match wins:
  1. session trust glob (dynamic, from frontend approvals)
  2. explicit rule table (global policies loaded from policies.json if present)
  3. built-in secure defaults
"""
from __future__ import annotations

import json
import os
import re
import threading
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Tuple

import airgap

# --------------------------------------------------------------------------- #
# Types
# --------------------------------------------------------------------------- #
DECISION_ALLOW = "allow"
DECISION_DENY = "deny"
DECISION_ASK = "ask"
VALID_DECISIONS = {DECISION_ALLOW, DECISION_DENY, DECISION_ASK}


@dataclass(frozen=True)
class PolicyDecision:
    decision: str          # allow | deny | ask
    action_type: str       # write_file | run_command | read_file | *
    target: str            # path or command
    reason: str = ""
    rule_id: str = "default"

    def __bool__(self) -> bool:
        return self.decision == DECISION_ALLOW


@dataclass
class PolicyRule:
    id: str
    action_type: str                 # write_file | run_command | read_file | *
    pattern: str                     # glob or regex (regex when pattern.startswith('re:'))
    decision: str                    # allow | deny | ask
    reason: str = ""
    priority: int = 10               # lower runs first; default rules priority=100

    def matches(self, action_type: str, target: str) -> bool:
        if self.action_type not in ("*", action_type):
            return False
        if self.pattern.startswith("re:"):
            try:
                return re.search(self.pattern[3:], target, re.IGNORECASE) is not None
            except re.error:
                return False
        # glob match (case-insensitive on Windows)
        import fnmatch
        norm = target.replace("/", os.sep)
        return fnmatch.fnmatch(norm.lower(), self.pattern.lower()) or fnmatch.fnmatch(os.path.basename(norm).lower(), self.pattern.lower())


def _default_rules() -> List[PolicyRule]:
    """Industrial-grade built-in rule table."""
    return [
        # ---- DENY: outbound network (air-gap enforcement) ----
        PolicyRule("deny-net", "run_command", "re:.*", DECISION_DENY,
                   "出站网络命令被气隙策略禁止", priority=5,
                   ),
        # ---- DENY: destructive system-wide commands ----
        PolicyRule("deny-rm-root", "run_command", "re:^\\s*(rm\\s+-rf\\s+[/\\\\]|del\\s+/[sqf]|Remove-Item\\s+-Recurse\\s+-Force\\s+[A-Za-z]:[/\\\\]|format\\s+[A-Za-z]:)", DECISION_DENY,
                   "禁止对系统根/盘符递归删除", priority=6),
        # ---- ASK: git push / merge / reset --hard ----
        PolicyRule("ask-git", "run_command", "re:^\\s*git\\s+(push|merge|reset\\s+--hard|rebase|clean)", DECISION_ASK,
                   "Git 写操作需要人工确认", priority=7),
        # ---- ASK: dangerous file operations ----
        PolicyRule("ask-rm", "run_command", "re:^\\s*(rm|del|Remove-Item|rd|rmdir)", DECISION_ASK,
                   "删除类命令需要人工确认", priority=8),
        # ---- ALLOW: read-only commands ----
        PolicyRule("allow-read", "run_command", "re:^\\s*((git\\s+(status|diff|log|branch|remote\\s+-v)|dir|ls|Get-Content|type|cat|pwd|cd|where|which|node\\s+-v|npm\\s+-v|python\\s+--version|pip\\s+list)\\b)", DECISION_ALLOW,
                   "只读命令放行", priority=9),
        # ---- DENY: writes outside workspace roots ----
        PolicyRule("deny-outside", "write_file", "*", DECISION_DENY,
                   "写入路径超出工作区根目录", priority=10),
        # ---- ALLOW: low-risk writes ----
        PolicyRule("allow-tests", "write_file", "re:(tests?|__tests__|specs?)([\\\\/]|$)", DECISION_ALLOW,
                   "测试目录写入放行", priority=11),
        PolicyRule("allow-docs", "write_file", "re:(docs?|readme|CHANGELOG|LICENSE).*\\.(md|rst|txt)$", DECISION_ALLOW,
                   "文档写入放行", priority=11),
        # ---- ASK: protected source dirs ----
        PolicyRule("ask-src", "write_file", "re:(src|core|lib|app)[\\\\/]", DECISION_ASK,
                   "核心源码目录写入需人工确认", priority=12),
        # ---- ASK: config/secret touch ----
        PolicyRule("ask-secret", "write_file", "re:(policies\\.json|settings\\.json|.*token.*|\\.env$|secrets?)", DECISION_ASK,
                   "配置/密钥类文件写入需人工确认", priority=12),
        # ---- ALLOW: everything else (fallback safe default) ----
        PolicyRule("allow-default", "*", "*", DECISION_ALLOW,
                   "未匹配默认放行（策略层已收敛）", priority=100),
    ]


# --------------------------------------------------------------------------- #
# Session trust registry
# --------------------------------------------------------------------------- #
class TrustRegistry:
    """Per-session allowed action/path globs granted by explicit human approval."""

    def __init__(self) -> None:
        self._trusts: dict[str, List[Tuple[str, str]]] = {}
        self._lock = threading.Lock()

    def add(self, session_id: str, action_type: str, path_glob: str) -> None:
        with self._lock:
            self._trusts.setdefault(session_id, []).append((action_type, path_glob))

    def clear_session(self, session_id: str) -> None:
        with self._lock:
            self._trusts.pop(session_id, None)

    def check(self, session_id: str, action_type: str, target: str) -> bool:
        """True if target matches an explicit trust glob for this session."""
        with self._lock:
            for action_type_pattern, glob in self._trusts.get(session_id, []):
                if action_type_pattern not in ("*", action_type):
                    continue
                import fnmatch
                norm_target = target.replace("/", os.sep)
                if fnmatch.fnmatch(norm_target.lower(), glob.lower()):
                    return True
        return False


# --------------------------------------------------------------------------- #
# Policy engine
# --------------------------------------------------------------------------- #
class PolicyEngine:
    """Layered decision engine. Safe by default; rules are first-match-wins
    with lower priority numbers evaluated first. Built-in air-gap is enforced
    unconditionally by raising DenyDecision for network commands."""

    def __init__(self, policy_file: Optional[Path] = None, workspace_roots: Optional[List[str]] = None) -> None:
        self._rules: List[PolicyRule] = _default_rules()
        self._trust = TrustRegistry()
        self._extra_rules: List[PolicyRule] = []
        self._workspace_roots: List[str] = [os.path.normcase(os.path.normpath(r)) for r in (workspace_roots or [])]
        self._lock = threading.Lock()

        if policy_file is not None and Path(policy_file).exists():
            self._load_policy_file(Path(policy_file))

    @classmethod
    def get_instance(cls) -> "PolicyEngine":
        with cls._INSTANCE_LOCK:
            if cls._INSTANCE is None:
                cls._INSTANCE = cls()
            return cls._INSTANCE

    _INSTANCE: Optional["PolicyEngine"] = None
    _INSTANCE_LOCK = threading.Lock()

    def _load_policy_file(self, path: Path) -> None:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            for rule in data.get("rules", []):
                self._extra_rules.append(PolicyRule(
                    id=rule.get("id", "custom"),
                    action_type=rule.get("action_type", "*"),
                    pattern=rule.get("pattern", "*"),
                    decision=rule.get("decision"),
                    reason=rule.get("reason", ""),
                    priority=int(rule.get("priority", 50)),
                ))
        except (json.JSONDecodeError, OSError, ValueError):
            # A malformed policy file must not crash the host: fail closed later.
            self._extra_rules = []

    def set_workspace_roots(self, roots: List[str]) -> None:
        with self._lock:
            self._workspace_roots = [os.path.normcase(os.path.normpath(r)) for r in (roots or [])]
        # keep in sync with path_sandbox so other modules share one source of truth
        try:
            path_sandbox.register_roots(roots)
        except Exception:
            pass

    def trust(self, session_id: str, action_type: str, path_glob: str) -> None:
        self._trust.add(session_id, action_type, path_glob)

    def clear_session(self, session_id: str) -> None:
        self._trust.clear_session(session_id)

    # ------------------------------------------------------------------ #
    def check(self, session_id: str, action_type: str, target: str,
              workspace_roots: Optional[List[str]] = None) -> PolicyDecision:
        """Evaluate policy for a single action.

        Order:
          1. session trust glob (highest, human-approved)
          2. explicit add-on rules (policy file)
          3. built-in default rules
          4. fallback: deny (fail closed)
        """

        # 1) explicit human trust
        if self._trust.check(session_id, action_type, target):
            return PolicyDecision(DECISION_ALLOW, action_type, target,
                                  reason="会话信任规则命中", rule_id="trust")

        # 2) workspace containment for write_file
        if action_type == "write_file":
            roots = workspace_roots or self._workspace_roots
            if roots and not self._inside_roots(target, roots):
                return PolicyDecision(DECISION_DENY, action_type, target,
                                      reason="目标路径超出工作区根目录(路径沙箱)", rule_id="deny-outside")

        # 3) rules first-match-wins (extra + defaults), ordered by priority
        candidates = sorted(self._extra_rules + self._rules, key=lambda r: r.priority)
        for rule in candidates:
            if rule.matches(action_type, target):
                # enforce airgap at code level: net commands are NEVER allow
                if rule.decision == DECISION_ALLOW and action_type == "run_command" and self._is_network_command(target):
                    return PolicyDecision(DECISION_DENY, action_type, target,
                                          reason="气隙策略：出站网络命令被禁止", rule_id="deny-net")
                return PolicyDecision(rule.decision, action_type, target,
                                      reason=rule.reason, rule_id=rule.id)

        # 4) fail closed
        return PolicyDecision(DECISION_DENY, action_type, target,
                              reason="未匹配任何策略，默认拒绝", rule_id="fail-closed")

    # ------------------------------------------------------------------ #
    @staticmethod
    def _is_network_command(cmd: str) -> bool:
        """Air-gap guard: uses the same signature list as airgap module."""
        return any(re.search(p, cmd, re.IGNORECASE) for p in airgap.OUTBOUND_NETWORK_PATTERNS)

    def _inside_roots(self, target: str, roots: List[str]) -> bool:
        norm_target = os.path.normcase(os.path.normpath(os.path.realpath(target)))
        for root in roots:
            norm_root = os.path.normcase(os.path.normpath(os.path.realpath(root)))
            if norm_target == norm_root or norm_target.startswith(norm_root + os.sep):
                return True
        return False


# Re-export airgap patterns for convenience
OUTBOUND_PATTERNS = airgap.OUTBOUND_NETWORK_PATTERNS