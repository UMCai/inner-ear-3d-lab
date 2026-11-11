#!/usr/bin/env python3
"""PreInvocation hook surfacing cached TypeScript or asset-sync errors before model execution."""

from __future__ import annotations

import json
import sys

from _common import load_state, read_payload, resolve_repo_root


def main() -> int:
    payload = read_payload()
    repo_root = resolve_repo_root(payload)
    state = load_state(repo_root)

    notes: list[str] = []
    sync_err = str(state.get("syncError") or "").strip()
    tsc_err = str(state.get("tscError") or "").strip()

    if sync_err:
        notes.append(f"[inner-ear-lab asset sync failure]\n{sync_err}")
    if tsc_err:
        notes.append(f"[inner-ear-lab cached tsc --noEmit diagnostics]\n{tsc_err}")

    if not notes:
        print("{}")
        return 0

    msg = "\n\n".join(notes) + "\n\nFix these diagnostics before finalizing."
    print(
        json.dumps(
            {
                "injectSteps": [
                    {
                        "systemMessage": {
                            "systemMessage": msg,
                        }
                    }
                ]
            }
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
