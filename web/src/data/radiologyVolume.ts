/**
 * web/src/data/radiologyVolume.ts
 *
 * Lazy-loaded, zero-GC trilinear MPR volume reslicer for real IE-Map v1.0.0
 * HRCT (Bone) and 3D T2 CISS MRI volumes.
 *
 * Volumes are preprocessed offline into RAS-aligned, quantized uint8
 * gzip-compressed binaries under `/assets/iemap/radiology/` and fetched
 * on-demand only when entering Virtual Radiology (Mode 3).
 */

import { CTWindowMode, SlicingPlaneDefinition } from './radiologyEngine';

export interface RadiologyVolumeSpec {
  file: string;
  modality: string;
  dims: [number, number, number];
  originRAS: [number, number, number];
  spacingMm: [number, number, number];
  dtype: 'uint8';
  encoding: 'gzip-fortran';
  rawMin: number;
  rawMax: number;
  byteLength: number;
}

export interface RadiologyManifest {
  version: number;
  source: string;
  coordinateSystem: 'RAS';
  volumes: Record<CTWindowMode, RadiologyVolumeSpec>;
}

export interface LoadedRadiologyVolume {
  mode: CTWindowMode;
  spec: RadiologyVolumeSpec;
  data: Uint8Array;
}

const RADIOLOGY_BASE_URL = '/assets/iemap/radiology';
export const MPR_FOV_MM = 24.0;

let manifestPromise: Promise<RadiologyManifest | null> | null = null;
const volumeCache = new Map<CTWindowMode, LoadedRadiologyVolume>();
const volumePromises = new Map<CTWindowMode, Promise<LoadedRadiologyVolume | null>>();
const readyListeners = new Set<(mode: CTWindowMode) => void>();

// Precomputed 256-entry Window/Level LUTs (zero allocation during reslice)
const BONE_LUT = new Uint8Array(256);
const MRI_T2_LUT = new Uint8Array(256);

(function initLUTs() {
  // Calibrated HRCT Bone Window (W:4000, L:+700 HU equivalent on IE-Map CT [0..2.80])
  // Air/mastoid ~0..18 -> black; fluid/soft tissue ~35..100 -> dark gray;
  // trabecular bone ~120..180 -> mid-gray; otic capsule cortical bone ~200..255 -> bright white
  const boneMin = 18;
  const boneMax = 238;
  for (let i = 0; i < 256; i++) {
    const t = Math.max(0, Math.min(1, (i - boneMin) / (boneMax - boneMin)));
    BONE_LUT[i] = Math.round(t * 255);
  }

  // Calibrated 3D T2 CISS FIESTA LUT (fluid bright, bone/air dark)
  const mriMin = 10;
  const mriMax = 215;
  for (let i = 0; i < 256; i++) {
    const t = Math.max(0, Math.min(1, (i - mriMin) / (mriMax - mriMin)));
    MRI_T2_LUT[i] = Math.round(Math.pow(t, 0.88) * 255);
  }
})();

export function onRadiologyVolumeReady(cb: (mode: CTWindowMode) => void): () => void {
  readyListeners.add(cb);
  return () => {
    readyListeners.delete(cb);
  };
}

export function getLoadedRadiologyVolume(mode: CTWindowMode): LoadedRadiologyVolume | null {
  return volumeCache.get(mode) ?? null;
}

async function fetchManifest(): Promise<RadiologyManifest | null> {
  if (!manifestPromise) {
    manifestPromise = (async () => {
      try {
        const res = await fetch(`${RADIOLOGY_BASE_URL}/radiology_volumes.json`);
        if (!res.ok) return null;
        return (await res.json()) as RadiologyManifest;
      } catch {
        return null;
      }
    })();
  }
  return manifestPromise;
}

async function gunzipToUint8Array(buffer: ArrayBuffer): Promise<Uint8Array> {
  if (typeof DecompressionStream !== 'undefined') {
    const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
    const decompressed = await new Response(stream).arrayBuffer();
    return new Uint8Array(decompressed);
  }
  throw new Error('DecompressionStream("gzip") is not supported in this browser.');
}

export async function ensureRadiologyVolumeLoaded(
  mode: CTWindowMode
): Promise<LoadedRadiologyVolume | null> {
  const cached = volumeCache.get(mode);
  if (cached) return cached;

  const existing = volumePromises.get(mode);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const manifest = await fetchManifest();
      const spec = manifest?.volumes?.[mode];
      if (!spec) return null;

      const res = await fetch(`${RADIOLOGY_BASE_URL}/${spec.file}`);
      if (!res.ok) return null;

      const gzBuffer = await res.arrayBuffer();
      const data = await gunzipToUint8Array(gzBuffer);
      const expectedLen = spec.dims[0] * spec.dims[1] * spec.dims[2];
      if (data.length !== expectedLen) {
        console.warn(
          `[radiologyVolume] Size mismatch for ${mode}: got ${data.length}, expected ${expectedLen}`
        );
        return null;
      }

      const loaded: LoadedRadiologyVolume = { mode, spec, data };
      volumeCache.set(mode, loaded);
      for (const cb of readyListeners) {
        cb(mode);
      }
      return loaded;
    } catch (err) {
      console.warn(`[radiologyVolume] Failed to load ${mode} volume:`, err);
      return null;
    }
  })();

  volumePromises.set(mode, promise);
  return promise;
}

export function preloadRadiologyVolumes(priorityMode: CTWindowMode = 'bone'): void {
  const secondary: CTWindowMode = priorityMode === 'bone' ? 'mri_t2' : 'bone';
  void ensureRadiologyVolumeLoaded(priorityMode).then(() => {
    void ensureRadiologyVolumeLoaded(secondary);
  });
}

export interface ResliceOptions {
  fovMm?: number;
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  oobR?: number;
  oobG?: number;
  oobB?: number;
  oobAlpha?: number;
  inBoundsAlpha?: number;
}

/**
 * Reslice a loaded RAS volume onto a 2D RGBA pixel buffer using trilinear interpolation.
 * Performs ZERO heap allocations so it can run interactively during 60fps depth scrubbing.
 */
export function resliceVolumeToRGBA(
  volume: LoadedRadiologyVolume,
  plane: SlicingPlaneDefinition,
  depthMm: number,
  width: number,
  height: number,
  outRGBA: Uint8ClampedArray | Uint8Array,
  options: ResliceOptions = {}
): void {
  const fovMm = options.fovMm ?? MPR_FOV_MM;
  const flipH = options.flipHorizontal ?? false;
  const flipV = options.flipVertical ?? true; // canvas Y goes top->bottom, so +inPlaneY is at y=0
  const oobR = options.oobR ?? 6;
  const oobG = options.oobG ?? 10;
  const oobB = options.oobB ?? 13;
  const oobAlpha = options.oobAlpha ?? 255;
  const inBoundsAlpha = options.inBoundsAlpha ?? 255;

  const lut = volume.mode === 'bone' ? BONE_LUT : MRI_T2_LUT;
  const data = volume.data;
  const nx = volume.spec.dims[0];
  const ny = volume.spec.dims[1];
  const nz = volume.spec.dims[2];
  const maxI = nx - 1;
  const maxJ = ny - 1;
  const maxK = nz - 1;
  const strideY = nx;
  const strideZ = nx * ny;

  const ox = volume.spec.originRAS[0];
  const oy = volume.spec.originRAS[1];
  const oz = volume.spec.originRAS[2];
  const invSx = 1.0 / volume.spec.spacingMm[0];
  const invSy = 1.0 / volume.spec.spacingMm[1];
  const invSz = 1.0 / volume.spec.spacingMm[2];

  const ux = plane.inPlaneX[0];
  const uy = plane.inPlaneX[1];
  const uz = plane.inPlaneX[2];
  const vx = plane.inPlaneY[0];
  const vy = plane.inPlaneY[1];
  const vz = plane.inPlaneY[2];

  const px0 = plane.centerRAS[0] + depthMm * plane.normalRAS[0];
  const py0 = plane.centerRAS[1] + depthMm * plane.normalRAS[1];
  const pz0 = plane.centerRAS[2] + depthMm * plane.normalRAS[2];

  const halfFov = fovMm * 0.5;
  const invW = width > 1 ? 1.0 / (width - 1) : 1.0;
  const invH = height > 1 ? 1.0 / (height - 1) : 1.0;

  let outIdx = 0;
  for (let py = 0; py < height; py++) {
    const nyNorm = py * invH;
    const vMm = flipV ? halfFov - nyNorm * fovMm : -halfFov + nyNorm * fovMm;
    const rowBaseX = px0 + vMm * vx;
    const rowBaseY = py0 + vMm * vy;
    const rowBaseZ = pz0 + vMm * vz;

    for (let px = 0; px < width; px++) {
      const nxNorm = px * invW;
      const uMm = flipH ? halfFov - nxNorm * fovMm : -halfFov + nxNorm * fovMm;

      const rx = rowBaseX + uMm * ux;
      const ry = rowBaseY + uMm * uy;
      const rz = rowBaseZ + uMm * uz;

      const fi = (rx - ox) * invSx;
      const fj = (ry - oy) * invSy;
      const fk = (rz - oz) * invSz;

      if (fi < 0 || fi >= maxI || fj < 0 || fj >= maxJ || fk < 0 || fk >= maxK) {
        outRGBA[outIdx] = oobR;
        outRGBA[outIdx + 1] = oobG;
        outRGBA[outIdx + 2] = oobB;
        outRGBA[outIdx + 3] = oobAlpha;
      } else {
        const i0 = fi | 0;
        const j0 = fj | 0;
        const k0 = fk | 0;
        const tx = fi - i0;
        const ty = fj - j0;
        const tz = fk - k0;

        const base = i0 + strideY * j0 + strideZ * k0;
        const c000 = data[base];
        const c100 = data[base + 1];
        const c010 = data[base + strideY];
        const c110 = data[base + strideY + 1];
        const c001 = data[base + strideZ];
        const c101 = data[base + strideZ + 1];
        const c011 = data[base + strideY + strideZ];
        const c111 = data[base + strideY + strideZ + 1];

        const c00 = c000 + (c100 - c000) * tx;
        const c10 = c010 + (c110 - c010) * tx;
        const c01 = c001 + (c101 - c001) * tx;
        const c11 = c011 + (c111 - c011) * tx;

        const c0 = c00 + (c10 - c00) * ty;
        const c1 = c01 + (c11 - c01) * ty;
        const val = c0 + (c1 - c0) * tz;

        const g = lut[Math.round(val)];
        outRGBA[outIdx] = g;
        outRGBA[outIdx + 1] = g;
        outRGBA[outIdx + 2] = g;
        outRGBA[outIdx + 3] = inBoundsAlpha;
      }
      outIdx += 4;
    }
  }
}
