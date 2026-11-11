#!/usr/bin/env python3
"""PreToolUse hook protecting generated assets, build artifacts, and source bundles."""

from __future__ import annotations

import json
import os
import re
import sys

from _common import (
    WRITE_TOOL_NAMES,
    extract_target_relpath,
    read_payload,
    resolve_relpath_in_repo,
    resolve_repo_root,
    split_shell_segments,
    strip_command_prefixes,
)

BLOCKED_PREFIXES = (
    (
        "web/public/assets",
        "web/public/assets/ is gitignored generated output. Edit canonical assets under assets/iemap/ and run 'npm run sync:assets' (node scripts/sync_web_assets.mjs) instead.",
    ),
    (
        "web/dist",
        "web/dist/ is Vite build output. Edit web/src/ and rebuild cleanly via 'npm run build'.",
    ),
    (
        "assets/iemap_bundle_extracted",
        "assets/iemap_bundle_extracted/ is a read-only upstream IE-Map bundle. Write processed outputs to assets/iemap/ via src/anatomy/ or scripts/.",
    ),
    (
        "assets/iemap_source_bundle",
        "assets/iemap_source_bundle/ is a read-only upstream IE-Map archive. Write processed outputs to assets/iemap/ via src/anatomy/ or scripts/.",
    ),
)

DESTRUCTIVE_CMD_FALLBACK_PATTERNS = (
    (
        re.compile(r"\bgit\b[^\n;]*\bpush\b[^\n;]*(?:\s--force\b|\s-f\b)"),
        "Force-pushing git history (git push --force / -f) is blocked by inner-ear-lab safety guard.",
    ),
    (
        re.compile(r"\brm\b[^\n;]*-[^\n;]*r[^\n;]*\s+['\"]?(?:[^\s'\"]*/)?assets/iemap(?:/|\s|['\"]|$)"),
        "Deleting canonical assets/iemap/ recursively is blocked by inner-ear-lab safety guard.",
    ),
    (
        re.compile(r"\brm\b[^\n;]*-[^\n;]*r[^\n;]*\s+['\"]?(?:[^\s'\"]*/)?\.git(?:/|\s|['\"]|$)"),
        "Deleting .git repository metadata is blocked by inner-ear-lab safety guard.",
    ),
)

_GIT_FLAGS_WITH_VALUE = frozenset({
    "-C",
    "-c",
    "--git-dir",
    "--work-tree",
    "--namespace",
    "--super-prefix",
    "--exec-path",
    "--list-cmds",
})

_MUTATING_FILE_CMDS = frozenset({
    "tee",
    "touch",
    "mkdir",
    "cp",
    "mv",
    "install",
    "ln",
    "truncate",
    "dd",
    "rmdir",
})


def _match_blocked_prefix(rel: str | None) -> str | None:
    if rel is None:
        return None
    for prefix, reason in BLOCKED_PREFIXES:
        if rel == prefix or rel.startswith(prefix + "/"):
            return reason
    return None


def _normalize_rm_target(raw_target: str, repo_root: str) -> str | None:
    cleaned = raw_target.strip()
    if not cleaned:
        return None
    while cleaned.endswith("/*") or cleaned.endswith("/"):
        if cleaned.endswith("/*"):
            cleaned = cleaned[:-2]
        else:
            cleaned = cleaned[:-1]
    if not cleaned:
        cleaned = "/"
    return resolve_relpath_in_repo(cleaned, repo_root)


def _check_git_force_push(tokens: list[str]) -> str | None:
    i = 1
    subcmd: str | None = None
    while i < len(tokens):
        tok = tokens[i]
        if tok in _GIT_FLAGS_WITH_VALUE:
            i += 2
            continue
        if any(tok.startswith(f + "=") for f in ("--git-dir", "--work-tree", "--namespace", "--exec-path")):
            i += 1
            continue
        if tok.startswith("-") and tok != "--":
            i += 1
            continue
        subcmd = tok
        i += 1
        break

    if subcmd != "push":
        return None

    for tok in tokens[i:]:
        if tok == "--":
            break
        if tok == "--force":
            return "Force-pushing git history (git push --force / -f) is blocked by inner-ear-lab safety guard."
        if tok.startswith("-") and not tok.startswith("--") and "f" in tok[1:]:
            return "Force-pushing git history (git push --force / -f) is blocked by inner-ear-lab safety guard."
    return None


def _check_rm_recursive(tokens: list[str], repo_root: str) -> str | None:
    is_recursive = False
    targets: list[str] = []
    after_double_dash = False
    for tok in tokens[1:]:
        if tok == "--" and not after_double_dash:
            after_double_dash = True
            continue
        if not after_double_dash and tok.startswith("-"):
            if tok == "--recursive" or (not tok.startswith("--") and ("r" in tok[1:] or "R" in tok[1:])):
                is_recursive = True
            continue
        targets.append(tok)

    for raw in targets:
        rel = _normalize_rm_target(raw, repo_root)
        if rel is None:
            continue
        if is_recursive:
            if rel in {"", "assets", "assets/iemap"}:
                return "Deleting canonical assets/iemap/ recursively is blocked by inner-ear-lab safety guard."
            if rel == ".git" or rel.startswith(".git/"):
                return "Deleting .git repository metadata is blocked by inner-ear-lab safety guard."
        blocked_reason = _match_blocked_prefix(rel)
        if blocked_reason:
            return blocked_reason
    return None


def _check_mutating_file_cmd(exe: str, tokens: list[str], repo_root: str) -> str | None:
    destinations: list[str] = []
    positional: list[str] = []
    after_double_dash = False
    i = 1
    while i < len(tokens):
        tok = tokens[i]
        if tok == "--" and not after_double_dash:
            after_double_dash = True
            i += 1
            continue
        if not after_double_dash and tok in {"-t", "--target-directory"}:
            if i + 1 < len(tokens):
                destinations.append(tokens[i + 1])
                i += 2
                continue
        if not after_double_dash and tok.startswith("--target-directory="):
            destinations.append(tok.split("=", 1)[1])
            i += 1
            continue
        if exe == "dd" and tok.startswith("of="):
            destinations.append(tok[3:])
            i += 1
            continue
        if not after_double_dash and tok.startswith("-") and tok != "-":
            i += 1
            continue
        positional.append(tok)
        i += 1

    if exe in {"cp", "mv", "ln", "install"}:
        if not destinations and len(positional) >= 2:
            destinations.append(positional[-1])
    elif exe in {"tee", "touch", "mkdir", "truncate", "rmdir"}:
        destinations.extend(positional)

    for dest in destinations:
        rel = resolve_relpath_in_repo(dest, repo_root)
        reason = _match_blocked_prefix(rel)
        if reason:
            return reason
    return None


def _inspect_command_string(cmd: str, repo_root: str, depth: int = 0) -> str | None:
    if depth > 3 or not cmd.strip():
        return None
    segments, parsed_cleanly = split_shell_segments(cmd)
    if not parsed_cleanly:
        for pattern, reason in DESTRUCTIVE_CMD_FALLBACK_PATTERNS:
            if pattern.search(cmd):
                return reason
        return None

    for seg in segments:
        for redir in seg.get("redirects") or []:
            rel = resolve_relpath_in_repo(redir, repo_root)
            reason = _match_blocked_prefix(rel)
            if reason:
                return reason

        head = strip_command_prefixes(seg.get("argv") or [])
        if not head:
            continue
        exe = os.path.basename(head[0])

        if exe == "git":
            reason = _check_git_force_push(head)
            if reason:
                return reason
        elif exe == "rm":
            reason = _check_rm_recursive(head, repo_root)
            if reason:
                return reason
        elif exe in _MUTATING_FILE_CMDS:
            reason = _check_mutating_file_cmd(exe, head, repo_root)
            if reason:
                return reason
        elif exe in {"sh", "bash", "zsh"}:
            # Inspect inline `-c "<script>"` scripts cleanly
            j = 1
            while j < len(head):
                tok = head[j]
                if tok == "--":
                    break
                if tok == "-c" or (tok.startswith("-") and not tok.startswith("--") and "c" in tok[1:]):
                    if j + 1 < len(head):
                        nested = _inspect_command_string(head[j + 1], repo_root, depth + 1)
                        if nested:
                            return nested
                    break
                j += 1

    return None


def main() -> int:
    payload = read_payload()
    repo_root = resolve_repo_root(payload)
    tool_call = payload.get("toolCall") or {}
    tool_name = str(tool_call.get("name", ""))
    args = tool_call.get("args") or {}

    if tool_name in WRITE_TOOL_NAMES:
        rel = extract_target_relpath(args, repo_root)
        reason = _match_blocked_prefix(rel)
        if reason:
            print(json.dumps({"decision": "deny", "reason": reason}))
            return 0

    elif tool_name == "run_command":
        cmd = str(args.get("CommandLine") or args.get("command") or "")
        reason = _inspect_command_string(cmd, repo_root)
        if reason:
            print(json.dumps({"decision": "deny", "reason": reason}))
            return 0

    print(json.dumps({"decision": "allow"}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
