"""
scripts/export_eye_avatar_glb.py

Exports an authentic, high-performance 3D bilateral eye avatar (`assets/iemap/eye_avatar.glb`)
from `assets/iemap-realistic-head-context-candidate.blend`.

Key features:
1. Anatomical adult scale: 24.0 mm globe diameter (R = 12.0 mm), 4.54 mm pupil aperture.
2. Clinical interpupillary distance: PD = 62.0 mm (Right: +31.0 mm, Left: -31.0 mm).
3. Dedicated parent pivot nodes (`EyePivot_R`, `EyePivot_L`) at physiological centers of rotation
   enabling clean 3-DOF local quaternion rotations in Three.js.
4. High-contrast 32-spoke radial iris crypt texture + dark limbal ring for unambiguous cyclotorsion visibility.
5. Transparent corneal dome cap revealing the recessed iris within the anterior chamber.
6. Embedded pitch-black pupil backing cavity.
7. Packaged into a lightweight glTF 2.0 binary (<300 kB) with zero external asset dependencies.
"""

import math
from pathlib import Path
import bpy
import mathutils
import numpy as np

REPO_ROOT = Path(__file__).resolve().parent.parent
BLEND_PATH = REPO_ROOT / "assets" / "iemap-realistic-head-context-candidate.blend"
OUT_GLB_ASSETS = REPO_ROOT / "assets" / "iemap" / "eye_avatar.glb"
OUT_GLB_WEB = REPO_ROOT / "web" / "public" / "assets" / "iemap" / "eye_avatar.glb"

def generate_radial_iris_image(name="IrisRadialCryptTexture", size=512):
    W, H = size, size
    y, x = np.ogrid[:H, :W]
    cx, cy = (W - 1) / 2.0, (H - 1) / 2.0
    r = np.hypot(x - cx, y - cy) / (W / 2.0)
    theta = np.arctan2(y - cy, x - cx)

    # 32 radial trabecular spokes
    spokes = 0.5 + 0.5 * np.cos(32 * theta)
    collarette = np.exp(-((r - 0.52)**2) / 0.006)
    fine_fibers = 0.5 + 0.5 * np.cos(64 * theta)

    # Base iris tone: rich clinical blue-hazel
    base_r = 0.10 + 0.22 * spokes + 0.12 * collarette + 0.06 * fine_fibers
    base_g = 0.38 + 0.28 * spokes + 0.16 * collarette + 0.08 * fine_fibers
    base_b = 0.62 + 0.26 * spokes + 0.10 * collarette + 0.05 * fine_fibers

    # Masks: Pupil (r < 0.26), Iris (0.26 <= r <= 0.96), Limbus fade (r > 0.92)
    pupil_mask = r < 0.26
    limbus_fade = np.clip((0.96 - r) / 0.06, 0.0, 1.0)

    R = np.where(pupil_mask, 0.01, base_r * limbus_fade)
    G = np.where(pupil_mask, 0.01, base_g * limbus_fade)
    B = np.where(pupil_mask, 0.01, base_b * limbus_fade)
    A = np.where(r <= 1.0, 1.0, 0.0)

    rgba = np.dstack([R, G, B, A]).astype(np.float32)

    img = bpy.data.images.new(name, width=W, height=H)
    img.pixels.foreach_set(rgba.ravel())
    img.pack()
    return img

def export_eye_avatar():
    print(f"Loading blend: {BLEND_PATH}")
    bpy.ops.wm.open_mainfile(filepath=str(BLEND_PATH))

    # Retrieve source eye objects
    sclera_l = bpy.data.objects.get("GEO-head_sculpting_realistic.sclera.L")
    sclera_r = bpy.data.objects.get("GEO-head_sculpting_realistic.sclera.R")
    iris_l = bpy.data.objects.get("GEO-head_sculpting_realistic.iris.L")
    iris_r = bpy.data.objects.get("GEO-head_sculpting_realistic.iris.R")

    assert sclera_l and sclera_r and iris_l and iris_r, "Error: Missing source eye meshes in blend file"

    avatar_root = bpy.data.objects.new("EyeAvatarRoot", None)
    bpy.context.collection.objects.link(avatar_root)

    # Standard clinical Interpupillary Distance (PD): 62 mm (0.062 m)
    pd_half = 0.031

    # Generate radial iris texture
    iris_img = generate_radial_iris_image("IrisRadialTexture", 512)

    # 1. Iris Material with radial texture
    mat_iris = bpy.data.materials.new(name="Mat_EyeIris")
    mat_iris.use_nodes = True
    nt_i = mat_iris.node_tree
    bsdf_i = nt_i.nodes.get("Principled BSDF")
    tex_node = nt_i.nodes.new("ShaderNodeTexImage")
    tex_node.image = iris_img
    nt_i.links.new(tex_node.outputs["Color"], bsdf_i.inputs["Base Color"])
    bsdf_i.inputs["Roughness"].default_value = 0.25

    # 2. Sclera Material (glossy off-white)
    mat_sclera = bpy.data.materials.new(name="Mat_EyeSclera")
    mat_sclera.use_nodes = True
    bsdf_s = mat_sclera.node_tree.nodes.get("Principled BSDF")
    bsdf_s.inputs["Base Color"].default_value = (0.94, 0.94, 0.96, 1.0)
    bsdf_s.inputs["Roughness"].default_value = 0.15

    # 3. Transparent Cornea Material
    mat_cornea = bpy.data.materials.new(name="Mat_EyeCornea")
    mat_cornea.use_nodes = True
    bsdf_c = mat_cornea.node_tree.nodes.get("Principled BSDF")
    bsdf_c.inputs["Base Color"].default_value = (1.0, 1.0, 1.0, 1.0)
    bsdf_c.inputs["Transmission Weight"].default_value = 1.0
    bsdf_c.inputs["Roughness"].default_value = 0.02
    bsdf_c.inputs["IOR"].default_value = 1.336

    # 4. Black Pupil Backing Material
    mat_pupil_black = bpy.data.materials.new(name="Mat_EyePupilBlack")
    mat_pupil_black.use_nodes = True
    bsdf_pb = mat_pupil_black.node_tree.nodes.get("Principled BSDF")
    bsdf_pb.inputs["Base Color"].default_value = (0.005, 0.005, 0.005, 1.0)
    bsdf_pb.inputs["Roughness"].default_value = 0.95

    eye_configs = [
        {"side": "R", "sclera": sclera_r, "iris": iris_r, "x_pos": +pd_half},
        {"side": "L", "sclera": sclera_l, "iris": iris_l, "x_pos": -pd_half},
    ]

    export_objs = [avatar_root]

    for cfg in eye_configs:
        side = cfg["side"]
        s_obj = cfg["sclera"]
        i_obj = cfg["iris"]
        x_target = cfg["x_pos"]

        # Duplicate mesh data to isolate from head
        s_copy = s_obj.copy()
        s_copy.data = s_obj.data.copy()
        s_copy.name = f"Sclera_{side}"
        bpy.context.collection.objects.link(s_copy)

        i_copy = i_obj.copy()
        i_copy.data = i_obj.data.copy()
        i_copy.name = f"Iris_{side}"
        bpy.context.collection.objects.link(i_copy)

        # Scale globe to exact human anatomical diameter 24.0 mm (0.024 m)
        # Raw mesh vertex bounds diameter is ~0.03754 m
        raw_x_span = max(v.co.x for v in s_copy.data.vertices) - min(v.co.x for v in s_copy.data.vertices)
        target_scale = 0.024 / raw_x_span
        s_copy.scale = (target_scale, target_scale, target_scale)
        i_copy.scale = (target_scale, target_scale, target_scale)

        bpy.context.view_layer.objects.active = s_copy
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        bpy.context.view_layer.objects.active = i_copy
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

        # Apply planar UV projection to iris for clean radial texture alignment
        uv_layer = i_copy.data.uv_layers.active.data
        iris_rad = max(abs(v.co.x) for v in i_copy.data.vertices)
        for poly in i_copy.data.polygons:
            for loop_index in poly.loop_indices:
                v_idx = i_copy.data.loops[loop_index].vertex_index
                v = i_copy.data.vertices[v_idx].co
                u = 0.5 + v.x / (2.0 * iris_rad * 1.05)
                w = 0.5 + v.z / (2.0 * iris_rad * 1.05)
                uv_layer[loop_index].uv = (u, w)

        # Assign materials to sclera (opaque sclera + transparent cornea front)
        s_copy.data.materials.clear()
        s_copy.data.materials.append(mat_sclera)
        s_copy.data.materials.append(mat_cornea)

        for poly in s_copy.data.polygons:
            if all(s_copy.data.vertices[i].co.y < -0.008 for i in poly.vertices):
                poly.material_index = 1
            else:
                poly.material_index = 0

        # Assign iris material
        i_copy.data.materials.clear()
        i_copy.data.materials.append(mat_iris)

        # Create physiological Center-of-Rotation pivot empty (at origin of this eye)
        pivot = bpy.data.objects.new(f"EyePivot_{side}", None)
        pivot.location = (x_target, 0.0, 0.0)
        bpy.context.collection.objects.link(pivot)
        pivot.parent = avatar_root

        # Create dark pupil backing disk inside eye
        bpy.ops.mesh.primitive_circle_add(
            radius=0.0035,
            fill_type='NGON',
            location=(0.0, -0.0015, 0.0),
            rotation=(math.pi / 2.0, 0.0, 0.0)
        )
        pupil_backing = bpy.context.active_object
        pupil_backing.name = f"PupilBacking_{side}"
        pupil_backing.data.materials.append(mat_pupil_black)

        # Local transforms relative to pivot: (0, 0, 0)
        s_copy.location = (0.0, 0.0, 0.0)
        i_copy.location = (0.0, 0.0, 0.0)

        # Parent components to pivot
        s_copy.parent = pivot
        i_copy.parent = pivot
        pupil_backing.parent = pivot

        export_objs.extend([pivot, s_copy, i_copy, pupil_backing])

    # Select only our eye objects for clean glTF export
    bpy.ops.object.select_all(action='DESELECT')
    for obj in export_objs:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = avatar_root

    # Export GLB to assets and web public
    for out_path in [OUT_GLB_ASSETS, OUT_GLB_WEB]:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        print(f"Exporting glTF binary: {out_path}")
        bpy.ops.export_scene.gltf(
            filepath=str(out_path),
            use_selection=True,
            export_format='GLB',
            export_apply=True,
            export_materials='EXPORT',
            export_yup=True,
        )
        size_kb = out_path.stat().st_size / 1024.0
        print(f"Saved: {out_path} ({size_kb:.1f} kB)")

    print("Eye avatar glTF export completed successfully!")

if __name__ == "__main__":
    export_eye_avatar()
