#!/usr/bin/env python3
"""
Gate 3 Blender 3D Dual-Stage Scene Builder (`src/render/blender_scene_builder.py`)
==================================================================================
Constructs a unified 3D scene in Blender 5.2 LTS (`2560 x 1080`, divided into two `1280 x 1080`
stages on the `#071014` Gate 3 charcoal background):
  1. Left Half (`x = 0..1280`, Patient Stage):
     - Elevated 3/4 clinical camera view of the examination table & teal shoulder bolster.
     - Contoured clinical patient figure + monolithic high-resolution sculpted anatomical head & neck
       (`GEO-head_sculpting_realistic` with brow ridge, recessed orbital sockets & sculpted eyelids,
       prominent nasal bridge/tip/alar wings, cheekbones, philtrum/lips, chin/jawline, integrated
       bilateral sculpted ears, seamless neck, `Right_ear_locator_ring`, and authentic 3D IE-Map
       Right Labyrinth embedded inside the right temporal bone for Shot 1 cutaway mode).
     - "The Doctor Layer": single-mesh single-surface-glass translucent cyan clinician support hands
       cupping the head + smooth Frenet-swept 3D curved action arrows in open space around the head/torso.
  2. Right Half (`x = 1280..2560`, Gate 3 Labyrinth Stage):
     - High-detail 18-mesh IE-Map Right Labyrinth rendered with the Gate 3 look-config palette:
       translucent cyan posterior canal (`Sp`), soft lavender common crus (`CCp`), translucent sage-green
       utricle, warm amber posterior ampulla (`Ap`), muted slate-grey context anatomy (`Sa`, `Sl`, cochlea, `OC`),
       and 5 enlarged warm amber canalith particles (`Schematic_canalith_01..05`).
     - World gravity `g_world = (0, 0, -1)` is preserved straight down (`-Z`).
"""

import json
import math
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import bpy
import mathutils
from bpy_extras.object_utils import world_to_camera_view
import numpy as np


def create_gate3_shader(
    name: str,
    rgba: Tuple[float, float, float, float],
    roughness: float = 0.32,
    emission: float = 0.0,
    single_surface_glass: bool = False,
):
    """
    Deterministic zero-variance Gate 3 shader for Cycles CPU (`samples = 4`, `0.0` Monte Carlo noise):
      - High emission (`>= 1.1`): 3D normal-shaded glowing emissive core (for canalith particles, beacons, action arrows).
      - Translucent (`alpha < 0.80`):
          * `single_surface_glass=True` (cutaway head, clinician hands): uses `Geometry.Backfacing` +
            `LightPath.Transparent Depth < 0.5` with `MixShader` so ONLY the nearest front-facing outer
            surface is shaded as smooth medical glass—eliminating all internal self-overlap and far-side ghosting.
          * `single_surface_glass=False` (labyrinth lumen `Sp`, `CCp`, `utricle`): uses `MixShader` with
            backface attenuation so front and back canal walls read as crystal-clear glass without white blowout.
      - Opaque (`alpha >= 0.80`): 3-point deterministic studio normal shader (Key + Fill + Fresnel Rim)
        driving Emission so facial sculpting and anatomy read with crisp studio contrast and 0.0 grain.
    """
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    mat.diffuse_color = rgba
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out_node = nodes.new("ShaderNodeOutputMaterial")
    r, g, b, alpha = float(rgba[0]), float(rgba[1]), float(rgba[2]), float(rgba[3])

    if alpha <= 0.01:
        trans = nodes.new("ShaderNodeBsdfTransparent")
        trans.inputs["Color"].default_value = (1.0, 1.0, 1.0, 1.0)
        links.new(trans.outputs["BSDF"], out_node.inputs["Surface"])
        return mat

    if emission >= 1.1:
        geom = nodes.new("ShaderNodeNewGeometry")
        vec_math = nodes.new("ShaderNodeVectorMath")
        vec_math.operation = "DOT_PRODUCT"
        vec_math.inputs[1].default_value = (0.45, -0.55, 0.70)
        links.new(geom.outputs["Normal"], vec_math.inputs[0])

        math_add = nodes.new("ShaderNodeMath")
        math_add.operation = "MULTIPLY_ADD"
        math_add.inputs[1].default_value = 0.45
        math_add.inputs[2].default_value = 1.15
        links.new(vec_math.outputs["Value"], math_add.inputs[0])

        em = nodes.new("ShaderNodeEmission")
        em.inputs["Color"].default_value = (r, g, b, 1.0)
        links.new(math_add.outputs["Value"], em.inputs["Strength"])
        links.new(em.outputs["Emission"], out_node.inputs["Surface"])
        return mat

    if alpha < 0.80:
        geom = nodes.new("ShaderNodeNewGeometry")
        lw = nodes.new("ShaderNodeLayerWeight")
        lw.inputs["Blend"].default_value = 0.42

        ramp_col = nodes.new("ShaderNodeValToRGB")
        ramp_col.color_ramp.elements[0].position = 0.0
        ramp_col.color_ramp.elements[0].color = (r * 0.58, g * 0.58, b * 0.58, 1.0)
        ramp_col.color_ramp.elements[1].position = 1.0
        ramp_col.color_ramp.elements[1].color = (
            min(1.0, r * 1.18),
            min(1.0, g * 1.18),
            min(1.0, b * 1.18),
            1.0,
        )
        links.new(lw.outputs["Facing"], ramp_col.inputs["Fac"])

        em = nodes.new("ShaderNodeEmission")
        em.inputs["Strength"].default_value = 1.05 + emission * 0.6
        links.new(ramp_col.outputs["Color"], em.inputs["Color"])

        ramp_op = nodes.new("ShaderNodeValToRGB")
        ramp_op.color_ramp.elements[0].position = 0.0
        ramp_op.color_ramp.elements[0].color = (alpha * 0.36, alpha * 0.36, alpha * 0.36, 1.0)
        ramp_op.color_ramp.elements[1].position = 1.0
        ramp_op.color_ramp.elements[1].color = (
            min(0.84, alpha * 1.68),
            min(0.84, alpha * 1.68),
            min(0.84, alpha * 1.68),
            1.0,
        )
        links.new(lw.outputs["Facing"], ramp_op.inputs["Fac"])

        if single_surface_glass:
            # Shade ONLY the first front-facing outer shell (Backfacing == 0 and Transparent Depth < 0.5)
            lp = nodes.new("ShaderNodeLightPath")
            depth_lt = nodes.new("ShaderNodeMath")
            depth_lt.operation = "LESS_THAN"
            depth_lt.inputs[1].default_value = 0.5
            links.new(lp.outputs["Transparent Depth"], depth_lt.inputs[0])

            front_mask = nodes.new("ShaderNodeMath")
            front_mask.operation = "SUBTRACT"
            front_mask.inputs[0].default_value = 1.0
            links.new(geom.outputs["Backfacing"], front_mask.inputs[1])

            shell_mask = nodes.new("ShaderNodeMath")
            shell_mask.operation = "MULTIPLY"
            links.new(front_mask.outputs["Value"], shell_mask.inputs[0])
            links.new(depth_lt.outputs["Value"], shell_mask.inputs[1])

            op_final = nodes.new("ShaderNodeMath")
            op_final.operation = "MULTIPLY"
            links.new(ramp_op.outputs["Color"], op_final.inputs[0])
            links.new(shell_mask.outputs["Value"], op_final.inputs[1])
        else:
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

    # 3-point studio normal shading (Key + Fill + Rim) for opaque clinical & anatomical surfaces
    geom = nodes.new("ShaderNodeNewGeometry")

    key_dot = nodes.new("ShaderNodeVectorMath")
    key_dot.operation = "DOT_PRODUCT"
    key_dot.inputs[1].default_value = (0.44, -0.64, 0.63)
    links.new(geom.outputs["Normal"], key_dot.inputs[0])

    key_clamp = nodes.new("ShaderNodeMath")
    key_clamp.operation = "MAXIMUM"
    key_clamp.inputs[1].default_value = -0.35
    links.new(key_dot.outputs["Value"], key_clamp.inputs[0])

    lw = nodes.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.32

    math_add = nodes.new("ShaderNodeMath")
    math_add.operation = "MULTIPLY_ADD"
    math_add.inputs[1].default_value = 0.46
    math_add.inputs[2].default_value = 0.54 + emission * 0.35
    links.new(key_clamp.outputs["Value"], math_add.inputs[0])

    math_rim = nodes.new("ShaderNodeMath")
    math_rim.operation = "MULTIPLY_ADD"
    math_rim.inputs[1].default_value = 0.24
    links.new(lw.outputs["Facing"], math_rim.inputs[0])
    links.new(math_add.outputs["Value"], math_rim.inputs[2])

    em = nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (r, g, b, 1.0)
    links.new(math_rim.outputs["Value"], em.inputs["Strength"])
    links.new(em.outputs["Emission"], out_node.inputs["Surface"])
    return mat


def add_cylinder_between(
    name: str,
    p1: Tuple[float, float, float],
    p2: Tuple[float, float, float],
    radius: float,
    mat,
    parent=None,
    vertices: int = 24,
):
    v1 = mathutils.Vector(p1)
    v2 = mathutils.Vector(p2)
    diff = v2 - v1
    length = diff.length
    if length < 1e-6:
        return None
    mid = (v1 + v2) * 0.5
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=length,
        location=(0.0, 0.0, 0.0),
    )
    obj = bpy.context.active_object
    obj.name = name
    for poly in obj.data.polygons:
        poly.use_smooth = True
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)
    if parent is not None:
        obj.parent = parent
    obj.location = mid
    rot_quat = diff.to_track_quat("Z", "Y")
    obj.rotation_euler = rot_quat.to_euler()
    return obj


def add_uv_sphere(
    name: str,
    location: Tuple[float, float, float],
    scale: Tuple[float, float, float],
    mat,
    parent=None,
    segments: int = 28,
    ring_count: int = 18,
):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments,
        ring_count=ring_count,
        radius=1.0,
        location=(0.0, 0.0, 0.0),
    )
    obj = bpy.context.active_object
    obj.name = name
    for poly in obj.data.polygons:
        poly.use_smooth = True
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)
    if parent is not None:
        obj.parent = parent
    obj.location = location
    obj.scale = scale
    return obj


def add_box(
    name: str,
    location: Tuple[float, float, float],
    scale: Tuple[float, float, float],
    mat,
    parent=None,
    bevel: bool = False,
):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.0, 0.0, 0.0))
    obj = bpy.context.active_object
    obj.name = name
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)
    if parent is not None:
        obj.parent = parent
    obj.location = location
    obj.scale = scale
    if bevel:
        mod = obj.modifiers.new("Bevel", "BEVEL")
        mod.width = 0.045
        mod.segments = 3
        for poly in obj.data.polygons:
            poly.use_smooth = True
    return obj


def append_authentic_sculpted_head(
    repo_root: Path,
    parent: bpy.types.Object,
    mat_skin_solid: bpy.types.Material,
    mat_cyan_ring: bpy.types.Material,
) -> Tuple[bpy.types.Object, bpy.types.Object, bpy.types.Object, List[bpy.types.Object]]:
    """
    Appends the authentic CC0 sculpted anatomical head, eye meshes, and right ear locator ring
    from `assets/iemap-realistic-head-context-candidate.blend`.
    Creates an `AuthenticHeadRoot` empty parented to `NeckPivot` with:
      - scale: S = 6.2
      - rotation: (0.0, 0.0, -math.pi / 2.0) [maps Patient RAS (+X Right, +Y Ant, +Z Sup) to NeckPivot (+X Ant, -Y Right, +Z Sup)]
      - location: (0.017 * S, -0.025 * S, 0.1514 * S - 0.36) [seats the anatomical bust flare cleanly inside the open tunic collar]
    Under AuthenticHeadRoot, the right inner ear origin is at (0, 0, 0).
    Returns (auth_root, head_mesh_obj, ear_ring, eye_objs).
    """
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

    S = 6.2
    auth_root = bpy.data.objects.new("AuthenticHeadRoot", None)
    auth_root.parent = parent
    auth_root.scale = (S, S, S)
    auth_root.rotation_euler = (0.0, 0.0, -math.pi / 2.0)
    auth_root.location = (0.017 * S, -0.025 * S, 0.1514 * S - 0.36)
    scene_coll.objects.link(auth_root)

    cand_head_root = bpy.data.objects.get("HeadRoot")
    if cand_head_root:
        cand_head_root.parent = auth_root
        cand_head_root.matrix_local = mathutils.Matrix.Translation((-0.025, -0.020, -0.060))

    head_mesh_obj = bpy.data.objects.get("GEO-head_sculpting_realistic")
    if head_mesh_obj:
        if head_mesh_obj.data.materials:
            head_mesh_obj.data.materials[0] = mat_skin_solid
        else:
            head_mesh_obj.data.materials.append(mat_skin_solid)
        for poly in head_mesh_obj.data.polygons:
            poly.use_smooth = True

        # Taper the lower bust flare below the anatomical neck line (z < 0.135 in local mesh coordinates)
        # so the anatomical neck cylinder inserts seamlessly into the tunic collar without
        # flared clavicle/trapezius polygons clipping through the patient torso during head rotations.
        for v in head_mesh_obj.data.vertices:
            if v.co.z < 0.135:
                r = math.sqrt(v.co.x ** 2 + v.co.y ** 2)
                if r > 0.072:
                    v.co.x *= (0.072 / r)
                    v.co.y *= (0.072 / r)
        head_mesh_obj.data.update()

    eye_objs = []
    for eye_name in [
        "GEO-head_sculpting_realistic.iris.L",
        "GEO-head_sculpting_realistic.iris.R",
        "GEO-head_sculpting_realistic.sclera.L",
        "GEO-head_sculpting_realistic.sclera.R",
    ]:
        eye = bpy.data.objects.get(eye_name)
        if eye:
            eye_objs.append(eye)

    ear_ring = bpy.data.objects.get("Right_ear_locator_ring")
    if ear_ring:
        ear_ring.parent = auth_root
        ear_ring.matrix_local = mathutils.Matrix.Identity(4)
        ear_ring.data.bevel_depth = 0.003
        if ear_ring.data.materials:
            ear_ring.data.materials[0] = mat_cyan_ring
        else:
            ear_ring.data.materials.append(mat_cyan_ring)

    return auth_root, head_mesh_obj, ear_ring, eye_objs


def build_contoured_torso_mesh(name: str, mat_tunic, parent) -> bpy.types.Object:
    """
    Build a single seamless, anatomically contoured clinical tunic torso & shoulder mesh
    in HipPivot local coordinates (`z = -0.06` pelvis/waist up to `z = 1.94` neck collar).
    """
    n_z = 36
    n_lon = 56
    z_vals = np.linspace(-0.06, 1.94, n_z)
    verts = []
    faces = []

    def section_radii(z: float, v_lon: float) -> Tuple[float, float, float]:
        # Smooth anatomical profile from waist/hips -> chest -> broad deltoid shoulders -> collar
        u = (z - (-0.06)) / (1.94 - (-0.06))
        rx = 0.34 + 0.06 * math.sin(math.pi * (u ** 0.85))
        ry = 0.44 + 0.24 * (math.sin(math.pi * (u ** 1.15)) ** 1.2)
        if u > 0.84:
            t_col = (u - 0.84) / 0.16
            taper = math.cos(0.5 * math.pi * t_col * 0.76)
            rx = 0.205 + (rx - 0.205) * taper
            ry = 0.195 + (ry - 0.195) * taper

        # Subtle pectoral / thoracic anterior contour
        cos_v = math.cos(v_lon)
        sin_v = math.sin(v_lon)
        pec = 0.035 * math.exp(-0.5 * ((u - 0.68) / 0.16) ** 2) * max(0.0, cos_v)
        x = (rx + pec) * cos_v * (1.0 - 0.15 * max(0.0, u - 0.85) / 0.15) - 0.02 * max(0.0, (u - 0.84) / 0.16)
        y = ry * sin_v
        return (x, y, z)

    verts.append((0.0, 0.0, float(z_vals[0])))
    for z in z_vals:
        for j in range(n_lon):
            v = -math.pi + 2.0 * math.pi * j / n_lon
            verts.append(section_radii(float(z), v))
    for j in range(n_lon):
        jn = (j + 1) % n_lon
        faces.append((0, 1 + jn, 1 + j))

    for i in range(n_z - 1):
        r0 = 1 + i * n_lon
        r1 = 1 + (i + 1) * n_lon
        for j in range(n_lon):
            jn = (j + 1) % n_lon
            faces.append((r0 + j, r0 + jn, r1 + jn, r1 + j))

    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    obj.data.materials.append(mat_tunic)
    obj.parent = parent
    return obj


def build_cupped_clinician_hand(name: str, side: str, mat_glove, parent) -> bpy.types.Object:
    """
    Build a single, smooth, watertight cupped clinician support hand mesh (`side = 'right' | 'left'`)
    cradling the patient's temporal/occipital skull in NeckPivot local coordinates.
    Using a single manifold mesh with `single_surface_glass=True` guarantees zero internal joint glow
    and zero disembodied wrist poles.
    """
    sign_y = -1.0 if side == "right" else 1.0
    n_u = 28
    n_v = 36
    verts = []
    faces = []

    def hand_pt(u: float, v: float) -> Tuple[float, float, float]:
        # u in [0, pi] runs from short wrist cuff (u=0) across palm to curved fingertips (u=pi)
        # v in [-pi, pi) runs around the cross-section of the cupped hand
        sin_u = math.sin(u)
        t = u / math.pi  # 0 = wrist cuff, 0.5 = palm center, 1.0 = fingertips

        # Centerline of the cupped hand hugging the postero-lateral cranium
        cx = -0.34 + 0.36 * (t ** 1.05)
        cy = sign_y * (0.50 + 0.04 * math.sin(math.pi * t) - 0.07 * (t ** 1.6))
        cz = 0.56 + 0.24 * t

        # Cross-sectional half-axes (thin, curved glove profile)
        w_thick = 0.036 * sin_u * (1.0 - 0.25 * t)
        w_span = (0.11 + 0.065 * math.sin(math.pi * t)) * sin_u

        # Subtle thumb flare on the superior edge (cos_v > 0)
        cos_v = math.cos(v)
        sin_v = math.sin(v)
        thumb_flare = 0.045 * math.exp(-0.5 * ((t - 0.52) / 0.18) ** 2) * max(0.0, cos_v)

        # Tangent frame along the hand curve
        x = cx - w_thick * sin_v * 0.35
        y = cy + sign_y * w_thick * sin_v
        z = cz + (w_span + thumb_flare) * cos_v
        return (x, y, z)

    verts.append(hand_pt(0.0, 0.0))
    for i in range(1, n_u):
        u = math.pi * i / n_u
        for j in range(n_v):
            v = -math.pi + 2.0 * math.pi * j / n_v
            verts.append(hand_pt(u, v))
    verts.append(hand_pt(math.pi, 0.0))

    for j in range(n_v):
        jn = (j + 1) % n_v
        faces.append((0, 1 + j, 1 + jn))

    for i in range(n_u - 2):
        r0 = 1 + i * n_v
        r1 = 1 + (i + 1) * n_v
        for j in range(n_v):
            jn = (j + 1) % n_v
            faces.append((r0 + j, r1 + j, r1 + jn, r0 + jn))

    south_idx = len(verts) - 1
    r_last = 1 + (n_u - 2) * n_v
    for j in range(n_v):
        jn = (j + 1) % n_v
        faces.append((south_idx, r_last + jn, r_last + j))

    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    obj.data.materials.append(mat_glove)
    obj.parent = parent
    return obj


def build_curved_3d_arrow(
    name: str,
    points: List[Tuple[float, float, float]],
    radius: float,
    mat,
    parent,
) -> bpy.types.Object:
    """
    Build a single, smooth, continuous Frenet-swept 3D tubular curved arrow mesh with a sharp
    conical arrowhead (zero ball-joint primitives and zero internal end-caps).
    """
    pts_in = np.array(points, dtype=np.float64)
    # Upsample curve smoothly and append conical arrowhead profile along the final tangent
    t_in = np.linspace(0.0, 1.0, len(pts_in))
    t_shaft = np.linspace(0.0, 1.0, 40)
    shaft_pts = np.column_stack([np.interp(t_shaft, t_in, pts_in[:, k]) for k in range(3)])

    tan_end = shaft_pts[-1] - shaft_pts[-2]
    tan_norm = np.linalg.norm(tan_end)
    if tan_norm > 1e-8:
        tan_end /= tan_norm
    else:
        tan_end = np.array([1.0, 0.0, 0.0])

    cone_len = radius * 5.2
    s_head = np.linspace(0.02, 1.0, 10)
    head_pts = np.array([shaft_pts[-1] + (s * cone_len) * tan_end for s in s_head])

    all_pts = np.vstack([shaft_pts, head_pts])
    radii = np.concatenate([
        np.full(len(shaft_pts), radius),
        radius * 2.55 * (1.0 - s_head * 0.96),
    ])

    # Parallel-transport Frenet frames along all_pts
    tangents = np.gradient(all_pts, axis=0)
    norms = np.linalg.norm(tangents, axis=1, keepdims=True)
    norms = np.where(norms < 1e-9, 1.0, norms)
    T = tangents / norms

    N = np.zeros_like(T)
    B = np.zeros_like(T)
    ref = np.array([0.0, 0.0, 1.0])
    if abs(np.dot(T[0], ref)) > 0.9:
        ref = np.array([1.0, 0.0, 0.0])
    n0 = np.cross(T[0], ref)
    n0 /= np.linalg.norm(n0)
    N[0] = n0
    B[0] = np.cross(T[0], n0)

    for i in range(1, len(all_pts)):
        v = np.cross(T[i - 1], T[i])
        s = np.linalg.norm(v)
        c = np.dot(T[i - 1], T[i])
        if s < 1e-7:
            N[i] = N[i - 1]
            B[i] = B[i - 1]
        else:
            axis = v / s
            ang = math.atan2(s, c)
            n_prev = N[i - 1]
            n_rot = (
                n_prev * math.cos(ang)
                + np.cross(axis, n_prev) * math.sin(ang)
                + axis * np.dot(axis, n_prev) * (1.0 - math.cos(ang))
            )
            n_rot -= np.dot(n_rot, T[i]) * T[i]
            n_rot /= np.linalg.norm(n_rot)
            N[i] = n_rot
            B[i] = np.cross(T[i], N[i])

    n_theta = 24
    thetas = np.linspace(0.0, 2.0 * math.pi, n_theta, endpoint=False)
    cos_t = np.cos(thetas)
    sin_t = np.sin(thetas)

    verts = [tuple(all_pts[0])]
    for i in range(len(all_pts)):
        p = all_pts[i]
        r = float(radii[i])
        nv = N[i]
        bv = B[i]
        for j in range(n_theta):
            pt_ring = p + r * (cos_t[j] * nv + sin_t[j] * bv)
            verts.append((float(pt_ring[0]), float(pt_ring[1]), float(pt_ring[2])))
    verts.append(tuple(all_pts[-1] + 0.02 * cone_len * tan_end))

    faces = []
    for j in range(n_theta):
        jn = (j + 1) % n_theta
        faces.append((0, 1 + jn, 1 + j))

    for i in range(len(all_pts) - 1):
        r0 = 1 + i * n_theta
        r1 = 1 + (i + 1) * n_theta
        for j in range(n_theta):
            jn = (j + 1) % n_theta
            faces.append((r0 + j, r0 + jn, r1 + jn, r1 + j))

    tip_idx = len(verts) - 1
    r_last = 1 + (len(all_pts) - 1) * n_theta
    for j in range(n_theta):
        jn = (j + 1) % n_theta
        faces.append((tip_idx, r_last + j, r_last + jn))

    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    obj.data.materials.append(mat)
    obj.parent = parent
    return obj


def compute_camera_azimuth_assist(psi_yaw_deg: float) -> float:
    """
    Smooth C1 azimuth assist (rotation around vertical World Z axis, preserving exact
    downward World Gravity g = -Z_w) so the Right Posterior Semicircular Canal loop
    and Common Crus remain wide open to the camera across all 5 steps:
      psi = -45 deg (Steps 1 & 2) ->   0.0 deg (pure lateral view; canal is in screen plane)
      psi =   0 deg (Intro/Step 5)-> -20.0 deg
      psi = +45 deg (Step 3)      -> -48.0 deg (prevents edge-on foreshortening at +45L)
      psi = +135 deg (Step 4)     -> -25.0 deg (keeps PSC at top-left, CC vertical, Cochlea on right)
    """
    knots_psi = np.array([-60.0, -45.0, 0.0, 45.0, 90.0, 135.0, 150.0], dtype=np.float64)
    knots_az = np.array([0.0, 0.0, -20.0, -48.0, -38.0, -25.0, -25.0], dtype=np.float64)
    p = float(np.clip(psi_yaw_deg, knots_psi[0], knots_psi[-1]))
    idx = int(np.clip(np.searchsorted(knots_psi, p, side="right") - 1, 0, len(knots_psi) - 2))
    x0, x1 = knots_psi[idx], knots_psi[idx + 1]
    y0, y1 = knots_az[idx], knots_az[idx + 1]
    t = (p - x0) / max(1e-6, x1 - x0)
    w = t * t * (3.0 - 2.0 * t)
    return float(y0 + w * (y1 - y0))


class DualStageBlenderScene:
    """
    Manages the unified Gate 3 Blender scene (`2560 x 1080`):
      - Left Half (`x = 0..1280`): Elevated 3/4 Clinical Patient Stage (centered at X = -6.0, Y = 0, Z = 0.45)
      - Right Half (`x = 1280..2560`): Gate 3 IE-Map Right Labyrinth Stage (centered at X = +6.0, Y = 0, Z = 0.85)
    """

    def __init__(self, repo_root: Path, resolution: Tuple[int, int] = (2560, 1080), samples: int = 4):
        self.repo_root = repo_root
        self.iemap_dir = repo_root / "assets" / "iemap"
        with open(self.iemap_dir / "iemap_Metadata.json", "r", encoding="utf-8") as f:
            self.meta = json.load(f)

        bpy.ops.wm.read_factory_settings(use_empty=True)
        self.scene = bpy.context.scene
        self.scene.render.engine = "CYCLES"
        self.scene.cycles.device = "CPU"
        self.scene.cycles.samples = samples
        self.scene.cycles.max_bounces = 1
        self.scene.cycles.diffuse_bounces = 0
        self.scene.cycles.glossy_bounces = 0
        self.scene.cycles.transmission_bounces = 0
        self.scene.cycles.volume_bounces = 0
        self.scene.cycles.transparent_max_bounces = 12
        self.scene.cycles.use_denoising = False
        self.scene.render.use_persistent_data = True
        self.scene.render.resolution_x = resolution[0]
        self.scene.render.resolution_y = resolution[1]
        self.scene.render.resolution_percentage = 100

        world = bpy.data.worlds.new("Gate3World")
        self.scene.world = world
        world.use_nodes = True
        bg = world.node_tree.nodes.get("Background")
        if bg:
            # Exact Gate 3 dark charcoal canvas (#071014 -> linear [0.004, 0.014, 0.020, 1.0])
            bg.inputs[0].default_value = (0.004, 0.014, 0.020, 1.0)
            bg.inputs[1].default_value = 1.0

        self._setup_camera()
        self._build_patient_stage()
        self._build_labyrinth_stage()

    def _setup_camera(self):
        cam_data = bpy.data.cameras.new(name="MainGate3Cam")
        cam_data.type = "ORTHO"
        cam_data.ortho_scale = 24.0
        self.camera = bpy.data.objects.new(name="MainGate3Cam", object_data=cam_data)
        self.camera.location = (0.0, -28.0, 0.70)
        self.camera.rotation_euler = (math.radians(90.0), 0.0, 0.0)
        self.scene.collection.objects.link(self.camera)
        self.scene.camera = self.camera

    def _build_patient_stage(self):
        self.M_view = np.array([
            [ 0.0, 1.0, 0.0],  # +X_stage (Screen Right) = +Y_world (Table Foot / Patient Anterior)
            [-1.0, 0.0, 0.0],  # +Y_stage (Into Screen)  = -X_world (Patient Left)
            [ 0.0, 0.0, 1.0],  # +Z_stage (Screen Up)    = +Z_world (World Up)
        ], dtype=np.float64)

        self.patient_stage_origin = mathutils.Vector((-6.05, 0.0, 0.45))
        self.patient_root = bpy.data.objects.new("PatientStageRoot", None)
        self.patient_root.location = self.patient_stage_origin
        self.scene.collection.objects.link(self.patient_root)

        # Gate 3 clinical studio materials for the Patient Stage
        mat_table = create_gate3_shader("MatTablePad", (0.14, 0.20, 0.25, 1.0), roughness=0.45)
        mat_frame = create_gate3_shader("MatTableFrame", (0.22, 0.29, 0.35, 1.0), roughness=0.35)
        mat_pillow = create_gate3_shader("MatPillow", (0.20, 0.70, 0.80, 1.0), roughness=0.30, emission=0.18)
        self.mat_skin_solid = create_gate3_shader("MatHeadSkinSolid", (0.76, 0.82, 0.88, 1.0), roughness=0.30)
        self.mat_skin_cutaway = create_gate3_shader(
            "MatHeadSkinCutaway", (0.48, 0.70, 0.84, 0.34), roughness=0.22, emission=0.18, single_surface_glass=True
        )
        mat_torso = create_gate3_shader("MatClinicalTunic", (0.25, 0.43, 0.57, 1.0), roughness=0.38)
        mat_pants = create_gate3_shader("MatClinicalPants", (0.19, 0.28, 0.36, 1.0), roughness=0.40)
        mat_shoes = create_gate3_shader("MatClinicalShoes", (0.28, 0.36, 0.44, 1.0), roughness=0.36)
        mat_right_ear = create_gate3_shader("MatRightEarLocator", (0.980, 0.560, 0.140, 1.0), roughness=0.18, emission=1.40)
        mat_cyan_ring = create_gate3_shader("MatCyanRing", (0.322, 0.863, 0.949, 1.0), roughness=0.18, emission=1.40)
        mat_glove = create_gate3_shader(
            "MatClinicianGlove", (0.322, 0.863, 0.949, 0.44), roughness=0.24, emission=0.28, single_surface_glass=True
        )
        mat_arrow_cyan = create_gate3_shader("MatActionArrowCyan", (0.322, 0.863, 0.949, 1.0), roughness=0.18, emission=1.45)
        mat_arrow_warm = create_gate3_shader("MatActionArrowWarm", (0.980, 0.560, 0.140, 1.0), roughness=0.18, emission=1.45)

        # Group for table & lower body so we can cleanly hide them during Shot 1's close-up head cutaway portrait
        self.table_env_root = bpy.data.objects.new("TableEnvRoot", None)
        self.table_env_root.parent = self.patient_root
        self.scene.collection.objects.link(self.table_env_root)

        # 1. Examination Table Mattress (crisp beveled rectangular cushion without stray external poles)
        add_box("ExamTablePad", (1.20, 0.0, -0.52), (4.80, 2.15, 0.32), mat_table, parent=self.table_env_root, bevel=True)
        add_box("ExamTableFrame", (1.20, 0.0, -0.80), (4.55, 1.75, 0.22), mat_frame, parent=self.table_env_root)
        add_cylinder_between("TableLegL", (-0.85, -0.65, -0.88), (-0.85, -0.65, -2.55), 0.12, mat_frame, parent=self.table_env_root)
        add_cylinder_between("TableLegR", ( 3.10, -0.65, -0.88), ( 3.10, -0.65, -2.55), 0.12, mat_frame, parent=self.table_env_root)
        add_cylinder_between("TableLegL2", (-0.85, 0.65, -0.88), (-0.85, 0.65, -2.55), 0.12, mat_frame, parent=self.table_env_root)
        add_cylinder_between("TableLegR2", ( 3.10, 0.65, -0.88), ( 3.10, 0.65, -2.55), 0.12, mat_frame, parent=self.table_env_root)

        # 2. Shoulder Pillow positioned near the head-edge of the table (X_local = -0.82)
        self.pillow_obj = add_box("ShoulderPillow", (-0.82, 0.0, -0.20), (0.82, 1.56, 0.30), mat_pillow, parent=self.table_env_root, bevel=True)

        # 3. Articulated Patient Body (Upper Body + Lower Body Roll Rig)
        self.hip_pivot = bpy.data.objects.new("HipPivot", None)
        self.hip_pivot.parent = self.patient_root
        self.hip_pivot.location = (0.58, 0.0, -0.05)
        self.scene.collection.objects.link(self.hip_pivot)

        self.lower_body_pivot = bpy.data.objects.new("LowerBodyPivot", None)
        self.lower_body_pivot.parent = self.table_env_root
        self.lower_body_pivot.location = (0.58, 0.0, -0.05)
        self.scene.collection.objects.link(self.lower_body_pivot)

        add_uv_sphere("Pelvis", (0.0, 0.0, 0.0), (0.38, 0.50, 0.32), mat_pants, parent=self.lower_body_pivot)
        add_cylinder_between("RightThigh", (0.0, -0.27, 0.0), (1.38, -0.27, -0.03), 0.23, mat_pants, parent=self.lower_body_pivot)
        add_cylinder_between("LeftThigh",  (0.0,  0.27, 0.0), (1.38,  0.27, -0.03), 0.23, mat_pants, parent=self.lower_body_pivot)
        add_uv_sphere("RightKnee", (1.38, -0.27, -0.03), (0.21, 0.21, 0.21), mat_pants, parent=self.lower_body_pivot)
        add_uv_sphere("LeftKnee",  (1.38,  0.27, -0.03), (0.21, 0.21, 0.21), mat_pants, parent=self.lower_body_pivot)
        add_cylinder_between("RightCalf",  (1.38, -0.27, -0.03), (2.58, -0.27, -0.07), 0.18, mat_pants, parent=self.lower_body_pivot)
        add_cylinder_between("LeftCalf",   (1.38,  0.27, -0.03), (2.58,  0.27, -0.07), 0.18, mat_pants, parent=self.lower_body_pivot)
        add_uv_sphere("RightFoot", (2.66, -0.27, 0.06), (0.15, 0.12, 0.26), mat_shoes, parent=self.lower_body_pivot)
        add_uv_sphere("LeftFoot",  (2.66,  0.27, 0.06), (0.15, 0.12, 0.26), mat_shoes, parent=self.lower_body_pivot)

        # Seamless contoured clinical tunic torso mesh
        self.torso_mesh_obj = build_contoured_torso_mesh("ContouredTorso", mat_torso, parent=self.hip_pivot)

        # Articulated arms (Upper arm + Elbow + Forearm + Hand) grouped under lower_torso_root
        self.lower_torso_root = bpy.data.objects.new("LowerTorsoRoot", None)
        self.lower_torso_root.parent = self.hip_pivot
        self.scene.collection.objects.link(self.lower_torso_root)

        add_uv_sphere("RightShoulder", (0.0, -0.54, 1.62), (0.15, 0.16, 0.15), mat_torso, parent=self.lower_torso_root)
        add_cylinder_between("RightUpperArm", (0.0, -0.55, 1.62), (0.08, -0.58, 0.92), 0.135, mat_torso, parent=self.lower_torso_root)
        add_uv_sphere("RightElbow", (0.08, -0.58, 0.92), (0.13, 0.13, 0.13), mat_torso, parent=self.lower_torso_root)
        self.right_arm = add_cylinder_between("RightForearm", (0.08, -0.58, 0.92), (0.36, -0.45, 0.42), 0.115, self.mat_skin_solid, parent=self.lower_torso_root)
        add_uv_sphere("RightHandRest", (0.39, -0.43, 0.38), (0.13, 0.09, 0.12), self.mat_skin_solid, parent=self.lower_torso_root)

        add_uv_sphere("LeftShoulder", (0.0, 0.54, 1.62), (0.15, 0.16, 0.15), mat_torso, parent=self.lower_torso_root)
        add_cylinder_between("LeftUpperArm", (0.0, 0.55, 1.62), (0.08, 0.58, 0.92), 0.135, mat_torso, parent=self.lower_torso_root)
        add_uv_sphere("LeftElbow", (0.08, 0.58, 0.92), (0.13, 0.13, 0.13), mat_torso, parent=self.lower_torso_root)
        self.left_arm = add_cylinder_between("LeftForearm", (0.08, 0.58, 0.92), (0.36, 0.45, 0.42), 0.115, self.mat_skin_solid, parent=self.lower_torso_root)
        add_uv_sphere("LeftHandRest", (0.39, 0.43, 0.38), (0.13, 0.09, 0.12), self.mat_skin_solid, parent=self.lower_torso_root)

        # 4. Authentic Sculpted Anatomical Head & Neck (`GEO-head_sculpting_realistic`) & Right Ear Locator Ring
        self.neck_pivot = bpy.data.objects.new("NeckPivot", None)
        self.neck_pivot.parent = self.hip_pivot
        self.neck_pivot.location = (0.0, 0.0, 1.94)
        self.scene.collection.objects.link(self.neck_pivot)

        (
            self.authentic_head_root,
            self.head_mesh_obj,
            self.ear_ring,
            self.head_eye_objs,
        ) = append_authentic_sculpted_head(
            self.repo_root,
            self.neck_pivot,
            self.mat_skin_solid,
            mat_cyan_ring,
        )

        # Authentic 3D IE-Map Right Labyrinth embedded inside the right temporal bone for Shot 1 cutaway
        self.embedded_labyrinth = bpy.data.objects.new("EmbeddedRightLabyrinth", None)
        self.embedded_labyrinth.parent = self.authentic_head_root
        self.embedded_labyrinth.location = (0.0, 0.0, 0.0)
        self.embedded_labyrinth.rotation_euler = (0.0, 0.0, 0.0)
        self.embedded_labyrinth.scale = (0.001, 0.001, 0.001)
        self.scene.collection.objects.link(self.embedded_labyrinth)

        mat_emb_cyan = create_gate3_shader("MatEmbSp", (0.322, 0.863, 0.949, 1.0), emission=1.35)
        mat_emb_warm = create_gate3_shader("MatEmbAp", (0.980, 0.560, 0.140, 1.0), emission=1.35)
        mat_emb_sage = create_gate3_shader("MatEmbUt", (0.460, 0.780, 0.620, 0.85), emission=0.45)
        mat_emb_slate = create_gate3_shader("MatEmbCtx", (0.420, 0.540, 0.680, 0.85), emission=0.25)

        for emb_name, emb_mat in [
            ("ls_Hsapiens_Sp", mat_emb_cyan),
            ("ls_Hsapiens_CCp", mat_emb_cyan),
            ("ls_Hsapiens_Ap", mat_emb_warm),
            ("ls_Hsapiens_utricle", mat_emb_sage),
            ("ls_Hsapiens_Sa", mat_emb_slate),
            ("ls_Hsapiens_Sl", mat_emb_slate),
            ("mesh_david_cochlea", mat_emb_slate),
        ]:
            if emb_name in self.meta["meshes"]:
                obj_path = self.repo_root / self.meta["meshes"][emb_name]["obj"]
                bpy.ops.wm.obj_import(filepath=str(obj_path), forward_axis="Y", up_axis="Z")
                emb_obj = bpy.context.selected_objects[0]
                emb_obj.name = f"Emb_{emb_name}"
                emb_obj.parent = self.embedded_labyrinth
                for poly in emb_obj.data.polygons:
                    poly.use_smooth = True
                if emb_obj.data.materials:
                    emb_obj.data.materials[0] = emb_mat
                else:
                    emb_obj.data.materials.append(emb_mat)

        # 5. "The Doctor Layer": Single-Mesh Cupped Clinician Support Hands (kept hidden by default to preserve asymmetric right-ear landmark clarity)
        self.clinician_hands_root = bpy.data.objects.new("ClinicianHandsRoot", None)
        self.clinician_hands_root.parent = self.neck_pivot
        self.scene.collection.objects.link(self.clinician_hands_root)
        self.hand_right = build_cupped_clinician_hand("ClinicianHandRight", "right", mat_glove, self.clinician_hands_root)
        self.hand_left = build_cupped_clinician_hand("ClinicianHandLeft", "left", mat_glove, self.clinician_hands_root)

        # 6. Step-Specific Smooth Swept 3D Curved Action Arrows (placed in clear open space outside head/body)
        # Step 1: 45-deg Right Head Turn arc in front/above the forehead (HipPivot coords)
        pts_step1_arrow = [
            (0.76 * math.cos(a), 0.76 * math.sin(a), 3.12)
            for a in np.linspace(math.radians(28.0), math.radians(-52.0), 14)
        ]
        self.arrow_step1 = build_curved_3d_arrow("ArrowStep1_TurnRight", pts_step1_arrow, 0.032, mat_arrow_cyan, self.hip_pivot)

        # Step 2: Supine Recline arc sweeping cleanly above the chest/shoulder toward the pillow (PatientRoot coords)
        pts_step2_arrow = [
            (0.58 - 2.45 * math.sin(a), 0.62, 0.25 + 2.45 * math.cos(a))
            for a in np.linspace(math.radians(16.0), math.radians(82.0), 16)
        ]
        self.arrow_step2 = build_curved_3d_arrow("ArrowStep2_Recline", pts_step2_arrow, 0.038, mat_arrow_warm, self.patient_root)

        # Step 3: 90-deg Contralateral Left Head Turn arc floating in clear space above the supine face (NeckPivot coords)
        pts_step3_arrow = [
            (0.28 + 1.05 * math.cos(a), 1.05 * math.sin(a), 0.86 + 0.12 * math.cos(a))
            for a in np.linspace(math.radians(-42.0), math.radians(48.0), 16)
        ]
        self.arrow_step3 = build_curved_3d_arrow("ArrowStep3_TurnLeft90", pts_step3_arrow, 0.034, mat_arrow_cyan, self.neck_pivot)

        # Step 4: Left-Shoulder Roll arc sweeping cleanly in open space above the rolled shoulder/chest (PatientRoot coords)
        pts_step4_arrow = [
            (-0.35, 1.15 * math.sin(a), 0.68 + 1.15 * math.cos(a))
            for a in np.linspace(math.radians(-26.0), math.radians(48.0), 16)
        ]
        self.arrow_step4 = build_curved_3d_arrow("ArrowStep4_ShoulderRoll", pts_step4_arrow, 0.036, mat_arrow_warm, self.patient_root)

        # Step 5: Return to Upright Sitting arc sweeping in clear open space in front of the chest/head (PatientRoot coords)
        pts_step5_arrow = [
            (1.48 - 2.35 * math.sin(a), -0.35, 0.15 + 2.35 * math.cos(a))
            for a in np.linspace(math.radians(56.0), math.radians(8.0), 16)
        ]
        self.arrow_step5 = build_curved_3d_arrow("ArrowStep5_SitUp", pts_step5_arrow, 0.038, mat_arrow_cyan, self.patient_root)

    def _build_labyrinth_stage(self):
        """
        Build the Gate 3 IE-Map Right Vestibular Labyrinth on the Right Half (`x = 1280..2560`),
        centered at `X = +6.00, Y = 0.0, Z = +0.85`, `scale = 0.80` so it fills the close-up frame cleanly.
        """
        self.labyrinth_stage_origin = mathutils.Vector((6.00, 0.0, 0.70))
        self.labyrinth_scale = 0.44

        self.labyrinth_view_pivot = bpy.data.objects.new("LabyrinthViewPivot", None)
        self.labyrinth_view_pivot.location = self.labyrinth_stage_origin
        self.scene.collection.objects.link(self.labyrinth_view_pivot)

        self.labyrinth_head_root = bpy.data.objects.new("LabyrinthHeadRoot", None)
        self.labyrinth_head_root.parent = self.labyrinth_view_pivot
        self.labyrinth_head_root.scale = (self.labyrinth_scale, self.labyrinth_scale, self.labyrinth_scale)
        self.scene.collection.objects.link(self.labyrinth_head_root)

        self.mesh_objects = {}
        for mesh_name, info in self.meta["meshes"].items():
            obj_path = self.repo_root / info["obj"]
            bpy.ops.wm.obj_import(
                filepath=str(obj_path),
                forward_axis="Y",
                up_axis="Z",
            )
            imported = bpy.context.selected_objects[0]
            imported.name = mesh_name
            imported.parent = self.labyrinth_head_root
            for poly in imported.data.polygons:
                poly.use_smooth = True

            role = info["role"]
            visible = bool(info.get("visible_by_default", True))
            imported.hide_render = not visible

            if role == "posterior_duct":
                mat = create_gate3_shader(f"mat_{mesh_name}", (0.322, 0.863, 0.949, 0.36), roughness=0.22, emission=0.35)
                imported.visible_shadow = False
            elif role == "common_crus":
                mat = create_gate3_shader(f"mat_{mesh_name}", (0.620, 0.680, 0.920, 0.42), roughness=0.24, emission=0.25)
                imported.visible_shadow = False
            elif role in ("utricle", "utricular_cistern"):
                mat = create_gate3_shader(f"mat_{mesh_name}", (0.460, 0.780, 0.620, 0.45), roughness=0.26, emission=0.20)
                imported.visible_shadow = False
            elif role in ("posterior_ampulla", "posterior_cupula"):
                mat = create_gate3_shader(f"mat_{mesh_name}", (0.941, 0.667, 0.384, 0.92), roughness=0.28, emission=0.18)
            elif role == "cochlear_duct":
                mat = create_gate3_shader(f"mat_{mesh_name}", (0.520, 0.680, 0.820, 0.95), roughness=0.30, emission=0.14)
            else:
                mat = create_gate3_shader(f"mat_{mesh_name}", (0.420, 0.510, 0.650, 0.92), roughness=0.42, emission=0.08)

            if imported.data.materials:
                imported.data.materials[0] = mat
            else:
                imported.data.materials.append(mat)
            self.mesh_objects[mesh_name] = imported

        # Instantiate 5 enlarged Gate 3 warm amber schematic canaliths (`Schematic_canalith_01..05`)
        self.mat_otoconia_3d = create_gate3_shader(
            "canaliths_enlarged_warm", (0.980, 0.560, 0.140, 1.0), roughness=0.15, emission=2.0
        )
        self.otoconia_objs = []
        for idx_c in range(5):
            r_c = 0.135
            c_obj = add_uv_sphere(
                f"Schematic_canalith_{idx_c+1:02d}",
                (1.35, -1.35, -1.65),
                (r_c, r_c, r_c),
                self.mat_otoconia_3d,
                parent=self.labyrinth_head_root,
                segments=18,
                ring_count=14,
            )
            self.otoconia_objs.append(c_obj)

    @staticmethod
    def _set_hierarchy_hide_render(root_obj, hide: bool):
        root_obj.hide_render = hide
        for child in root_obj.children_recursive:
            child.hide_render = hide

    def update_frame_state(
        self,
        psi_yaw_deg: float,
        theta_recline_deg: float,
        otoconia_particles_ras: Optional[np.ndarray] = None,
        cupula_deflection: float = 0.0,
        step_id: str = "step1",
        phase: str = "hold",
        cutaway_mode: bool = False,
    ):
        """
        Update both the Left Half (3/4 Clinical Patient Stage) and Right Half (Gate 3 IE-Map Labyrinth Stage).
        """
        torso_pitch_deg = min(90.0, max(0.0, theta_recline_deg))
        neck_ext_deg = max(0.0, theta_recline_deg - 90.0)
        recline_frac = min(1.0, torso_pitch_deg / 90.0)

        # Elevated 3/4 clinical camera perspective on the Patient Stage:
        cam_az_deg = 28.0 * (1.0 - recline_frac) + 22.0 * recline_frac
        cam_el_deg = 16.0 * (1.0 - recline_frac) + 28.0 * recline_frac
        mat_stage_3q = (
            mathutils.Matrix.Rotation(math.radians(cam_el_deg), 3, "X")
            @ mathutils.Matrix.Rotation(math.radians(-cam_az_deg), 3, "Z")
        )
        self.patient_root.rotation_euler = mat_stage_3q.to_euler()

        # In Shot 1 (`cutaway_mode=True`), frame a large close-up 3/4 portrait of the semi-transparent head & shoulders
        if cutaway_mode:
            self.patient_root.scale = (2.85, 2.85, 2.85)
            self.patient_root.location = mathutils.Vector((-7.45, 0.0, -5.85))
            self._set_hierarchy_hide_render(self.table_env_root, True)
            self._set_hierarchy_hide_render(self.lower_torso_root, True)
        else:
            self.patient_root.scale = (1.32, 1.32, 1.32)
            self.patient_root.location = mathutils.Vector((-6.35 + 0.55 * recline_frac, 0.0, 0.15 + 0.45 * recline_frac))
            self._set_hierarchy_hide_render(self.table_env_root, False)
            self._set_hierarchy_hide_render(self.lower_torso_root, False)

        # Toggle translucent single-surface cutaway material vs solid clinical bust skin
        active_skin_mat = self.mat_skin_cutaway if cutaway_mode else self.mat_skin_solid
        if self.head_mesh_obj.data.materials:
            self.head_mesh_obj.data.materials[0] = active_skin_mat
        else:
            self.head_mesh_obj.data.materials.append(active_skin_mat)
        self._set_hierarchy_hide_render(self.embedded_labyrinth, not cutaway_mode)
        for eye in self.head_eye_objs:
            eye.hide_render = cutaway_mode

        # Smooth body roll onto left side when psi_yaw_deg > 45 deg (Step 4 left-shoulder roll)
        body_roll_deg = 0.0
        if psi_yaw_deg > 45.0:
            roll_t = min(1.0, max(0.0, (psi_yaw_deg - 45.0) / 90.0))
            body_roll_deg = 78.0 * roll_t * recline_frac
        head_yaw_rel_deg = psi_yaw_deg - body_roll_deg

        mat_hip = (
            mathutils.Matrix.Rotation(math.radians(-torso_pitch_deg), 3, "Y")
            @ mathutils.Matrix.Rotation(math.radians(body_roll_deg), 3, "Z")
        )
        self.hip_pivot.rotation_euler = mat_hip.to_euler()

        hip_x = 0.58 + 0.16 * recline_frac
        hip_z = -0.05 + 0.15 * recline_frac
        self.hip_pivot.location = (hip_x, 0.0, hip_z)

        self.lower_body_pivot.location = (hip_x, 0.0, hip_z)
        self.lower_body_pivot.rotation_euler = (math.radians(-body_roll_deg), 0.0, 0.0)

        mat_neck = (
            mathutils.Matrix.Rotation(math.radians(-neck_ext_deg), 3, "Y")
            @ mathutils.Matrix.Rotation(math.radians(head_yaw_rel_deg), 3, "Z")
        )
        self.neck_pivot.rotation_euler = mat_neck.to_euler()

        # Toggle Step-Specific 3D Curved Action Arrows during active movement phases
        show_doctor_cues = (phase == "move") and (step_id in {"step1", "step2", "step3", "step4", "step5"}) and (not cutaway_mode)
        self._set_hierarchy_hide_render(self.clinician_hands_root, True)

        self._set_hierarchy_hide_render(self.arrow_step1, not (show_doctor_cues and step_id == "step1"))
        self._set_hierarchy_hide_render(self.arrow_step2, not (show_doctor_cues and step_id == "step2"))
        self._set_hierarchy_hide_render(self.arrow_step3, not (show_doctor_cues and step_id == "step3"))
        self._set_hierarchy_hide_render(self.arrow_step4, not (show_doctor_cues and step_id == "step4"))
        self._set_hierarchy_hide_render(self.arrow_step5, not (show_doctor_cues and step_id == "step5"))

        # 2. Update Gate 3 IE-Map Right Labyrinth Pose on the Right Stage
        psi_r = math.radians(psi_yaw_deg)
        th_r = math.radians(theta_recline_deg)
        Rz = np.array([
            [math.cos(psi_r), -math.sin(psi_r), 0.0],
            [math.sin(psi_r),  math.cos(psi_r), 0.0],
            [0.0,              0.0,             1.0],
        ])
        Rx = np.array([
            [1.0, 0.0,            0.0           ],
            [0.0, math.cos(th_r), -math.sin(th_r)],
            [0.0, math.sin(th_r),  math.cos(th_r)],
        ])
        R_head_world = Rx @ Rz

        az_follow_deg = compute_camera_azimuth_assist(psi_yaw_deg)
        az_r = math.radians(az_follow_deg)
        Rz_cam_follow = np.array([
            [math.cos(az_r), -math.sin(az_r), 0.0],
            [math.sin(az_r),  math.cos(az_r), 0.0],
            [0.0,             0.0,            1.0],
        ])
        R_stage = self.M_view @ Rz_cam_follow @ R_head_world

        mat3 = mathutils.Matrix(R_stage.tolist())
        self.labyrinth_head_root.rotation_euler = mat3.to_euler()

        centroid_ras = np.array([4.5, 1.4, 0.5])
        offset_stage = R_stage @ (centroid_ras * self.labyrinth_scale)
        self.labyrinth_head_root.location = (
            -float(offset_stage[0]),
            -float(offset_stage[1]),
            -float(offset_stage[2]),
        )

        # 3. Update 5 Enlarged Warm Amber Otoconia Particles inside the Labyrinth
        if otoconia_particles_ras is not None:
            n_pts = min(len(self.otoconia_objs), len(otoconia_particles_ras))
            for i in range(n_pts):
                pt = otoconia_particles_ras[i]
                self.otoconia_objs[i].location = (float(pt[0]), float(pt[1]), float(pt[2]))

        bpy.context.view_layer.update()

    def project_ras_point(self, pt_ras: np.ndarray | List[float]) -> Tuple[float, float, float]:
        """Project a 3D point in Head RAS coordinates to 2D coordinates in the 2560x1080 dual-stage render."""
        v_local = mathutils.Vector((float(pt_ras[0]), float(pt_ras[1]), float(pt_ras[2])))
        v_world = self.labyrinth_head_root.matrix_world @ v_local
        co_2d = world_to_camera_view(self.scene, self.camera, v_world)
        res_x = self.scene.render.resolution_x
        res_y = self.scene.render.resolution_y
        px = float(co_2d.x * res_x)
        py = float((1.0 - co_2d.y) * res_y)
        return px, py, float(co_2d.z)

    def project_patient_head_point(self, pt_neck_local: Tuple[float, float, float]) -> Tuple[float, float]:
        """Project a 3D point in NeckPivot local coordinates to 2D coordinates in the 2560x1080 dual-stage render."""
        v_world = self.neck_pivot.matrix_world @ mathutils.Vector(pt_neck_local)
        co_2d = world_to_camera_view(self.scene, self.camera, v_world)
        res_x = self.scene.render.resolution_x
        res_y = self.scene.render.resolution_y
        return float(co_2d.x * res_x), float((1.0 - co_2d.y) * res_y)

    def project_patient_stage_point(self, pt_stage_local: Tuple[float, float, float]) -> Tuple[float, float]:
        """Project a 3D point in PatientStageRoot local coordinates to 2D coordinates in the 2560x1080 render."""
        v_world = self.patient_root.matrix_world @ mathutils.Vector(pt_stage_local)
        co_2d = world_to_camera_view(self.scene, self.camera, v_world)
        res_x = self.scene.render.resolution_x
        res_y = self.scene.render.resolution_y
        return float(co_2d.x * res_x), float((1.0 - co_2d.y) * res_y)

    def project_patient_right_ear(self) -> Tuple[float, float]:
        """Project the patient's authentic right ear locator ring to 2D coordinates in the 2560x1080 render."""
        v_world = self.ear_ring.matrix_world.to_translation()
        co_2d = world_to_camera_view(self.scene, self.camera, v_world)
        res_x = self.scene.render.resolution_x
        res_y = self.scene.render.resolution_y
        return float(co_2d.x * res_x), float((1.0 - co_2d.y) * res_y)

    def project_patient_embedded_ear(self) -> Tuple[float, float]:
        """Project the patient's embedded right labyrinth center to 2D coordinates in the 2560x1080 render."""
        v_world = self.embedded_labyrinth.matrix_world.to_translation()
        co_2d = world_to_camera_view(self.scene, self.camera, v_world)
        res_x = self.scene.render.resolution_x
        res_y = self.scene.render.resolution_y
        return float(co_2d.x * res_x), float((1.0 - co_2d.y) * res_y)

    def project_patient_nose(self) -> Tuple[float, float]:
        """Project the patient's nose tip to 2D coordinates in the 2560x1080 render."""
        v_cand = mathutils.Vector((-0.0248, 0.0811, -0.0230))
        v_world = self.authentic_head_root.matrix_world @ v_cand
        co_2d = world_to_camera_view(self.scene, self.camera, v_world)
        res_x = self.scene.render.resolution_x
        res_y = self.scene.render.resolution_y
        return float(co_2d.x * res_x), float((1.0 - co_2d.y) * res_y)

    def render_frame(self, filepath: Path):
        filepath.parent.mkdir(parents=True, exist_ok=True)
        self.scene.render.filepath = str(filepath)
        bpy.ops.render.render(write_still=True)
