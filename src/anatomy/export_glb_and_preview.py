#!/usr/bin/env python3
"""
Blender headless script to assemble the IE-Map 3D meshes into a single .glb asset
(`assets/iemap/iemap_right_labyrinth.glb`) and render an anatomical verification still
(`build/proof/iemap_3d_verification.png`) using noiseless direct-lighting Cycles CPU.
"""

import json
import math
import time
from pathlib import Path
import bpy
import mathutils


def create_gate3_material(name: str, rgba: tuple, roughness: float = 0.35, emission: float = 0.0):
    """
    Deterministic zero-variance Gate 3 shader for Cycles CPU:
    - Opaque / semi-opaque context: Diffuse BSDF + Emission rim (zero Monte Carlo speckle under angle=0 SUN lights)
    - Translucent lumen (alpha < 0.85): AddShader(Fresnel/Facing shaded Emission, Transparent BSDF(1 - alpha))
      which evaluates both transmission and surface shading deterministically on every ray with 0.0 variance!
    """
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    mat.diffuse_color = rgba
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out_node = nodes.new("ShaderNodeOutputMaterial")
    r, g, b, alpha = float(rgba[0]), float(rgba[1]), float(rgba[2]), float(rgba[3])

    if emission >= 1.2:
        # Warm glowing canalith particle with 3D shading + strong warm core
        geom = nodes.new("ShaderNodeNewGeometry")
        vec_math = nodes.new("ShaderNodeVectorMath")
        vec_math.operation = "DOT_PRODUCT"
        vec_math.inputs[1].default_value = (0.58, 0.42, 0.70)
        links.new(geom.outputs["Normal"], vec_math.inputs[0])

        math_add = nodes.new("ShaderNodeMath")
        math_add.operation = "MULTIPLY_ADD"
        math_add.inputs[1].default_value = 0.55
        math_add.inputs[2].default_value = 1.25
        links.new(vec_math.outputs["Value"], math_add.inputs[0])

        em = nodes.new("ShaderNodeEmission")
        em.inputs["Color"].default_value = (r, g, b, 1.0)
        links.new(math_add.outputs["Value"], em.inputs["Strength"])
        links.new(em.outputs["Emission"], out_node.inputs["Surface"])
        return mat

    if alpha < 0.80:
        # Deterministic translucent medical glass shader using MixShader + backface attenuation
        geom = nodes.new("ShaderNodeNewGeometry")
        lw = nodes.new("ShaderNodeLayerWeight")
        lw.inputs["Blend"].default_value = 0.42

        ramp_col = nodes.new("ShaderNodeValToRGB")
        ramp_col.color_ramp.elements[0].position = 0.0
        ramp_col.color_ramp.elements[0].color = (r * 0.55, g * 0.55, b * 0.55, 1.0)
        ramp_col.color_ramp.elements[1].position = 1.0
        ramp_col.color_ramp.elements[1].color = (min(1.0, r * 1.18), min(1.0, g * 1.18), min(1.0, b * 1.18), 1.0)
        links.new(lw.outputs["Facing"], ramp_col.inputs["Fac"])

        em = nodes.new("ShaderNodeEmission")
        em.inputs["Strength"].default_value = 1.05 + emission * 0.6
        links.new(ramp_col.outputs["Color"], em.inputs["Color"])

        ramp_op = nodes.new("ShaderNodeValToRGB")
        ramp_op.color_ramp.elements[0].position = 0.0
        ramp_op.color_ramp.elements[0].color = (alpha * 0.36, alpha * 0.36, alpha * 0.36, 1.0)
        ramp_op.color_ramp.elements[1].position = 1.0
        ramp_op.color_ramp.elements[1].color = (min(0.82, alpha * 1.65), min(0.82, alpha * 1.65), min(0.82, alpha * 1.65), 1.0)
        links.new(lw.outputs["Facing"], ramp_op.inputs["Fac"])

        # Attenuate backfaces so front lumen stays crystal clear
        bf_mul = nodes.new("ShaderNodeMath")
        bf_mul.operation = "MULTIPLY_ADD"
        bf_mul.inputs[1].default_value = -0.65
        bf_mul.inputs[2].default_value = 1.0
        links.new(geom.outputs["Backfacing"], bf_mul.inputs[0])

        op_final = nodes.new("ShaderNodeMath")
        op_final.operation = "MULTIPLY"
        links.new(ramp_op.outputs["Color"], op_final.inputs[0])
        links.new(bf_mul.outputs["Value"], op_final.inputs[1])

        trans = nodes.new("ShaderNodeBsdfTransparent")
        trans.inputs["Color"].default_value = (1.0, 1.0, 1.0, 1.0)

        mix_sh = nodes.new("ShaderNodeMixShader")
        links.new(op_final.outputs["Value"], mix_sh.inputs["Fac"])
        links.new(trans.outputs["BSDF"], mix_sh.inputs[1])
        links.new(em.outputs["Emission"], mix_sh.inputs[2])
        links.new(mix_sh.outputs["Shader"], out_node.inputs["Surface"])
        return mat

    # Opaque context anatomy: deterministic 3D normal key/fill shading + Fresnel rim via Emission -> 0.0 Monte Carlo grain!
    geom = nodes.new("ShaderNodeNewGeometry")
    vec_math = nodes.new("ShaderNodeVectorMath")
    vec_math.operation = "DOT_PRODUCT"
    vec_math.inputs[1].default_value = (0.58, 0.42, 0.70)
    links.new(geom.outputs["Normal"], vec_math.inputs[0])

    lw = nodes.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.30

    math_add = nodes.new("ShaderNodeMath")
    math_add.operation = "MULTIPLY_ADD"
    math_add.inputs[1].default_value = 0.45
    math_add.inputs[2].default_value = 0.52
    links.new(vec_math.outputs["Value"], math_add.inputs[0])

    math_rim = nodes.new("ShaderNodeMath")
    math_rim.operation = "MULTIPLY_ADD"
    math_rim.inputs[1].default_value = 0.30
    links.new(lw.outputs["Facing"], math_rim.inputs[0])
    links.new(math_add.outputs["Value"], math_rim.inputs[2])

    em = nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (r, g, b, 1.0)
    links.new(math_rim.outputs["Value"], em.inputs["Strength"])
    links.new(em.outputs["Emission"], out_node.inputs["Surface"])
    return mat


def look_at(obj, target: mathutils.Vector):
    direction = target - obj.location
    rot_quat = direction.to_track_quat("-Z", "Y")
    obj.rotation_euler = rot_quat.to_euler()


def main():
    t0 = time.time()
    repo_root = Path(__file__).resolve().parent.parent.parent
    iemap_dir = repo_root / "assets" / "iemap"
    meta_path = iemap_dir / "iemap_Metadata.json"
    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 4
    scene.cycles.max_bounces = 1
    scene.cycles.diffuse_bounces = 0
    scene.cycles.glossy_bounces = 0
    scene.cycles.transmission_bounces = 0
    scene.cycles.volume_bounces = 0
    scene.cycles.transparent_max_bounces = 8
    scene.cycles.use_denoising = False

    world = bpy.data.worlds.new("Gate3World")
    scene.world = world
    world.use_nodes = True
    bg_node = world.node_tree.nodes.get("Background")
    if bg_node:
        # Gate 3 dark charcoal canvas (#071014 -> linear [0.004, 0.014, 0.02, 1.0])
        bg_node.inputs[0].default_value = (0.004, 0.014, 0.020, 1.0)
        bg_node.inputs[1].default_value = 1.0

    root_empty = bpy.data.objects.new("IEMap_Right_Labyrinth_RAS", None)
    scene.collection.objects.link(root_empty)

    for mesh_name, info in meta["meshes"].items():
        obj_path = repo_root / info["obj"]
        bpy.ops.wm.obj_import(
            filepath=str(obj_path),
            forward_axis="Y",
            up_axis="Z",
        )
        imported_obj = bpy.context.selected_objects[0]
        imported_obj.name = mesh_name
        imported_obj.parent = root_empty

        for poly in imported_obj.data.polygons:
            poly.use_smooth = True

        role = info["role"]
        visible = bool(info.get("visible_by_default", True))
        imported_obj.hide_render = not visible

        if role == "posterior_duct":
            mat = create_gate3_material(f"mat_{mesh_name}", (0.322, 0.863, 0.949, 0.36), roughness=0.22, emission=0.35)
            imported_obj.visible_shadow = False
        elif role == "common_crus":
            mat = create_gate3_material(f"mat_{mesh_name}", (0.620, 0.680, 0.920, 0.42), roughness=0.24, emission=0.25)
            imported_obj.visible_shadow = False
        elif role in ("utricle", "utricular_cistern"):
            mat = create_gate3_material(f"mat_{mesh_name}", (0.460, 0.780, 0.620, 0.45), roughness=0.26, emission=0.20)
            imported_obj.visible_shadow = False
        elif role in ("posterior_ampulla", "posterior_cupula"):
            mat = create_gate3_material(f"mat_{mesh_name}", (0.941, 0.667, 0.384, 0.92), roughness=0.28, emission=0.18)
        elif role == "cochlear_duct":
            mat = create_gate3_material(f"mat_{mesh_name}", (0.520, 0.680, 0.820, 0.95), roughness=0.30, emission=0.14)
        else:
            mat = create_gate3_material(f"mat_{mesh_name}", (0.420, 0.510, 0.650, 0.92), roughness=0.42, emission=0.08)

        if imported_obj.data.materials:
            imported_obj.data.materials[0] = mat
        else:
            imported_obj.data.materials.append(mat)

    glb_path = iemap_dir / "iemap_right_labyrinth.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(glb_path),
        export_format="GLB",
        use_selection=False,
    )
    print(f"[export_glb] Exported {glb_path}")

    # Add 5 schematic warm amber particles inside the posterior canal (-91..-77 deg) for the verification preview
    with open(iemap_dir / "posterior_canal_path.json", "r", encoding="utf-8") as pf:
        path_data = json.load(pf)
    samples = path_data["samples"]
    mat_particle = create_gate3_material("canaliths_enlarged_warm", (0.980, 0.560, 0.140, 1.0), roughness=0.15, emission=2.0)
    for idx_p, s_idx in enumerate([21, 25, 29, 33, 37]):
        pt_ras = samples[s_idx]["position_ras"]
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=12, radius=0.135, location=tuple(pt_ras))
        p_obj = bpy.context.active_object
        p_obj.name = f"Schematic_canalith_{idx_p+1:02d}"
        for poly in p_obj.data.polygons:
            poly.use_smooth = True
        p_obj.data.materials.append(mat_particle)
        p_obj.parent = root_empty

    cam_data = bpy.data.cameras.new(name="VerifyCam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 18.5
    cam_obj = bpy.data.objects.new(name="VerifyCam", object_data=cam_data)
    cam_obj.location = (18.5, 7.5, 7.2)
    scene.collection.objects.link(cam_obj)
    look_at(cam_obj, mathutils.Vector((4.5, 1.4, 0.5)))
    scene.camera = cam_obj

    proof_dir = repo_root / "build" / "proof"
    proof_dir.mkdir(parents=True, exist_ok=True)
    out_png = proof_dir / "iemap_3d_verification.png"
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.render.filepath = str(out_png)
    bpy.ops.render.render(write_still=True)
    print(f"[export_glb] Rendered Gate 3 verification frame {out_png} in {time.time() - t0:.2f}s")


if __name__ == "__main__":
    main()
