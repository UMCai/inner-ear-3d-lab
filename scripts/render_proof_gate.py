#!/usr/bin/env python3
"""
Phase 1 Early Proof Gate: Synchronized Head-to-Labyrinth Transition & Gravity Otoconia Proof
============================================================================================
Verifies:
1. Clear rendering of the 17-mesh IE-Map Right Vestibular Labyrinth (Ahmadi et al. 2021).
2. External clinical patient transition from Step 1 (Sitting Upright, Head 45 deg Right)
   to Step 2 (Supine Head-Hanging 30 deg Extended over Shoulder Pillow, Head 45 deg Right).
3. Corresponding 1:1 3D inner-ear rotation and gravity-driven otoconia migration along the
   Right Posterior Semicircular Canal (phi = -90 deg -> +30 deg).

Usage:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/render_proof_gate.py
  /Users/umcai/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 scripts/render_proof_gate.py --composite-only
"""

import json
import os
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.physics.epley_simulator import EpleySimulator, smoothstep


def evaluate_proof_pose(t_sec: float) -> dict:
    """
    6.0-second proof timeline (at 15 fps = 90 frames):
      0.0 - 1.4s : Step 1 Hold (Upright Sitting, Head 45 deg Right; otoconia at phi = -90 deg)
      1.4 - 3.0s : Transition Step 1 -> Step 2 (Recline 120 deg onto shoulder pillow)
      3.0 - 6.0s : Step 2 Hold (Head hanging 30 deg extended; gravity pulls otoconia to phi = +30 deg)
    """
    w_recline = smoothstep(1.4, 3.0, t_sec)
    theta = 120.0 * w_recline
    psi = -45.0
    if t_sec < 1.4:
        return {
            "step_id": "step1",
            "step_title": "Step 1: Upright Sitting — Head Turned 45° Right",
            "psi_yaw_deg": psi,
            "theta_recline_deg": theta,
            "mobility": 45.0,
            "phi_cap_max": -88.0,
            "caption": "Step 1: Turn the patient's head 45° to the right to align the right posterior canal with the sagittal plane.",
            "clinical_note": "Otoconia (CaCO3 crystals) rest at the dependent floor of the right posterior canal (-90°) near the cupula.",
            "hold_instruction": "Align right posterior canal with sagittal plane before reclining",
        }
    elif t_sec < 3.0:
        return {
            "step_id": "step2",
            "step_title": "Transition 1 → 2: Rapid Recline to 30° Head-Hanging Extension",
            "psi_yaw_deg": psi,
            "theta_recline_deg": theta,
            "mobility": 58.0,
            "phi_cap_max": 32.0,
            "caption": "Step 2 (Dix-Hallpike Recline): Recline rapidly so the shoulders rest on the pillow and the head extends 30° below horizontal.",
            "clinical_note": "As the posterior canal pitches 120° backward in world space, gravity (g ↓) creates a steep downward slope away from the ampulla.",
            "hold_instruction": "Maintain 45° right yaw while extending neck 30° over shoulder pillow",
        }
    else:
        return {
            "step_id": "step2",
            "step_title": "Step 2 Hold: Gravity Pulls Otoconia Around Posterior Canal Apex",
            "psi_yaw_deg": psi,
            "theta_recline_deg": theta,
            "mobility": 65.0,
            "phi_cap_max": 32.0,
            "caption": "Hold Step 2 for 30–60 seconds: Gravity pulls the otoconia ampullofugally past the posterior canal apex (+30°).",
            "clinical_note": "Ampullofugal endolymph drag deflects the posterior cupula, provoking transient upbeat-torsional nystagmus until crystals settle.",
            "hold_instruction": "Hold >= 30 s after vertigo and nystagmus stop",
        }


def run_blender_pass():
    from src.render.blender_scene_builder import DualStageBlenderScene

    proof_dir = REPO_ROOT / "build" / "proof"
    raw_dir = proof_dir / "raw_frames"
    raw_dir.mkdir(parents=True, exist_ok=True)

    fps = 15
    total_frames = 90  # 6.0 seconds
    sim = EpleySimulator(REPO_ROOT / "assets" / "iemap" / "posterior_canal_path.json")
    states = sim.simulate_timeline(fps=fps, total_frames=total_frames, pose_evaluator=evaluate_proof_pose, initial_phi_deg=-90.0)

    scene_builder = DualStageBlenderScene(REPO_ROOT, resolution=(1920, 1080), samples=4)

    # Key 3D RAS landmark points for leader lines (derived directly from IE-Map spline & meshes)
    ras_landmarks = {
        "posterior_duct": sim.interpolate_at_phi(0.0)[1].tolist(),       # Posterolateral apex of Sp
        "posterior_ampulla": sim.interpolate_at_phi(-112.0)[1].tolist(), # Posterior ampulla / cupula
        "common_crus": sim.interpolate_at_phi(145.0)[1].tolist(),        # Mid common crus
        "anterior_duct": [3.85, 0.45, 4.30],                             # Superior apex of authentic anterior canal
        "lateral_duct": [6.85, 0.20, 0.65],                              # Lateral apex of authentic horizontal canal
        "utricle": [4.58, 1.87, 0.35],                                   # Center of authentic utricle
        "cochlea": [1.77, 6.38, -2.96],                                  # Authentic cochlea
    }

    frames_meta = []
    pose_cache = {}
    for st in states:
        pose_info = evaluate_proof_pose(st.time_sec)
        psi_q = round(st.psi_yaw_deg * 4.0) / 4.0
        theta_q = round(st.theta_recline_deg * 4.0) / 4.0
        phi_q = round(st.otoconia_phi_deg / 2.5) * 2.5
        scene_builder.update_frame_state(
            psi_yaw_deg=psi_q,
            theta_recline_deg=theta_q,
            otoconia_particles_ras=st.otoconia_particles_ras,
            cupula_deflection=st.cupula_deflection,
        )
        pose_key = (psi_q, theta_q, phi_q)
        if pose_key in pose_cache:
            raw_path = pose_cache[pose_key]
        else:
            raw_path = raw_dir / f"raw_pose_{len(pose_cache):04d}.png"
            scene_builder.render_frame(raw_path)
            pose_cache[pose_key] = raw_path

        # Project 3D canal path (every 4th sample for smooth polyline)
        proj_path = []
        for idx_s in range(0, len(sim.phis), 4):
            px, py, _ = scene_builder.project_ras_point(sim.pos_ras[idx_s])
            proj_path.append({"phi_deg": float(sim.phis[idx_s]), "x": round(px, 2), "y": round(py, 2)})

        ox, oy, _ = scene_builder.project_ras_point(st.otoconia_center_ras)
        tan_end_ras = st.otoconia_center_ras + st.canal_tangent_ras * 1.2
        tx, ty, _ = scene_builder.project_ras_point(tan_end_ras)

        proj_particles = []
        for p_ras in st.otoconia_particles_ras:
            ppx, ppy, _ = scene_builder.project_ras_point(p_ras)
            proj_particles.append([round(ppx, 2), round(ppy, 2)])

        proj_lm = {}
        for k, pt_ras in ras_landmarks.items():
            lx, ly, _ = scene_builder.project_ras_point(pt_ras)
            proj_lm[k] = [round(lx, 2), round(ly, 2)]

        ear_x, ear_y = scene_builder.project_patient_head_point((-0.05, -0.56, 0.85))
        # Project pillow location
        from bpy_extras.object_utils import world_to_camera_view
        p_co = world_to_camera_view(scene_builder.scene, scene_builder.camera, scene_builder.pillow_obj.matrix_world.translation)
        pil_x = float(p_co.x * 1920)
        pil_y = float((1.0 - p_co.y) * 1080)

        frames_meta.append({
            "frame_index": st.frame_index,
            "time_sec": round(st.time_sec, 4),
            "raw_frame": str(raw_path),
            "step_id": st.step_id,
            "step_title": st.step_title,
            "psi_yaw_deg": st.psi_yaw_deg,
            "theta_recline_deg": st.theta_recline_deg,
            "otoconia_phi_deg": round(st.otoconia_phi_deg, 2),
            "otoconia_arc_mm": round(st.otoconia_arc_mm, 3),
            "gravity_along_canal": round(st.gravity_along_canal, 4),
            "cupula_deflection": round(st.cupula_deflection, 4),
            "anatomical_region": st.anatomical_region,
            "caption": pose_info["caption"],
            "clinical_note": pose_info["clinical_note"],
            "hold_instruction": pose_info["hold_instruction"],
            "projected_canal_path": proj_path,
            "projected_otoconia_center": [round(ox, 2), round(oy, 2)],
            "projected_otoconia_particles": proj_particles,
            "projected_canal_tangent_end": [round(tx, 2), round(ty, 2)],
            "projected_landmarks": proj_lm,
            "projected_patient_right_ear": [round(ear_x, 2), round(ear_y, 2)],
            "projected_pillow": [round(pil_x, 2), round(pil_y, 2)],
        })

    meta_out = proof_dir / "proof_frames_meta.json"
    with open(meta_out, "w", encoding="utf-8") as f:
        json.dump({"fps": fps, "frames": frames_meta}, f, indent=2)
    print(f"[proof_gate] Saved 3D render pass ({len(pose_cache)} unique poses) and metadata to {meta_out}")


def run_composite_and_encode():
    from src.render.hud_compositor import ClinicalHUDCompositor
    import shutil

    proof_dir = REPO_ROOT / "build" / "proof"
    meta_out = proof_dir / "proof_frames_meta.json"
    with open(meta_out, "r", encoding="utf-8") as f:
        data = json.load(f)

    frames = data["frames"]
    comp_dir = proof_dir / "composited_frames"
    comp_dir.mkdir(parents=True, exist_ok=True)
    compositor = ClinicalHUDCompositor(1920, 1080)

    for fm in frames:
        idx = fm["frame_index"]
        out_png = comp_dir / f"frame_{idx:04d}.png"
        compositor.compose_frame(Path(fm["raw_frame"]), out_png, fm)

    # Save key diagnostic stills for inspection
    shutil.copy2(comp_dir / "frame_0010.png", proof_dir / "proof_step1_upright.png")
    shutil.copy2(comp_dir / "frame_0033.png", proof_dir / "proof_transition_recline.png")
    shutil.copy2(comp_dir / "frame_0085.png", proof_dir / "proof_step2_settled.png")

    # Encode MP4 at 30 fps (interpolating/duplicating from 15 fps)
    out_mp4 = proof_dir / "proof_gate_step1_to_step2.mp4"
    cmd = [
        "/opt/homebrew/bin/ffmpeg",
        "-y",
        "-framerate", str(data["fps"]),
        "-i", str(comp_dir / "frame_%04d.png"),
        "-vf", "fps=30,format=yuv420p",
        "-c:v", "libx264",
        "-crf", "18",
        "-preset", "fast",
        str(out_mp4),
    ]
    subprocess.run(cmd, check=True)
    print(f"[proof_gate] Encoded proof gate video: {out_mp4}")


if __name__ == "__main__":
    if "--composite-only" in sys.argv:
        run_composite_and_encode()
    else:
        run_blender_pass()
