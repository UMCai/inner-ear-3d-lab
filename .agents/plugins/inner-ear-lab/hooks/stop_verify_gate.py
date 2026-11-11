#!/usr/bin/env python3
"""Stop verification gate reminding once on clean completion if edited files remain unverified."""

from __future__ import annotations

import json
import sys

from _common import load_state, read_payload, resolve_repo_root, save_state


def main() -> int:
    payload = read_payload()
    termination_reason = str(payload.get("terminationReason") or "")
    fully_idle = bool(payload.get("fullyIdle"))

    # Never trap cancellations, errors, invocation limits, or running background tasks.
    if termination_reason != "NO_TOOL_CALL" or not fully_idle:
        print("{}")
        return 0

    repo_root = resolve_repo_root(payload)
    state = load_state(repo_root)

    dirty = bool(state.get("dirty"))
    tsc_err = str(state.get("tscError") or "").strip()
    sync_err = str(state.get("syncError") or "").strip()

    if not dirty and not tsc_err and not sync_err:
        print("{}")
        return 0

    reminder_count = int(state.get("reminderCount") or 0)
    if reminder_count >= 1:
        state["reminderCount"] = 0
        save_state(repo_root, state)
        print("{}")
        return 0

    state["reminderCount"] = reminder_count + 1
    save_state(repo_root, state)

    scopes = set(state.get("dirtyScopes") or [])
    dirty_files = ", ".join(state.get("dirtyFiles") or [])
    cmds: list[str] = []
    if "web" in scopes and "python" in scopes:
        cmds.append("`npm run verify`")
    else:
        if "web" in scopes or tsc_err:
            cmds.append("`npm run verify` (or `npm run build` / `npm test`)")
        if "python" in scopes:
            cmds.append("`npm run test:python`")
    if sync_err:
        cmds.append("`npm run sync:assets`")

    cmd_text = " and ".join(cmds) if cmds else "`npm run verify`"
    detail_parts: list[str] = []
    if dirty_files:
        detail_parts.append(f"Unverified modified files: {dirty_files}.")
    if sync_err:
        detail_parts.append("Canonical asset sync (`sync_web_assets.mjs`) recorded an error.")
    if tsc_err:
        detail_parts.append("Cached `tsc --noEmit` diagnostics are still failing.")

    reason = (
        "Verification reminder before concluding: "
        + " ".join(detail_parts)
        + f" Run {cmd_text} (or `npm run test:cdp` if layout/rendering changed) to verify cleanly."
    )
    print(json.dumps({"decision": "continue", "reason": reason}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
