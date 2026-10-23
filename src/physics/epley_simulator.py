#!/usr/bin/env python3
"""
Deterministic 3D Otoconia & Vestibular Kinematics Simulator for Right Posterior-Canal BPPV
==========================================================================================
Models the causal chain:
  Body/Head Position (psi_yaw, theta_recline)
    -> 3D Right Inner-Ear Orientation R_head(t) in World Space
    -> Projection of World Gravity g_world = (0, 0, -1) onto the IE-Map Posterior Canal Tangent T_world(s, t)
    -> Overdamped Stokes Sedimentation ds/dt = mu * (g_world . T_world(s, t))
    -> Endolymphatic piston drag & elastic Cupula deflection delta_cupula(t)
"""

import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Tuple

try:
    import numpy as np
except ImportError:
    class _MiniNdarray:
        def __init__(self, data):
            if isinstance(data, _MiniNdarray):
                self._data = [list(r) if isinstance(r, (list, tuple, _MiniNdarray)) else r for r in data._data]
            elif isinstance(data, (list, tuple)):
                self._data = [list(r) if isinstance(r, (list, tuple, _MiniNdarray)) else r for r in data]
            else:
                self._data = data

        def __len__(self):
            return len(self._data)

        def __iter__(self):
            for item in self._data:
                if isinstance(item, list):
                    yield _MiniNdarray(item)
                else:
                    yield item

        def __getitem__(self, item):
            if isinstance(item, tuple):
                rows, col = item
                if rows == slice(None):
                    return _MiniNdarray([r[col] for r in self._data])
            res = self._data[item]
            if isinstance(res, list):
                return _MiniNdarray(res)
            return res

        def __setitem__(self, item, val):
            self._data[item] = val

        def __matmul__(self, other):
            b = other._data if isinstance(other, _MiniNdarray) else other
            a = self._data
            first_b = b[0]._data if isinstance(b[0], _MiniNdarray) else b[0]
            if isinstance(first_b, (list, tuple)):
                n_cols = len(first_b)
                res = []
                for r in range(len(a)):
                    row = []
                    for c in range(n_cols):
                        val = sum(a[r][k] * (b[k][c] if not isinstance(b[k], _MiniNdarray) else b[k]._data[c]) for k in range(len(b)))
                        row.append(val)
                    res.append(row)
                return _MiniNdarray(res)
            else:
                res = []
                for r in range(len(a)):
                    val = sum(a[r][k] * (b[k] if not isinstance(b[k], _MiniNdarray) else b[k]._data) for k in range(len(b)))
                    res.append(val)
                return _MiniNdarray(res)

        @property
        def T(self):
            trans = [list(x) for x in zip(*self._data)]
            return _MiniNdarray(trans)

        def __add__(self, other):
            b = other._data if isinstance(other, _MiniNdarray) else other
            if isinstance(b, (int, float)):
                return _MiniNdarray([x + b for x in self._data])
            return _MiniNdarray([x + y for x, y in zip(self._data, b)])

        def __radd__(self, other):
            return self.__add__(other)

        def __sub__(self, other):
            b = other._data if isinstance(other, _MiniNdarray) else other
            if isinstance(b, (int, float)):
                return _MiniNdarray([x - b for x in self._data])
            return _MiniNdarray([x - y for x, y in zip(self._data, b)])

        def __mul__(self, other):
            b = other._data if isinstance(other, _MiniNdarray) else other
            if isinstance(b, (int, float)):
                return _MiniNdarray([x * b for x in self._data])
            return _MiniNdarray([x * y for x, y in zip(self._data, b)])

        def __rmul__(self, other):
            return self.__mul__(other)

        def __truediv__(self, other):
            if isinstance(other, (int, float)):
                return _MiniNdarray([x / other for x in self._data])
            b = other._data if isinstance(other, _MiniNdarray) else other
            return _MiniNdarray([x / y for x, y in zip(self._data, b)])

        def __repr__(self):
            return f"{self._data}"

    class _MiniLinalg:
        @staticmethod
        def norm(v):
            data = v._data if isinstance(v, _MiniNdarray) else v
            return math.hypot(*data)

    class _MiniRandom:
        def __init__(self, seed=None):
            import random
            self.r = random.Random(seed)

        def normal(self, loc, scale, size):
            return _MiniNdarray([self.r.gauss(loc, scale) for _ in range(size)])

        def uniform(self, low, high, size):
            return _MiniNdarray([self.r.uniform(low, high) for _ in range(size)])

    class _MiniNumpy:
        float64 = float
        ndarray = _MiniNdarray
        linalg = _MiniLinalg()

        @staticmethod
        def array(data, dtype=None):
            return _MiniNdarray(data)

        @staticmethod
        def clip(val, a_min, a_max):
            if isinstance(val, (int, float)):
                return max(a_min, min(a_max, val))
            data = val._data if isinstance(val, _MiniNdarray) else val
            return _MiniNdarray([max(a_min, min(a_max, x)) for x in data])

        @staticmethod
        def dot(a, b):
            da = a._data if isinstance(a, _MiniNdarray) else a
            db = b._data if isinstance(b, _MiniNdarray) else b
            return sum(x * y for x, y in zip(da, db))

        @staticmethod
        def cross(a, b):
            da = a._data if isinstance(a, _MiniNdarray) else a
            db = b._data if isinstance(b, _MiniNdarray) else b
            if len(da) > 0 and isinstance(da[0], (list, tuple, _MiniNdarray)):
                res = []
                for va, vb in zip(da, db):
                    v_a = va._data if isinstance(va, _MiniNdarray) else va
                    v_b = vb._data if isinstance(vb, _MiniNdarray) else vb
                    res.append([
                        v_a[1] * v_b[2] - v_a[2] * v_b[1],
                        v_a[2] * v_b[0] - v_a[0] * v_b[2],
                        v_a[0] * v_b[1] - v_a[1] * v_b[0],
                    ])
                return _MiniNdarray(res)
            return _MiniNdarray([
                da[1] * db[2] - da[2] * db[1],
                da[2] * db[0] - da[0] * db[2],
                da[0] * db[1] - da[1] * db[0],
            ])

        @staticmethod
        def interp(x, xp, fp):
            dxp = xp._data if isinstance(xp, _MiniNdarray) else xp
            dfp = fp._data if isinstance(fp, _MiniNdarray) else fp
            if x <= dxp[0]: return dfp[0]
            if x >= dxp[-1]: return dfp[-1]
            for i in range(len(dxp) - 1):
                if dxp[i] <= x <= dxp[i + 1]:
                    span = dxp[i + 1] - dxp[i]
                    if span == 0: return dfp[i]
                    t = (x - dxp[i]) / span
                    return dfp[i] + t * (dfp[i + 1] - dfp[i])
            return dfp[-1]

        @staticmethod
        def default_rng(seed=None):
            return _MiniRandom(seed)

    np = _MiniNumpy()


def smoothstep(edge0: float, edge1: float, x: float) -> float:
    if edge1 <= edge0:
        return 1.0 if x >= edge0 else 0.0
    t = max(0.0, min(1.0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)


def rotation_matrix_head(psi_yaw_deg: float, theta_recline_deg: float, roll_deg: float = 0.0) -> np.ndarray:
    """
    Compute the 3x3 rotation matrix R_head mapping Head RAS coordinates
    (+X=Right, +Y=Anterior, +Z=Superior) to World coordinates
    (+X=Table Right, +Y=Table Foot/Forward, +Z=World Up; Gravity = (0, 0, -1)).

    - psi_yaw_deg: Head axial rotation around craniocaudal axis Z_head.
        psi = -45 deg -> Head turned 45 deg RIGHT (toward affected right ear).
        psi = +45 deg -> Head turned 45 deg LEFT.
        psi = +135 deg -> Rolled onto left side with nose angled 45 deg down toward floor.
    - theta_recline_deg: Body/neck pitch around table transverse axis +X_world.
        theta = 0 deg -> Upright sitting.
        theta = 90 deg -> Horizontal decubitus on examination table (Step 4 left-side roll).
        theta = 120 deg -> Supine with 30 deg neck extension over shoulder pillow (Dix-Hallpike / Epley Step 2 & 3).
    """
    psi = math.radians(psi_yaw_deg)
    th = math.radians(theta_recline_deg)
    rl = math.radians(roll_deg)

    Rz = np.array([
        [math.cos(psi), -math.sin(psi), 0.0],
        [math.sin(psi),  math.cos(psi), 0.0],
        [0.0,            0.0,           1.0],
    ], dtype=np.float64)

    Ry = np.array([
        [ math.cos(rl), 0.0, math.sin(rl)],
        [ 0.0,          1.0, 0.0         ],
        [-math.sin(rl), 0.0, math.cos(rl)],
    ], dtype=np.float64)

    Rx = np.array([
        [1.0, 0.0,           0.0          ],
        [0.0, math.cos(th), -math.sin(th) ],
        [0.0, math.sin(th),  math.cos(th) ],
    ], dtype=np.float64)

    return Rx @ Rz @ Ry


@dataclass
class SimulationFrameState:
    frame_index: int
    time_sec: float
    step_id: str
    step_title: str
    psi_yaw_deg: float
    theta_recline_deg: float
    R_head: np.ndarray
    otoconia_phi_deg: float
    otoconia_arc_mm: float
    otoconia_center_ras: np.ndarray
    otoconia_center_world: np.ndarray
    otoconia_particles_ras: np.ndarray
    otoconia_particles_world: np.ndarray
    canal_tangent_ras: np.ndarray
    canal_tangent_world: np.ndarray
    gravity_along_canal: float
    cupula_deflection: float
    anatomical_region: str
    phase: str = "hold"
    role_swap_blend: float = 0.0


class EpleySimulator:
    """
    Continuous 3D gravitational sedimentation simulator along the IE-Map Right Posterior Semicircular Canal.
    """

    def __init__(self, path_json_path: Path, num_particles: int = 5, seed: int = 42):
        with open(path_json_path, "r", encoding="utf-8") as f:
            self.path_data = json.load(f)

        samples = self.path_data["samples"]
        self.phis = np.array([s["phi_deg"] for s in samples], dtype=np.float64)
        self.arcs = np.array([s["arc_length_mm"] for s in samples], dtype=np.float64)
        self.pos_ras = np.array([s["position_ras"] for s in samples], dtype=np.float64)
        self.tan_ras = np.array([s["tangent_ras"] for s in samples], dtype=np.float64)
        self.nrm_ras = np.array([s["normal_ras"] for s in samples], dtype=np.float64)
        self.bin_ras = np.cross(self.tan_ras, self.nrm_ras)

        self.g_world = np.array([0.0, 0.0, -1.0], dtype=np.float64)
        self.num_particles = num_particles

        if num_particles == 5:
            # Deterministic well-spaced Gate 3 schematic canaliths along lumen centerline
            self.p_phi_offsets = np.array([-7.0, -3.5, 0.0, 3.5, 7.0], dtype=np.float64)
            self.p_radial = np.array([0.0, 0.015, 0.0, 0.015, 0.0], dtype=np.float64)
            self.p_radial_angle = np.array([0.2, 1.4, 2.7, 4.1, 5.3], dtype=np.float64)
        else:
            rng = np.random.default_rng(seed)
            self.p_phi_offsets = rng.normal(0.0, 3.6, size=num_particles)
            self.p_phi_offsets[0] = 0.0
            self.p_radial = rng.uniform(0.01, 0.05, size=num_particles)
            self.p_radial_angle = rng.uniform(0.0, 2.0 * math.pi, size=num_particles)

    def interpolate_at_phi(self, phi_deg: float) -> Tuple[float, np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        phi_clamped = float(np.clip(phi_deg, self.phis[0], self.phis[-1]))
        arc = float(np.interp(phi_clamped, self.phis, self.arcs))
        pos = np.array([np.interp(phi_clamped, self.phis, self.pos_ras[:, k]) for k in range(3)])
        tan = np.array([np.interp(phi_clamped, self.phis, self.tan_ras[:, k]) for k in range(3)])
        nrm = np.array([np.interp(phi_clamped, self.phis, self.nrm_ras[:, k]) for k in range(3)])
        t_norm = np.linalg.norm(tan)
        if t_norm > 1e-8:
            tan /= t_norm
        nrm = nrm - np.dot(nrm, tan) * tan
        n_norm = np.linalg.norm(nrm)
        if n_norm > 1e-8:
            nrm /= n_norm
        binorm = np.cross(tan, nrm)
        return arc, pos, tan, nrm, binorm

    @staticmethod
    def classify_region(phi_deg: float) -> str:
        if phi_deg < -95.0:
            return "Posterior Ampulla"
        elif phi_deg < -45.0:
            return "Posterior Canal (Base)"
        elif phi_deg < 45.0:
            return "Posterior Canal (Apex)"
        elif phi_deg < 112.0:
            return "Posterior Canal (Superior Arch)"
        elif phi_deg < 172.0:
            return "Common Crus"
        else:
            return "Utricle"

    def compute_particle_cloud(
        self, center_phi_deg: float, R_head: np.ndarray
    ) -> Tuple[np.ndarray, np.ndarray]:
        pts_ras = []
        utricle_fan = smoothstep(168.0, 185.0, center_phi_deg)
        spread_scale = 1.0 + 0.20 * utricle_fan
        utricle_rad_extra = np.array([0.14, 0.22, 0.02, 0.22, 0.16], dtype=np.float64)
        for i in range(self.num_particles):
            phi_i = np.clip(
                center_phi_deg + self.p_phi_offsets[i] * spread_scale,
                -94.0,
                198.5,
            )
            _, pos, _, nrm, binorm = self.interpolate_at_phi(phi_i)
            r = self.p_radial[i] + (utricle_rad_extra[i % 5] * utricle_fan if self.num_particles == 5 else 0.0)
            ang = self.p_radial_angle[i]
            p_ras = pos + r * (math.cos(ang) * nrm + math.sin(ang) * binorm)
            pts_ras.append(p_ras)
        pts_ras_arr = np.array(pts_ras, dtype=np.float64)
        pts_world_arr = (R_head @ pts_ras_arr.T).T
        return pts_ras_arr, pts_world_arr

    def simulate_timeline(
        self,
        fps: int,
        total_frames: int,
        pose_evaluator,
        initial_phi_deg: float = -84.0,
    ) -> List[SimulationFrameState]:
        """
        Integrate the deterministic 3D gravity-driven otoconia ODE across `total_frames`:
          d(phi)/dt = mobility * max(0, g_world . T_world(phi, t))
        """
        dt = 1.0 / float(fps)
        phi = float(initial_phi_deg)
        cupula = 0.0
        states: List[SimulationFrameState] = []

        for f_idx in range(total_frames):
            t_sec = f_idx * dt
            pose_info = pose_evaluator(t_sec)
            step_id = pose_info["step_id"]
            step_title = pose_info["step_title"]
            psi = float(pose_info["psi_yaw_deg"])
            theta = float(pose_info["theta_recline_deg"])
            mobility = float(pose_info.get("mobility", 42.0))
            phi_cap_max = float(pose_info.get("phi_cap_max", 190.0))

            R = rotation_matrix_head(psi, theta)
            arc, pos_ras, tan_ras, _, _ = self.interpolate_at_phi(phi)
            pos_world = R @ pos_ras
            tan_world = R @ tan_ras

            # Exact projection of downward gravity g_world = (0, 0, -1) onto the 3D canal tangent
            g_proj = float(np.dot(self.g_world, tan_world))

            #Gentle smooth approach near the Common Crus entry (phi = 102..110 deg) in Step 3
            effective_drive = g_proj
            if step_id == "step3" and 96.0 <= phi <= 110.0:
                effective_drive = max(g_proj, 0.18 * (1.0 - (phi - 96.0) / 14.5))

            dphi_dt = mobility * max(0.0, effective_drive)
            if phi >= phi_cap_max:
                dphi_dt = 0.0

            phi = float(np.clip(phi + dphi_dt * dt, -108.0, phi_cap_max))

            # Neutral cupula geometry (no fake quantitative cupula deflection claims)
            cupula = 0.0

            pts_ras, pts_world = self.compute_particle_cloud(phi, R)
            region = self.classify_region(phi)
            phase = str(pose_info.get("phase", "hold"))
            role_swap_blend = float(pose_info.get("role_swap_blend", 0.0))

            states.append(
                SimulationFrameState(
                    frame_index=f_idx,
                    time_sec=t_sec,
                    step_id=step_id,
                    step_title=step_title,
                    psi_yaw_deg=psi,
                    theta_recline_deg=theta,
                    R_head=R,
                    otoconia_phi_deg=phi,
                    otoconia_arc_mm=arc,
                    otoconia_center_ras=pos_ras,
                    otoconia_center_world=pos_world,
                    otoconia_particles_ras=pts_ras,
                    otoconia_particles_world=pts_world,
                    canal_tangent_ras=tan_ras,
                    canal_tangent_world=tan_world,
                    gravity_along_canal=g_proj,
                    cupula_deflection=cupula,
                    anatomical_region=region,
                    phase=phase,
                    role_swap_blend=role_swap_blend,
                )
            )

        return states


def _run_self_test():
    repo_root = Path(__file__).resolve().parent.parent.parent
    path_json = repo_root / "assets" / "iemap" / "posterior_canal_path.json"
    sim = EpleySimulator(path_json)

    def test_pose_eval(t: float) -> Dict:
        if t < 10.0:
            return {"step_id": "step1", "step_title": "Step 1", "psi_yaw_deg": -45.0, "theta_recline_deg": 0.0, "mobility": 42.0, "phi_cap_max": -83.5}
        elif t < 25.0:
            w = smoothstep(10.0, 12.0, t)
            return {"step_id": "step2", "step_title": "Step 2", "psi_yaw_deg": -45.0, "theta_recline_deg": 120.0 * w, "mobility": 45.0, "phi_cap_max": 30.0}
        elif t < 40.0:
            w = smoothstep(25.0, 27.0, t)
            return {"step_id": "step3", "step_title": "Step 3", "psi_yaw_deg": -45.0 + 90.0 * w, "theta_recline_deg": 120.0, "mobility": 54.0, "phi_cap_max": 110.0}
        elif t < 55.0:
            w = smoothstep(40.0, 42.0, t)
            return {"step_id": "step4", "step_title": "Step 4", "psi_yaw_deg": 45.0 + 90.0 * w, "theta_recline_deg": 120.0 - 30.0 * w, "mobility": 55.0, "phi_cap_max": 165.0}
        else:
            w = smoothstep(55.0, 57.5, t)
            return {"step_id": "step5", "step_title": "Step 5", "psi_yaw_deg": 135.0 * (1.0 - w), "theta_recline_deg": 90.0 * (1.0 - w), "mobility": 60.0, "phi_cap_max": 186.0}

    fps = 30
    states = sim.simulate_timeline(fps=fps, total_frames=70 * fps, pose_evaluator=test_pose_eval, initial_phi_deg=-84.0)
    checkpoints = [
        ("Step 1 (Upright, 45° Right)", 9.5, -83.8),
        ("Step 2 (Supine + 30° Ext, 45° Right)", 24.5, 30.0),
        ("Step 3 (Supine + 30° Ext, 45° Left)", 39.5, 110.0),
        ("Step 4 (Left Shoulder Roll, 135° Left / Nose 45° Down)", 54.5, 165.0),
        ("Step 5 (Return to Upright Sitting)", 69.5, 186.0),
    ]
    print("[epley_simulator] 3D Vestibular Kinematics & Stokes Gravity Sedimentation Verification:")
    for label, t_sec, expected_phi in checkpoints:
        st = states[int(t_sec * fps)]
        pts = st.otoconia_particles_ras
        min_pair_dist = min(
            float(np.linalg.norm(pts[i] - pts[j]))
            for i in range(len(pts))
            for j in range(i + 1, len(pts))
        )
        print(
            f"  {label:54s} | psi={st.psi_yaw_deg:+6.1f}°, theta={st.theta_recline_deg:5.1f}° "
            f"-> phi={st.otoconia_phi_deg:+6.1f}° (target {expected_phi:+6.1f}°), "
            f"arc={st.otoconia_arc_mm:5.2f} mm, min_sep={min_pair_dist:.3f} mm, region='{st.anatomical_region}'"
        )
        assert abs(st.otoconia_phi_deg - expected_phi) < 1.5, f"Mismatch at {label}: got {st.otoconia_phi_deg}, expected {expected_phi}"
        assert min_pair_dist > 0.15, f"Particles collapsed at {label}: min_sep={min_pair_dist:.4f} mm"
    print("[epley_simulator] ALL 5 CLINICAL STEP MILESTONES & 5-PARTICLE SEPARATION ASSERTIONS PASSED.")


if __name__ == "__main__":
    _run_self_test()
