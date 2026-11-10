"""
scripts/render_step1_proof.py

Generates visual proof renders for Stage 3 Step 1:
1. `proof_multicanal_splines_3d.png`: All 3 continuous semicircular canal splines
   (Posterior in Amber, Horizontal in Cyan, Anterior in Violet) overlaid inside
   the authentic translucent IE-Map v1.0.0 membranous labyrinth.
2. `proof_eye_avatar_cyclotorsion.png`: High-resolution render of `eye_avatar.glb`
   showing the 32-spoke radial iris crypts, pupil aperture, and corneal specular glint.
"""

import json
import os
from pathlib import Path
import bpy
import mathutils

REPO_ROOT = Path(__file__).resolve().parent.parent
IEMAP_DIR = REPO_ROOT / "assets" / "iemap"
OUT_DIR = REPO_ROOT / "build" / "proof"
OUT_DIR.mkdir(parents=True, exist_ok=True)
EXTRA_OUT_DIR = Path(os.environ["STEP1_PROOF_COPY_DIR"]) if os.environ.get("STEP1_PROOF_COPY_DIR") else None


def render_multicanal_proof():
    print("--- Rendering 3D Multi-Canal Splines Proof ---")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 32
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 960

    world = bpy.data.worlds.new("ProofWorld")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs['Color'].default_value = (0.025, 0.045, 0.07, 1.0)
        bg.inputs['Strength'].default_value = 0.55

    # 1. Load translucent labyrinth meshes with strict RAS forward=Y, up=Z
    mat_ghost = bpy.data.materials.new("GhostMat")
    mat_ghost.use_nodes = True
    bsdf_g = mat_ghost.node_tree.nodes.get("Principled BSDF")
    if bsdf_g:
        bsdf_g.inputs['Base Color'].default_value = (0.45, 0.60, 0.72, 1.0)
        bsdf_g.inputs['Transmission Weight'].default_value = 0.85
        bsdf_g.inputs['Roughness'].default_value = 0.20

    mesh_names = [
        "ls_Hsapiens_Sp.obj", "ls_Hsapiens_Sl.obj", "ls_Hsapiens_Sa.obj",
        "ls_Hsapiens_Ap.obj", "ls_Hsapiens_Al.obj", "ls_Hsapiens_Aa.obj",
        "ls_Hsapiens_CCp.obj", "ls_Hsapiens_CCa.obj", "ls_Hsapiens_SC.obj",
        "ls_Hsapiens_utricle.obj", "mesh_david_cochlea.obj"
    ]
    for m in mesh_names:
        p = IEMAP_DIR / "obj" / m
        if p.exists():
            bpy.ops.wm.obj_import(filepath=str(p), forward_axis='Y', up_axis='Z')
            obj = bpy.context.selected_objects[0]
            obj.data.materials.clear()
            obj.data.materials.append(mat_ghost)

    # 2. Build 3D spline curves with glowing materials
    canal_configs = [
        {
            "file": "posterior_canal_path.json",
            "name": "PosteriorCanalCurve",
            "color": (1.0, 0.65, 0.15, 1.0), # Warm Amber
            "radius": 0.10,
        },
        {
            "file": "horizontal_canal_path.json",
            "name": "HorizontalCanalCurve",
            "color": (0.0, 0.88, 0.95, 1.0), # Medaium Cyan
            "radius": 0.10,
        },
        {
            "file": "anterior_canal_path.json",
            "name": "AnteriorCanalCurve",
            "color": (0.80, 0.35, 1.0, 1.0), # Electric Violet
            "radius": 0.10,
        },
    ]

    for cfg in canal_configs:
        with open(IEMAP_DIR / cfg["file"], "r", encoding="utf-8") as f:
            cdata = json.load(f)
        pts = [s["position_ras"] for s in cdata["samples"]]

        curve_data = bpy.data.curves.new(cfg["name"], type='CURVE')
        curve_data.dimensions = '3D'
        curve_data.bevel_depth = cfg["radius"]
        curve_data.bevel_resolution = 4

        spline = curve_data.splines.new('POLY')
        spline.points.add(len(pts) - 1)
        for i, pt in enumerate(pts):
            spline.points[i].co = (pt[0], pt[1], pt[2], 1.0)

        c_obj = bpy.data.objects.new(cfg["name"], curve_data)
        bpy.context.collection.objects.link(c_obj)

        mat_c = bpy.data.materials.new(f"Mat_{cfg['name']}")
        mat_c.use_nodes = True
        bsdf_c = mat_c.node_tree.nodes.get("Principled BSDF")
        if bsdf_c:
            bsdf_c.inputs['Base Color'].default_value = cfg["color"]
            bsdf_c.inputs['Emission Color'].default_value = cfg["color"]
            bsdf_c.inputs['Emission Strength'].default_value = 4.0
        c_obj.data.materials.append(mat_c)

    # Lighting and Camera
    key_light = bpy.data.lights.new("KeyLight", type='AREA')
    key_light.energy = 80.0
    key_light.size = 25.0
    k_obj = bpy.data.objects.new("KeyLight", key_light)
    k_obj.location = (25.0, 20.0, 25.0)
    bpy.context.collection.objects.link(k_obj)

    cam_data = bpy.data.cameras.new("ProofCam")
    cam_data.lens = 75
    cam_obj = bpy.data.objects.new("ProofCam", cam_data)
    cam_obj.location = (28.0, -20.0, 16.0)
    target = mathutils.Vector((5.5, 0.5, 1.2))
    rot_quat = (target - cam_obj.location).to_track_quat('-Z', 'Y')
    cam_obj.rotation_euler = rot_quat.to_euler()
    bpy.context.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    out_path = OUT_DIR / "proof_multicanal_splines_3d.png"
    scene.render.filepath = str(out_path)
    bpy.ops.render.render(write_still=True)
    print(f"Saved: {out_path}")
    if EXTRA_OUT_DIR and EXTRA_OUT_DIR.exists():
        import shutil
        shutil.copy2(out_path, EXTRA_OUT_DIR / out_path.name)


def render_eye_proof():
    print("--- Rendering 3D Eye Avatar Proof ---")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 48
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 960

    world = bpy.data.worlds.new("EyeProofWorld")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs['Color'].default_value = (0.03, 0.05, 0.08, 1.0)
        bg.inputs['Strength'].default_value = 0.5

    # Import eye_avatar.glb
    glb_path = IEMAP_DIR / "eye_avatar.glb"
    bpy.ops.import_scene.gltf(filepath=str(glb_path))

    # Add ample lighting
    key = bpy.data.lights.new("EyeKey", type='AREA')
    key.energy = 15.0
    key.size = 0.25
    key.color = (1.0, 0.98, 0.95)
    k_obj = bpy.data.objects.new("EyeKey", key)
    k_obj.location = (-0.08, 0.25, 0.15)
    bpy.context.collection.objects.link(k_obj)

    fill = bpy.data.lights.new("EyeFill", type='AREA')
    fill.energy = 8.0
    fill.size = 0.30
    fill.color = (0.85, 0.92, 1.0)
    f_obj = bpy.data.objects.new("EyeFill", fill)
    f_obj.location = (0.10, 0.20, 0.08)
    bpy.context.collection.objects.link(f_obj)

    rim = bpy.data.lights.new("EyeRim", type='SPOT')
    rim.energy = 12.0
    rim.color = (0.4, 0.8, 1.0)
    r_obj = bpy.data.objects.new("EyeRim", rim)
    r_obj.location = (0.0, -0.20, 0.15)
    bpy.context.collection.objects.link(r_obj)

    # Camera looking directly at the bilateral eyes centered
    cam = bpy.data.cameras.new("EyeCam")
    cam.lens = 70
    c_obj = bpy.data.objects.new("EyeCam", cam)
    c_obj.location = (0.0, 0.26, 0.0)
    target = mathutils.Vector((0.0, 0.0, 0.0))
    rot_quat = (target - c_obj.location).to_track_quat('-Z', 'Y')
    c_obj.rotation_euler = rot_quat.to_euler()
    bpy.context.collection.objects.link(c_obj)
    scene.camera = c_obj

    out_path = OUT_DIR / "proof_eye_avatar_cyclotorsion.png"
    scene.render.filepath = str(out_path)
    bpy.ops.render.render(write_still=True)
    print(f"Saved: {out_path}")
    if EXTRA_OUT_DIR and EXTRA_OUT_DIR.exists():
        import shutil
        shutil.copy2(out_path, EXTRA_OUT_DIR / out_path.name)


if __name__ == "__main__":
    render_multicanal_proof()
    render_eye_proof()
    print("Proof rendering complete!")
