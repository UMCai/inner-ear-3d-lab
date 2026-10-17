/**
 * web/src/data/canalPaths.ts
 *
 * Multi-Canal Semicircular Spline Data Models & Loaders.
 *
 * Provides type-safe access and continuous 3D interpolation across all three
 * semicircular canals: Posterior, Horizontal (Lateral), and Anterior (Superior).
 * Anchored in authentic IE-Map v1.0.0 RAS stereotaxic millimeter coordinates.
 */

export type CanalId = 'posterior' | 'horizontal' | 'anterior';

export interface CanalSplineSample {
  index: number;
  phi_deg: number;
  arc_length_mm: number;
  position_ras: [number, number, number];
  tangent_ras: [number, number, number];
  normal_ras: [number, number, number];
}

export interface CanalPathData {
  coordinate_system: string;
  ear_side: string;
  units: string;
  canal_name?: CanalId;
  canal_center_ras: [number, number, number];
  canal_radius_mm: number;
  total_arc_length_mm: number;
  landmarks_phi_deg: Record<string, number>;
  samples: CanalSplineSample[];
}

export const CANAL_PATH_URLS: Record<CanalId, string> = {
  posterior: '/assets/iemap/posterior_canal_path.json',
  horizontal: '/assets/iemap/horizontal_canal_path.json',
  anterior: '/assets/iemap/anterior_canal_path.json',
};

const pathCache: Partial<Record<CanalId, CanalPathData>> = {};

/**
 * Loads a continuous 3D canal centerline path by canal ID.
 */
export async function loadCanalPath(canalId: CanalId): Promise<CanalPathData> {
  if (pathCache[canalId]) {
    return pathCache[canalId]!;
  }

  const url = CANAL_PATH_URLS[canalId];
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load canal path from ${url}: HTTP ${res.status}`);
  }

  const data = (await res.json()) as CanalPathData;
  data.canal_name = canalId;
  pathCache[canalId] = data;
  return data;
}

/**
 * Concurrently loads all three semicircular canal paths.
 */
export async function loadAllCanalPaths(): Promise<Record<CanalId, CanalPathData>> {
  const [posterior, horizontal, anterior] = await Promise.all([
    loadCanalPath('posterior'),
    loadCanalPath('horizontal'),
    loadCanalPath('anterior'),
  ]);

  return { posterior, horizontal, anterior };
}

/**
 * Linearly interpolates position, tangent, and normal along the canal spline at arbitrary phi (degrees).
 */
export function interpolateCanalAtPhi(
  pathData: CanalPathData,
  phiDeg: number
): {
  arcMm: number;
  pos: [number, number, number];
  tan: [number, number, number];
  nrm: [number, number, number];
  binorm: [number, number, number];
} {
  const samples = pathData.samples;
  if (samples.length === 0) {
    throw new Error('Canal path has no samples');
  }

  const phiFirst = samples[0].phi_deg;
  const phiLast = samples[samples.length - 1].phi_deg;
  const clampedPhi = Math.max(Math.min(phiFirst, phiLast), Math.min(Math.max(phiFirst, phiLast), phiDeg));

  let i0 = 0;
  for (let i = 0; i < samples.length - 1; i++) {
    const pA = samples[i].phi_deg;
    const pB = samples[i + 1].phi_deg;
    if ((clampedPhi >= pA && clampedPhi <= pB) || (clampedPhi >= pB && clampedPhi <= pA)) {
      i0 = i;
      break;
    }
  }

  const i1 = Math.min(samples.length - 1, i0 + 1);
  const s0 = samples[i0];
  const s1 = samples[i1];
  const span = Math.max(1e-6, Math.abs(s1.phi_deg - s0.phi_deg));
  const t = Math.max(0.0, Math.min(1.0, Math.abs(clampedPhi - s0.phi_deg) / span));

  const lerp3 = (
    a: [number, number, number],
    b: [number, number, number]
  ): [number, number, number] => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];

  const arcMm = s0.arc_length_mm + (s1.arc_length_mm - s0.arc_length_mm) * t;
  const pos = lerp3(s0.position_ras, s1.position_ras);
  const rawTan = lerp3(s0.tangent_ras, s1.tangent_ras);
  const tanLen = Math.hypot(rawTan[0], rawTan[1], rawTan[2]) || 1.0;
  const tan: [number, number, number] = [rawTan[0] / tanLen, rawTan[1] / tanLen, rawTan[2] / tanLen];

  const rawNrm = lerp3(s0.normal_ras, s1.normal_ras);
  const dotTN = rawNrm[0] * tan[0] + rawNrm[1] * tan[1] + rawNrm[2] * tan[2];
  const orthoNrm: [number, number, number] = [
    rawNrm[0] - dotTN * tan[0],
    rawNrm[1] - dotTN * tan[1],
    rawNrm[2] - dotTN * tan[2],
  ];
  const nrmLen = Math.hypot(orthoNrm[0], orthoNrm[1], orthoNrm[2]) || 1.0;
  const nrm: [number, number, number] = [orthoNrm[0] / nrmLen, orthoNrm[1] / nrmLen, orthoNrm[2] / nrmLen];

  const binorm: [number, number, number] = [
    tan[1] * nrm[2] - tan[2] * nrm[1],
    tan[2] * nrm[0] - tan[0] * nrm[2],
    tan[0] * nrm[1] - tan[1] * nrm[0],
  ];

  return { arcMm, pos, tan, nrm, binorm };
}
