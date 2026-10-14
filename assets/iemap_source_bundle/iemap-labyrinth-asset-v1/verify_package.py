"""Verify every payload file in the extracted labyrinth asset package."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
manifest = json.loads((ROOT / "bundle-manifest.json").read_text())
for entry in manifest["files"]:
    path = ROOT / entry["path"]
    if not path.is_file():
        raise SystemExit(f"MISSING {entry['path']}")
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if digest != entry["sha256"]:
        raise SystemExit(f"HASH MISMATCH {entry['path']}")
print(f"OK: {len(manifest['files'])} payload files match bundle-manifest.json")
