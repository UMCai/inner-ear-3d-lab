"""
scripts/export_eye_avatar_glb.py

Exports an authentic, high-performance photorealistic 3D bilateral eye avatar (`assets/iemap/eye_avatar.glb`)
from `assets/iemap-realistic-head-context-candidate.blend`.

Key features:
1. Anatomical adult scale: 24.0 mm globe diameter (R = 12.0 mm), 4.54 mm pupil aperture.
2. Clinical interpupillary distance: PD = 62.0 mm (Right: +31.0 mm, Left: -31.0 mm).
3. Dedicated parent pivot nodes (`EyePivot_R`, `EyePivot_L`) at physiological centers of rotation
   enabling clean 3-DOF local quaternion rotations in Three.js.
4. Photorealistic multi-octave fibrous radial iris architecture, Crypts of Fuchs,
   Collarette zigzag ring, Dark Limbal Ring, and microvascular conjunctival vessel network on sclera.
5. Transparent corneal dome cap revealing the recessed iris within the anterior chamber.
6. Embedded pitch-black pupil backing cavity.
7. Packaged into a high-fidelity glTF 2.0 binary (<300 kB) with zero external asset dependencies.
"""

import math
from pathlib import Path
import bpy
import numpy as np

REPO_ROOT = Path(__file__).resolve().parent.parent
BLEND_PATH = REPO_ROOT / "assets" / "iemap-realistic-head-context-candidate.blend"
OUT_GLB_ASSETS = REPO_ROOT / "assets" / "iemap" / "eye_avatar.glb"
OUT_GLB_WEB = REPO_ROOT / "web" / "public" / "assets" / "iemap" / "eye_avatar.glb"

def generate_photorealistic_iris_image(name="IrisPhotorealisticTexture", size=512):
    W, H = size, size
    y, x = np.ogrid[:H, :W]
    cx, cy = (W - 1) / 2.0, (H - 1) / 2.0
    r = np.hypot(x - cx, y - cy) / (W / 2.0)
    theta = np.arctan2(y - cy, x - cx)

    # Multi-octave fibrous radial architecture with slight angular tortuosity
    theta_warp = theta + 0.035 * np.sin(6 * theta) + 0.018 * np.sin(14 * theta)
    s32 = 0.5 + 0.5 * np.cos(32 * theta_warp)
    s64 = 0.5 + 0.5 * np.cos(64 * theta_warp + 0.5)
    s128 = 0.5 + 0.5 * np.cos(128 * theta_warp + 1.2)
    s256 = 0.5 + 0.5 * np.cos(256 * theta_warp + 2.1)
    fibers = 0.40 * s32 + 0.32 * s64 + 0.18 * s128 + 0.10 * s256

    # Collarette zigzag ring at r ~ 0.50
    r_collarette = 0.50 + 0.030 * np.cos(16 * theta) + 0.015 * np.sin(32 * theta)
    collarette = np.exp(-((r - r_collarette)**2) / 0.005)

    # Crypts of Fuchs: diamond/oval recesses along collarette
    crypts = np.exp(-((r - 0.54)**2) / 0.008) * ((0.5 + 0.5 * np.cos(16 * theta))**3)

    # Pupillary zone & peripupillary ring
    pupil_ruff = np.exp(-((r - 0.25)**2) / 0.002)

    # Ciliary contraction furrows
    furrow1 = 0.12 * np.exp(-((r - 0.68)**2) / 0.0015)
    furrow2 = 0.10 * np.exp(-((r - 0.77)**2) / 0.0015)
    furrow3 = 0.08 * np.exp(-((r - 0.86)**2) / 0.0015)
    furrows = furrow1 + furrow2 + furrow3

    # Dark Limbal Ring (annulus at r ~ 0.88 to 0.98)
    limbal_ring = np.clip((r - 0.88) / 0.08, 0.0, 1.0)
    limbus_fade = np.clip((0.97 - r) / 0.04, 0.0, 1.0)
    pupil_mask = r < 0.24

    # Outer ciliary tone: rich slate-blue with subtle green/grey stroma
    ciliary_r = 0.12 + 0.24 * fibers - 0.15 * furrows - 0.10 * crypts
    ciliary_g = 0.36 + 0.26 * fibers - 0.12 * furrows - 0.08 * crypts
    ciliary_b = 0.56 + 0.28 * fibers - 0.08 * furrows - 0.05 * crypts

    # Warm golden/amber peripupillary tone & collarette
    amber_r = 0.62 + 0.22 * fibers + 0.18 * collarette
    amber_g = 0.44 + 0.18 * fibers + 0.12 * collarette
    amber_b = 0.20 + 0.10 * fibers + 0.06 * collarette

    # Melanin gradient: amber blends into ciliary blue
    t_amber = np.clip(1.0 - (r - 0.26) / 0.26, 0.0, 1.0) * 0.85 + 0.40 * collarette
    t_amber = np.clip(t_amber, 0.0, 1.0)

    R = ciliary_r * (1.0 - t_amber) + amber_r * t_amber
    G = ciliary_g * (1.0 - t_amber) + amber_g * t_amber
    B = ciliary_b * (1.0 - t_amber) + amber_b * t_amber

    # Darken pupillary ruff
    R = R * (1.0 - 0.50 * pupil_ruff)
    G = G * (1.0 - 0.55 * pupil_ruff)
    B = B * (1.0 - 0.58 * pupil_ruff)

    # Apply dark limbal ring
    R = R * (1.0 - 0.72 * limbal_ring)
    G = G * (1.0 - 0.72 * limbal_ring)
    B = B * (1.0 - 0.68 * limbal_ring)

    # Final mask
    R = np.where(pupil_mask, 0.008, np.clip(R, 0.0, 1.0) * limbus_fade)
    G = np.where(pupil_mask, 0.008, np.clip(G, 0.0, 1.0) * limbus_fade)
    B = np.where(pupil_mask, 0.008, np.clip(B, 0.0, 1.0) * limbus_fade)
    A = np.where(r <= 1.0, 1.0, 0.0)

    rgba = np.dstack([R, G, B, A]).astype(np.float32)
    img = bpy.data.images.new(name, width=W, height=H)
    img.pixels.foreach_set(rgba.ravel())
    img.pack()
    return img

def generate_photorealistic_sclera_image(name="ScleraMicrovascularTexture", size=512):
    W, H = size, size
    y, x = np.ogrid[:H, :W]
    cx, cy = (W - 1) / 2.0, (H - 1) / 2.0
    r = np.hypot(x - cx, y - cy) / (W / 2.0)
    theta = np.arctan2(y - cy, x - cx)

    # Warm ivory tissue base with subtle horizontal vascular blush (canthi)
    # and peripheral ambient occlusion
    ao = np.clip(1.0 - 0.22 * (r**2.2), 0.70, 1.0)
    horiz_blush = 0.03 * (np.cos(theta)**2) * np.clip((r - 0.35) / 0.55, 0.0, 1.0)

    base_r = (0.94 + horiz_blush) * ao
    base_g = (0.93 + 0.5 * horiz_blush) * ao
    base_b = (0.91 - 0.5 * horiz_blush) * ao

    # Procedural microvascular network on sclera
    vessels_deep = np.zeros((H, W), dtype=np.float32)
    vessels_superficial = np.zeros((H, W), dtype=np.float32)

    np.random.seed(42)

    # 14 primary feeding vessel trunks originating from periphery (r ~ 0.95) toward limbus (r ~ 0.44)
    trunk_angles = [
        0.05, 0.18, 0.35, 1.25, 1.55, 2.85, 3.05, -0.10, -0.28, -1.30, -1.60, -2.75, -2.95, 3.14
    ]

    for th0 in trunk_angles:
        n_pts = 60
        t_vals = np.linspace(0.0, 1.0, n_pts)
        r_curve = 0.96 * (1.0 - t_vals) + 0.44 * t_vals

        phase1 = np.random.uniform(0, 2 * np.pi)
        phase2 = np.random.uniform(0, 2 * np.pi)
        amp1 = np.random.uniform(0.06, 0.12)
        amp2 = np.random.uniform(0.02, 0.05)
        th_curve = th0 + amp1 * np.sin(2 * np.pi * 1.5 * t_vals + phase1) + amp2 * np.cos(2 * np.pi * 4.0 * t_vals + phase2)

        x_pts = cx + r_curve * (W / 2.0) * np.cos(th_curve)
        y_pts = cy + r_curve * (H / 2.0) * np.sin(th_curve)

        for i in range(n_pts):
            px, py = int(round(x_pts[i])), int(round(y_pts[i]))
            rad_px = 2.2 * (1.0 - 0.6 * t_vals[i])
            i_rad = int(math.ceil(rad_px)) + 2
            x0 = max(0, px - i_rad)
            x1 = min(W, px + i_rad + 1)
            y0 = max(0, py - i_rad)
            y1 = min(H, py + i_rad + 1)
            if x0 < x1 and y0 < y1:
                sub_y, sub_x = np.ogrid[y0:y1, x0:x1]
                dist2 = (sub_x - px)**2 + (sub_y - py)**2
                splat = np.exp(-dist2 / (2.0 * (rad_px * 0.7)**2))
                vessels_superficial[y0:y1, x0:x1] = np.maximum(vessels_superficial[y0:y1, x0:x1], splat)

        for t_split in [0.35, 0.65]:
            idx_split = int(t_split * (n_pts - 1))
            r_start = r_curve[idx_split]
            th_start = th_curve[idx_split]
            branch_len = 30
            t_b = np.linspace(0.0, 1.0, branch_len)
            r_b = r_start * (1.0 - t_b) + (r_start - 0.18) * t_b
            side_sign = 1.0 if np.random.rand() > 0.5 else -1.0
            th_b = th_start + side_sign * 0.15 * t_b + 0.05 * np.sin(2 * np.pi * 2.0 * t_b)

            xb_pts = cx + r_b * (W / 2.0) * np.cos(th_b)
            yb_pts = cy + r_b * (H / 2.0) * np.sin(th_b)
            for j in range(branch_len):
                px, py = int(round(xb_pts[j])), int(round(yb_pts[j]))
                rad_px = 1.4 * (1.0 - 0.5 * t_b[j])
                i_rad = int(math.ceil(rad_px)) + 1
                x0 = max(0, px - i_rad)
                x1 = min(W, px + i_rad + 1)
                y0 = max(0, py - i_rad)
                y1 = min(H, py + i_rad + 1)
                if x0 < x1 and y0 < y1:
                    sub_y, sub_x = np.ogrid[y0:y1, x0:x1]
                    dist2 = (sub_x - px)**2 + (sub_y - py)**2
                    splat = np.exp(-dist2 / (2.0 * (rad_px * 0.6)**2))
                    vessels_deep[y0:y1, x0:x1] = np.maximum(vessels_deep[y0:y1, x0:x1], splat * 0.85)

    arcade = np.exp(-((r - 0.45)**2) / 0.001) * (0.5 + 0.5 * np.cos(36 * theta + 0.5 * np.sin(72 * theta)))
    vessels_deep = np.maximum(vessels_deep, arcade * 0.65)

    cornea_mask = np.clip((r - 0.42) / 0.04, 0.0, 1.0)
    vessels_superficial = vessels_superficial * cornea_mask
    vessels_deep = vessels_deep * cornea_mask

    deep_r = 0.74
    deep_g = 0.38
    deep_b = 0.38

    sup_r = 0.68
    sup_g = 0.16
    sup_b = 0.16

    R = base_r * (1.0 - vessels_deep * 0.70) + deep_r * (vessels_deep * 0.70)
    G = base_g * (1.0 - vessels_deep * 0.70) + deep_g * (vessels_deep * 0.70)
    B = base_b * (1.0 - vessels_deep * 0.70) + deep_b * (vessels_deep * 0.70)

    R = R * (1.0 - vessels_superficial * 0.85) + sup_r * (vessels_superficial * 0.85)
    G = G * (1.0 - vessels_superficial * 0.85) + sup_g * (vessels_superficial * 0.85)
    B = B * (1.0 - vessels_superficial * 0.85) + sup_b * (vessels_superficial * 0.85)

    limbus_transition = np.exp(-((r - 0.43)**2) / 0.0015)
    R = R * (1.0 - 0.12 * limbus_transition) + 0.80 * (0.12 * limbus_transition)
    G = G * (1.0 - 0.10 * limbus_transition) + 0.84 * (0.10 * limbus_transition)
    B = B * (1.0 - 0.05 * limbus_transition) + 0.89 * (0.05 * limbus_transition)

    A = np.ones((H, W), dtype=np.float32)

    rgba = np.dstack([np.clip(R, 0, 1), np.clip(G, 0, 1), np.clip(B, 0, 1), A]).astype(np.float32)
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

    # Generate procedural photorealistic textures
    iris_img = generate_photorealistic_iris_image("IrisPhotorealisticTexture", 512)
    sclera_img = generate_photorealistic_sclera_image("ScleraMicrovascularTexture", 512)

    # 1. Iris Material
    mat_iris = bpy.data.materials.new(name="Mat_EyeIris")
    mat_iris.use_nodes = True
    nt_i = mat_iris.node_tree
    bsdf_i = nt_i.nodes.get("Principled BSDF")
    tex_node_i = nt_i.nodes.new("ShaderNodeTexImage")
    tex_node_i.image = iris_img
    nt_i.links.new(tex_node_i.outputs["Color"], bsdf_i.inputs["Base Color"])
    bsdf_i.inputs["Roughness"].default_value = 0.30

    # 2. Sclera Material
    mat_sclera = bpy.data.materials.new(name="Mat_EyeSclera")
    mat_sclera.use_nodes = True
    nt_s = mat_sclera.node_tree
    bsdf_s = nt_s.nodes.get("Principled BSDF")
    tex_node_s = nt_s.nodes.new("ShaderNodeTexImage")
    tex_node_s.image = sclera_img
    nt_s.links.new(tex_node_s.outputs["Color"], bsdf_s.inputs["Base Color"])
    bsdf_s.inputs["Roughness"].default_value = 0.20

    # 3. Transparent Cornea Material
    mat_cornea = bpy.data.materials.new(name="Mat_EyeCornea")
    mat_cornea.use_nodes = True
    bsdf_c = mat_cornea.node_tree.nodes.get("Principled BSDF")
    bsdf_c.inputs["Base Color"].default_value = (1.0, 1.0, 1.0, 1.0)
    bsdf_c.inputs["Transmission Weight"].default_value = 1.0
    bsdf_c.inputs["Roughness"].default_value = 0.03
    bsdf_c.inputs["IOR"].default_value = 1.336
    if "Alpha" in bsdf_c.inputs:
        bsdf_c.inputs["Alpha"].default_value = 0.16
    mat_cornea.blend_method = 'BLEND'

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
        raw_x_span = max(v.co.x for v in s_copy.data.vertices) - min(v.co.x for v in s_copy.data.vertices)
        target_scale = 0.024 / raw_x_span
        s_copy.scale = (target_scale, target_scale, target_scale)
        i_copy.scale = (target_scale, target_scale, target_scale)

        bpy.context.view_layer.objects.active = s_copy
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        bpy.context.view_layer.objects.active = i_copy
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

        # Apply planar UV projection to iris for clean radial texture alignment
        uv_layer_i = i_copy.data.uv_layers.active.data
        iris_rad = max(abs(v.co.x) for v in i_copy.data.vertices)
        for poly in i_copy.data.polygons:
            for loop_index in poly.loop_indices:
                v_idx = i_copy.data.loops[loop_index].vertex_index
                v = i_copy.data.vertices[v_idx].co
                u = 0.5 + v.x / (2.0 * iris_rad * 1.05)
                w = 0.5 + v.z / (2.0 * iris_rad * 1.05)
                uv_layer_i[loop_index].uv = (u, w)

        # Apply planar UV projection to sclera (centered on anterior pole)
        uv_layer_s = s_copy.data.uv_layers.active.data
        sclera_rad = 0.012
        for poly in s_copy.data.polygons:
            for loop_index in poly.loop_indices:
                v_idx = s_copy.data.loops[loop_index].vertex_index
                v = s_copy.data.vertices[v_idx].co
                u = 0.5 + v.x / (2.05 * sclera_rad)
                w = 0.5 + v.z / (2.05 * sclera_rad)
                uv_layer_s[loop_index].uv = (u, w)

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

    # Export GLB to assets and web public with high-quality JPEG textures (<300 kB budget)
    for out_path in [OUT_GLB_ASSETS, OUT_GLB_WEB]:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        print(f"Exporting photorealistic glTF binary: {out_path}")
        bpy.ops.export_scene.gltf(
            filepath=str(out_path),
            use_selection=True,
            export_format='GLB',
            export_apply=True,
            export_materials='EXPORT',
            export_image_format='JPEG',
            export_image_quality=100,
            export_yup=True,
        )
        size_kb = out_path.stat().st_size / 1024.0
        print(f"Saved: {out_path} ({size_kb:.1f} kB)")

    print("Photorealistic eye avatar glTF export completed successfully!")

if __name__ == "__main__":
    export_eye_avatar()
