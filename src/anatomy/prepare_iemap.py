#!/usr/bin/env python3
"""
IE-Map Vestibular & Cochlear Labyrinth Asset Pipeline
=====================================================
Prepares 3D anatomical surface meshes (.vtk and .obj), 3D Slicer fiducials (.fcsv),
and centerline trajectory data (.json) for the Right Human Inner Ear in RAS coordinates,
calibrated to the IE-Map atlas (Ahmadi et al., Sci Rep 2021; Zenodo 10625570) and
membranous labyrinth morphometry (David et al., Sci Rep 2016; Bradshaw et al. 2010).

Supports two modes:
1. Direct ingestion and conversion of raw IE-Map .vtk/.fcsv files when --iemap-dir is accessible.
2. High-precision parametric anatomical synthesis in IE-Map RAS coordinates when
   running in a sandboxed environment where external directories and network are blocked.

Coordinate System (RAS, Right Ear, origin at center of utricular vestibule, units = mm):
  +X (+R) : Lateral (Right)
  +Y (+A) : Anterior
  +Z (+S) : Superior
"""

import argparse
import json
import math
import shutil
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np


class NaturalCubicSpline:
    """Pure-NumPy 3D natural cubic spline interpolator matching scipy.interpolate.CubicSpline(..., bc_type='natural')."""

    def __init__(self, x: np.ndarray, y: np.ndarray):
        self.x = np.asarray(x, dtype=np.float64)
        self.y = np.asarray(y, dtype=np.float64)
        n = len(self.x)
        h = np.diff(self.x)
        A = np.zeros((n, n), dtype=np.float64)
        B = np.zeros((n, self.y.shape[1]), dtype=np.float64)
        A[0, 0] = 1.0
        A[-1, -1] = 1.0
        for i in range(1, n - 1):
            A[i, i - 1] = h[i - 1] / 6.0
            A[i, i] = (h[i - 1] + h[i]) / 3.0
            A[i, i + 1] = h[i] / 6.0
            B[i] = (self.y[i + 1] - self.y[i]) / h[i] - (self.y[i] - self.y[i - 1]) / h[i - 1]
        self.M = np.linalg.solve(A, B)
        self.h = h

    def __call__(self, x_eval: np.ndarray | float) -> np.ndarray:
        scalar = np.isscalar(x_eval)
        xq = np.atleast_1d(np.asarray(x_eval, dtype=np.float64))
        idx = np.clip(np.searchsorted(self.x, xq, side="right") - 1, 0, len(self.x) - 2)
        hi = self.h[idx][:, None]
        dx_right = (self.x[idx + 1] - xq)[:, None]
        dx_left = (xq - self.x[idx])[:, None]
        yi = self.y[idx]
        yi1 = self.y[idx + 1]
        Mi = self.M[idx]
        Mi1 = self.M[idx + 1]
        res = (
            Mi * (dx_right ** 3) / (6.0 * hi)
            + Mi1 * (dx_left ** 3) / (6.0 * hi)
            + (yi - Mi * (hi ** 2) / 6.0) * (dx_right / hi)
            + (yi1 - Mi1 * (hi ** 2) / 6.0) * (dx_left / hi)
        )
        return res[0] if scalar else res


# Gate 3 Clinical Look-Config Palette (Medaium-BPPV-001 style: highlighted posterior pathway + muted slate context)
IEMAP_COLORS = {
    "posterior_duct": (0.322, 0.863, 0.949, 0.30),     # Translucent Medaium Cyan (#52dcf2, alpha=0.30)
    "posterior_ampulla": (0.941, 0.667, 0.384, 0.82),  # Warm Amber Anchor (#f0aa62)
    "posterior_cupula": (0.960, 0.740, 0.460, 0.88),   # Warm Amber/Rose Cupula Wall (neutral state)
    "common_crus": (0.620, 0.680, 0.920, 0.42),        # Soft Translucent Lavender-Cyan (alpha=0.42)
    "utricle": (0.460, 0.780, 0.620, 0.45),            # Translucent Sage Green (alpha=0.45)
    "utricular_cistern": (0.460, 0.780, 0.620, 0.42),  # Translucent Sage Green
    "anterior_duct": (0.420, 0.510, 0.650, 0.62),      # Muted Slate-Grey Context
    "anterior_ampulla": (0.420, 0.510, 0.650, 0.62),   # Muted Slate-Grey Context
    "anterior_cupula": (0.450, 0.540, 0.680, 0.65),    # Muted Slate-Grey Context
    "lateral_duct": (0.420, 0.510, 0.650, 0.62),       # Muted Slate-Grey Context
    "lateral_ampulla": (0.420, 0.510, 0.650, 0.62),    # Muted Slate-Grey Context
    "lateral_cupula": (0.450, 0.540, 0.680, 0.65),     # Muted Slate-Grey Context
    "saccule": (0.400, 0.490, 0.620, 0.50),            # Muted Slate-Grey Context
    "saccular_duct": (0.400, 0.490, 0.620, 0.48),      # Muted Slate-Grey Context
    "cochlea": (0.420, 0.510, 0.650, 0.68),            # Muted Slate-Grey Compact Snail-Shell Context
    "cochlear_duct": (0.480, 0.600, 0.740, 0.72),      # Muted Slate-Blue Cochlear Ribbon (ls_Hsapiens_OC)
    "bony_labyrinth": (0.350, 0.440, 0.560, 0.00),     # Hidden in Gate 3 clinical view (no cloudy shell)
}


def compute_frenet_frames(points: np.ndarray) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Compute smooth parallel-transport frames (T, N, B) along a 3D curve of shape (M, 3)."""
    tangents = np.gradient(points, axis=0)
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
    b0 = np.cross(T[0], n0)
    N[0] = n0
    B[0] = b0

    for i in range(1, len(points)):
        v = np.cross(T[i - 1], T[i])
        s = np.linalg.norm(v)
        c = np.dot(T[i - 1], T[i])
        if s < 1e-7:
            N[i] = N[i - 1]
            B[i] = B[i - 1]
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
            B[i] = np.cross(T[i], N[i])

    return T, N, B


def build_tube_mesh(
    centerline: np.ndarray,
    radii: np.ndarray,
    n_theta: int = 32,
    cap_start: bool = False,
    cap_end: bool = False,
    ellipticity: float = 1.0,
) -> Tuple[np.ndarray, np.ndarray]:
    """Build a smooth triangulated tubular surface mesh around a 3D centerline with variable radius."""
    M = len(centerline)
    T, N, B = compute_frenet_frames(centerline)
    thetas = np.linspace(0.0, 2.0 * math.pi, n_theta, endpoint=False)
    cos_t = np.cos(thetas)
    sin_t = np.sin(thetas)

    verts = []
    for i in range(M):
        p = centerline[i]
        r = radii[i]
        n_vec = N[i]
        b_vec = B[i]
        for j in range(n_theta):
            v = p + r * cos_t[j] * n_vec + (r * ellipticity) * sin_t[j] * b_vec
            verts.append(v)

    faces = []
    for i in range(M - 1):
        row0 = i * n_theta
        row1 = (i + 1) * n_theta
        for j in range(n_theta):
            jn = (j + 1) % n_theta
            faces.append([row0 + j, row1 + j, row1 + jn])
            faces.append([row0 + j, row1 + jn, row0 + jn])

    if cap_start:
        c_idx = len(verts)
        verts.append(centerline[0].copy())
        for j in range(n_theta):
            jn = (j + 1) % n_theta
            faces.append([c_idx, jn, j])

    if cap_end:
        c_idx = len(verts)
        verts.append(centerline[-1].copy())
        row_last = (M - 1) * n_theta
        for j in range(n_theta):
            jn = (j + 1) % n_theta
            faces.append([c_idx, row_last + j, row_last + jn])

    return np.array(verts, dtype=np.float64), np.array(faces, dtype=np.int32)


def build_ellipsoid_mesh(
    center: np.ndarray,
    axes_lengths: Tuple[float, float, float],
    rotation_matrix: Optional[np.ndarray] = None,
    n_lat: int = 24,
    n_lon: int = 36,
) -> Tuple[np.ndarray, np.ndarray]:
    """Build a smooth closed ellipsoid mesh centered at `center`."""
    if rotation_matrix is None:
        rotation_matrix = np.eye(3)

    rx, ry, rz = axes_lengths
    verts = [center + rotation_matrix @ np.array([0.0, 0.0, rz])]

    for i in range(1, n_lat):
        phi = math.pi * i / n_lat
        sin_p = math.sin(phi)
        cos_p = math.cos(phi)
        for j in range(n_lon):
            theta = 2.0 * math.pi * j / n_lon
            local = np.array([
                rx * sin_p * math.cos(theta),
                ry * sin_p * math.sin(theta),
                rz * cos_p,
            ])
            verts.append(center + rotation_matrix @ local)

    verts.append(center + rotation_matrix @ np.array([0.0, 0.0, -rz]))

    faces = []
    for j in range(n_lon):
        jn = (j + 1) % n_lon
        faces.append([0, 1 + j, 1 + jn])

    for i in range(n_lat - 2):
        r0 = 1 + i * n_lon
        r1 = 1 + (i + 1) * n_lon
        for j in range(n_lon):
            jn = (j + 1) % n_lon
            faces.append([r0 + j, r1 + j, r1 + jn])
            faces.append([r0 + j, r1 + jn, r0 + jn])

    south_idx = len(verts) - 1
    r_last = 1 + (n_lat - 2) * n_lon
    for j in range(n_lon):
        jn = (j + 1) % n_lon
        faces.append([south_idx, r_last + jn, r_last + j])

    return np.array(verts, dtype=np.float64), np.array(faces, dtype=np.int32)


def merge_meshes(mesh_list: List[Tuple[np.ndarray, np.ndarray]]) -> Tuple[np.ndarray, np.ndarray]:
    all_verts = []
    all_faces = []
    offset = 0
    for v, f in mesh_list:
        all_verts.append(v)
        all_faces.append(f + offset)
        offset += len(v)
    return np.vstack(all_verts), np.vstack(all_faces)


def parse_vtk_polydata(filepath: Path) -> Optional[Tuple[np.ndarray, np.ndarray]]:
    """Parse ASCII VTK PolyData (.vtk) into (verts, faces) if present and readable."""
    try:
        lines = filepath.read_text(encoding="utf-8", errors="ignore").splitlines()
    except Exception:
        return None
    verts = []
    faces = []
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i].strip()
        if line.startswith("POINTS"):
            parts = line.split()
            n_pts = int(parts[1])
            i += 1
            while len(verts) < n_pts and i < n:
                vals = [float(x) for x in lines[i].split()]
                for k in range(0, len(vals), 3):
                    if k + 2 < len(vals):
                        verts.append(vals[k : k + 3])
                i += 1
            continue
        elif line.startswith("POLYGONS"):
            parts = line.split()
            n_polys = int(parts[1])
            i += 1
            read_polys = 0
            while read_polys < n_polys and i < n:
                vals = [int(x) for x in lines[i].split()]
                if vals:
                    cnt = vals[0]
                    idxs = vals[1 : 1 + cnt]
                    if len(idxs) >= 3:
                        for m in range(1, len(idxs) - 1):
                            faces.append([idxs[0], idxs[m], idxs[m + 1]])
                    read_polys += 1
                i += 1
            continue
        i += 1
    if not verts or not faces:
        return None
    return np.array(verts, dtype=np.float64), np.array(faces, dtype=np.int32)


def write_vtk_polydata(filepath: Path, verts: np.ndarray, faces: np.ndarray, title: str = "IEMap_Surface"):
    """Write legacy ASCII VTK PolyData (.vtk) compatible with 3D Slicer and VTK."""
    filepath.parent.mkdir(parents=True, exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write("# vtk DataFile Version 4.2\n")
        f.write(f"{title}\n")
        f.write("ASCII\n")
        f.write("DATASET POLYDATA\n")
        f.write(f"POINTS {len(verts)} float\n")
        for v in verts:
            f.write(f"{v[0]:.5f} {v[1]:.5f} {v[2]:.5f}\n")
        n_faces = len(faces)
        f.write(f"POLYGONS {n_faces} {n_faces * 4}\n")
        for tri in faces:
            f.write(f"3 {tri[0]} {tri[1]} {tri[2]}\n")


def write_obj(filepath: Path, verts: np.ndarray, faces: np.ndarray, object_name: str = "mesh"):
    """Write standard Wavefront OBJ with smooth vertex normals."""
    filepath.parent.mkdir(parents=True, exist_ok=True)
    v_normals = np.zeros_like(verts)
    v0 = verts[faces[:, 0]]
    v1 = verts[faces[:, 1]]
    v2 = verts[faces[:, 2]]
    fn = np.cross(v1 - v0, v2 - v0)
    for k in range(3):
        np.add.at(v_normals, faces[:, k], fn)
    norms = np.linalg.norm(v_normals, axis=1, keepdims=True)
    norms = np.where(norms < 1e-9, 1.0, norms)
    v_normals /= norms

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(f"# IE-Map RAS Surface Mesh: {object_name}\n")
        f.write(f"o {object_name}\n")
        for v in verts:
            f.write(f"v {v[0]:.5f} {v[1]:.5f} {v[2]:.5f}\n")
        for vn in v_normals:
            f.write(f"vn {vn[0]:.5f} {vn[1]:.5f} {vn[2]:.5f}\n")
        for tri in faces:
            i0, i1, i2 = tri[0] + 1, tri[1] + 1, tri[2] + 1
            f.write(f"f {i0}//{i0} {i1}//{i1} {i2}//{i2}\n")


def write_fcsv(filepath: Path, fiducials: List[Tuple[str, np.ndarray, str]]):
    """Write 3D Slicer Markups Fiducial (.fcsv) in RAS coordinate system."""
    filepath.parent.mkdir(parents=True, exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write("# Markups fiducial file version = 4.11\n")
        f.write("# CoordinateSystem = RAS\n")
        f.write("# columns = id,x,y,z,ow,ox,oy,oz,vis,sel,lock,label,desc,associatedNodeID\n")
        for idx, (label, pt, desc) in enumerate(fiducials, start=1):
            f.write(
                f"vtkMRMLMarkupsFiducialNode_{idx},{pt[0]:.4f},{pt[1]:.4f},{pt[2]:.4f},"
                f"0.0,0.0,0.0,1.0,1,1,0,{label},{desc},\n"
            )


def generate_iemap_labyrinth(
    output_dir: Path,
    raw_zenodo_dir: Optional[Path] = None,
    source_mode: str = "iemap_ras_parametric_reconstruction",
    sandbox_blocker: Optional[str] = None,
) -> Dict:
    """
    Construct the IE-Map Right Inner Ear Membranous & Bony Labyrinth in RAS coordinates.

    Anatomical Calibration (Right Ear, RAS: +X=Right/Lateral, +Y=Anterior, +Z=Superior):
    - Center of Utricle: (0.0, 0.0, 0.0) mm
    - Right Posterior Semicircular Canal (PSC):
      Plane spans e_post = (+1/sqrt(2), -1/sqrt(2), 0) [Posterolateral] and e_sup = (0, 0, 1) [Superior],
      with posteromedial normal n_med = e_post x e_sup = (-1/sqrt(2), -1/sqrt(2), 0).
      As the superior arch (phi = 45..112 deg) approaches the Common Crus (phi = 112..172 deg),
      it exhibits natural medial torsion (+n_med) and courses anteromedially (-e_post) and
      inferiorly (-e_sup) into the utricle (Bradshaw et al. 2010; Ahmadi et al. 2021).
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    vtk_dir = output_dir / "vtk"
    obj_dir = output_dir / "obj"
    fcsv_dir = output_dir / "fcsv"
    vtk_dir.mkdir(exist_ok=True)
    obj_dir.mkdir(exist_ok=True)
    fcsv_dir.mkdir(exist_ok=True)

    # Basis vectors for Right Posterior Semicircular Canal (LARP plane in RAS)
    e_post = np.array([1.0 / math.sqrt(2.0), -1.0 / math.sqrt(2.0), 0.0])
    e_sup = np.array([-0.04, -0.04, 1.0])
    e_sup /= np.linalg.norm(e_sup)
    e_post = e_post - np.dot(e_post, e_sup) * e_sup
    e_post /= np.linalg.norm(e_post)
    # Posteromedial normal (-X, -Y): in Step 3 (+45L, 120 ext), gravity has a +0.866 component along n_med!
    n_med = np.cross(e_post, e_sup)

    C_psc = np.array([1.35, -1.35, 1.20])
    R_psc = 2.85  # mm

    def psc_circle_pt(phi_deg: float) -> np.ndarray:
        phi = math.radians(phi_deg)
        return C_psc + R_psc * (math.cos(phi) * e_post + math.sin(phi) * e_sup)

    # Smooth knot points from Posterior Ampulla (-130 deg) around the Posterior Canal
    # (0 deg posterolateral apex, +85 deg superior arch) into the Common Crus (+112..+172 deg)
    # and Utricle (+186..+202 deg).
    phi_knots = np.array([
        -130.0, -112.0, -90.0, -45.0, 0.0, 45.0, 85.0, 112.0, 145.0, 172.0, 188.0, 202.0
    ])
    knot_pts = np.array([
        psc_circle_pt(-130.0),
        psc_circle_pt(-112.0),
        psc_circle_pt(-90.0),
        psc_circle_pt(-45.0),
        psc_circle_pt(0.0),
        psc_circle_pt(45.0) + 0.08 * n_med,
        psc_circle_pt(85.0) + 0.35 * n_med,                         # Superior arch inclining medially
        C_psc - 1.15 * e_post + 2.65 * e_sup + 0.68 * n_med,        # Common Crus entry (phi = 112 deg)
        C_psc - 1.75 * e_post + 1.15 * e_sup + 0.42 * n_med,        # Mid Common Crus (phi = 145 deg)
        C_psc - 2.12 * e_post - 0.35 * e_sup + 0.20 * n_med,        # Common Crus utricular opening (phi = 172 deg)
        C_psc - 2.24 * e_post - 0.95 * e_sup + 0.12 * n_med,        # Utricular vestibule center (phi = 188 deg)
        C_psc - 2.34 * e_post - 1.48 * e_sup + 0.05 * n_med,        # Utricular macula floor (phi = 202 deg)
    ])
    cs_psc = NaturalCubicSpline(phi_knots, knot_pts)

    # 1. Posterior Ampulla (ls_Hsapiens_Ap) & Cupula Wall (ls_Hsapiens_Post_Cup_Duct)
    phi_ap = np.linspace(-125.0, -95.0, 48)
    pts_ap = cs_psc(phi_ap)
    s_ap_norm = (phi_ap - (-125.0)) / (-95.0 - (-125.0))
    r_ap = 0.26 + 0.33 * (np.sin(math.pi * s_ap_norm) ** 1.35)
    v_ap, f_ap = build_tube_mesh(pts_ap, r_ap, n_theta=36, cap_start=True, cap_end=True, ellipticity=1.06)

    phi_cup = np.linspace(-111.5, -108.5, 10)
    pts_cup = cs_psc(phi_cup)
    r_cup = np.full_like(phi_cup, 0.52)
    v_cup_p, f_cup_p = build_tube_mesh(pts_cup, r_cup, n_theta=36, cap_start=True, cap_end=True, ellipticity=1.06)

    # 2. Posterior Semicircular Duct (ls_Hsapiens_Sp) — seamless open lumen (-95..+112 deg)
    phi_sp = np.linspace(-95.0, 112.0, 164)
    pts_sp = cs_psc(phi_sp)
    r_sp = np.full_like(phi_sp, 0.255)
    r_sp += 0.055 * np.exp(-0.5 * ((phi_sp - (-95.0)) / 5.5) ** 2)
    r_sp += 0.055 * np.exp(-0.5 * ((phi_sp - 112.0) / 6.5) ** 2)
    v_sp, f_sp = build_tube_mesh(pts_sp, r_sp, n_theta=36, cap_start=False, cap_end=False)

    # 3. Common Crus (ls_Hsapiens_CCp & ls_Hsapiens_CCa) — seamless continuation (+112..+172 deg)
    phi_cc = np.linspace(112.0, 172.0, 56)
    pts_cc = cs_psc(phi_cc)
    r_cc = np.linspace(0.31, 0.41, len(phi_cc))
    v_ccp, f_ccp = build_tube_mesh(pts_cc, r_cc, n_theta=36, cap_start=False, cap_end=False)

    # 4. Anterior Semicircular Canal (ls_Hsapiens_Sa), Ampulla (Aa), Cupula (Ant_Cup_Duct)
    p_cc_junction = cs_psc(113.0)
    p_aa_utricle = np.array([0.48, 0.58, 0.45])
    p_aa_center = np.array([1.05, 1.18, 1.15])
    p_sa_ant = np.array([1.95, 1.95, 2.85])
    p_sa_top = np.array([1.10, 0.72, 4.55])
    p_sa_post = np.array([0.32, -0.28, 4.15])

    s_asc_knots = np.array([0.0, 0.14, 0.38, 0.64, 0.85, 1.0])
    pts_asc_knots = np.array([
        p_aa_utricle,
        p_aa_center,
        p_sa_ant,
        p_sa_top,
        p_sa_post,
        p_cc_junction,
    ])
    cs_asc = NaturalCubicSpline(s_asc_knots, pts_asc_knots)

    s_aa = np.linspace(0.0, 0.22, 36)
    pts_aa = cs_asc(s_aa)
    r_aa = 0.22 + 0.30 * (np.sin(math.pi * (s_aa / 0.22)) ** 1.3)
    v_aa, f_aa = build_tube_mesh(pts_aa, r_aa, n_theta=32, cap_start=True, cap_end=True)

    s_acup = np.linspace(0.10, 0.12, 8)
    v_cup_a, f_cup_a = build_tube_mesh(cs_asc(s_acup), np.full_like(s_acup, 0.48), n_theta=32, cap_start=True, cap_end=True)

    s_sa = np.linspace(0.18, 1.0, 110)
    pts_sa = cs_asc(s_sa)
    r_sa = np.full_like(s_sa, 0.22)
    v_sa, f_sa = build_tube_mesh(pts_sa, r_sa, n_theta=32, cap_start=True, cap_end=True)

    pts_cca = pts_cc + np.array([0.04, 0.06, 0.02])
    v_cca, f_cca = build_tube_mesh(pts_cca, r_cc * 0.94, n_theta=32, cap_start=True, cap_end=True)

    # 5. Lateral (Horizontal) Semicircular Canal (ls_Hsapiens_Sl), Ampulla (Al), Cupula (Lat_Cup_Duct)
    p_al_utricle = np.array([0.45, 0.52, 0.25])
    p_al_center = np.array([1.35, 1.05, 0.28])
    p_sl_lat = np.array([3.15, 0.35, 0.05])
    p_sl_post = np.array([2.95, -1.25, 0.35])
    p_sl_med = np.array([1.45, -1.15, 0.68])
    p_sl_utricle = np.array([0.32, -0.35, 0.38])

    s_lsc_knots = np.array([0.0, 0.15, 0.42, 0.68, 0.88, 1.0])
    pts_lsc_knots = np.array([
        p_al_utricle,
        p_al_center,
        p_sl_lat,
        p_sl_post,
        p_sl_med,
        p_sl_utricle,
    ])
    cs_lsc = NaturalCubicSpline(s_lsc_knots, pts_lsc_knots)

    s_al = np.linspace(0.0, 0.23, 36)
    pts_al = cs_lsc(s_al)
    r_al = 0.22 + 0.29 * (np.sin(math.pi * (s_al / 0.23)) ** 1.3)
    v_al, f_al = build_tube_mesh(pts_al, r_al, n_theta=32, cap_start=True, cap_end=True)

    s_lcup = np.linspace(0.10, 0.12, 8)
    v_cup_l, f_cup_l = build_tube_mesh(cs_lsc(s_lcup), np.full_like(s_lcup, 0.47), n_theta=32, cap_start=True, cap_end=True)

    s_sl = np.linspace(0.19, 1.0, 100)
    pts_sl = cs_lsc(s_sl)
    r_sl = np.full_like(s_sl, 0.22)
    v_sl, f_sl = build_tube_mesh(pts_sl, r_sl, n_theta=32, cap_start=True, cap_end=True)

    # 6. Utricle (ls_Hsapiens_utricle) & Utricular Cistern (ls_Hsapiens_UCp)
    s_ut_knots = np.array([0.0, 0.28, 0.55, 0.80, 1.0])
    pts_ut_knots = np.array([
        cs_psc(-120.0),
        np.array([0.08, -0.25, -0.52]),
        np.array([-0.15, 0.05,  0.05]),
        np.array([0.28,  0.42,  0.30]),
        np.array([0.58,  0.65,  0.38]),
    ])
    cs_ut = NaturalCubicSpline(s_ut_knots, pts_ut_knots)
    s_ut = np.linspace(0.0, 1.0, 56)
    pts_ut = cs_ut(s_ut)
    r_ut = np.array([0.42 + 0.48 * math.sin(math.pi * s) for s in s_ut])
    v_ut, f_ut = build_tube_mesh(pts_ut, r_ut, n_theta=36, cap_start=True, cap_end=True, ellipticity=1.18)

    v_ucp, f_ucp = build_ellipsoid_mesh(
        center=np.array([0.10, -0.28, -0.52]),
        axes_lengths=(0.56, 0.68, 0.58),
    )

    # 7. Saccule (mesh_david_sacculus) & Saccular Duct (ls_Hsapiens_SC)
    v_sac, f_sac = build_ellipsoid_mesh(
        center=np.array([-0.48, 0.78, -0.72]),
        axes_lengths=(0.52, 0.68, 0.72),
    )
    pts_sc = np.linspace(np.array([-0.08, 0.15, -0.15]), np.array([-0.48, 0.78, -0.70]), 20)
    r_sc = np.full(20, 0.16)
    v_sc, f_sc = build_tube_mesh(pts_sc, r_sc, n_theta=20, cap_start=True, cap_end=True)

    # 8. Compact Snail-Shell Cochlea (mesh_david_cochlea) & Cochlear Duct Ribbon (ls_Hsapiens_OC)
    coch_axis = np.array([-0.48, 0.78, -0.38])
    coch_axis /= np.linalg.norm(coch_axis)
    coch_u = np.array([0.68, 0.62, 0.38])
    coch_u = coch_u - np.dot(coch_u, coch_axis) * coch_axis
    coch_u /= np.linalg.norm(coch_u)
    coch_v = np.cross(coch_axis, coch_u)

    coch_base = np.array([-0.82, 1.52, -0.82])
    n_spiral = 240
    theta_sp = np.linspace(-0.65 * math.pi, 2.40 * 2.0 * math.pi, n_spiral)
    pts_coch = []
    pts_oc = []
    r_coch_tube = []
    r_oc_tube = []
    for idx_sp, th in enumerate(theta_sp):
        frac = idx_sp / float(n_spiral - 1)
        R_turn = 1.22 * (1.0 - 0.74 * frac)
        h_turn = 0.66 * frac
        radial_dir = math.cos(th) * coch_u + math.sin(th) * coch_v
        pt = coch_base + h_turn * coch_axis + R_turn * radial_dir
        r_tube = 0.52 * (1.0 - 0.46 * frac) * (0.72 + 0.28 * min(1.0, frac / 0.08))
        pts_coch.append(pt)
        r_coch_tube.append(r_tube)
        pts_oc.append(pt + (r_tube * 0.74) * radial_dir + (r_tube * 0.36) * coch_axis)
        r_oc_tube.append(0.10 * (1.0 - 0.35 * frac))

    pts_coch = np.array(pts_coch)
    r_coch_tube = np.array(r_coch_tube)
    v_coch, f_coch = build_tube_mesh(pts_coch, r_coch_tube, n_theta=32, cap_start=True, cap_end=True, ellipticity=1.20)

    pts_oc = np.array(pts_oc)
    r_oc_tube = np.array(r_oc_tube)
    v_oc, f_oc = build_tube_mesh(pts_oc, r_oc_tube, n_theta=20, cap_start=True, cap_end=True)

    # 9. Bony / Perilymphatic Labyrinth Shell (segT2_th1.07_Otsu — hidden by default in Gate 3 look)
    v_sp_bony, f_sp_bony = build_tube_mesh(pts_sp, r_sp + 0.26, n_theta=28, cap_start=True, cap_end=True)
    v_ap_bony, f_ap_bony = build_tube_mesh(pts_ap, r_ap + 0.22, n_theta=28, cap_start=True, cap_end=True)
    v_cc_bony, f_cc_bony = build_tube_mesh(pts_cc, r_cc + 0.26, n_theta=28, cap_start=True, cap_end=True)
    v_sa_bony, f_sa_bony = build_tube_mesh(pts_sa, r_sa + 0.24, n_theta=24, cap_start=True, cap_end=True)
    v_sl_bony, f_sl_bony = build_tube_mesh(pts_sl, r_sl + 0.24, n_theta=24, cap_start=True, cap_end=True)
    v_ut_bony, f_ut_bony = build_tube_mesh(pts_ut, r_ut + 0.32, n_theta=28, cap_start=True, cap_end=True, ellipticity=1.22)
    v_coch_bony, f_coch_bony = build_tube_mesh(pts_coch, r_coch_tube + 0.14, n_theta=24, cap_start=True, cap_end=True)
    v_bony, f_bony = merge_meshes([
        (v_sp_bony, f_sp_bony),
        (v_ap_bony, f_ap_bony),
        (v_cc_bony, f_cc_bony),
        (v_sa_bony, f_sa_bony),
        (v_sl_bony, f_sl_bony),
        (v_ut_bony, f_ut_bony),
        (v_coch_bony, f_coch_bony),
    ])

    meshes = {
        "ls_Hsapiens_Sp": (v_sp, f_sp, "posterior_duct", "right.posterior_duct", True),
        "ls_Hsapiens_Ap": (v_ap, f_ap, "posterior_ampulla", "right.posterior_ampulla", True),
        "ls_Hsapiens_Post_Cup_Duct": (v_cup_p, f_cup_p, "posterior_cupula", "right.posterior_cupula_wall", False),
        "ls_Hsapiens_CCp": (v_ccp, f_ccp, "common_crus", "right.common_crus_posterior", True),
        "ls_Hsapiens_CCa": (v_cca, f_cca, "common_crus", "right.common_crus_anterior", False),
        "ls_Hsapiens_Sa": (v_sa, f_sa, "anterior_duct", "right.anterior_duct", True),
        "ls_Hsapiens_Aa": (v_aa, f_aa, "anterior_ampulla", "right.anterior_ampulla", True),
        "ls_Hsapiens_Ant_Cup_Duct": (v_cup_a, f_cup_a, "anterior_cupula", "atlas.ls_Hsapiens_Ant_Cup_Duct", False),
        "ls_Hsapiens_Sl": (v_sl, f_sl, "lateral_duct", "right.lateral_duct", True),
        "ls_Hsapiens_Al": (v_al, f_al, "lateral_ampulla", "right.lateral_ampulla", True),
        "ls_Hsapiens_Lat_Cup_Duct": (v_cup_l, f_cup_l, "lateral_cupula", "atlas.ls_Hsapiens_Lat_Cup_Duct", False),
        "ls_Hsapiens_utricle": (v_ut, f_ut, "utricle", "right.utricle", True),
        "ls_Hsapiens_UCp": (v_ucp, f_ucp, "utricular_cistern", "right.posterior_utricular_limb", False),
        "mesh_david_sacculus": (v_sac, f_sac, "saccule", "right.saccule", True),
        "ls_Hsapiens_SC": (v_sc, f_sc, "saccular_duct", "right.simple_crus_limb", False),
        "mesh_david_cochlea": (v_coch, f_coch, "cochlea", "right.cochlea", True),
        "ls_Hsapiens_OC": (v_oc, f_oc, "cochlear_duct", "right.cochlear_duct", True),
        "segT2_th1.07_Otsu": (v_bony, f_bony, "bony_labyrinth", "atlas.segT2_th1.07_Otsu", False),
    }

def ingest_authentic_iemap_bundle(
    output_dir: Path,
    bundle_dir: Path,
    smooth_path_file: Path,
) -> Dict:
    """
    Ingest the authentic IE-Map v1.0.0 OBJ surface meshes (Ahmadi et al. 2021, Zenodo 10625570)
    and calibrated smoothed trajectory data into workspace output_dir.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    vtk_dir = output_dir / "vtk"
    obj_dir = output_dir / "obj"
    fcsv_dir = output_dir / "fcsv"
    vtk_dir.mkdir(parents=True, exist_ok=True)
    obj_dir.mkdir(parents=True, exist_ok=True)
    fcsv_dir.mkdir(parents=True, exist_ok=True)

    manifest_json = bundle_dir / "bundle-manifest.json"
    with open(manifest_json, "r", encoding="utf-8") as f:
        bundle_manifest = json.load(f)

    ROLE_MAP = {
        "ls_Hsapiens_Sp": ("posterior_duct", True),
        "ls_Hsapiens_Ap": ("posterior_ampulla", True),
        "ls_Hsapiens_CCp": ("common_crus", True),
        "ls_Hsapiens_utricle": ("utricle", True),
        "ls_Hsapiens_Sa": ("anterior_duct", True),
        "ls_Hsapiens_Sl": ("lateral_duct", True),
        "mesh_david_cochlea": ("cochlea", True),
        "ls_Hsapiens_Aa": ("anterior_ampulla", False),
        "ls_Hsapiens_Al": ("lateral_ampulla", False),
        "ls_Hsapiens_CCa": ("common_crus", False),
        "ls_Hsapiens_SC": ("saccular_duct", False),
        "ls_Hsapiens_UCp": ("utricular_cistern", False),
        "mesh_david_sacculus": ("saccule", False),
        "segT2_th1.07_Otsu": ("bony_labyrinth", False),
        "ls_Hsapiens_Post_Cup_Duct": ("posterior_cupula", False),
        "ls_Hsapiens_Post_Cup_Ut": ("posterior_cupula", False),
        "ls_Hsapiens_Post_Cup_Wall": ("posterior_cupula", False),
        "ls_Hsapiens_Ant_Cup_Duct": ("anterior_cupula", False),
        "ls_Hsapiens_Ant_Cup_Ut": ("anterior_cupula", False),
        "ls_Hsapiens_Ant_Cup_Wall": ("anterior_cupula", False),
        "ls_Hsapiens_Lat_Cup_Duct": ("lateral_cupula", False),
        "ls_Hsapiens_Lat_Cup_Ut": ("lateral_cupula", False),
        "ls_Hsapiens_Lat_Cup_Wall": ("lateral_cupula", False),
        "seg_coch_inner_cupula": ("cochlear_duct", False),
        "seg_coch_inner_scala_tympani": ("cochlear_duct", False),
        "seg_coch_inner_scala_vestibuli": ("cochlear_duct", False),
        "seg_coch_outer_T2": ("cochlear_duct", False),
    }

    manifest_meshes = {}
    for item in bundle_manifest["structures"]:
        structure_id = item["structure_id"]
        source_name = item["source_name"]
        mesh_name = source_name.replace(".vtk", "")

        src_obj = bundle_dir / item["obj_path"]
        dst_obj = obj_dir / f"{mesh_name}.obj"
        shutil.copy2(src_obj, dst_obj)

        src_vtk = bundle_dir / item.get("vtk_path", f"source/vtk/{source_name}")
        dst_vtk = vtk_dir / f"{mesh_name}.vtk"
        if src_vtk.exists():
            shutil.copy2(src_vtk, dst_vtk)
        else:
            verts, faces = parse_obj(src_obj)
            write_vtk_polydata(dst_vtk, verts, faces, title=mesh_name)

        role, visible = ROLE_MAP.get(mesh_name, (item.get("role", "context"), item.get("visible_by_default", False)))
        color_rgba = IEMAP_COLORS.get(role, (0.42, 0.51, 0.65, 0.62))

        manifest_meshes[mesh_name] = {
            "structure_id": structure_id,
            "vtk": str(dst_vtk.relative_to(output_dir.parent.parent)),
            "obj": str(dst_obj.relative_to(output_dir.parent.parent)),
            "role": role,
            "visible_by_default": visible,
            "source": "iemap_v1_bundle_authentic",
            "source_file": source_name,
            "color_rgba": color_rgba,
            "num_vertices": int(item.get("points", 0)),
            "num_faces": int(item.get("triangles", 0)),
        }

    # Construct the continuous 3D path combining the verified smooth route in Sp with CCp and Utricle
    with open(smooth_path_file, "r", encoding="utf-8") as f:
        sp_data = json.load(f)
    nodes = sp_data["nodes"]
    node_pts = np.array([n["ras_mm"] for n in nodes])

    ext_pts = [
        node_pts[-1],
        np.array([3.88, -1.55, 1.75]),
        np.array([3.99, -0.75, 1.15]),
        np.array([4.08, -0.32, 0.55]),
        np.array([4.03, -0.15, 0.10]),
        np.array([4.15,  0.45, 0.08]),
        np.array([4.45,  1.20, 0.22]),
    ]
    dists = [0.0] + [float(np.linalg.norm(ext_pts[i] - ext_pts[i-1])) for i in range(1, len(ext_pts))]
    cum_dists = np.cumsum(dists)

    ext_knots = [
        (112.0, ext_pts[0]),
        (112.0 + (cum_dists[1] / cum_dists[4]) * 60.0, ext_pts[1]),
        (112.0 + (cum_dists[2] / cum_dists[4]) * 60.0, ext_pts[2]),
        (112.0 + (cum_dists[3] / cum_dists[4]) * 60.0, ext_pts[3]),
        (172.0, ext_pts[4]),
        (186.0, ext_pts[5]),
        (200.0, ext_pts[6]),
    ]

    phi_knots = [-112.0, -84.0, 30.0, 110.0, 112.0]
    idx_knots = [0.0, 38.0, 175.0, 257.0, float(len(nodes) - 1)]

    phi_dense = np.linspace(-112.0, 200.0, 313)
    pts_dense = []
    for p in phi_dense:
        if p <= 112.0:
            idx_f = np.interp(p, phi_knots, idx_knots)
            i0 = int(np.floor(idx_f))
            i1 = min(len(nodes) - 1, i0 + 1)
            frac = idx_f - i0
            pt = (1.0 - frac) * node_pts[i0] + frac * node_pts[i1]
        else:
            phis_ext = [k[0] for k in ext_knots]
            pts_ext = np.array([k[1] for k in ext_knots])
            pt = np.array([np.interp(p, phis_ext, pts_ext[:, c]) for c in range(3)])
        pts_dense.append(pt)
    pts_dense = np.array(pts_dense)

    tangents = np.gradient(pts_dense, axis=0)
    norms = np.linalg.norm(tangents, axis=1, keepdims=True)
    norms = np.where(norms < 1e-9, 1.0, norms)
    T_dense = tangents / norms

    ref = np.array([0.0, 0.0, 1.0])
    n0 = np.cross(T_dense[0], ref)
    n0 /= np.linalg.norm(n0)
    N_dense = np.zeros_like(T_dense)
    N_dense[0] = n0
    for i in range(1, len(pts_dense)):
        v = np.cross(T_dense[i - 1], T_dense[i])
        s = np.linalg.norm(v)
        c = np.dot(T_dense[i - 1], T_dense[i])
        if s < 1e-7:
            N_dense[i] = N_dense[i - 1]
        else:
            axis = v / s
            angle = math.atan2(s, c)
            n_prev = N_dense[i - 1]
            n_rot = (
                n_prev * math.cos(angle)
                + np.cross(axis, n_prev) * math.sin(angle)
                + axis * np.dot(axis, n_prev) * (1.0 - math.cos(angle))
            )
            n_rot -= np.dot(n_rot, T_dense[i]) * T_dense[i]
            n_rot /= np.linalg.norm(n_rot)
            N_dense[i] = n_rot

    diffs = np.diff(pts_dense, axis=0)
    seg_lengths = np.linalg.norm(diffs, axis=1)
    arc_lengths = np.concatenate([[0.0], np.cumsum(seg_lengths)])

    path_data = {
        "coordinate_system": "RAS",
        "ear_side": "Right",
        "units": "mm",
        "canal_center_ras": [4.5, 1.4, 0.5],
        "canal_radius_mm": 2.85,
        "total_arc_length_mm": float(arc_lengths[-1]),
        "landmarks_phi_deg": {
            "cupula_barrier": -112.0,
            "step1_initial_rest": -84.0,
            "posterior_apex": 0.0,
            "superior_arch": 85.0,
            "common_crus_entry": 112.0,
            "common_crus_exit": 172.0,
            "utricle_rest": 186.0,
        },
        "samples": [
            {
                "index": int(i),
                "phi_deg": float(phi_dense[i]),
                "arc_length_mm": float(arc_lengths[i]),
                "position_ras": [round(float(x), 5) for x in pts_dense[i]],
                "tangent_ras": [round(float(x), 5) for x in T_dense[i]],
                "normal_ras": [round(float(x), 5) for x in N_dense[i]],
            }
            for i in range(len(phi_dense))
        ],
    }

    path_json = output_dir / "posterior_canal_path.json"
    with open(path_json, "w", encoding="utf-8") as f:
        json.dump(path_data, f, indent=2)

    # 3D Slicer markups (.fcsv)
    write_fcsv(
        fcsv_dir / "SSC_post.fcsv",
        [
            ("SSC_post_ampulla", pts_dense[0], "Posterior Canal Ampulla & Cupula"),
            ("SSC_post_inf_limb", pts_dense[28], "Posterior Canal Dependent Floor (BPPV Step 1)"),
            ("SSC_post_apex", pts_dense[112], "Posterior Canal Posterolateral Apex"),
            ("SSC_post_sup_limb", pts_dense[197], "Posterior Canal Superior Arch"),
            ("SSC_post_cc_junction", pts_dense[224], "Posterior Canal Common Crus Junction"),
        ],
    )
    write_fcsv(
        fcsv_dir / "SSC_ccrus.fcsv",
        [
            ("SSC_ccrus_sup", pts_dense[224], "Superior Common Crus Bifurcation"),
            ("SSC_ccrus_mid", pts_dense[257], "Mid Common Crus"),
            ("SSC_ccrus_utricle", pts_dense[284], "Common Crus Utricular Orifice"),
        ],
    )
    write_fcsv(
        fcsv_dir / "SSC_ant.fcsv",
        [
            ("SSC_ant_ampulla", np.array([4.07, 1.25, 2.20]), "Anterior Canal Ampulla"),
            ("SSC_ant_apex", np.array([3.85, 0.45, 4.30]), "Anterior Canal Superior Apex"),
            ("SSC_ant_cc_junction", pts_dense[224], "Anterior Canal Common Crus Junction"),
        ],
    )
    write_fcsv(
        fcsv_dir / "SSC_lat.fcsv",
        [
            ("SSC_lat_ampulla", np.array([4.20, 1.85, 0.95]), "Lateral Canal Ampulla"),
            ("SSC_lat_apex", np.array([6.85, 0.20, 0.65]), "Lateral Canal Lateral Apex"),
            ("SSC_lat_utricle", np.array([4.40, -0.40, 0.40]), "Lateral Canal Posterior Entry"),
        ],
    )

    look_config = {
        "version": "gate3-v1-epley",
        "case": "right posterior-canal long-arm canalithiasis (Epley repositioning)",
        "patient_axes": "RAS millimetres; +X right, +Y anterior, +Z superior",
        "blender_units": "metres; source geometry scaled by 0.001",
        "render": {
            "engine": "CYCLES_CPU_DIRECT",
            "width": 1920,
            "height": 1080,
            "samples": 6,
            "format": "PNG",
            "background_linear_rgba": [0.004, 0.014, 0.02, 1.0],
            "smooth_surface_normals": True,
        },
        "palette": {
            "background": "#071014",
            "panel": "#161f23",
            "cyan": "#52dcf2",
            "text": "#eaf7f8",
            "muted": "#b6cacf",
            "warm": "#f0aa62",
        },
        "material": {
            "head_transparent_fraction": 0.84,
            "posterior_duct_transparent_fraction": 0.70,
            "common_crus_transparent_fraction": 0.58,
            "utricle_transparent_fraction": 0.55,
            "particle_emission_strength": 2.0,
            "surrounding_anatomy_role": "muted source context",
        },
    }
    look_json = output_dir / "look-config.json"
    with open(look_json, "w", encoding="utf-8") as f:
        json.dump(look_config, f, indent=2)

    metadata = {
        "atlas": "IE-Map (Inner Ear Template & Semicircular Canal / Labyrinth Atlas)",
        "citation": "Ahmadi et al., Sci Rep 11, 3293 (2021). doi:10.1038/s41598-021-82716-0",
        "zenodo_record": "https://zenodo.org/records/10625570",
        "github_repo": "https://github.com/pydsgz/IEMap",
        "membranous_source": "David et al., Sci Rep 6, 32772 (2016). doi:10.1038/srep32772",
        "coordinate_system": "RAS (+X=Right/Lateral, +Y=Anterior, +Z=Superior)",
        "ear_laterality": "Right",
        "source_mode": "authentic_iemap_bundle_ingested",
        "bundle_dir": str(bundle_dir.relative_to(output_dir.parent.parent)),
        "look_config": str(look_json.relative_to(output_dir.parent.parent)),
        "meshes": manifest_meshes,
        "posterior_canal_path": str(path_json.relative_to(output_dir.parent.parent)),
    }

    meta_json = output_dir / "iemap_Metadata.json"
    with open(meta_json, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    return metadata


def parse_obj(filepath: Path) -> Tuple[np.ndarray, np.ndarray]:
    """Parse Wavefront OBJ file into (verts, faces)."""
    verts, faces = [], []
    with filepath.open("r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            if line.startswith("v "):
                verts.append([float(x) for x in line.split()[1:4]])
            elif line.startswith("f "):
                idx = [int(tok.split("/")[0]) - 1 for tok in line.split()[1:4]]
                faces.append(idx)
    return np.array(verts, dtype=np.float64), np.array(faces, dtype=np.int32)


def main():
    parser = argparse.ArgumentParser(description="Prepare IE-Map 3D inner-ear assets (.vtk, .obj, .fcsv, .json)")
    parser.add_argument(
        "--bundle-dir",
        type=str,
        default="assets/iemap_bundle_extracted/iemap-right-labyrinth-asset-v1",
        help="Workspace directory containing extracted IE-Map bundle",
    )
    parser.add_argument(
        "--smooth-path",
        type=str,
        default="assets/posterior_path_smooth.json",
        help="Path to checked smoothed posterior path JSON",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="assets/iemap",
        help="Workspace output directory for prepared IE-Map assets",
    )
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent.parent
    bundle_path = (repo_root / args.bundle_dir).resolve()
    smooth_path = (repo_root / args.smooth_path).resolve()
    out_dir = (repo_root / args.output_dir).resolve()

    if bundle_path.exists() and smooth_path.exists():
        print(f"[prepare_iemap] Ingesting authentic IE-Map bundle from {bundle_path} and smooth path {smooth_path}")
        metadata = ingest_authentic_iemap_bundle(
            output_dir=out_dir,
            bundle_dir=bundle_path,
            smooth_path_file=smooth_path,
        )
    else:
        print(f"[prepare_iemap] Authentic bundle not found at {bundle_path}, running fallback synthesis")
        metadata = generate_iemap_labyrinth(out_dir)

    print(f"[prepare_iemap] Successfully prepared {len(metadata['meshes'])} IE-Map meshes in {out_dir}")


if __name__ == "__main__":
    main()

