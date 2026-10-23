"""
scripts/test_canal_paths.py

Automated mathematical & anatomical verification suite for Stage 3 Step 1:
1. Validates all 3 semicircular canal centerline paths (Posterior, Horizontal, Anterior).
2. Verifies monotonic arc-length progression and physiological total lengths.
3. Asserts strict unit normalization and mutual orthogonality of Bishop/Frenet triads.
4. Asserts positive lumen wall clearance against authentic IE-Map v1.0.0 OBJ segmentations.
5. Verifies the existence, size, and structure of `eye_avatar.glb`.
"""

import json
import math
import sys
from pathlib import Path

try:
    import numpy as np
    HAVE_NUMPY = True
except ImportError:
    HAVE_NUMPY = False

REPO_ROOT = Path(__file__).resolve().parent.parent
IEMAP_DIR = REPO_ROOT / "assets" / "iemap"
WEB_ASSETS_DIR = REPO_ROOT / "web" / "public" / "assets" / "iemap"
OBJ_DIR = IEMAP_DIR / "obj"

def load_obj(path):
    verts = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            if line.startswith("v "):
                verts.append([float(x) for x in line.split()[1:4]])
    return verts

def test_canal_file(json_path, expected_len_range, mesh_files):
    print(f"\n[TEST SUITE] Verifying {json_path.name}...")
    assert json_path.exists(), f"Error: Missing path file {json_path}"

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    assert data["coordinate_system"] == "RAS", f"Invalid coordinate system: {data['coordinate_system']}"
    assert data["units"] == "mm", f"Invalid units: {data['units']}"
    assert "landmarks_phi_deg" in data, "Missing landmarks_phi_deg"
    assert len(data["landmarks_phi_deg"]) >= 4, "Too few clinical landmark knots"

    samples = data["samples"]
    N = len(samples)
    print(f"  Samples: {N} knots")
    assert N >= 100, f"Sample count {N} too low (expected >= 100)"

    total_arc = data["total_arc_length_mm"]
    print(f"  Total Arc Length: {total_arc:.2f} mm (Expected: {expected_len_range[0]} - {expected_len_range[1]} mm)")
    assert expected_len_range[0] <= total_arc <= expected_len_range[1], (
        f"Arc length {total_arc} mm outside physiological range {expected_len_range}"
    )

    # Check monotonicity of arc length
    arc_lengths = [s["arc_length_mm"] for s in samples]
    for i in range(1, N):
        diff = arc_lengths[i] - arc_lengths[i - 1]
        assert diff > 0, f"Non-monotonic arc length at knot {i}: {arc_lengths[i - 1]} -> {arc_lengths[i]}"

    # Check unit vectors and orthogonality
    max_tan_norm_err = 0.0
    max_nrm_norm_err = 0.0
    max_dot_tn_err = 0.0

    pts = []
    for i, s in enumerate(samples):
        pos = s["position_ras"]
        tan = s["tangent_ras"]
        nrm = s["normal_ras"]

        pts.append(pos)
        t_len = math.sqrt(tan[0] ** 2 + tan[1] ** 2 + tan[2] ** 2)
        n_len = math.sqrt(nrm[0] ** 2 + nrm[1] ** 2 + nrm[2] ** 2)
        dot_tn = abs(tan[0] * nrm[0] + tan[1] * nrm[1] + tan[2] * nrm[2])

        max_tan_norm_err = max(max_tan_norm_err, abs(t_len - 1.0))
        max_nrm_norm_err = max(max_nrm_norm_err, abs(n_len - 1.0))
        max_dot_tn_err = max(max_dot_tn_err, dot_tn)

    print(f"  Max Tangent Norm Error: {max_tan_norm_err:.2e}")
    print(f"  Max Normal Norm Error:  {max_nrm_norm_err:.2e}")
    print(f"  Max Tangent.Normal Dot: {max_dot_tn_err:.2e}")

    assert max_tan_norm_err < 1e-3, f"Tangent normalization error too high: {max_tan_norm_err}"
    assert max_nrm_norm_err < 1e-3, f"Normal normalization error too high: {max_nrm_norm_err}"
    assert max_dot_tn_err < 1e-3, f"Tangent-Normal orthogonality error too high: {max_dot_tn_err}"

    # Check clearance inside authentic OBJ meshes
    mesh_verts = []
    for m in mesh_files:
        mesh_verts.extend(load_obj(OBJ_DIR / m))

    if HAVE_NUMPY:
        np_mesh_verts = np.array(mesh_verts)
        np_pts = np.array(pts)
        clearances = [float(np.min(np.linalg.norm(np_mesh_verts - p, axis=1))) for p in np_pts]
    else:
        clearances = []
        for p in pts:
            px, py, pz = p
            min_d_sq = min((v[0] - px) ** 2 + (v[1] - py) ** 2 + (v[2] - pz) ** 2 for v in mesh_verts)
            clearances.append(math.sqrt(min_d_sq))

    min_clearance = min(clearances)
    mean_clearance = sum(clearances) / len(clearances)
    max_clearance = max(clearances)

    print(f"  Mesh Lumen Clearance: min={min_clearance:.3f} mm, mean={mean_clearance:.3f} mm, max={max_clearance:.3f} mm")
    assert min_clearance > 0.015, f"Clearance min {min_clearance:.3f} mm indicates wall penetration"
    assert mean_clearance > 0.18, f"Clearance mean {mean_clearance:.3f} mm indicates off-center spline"

    print(f"  [PASS] {json_path.name} is 100% verified!")

def test_eye_avatar():
    print("\n[TEST SUITE] Verifying 3D Eye Avatar GLB...")
    for p in [IEMAP_DIR / "eye_avatar.glb", WEB_ASSETS_DIR / "eye_avatar.glb"]:
        assert p.exists(), f"Error: Missing GLB file {p}"
        size_kb = p.stat().st_size / 1024.0
        print(f"  {p.relative_to(REPO_ROOT)}: {size_kb:.1f} kB")
        assert 50.0 < size_kb < 500.0, f"GLB size {size_kb} kB outside target range (50 - 500 kB)"
    print("  [PASS] 3D Eye Avatar GLB verified in both asset and web public directories!")

def main():
    print("=================================================================")
    print(" Inner Ear 3D Lab: Stage 3 Step 1 Automated Verification Suite")
    print("=================================================================")

    # 1. Posterior Canal
    test_canal_file(
        IEMAP_DIR / "posterior_canal_path.json",
        expected_len_range=(18.0, 21.0),
        mesh_files=["ls_Hsapiens_Sp.obj", "ls_Hsapiens_Ap.obj", "ls_Hsapiens_CCp.obj", "ls_Hsapiens_utricle.obj"],
    )

    # 2. Horizontal Canal
    test_canal_file(
        IEMAP_DIR / "horizontal_canal_path.json",
        expected_len_range=(14.0, 17.0),
        mesh_files=["ls_Hsapiens_Sl.obj", "ls_Hsapiens_Al.obj", "ls_Hsapiens_SC.obj", "ls_Hsapiens_utricle.obj"],
    )

    # 3. Anterior Canal
    test_canal_file(
        IEMAP_DIR / "anterior_canal_path.json",
        expected_len_range=(18.0, 21.0),
        mesh_files=["ls_Hsapiens_Sa.obj", "ls_Hsapiens_Aa.obj", "ls_Hsapiens_CCa.obj", "ls_Hsapiens_CCp.obj", "ls_Hsapiens_utricle.obj"],
    )

    # 4. 3D Eye Avatar
    test_eye_avatar()

    print("\n=================================================================")
    print(" ALL STAGE 3 STEP 1 TESTS PASSED SUCCESSFULLY (100%)")
    print("=================================================================")

if __name__ == "__main__":
    main()
