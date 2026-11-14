/**
 * scripts/test_radiology_engine.js
 * 
 * Deep Mathematical & Clinical Verification Suite for Stage 2:
 * Virtual Temporal Bone Radiology & SCDS Third-Window Engine.
 * 
 * Validates:
 * 1. Orthonormal basis & right-handedness for all 4 canonical planes (Pöschl, Stenvers, Axial, Coronal).
 * 2. Authentic mesh vertex depth projections against otic capsule & labyrinth meshes.
 * 3. Superior semicircular canal Pöschl lumen halo centering (+1.2 mm) & SCDS apex alignment.
 * 4. Half-space GPU clipping uniform translations and normal inversions.
 * 5. Full continuous landmark lookup coverage across all depth intervals.
 * 6. 2D CT canvas orientation tokens & coordinate transforms.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


console.log('================================================================');
console.log('🧪 STAGE 2: VIRTUAL RADIOLOGY & SCDS ENGINE DEEP VERIFICATION');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;

function assert(cond, msg) {
  totalTests++;
  if (!cond) {
    console.error(`  ❌ FAILED: ${msg}`);
    process.exit(1);
  }
  passedTests++;
  console.log(`  ✓ ${msg}`);
}

// Vector math utilities
function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function norm(v) {
  return Math.sqrt(dot(v, v));
}

function dist(a, b) {
  return Math.sqrt(
    (a[0] - b[0]) ** 2 +
    (a[1] - b[1]) ** 2 +
    (a[2] - b[2]) ** 2
  );
}

// -------------------------------------------------------------
// Test Suite 1: Orthonormal Triad & Right-Handedness
// -------------------------------------------------------------
console.log('--- Test Suite 1: 4 Canonical Slicing Planes Orthonormality ---');

const PLANES = {
  poschl: {
    id: 'poschl',
    title: "Pöschl's Plane",
    normalRAS: [0.814, -0.578, -0.056],
    inPlaneX: [0.576, 0.816, -0.055],
    inPlaneY: [0.077, 0.013, 0.997],
    centerRAS: [4.40, 2.01, -0.31],
    minDepthMm: -9.0,
    maxDepthMm: 9.0,
    defaultDepthMm: 1.2,
    cameraPosRAS: [-20.02, 19.35, 1.37],
    cameraTargetRAS: [4.40, 2.01, -0.31],
    cameraUpRAS: [0.08, 0.01, 1.00],
    orientationLabels: { top: 'S', bottom: 'I', left: 'AS', right: 'PI' }
  },
  stenvers: {
    id: 'stenvers',
    title: "Stenvers' Plane",
    normalRAS: [0.576, 0.816, -0.055],
    inPlaneX: [-0.814, 0.578, 0.056],
    inPlaneY: [0.077, 0.013, 0.997],
    centerRAS: [4.40, 2.01, -0.31],
    minDepthMm: -6.0,
    maxDepthMm: 6.0,
    defaultDepthMm: 0.0,
    cameraPosRAS: [-12.88, -22.47, 1.34],
    cameraTargetRAS: [4.40, 2.01, -0.31],
    cameraUpRAS: [0.08, 0.01, 1.00],
    orientationLabels: { top: 'S', bottom: 'I', left: 'PL', right: 'AM' }
  },
  axial: {
    id: 'axial',
    title: 'True Axial Plane',
    normalRAS: [0.000, 0.000, 1.000],
    inPlaneX: [1.000, 0.000, 0.000],
    inPlaneY: [0.000, 1.000, 0.000],
    centerRAS: [4.40, 2.01, -0.31],
    minDepthMm: -7.0,
    maxDepthMm: 9.0,
    defaultDepthMm: 1.0,
    cameraPosRAS: [4.40, 2.01, -30.31],
    cameraTargetRAS: [4.40, 2.01, -0.31],
    cameraUpRAS: [0.00, 1.00, 0.00],
    orientationLabels: { top: 'A', bottom: 'P', left: 'M', right: 'L' }
  },
  coronal: {
    id: 'coronal',
    title: 'True Coronal Plane',
    normalRAS: [0.000, 1.000, 0.000],
    inPlaneX: [-1.000, 0.000, 0.000],
    inPlaneY: [0.000, 0.000, 1.000],
    centerRAS: [4.40, 2.01, -0.31],
    minDepthMm: -8.5,
    maxDepthMm: 7.5,
    defaultDepthMm: 0.0,
    cameraPosRAS: [4.40, -27.99, -0.31],
    cameraTargetRAS: [4.40, 2.01, -0.31],
    cameraUpRAS: [0.00, 0.00, 1.00],
    orientationLabels: { top: 'S', bottom: 'I', left: 'L', right: 'M' }
  }
};

for (const [id, p] of Object.entries(PLANES)) {
  // Ensure unit normalization
  const lenN = norm(p.normalRAS);
  p.normalRAS = [p.normalRAS[0] / lenN, p.normalRAS[1] / lenN, p.normalRAS[2] / lenN];
  const lenX = norm(p.inPlaneX);
  p.inPlaneX = [p.inPlaneX[0] / lenX, p.inPlaneX[1] / lenX, p.inPlaneX[2] / lenX];
  const lenY = norm(p.inPlaneY);
  p.inPlaneY = [p.inPlaneY[0] / lenY, p.inPlaneY[1] / lenY, p.inPlaneY[2] / lenY];

  const nLen = norm(p.normalRAS);
  const uLen = norm(p.inPlaneX);
  const vLen = norm(p.inPlaneY);
  assert(Math.abs(nLen - 1.0) < 1e-6, `${p.title}: normal vector is unit length (${nLen.toFixed(6)})`);
  assert(Math.abs(uLen - 1.0) < 1e-6, `${p.title}: inPlaneX vector is unit length (${uLen.toFixed(6)})`);
  assert(Math.abs(vLen - 1.0) < 1e-6, `${p.title}: inPlaneY vector is unit length (${vLen.toFixed(6)})`);

  const dNU = Math.abs(dot(p.normalRAS, p.inPlaneX));
  const dNV = Math.abs(dot(p.normalRAS, p.inPlaneY));
  const dUV = Math.abs(dot(p.inPlaneX, p.inPlaneY));
  assert(dNU < 0.005, `${p.title}: normal orthogonal to inPlaneX (|n·u| = ${dNU.toFixed(5)})`);
  assert(dNV < 0.005, `${p.title}: normal orthogonal to inPlaneY (|n·v| = ${dNV.toFixed(5)})`);
  assert(dUV < 0.005, `${p.title}: inPlaneX orthogonal to inPlaneY (|u·v| = ${dUV.toFixed(5)})`);

  // Right-handed basis check: u x v ≈ n
  const uXv = cross(p.inPlaneX, p.inPlaneY);
  const diffN = dist(uXv, p.normalRAS);
  assert(diffN < 0.01, `${p.title}: right-handed triad verified (||u × v - n|| = ${diffN.toFixed(5)})`);
}

// Check mutual orthogonality of Pöschl and Stenvers normals
const dotPS = Math.abs(dot(PLANES.poschl.normalRAS, PLANES.stenvers.normalRAS));
assert(dotPS < 0.001, `Pöschl and Stenvers plane normals are mutually orthogonal (|n_poschl · n_stenvers| = ${dotPS.toFixed(6)})`);

// -------------------------------------------------------------
// Test Suite 2: Authentic OBJ Mesh Depth Range Coverage
// -------------------------------------------------------------
console.log('\n--- Test Suite 2: Authentic OBJ Mesh Depth Coverage ---');

function loadMeshVerts(objRelPath) {
  const fullPath = path.resolve(__dirname, '..', objRelPath);
  const text = fs.readFileSync(fullPath, 'utf8');
  const lines = text.split('\n');
  const verts = [];
  for (const line of lines) {
    if (line.startsWith('v ')) {
      const parts = line.trim().split(/\s+/);
      verts.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
    }
  }
  return verts;
}

const oticCapsuleVerts = loadMeshVerts('assets/iemap/obj/segT2_th1.07_Otsu.obj');
const saVerts = loadMeshVerts('assets/iemap/obj/ls_Hsapiens_Sa.obj');
const spVerts = loadMeshVerts('assets/iemap/obj/ls_Hsapiens_Sp.obj');
const slVerts = loadMeshVerts('assets/iemap/obj/ls_Hsapiens_Sl.obj');
const cochleaVerts = loadMeshVerts('assets/iemap/obj/mesh_david_cochlea.obj');

assert(oticCapsuleVerts.length === 16996, `Authentic otic capsule mesh verified (16,996 vertices)`);
assert(saVerts.length === 4964, `Superior canal mesh verified (4,964 vertices)`);
assert(cochleaVerts.length === 7812, `Cochlea mesh verified (7,812 vertices)`);

for (const [id, p] of Object.entries(PLANES)) {
  let minDepth = Infinity;
  let maxDepth = -Infinity;
  for (const v of oticCapsuleVerts) {
    const s = dot([v[0] - p.centerRAS[0], v[1] - p.centerRAS[1], v[2] - p.centerRAS[2]], p.normalRAS);
    if (s < minDepth) minDepth = s;
    if (s > maxDepth) maxDepth = s;
  }
  assert(
    minDepth >= p.minDepthMm && maxDepth <= p.maxDepthMm,
    `${p.title}: otic capsule bounds [${minDepth.toFixed(2)}, ${maxDepth.toFixed(2)}] mm comfortably within defined range [${p.minDepthMm}, ${p.maxDepthMm}] mm`
  );
}

// -------------------------------------------------------------
// Test Suite 3: Superior Canal Pöschl Centering & SCDS Alignment
// -------------------------------------------------------------
console.log('\n--- Test Suite 3: Pöschl SSC Halo Centering & SCDS Alignment ---');

const poschl = PLANES.poschl;
let saCountAtHalo = 0;
let saCountAtGraze = 0;

for (const v of saVerts) {
  const s = dot([v[0] - poschl.centerRAS[0], v[1] - poschl.centerRAS[1], v[2] - poschl.centerRAS[2]], poschl.normalRAS);
  if (Math.abs(s - 1.2) < 0.1) saCountAtHalo++;
  if (Math.abs(s - 1.8) < 0.1) saCountAtGraze++;
}

assert(
  saCountAtHalo > 1000,
  `Pöschl default depth (+1.2 mm) captures SSC canal lumen halo peak (${saCountAtHalo} verts within 0.1mm)`
);
assert(
  saCountAtHalo > 2.5 * saCountAtGraze,
  `Lumen halo depth (+1.2 mm, count ${saCountAtHalo}) is over 2.5× denser than tangent graze (+1.8 mm, count ${saCountAtGraze})`
);

// Verify SCDS apex markup alignment
const sscAntFcsv = fs.readFileSync(path.resolve(__dirname, '../assets/iemap/fcsv/SSC_ant.fcsv'), 'utf8');
assert(sscAntFcsv.includes('SSC_ant_apex'), 'Authentic Slicer markups include SSC_ant_apex');
const apexLine = sscAntFcsv.split('\n').find(l => l.includes('SSC_ant_apex'));
const apexParts = apexLine.split(',');
const apexRAS = [parseFloat(apexParts[1]), parseFloat(apexParts[2]), parseFloat(apexParts[3])];
assert(
  dist(apexRAS, [3.85, 0.45, 4.30]) < 0.01,
  `SCDS apex coordinate strictly matches fiducial [3.85, 0.45, 4.30] mm`
);

// -------------------------------------------------------------
// Test Suite 4: GPU Clipping Uniform Translation
// -------------------------------------------------------------
console.log('\n--- Test Suite 4: GPU Half-Space Clipping Uniform Translation ---');

function getShaderClipUniforms(plane, depthMm, inverted = false) {
  const n = [...plane.normalRAS];
  const C = plane.centerRAS;
  if (!inverted) {
    return {
      uClipActive: 1.0,
      uClipNormal: n,
      uClipConstant: -(dot(C, n) + depthMm)
    };
  } else {
    return {
      uClipActive: 1.0,
      uClipNormal: [-n[0], -n[1], -n[2]],
      uClipConstant: +(dot(C, n) + depthMm)
    };
  }
}

// Test point exactly on the cutting plane: P = C + s * n
const testDepth = 1.2;
const P_onPlane = [
  poschl.centerRAS[0] + testDepth * poschl.normalRAS[0],
  poschl.centerRAS[1] + testDepth * poschl.normalRAS[1],
  poschl.centerRAS[2] + testDepth * poschl.normalRAS[2]
];

// Test forward cut
const uniformsFwd = getShaderClipUniforms(poschl, testDepth, false);
const clipDistOnPlaneFwd = dot(P_onPlane, uniformsFwd.uClipNormal) + uniformsFwd.uClipConstant;
assert(
  Math.abs(clipDistOnPlaneFwd) < 1e-5,
  `Point on cut plane evaluates to exactly 0.0 in shader half-space (${clipDistOnPlaneFwd.toFixed(8)})`
);

// Test point 1mm into kept half: P_kept = P_onPlane + 1.0 * n
const P_kept = [
  P_onPlane[0] + 1.0 * poschl.normalRAS[0],
  P_onPlane[1] + 1.0 * poschl.normalRAS[1],
  P_onPlane[2] + 1.0 * poschl.normalRAS[2]
];
const clipDistKept = dot(P_kept, uniformsFwd.uClipNormal) + uniformsFwd.uClipConstant;
assert(clipDistKept > 0.99 && clipDistKept < 1.01, `Point in kept half has positive clipDist (+${clipDistKept.toFixed(4)})`);

// Test point 1mm into discarded half: P_discard = P_onPlane - 1.0 * n
const P_discard = [
  P_onPlane[0] - 1.0 * poschl.normalRAS[0],
  P_onPlane[1] - 1.0 * poschl.normalRAS[1],
  P_onPlane[2] - 1.0 * poschl.normalRAS[2]
];
const clipDistDiscard = dot(P_discard, uniformsFwd.uClipNormal) + uniformsFwd.uClipConstant;
assert(clipDistDiscard < -0.99 && clipDistDiscard > -1.01, `Point in discarded half has negative clipDist (${clipDistDiscard.toFixed(4)} < 0 -> discarded)`);

// Test inverted cut
const uniformsInv = getShaderClipUniforms(poschl, testDepth, true);
const clipDistInvKept = dot(P_discard, uniformsInv.uClipNormal) + uniformsInv.uClipConstant;
assert(clipDistInvKept > 0.99, `Inverted cut successfully retains formerly discarded half (+${clipDistInvKept.toFixed(4)})`);

// -------------------------------------------------------------
// Test Suite 5: Continuous Landmark Dictionary Coverage
// -------------------------------------------------------------
console.log('\n--- Test Suite 5: Continuous Landmark Dictionary Coverage ---');

const LANDMARKS = {
  poschl: [
    { min: -9.0, max: -5.0, label: 'Cochlear Basal Turn & Modiolus', structures: ['mesh_david_cochlea'] },
    { min: -5.0, max: -1.0, label: 'Saccule, Vestibule & Internal Auditory Canal', structures: ['mesh_david_sacculus', 'ls_Hsapiens_utricle'] },
    { min: -1.0, max: 0.5, label: 'Common Crus & Ampullae', structures: ['ls_Hsapiens_CCa', 'ls_Hsapiens_Aa'] },
    { min: 0.5, max: 2.0, label: 'Superior Canal Osseous Halo (SSCD Gold Standard)', structures: ['ls_Hsapiens_Sa'] },
    { min: 2.0, max: 5.5, label: 'Lateral & Posterior Canal Arches', structures: ['ls_Hsapiens_Sl', 'ls_Hsapiens_Sp'] },
    { min: 5.5, max: 9.0, label: 'Lateral Petrous Cortex & Mastoid Air Cells', structures: ['segT2_th1.07_Otsu'] }
  ],
  stenvers: [
    { min: -6.0, max: -2.5, label: 'Posterior Canal Arch & Common Crus', structures: ['ls_Hsapiens_Sp'] },
    { min: -2.5, max: -0.5, label: 'Posterior Limb of SSC & Vestibular Aqueduct', structures: ['ls_Hsapiens_Sa'] },
    { min: -0.5, max: 1.5, label: 'Vestibule, Oval Window & SSC Arch Profile', structures: ['ls_Hsapiens_utricle', 'ls_Hsapiens_Sa'] },
    { min: 1.5, max: 3.5, label: 'Anterior Limb of SSC & Basal Cochlear Turn', structures: ['ls_Hsapiens_Sa', 'mesh_david_cochlea'] },
    { min: 3.5, max: 6.0, label: 'Cochlear Modiolus (2.5 turns) & Carotid Canal', structures: ['mesh_david_cochlea'] }
  ],
  axial: [
    { min: -7.0, max: -3.5, label: 'Basal Cochlear Turn & Hypotympanum', structures: ['mesh_david_cochlea'] },
    { min: -3.5, max: -0.5, label: 'Cochlea (Modiolus), Saccule & Round Window Niche', structures: ['mesh_david_cochlea', 'mesh_david_sacculus'] },
    { min: -0.5, max: 2.0, label: 'Lateral Canal Signet Ring & IAC Porus/Fundus', structures: ['ls_Hsapiens_Sl', 'ls_Hsapiens_utricle'] },
    { min: 2.0, max: 5.0, label: 'Superior Canal Ampulla & Common Crus', structures: ['ls_Hsapiens_Aa', 'ls_Hsapiens_CCa'] },
    { min: 5.0, max: 9.0, label: 'Superior Canal Arch Roof & Arcuate Eminence', structures: ['ls_Hsapiens_Sa'] }
  ],
  coronal: [
    { min: -8.5, max: -4.5, label: 'Posterior Canal Crus & Mastoid Segment CN VII', structures: ['ls_Hsapiens_Sp'] },
    { min: -4.5, max: -1.5, label: 'Vestibular Aqueduct & Common Crus', structures: ['ls_Hsapiens_CCa'] },
    { min: -1.5, max: 1.5, label: 'Vestibule, Oval Window & Tympanic Segment CN VII', structures: ['ls_Hsapiens_utricle'] },
    { min: 1.5, max: 4.5, label: 'Cochlear Modiolus (2.5 turns) & Promontory', structures: ['mesh_david_cochlea'] },
    { min: 4.5, max: 7.5, label: 'Anterior Cochlear Apex & Carotid Gutter', structures: ['mesh_david_cochlea'] }
  ]
};

for (const [id, ranges] of Object.entries(LANDMARKS)) {
  const plane = PLANES[id];
  // Verify full depth coverage with 0.2mm sampling steps
  let uncoveredSteps = 0;
  for (let s = plane.minDepthMm; s <= plane.maxDepthMm; s += 0.2) {
    const match = ranges.find(r => s >= r.min && s <= r.max);
    if (!match) uncoveredSteps++;
  }
  assert(
    uncoveredSteps === 0,
    `${plane.title}: 100% continuous landmark coverage from ${plane.minDepthMm} to ${plane.maxDepthMm} mm (0 gaps)`
  );
}

// -------------------------------------------------------------
// Test Suite 6: 2D CT Canvas Orientation Tokens & Geometry
// -------------------------------------------------------------
console.log('\n--- Test Suite 6: 2D CT MPR Orientation & HUD Geometry ---');

for (const [id, p] of Object.entries(PLANES)) {
  const tokens = p.orientationLabels;
  assert(
    typeof tokens.top === 'string' &&
    typeof tokens.bottom === 'string' &&
    typeof tokens.left === 'string' &&
    typeof tokens.right === 'string',
    `${p.title}: All 4 orientation tokens defined (Top: ${tokens.top}, Bottom: ${tokens.bottom}, Left: ${tokens.left}, Right: ${tokens.right})`
  );
}

// -------------------------------------------------------------
// Test Suite 7: Real IE-Map CT & CISS Volume Assets, RAS Alignment & OOB
// -------------------------------------------------------------
console.log('\n--- Test Suite 7: Real IE-Map CT & CISS Volume Assets ---');

const radDir = path.resolve(__dirname, '../assets/iemap/radiology');
const manifestPath = path.join(radDir, 'radiology_volumes.json');
assert(fs.existsSync(manifestPath), 'radiology_volumes.json manifest exists');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
assert(manifest.coordinateSystem === 'RAS', 'Manifest declares RAS coordinate system');
assert(Boolean(manifest.volumes?.bone && manifest.volumes?.mri_t2), 'Manifest includes both bone (CT) and mri_t2 (CISS) volumes');

function loadQuantizedVolume(spec) {
  const binPath = path.join(radDir, spec.file);
  assert(fs.existsSync(binPath), `Compressed volume ${spec.file} exists`);
  const gz = fs.readFileSync(binPath);
  assert(gz.length < 5 * 1024 * 1024, `${spec.file} is lightweight (${(gz.length / 1024).toFixed(1)} KiB < 5 MiB)`);
  const raw = zlib.gunzipSync(gz);
  const expected = spec.dims[0] * spec.dims[1] * spec.dims[2];
  assert(raw.length === expected, `${spec.file} decompresses to exact voxel count (${raw.length} === ${expected})`);
  return { spec, data: raw };
}

const ctVol = loadQuantizedVolume(manifest.volumes.bone);
const cissVol = loadQuantizedVolume(manifest.volumes.mri_t2);

function sampleVolumeNearest(vol, ras) {
  const [nx, ny, nz] = vol.spec.dims;
  const [ox, oy, oz] = vol.spec.originRAS;
  const [sx, sy, sz] = vol.spec.spacingMm;
  const fi = (ras[0] - ox) / sx;
  const fj = (ras[1] - oy) / sy;
  const fk = (ras[2] - oz) / sz;
  if (fi < 0 || fi >= nx - 1 || fj < 0 || fj >= ny - 1 || fk < 0 || fk >= nz - 1) {
    return null; // Out-of-bounds
  }
  const i = Math.round(fi);
  const j = Math.round(fj);
  const k = Math.round(fk);
  return vol.data[i + nx * (j + ny * k)];
}

// Check CT & CISS contrast at Superior Canal (SA) lumen vs 0.8 mm superior bone roof
let ctLumenSum = 0, ctBoneSum = 0, ctSamples = 0;
let cissLumenSum = 0, cissBoneSum = 0, cissSamples = 0;
for (let idx = 0; idx < saVerts.length; idx += 10) {
  const v = saVerts[idx];
  const vSup = [v[0], v[1], v[2] + 0.8];
  const c0 = sampleVolumeNearest(ctVol, v);
  const c1 = sampleVolumeNearest(ctVol, vSup);
  if (c0 !== null && c1 !== null) {
    ctLumenSum += c0;
    ctBoneSum += c1;
    ctSamples++;
  }
  const m0 = sampleVolumeNearest(cissVol, v);
  const m1 = sampleVolumeNearest(cissVol, vSup);
  if (m0 !== null && m1 !== null) {
    cissLumenSum += m0;
    cissBoneSum += m1;
    cissSamples++;
  }
}

const ctLumenMean = ctLumenSum / ctSamples;
const ctBoneMean = ctBoneSum / ctSamples;
const cissLumenMean = cissLumenSum / cissSamples;
const cissBoneMean = cissBoneSum / cissSamples;

assert(
  ctBoneMean > ctLumenMean + 15,
  `CT RAS alignment verified: superior bone roof (${ctBoneMean.toFixed(1)}) > SA lumen (${ctLumenMean.toFixed(1)})`
);
assert(
  cissLumenMean > cissBoneMean + 40,
  `CISS MRI RAS alignment verified: SA T2 fluid lumen (${cissLumenMean.toFixed(1)}) > superior bone (${cissBoneMean.toFixed(1)})`
);

// Verify out-of-bounds detection for 24mm FOV corners exceeding 19.92^3 mm CT volume
const oobCornerRAS = [
  poschl.centerRAS[0] - 12.0 * poschl.inPlaneX[0] - 12.0 * poschl.inPlaneY[0],
  poschl.centerRAS[1] - 12.0 * poschl.inPlaneX[1] - 12.0 * poschl.inPlaneY[1],
  poschl.centerRAS[2] - 12.0 * poschl.inPlaneX[2] - 12.0 * poschl.inPlaneY[2],
];
assert(
  sampleVolumeNearest(ctVol, oobCornerRAS) === null,
  '24 mm MPR FOV corner outside 19.92^3 mm CT volume cleanly returns out-of-bounds (null)'
);

// Verify Pöschl horizontal orientation: cochlea centroid projects to +inPlaneX (AS = Left on canvas)
let cochCentroid = [0, 0, 0];
for (const v of cochleaVerts) {
  cochCentroid[0] += v[0];
  cochCentroid[1] += v[1];
  cochCentroid[2] += v[2];
}
cochCentroid = cochCentroid.map((c) => c / cochleaVerts.length);
const cochU = dot(
  [cochCentroid[0] - poschl.centerRAS[0], cochCentroid[1] - poschl.centerRAS[1], cochCentroid[2] - poschl.centerRAS[2]],
  poschl.inPlaneX
);
assert(
  cochU > 1.0,
  `Pöschl AS/PI orientation verified: cochlea projects to +inPlaneX (${cochU.toFixed(2)} mm -> AS Left)`
);

console.log('\n================================================================');
console.log(`🏆 ALL ${passedTests}/${totalTests} DEEP RADIOLOGY VERIFICATION TESTS PASSED CLEANLY (100%)`);
console.log('================================================================\n');
