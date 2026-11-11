#!/usr/bin/env python3
"""PostToolUse hook syncing IE-Map assets, tracking verification state, and running fast tsc checks."""

from __future__ import annotations

import os
import subprocess
import sys
import time

from _common import (
    WRITE_TOOL_NAMES,
    extract_target_relpath,
    load_state,
    read_payload,
    resolve_relpath_in_repo,
    resolve_repo_root,
    save_state,
    split_shell_segments,
    strip_command_prefixes,
)

WEB_DIRTY_PREFIXES = (
    "web/src/",
    "web/index.html",
    "web/vite.config.ts",
    "web/tsconfig.json",
)

PYTHON_VERIFY_SCRIPTS = frozenset({
    "scripts/test_canal_paths.py",
    "src/physics/epley_simulator.py",
})

CANONICAL_GENERATOR_SCRIPTS = frozenset({
    "scripts/export_eye_avatar_glb.py",
    "scripts/generate_multicanal_splines.py",
    "src/anatomy/prepare_iemap.py",
})

VERIFY_FAST_SCRIPT = ".agents/plugins/inner-ear-lab/skills/verify-clinical-sim/scripts/verify_fast.sh"
VERIFY_FAST_DOMAINS = frozenset({
    "hearing",
    "radiology",
    "vestibular",
    "eye",
    "workbench",
    "diagnostic",
    "surgical",
})

ROOT_WEB_TEST_SCRIPTS = frozenset({
    "test:fast",
    "test:cdp",
    "test:hearing",
    "test:radiology",
    "test:vestibular",
    "test:eye-avatar",
    "test:workbench",
    "test:diagnostic",
    "test:surgical",
})


def _add_dirty_file(state: dict, rel: str) -> None:
    files = list(state.get("dirtyFiles") or [])
    if rel not in files:
        files.append(rel)
    state["dirtyFiles"] = files[-20:]


def _add_scope(state: dict, scope: str) -> None:
    scopes = list(state.get("dirtyScopes") or [])
    if scope not in scopes:
        scopes.append(scope)
    state["dirtyScopes"] = scopes
    state["dirty"] = True
    state["reminderCount"] = 0


def _clear_scopes(state: dict, scopes_to_clear: set[str]) -> None:
    scopes = [s for s in (state.get("dirtyScopes") or []) if s not in scopes_to_clear]
    state["dirtyScopes"] = scopes
    state["dirty"] = bool(scopes)
    if not scopes:
        state["dirtyFiles"] = []
        state["reminderCount"] = 0
        state["lastPassAt"] = time.time()


def _run_asset_sync(repo_root: str, state: dict) -> None:
    sync_script = os.path.join(repo_root, "scripts", "sync_web_assets.mjs")
    if not os.path.exists(sync_script):
        return
    try:
        res = subprocess.run(
            ["node", sync_script],
            cwd=repo_root,
            capture_output=True,
            text=True,
            timeout=10,
        )
        if res.returncode != 0:
            msg = (res.stderr or res.stdout or f"sync_web_assets.mjs exited {res.returncode}").strip()
            state["syncError"] = msg[-1200:]
        else:
            state["syncError"] = ""
    except Exception as exc:
        state["syncError"] = f"sync_web_assets.mjs exception: {exc}"


def _run_fast_tsc(repo_root: str, state: dict) -> None:
    tsc_bin = os.path.join(repo_root, "web", "node_modules", ".bin", "tsc")
    tsconfig = os.path.join(repo_root, "web", "tsconfig.json")
    if not os.path.exists(tsc_bin) or not os.path.exists(tsconfig):
        return
    try:
        res = subprocess.run(
            [tsc_bin, "-p", tsconfig, "--noEmit"],
            cwd=repo_root,
            capture_output=True,
            text=True,
            timeout=12,
        )
        if res.returncode != 0:
            combined = "\n".join(p for p in (res.stdout.strip(), res.stderr.strip()) if p)
            state["tscError"] = combined[-1500:]
        else:
            state["tscError"] = ""
    except Exception as exc:
        state["tscError"] = f"tsc --noEmit exception: {exc}"


def _parse_npm_invocation(tokens: list[str], repo_root: str, cwd: str) -> tuple[str | None, list[str]]:
    prefix_rel = resolve_relpath_in_repo(cwd, repo_root)
    args: list[str] = []
    i = 1
    while i < len(tokens):
        tok = tokens[i]
        if tok in {"--prefix", "-C"}:
            if i + 1 < len(tokens):
                prefix_rel = resolve_relpath_in_repo(tokens[i + 1], repo_root, cwd)
                i += 2
                continue
        if tok.startswith("--prefix="):
            prefix_rel = resolve_relpath_in_repo(tok.split("=", 1)[1], repo_root, cwd)
            i += 1
            continue
        if tok == "--silent" or tok == "-s":
            i += 1
            continue
        args.append(tok)
        i += 1
    return prefix_rel, args


def _analyze_command(cmd: str, repo_root: str) -> dict[str, object]:
    result = {
        "cleared": set(),
        "clear_tsc": False,
        "clear_sync": False,
        "run_sync": False,
    }
    segments, parsed_cleanly = split_shell_segments(cmd)
    if not parsed_cleanly or not segments:
        return result

    effective_cwd = os.path.realpath(repo_root)
    cleared: set[str] = result["cleared"]  # type: ignore[assignment]

    for seg in segments:
        head = strip_command_prefixes(seg.get("argv") or [])
        if not head:
            continue
        exe = os.path.basename(head[0])
        exe_lower = exe.lower()

        if exe == "cd" and len(head) >= 2 and head[1] != "-":
            cand = head[1] if os.path.isabs(head[1]) else os.path.join(effective_cwd, head[1])
            if os.path.isdir(cand):
                effective_cwd = os.path.realpath(cand)
            continue

        if exe == "npm":
            pkg_rel, args = _parse_npm_invocation(head, repo_root, effective_cwd)
            if not args or pkg_rel is None:
                continue
            sub = args[0]
            script = args[1] if sub in {"run", "run-script"} and len(args) >= 2 else sub

            if pkg_rel == "":
                if sub in {"run", "run-script"}:
                    if script == "verify":
                        cleared.update({"web", "python"})
                        result["clear_tsc"] = True
                        result["clear_sync"] = True
                    elif script in {"build", "typecheck"}:
                        cleared.add("web")
                        result["clear_tsc"] = True
                    elif script == "test":
                        cleared.add("web")
                        result["clear_tsc"] = True
                    elif script in ROOT_WEB_TEST_SCRIPTS:
                        cleared.add("web")
                    elif script == "test:python":
                        cleared.add("python")
                    elif script == "sync:assets":
                        result["clear_sync"] = True
                elif sub in {"test", "t"}:
                    cleared.add("web")
                    result["clear_tsc"] = True
            elif pkg_rel == "web":
                if (sub in {"run", "run-script"} and script == "build"):
                    cleared.add("web")
                    result["clear_tsc"] = True
                elif sub == "exec" and "tsc" in args and "--noEmit" in args:
                    cleared.add("web")
                    result["clear_tsc"] = True

        elif exe == "node":
            script_tok = next((t for t in head[1:] if not t.startswith("-")), None)
            if script_tok:
                rel = resolve_relpath_in_repo(script_tok, repo_root, effective_cwd)
                if rel == "scripts/sync_web_assets.mjs":
                    result["clear_sync"] = True
                elif rel and (
                    rel == "scripts/verify_mvp_cdp.js"
                    or (rel.startswith("scripts/test_") and rel.endswith(".js"))
                ):
                    cleared.add("web")

        elif exe.startswith("python"):
            script_tok = None
            j = 1
            while j < len(head):
                tok = head[j]
                if tok == "-c" or tok == "-m":
                    script_tok = None
                    break
                if tok.startswith("-"):
                    j += 1
                    continue
                script_tok = tok
                break
            if script_tok:
                rel = resolve_relpath_in_repo(script_tok, repo_root, effective_cwd)
                if rel in PYTHON_VERIFY_SCRIPTS:
                    cleared.add("python")
                elif rel in CANONICAL_GENERATOR_SCRIPTS:
                    result["run_sync"] = True

        elif exe_lower == "blender":
            j = 1
            while j < len(head):
                tok = head[j]
                if tok in {"-P", "--python"} and j + 1 < len(head):
                    rel = resolve_relpath_in_repo(head[j + 1], repo_root, effective_cwd)
                    if rel in CANONICAL_GENERATOR_SCRIPTS:
                        result["run_sync"] = True
                    j += 2
                    continue
                j += 1

        elif exe == "npx":
            if "tsc" in head[1:] and "--noEmit" in head[1:]:
                cleared.add("web")
                result["clear_tsc"] = True
            elif "vite" in head[1:] and "build" in head[1:]:
                cleared.add("web")
                result["clear_tsc"] = True

        elif exe == "tsc" and "--noEmit" in head[1:]:
            resolved_tsc = resolve_relpath_in_repo(head[0], repo_root, effective_cwd)
            if resolved_tsc is not None or head[0] == "tsc":
                cleared.add("web")
                result["clear_tsc"] = True

        elif exe == "vite" and "build" in head[1:]:
            cleared.add("web")
            result["clear_tsc"] = True

        elif exe in {"bash", "sh", "zsh"} or exe == "verify_fast.sh":
            script_tok: str | None = head[0] if exe == "verify_fast.sh" else None
            arg_start = 1
            if script_tok is None:
                for idx, tok in enumerate(head[1:], start=1):
                    if tok == "-c":
                        break
                    if tok.startswith("-"):
                        continue
                    script_tok = tok
                    arg_start = idx + 1
                    break
            if script_tok:
                rel = resolve_relpath_in_repo(script_tok, repo_root, effective_cwd)
                if rel == VERIFY_FAST_SCRIPT:
                    domain = next((t for t in head[arg_start:] if not t.startswith("-")), "all")
                    if domain == "python":
                        cleared.add("python")
                    elif domain in VERIFY_FAST_DOMAINS:
                        cleared.add("web")
                        result["clear_tsc"] = True
                    else:
                        cleared.update({"web", "python"})
                        result["clear_tsc"] = True

    return result


def main() -> int:
    payload = read_payload()
    repo_root = resolve_repo_root(payload)
    tool_call = payload.get("toolCall") or {}
    tool_name = str(tool_call.get("name", ""))
    args = tool_call.get("args") or {}
    tool_error = payload.get("error")

    state = load_state(repo_root)
    mutated = False

    if tool_name in WRITE_TOOL_NAMES and not tool_error:
        rel = extract_target_relpath(args, repo_root)
        if rel:
            if rel.startswith("assets/iemap/"):
                _run_asset_sync(repo_root, state)
                mutated = True

            is_web = any(rel == p or rel.startswith(p) for p in WEB_DIRTY_PREFIXES) or (
                rel.startswith("scripts/") and rel.endswith((".js", ".mjs", ".ts"))
            )
            is_python = rel.startswith("src/") or (
                rel.startswith("scripts/") and rel.endswith(".py")
            )

            if is_web:
                _add_scope(state, "web")
                _add_dirty_file(state, rel)
                if (rel.startswith("web/src/") and rel.endswith((".ts", ".tsx", ".mts"))) or (
                    rel == "web/tsconfig.json"
                ):
                    _run_fast_tsc(repo_root, state)
                mutated = True

            if is_python:
                _add_scope(state, "python")
                _add_dirty_file(state, rel)
                mutated = True

    elif tool_name == "run_command" and not tool_error:
        cmd = str(args.get("CommandLine") or args.get("command") or "")
        actions = _analyze_command(cmd, repo_root)
        cleared: set[str] = actions["cleared"]  # type: ignore[assignment]
        if actions["run_sync"]:
            _run_asset_sync(repo_root, state)
            mutated = True
        if actions["clear_tsc"]:
            state["tscError"] = ""
            mutated = True
        if actions["clear_sync"]:
            state["syncError"] = ""
            mutated = True
        if cleared or actions["clear_tsc"] or actions["clear_sync"]:
            _clear_scopes(state, cleared)
            mutated = True

    if mutated:
        save_state(repo_root, state)

    # PostToolUse contract: always print strictly {} to stdout.
    print("{}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
