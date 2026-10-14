#!/usr/bin/env python3
"""
Full Gate 3 Production Pipeline: Epley Maneuver for Right-Ear Posterior-Canal BPPV
==================================================================================
End-to-end deterministic build & render script (`scripts/build_full_video.py`) that:
  1. Loads the 8-shot audio-driven timeline manifest (`build/audio/timeline_manifest.json`).
  2. Runs the 3D vestibular kinematics & Stokes sedimentation simulation (`EpleySimulator`)
     across all 8 shots (`locate`, `intro`, `step1..step5`, `outro`).
  3. Renders all unique `2560 x 1080` 3D dual-stage poses in headless Blender 5.2 LTS (`CYCLES` CPU
     with deterministic zero-variance Gate 3 shaders) and projects exact 3D-to-2D coordinates.
  4. Composites the Gate 3 / `lemo-opuscar` layout (`1920 x 1080`) with Dynamic Role Swap
     (Patient-Dominant during Movement <-> Labyrinth-Dominant during Settling Holds),
     1–2 temporally staged pill labels, warm canalith rings, compact gravity vector, and
     the Gate 3 editorial lower-third across all frames in parallel.
  5. Exports QA keyframes and contact sheets (`build/qa/review-contact-1080p.png` and
     `build/qa/review-small-screen-640x360.png`) and encodes `output/epley_maneuver_right_bppv.mp4`.
"""

from concurrent.futures import ProcessPoolExecutor
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Dict, List

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.physics.epley_simulator import EpleySimulator, smoothstep


def load_manifest() -> Dict:
    manifest_path = REPO_ROOT / "build" / "audio" / "timeline_manifest.json"
    with open(manifest_path, "r", encoding="utf-8") as f:
        return json.load(f)


def make_timeline_pose_evaluator(manifest: Dict):
    scenes = {s["scene_id"]: s for s in manifest["scenes"]}
    s1 = scenes["scene1_locate"]
    s2 = scenes["scene2_pathology"]
    s3 = scenes["scene3_step1"]
    s4 = scenes["scene4_step2"]
    s5 = scenes["scene5_step3"]
    s6 = scenes["scene6_step4"]
    s7 = scenes["scene7_step5"]
    s8 = scenes["scene8_summary"]

    tot_dur = float(manifest["total_duration_sec"])
    shot_tick_fracs = [round(sc["start_sec"] / tot_dur, 4) for sc in manifest["scenes"][1:]]

    def select_copy(sc: Dict, u: float):
        if u < 0.46:
            return sc["headline_part1"], sc["support_part1"], sc["caption"]
        return sc["headline_part2"], sc["support_part2"], sc.get("caption_part2", sc["caption"])

    def evaluate_pose(t_sec: float) -> Dict:
        # Shot 1: Anatomical Location (Cutaway Head -> Labyrinth Close-Up)
        if t_sec < s1["end_sec"]:
            lt = max(0.0, t_sec - s1["start_sec"])
            u = lt / max(1e-3, s1["duration_sec"])
            psi = -15.0 - 20.0 * smoothstep(0.05, 0.45, u)
            theta = 0.0
            cutaway = u < 0.50
            blend = smoothstep(0.44, 0.54, u)
            hl, sup, cap = select_copy(s1, u)
            return {
                "scene_id": s1["scene_id"],
                "step_id": "locate",
                "step_badge": s1["step_badge"],
                "step_title": s1["step_title"],
                "scene_progress": round(u, 4),
                "psi_yaw_deg": psi,
                "theta_recline_deg": theta,
                "mobility": 40.0,
                "phi_cap_max": -84.0,
                "phase": "hold",
                "cutaway_mode": cutaway,
                "role_swap_blend": blend,
                "headline": hl,
                "support": sup,
                "caption": cap,
                "shot_tick_fracs": shot_tick_fracs,
            }

        # Shot 2: Pathology Close-Up (Loose Otoconia Near Posterior Ampulla)
        elif t_sec < s2["end_sec"]:
            lt = max(0.0, t_sec - s2["start_sec"])
            u = lt / max(1e-3, s2["duration_sec"])
            psi = -35.0 * (1.0 - smoothstep(0.55, 0.92, u))
            theta = 0.0
            hl, sup, cap = select_copy(s2, u)
            return {
                "scene_id": s2["scene_id"],
                "step_id": "intro",
                "step_badge": s2["step_badge"],
                "step_title": s2["step_title"],
                "scene_progress": round(u, 4),
                "psi_yaw_deg": psi,
                "theta_recline_deg": theta,
                "mobility": 40.0,
                "phi_cap_max": -83.5,
                "phase": "hold",
                "cutaway_mode": False,
                "role_swap_blend": 1.0,
                "headline": hl,
                "support": sup,
                "caption": cap,
                "shot_tick_fracs": shot_tick_fracs,
            }

        # Shot 3: Step 1 — Sit Upright & Turn Head 45 deg Right
        elif t_sec < s3["end_sec"]:
            lt = max(0.0, t_sec - s3["start_sec"])
            u = lt / max(1e-3, s3["duration_sec"])
            w_move = smoothstep(0.04, 0.34, u)
            psi = -45.0 * w_move
            theta = 0.0
            phase = "move" if u < 0.42 else "hold"
            blend = smoothstep(0.46, 0.56, u)
            hl, sup, cap = select_copy(s3, u)
            return {
                "scene_id": s3["scene_id"],
                "step_id": "step1",
                "step_badge": s3["step_badge"],
                "step_title": s3["step_title"],
                "scene_progress": round(u, 4),
                "psi_yaw_deg": psi,
                "theta_recline_deg": theta,
                "mobility": 40.0,
                "phi_cap_max": -83.0,
                "phase": phase,
                "cutaway_mode": False,
                "role_swap_blend": blend,
                "headline": hl,
                "support": sup,
                "caption": cap,
                "shot_tick_fracs": shot_tick_fracs,
            }

        # Shot 4: Step 2 — Recline to Supine with 20–30 deg Neck Extension
        elif t_sec < s4["end_sec"]:
            lt = max(0.0, t_sec - s4["start_sec"])
            u = lt / max(1e-3, s4["duration_sec"])
            w_move = smoothstep(0.03, 0.30, u)
            psi = -45.0
            theta = 120.0 * w_move
            phase = "move" if u < 0.36 else "hold"
            blend = smoothstep(0.36, 0.44, u)
            hl, sup, cap = select_copy(s4, u)
            return {
                "scene_id": s4["scene_id"],
                "step_id": "step2",
                "step_badge": s4["step_badge"],
                "step_title": s4["step_title"],
                "scene_progress": round(u, 4),
                "psi_yaw_deg": psi,
                "theta_recline_deg": theta,
                "mobility": 42.0,
                "phi_cap_max": 30.0,
                "phase": phase,
                "cutaway_mode": False,
                "role_swap_blend": blend,
                "headline": hl,
                "support": sup,
                "caption": cap,
                "shot_tick_fracs": shot_tick_fracs,
            }

        # Shot 5: Step 3 — Rotate Head 90 deg Left (Now Facing 45 deg Left)
        elif t_sec < s5["end_sec"]:
            lt = max(0.0, t_sec - s5["start_sec"])
            u = lt / max(1e-3, s5["duration_sec"])
            w_move = smoothstep(0.03, 0.30, u)
            psi = -45.0 + 90.0 * w_move
            theta = 120.0
            phase = "move" if u < 0.36 else "hold"
            blend = smoothstep(0.36, 0.44, u)
            hl, sup, cap = select_copy(s5, u)
            return {
                "scene_id": s5["scene_id"],
                "step_id": "step3",
                "step_badge": s5["step_badge"],
                "step_title": s5["step_title"],
                "scene_progress": round(u, 4),
                "psi_yaw_deg": psi,
                "theta_recline_deg": theta,
                "mobility": 54.0,
                "phi_cap_max": 110.0,
                "phase": phase,
                "cutaway_mode": False,
                "role_swap_blend": blend,
                "headline": hl,
                "support": sup,
                "caption": cap,
                "shot_tick_fracs": shot_tick_fracs,
            }

        # Shot 6: Step 4 — Roll Onto Left Shoulder, Nose 45 deg Down
        elif t_sec < s6["end_sec"]:
            lt = max(0.0, t_sec - s6["start_sec"])
            u = lt / max(1e-3, s6["duration_sec"])
            w_move = smoothstep(0.03, 0.30, u)
            psi = 45.0 + 90.0 * w_move
            theta = 120.0 - 30.0 * w_move
            phase = "move" if u < 0.36 else "hold"
            blend = smoothstep(0.36, 0.44, u)
            hl, sup, cap = select_copy(s6, u)
            return {
                "scene_id": s6["scene_id"],
                "step_id": "step4",
                "step_badge": s6["step_badge"],
                "step_title": s6["step_title"],
                "scene_progress": round(u, 4),
                "psi_yaw_deg": psi,
                "theta_recline_deg": theta,
                "mobility": 45.0,
                "phi_cap_max": 165.0,
                "phase": phase,
                "cutaway_mode": False,
                "role_swap_blend": blend,
                "headline": hl,
                "support": sup,
                "caption": cap,
                "shot_tick_fracs": shot_tick_fracs,
            }

        # Shot 7: Step 5 — Return Slowly to Upright Sitting
        elif t_sec < s7["end_sec"]:
            lt = max(0.0, t_sec - s7["start_sec"])
            u = lt / max(1e-3, s7["duration_sec"])
            w_move = smoothstep(0.03, 0.32, u)
            psi = 135.0 * (1.0 - w_move)
            theta = 90.0 * (1.0 - w_move)
            phase = "move" if u < 0.36 else "hold"
            blend = smoothstep(0.36, 0.44, u)
            hl, sup, cap = select_copy(s7, u)
            return {
                "scene_id": s7["scene_id"],
                "step_id": "step5",
                "step_badge": s7["step_badge"],
                "step_title": s7["step_title"],
                "scene_progress": round(u, 4),
                "psi_yaw_deg": psi,
                "theta_recline_deg": theta,
                "mobility": 60.0,
                "phi_cap_max": 186.0,
                "phase": phase,
                "cutaway_mode": False,
                "role_swap_blend": blend,
                "headline": hl,
                "support": sup,
                "caption": cap,
                "shot_tick_fracs": shot_tick_fracs,
            }

        # Shot 8: Clinical Summary & Key Checkpoints
        else:
            lt = max(0.0, t_sec - s8["start_sec"])
            u = lt / max(1e-3, s8["duration_sec"])
            psi = -25.0 * smoothstep(0.05, 0.35, u)
            theta = 0.0
            hl, sup, cap = select_copy(s8, u)
            return {
                "scene_id": s8["scene_id"],
                "step_id": "outro",
                "step_badge": s8["step_badge"],
                "step_title": s8["step_title"],
                "scene_progress": round(u, 4),
                "psi_yaw_deg": psi,
                "theta_recline_deg": theta,
                "mobility": 50.0,
                "phi_cap_max": 186.0,
                "phase": "hold",
                "cutaway_mode": False,
                "role_swap_blend": 0.0,
                "headline": hl,
                "support": sup,
                "caption": cap,
                "shot_tick_fracs": shot_tick_fracs,
            }

    return evaluate_pose


def run_blender_pass():
    from src.physics.epley_simulator import rotation_matrix_head
    from src.render.blender_scene_builder import DualStageBlenderScene

    manifest = load_manifest()
    pose_eval = make_timeline_pose_evaluator(manifest)

    full_dir = REPO_ROOT / "build" / "full"
    raw_dir = full_dir / "raw_poses"
    if raw_dir.exists():
        shutil.rmtree(raw_dir)
    raw_dir.mkdir(parents=True, exist_ok=True)

    sim_fps = 15
    total_sim_frames = int(round(manifest["total_duration_sec"] * sim_fps))
    print(f"[build_full_video] Simulating {total_sim_frames} frames at {sim_fps} fps ({manifest['total_duration_sec']:.2f}s)...")

    sim = EpleySimulator(REPO_ROOT / "assets" / "iemap" / "posterior_canal_path.json", num_particles=5)
    states = sim.simulate_timeline(
        fps=sim_fps,
        total_frames=total_sim_frames,
        pose_evaluator=pose_eval,
        initial_phi_deg=-84.0,
    )

    scene_builder = DualStageBlenderScene(REPO_ROOT, resolution=(2560, 1080), samples=4)

    ras_landmarks = {
        "posterior_duct": sim.interpolate_at_phi(0.0)[1].tolist(),       # Posterolateral apex of Sp
        "posterior_ampulla": sim.interpolate_at_phi(-112.0)[1].tolist(), # Posterior ampulla
        "common_crus": sim.interpolate_at_phi(145.0)[1].tolist(),        # Mid common crus
        "utricle": [4.58, 1.87, 0.35],                                   # Center of authentic utricle
        "cochlea": [1.77, 6.38, -2.96],                                  # Authentic cochlea
    }

    frames_meta = []
    pose_cache = {}

    for st in states:
        pose_info = pose_eval(st.time_sec)
        psi_q = round(st.psi_yaw_deg)
        theta_q = round(st.theta_recline_deg)
        phi_q = round(st.otoconia_phi_deg * 0.5) * 2.0
        cutaway_q = bool(pose_info["cutaway_mode"])
        phase_q = str(pose_info["phase"])
        step_q = str(st.step_id) if phase_q == "move" else ("hold_active" if st.step_id in {"step1", "step2", "step3", "step4", "step5"} else "intro")
        pose_key = (psi_q, theta_q, phi_q, cutaway_q, phase_q, step_q)

        # Compute exact particle cloud and centerline tangent for the quantized state `(psi_q, theta_q, phi_q)`
        # so the 2D warm halo rings and 3D rendered canalith spheres are in 100.0% sub-pixel lockstep
        R_q = rotation_matrix_head(psi_q, theta_q)
        pts_ras_q, _ = sim.compute_particle_cloud(phi_q, R_q)
        arc_q, center_ras_q, tan_ras_q, _, _ = sim.interpolate_at_phi(phi_q)

        scene_builder.update_frame_state(
            psi_yaw_deg=psi_q,
            theta_recline_deg=theta_q,
            otoconia_particles_ras=pts_ras_q,
            cupula_deflection=0.0,
            step_id=st.step_id,
            phase=phase_q,
            cutaway_mode=cutaway_q,
        )

        if pose_key in pose_cache:
            raw_path = pose_cache[pose_key]
        else:
            raw_path = raw_dir / f"pose_{len(pose_cache):04d}.png"
            scene_builder.render_frame(raw_path)
            pose_cache[pose_key] = raw_path
            if len(pose_cache) % 20 == 0:
                print(f"[build_full_video] Rendered {len(pose_cache)} unique 3D poses (t={st.time_sec:.1f}s)...")

        # Project migration trail along the posterior canal from -90 deg up to current phi_q
        trail_pts_2d = []
        for idx_s in range(0, len(sim.phis), 3):
            phi_s = float(sim.phis[idx_s])
            if -91.0 <= phi_s <= phi_q + 2.0:
                px, py, _ = scene_builder.project_ras_point(sim.pos_ras[idx_s])
                trail_pts_2d.append([round(px, 2), round(py, 2)])

        ox, oy, _ = scene_builder.project_ras_point(center_ras_q)
        tan_end_ras = center_ras_q + tan_ras_q * 1.2
        tx, ty, _ = scene_builder.project_ras_point(tan_end_ras)

        proj_particles = []
        for p_ras in pts_ras_q:
            ppx, ppy, _ = scene_builder.project_ras_point(p_ras)
            proj_particles.append([round(ppx, 2), round(ppy, 2)])

        proj_lm = {}
        for k, pt_ras in ras_landmarks.items():
            lx, ly, _ = scene_builder.project_ras_point(pt_ras)
            proj_lm[k] = [round(lx, 2), round(ly, 2)]

        ear_x, ear_y = scene_builder.project_patient_right_ear()
        emb_ear_x, emb_ear_y = scene_builder.project_patient_embedded_ear()
        nose_x, nose_y = scene_builder.project_patient_nose()
        pil_x, pil_y = scene_builder.project_patient_stage_point((-0.82, 0.0, -0.15))

        frames_meta.append({
            "frame_index": st.frame_index,
            "time_sec": round(st.time_sec, 4),
            "total_duration_sec": round(manifest["total_duration_sec"], 4),
            "raw_frame": str(raw_path),
            "scene_id": pose_info["scene_id"],
            "step_id": st.step_id,
            "step_badge": pose_info["step_badge"],
            "step_title": st.step_title,
            "scene_progress": pose_info["scene_progress"],
            "phase": pose_info["phase"],
            "cutaway_mode": pose_info["cutaway_mode"],
            "role_swap_blend": round(float(pose_info["role_swap_blend"]), 4),
            "psi_yaw_deg": float(psi_q),
            "theta_recline_deg": float(theta_q),
            "otoconia_phi_deg": round(float(phi_q), 2),
            "otoconia_arc_mm": round(float(arc_q), 3),
            "gravity_along_canal": round(st.gravity_along_canal, 4),
            "anatomical_region": st.anatomical_region,
            "headline": pose_info["headline"],
            "support": pose_info["support"],
            "caption": pose_info["caption"],
            "shot_tick_fracs": pose_info["shot_tick_fracs"],
            "trail_pts_2d": trail_pts_2d,
            "otoconia_center_2d": [round(ox, 2), round(oy, 2)],
            "particles_2d": proj_particles,
            "otoconia_tan_end_2d": [round(tx, 2), round(ty, 2)],
            "landmarks_2d": proj_lm,
            "patient_right_ear_2d": [round(ear_x, 2), round(ear_y, 2)],
            "patient_embedded_ear_2d": [round(emb_ear_x, 2), round(emb_ear_y, 2)],
            "patient_nose_tip_2d": [round(nose_x, 2), round(nose_y, 2)],
            "pillow_2d": [round(pil_x, 2), round(pil_y, 2)],
        })

    meta_out = full_dir / "full_frames_meta.json"
    with open(meta_out, "w", encoding="utf-8") as f:
        json.dump(
            {
                "sim_fps": sim_fps,
                "target_fps": manifest["fps"],
                "total_duration_sec": manifest["total_duration_sec"],
                "unique_3d_poses": len(pose_cache),
                "frames": frames_meta,
            },
            f,
            indent=2,
        )
    print(
        f"[build_full_video] Completed Blender pass: {len(pose_cache)} unique 3D poses, "
        f"{len(frames_meta)} frame projections -> {meta_out}"
    )


def _composite_worker(args):
    from src.render.hud_compositor import ClinicalHUDCompositor

    chunk, comp_dir_str = args
    comp_dir = Path(comp_dir_str)
    compositor = ClinicalHUDCompositor(1920, 1080)
    for fm in chunk:
        idx = fm["frame_index"]
        out_png = comp_dir / f"frame_{idx:05d}.png"
        compositor.compose_frame(Path(fm["raw_frame"]), out_png, fm)
    return len(chunk)


def _build_contact_sheets(qa_dir: Path, keyframe_paths: List[Path]):
    """
    Build `build/qa/review-contact-1080p.png` (2x4 grid at 960x540 per tile -> 1920x2160)
    and `build/qa/review-small-screen-640x360.png` (2x4 grid at 640x360 per tile -> 1280x1440)
    so reviewers can inspect all 8 shots at both HD and mobile scale.
    """
    from PIL import Image

    valid_paths = [p for p in keyframe_paths if p.exists()]
    if not valid_paths:
        return

    # 1. HD Contact Sheet (2 columns x 4 rows of 960x540 tiles = 1920x2160)
    tw_hd, th_hd = 960, 540
    cols, rows = 2, 4
    sheet_hd = Image.new("RGB", (cols * tw_hd, rows * th_hd), (7, 16, 20))
    for idx, p in enumerate(valid_paths[:8]):
        r = idx // cols
        c = idx % cols
        tile = Image.open(p).convert("RGB").resize((tw_hd, th_hd), Image.Resampling.LANCZOS)
        sheet_hd.paste(tile, (c * tw_hd, r * th_hd))
    hd_path = qa_dir / "review-contact-1080p.png"
    sheet_hd.save(hd_path)

    # 2. Small-Screen 640x360 Contact Sheet (2 columns x 4 rows of 640x360 tiles = 1280x1440)
    tw_sm, th_sm = 640, 360
    sheet_sm = Image.new("RGB", (cols * tw_sm, rows * th_sm), (7, 16, 20))
    for idx, p in enumerate(valid_paths[:8]):
        r = idx // cols
        c = idx % cols
        tile = Image.open(p).convert("RGB").resize((tw_sm, th_sm), Image.Resampling.LANCZOS)
        sheet_sm.paste(tile, (c * tw_sm, r * th_sm))
    sm_path = qa_dir / "review-small-screen-640x360.png"
    sheet_sm.save(sm_path)
    print(f"[build_full_video] Saved contact sheets: {hd_path} & {sm_path}")


def run_composite_and_encode():
    manifest = load_manifest()
    full_dir = REPO_ROOT / "build" / "full"
    meta_out = full_dir / "full_frames_meta.json"
    with open(meta_out, "r", encoding="utf-8") as f:
        data = json.load(f)

    comp_dir = full_dir / "composited_frames"
    if comp_dir.exists():
        shutil.rmtree(comp_dir)
    comp_dir.mkdir(parents=True, exist_ok=True)
    frames = data["frames"]

    num_workers = min(8, os.cpu_count() or 4)
    chunk_size = max(1, (len(frames) + num_workers - 1) // num_workers)
    chunks = [
        (frames[i : i + chunk_size], str(comp_dir))
        for i in range(0, len(frames), chunk_size)
    ]

    print(f"[build_full_video] Compositing {len(frames)} Gate 3 1080p frames across {len(chunks)} workers...")
    with ProcessPoolExecutor(max_workers=num_workers) as ex:
        list(ex.map(_composite_worker, chunks))

    # Export QA keyframes for each of the 8 shots (both Movement and Hold phases where applicable)
    qa_dir = REPO_ROOT / "build" / "qa"
    qa_dir.mkdir(parents=True, exist_ok=True)
    contact_keyframes = []

    for sc in manifest["scenes"]:
        sc_id = sc["scene_id"]
        # Movement / Part 1 sample (~22% into shot)
        t_part1 = sc["start_sec"] + 0.22 * sc["duration_sec"]
        f_idx1 = min(len(frames) - 1, max(0, int(round(t_part1 * data["sim_fps"]))))
        src1 = comp_dir / f"frame_{f_idx1:05d}.png"
        dst1 = qa_dir / f"{sc_id}_part1.png"
        if src1.exists():
            shutil.copy2(src1, dst1)

        # Hold / Part 2 sample (~72% into shot)
        t_part2 = sc["start_sec"] + 0.72 * sc["duration_sec"]
        f_idx2 = min(len(frames) - 1, max(0, int(round(t_part2 * data["sim_fps"]))))
        src2 = comp_dir / f"frame_{f_idx2:05d}.png"
        dst2 = qa_dir / f"{sc_id}.png"
        if src2.exists():
            shutil.copy2(src2, dst2)
            print(f"[build_full_video] Saved QA keyframe: {dst2} (t={t_part2:.1f}s, phi={frames[f_idx2]['otoconia_phi_deg']:.1f} deg)")

        # For the 8-tile contact sheet, show a balanced mix of Movement (Patient-Dominant) and Hold (Labyrinth-Dominant)
        if sc["step_id"] in {"locate", "step1", "step3", "outro"}:
            contact_keyframes.append(dst1 if sc["step_id"] in {"locate", "step1", "step3"} else dst2)
        else:
            contact_keyframes.append(dst2)

    _build_contact_sheets(qa_dir, contact_keyframes)

    # Encode final 1920x1080 @ 30fps MP4 with full audio mix
    out_dir = REPO_ROOT / "output"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_mp4 = out_dir / "epley_maneuver_right_bppv.mp4"
    mix_wav = REPO_ROOT / manifest["mix_wav"]

    cmd = [
        "/opt/homebrew/bin/ffmpeg",
        "-y",
        "-framerate", str(data["sim_fps"]),
        "-i", str(comp_dir / "frame_%05d.png"),
        "-i", str(mix_wav),
        "-vf", "fps=30,format=yuv420p",
        "-c:v", "libx264",
        "-profile:v", "high",
        "-level:v", "4.1",
        "-crf", "18",
        "-preset", "fast",
        "-c:a", "aac",
        "-b:a", "192k",
        "-ar", "44100",
        "-shortest",
        "-movflags", "+faststart",
        str(out_mp4),
    ]
    subprocess.run(cmd, check=True)
    print(f"[build_full_video] Successfully encoded final Gate 3 video: {out_mp4}")


if __name__ == "__main__":
    if "--composite-only" in sys.argv:
        run_composite_and_encode()
    elif "--blender-only" in sys.argv:
        run_blender_pass()
    else:
        run_blender_pass()
        codex_py = Path("/Users/umcai/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3")
        if codex_py.exists():
            print(f"[build_full_video] Launching composite & encode pass with {codex_py}...")
            subprocess.run([str(codex_py), str(Path(__file__).resolve()), "--composite-only"], check=True)
        else:
            run_composite_and_encode()
