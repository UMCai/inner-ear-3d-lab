"""Import this bundle's IE-Map surface assembly into the current Blender scene.

Usage: blender -b your-scene.blend --python import_labyrinth.py -- --output out.blend
The existing scene is preserved. Run from this script's extracted bundle folder.
"""
import json
import sys
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parent
MM_TO_M = 0.001
COLLECTION_NAME = "IEMap_1_0_right_labyrinth_RAS"


def read_obj(path):
    vertices, faces = [], []
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            if line.startswith("v "):
                vertices.append(tuple(float(v) for v in line.split()[1:4]))
            elif line.startswith("f "):
                faces.append(tuple(int(v.split("/")[0]) - 1 for v in line.split()[1:4]))
    return vertices, faces


def color_for(name):
    if "posterior_duct" in name:
        return (0.02, 0.74, 0.79, 1)
    if "utricle" in name:
        return (0.30, 0.67, 0.58, 1)
    if "ampulla" in name:
        return (0.90, 0.55, 0.23, 1)
    if "cupula" in name:
        return (0.89, 0.40, 0.59, 1)
    return (0.42, 0.51, 0.65, 1)


def main():
    if COLLECTION_NAME in bpy.data.collections:
        raise RuntimeError(f"Collection already exists: {COLLECTION_NAME}")
    entries = json.loads((ROOT / "bundle-manifest.json").read_text())
    collection = bpy.data.collections.new(COLLECTION_NAME)
    bpy.context.scene.collection.children.link(collection)
    for item in entries["structures"]:
        path = ROOT / item["obj_path"]
        vertices, faces = read_obj(path)
        if len(vertices) != item["points"] or len(faces) != item["triangles"]:
            raise ValueError(f"Geometry count differs from manifest: {item['structure_id']}")
        mesh = bpy.data.meshes.new(item["structure_id"])
        mesh.from_pydata(vertices, [], faces)
        mesh.update()
        obj = bpy.data.objects.new(item["structure_id"], mesh)
        collection.objects.link(obj)
        obj.scale = (MM_TO_M,) * 3
        obj.hide_render = not item["visible_by_default"]
        obj.hide_set(not item["visible_by_default"])
        obj["source_file"] = item["source_name"]
        obj["source_sha256"] = item["source_sha256"]
        obj["source_frame"] = "right-oriented patient RAS mm"
        obj["scene_frame"] = "patient RAS m"
        obj["is_schematic"] = False
        material = bpy.data.materials.new(item["structure_id"] + "_review")
        material.diffuse_color = color_for(item["structure_id"])
        mesh.materials.append(material)

    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1.0
    if "--" in sys.argv:
        args = sys.argv[sys.argv.index("--") + 1:]
        if "--output" in args:
            output = Path(args[args.index("--output") + 1]).resolve()
            bpy.ops.wm.save_as_mainfile(filepath=str(output))
    print(f"Imported {len(entries['structures'])} IE-Map surfaces into {COLLECTION_NAME}")


if __name__ == "__main__":
    main()
