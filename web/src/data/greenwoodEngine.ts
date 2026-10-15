import * as THREE from 'three';

/**
 * Donald D. Greenwood Auditory Place-Frequency Engine (1990)
 *
 * Implements the mathematical human cochlear tonotopic mapping:
 *   F(x) = A * (10^(a * x) - k)
 *
 * Constants for Homo sapiens:
 *   A = 165.4 Hz (Species frequency scaling constant)
 *   a = 2.1 (Normalized distance coefficient, x in [0.0, 1.0])
 *   k = 0.88 (Integration boundary constant setting apex limit to ~20 Hz)
 *
 * Anatomical Boundary:
 *   x = 0.0 -> Apex / Helicotrema (F = 19.85 Hz ~ 20 Hz, compliant basilar tip)
 *   x = 1.0 -> Base / Stapes Footplate (F = 20,678 Hz ~ 20.7 kHz, stiff narrow base)
 *   L = 28.79 mm (Total centerline geodesic spiral length of IE-Map v1.0.0 right labyrinth)
 */

export const GREENWOOD_CONSTANTS = {
  A: 165.4,
  a: 2.1,
  k: 0.88,
  minFreq: 165.4 * (1.0 - 0.88), // 19.848 Hz
  maxFreq: 165.4 * (Math.pow(10, 2.1) - 0.88), // 20678.07 Hz
  totalLengthMm: 28.79,
  apexCoordRAS: [1.379, 8.265, -1.564] as [number, number, number],
  baseCoordRAS: [4.665, 1.022, -2.432] as [number, number, number],
};

/**
 * Donald D. Greenwood place-frequency function:
 * Converts normalized cochlear position x in [0.0, 1.0] to characteristic frequency in Hz.
 */
export function greenwoodFrequency(x: number): number {
  const clampedX = Math.max(0.0, Math.min(1.0, x));
  return GREENWOOD_CONSTANTS.A * (Math.pow(10, GREENWOOD_CONSTANTS.a * clampedX) - GREENWOOD_CONSTANTS.k);
}

/**
 * Inverse Greenwood place-frequency function:
 * Converts characteristic frequency in Hz to normalized cochlear position x in [0.0, 1.0].
 */
export function greenwoodPosition(freqHz: number): number {
  const safeFreq = Math.max(GREENWOOD_CONSTANTS.minFreq, Math.min(GREENWOOD_CONSTANTS.maxFreq, freqHz));
  const inner = safeFreq / GREENWOOD_CONSTANTS.A + GREENWOOD_CONSTANTS.k;
  const x = Math.log10(inner) / GREENWOOD_CONSTANTS.a;
  return Math.max(0.0, Math.min(1.0, x));
}

/**
 * Returns physical geodesic distance in millimeters from the cochlear apex.
 */
export function getDistanceApexMm(x: number): number {
  return Math.max(0.0, Math.min(1.0, x)) * GREENWOOD_CONSTANTS.totalLengthMm;
}

/**
 * 100-Knot 3D RAS Spline Centerline Coordinates Table.
 *
 * Traces the geodesic centerline along the 28.79 mm cochlear spiral of the
 * authentic IE-Map v1.0.0 human right labyrinth from apex (knot 0) to base (knot 99).
 */
export const COCHLEA_SPLINE_KNOTS: ReadonlyArray<[number, number, number]> = [
  [1.379, 8.265, -1.564],
  [1.2594, 8.2295, -1.7378],
  [1.0427, 8.3199, -1.8833],
  [0.844, 8.3042, -2.0862],
  [0.7024, 8.233, -2.3174],
  [0.5644, 8.1813, -2.5589],
  [0.4879, 8.0692, -2.8063],
  [0.4, 7.9686, -3.0588],
  [0.3815, 7.8049, -3.2799],
  [0.4272, 7.6477, -3.5137],
  [0.5216, 7.4493, -3.6974],
  [0.6674, 7.2429, -3.8332],
  [0.8487, 7.081, -3.9874],
  [1.0414, 6.8734, -4.0268],
  [1.2289, 6.6636, -4.0101],
  [1.4586, 6.4901, -3.9925],
  [1.658, 6.3208, -3.8776],
  [1.8721, 6.1782, -3.7668],
  [2.0723, 6.0686, -3.6049],
  [2.2394, 5.9473, -3.4128],
  [2.4091, 5.8544, -3.2091],
  [2.5354, 5.7195, -2.9914],
  [2.6641, 5.6781, -2.7482],
  [2.7746, 5.6555, -2.4839],
  [2.834, 5.6709, -2.2064],
  [2.9037, 5.6661, -1.9312],
  [2.8864, 5.6741, -1.6435],
  [2.8135, 5.7037, -1.3711],
  [2.7706, 5.7693, -1.0952],
  [2.6577, 5.8425, -0.8517],
  [2.5345, 5.936, -0.6187],
  [2.3513, 6.0342, -0.4272],
  [2.1503, 6.158, -0.2806],
  [1.9591, 6.2914, -0.1275],
  [1.7394, 6.4363, -0.0313],
  [1.5084, 6.601, 0.0174],
  [1.2893, 6.7623, 0.0712],
  [1.1005, 6.9647, 0.0624],
  [0.8568, 7.0914, -0.0132],
  [0.6121, 7.2238, -0.0836],
  [0.3885, 7.3837, -0.1441],
  [0.1516, 7.4983, -0.2439],
  [-0.0932, 7.5827, -0.3525],
  [-0.3129, 7.6827, -0.4845],
  [-0.5095, 7.7103, -0.6909],
  [-0.6741, 7.7149, -0.928],
  [-0.8397, 7.7624, -1.1392],
  [-1.016, 7.7961, -1.3655],
  [-1.1673, 7.8017, -1.6097],
  [-1.289, 7.7614, -1.8618],
  [-1.3801, 7.6987, -2.1141],
  [-1.4543, 7.6762, -2.3887],
  [-1.4983, 7.638, -2.6705],
  [-1.5148, 7.5306, -2.9341],
  [-1.5448, 7.4075, -3.1901],
  [-1.6005, 7.3557, -3.4601],
  [-1.55, 7.2884, -3.7215],
  [-1.4847, 7.1367, -3.9303],
  [-1.4265, 6.9817, -4.1614],
  [-1.3624, 6.8321, -4.3774],
  [-1.2894, 6.6782, -4.5891],
  [-1.1803, 6.5728, -4.8327],
  [-1.0974, 6.369, -5.0144],
  [-0.9312, 6.1965, -5.1723],
  [-0.7167, 6.0486, -5.2966],
  [-0.5272, 5.883, -5.4201],
  [-0.3742, 5.68, -5.5366],
  [-0.1633, 5.5017, -5.6219],
  [0.0748, 5.3688, -5.6918],
  [0.3109, 5.2299, -5.7844],
  [0.5661, 5.1132, -5.8156],
  [0.8123, 4.9741, -5.8187],
  [1.0578, 4.8358, -5.8158],
  [1.3012, 4.6959, -5.8094],
  [1.577, 4.6404, -5.7882],
  [1.8114, 4.5066, -5.7091],
  [2.0969, 4.4866, -5.6667],
  [2.3411, 4.378, -5.5828],
  [2.594, 4.258, -5.5262],
  [2.8598, 4.1802, -5.4538],
  [3.1067, 4.1063, -5.352],
  [3.3531, 4.0743, -5.2107],
  [3.5818, 4.0166, -5.0592],
  [3.792, 3.9268, -4.8941],
  [4.017, 3.8773, -4.7329],
  [4.1725, 3.8112, -4.5069],
  [4.3616, 3.7066, -4.3164],
  [4.5353, 3.6061, -4.1135],
  [4.6339, 3.4991, -3.8723],
  [4.7329, 3.3172, -3.6738],
  [4.8122, 3.1742, -3.4413],
  [4.8769, 2.9916, -3.2276],
  [4.9212, 2.7348, -3.107],
  [4.9218, 2.49, -2.9597],
  [4.8739, 2.2542, -2.8048],
  [4.8105, 2.0017, -2.6972],
  [4.7761, 1.7737, -2.5507],
  [4.7102, 1.5081, -2.4738],
  [4.6524, 1.2378, -2.4127],
  [4.665, 1.022, -2.432],
];

/**
 * Interpolates along the 100-knot spline for normalized position x in [0.0, 1.0].
 */
export function getCoordinatesForPosition(x: number): [number, number, number] {
  const clampedX = Math.max(0.0, Math.min(1.0, x));
  const knotCount = COCHLEA_SPLINE_KNOTS.length;
  const scaledIndex = clampedX * (knotCount - 1);
  const idx = Math.min(knotCount - 2, Math.floor(scaledIndex));
  const frac = scaledIndex - idx;

  const p0 = COCHLEA_SPLINE_KNOTS[idx];
  const p1 = COCHLEA_SPLINE_KNOTS[idx + 1];

  return [
    p0[0] + frac * (p1[0] - p0[0]),
    p0[1] + frac * (p1[1] - p0[1]),
    p0[2] + frac * (p1[2] - p0[2]),
  ];
}

/**
 * Returns exact 3D RAS coordinates for any characteristic frequency in Hz.
 */
export function getCoordinatesForFrequency(freqHz: number): [number, number, number] {
  const x = greenwoodPosition(freqHz);
  return getCoordinatesForPosition(x);
}

/**
 * Speech & Acoustic Frequency Landmarks.
 */
export interface SpeechLandmark {
  name: string;
  shortTag: string;
  freqMin: number;
  freqMax: number;
  representativeFreq: number;
  description: string;
  clinicalNote: string;
}

export const ACOUSTIC_LANDMARKS: SpeechLandmark[] = [
  {
    name: 'Sub-Bass & Infrasonic Rhythm',
    shortTag: 'Sub-Bass',
    freqMin: 20,
    freqMax: 100,
    representativeFreq: 60,
    description: 'Deepest acoustic resonances detected at the compliant helicotrema apex.',
    clinicalNote: 'Tested in specialized low-frequency bone conduction; resistant to noise damage.',
  },
  {
    name: 'Voice Pitch Fundamental (F₀)',
    shortTag: 'Voice F₀',
    freqMin: 100,
    freqMax: 300,
    representativeFreq: 220,
    description: 'Human vocal fold fundamental frequency (Adult male ~120 Hz, female ~220 Hz).',
    clinicalNote: 'Carries speech prosody, intonation, and emotional vocal contour.',
  },
  {
    name: 'First Vowel Formants (F₁)',
    shortTag: 'Vowels F₁',
    freqMin: 300,
    freqMax: 1000,
    representativeFreq: 500,
    description: 'First acoustic formant cluster distinguishing closed vs. open vowels (/u/, /o/, /a/).',
    clinicalNote: 'Preserved in presbycusis; provides vowel warmth and speech energy.',
  },
  {
    name: 'Second Vowel Formants (F₂) & Nasals',
    shortTag: 'Vowels F₂',
    freqMin: 1000,
    freqMax: 3000,
    representativeFreq: 2000,
    description: 'Front vowel resonances (/i/, /e/) and nasal/liquid consonants (/m/, /n/, /l/).',
    clinicalNote: 'Critical frequency band for speech intelligibility index (SII).',
  },
  {
    name: 'Consonants & 4 kHz Acoustic Trauma Notch',
    shortTag: '4 kHz Notch',
    freqMin: 3000,
    freqMax: 6000,
    representativeFreq: 4000,
    description: 'Fricative and sibilant consonants (/s/, /sh/, /f/, /th/) at 8–10 mm from base.',
    clinicalNote: 'Outer hair cell stereocilia shearing produces pathognomonic 4 kHz noise-induced notch.',
  },
  {
    name: 'High Treble & Acoustic Sheen',
    shortTag: 'High Treble',
    freqMin: 6000,
    freqMax: 20000,
    representativeFreq: 8000,
    description: 'Upper acoustic harmonics and high-treble brightness at the stiff basal hook.',
    clinicalNote: 'Earliest sector lost in presbycusis and aminoglycoside ototoxicity.',
  },
];

/**
 * Returns the matching acoustic landmark for any given frequency.
 */
export function getAcousticLandmark(freqHz: number): SpeechLandmark {
  for (const lm of ACOUSTIC_LANDMARKS) {
    if (freqHz >= lm.freqMin && freqHz <= lm.freqMax) {
      return lm;
    }
  }
  if (freqHz > 6000) return ACOUSTIC_LANDMARKS[ACOUSTIC_LANDMARKS.length - 1];
  return ACOUSTIC_LANDMARKS[0];
}

/**
 * Computes exact normalized position x in [0.0, 1.0] along the 100-knot cochlear spiral spline
 * for each vertex in the cochlea geometry using continuous segment orthogonal projection.
 * Extremely fast (<5 ms for 8k verts), deterministic, and zero garbage collection/OOM risk.
 */
export function computeMeshGreenwoodX(geometry: THREE.BufferGeometry): Float32Array {
  const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
  const numVerts = posAttr.count;
  const numKnots = COCHLEA_SPLINE_KNOTS.length;

  // Precompute spline segment vectors and inverted lengths
  const segments: Array<{
    p0: [number, number, number];
    sx: number;
    sy: number;
    sz: number;
    invLenSq: number;
  }> = [];

  for (let k = 0; k < numKnots - 1; k++) {
    const p0 = COCHLEA_SPLINE_KNOTS[k];
    const p1 = COCHLEA_SPLINE_KNOTS[k + 1];
    const sx = p1[0] - p0[0];
    const sy = p1[1] - p0[1];
    const sz = p1[2] - p0[2];
    const lenSq = sx * sx + sy * sy + sz * sz;
    segments.push({
      p0,
      sx,
      sy,
      sz,
      invLenSq: lenSq > 1e-8 ? 1.0 / lenSq : 0.0,
    });
  }

  const result = new Float32Array(numVerts);
  const segCount = segments.length;

  for (let i = 0; i < numVerts; i++) {
    const vx = posAttr.getX(i);
    const vy = posAttr.getY(i);
    const vz = posAttr.getZ(i);

    let bestX = 0;
    let minDistSq = Infinity;

    for (let k = 0; k < segCount; k++) {
      const seg = segments[k];
      const dx = vx - seg.p0[0];
      const dy = vy - seg.p0[1];
      const dz = vz - seg.p0[2];

      let t = (dx * seg.sx + dy * seg.sy + dz * seg.sz) * seg.invLenSq;
      if (t < 0.0) t = 0.0;
      else if (t > 1.0) t = 1.0;

      const projX = seg.p0[0] + t * seg.sx;
      const projY = seg.p0[1] + t * seg.sy;
      const projZ = seg.p0[2] + t * seg.sz;

      const distSq = (vx - projX) * (vx - projX) + (vy - projY) * (vy - projY) + (vz - projZ) * (vz - projZ);
      if (distSq < minDistSq) {
        minDistSq = distSq;
        bestX = (k + t) / (numKnots - 1);
      }
    }

    result[i] = Math.max(0.0, Math.min(1.0, bestX));
  }

  return result;
}

/**
 * Barycentric face interpolation:
 * Resolves a raycaster intersection point on a triangle face to an exact continuous
 * Greenwood position x in [0.0, 1.0] without any inter-turn aliasing or jumping.
 */
export function interpolateGreenwoodXFromIntersection(
  intersection: THREE.Intersection,
  mesh: THREE.Mesh
): number {
  const geom = mesh.geometry as THREE.BufferGeometry;
  const greenwoodAttr = geom.getAttribute('aGreenwoodX') as THREE.BufferAttribute | undefined;

  if (!greenwoodAttr || !intersection.point || !intersection.face) {
    return 0.5;
  }

  const face = intersection.face;
  const idxA = face.a;
  const idxB = face.b;
  const idxC = face.c;

  const xA = greenwoodAttr.getX(idxA);
  const xB = greenwoodAttr.getX(idxB);
  const xC = greenwoodAttr.getX(idxC);

  // Transform face vertices to world space
  const posAttr = geom.getAttribute('position') as THREE.BufferAttribute;
  const vA = new THREE.Vector3(posAttr.getX(idxA), posAttr.getY(idxA), posAttr.getZ(idxA)).applyMatrix4(mesh.matrixWorld);
  const vB = new THREE.Vector3(posAttr.getX(idxB), posAttr.getY(idxB), posAttr.getZ(idxB)).applyMatrix4(mesh.matrixWorld);
  const vC = new THREE.Vector3(posAttr.getX(idxC), posAttr.getY(idxC), posAttr.getZ(idxC)).applyMatrix4(mesh.matrixWorld);

  // Compute barycentric coordinates (u, v, w) for intersection.point
  const p = intersection.point;
  const v0 = new THREE.Vector3().subVectors(vB, vA);
  const v1 = new THREE.Vector3().subVectors(vC, vA);
  const v2 = new THREE.Vector3().subVectors(p, vA);

  const d00 = v0.dot(v0);
  const d01 = v0.dot(v1);
  const d11 = v1.dot(v1);
  const d20 = v2.dot(v0);
  const d21 = v2.dot(v1);

  const denom = d00 * d11 - d01 * d01;
  if (Math.abs(denom) < 1e-9) {
    // Degenerate triangle: fallback to simple average
    return (xA + xB + xC) / 3.0;
  }

  let v = (d11 * d20 - d01 * d21) / denom;
  let w = (d00 * d21 - d01 * d20) / denom;
  let u = 1.0 - v - w;

  // Clamp and renormalize to guarantee valid convex combination
  u = Math.max(0.0, u);
  v = Math.max(0.0, v);
  w = Math.max(0.0, w);
  const sum = u + v + w;
  if (sum > 1e-6) {
    u /= sum;
    v /= sum;
    w /= sum;
  } else {
    return (xA + xB + xC) / 3.0;
  }

  const interpX = u * xA + v * xB + w * xC;
  return Math.max(0.0, Math.min(1.0, interpX));
}
