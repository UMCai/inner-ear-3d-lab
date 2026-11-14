#!/usr/bin/env python3
"""
scripts/prepare_radiology_volumes.py

Offline preprocessing of IE-Map v1.0.0 NIfTI volumes (IEMap_CT.nii.gz and
IEMap_CISS.nii.gz) into lightweight, RAS-aligned, quantized, gzip-compressed
binary volumes for lazy-loading in Virtual Radiology (Mode 3).

Usage:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/prepare_radiology_volumes.py
"""

import gzip
import json
import math
import os
import struct
import numpy as np

SRC_DIR = "/Users/umcai/Documents/Medaium-BPPV-001/assets/source/iemap-1.0.0"
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(REPO_ROOT, "assets", "iemap", "radiology")


def load_nifti_float32(path: str):
    """Load a NIfTI-1 (.nii.gz) float32 volume and return (data_3d, header_info)."""
    with gzip.open(path, "rb") as f:
        hdr = f.read(348)
        dim = struct.unpack("<8h", hdr[40:56])
        nx, ny, nz = dim[1], dim[2], dim[3]
        datatype = struct.unpack("<h", hdr[70:72])[0]
        pixdim = struct.unpack("<8f", hdr[76:108])
        vox_offset = int(struct.unpack("<f", hdr[108:112])[0])
        scl_slope, scl_inter = struct.unpack("<2f", hdr[112:120])
        qform_code, sform_code = struct.unpack("<2h", hdr[252:256])
        qb, qc, qd, qx, qy, qz = struct.unpack("<6f", hdr[256:280])

        f.seek(vox_offset)
        raw = f.read()

    if datatype != 16:
        raise ValueError(f"Expected float32 (datatype=16), got {datatype} in {path}")

    arr = np.frombuffer(raw, dtype="<f4").reshape((nx, ny, nz), order="F")
    if scl_slope not in (0.0, 1.0) or scl_inter != 0.0:
        arr = arr * scl_slope + scl_inter

    qfac = -1.0 if pixdim[0] < 0.0 else 1.0
    qa_sq = max(0.0, 1.0 - (qb * qb + qc * qc + qd * qd))
    qa = math.sqrt(qa_sq)

    rot = np.array(
        [
            [
                qa * qa + qb * qb - qc * qc - qd * qd,
                2.0 * (qb * qc - qa * qd),
                2.0 * (qb * qd + qa * qc),
            ],
            [
                2.0 * (qb * qc + qa * qd),
                qa * qa + qc * qc - qb * qb - qd * qd,
                2.0 * (qc * qd - qa * qb),
            ],
            [
                2.0 * (qb * qd - qa * qc),
                2.0 * (qc * qd + qa * qb),
                qa * qa + qd * qd - qb * qb - qc * qc,
            ],
        ],
        dtype=np.float64,
    )
    rot[:, 2] *= qfac

    info = {
        "dim": [nx, ny, nz],
        "pixdim": [float(pixdim[1]), float(pixdim[2]), float(pixdim[3])],
        "qfac": qfac,
        "qform_code": qform_code,
        "sform_code": sform_code,
        "rot": rot,
        "offset": np.array([qx, qy, qz], dtype=np.float64),
    }
    return arr, info


def reorient_axis_aligned_to_ras(arr: np.ndarray, info: dict):
    """
    Reorient an axis-aligned NIfTI volume so +i -> +X (Right), +j -> +Y (Anterior),
    +k -> +Z (Superior), returning (reoriented_arr, origin_ras, spacing_ras).
    """
    rot = info["rot"]
    pixdim = info["pixdim"]
    offset = info["offset"]
    dim = arr.shape

    # Verify axis-aligned within tolerance
    abs_rot = np.abs(rot)
    for col in range(3):
        if np.max(abs_rot[:, col]) < 0.999:
            raise ValueError(f"Volume is not axis-aligned: rot=\n{rot}")

    # Map each RAS axis (0=X, 1=Y, 2=Z) to source axis
    perm = [0, 0, 0]
    flips = [False, False, False]
    origin_ras = [0.0, 0.0, 0.0]
    spacing_ras = [0.0, 0.0, 0.0]

    for src_ax in range(3):
        ras_ax = int(np.argmax(abs_rot[:, src_ax]))
        sign = float(rot[ras_ax, src_ax])
        perm[ras_ax] = src_ax
        step = pixdim[src_ax]
        spacing_ras[ras_ax] = step
        if sign < 0:
            flips[ras_ax] = True
            origin_ras[ras_ax] = float(offset[ras_ax] + sign * step * (dim[src_ax] - 1))
        else:
            flips[ras_ax] = False
            origin_ras[ras_ax] = float(offset[ras_ax])

    out = np.transpose(arr, perm)
    for ax in range(3):
        if flips[ax]:
            out = np.flip(out, axis=ax)

    return out, origin_ras, spacing_ras


def quantize_u8(arr: np.ndarray, vmin: float, vmax: float) -> np.ndarray:
    scaled = (arr.astype(np.float32) - vmin) / max(1e-6, (vmax - vmin))
    return np.clip(np.rint(scaled * 255.0), 0, 255).astype(np.uint8)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    # 1. IEMap_CT: 0.06 mm isotropic (333^3, 19.92^3 mm).
    # Stride-2 downsample -> 0.12 mm isotropic (167^3), zero interpolation blur.
    ct_path = os.path.join(SRC_DIR, "IEMap_CT.nii.gz")
    ct_raw, ct_info = load_nifti_float32(ct_path)
    ct_ras, ct_origin, ct_spacing = reorient_axis_aligned_to_ras(ct_raw, ct_info)

    ct_ds = ct_ras[::2, ::2, ::2]
    ct_spacing_ds = [s * 2.0 for s in ct_spacing]
    ct_vmin, ct_vmax = 0.0, 2.80
    ct_u8 = quantize_u8(ct_ds, ct_vmin, ct_vmax)

    ct_bin_name = "ct_crop_u8.bin"
    ct_bin_path = os.path.join(OUT_DIR, ct_bin_name)
    ct_gz = gzip.compress(ct_u8.tobytes(order="F"), compresslevel=9)
    with open(ct_bin_path, "wb") as f:
        f.write(ct_gz)

    print(
        f"[prepare_radiology] CT: {ct_raw.shape} -> {ct_u8.shape} "
        f"spacing={ct_spacing_ds} origin={ct_origin} gz={len(ct_gz)/1024:.1f} KiB"
    )

    # 2. IEMap_CISS: 0.20 mm isotropic (200x200x150), qfac=-1 (X flipped).
    # Reorient to +RAS and crop tightly around labyrinth center [4.40, 2.01, -0.31] +/- 15 mm.
    ciss_path = os.path.join(SRC_DIR, "IEMap_CISS.nii.gz")
    ciss_raw, ciss_info = load_nifti_float32(ciss_path)
    ciss_ras, ciss_origin, ciss_spacing = reorient_axis_aligned_to_ras(ciss_raw, ciss_info)

    center_ras = [4.40, 2.01, -0.31]
    half_extent = 15.0
    slices = []
    crop_origin = []
    for ax in range(3):
        i0 = max(0, int(math.floor((center_ras[ax] - half_extent - ciss_origin[ax]) / ciss_spacing[ax])))
        i1 = min(ciss_ras.shape[ax], int(math.ceil((center_ras[ax] + half_extent - ciss_origin[ax]) / ciss_spacing[ax])) + 1)
        slices.append(slice(i0, i1))
        crop_origin.append(round(ciss_origin[ax] + i0 * ciss_spacing[ax], 4))

    ciss_crop = ciss_ras[slices[0], slices[1], slices[2]]
    ciss_vmin, ciss_vmax = 0.0, 7.50
    ciss_u8 = quantize_u8(ciss_crop, ciss_vmin, ciss_vmax)

    ciss_bin_name = "ciss_crop_u8.bin"
    ciss_bin_path = os.path.join(OUT_DIR, ciss_bin_name)
    ciss_gz = gzip.compress(ciss_u8.tobytes(order="F"), compresslevel=9)
    with open(ciss_bin_path, "wb") as f:
        f.write(ciss_gz)

    print(
        f"[prepare_radiology] CISS: {ciss_raw.shape} -> {ciss_u8.shape} "
        f"spacing={ciss_spacing} origin={crop_origin} gz={len(ciss_gz)/1024:.1f} KiB"
    )

    manifest = {
        "version": 1,
        "source": "IE-Map v1.0.0",
        "coordinateSystem": "RAS",
        "volumes": {
            "bone": {
                "file": ct_bin_name,
                "modality": "HRCT",
                "dims": list(ct_u8.shape),
                "originRAS": [round(x, 4) for x in ct_origin],
                "spacingMm": [round(x, 4) for x in ct_spacing_ds],
                "dtype": "uint8",
                "encoding": "gzip-fortran",
                "rawMin": ct_vmin,
                "rawMax": ct_vmax,
                "byteLength": len(ct_gz),
            },
            "mri_t2": {
                "file": ciss_bin_name,
                "modality": "3D T2 CISS",
                "dims": list(ciss_u8.shape),
                "originRAS": crop_origin,
                "spacingMm": [round(x, 4) for x in ciss_spacing],
                "dtype": "uint8",
                "encoding": "gzip-fortran",
                "rawMin": ciss_vmin,
                "rawMax": ciss_vmax,
                "byteLength": len(ciss_gz),
            },
        },
    }

    manifest_path = os.path.join(OUT_DIR, "radiology_volumes.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    print(f"[prepare_radiology] Wrote {manifest_path}")


if __name__ == "__main__":
    main()
