#!/usr/bin/env python3
"""Shared path resolution and per-workspace state helpers for inner-ear-lab hooks."""

from __future__ import annotations

import hashlib
import json
import os
import re
import shlex
import subprocess
import tempfile
from pathlib import Path
from typing import Any

_ENV_ASSIGN_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*=.*$")

WRITE_TOOL_NAMES = frozenset({
    "write_file",
    "edit_file",
    "write_to_file",
    "replace_file_content",
    "multi_replace_file_content",
})

PATH_ARG_KEYS = (
    "Path",
    "TargetFile",
    "AbsolutePath",
    "path",
    "file_path",
    "target_file",
    "filePath",
)


def read_payload() -> dict[str, Any]:
    try:
        raw = os.sys.stdin.read()
        if not raw or not raw.strip():
            return {}
        data = json.loads(raw)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def resolve_repo_root(payload: dict[str, Any]) -> str:
    workspace_paths = payload.get("workspacePaths")
    if isinstance(workspace_paths, list):
        resolved_candidates: list[str] = []
        for entry in workspace_paths:
            if isinstance(entry, str) and entry.strip():
                cand = os.path.realpath(entry.strip())
                resolved_candidates.append(cand)
                if os.path.exists(os.path.join(cand, "package.json")) or os.path.exists(
                    os.path.join(cand, ".git")
                ):
                    return cand
        if resolved_candidates:
            return resolved_candidates[0]

    # Fallback 1: 4 levels up from hooks/_common.py -> <repo>
    file_repo = os.path.realpath(str(Path(__file__).resolve().parents[4]))
    if os.path.exists(os.path.join(file_repo, "package.json")):
        return file_repo

    # Fallback 2: git rev-parse
    try:
        top = subprocess.check_output(
            ["git", "rev-parse", "--show-toplevel"],
            stderr=subprocess.DEVNULL,
            text=True,
            timeout=2,
        ).strip()
        if top:
            return os.path.realpath(top)
    except Exception:
        pass

    return file_repo


def resolve_relpath_in_repo(
    raw_path: str,
    repo_root: str,
    base_dir: str | None = None,
) -> str | None:
    if not raw_path or not isinstance(raw_path, str):
        return None
    expanded = os.path.expanduser(raw_path.strip())
    if not expanded:
        return None
    if not os.path.isabs(expanded):
        expanded = os.path.join(base_dir or repo_root, expanded)
    resolved = os.path.realpath(expanded)
    norm_root = os.path.realpath(repo_root)

    try:
        rel = os.path.relpath(resolved, norm_root)
    except ValueError:
        return None

    if rel == ".":
        return ""
    if rel.startswith("..") or os.path.isabs(rel):
        return None
    return rel.replace(os.sep, "/")


def extract_target_relpath(args: dict[str, Any], repo_root: str) -> str | None:
    if not isinstance(args, dict):
        return None
    raw_path = None
    for key in PATH_ARG_KEYS:
        val = args.get(key)
        if isinstance(val, str) and val.strip():
            raw_path = val.strip()
            break
    if raw_path is None:
        return None
    return resolve_relpath_in_repo(raw_path, repo_root)


def state_file_path(repo_root: str) -> str:
    norm_root = os.path.realpath(repo_root)
    digest = hashlib.sha256(norm_root.encode("utf-8")).hexdigest()[:16]
    shared_tmp = "/tmp" if os.path.isdir("/tmp") and os.access("/tmp", os.W_OK) else tempfile.gettempdir()
    return os.path.join(shared_tmp, f"agy-inner-ear-{digest}.json")


def split_shell_segments(cmd: str) -> tuple[list[dict[str, Any]], bool]:
    """Parse a shell command into segments of argv tokens and redirect targets.

    Returns (segments, parsed_cleanly). Quoted strings stay intact as single tokens
    so e.g. `git commit -m 'npm test'` does not expose `'npm test'` as a command.
    """
    if not cmd or not cmd.strip():
        return [], True

    lexer = shlex.shlex(cmd, posix=True, punctuation_chars=";|&><\n")
    lexer.whitespace_split = True
    lexer.whitespace = " \t\r"
    lexer.commenters = "#"
    tokens: list[str] = []
    try:
        for tok in lexer:
            tokens.append(tok)
    except ValueError:
        return [], False

    segments: list[dict[str, Any]] = []
    current_argv: list[str] = []
    current_redirects: list[str] = []
    i = 0
    while i < len(tokens):
        tok = tokens[i]
        if tok in {";", "&&", "||", "|", "&", "\n"}:
            if current_argv or current_redirects:
                segments.append({"argv": current_argv, "redirects": current_redirects})
                current_argv = []
                current_redirects = []
            i += 1
            continue

        # Handle redirection operators (`>`, `>>`, `>|`) without eating `>&` fd dups
        if tok in {">", ">>", ">|"}:
            # Drop optional single fd digit prefix attached to argv just before redirect (e.g. `2>`)
            if current_argv and current_argv[-1].isdigit() and len(current_argv[-1]) == 1:
                current_argv.pop()
            if i + 1 < len(tokens) and tokens[i + 1] not in {";", "&&", "||", "|", "&", "\n", ">", ">>", "<"}:
                current_redirects.append(tokens[i + 1])
                i += 2
                continue
        elif tok in {">&", ">>&"}:
            if current_argv and current_argv[-1].isdigit() and len(current_argv[-1]) == 1:
                current_argv.pop()
            if i + 1 < len(tokens):
                i += 2
                continue
        elif tok in {"<", "<<", "<<<"}:
            if i + 1 < len(tokens):
                i += 2
                continue

        current_argv.append(tok)
        i += 1

    if current_argv or current_redirects:
        segments.append({"argv": current_argv, "redirects": current_redirects})
    return segments, True


def strip_command_prefixes(argv: list[str]) -> list[str]:
    """Strip leading `VAR=val`, `env ...`, and `command` prefixes to expose executable."""
    i = 0
    while i < len(argv):
        tok = argv[i]
        if _ENV_ASSIGN_RE.match(tok):
            i += 1
            continue
        if tok == "env":
            i += 1
            while i < len(argv):
                sub = argv[i]
                if sub in {"-u", "-C", "--chdir", "--unset"}:
                    i += 2
                    continue
                if sub.startswith("-") or _ENV_ASSIGN_RE.match(sub):
                    i += 1
                    continue
                break
            continue
        if tok == "command":
            i += 1
            while i < len(argv) and argv[i] in {"-p", "-v", "-V"}:
                i += 1
            continue
        break
    return argv[i:]


def default_state(repo_root: str) -> dict[str, Any]:
    return {
        "repoRoot": os.path.realpath(repo_root),
        "dirty": False,
        "dirtyScopes": [],
        "dirtyFiles": [],
        "tscError": "",
        "syncError": "",
        "reminderCount": 0,
        "lastPassAt": 0.0,
    }


def load_state(repo_root: str) -> dict[str, Any]:
    path = state_file_path(repo_root)
    base = default_state(repo_root)
    try:
        with open(path, "r", encoding="utf-8") as fh:
            loaded = json.load(fh)
        if isinstance(loaded, dict):
            base.update(loaded)
    except FileNotFoundError:
        pass
    except Exception:
        pass
    if not isinstance(base.get("dirtyScopes"), list):
        base["dirtyScopes"] = []
    if not isinstance(base.get("dirtyFiles"), list):
        base["dirtyFiles"] = []
    base["dirty"] = bool(base["dirtyScopes"]) or bool(base.get("dirty"))
    return base


def save_state(repo_root: str, state: dict[str, Any]) -> None:
    path = state_file_path(repo_root)
    parent = os.path.dirname(path)
    os.makedirs(parent, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=".agy-inner-ear-", suffix=".tmp", dir=parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(state, fh, indent=2, sort_keys=True)
        os.replace(tmp_name, path)
    finally:
        if os.path.exists(tmp_name):
            try:
                os.unlink(tmp_name)
            except OSError:
                pass
