#!/usr/bin/env python3
"""
Exports 3D assets for the Gate 3 Interactive Inner Ear 3D Web Lab (`web/public/assets/`):
1. Copies the 27 authentic IE-Map v1.0.0 RAS `.obj` meshes, `iemap_Metadata.json`,
   `look-config.json`, `posterior_canal_path.json`, and 4 `.fcsv` fiducial files into
   `web/public/assets/iemap/`.
2. Extracts the CC0 sculpted anatomical head (`GEO-head_sculpting_realistic`), ocular meshes
   (`iris.L`, `iris.R`, `sclera.L`, `sclera.R`), and `Right_ear_locator_ring` from
   `assets/iemap-realistic-head-context-candidate.blend`, applies the neck-collar taper and
   `AuthenticHeadRoot` transform so the Right Inner Ear origin is at `(0, 0, 0)` in RAS
   coordinates (`+X` Right, `+Y` Anterior, `+Z` Superior), and exports both `.glb` and `.obj`
   assets into `web/public/assets/head/`.
"""

import json
import math
import shutil
from pathlib import Path

import bpy
import mathutils


def write_baked_obj(obj: bpy.types.Object, world_mat: mathutils.Matrix, filepath: Path):
    """Write a triangulated Wavefront .obj with smooth vertex normals in RAS space."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    eval_obj = obj.evaluated_get(depsgraph)
    mesh = eval_obj.to_mesh()
    mesh.transform(world_mat)
    mesh.calc_loop_triangles()

    filepath.parent.mkdir(parents=True, exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(f"# Gate 3 RAS Head Context Mesh: {obj.name}\n")
        f.write(f"o {obj.name}\n")
        for v in mesh.vertices:
            f.write(f"v {v.co.x:.5f} {v.co.y:.5f} {v.co.z:.5f}\n")
        for v in mesh.vertices:
            n = v.normal
            f.write(f"vn {n.x:.5f} {n.y:.5f} {n.z:.5f}\n")
        for tri in mesh.loop_triangles:
            i0, i1, i2 = tri.vertices[0] + 1, tri.vertices[1] + 1, tri.vertices[2] + 1
            f.write(f"f {i0}//{i0} {i1}//{i1} {i2}//{i2}\n")

    eval_obj.to_mesh_clear()


def main():
    repo_root = Path(__file__).resolve().parent.parent
    src_iemap = repo_root / "assets" / "iemap"
    dst_assets = repo_root / "web" / "public" / "assets"
    dst_iemap = dst_assets / "iemap"
    dst_head = dst_assets / "head"

    dst_iemap_obj = dst_iemap / "obj"
    dst_iemap_fcsv = dst_iemap / "fcsv"
    dst_iemap_obj.mkdir(parents=True, exist_ok=True)
    dst_iemap_fcsv.mkdir(parents=True, exist_ok=True)
    dst_head.mkdir(parents=True, exist_ok=True)

    with open(src_iemap / "iemap_Metadata.json", "r", encoding="utf-8") as f:
        meta = json.load(f)

    # 1. Copy the 27 authentic IE-Map .obj meshes listed in iemap_Metadata.json
    copied_meshes = 0
    for mesh_name, info in meta["meshes"].items():
        src_obj = repo_root / info["obj"]
        dst_obj = dst_iemap_obj / f"{mesh_name}.obj"
        shutil.copy2(src_obj, dst_obj)
        copied_meshes += 1

    # Copy metadata, look-config, spline path, and fiducials
    for fname in ["iemap_Metadata.json", "look-config.json", "posterior_canal_path.json"]:
        shutil.copy2(src_iemap / fname, dst_iemap / fname)

    for fcsv_file in sorted((src_iemap / "fcsv").glob("*.fcsv")):
        shutil.copy2(fcsv_file, dst_iemap_fcsv / fcsv_file.name)

    print(f"[export_web_assets] Copied {copied_meshes} authentic IE-Map OBJ meshes + metadata + 4 FCSV files to {dst_iemap}")

    # 2. Extract and bake the sculpted anatomical head in RAS coordinates (mm, with Right Ear origin at 0,0,0)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    blend_path = repo_root / "assets" / "iemap-realistic-head-context-candidate.blend"
    names = [
        "HeadRoot",
        "GEO-head_sculpting_realistic",
        "GEO-head_sculpting_realistic.iris.L",
        "GEO-head_sculpting_realistic.iris.R",
        "GEO-head_sculpting_realistic.sclera.L",
        "GEO-head_sculpting_realistic.sclera.R",
        "Right_ear_locator_ring",
    ]
    with bpy.data.libraries.load(str(blend_path), link=False) as (data_from, data_to):
        data_to.objects = [n for n in names if n in data_from.objects]

    scene_coll = bpy.context.scene.collection
    for obj in data_to.objects:
        scene_coll.objects.link(obj)

    auth_root = bpy.data.objects.new("AuthenticHeadRoot_RAS", None)
    scene_coll.objects.link(auth_root)

    cand_head_root = bpy.data.objects.get("HeadRoot")
    if cand_head_root:
        cand_head_root.parent = auth_root
        cand_head_root.matrix_local = mathutils.Matrix.Translation((-0.025, -0.020, -0.060))

    head_mesh_obj = bpy.data.objects.get("GEO-head_sculpting_realistic")
    if head_mesh_obj:
        for poly in head_mesh_obj.data.polygons:
            poly.use_smooth = True
        for v in head_mesh_obj.data.vertices:
            if v.co.z < 0.135:
                r = math.sqrt(v.co.x ** 2 + v.co.y ** 2)
                if r > 0.072:
                    v.co.x *= (0.072 / r)
                    v.co.y *= (0.072 / r)
        head_mesh_obj.data.update()

    ear_ring = bpy.data.objects.get("Right_ear_locator_ring")
    if ear_ring:
        ear_ring.parent = auth_root
        ear_ring.matrix_local = mathutils.Matrix.Identity(4)
        if hasattr(ear_ring.data, "bevel_depth"):
            ear_ring.data.bevel_depth = 0.003

    bpy.context.view_layer.update()

    # Scale by 1000 so head coordinates are in RAS millimetres matching the IE-Map meshes
    scale_mm = mathutils.Matrix.Scale(1000.0, 4)

    export_map = {
        "GEO-head_sculpting_realistic": "head_skin.obj",
        "GEO-head_sculpting_realistic.iris.L": "iris_L.obj",
        "GEO-head_sculpting_realistic.iris.R": "iris_R.obj",
        "GEO-head_sculpting_realistic.sclera.L": "sclera_L.obj",
        "GEO-head_sculpting_realistic.sclera.R": "sclera_R.obj",
        "Right_ear_locator_ring": "ear_locator_ring.obj",
    }

    for src_name, out_filename in export_map.items():
        obj = bpy.data.objects.get(src_name)
        if obj is not None:
            mat_ras_mm = scale_mm @ obj.matrix_world
            out_path = dst_head / out_filename
            write_baked_obj(obj, mat_ras_mm, out_path)
            print(f"[export_web_assets] Exported RAS head mesh: {out_path.name} ({out_path.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
