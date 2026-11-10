"""
scripts/render_head_inspection.py

Renders multi-angle visual inspection passes of
`assets/iemap-realistic-head-context-candidate.blend`
focusing on:
1. The sculpted anatomical head & facial features.
2. The authentic 3D bilateral eye model (sclera + glass cornea + blue/hazel iris + black pupil).
3. The embedded authentic 3D right inner ear labyrinth (cochlea, canals, ampullae) within the temporal bone.
"""

import os
import sys
import math
from pathlib import Path
import bpy
import mathutils

REPO_ROOT = Path(__file__).resolve().parent.parent

def setup_inspection_render():
    blend_path = (REPO_ROOT / "assets" / "iemap-realistic-head-context-candidate.blend").resolve()
    out_dir = Path(os.environ.get("INSPECTION_OUT_DIR", str(REPO_ROOT / "build" / "inspection"))).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    # Enable Cycles CPU
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 48
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 960
    scene.render.film_transparent = False

    # Set background color to Gate 3 charcoal #071014
    world = scene.world
    if not world:
        world = bpy.data.worlds.new("InspectionWorld")
        scene.world = world
    world.use_nodes = True
    bg_node = world.node_tree.nodes.get("Background")
    if bg_node:
        bg_node.inputs['Color'].default_value = (0.025, 0.05, 0.07, 1.0)
        bg_node.inputs['Strength'].default_value = 0.45

    # Retrieve objects
    head = bpy.data.objects.get("GEO-head_sculpting_realistic")
    sclera_l = bpy.data.objects.get("GEO-head_sculpting_realistic.sclera.L")
    sclera_r = bpy.data.objects.get("GEO-head_sculpting_realistic.sclera.R")
    iris_l = bpy.data.objects.get("GEO-head_sculpting_realistic.iris.L")
    iris_r = bpy.data.objects.get("GEO-head_sculpting_realistic.iris.R")
    ear_ring = bpy.data.objects.get("Right_ear_locator_ring")

    # Retrieve embedded labyrinth meshes
    lab_objs = [
        o for o in bpy.data.objects 
        if o.name.startswith("right.") or "cupula" in o.name or o.name.startswith("atlas.")
    ]

    # Ensure all are visible
    for obj in [head, sclera_l, sclera_r, iris_l, iris_r, ear_ring] + lab_objs:
        if obj:
            obj.hide_render = False
            obj.hide_viewport = False

    # 1. Skin Material (warm clinical neutral)
    mat_skin = bpy.data.materials.new(name="InspectSkin")
    mat_skin.use_nodes = True
    bsdf_skin = mat_skin.node_tree.nodes.get("Principled BSDF")
    if bsdf_skin:
        bsdf_skin.inputs['Base Color'].default_value = (0.80, 0.70, 0.63, 1.0)
        bsdf_skin.inputs['Roughness'].default_value = 0.50

    # 2. Translucent Cutaway Skin for 3/4 perspective (shows labyrinth inside)
    mat_skin_translucent = bpy.data.materials.new(name="InspectSkinTranslucent")
    mat_skin_translucent.use_nodes = True
    bsdf_st = mat_skin_translucent.node_tree.nodes.get("Principled BSDF")
    if bsdf_st:
        bsdf_st.inputs['Base Color'].default_value = (0.75, 0.68, 0.62, 1.0)
        bsdf_st.inputs['Transmission Weight'].default_value = 0.55
        bsdf_st.inputs['Roughness'].default_value = 0.35

    # 3. Sclera Material (glossy white with subtle vascular tone)
    mat_sclera = bpy.data.materials.new(name="InspectSclera")
    mat_sclera.use_nodes = True
    bsdf_sclera = mat_sclera.node_tree.nodes.get("Principled BSDF")
    if bsdf_sclera:
        bsdf_sclera.inputs['Base Color'].default_value = (0.94, 0.94, 0.96, 1.0)
        bsdf_sclera.inputs['Roughness'].default_value = 0.15

    # 4. Cornea Material (transparent prolate dome)
    mat_cornea = bpy.data.materials.new(name="InspectCornea")
    mat_cornea.use_nodes = True
    bsdf_cornea = mat_cornea.node_tree.nodes.get("Principled BSDF")
    if bsdf_cornea:
        bsdf_cornea.inputs['Base Color'].default_value = (1.0, 1.0, 1.0, 1.0)
        bsdf_cornea.inputs['Transmission Weight'].default_value = 1.0
        bsdf_cornea.inputs['Roughness'].default_value = 0.02
        bsdf_cornea.inputs['IOR'].default_value = 1.336

    # 5. Iris Material (rich blue-grey with dark limbal edge)
    mat_iris = bpy.data.materials.new(name="InspectIris")
    mat_iris.use_nodes = True
    bsdf_iris = mat_iris.node_tree.nodes.get("Principled BSDF")
    if bsdf_iris:
        bsdf_iris.inputs['Base Color'].default_value = (0.12, 0.38, 0.55, 1.0)
        bsdf_iris.inputs['Roughness'].default_value = 0.30

    # 6. Deep Pupil Black Cavity Backplate
    mat_pupil = bpy.data.materials.new(name="InspectPupil")
    mat_pupil.use_nodes = True
    bsdf_pupil = mat_pupil.node_tree.nodes.get("Principled BSDF")
    if bsdf_pupil:
        bsdf_pupil.inputs['Base Color'].default_value = (0.01, 0.01, 0.01, 1.0)
        bsdf_pupil.inputs['Roughness'].default_value = 0.90

    # 7. Glowing Labyrinth Material (Gate 3 Medaium Cyan & Warm Amber)
    mat_lab_cyan = bpy.data.materials.new(name="InspectLabCyan")
    mat_lab_cyan.use_nodes = True
    bsdf_lc = mat_lab_cyan.node_tree.nodes.get("Principled BSDF")
    if bsdf_lc:
        bsdf_lc.inputs['Base Color'].default_value = (0.0, 0.82, 0.94, 1.0)
        bsdf_lc.inputs['Emission Color'].default_value = (0.0, 0.82, 0.94, 1.0)
        bsdf_lc.inputs['Emission Strength'].default_value = 2.5

    mat_lab_amber = bpy.data.materials.new(name="InspectLabAmber")
    mat_lab_amber.use_nodes = True
    bsdf_la = mat_lab_amber.node_tree.nodes.get("Principled BSDF")
    if bsdf_la:
        bsdf_la.inputs['Base Color'].default_value = (1.0, 0.65, 0.15, 1.0)
        bsdf_la.inputs['Emission Color'].default_value = (1.0, 0.65, 0.15, 1.0)
        bsdf_la.inputs['Emission Strength'].default_value = 2.0

    # Assign multi-material to sclera (opaque sclera + transparent cornea front)
    for s in [sclera_l, sclera_r]:
        if not s: continue
        s.data.materials.clear()
        s.data.materials.append(mat_sclera)
        s.data.materials.append(mat_cornea)
        for poly in s.data.polygons:
            # Front faces in local coordinates
            if all(s.data.vertices[i].co.y < -0.010 for i in poly.vertices):
                poly.material_index = 1
            else:
                poly.material_index = 0

    # Assign iris material
    for i in [iris_l, iris_r]:
        if not i: continue
        i.data.materials.clear()
        i.data.materials.append(mat_iris)

    # Assign labyrinth materials
    for obj in lab_objs:
        if not obj: continue
        obj.data.materials.clear()
        if "duct" in obj.name or "ampulla" in obj.name:
            obj.data.materials.append(mat_lab_cyan)
        else:
            obj.data.materials.append(mat_lab_amber)

    # Ear locator ring
    if ear_ring:
        ear_ring.data.materials.clear()
        ear_ring.data.materials.append(mat_lab_cyan)

    # Lighting setup
    key_light_data = bpy.data.lights.new(name="InspectKeyLight", type='AREA')
    key_light_data.energy = 9.0
    key_light_data.size = 0.35
    key_light_data.color = (1.0, 0.98, 0.95)
    key_light = bpy.data.objects.new(name="InspectKeyLight", object_data=key_light_data)
    key_light.location = (-0.12, 0.38, 0.22)
    bpy.context.collection.objects.link(key_light)

    fill_light_data = bpy.data.lights.new(name="InspectFillLight", type='AREA')
    fill_light_data.energy = 4.0
    fill_light_data.size = 0.45
    fill_light_data.color = (0.85, 0.92, 1.0)
    fill_light = bpy.data.objects.new(name="InspectFillLight", object_data=fill_light_data)
    fill_light.location = (0.18, 0.30, 0.10)
    bpy.context.collection.objects.link(fill_light)

    rim_light_data = bpy.data.lights.new(name="InspectRimLight", type='SPOT')
    rim_light_data.energy = 7.0
    rim_light_data.color = (0.4, 0.8, 1.0)
    rim_light = bpy.data.objects.new(name="InspectRimLight", object_data=rim_light_data)
    rim_light.location = (-0.025, -0.32, 0.22)
    bpy.context.collection.objects.link(rim_light)

    def look_at(cam_obj, target):
        direction = target - cam_obj.location
        rot_quat = direction.to_track_quat('-Z', 'Y')
        cam_obj.rotation_euler = rot_quat.to_euler()

    cam_data = bpy.data.cameras.new(name="InspectCam")
    cam_data.lens = 85
    cam_obj = bpy.data.objects.new(name="InspectCam", object_data=cam_data)
    bpy.context.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    face_center = mathutils.Vector((-0.025, 0.050, -0.015))
    eyes_center = mathutils.Vector((-0.02485, 0.0548, -0.0005))
    head_center = mathutils.Vector((-0.025, 0.0075, -0.0426))

    renders = [
        {
            "filename": "head_inspection_frontal_portrait.png",
            "desc": "Frontal Portrait: Head & Realistic Eyes",
            "cam_loc": mathutils.Vector((-0.025, 0.45, -0.015)),
            "target": face_center,
            "lens": 85,
            "translucent_head": False,
        },
        {
            "filename": "head_inspection_eyes_macro_closeup.png",
            "desc": "Macro Close-Up: Iris, Pupil & Sclera",
            "cam_loc": mathutils.Vector((-0.02485, 0.20, -0.0005)),
            "target": eyes_center,
            "lens": 120,
            "translucent_head": False,
        },
        {
            "filename": "head_inspection_34_perspective.png",
            "desc": "3/4 View: Head Cutaway with Embedded Inner Ear Labyrinth",
            "cam_loc": mathutils.Vector((0.26, 0.32, 0.10)),
            "target": head_center,
            "lens": 70,
            "translucent_head": True,
        },
        {
            "filename": "head_inspection_right_profile.png",
            "desc": "Right Lateral Profile: Ear & Labyrinth Alignment",
            "cam_loc": mathutils.Vector((0.40, 0.0075, -0.0426)),
            "target": head_center,
            "lens": 85,
            "translucent_head": False,
        },
    ]

    for idx, r in enumerate(renders):
        print(f"[{idx+1}/{len(renders)}] Rendering {r['filename']}...")
        # Assign solid vs translucent head material
        if head:
            head.data.materials.clear()
            if r["translucent_head"]:
                head.data.materials.append(mat_skin_translucent)
            else:
                head.data.materials.append(mat_skin)

        cam_obj.location = r["cam_loc"]
        cam_data.lens = r["lens"]
        look_at(cam_obj, r["target"])
        look_at(key_light, r["target"])

        out_path = out_dir / r["filename"]
        scene.render.filepath = str(out_path)
        bpy.ops.render.render(write_still=True)
        print(f"Saved: {out_path}")

    print("All inspection renders completed successfully!")

if __name__ == "__main__":
    setup_inspection_render()
