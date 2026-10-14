#!/usr/bin/env python3
"""
Clinical Narration & Sound Design Pipeline (`src/audio/build_audio.py`)
=======================================================================
1. Synthesizes clear clinical narration for the 8-shot Gate 3 clinical story using macOS `/usr/bin/say`.
2. Measures exact audio durations with `ffprobe` to build a deterministic scene timeline.
3. Synthesizes subtle, non-distracting clinical sound cues (ambient harmonic bed,
   soft positional transition cues, and delicate crystalline settling chimes) in NumPy.
4. Produces `build/audio/full_narration_mix.wav`, `build/audio/timeline_manifest.json`,
   and `output/epley_maneuver_right_bppv.srt`.
"""

import json
import math
import subprocess
import wave
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np


SCENES_SPEC = [
    {
        "scene_id": "scene1_locate",
        "step_id": "locate",
        "step_badge": "ANATOMY · LOCATE",
        "step_title": "Anatomical Location — Right Inner Ear Labyrinth",
        "narration_tts": (
            "In posterior-canal BPPV, displaced otoconia enter the posterior semicircular canal. "
            "Inside the right temporal bone, the posterior canal arches posterolaterally behind the utricle."
        ),
        "headline_part1": "Right Posterior-Canal BPPV: Displaced Otoconia",
        "support_part1": "In posterior-canal BPPV, displaced otoconia enter the posterior semicircular canal.",
        "headline_part2": "Spatial Orientation Inside the Right Temporal Bone",
        "support_part2": "The right posterior semicircular canal lies 45° off the sagittal plane behind the utricle.",
        "caption": "In posterior-canal BPPV, displaced otoconia enter the posterior semicircular canal.",
        "caption_part2": "Inside the right temporal bone, the posterior canal arches posterolaterally behind the utricle.",
        "lead_in_sec": 0.35,
        "tail_out_sec": 0.45,
    },
    {
        "scene_id": "scene2_pathology",
        "step_id": "intro",
        "step_badge": "PATHOLOGY · CANALITHS",
        "step_title": "Pathology — Loose Otoconia Near the Posterior Ampulla",
        "narration_tts": (
            "These dense particles settle at the lowest point of the canal near the posterior ampulla. "
            "The Epley maneuver uses sequential head turns and gravity to guide them around the canal, "
            "through the common crus, and back into the utricle."
        ),
        "headline_part1": "Pathology: Loose Otoconia Near the Posterior Ampulla",
        "support_part1": "Dense otoconia settle at the dependent base of the right posterior canal near the ampulla.",
        "headline_part2": "The Repositioning Pathway to the Utricle",
        "support_part2": "Sequential head turns use gravity to guide particles around the posterior canal and through the common crus.",
        "caption": "Dense otoconia settle at the lowest point of the right posterior canal near the posterior ampulla.",
        "caption_part2": "Sequential head rotations use gravity to guide the particles around the canal, through the common crus, and into the utricle.",
        "lead_in_sec": 0.35,
        "tail_out_sec": 0.45,
    },
    {
        "scene_id": "scene3_step1",
        "step_id": "step1",
        "step_badge": "STEP 1 OF 5 · 45° RIGHT TURN",
        "step_title": "Step 1 of 5 — Sit Upright & Turn Head 45° Right",
        "narration_tts": (
            "Step one. With the patient seated upright and a shoulder pillow positioned behind the upper back, "
            "turn the head forty-five degrees to the right, toward the affected ear. "
            "This aligns the right posterior canal with the sagittal plane of the recline."
        ),
        "headline_part1": "Step 1: Sit Upright & Turn Head 45° Right",
        "support_part1": "Place a shoulder pillow behind the upper back and rotate the head 45° toward the affected right ear.",
        "headline_part2": "Step 1: Right Posterior Canal Aligned with Recline Plane",
        "support_part2": "Turning 45° right rotates the right posterior canal into the vertical plane of the table.",
        "caption": "Step 1: Sit upright with a shoulder pillow behind the upper back and turn the head 45° right.",
        "caption_part2": "Turning the head 45° right aligns the right posterior semicircular canal with the plane of recline.",
        "lead_in_sec": 0.35,
        "tail_out_sec": 0.55,
    },
    {
        "scene_id": "scene4_step2",
        "step_id": "step2",
        "step_badge": "STEP 2 OF 5 · SUPINE 30° EXTENSION",
        "step_title": "Step 2 of 5 — Recline to Supine with 20–30° Neck Extension",
        "narration_tts": (
            "Step two. Maintaining the forty-five degree right turn, briskly recline the patient onto the shoulder pillow "
            "so the head extends twenty to thirty degrees below horizontal. "
            "Gravity pulls the otoconia away from the ampulla toward the posterior canal apex. "
            "Hold for thirty to sixty seconds."
        ),
        "headline_part1": "Step 2: Recline to Supine with 20–30° Neck Extension",
        "support_part1": "Keeping the 45° right turn, recline onto the shoulder pillow so the head extends 20–30° below horizontal.",
        "headline_part2": "Step 2 Hold (30–60 s): Gravity Pulls Otoconia Along Canal",
        "support_part2": "Gravity draws the otoconia away from the ampulla toward the canal apex; hold until vertigo stops.",
        "caption": "Step 2: Maintaining the 45° right turn, recline onto the shoulder pillow with 20–30° neck extension.",
        "caption_part2": "Gravity pulls the otoconia away from the ampulla toward the posterior canal apex. Hold 30–60 seconds.",
        "lead_in_sec": 0.35,
        "tail_out_sec": 0.65,
    },
    {
        "scene_id": "scene5_step3",
        "step_id": "step3",
        "step_badge": "STEP 3 OF 5 · 90° LEFT TURN",
        "step_title": "Step 3 of 5 — Rotate Head 90° Left (Facing 45° Left)",
        "narration_tts": (
            "Step three. Without lifting the head, rotate the head ninety degrees to the left "
            "so it faces forty-five degrees left, while keeping full neck extension below horizontal. "
            "Gravity guides the otoconia over the superior arch into the common crus. "
            "Hold for thirty to sixty seconds."
        ),
        "headline_part1": "Step 3: Rotate Head 90° Left (Now Facing 45° Left)",
        "support_part1": "Without raising the head, turn 90° left while maintaining full 20–30° neck extension below horizontal.",
        "headline_part2": "Step 3 Hold (30–60 s): Otoconia Enter the Common Crus",
        "support_part2": "Gravity guides the otoconia across the superior arch into the common crus; hold for 30–60 seconds.",
        "caption": "Step 3: Without lifting the head, rotate 90° left to face 45° left while maintaining neck extension.",
        "caption_part2": "Gravity guides the otoconia over the superior arch into the common crus. Hold 30–60 seconds.",
        "lead_in_sec": 0.35,
        "tail_out_sec": 0.65,
    },
    {
        "scene_id": "scene6_step4",
        "step_id": "step4",
        "step_badge": "STEP 4 OF 5 · LEFT SHOULDER ROLL",
        "step_title": "Step 4 of 5 — Roll Onto Left Shoulder, Nose 45° Down",
        "narration_tts": (
            "Step four. Roll the patient onto their left shoulder while rotating the head another ninety degrees left, "
            "until the nose angles forty-five degrees down toward the floor. "
            "The common crus now points steeply downward, draining the otoconia toward the utricle. "
            "Hold for thirty to sixty seconds."
        ),
        "headline_part1": "Step 4: Roll Onto Left Shoulder, Nose 45° Down",
        "support_part1": "Roll the torso onto the left shoulder and turn the head another 90° left so the nose points 45° down.",
        "headline_part2": "Step 4 Hold (30–60 s): Drainage Down the Common Crus",
        "support_part2": "The common crus points steeply downward, allowing gravity to drain the otoconia to the utricular exit.",
        "caption": "Step 4: Roll onto the left shoulder and turn the head another 90° left until the nose points 45° down.",
        "caption_part2": "The common crus now points steeply downward, draining the otoconia toward the utricle. Hold 30–60 seconds.",
        "lead_in_sec": 0.35,
        "tail_out_sec": 0.65,
    },
    {
        "scene_id": "scene7_step5",
        "step_id": "step5",
        "step_badge": "STEP 5 OF 5 · RETURN UPRIGHT",
        "step_title": "Step 5 of 5 — Return to Upright Sitting",
        "narration_tts": (
            "Step five. Keeping the chin slightly tucked, slowly return the patient to an upright sitting position. "
            "Particles exit into the utricle; if posterior-canal BPPV is the cause, vertigo should resolve."
        ),
        "headline_part1": "Step 5: Return Slowly to Upright Sitting",
        "support_part1": "Keeping the chin tucked, guide the patient back to an upright sitting position and steady their shoulders.",
        "headline_part2": "Otoconia Repositioned → Maneuver Complete",
        "support_part2": "Particles exit into the utricle; if posterior-canal BPPV is the cause, vertigo should resolve.",
        "caption": "Step 5: Keeping the chin slightly tucked, slowly return the patient to an upright sitting position.",
        "caption_part2": "Otoconia repositioned → maneuver complete. Particles exit into the utricle; if posterior-canal BPPV is the cause, vertigo should resolve.",
        "lead_in_sec": 0.35,
        "tail_out_sec": 0.65,
    },
    {
        "scene_id": "scene8_summary",
        "step_id": "outro",
        "step_badge": "CLINICAL SUMMARY · KEY PEARLS",
        "step_title": "Clinical Summary — Key Procedural Checkpoints",
        "narration_tts": (
            "To summarize: use a shoulder pillow to achieve twenty to thirty degrees of neck extension in step two, "
            "avoid lifting the head during the ninety-degree turn in step three, "
            "and hold each position for thirty to sixty seconds so the otoconia completely settle."
        ),
        "headline_part1": "Clinical Summary: Three Keys to Epley Execution",
        "support_part1": "1. Shoulder pillow for 20–30° extension · 2. Never lift head in Step 3 · 3. Hold each step 30–60 s.",
        "headline_part2": "Post-Maneuver Clinical Observation",
        "support_part2": "Steady the patient upright for 1–2 minutes; repeat on follow-up if positional testing remains positive.",
        "caption": "Clinical Summary: (1) Shoulder pillow for 20–30° extension; (2) Never lift the head during the Step 3 turn.",
        "caption_part2": "(3) Hold each step 30–60 seconds so the otoconia completely settle along the canal pathway.",
        "lead_in_sec": 0.35,
        "tail_out_sec": 0.85,
    },
]


def probe_duration(wav_path: Path) -> float:
    cmd = [
        "/opt/homebrew/bin/ffprobe",
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        str(wav_path),
    ]
    out = subprocess.check_output(cmd, text=True).strip()
    return float(out)


def read_wav_mono(wav_path: Path) -> Tuple[int, np.ndarray]:
    with wave.open(str(wav_path), "rb") as wf:
        sr = wf.getframerate()
        n_frames = wf.getnframes()
        raw = wf.readframes(n_frames)
        samples = np.frombuffer(raw, dtype=np.int16).astype(np.float64) / 32768.0
    return sr, samples


def write_wav_stereo(wav_path: Path, sr: int, left: np.ndarray, right: np.ndarray):
    wav_path.parent.mkdir(parents=True, exist_ok=True)
    stereo = np.column_stack([left, right])
    stereo = np.clip(stereo, -0.98, 0.98)
    pcm16 = (stereo * 32767.0).astype(np.int16)
    with wave.open(str(wav_path), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(pcm16.tobytes())


def format_srt_time(sec: float) -> str:
    ms = int(round((sec - math.floor(sec)) * 1000))
    s = int(math.floor(sec))
    m = s // 60
    h = m // 60
    s %= 60
    m %= 60
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def build_audio_and_timeline(repo_root: Path, fps: int = 30) -> Dict:
    audio_dir = repo_root / "build" / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    sr = 44100

    scenes_out = []
    cur_time = 0.0
    voice_clips = []

    for spec in SCENES_SPEC:
        sid = spec["scene_id"]
        aiff_path = audio_dir / f"{sid}.aiff"
        wav_path = audio_dir / f"{sid}.wav"

        # Generate TTS via macOS Samantha voice at natural 206 wpm clinical cadence
        subprocess.run(
            ["/usr/bin/say", "-v", "Samantha", "-r", "206", "-o", str(aiff_path), spec["narration_tts"]],
            check=True,
        )
        subprocess.run(
            [
                "/opt/homebrew/bin/ffmpeg", "-y",
                "-i", str(aiff_path),
                "-ar", str(sr),
                "-ac", "1",
                "-c:a", "pcm_s16le",
                str(wav_path),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        aiff_path.unlink(missing_ok=True)

        tts_dur = probe_duration(wav_path)
        lead_in = float(spec["lead_in_sec"])
        tail_out = float(spec["tail_out_sec"])
        scene_dur = lead_in + tts_dur + tail_out
        # Round scene duration to an exact integer number of frames at `fps`
        n_frames = int(round(scene_dur * fps))
        scene_dur_exact = n_frames / float(fps)

        start_sec = cur_time
        end_sec = cur_time + scene_dur_exact
        cur_time = end_sec

        _, samples = read_wav_mono(wav_path)
        voice_clips.append((start_sec + lead_in, samples))

        scenes_out.append({
            **spec,
            "wav_path": str(wav_path.relative_to(repo_root)),
            "tts_duration_sec": round(tts_dur, 3),
            "start_sec": round(start_sec, 4),
            "end_sec": round(end_sec, 4),
            "duration_sec": round(scene_dur_exact, 4),
            "start_frame": int(round(start_sec * fps)),
            "end_frame": int(round(end_sec * fps)),
            "num_frames": n_frames,
        })

    total_duration_sec = cur_time
    total_frames = int(round(total_duration_sec * fps))
    total_samples = int(round(total_duration_sec * sr))

    # Build full stereo audio mix:
    # 1. Centered clinical voiceover
    # 2. Ultra-subtle warm ambient pad (-34 dBFS) so transitions feel cohesive
    # 3. Gentle positional transition cues & crystalline settling chimes
    t_arr = np.arange(total_samples, dtype=np.float64) / float(sr)
    pad_l = (
        0.007 * np.sin(2.0 * math.pi * 130.81 * t_arr)
        + 0.005 * np.sin(2.0 * math.pi * 196.00 * t_arr + 0.4)
        + 0.004 * np.sin(2.0 * math.pi * 246.94 * t_arr + 1.1)
    )
    pad_r = (
        0.007 * np.sin(2.0 * math.pi * 130.81 * t_arr + 0.2)
        + 0.005 * np.sin(2.0 * math.pi * 164.81 * t_arr + 0.8)
        + 0.004 * np.sin(2.0 * math.pi * 293.66 * t_arr + 1.7)
    )
    fade_len = int(1.5 * sr)
    if total_samples > 2 * fade_len:
        env = np.ones(total_samples, dtype=np.float64)
        env[:fade_len] = np.linspace(0.0, 1.0, fade_len)
        env[-fade_len:] = np.linspace(1.0, 0.0, fade_len)
        pad_l *= env
        pad_r *= env

    mix_l = pad_l.copy()
    mix_r = pad_r.copy()

    for sc in scenes_out:
        st_s = sc["start_sec"]
        en_s = sc["end_sec"]
        if sc["step_id"] in {"step1", "step2", "step3", "step4", "step5"}:
            idx0 = int((st_s + 0.15) * sr)
            cue_len = int(0.45 * sr)
            if idx0 + cue_len < total_samples:
                tc = np.arange(cue_len, dtype=np.float64) / float(sr)
                cue_env = np.sin(math.pi * tc / 0.45) ** 2
                freq = 392.0 if sc["step_id"] != "step5" else 523.25
                cue = 0.022 * cue_env * np.sin(2.0 * math.pi * freq * tc)
                mix_l[idx0 : idx0 + cue_len] += cue
                mix_r[idx0 : idx0 + cue_len] += cue

            settle_t = max(st_s + 3.0, en_s - 2.2)
            idx1 = int(settle_t * sr)
            shim_len = int(0.65 * sr)
            if idx1 + shim_len < total_samples:
                ts = np.arange(shim_len, dtype=np.float64) / float(sr)
                s_env = np.exp(-5.0 * ts) * np.sin(math.pi * ts / 0.65)
                shimmer = 0.016 * s_env * (
                    np.sin(2.0 * math.pi * 1046.5 * ts) + 0.6 * np.sin(2.0 * math.pi * 1318.5 * ts)
                )
                mix_l[idx1 : idx1 + shim_len] += shimmer * 0.9
                mix_r[idx1 : idx1 + shim_len] += shimmer * 1.1

    for offset_sec, v_samples in voice_clips:
        i0 = int(round(offset_sec * sr))
        i1 = min(total_samples, i0 + len(v_samples))
        seg = v_samples[: i1 - i0] * 0.88
        mix_l[i0:i1] += seg
        mix_r[i0:i1] += seg

    mix_wav_path = audio_dir / "full_narration_mix.wav"
    write_wav_stereo(mix_wav_path, sr, mix_l, mix_r)

    srt_path = repo_root / "output" / "epley_maneuver_right_bppv.srt"
    srt_path.parent.mkdir(parents=True, exist_ok=True)
    srt_idx = 1
    with open(srt_path, "w", encoding="utf-8") as sf:
        for sc in scenes_out:
            st_s = sc["start_sec"]
            en_s = sc["end_sec"]
            mid_s = st_s + 0.48 * (en_s - st_s)
            sf.write(f"{srt_idx}\n")
            sf.write(f"{format_srt_time(st_s + 0.12)} --> {format_srt_time(mid_s)}\n")
            sf.write(f"{sc['caption']}\n\n")
            srt_idx += 1
            sf.write(f"{srt_idx}\n")
            sf.write(f"{format_srt_time(mid_s + 0.05)} --> {format_srt_time(en_s - 0.12)}\n")
            sf.write(f"{sc['caption_part2']}\n\n")
            srt_idx += 1

    manifest = {
        "fps": fps,
        "total_duration_sec": round(total_duration_sec, 4),
        "total_frames": total_frames,
        "mix_wav": str(mix_wav_path.relative_to(repo_root)),
        "srt_path": str(srt_path.relative_to(repo_root)),
        "scenes": scenes_out,
    }
    manifest_path = audio_dir / "timeline_manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(
        f"[build_audio] Built 8-shot Gate 3 audio timeline: {total_duration_sec:.2f}s ({total_frames} frames @ {fps}fps)"
    )
    for sc in scenes_out:
        print(
            f"  - {sc['scene_id']:16s}: {sc['start_sec']:6.2f}s .. {sc['end_sec']:6.2f}s "
            f"({sc['duration_sec']:5.2f}s, {sc['num_frames']:3d} frames)"
        )
    return manifest


if __name__ == "__main__":
    repo_root = Path(__file__).resolve().parent.parent.parent
    build_audio_and_timeline(repo_root, fps=30)
