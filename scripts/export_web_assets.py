#!/usr/bin/env python3
"""
Exports 3D assets for the Gate 3 Interactive Inner Ear 3D Web Lab (`web/public/assets/`):
Copies the 27 authentic IE-Map v1.0.0 RAS `.obj` meshes, `iemap_Metadata.json`,
`look-config.json`, `posterior_canal_path.json`, `horizontal_canal_path.json`,
`anterior_canal_path.json`, `eye_avatar.glb`, and 4 `.fcsv` fiducial files from
`assets/iemap/` into `web/public/assets/iemap/`.

Note: Sculpted head context OBJs (`web/public/assets/head/`) are no longer exported
to the web runtime; the live interactive VOR view renders `eye_avatar.glb`.
"""

import json
import shutil
from pathlib import Path


def main():
    repo_root = Path(__file__).resolve().parent.parent
    src_iemap = repo_root / "assets" / "iemap"
    dst_iemap = repo_root / "web" / "public" / "assets" / "iemap"

    dst_iemap_obj = dst_iemap / "obj"
    dst_iemap_fcsv = dst_iemap / "fcsv"
    dst_iemap_obj.mkdir(parents=True, exist_ok=True)
    dst_iemap_fcsv.mkdir(parents=True, exist_ok=True)

    with open(src_iemap / "iemap_Metadata.json", "r", encoding="utf-8") as f:
        meta = json.load(f)

    # Copy the 27 authentic IE-Map .obj meshes listed in iemap_Metadata.json
    copied_meshes = 0
    for mesh_name, info in meta["meshes"].items():
        src_obj = repo_root / info["obj"]
        dst_obj = dst_iemap_obj / f"{mesh_name}.obj"
        shutil.copy2(src_obj, dst_obj)
        copied_meshes += 1

    # Copy metadata, look-config, spline paths, eye avatar, and fiducials
    for fname in [
        "iemap_Metadata.json",
        "look-config.json",
        "posterior_canal_path.json",
        "horizontal_canal_path.json",
        "anterior_canal_path.json",
        "eye_avatar.glb",
    ]:
        src_file = src_iemap / fname
        if src_file.exists():
            shutil.copy2(src_file, dst_iemap / fname)

    for fcsv_file in sorted((src_iemap / "fcsv").glob("*.fcsv")):
        shutil.copy2(fcsv_file, dst_iemap_fcsv / fcsv_file.name)

    print(f"[export_web_assets] Copied {copied_meshes} authentic IE-Map OBJ meshes + metadata + FCSV files to {dst_iemap}")


if __name__ == "__main__":
    main()
