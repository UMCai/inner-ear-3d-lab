"""
scripts/generate_multicanal_splines.py

Generates continuous 3D centerline splines for:
1. Horizontal (Lateral) Semicircular Canal (`assets/iemap/horizontal_canal_path.json`)
2. Anterior (Superior) Semicircular Canal (`assets/iemap/anterior_canal_path.json`)

Anchored strictly to authentic IE-Map v1.0.0 OBJ segmentations and Slicer RAS fiducials.
Uses centripetal Catmull-Rom interpolation with local cross-sectional lumen centroid relaxation,
Bishop parallel transport frames (zero Frenet twist singularities), and automated lumen clearance assertions.
"""

import json
import math
from pathlib import Path
import numpy as np

REPO_ROOT = Path(__file__).resolve().parent.parent
IEMAP_DIR = REPO_ROOT / "assets" / "iemap"
OBJ_DIR = IEMAP_DIR / "obj"

def load_obj(path):
    verts = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            if line.startswith("v "):
                verts.append([float(x) for x in line.split()[1:4]])
    return np.array(verts)

def catmull_rom_spline(P, num_samples=150):
    pts = np.vstack([P[0] - (P[1] - P[0]), P, P[-1] + (P[-1] - P[-2])])
    curve = []
    num_segs = len(P) - 1
    per_seg = int(np.ceil(num_samples / num_segs)) + 1
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i-1], pts[i], pts[i+1], pts[i+2]
        for t in np.linspace(0, 1, per_seg, endpoint=(i == len(pts)-3)):
            t2 = t * t
            t3 = t2 * t
            pos = 0.5 * (
                (2 * p1) +
                (-p0 + p2) * t +
                (2*p0 - 5*p1 + 4*p2 - p3) * t2 +
                (-p0 + 3*p1 - 3*p2 + p3) * t3
            )
            curve.append(pos)
    curve = np.array(curve)

    # Arc-length parameterization
    diffs = np.diff(curve, axis=0)
    dists = np.concatenate([[0.0], np.cumsum(np.linalg.norm(diffs, axis=1))])
    total_len = float(dists[-1])
    target_dists = np.linspace(0.0, total_len, num_samples)
    resampled = np.zeros((num_samples, 3))
    for c in range(3):
        resampled[:, c] = np.interp(target_dists, dists, curve[:, c])
    return resampled, total_len

def relax_to_lumen_centroids(spline_pts, mesh_verts, radius=0.85, iterations=4):
    """
    Relaxes spline points towards the local centroid of neighboring mesh vertices
    to ensure perfect centering within the tubular lumen, maximizing wall clearance.
    """
    relaxed = np.copy(spline_pts)
    N = len(relaxed)
    for _ in range(iterations):
        for i in range(1, N - 1):
            pt = relaxed[i]
            dists = np.linalg.norm(mesh_verts - pt, axis=1)
            neighbors = mesh_verts[dists < radius]
            if len(neighbors) >= 12:
                local_center = np.mean(neighbors, axis=0)
                # Blend with tangent smoothing
                tangent_smooth = 0.5 * (relaxed[i - 1] + relaxed[i + 1])
                relaxed[i] = 0.65 * local_center + 0.35 * tangent_smooth
            else:
                relaxed[i] = 0.5 * (relaxed[i - 1] + relaxed[i + 1])

    # Re-parameterize uniformly along arc
    diffs = np.diff(relaxed, axis=0)
    dists = np.concatenate([[0.0], np.cumsum(np.linalg.norm(diffs, axis=1))])
    total_len = float(dists[-1])
    target_dists = np.linspace(0.0, total_len, N)
    uniform_pts = np.zeros_like(relaxed)
    for c in range(3):
        uniform_pts[:, c] = np.interp(target_dists, dists, relaxed[:, c])
    return uniform_pts, total_len

def compute_bishop_frames(pts):
    """
    Computes rotation-minimizing (Bishop / parallel transport) orthonormal frames:
    tangent T and normal N along the discrete 3D curve.
    """
    tangents = np.gradient(pts, axis=0)
    norms = np.linalg.norm(tangents, axis=1, keepdims=True)
    norms = np.where(norms < 1e-9, 1.0, norms)
    T = tangents / norms

    ref = np.array([0.0, 0.0, 1.0])
    if abs(np.dot(T[0], ref)) > 0.95:
        ref = np.array([1.0, 0.0, 0.0])
    n0 = np.cross(T[0], ref)
    n0 /= np.linalg.norm(n0)

    N = np.zeros_like(T)
    N[0] = n0
    for i in range(1, len(pts)):
        v = np.cross(T[i - 1], T[i])
        s = np.linalg.norm(v)
        c = np.dot(T[i - 1], T[i])
        if s < 1e-7:
            N[i] = N[i - 1]
        else:
            axis = v / s
            angle = math.atan2(s, c)
            n_prev = N[i - 1]
            n_rot = (
                n_prev * math.cos(angle)
                + np.cross(axis, n_prev) * math.sin(angle)
                + axis * np.dot(axis, n_prev) * (1.0 - math.cos(angle))
            )
            n_rot -= np.dot(n_rot, T[i]) * T[i]
            n_rot /= np.linalg.norm(n_rot)
            N[i] = n_rot

    return T, N

def generate_horizontal_canal():
    print("=== Generating Horizontal Canal Centerline ===")
    sl = load_obj(OBJ_DIR / "ls_Hsapiens_Sl.obj")
    al = load_obj(OBJ_DIR / "ls_Hsapiens_Al.obj")
    sc = load_obj(OBJ_DIR / "ls_Hsapiens_SC.obj")
    ut = load_obj(OBJ_DIR / "ls_Hsapiens_utricle.obj")
    mesh_all = np.vstack([al, sl, sc, ut])

    # Guide anchor knots through lumen (Ampulla -> Apex -> SC -> Utricle)
    guide_knots = np.array([
        [6.88, 3.21, 0.74],    # Knot 0: Lateral ampulla cupula barrier
        [7.85, 3.30, 1.15],    # Knot 1: Al-Sl junction
        [8.91, 2.86, 1.30],    # Knot 2: Anterolateral arch
        [10.15, 1.85, 1.10],   # Knot 3: Lateral curve
        [10.42, 0.63, 0.82],   # Knot 4: Lateral apex (Reid's +30 deg plane)
        [10.10, -0.65, 0.65],  # Knot 5: Posterolateral curve
        [9.40, -1.55, 0.51],   # Knot 6: Posteromedial duct
        [7.80, -1.75, 0.35],   # Knot 7: Sl-SC junction
        [5.56, -0.94, -0.05],  # Knot 8: Simple crus
        [4.51, 0.11, -0.86],   # Knot 9: Utricular entry doorway
        [3.78, 0.62, -0.20],   # Knot 10: Utricle floor rest
    ])

    initial_pts, _ = catmull_rom_spline(guide_knots, num_samples=150)
    pts, total_len = relax_to_lumen_centroids(initial_pts, mesh_all, radius=0.90, iterations=5)
    T, N = compute_bishop_frames(pts)

    clearances = np.array([np.min(np.linalg.norm(mesh_all - p, axis=1)) for p in pts])
    print(f"Horizontal Canal Path: 150 knots, length={total_len:.2f} mm")
    print(f"Wall Clearance: min={clearances.min():.3f} mm, mean={clearances.mean():.3f} mm, max={clearances.max():.3f} mm")
    assert clearances.min() > 0.015, f"Warning: minimum clearance {clearances.min()} mm too low"
    assert clearances.mean() > 0.18, f"Warning: mean clearance {clearances.mean()} mm too low"

    # Map phi angles from -90 deg (cupula) to +90 deg (apex) to +180 deg (utricle)
    phi_deg = np.linspace(-90.0, 180.0, 150)
    diffs = np.diff(pts, axis=0)
    arc_lengths = np.concatenate([[0.0], np.cumsum(np.linalg.norm(diffs, axis=1))])

    data = {
        "coordinate_system": "RAS",
        "ear_side": "Right",
        "units": "mm",
        "canal_name": "horizontal",
        "canal_center_ras": [float(x) for x in np.mean(pts, axis=0)],
        "canal_radius_mm": 2.65,
        "total_arc_length_mm": round(total_len, 4),
        "landmarks_phi_deg": {
            "cupula_barrier": -90.0,
            "ampulla_exit": -60.0,
            "lateral_apex": 0.0,
            "simple_crus_entry": 95.0,
            "utricle_orifice": 150.0,
            "utricle_rest": 180.0,
        },
        "samples": [
            {
                "index": i,
                "phi_deg": round(float(phi_deg[i]), 2),
                "arc_length_mm": round(float(arc_lengths[i]), 4),
                "position_ras": [round(float(x), 5) for x in pts[i]],
                "tangent_ras": [round(float(x), 5) for x in T[i]],
                "normal_ras": [round(float(x), 5) for x in N[i]],
            }
            for i in range(150)
        ],
    }

    out_file = IEMAP_DIR / "horizontal_canal_path.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print(f"Saved: {out_file}")
    return data

def generate_anterior_canal():
    print("=== Generating Anterior Canal Centerline ===")
    sa = load_obj(OBJ_DIR / "ls_Hsapiens_Sa.obj")
    aa = load_obj(OBJ_DIR / "ls_Hsapiens_Aa.obj")
    cca = load_obj(OBJ_DIR / "ls_Hsapiens_CCa.obj")
    ccp = load_obj(OBJ_DIR / "ls_Hsapiens_CCp.obj")
    ut = load_obj(OBJ_DIR / "ls_Hsapiens_utricle.obj")
    mesh_all = np.vstack([aa, sa, cca, ccp, ut])

    # Guide anchor knots through lumen (Ampulla -> Superior Apex -> CC -> Utricle)
    guide_knots = np.array([
        [5.77, 3.66, 1.78],    # Knot 0: Anterior ampulla cupula barrier
        [7.09, 3.89, 2.76],    # Knot 1: Aa-Sa ascending junction
        [7.28, 2.96, 5.94],    # Knot 2: Anterior ascending limb
        [6.60, 2.10, 6.95],    # Knot 3: Anterosuperior curve
        [5.71, 1.13, 7.32],    # Knot 4: Superior arcuate apex (highest point)
        [4.80, 0.05, 6.90],    # Knot 5: Posterosuperior curve
        [3.97, -0.90, 6.05],   # Knot 6: Descending limb
        [4.20, -2.20, 2.00],   # Knot 7: Common crus junction (shared with posterior canal)
        [3.98, -0.85, 1.22],   # Knot 8: Mid Common Crus
        [4.03, -0.15, 0.10],   # Knot 9: Common crus utricular orifice
        [4.15, 0.60, -0.25],   # Knot 10: Utricle floor rest
    ])

    initial_pts, _ = catmull_rom_spline(guide_knots, num_samples=150)
    pts, total_len = relax_to_lumen_centroids(initial_pts, mesh_all, radius=0.90, iterations=5)
    T, N = compute_bishop_frames(pts)

    clearances = np.array([np.min(np.linalg.norm(mesh_all - p, axis=1)) for p in pts])
    print(f"Anterior Canal Path: 150 knots, length={total_len:.2f} mm")
    print(f"Wall Clearance: min={clearances.min():.3f} mm, mean={clearances.mean():.3f} mm, max={clearances.max():.3f} mm")
    assert clearances.min() > 0.015, f"Warning: minimum clearance {clearances.min()} mm too low"
    assert clearances.mean() > 0.18, f"Warning: mean clearance {clearances.mean()} mm too low"

    # Map phi angles from -90 deg (cupula) to 0 deg (superior apex) to +180 deg (utricle)
    phi_deg = np.linspace(-90.0, 180.0, 150)
    diffs = np.diff(pts, axis=0)
    arc_lengths = np.concatenate([[0.0], np.cumsum(np.linalg.norm(diffs, axis=1))])

    data = {
        "coordinate_system": "RAS",
        "ear_side": "Right",
        "units": "mm",
        "canal_name": "anterior",
        "canal_center_ras": [float(x) for x in np.mean(pts, axis=0)],
        "canal_radius_mm": 2.75,
        "total_arc_length_mm": round(total_len, 4),
        "landmarks_phi_deg": {
            "cupula_barrier": -90.0,
            "ampulla_exit": -60.0,
            "superior_apex": 0.0,
            "common_crus_entry": 95.0,
            "common_crus_exit": 150.0,
            "utricle_rest": 180.0,
        },
        "samples": [
            {
                "index": i,
                "phi_deg": round(float(phi_deg[i]), 2),
                "arc_length_mm": round(float(arc_lengths[i]), 4),
                "position_ras": [round(float(x), 5) for x in pts[i]],
                "tangent_ras": [round(float(x), 5) for x in T[i]],
                "normal_ras": [round(float(x), 5) for x in N[i]],
            }
            for i in range(150)
        ],
    }

    out_file = IEMAP_DIR / "anterior_canal_path.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print(f"Saved: {out_file}")
    return data

if __name__ == "__main__":
    generate_horizontal_canal()
    generate_anterior_canal()
    print("Multi-canal spline generation completed successfully!")
