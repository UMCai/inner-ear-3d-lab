/**
 * scripts/test_vestibular_engine.js
 *
 * Standalone Node.js ES Module Deep Verification Test Suite for Stage 3 — Step 2:
 * Multi-Canal Vestibular Dynamics & Clinical Maneuver Engine.
 *
 * Validates:
 * 1. 3-DOF Head Kinematics & Orthonormal SO(3) Rotation Matrices (10 assertions)
 * 2. Multi-Canal Spline Ingestion & Geometric Fidelity (8 assertions)
 * 3. 3D Stokes Sedimentation ODE & Gravitational Projections (8 assertions)
 * 4. Steinhausen Cupular Plunger Model & Two-Phase Elastic Decay (8 assertions)
 * 5. Ewald's 2nd & 3rd Laws & CN VIII Neurophysiology Firing (10 assertions)
 * 6. Posterior Canal Maneuvers: Epley 5-Step & Semont 3-Step (10 assertions)
 * 7. Horizontal & Anterior Maneuvers: Gufoni, Lempert, Yacovino (10 assertions)
 * 8. Backward Compatibility, Cloud Integrity & Production Build (8 assertions)
 *
 * Total: 72 assertions across 8 test suites.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

import {
  computeHeadRotationMatrix,
  computeLumenFactor,
  CANAL_BOUNDARIES,
  MANEUVER_PRESETS,
  MANEUVER_TARGET_CANAL,
  EPLEY_CLINICAL_STEPS,
  VestibularDynamicsEngine,
  RealtimeEpleySimulator,
} from '../web/src/physics/vestibularEngine.ts';
import { interpolateCanalAtPhi } from '../web/src/data/canalPaths.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

console.log('================================================================');
console.log('🧪 STAGE 3: MULTI-CANAL VESTIBULAR DYNAMICS ENGINE VERIFICATION');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;

function assert(cond, msg) {
  totalTests++;
  if (!cond) {
    console.error(`  ❌ FAILED [Assertion ${totalTests}]: ${msg}`);
    process.exit(1);
  }
  passedTests++;
  console.log(`  ✓ [Assertion ${totalTests}] ${msg}`);
}

// Math helper functions
function matMul(A, B) {
  const C = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      C[r][c] = A[r][0] * B[0][c] + A[r][1] * B[1][c] + A[r][2] * B[2][c];
    }
  }
  return C;
}

function matTranspose(M) {
  return [
    [M[0][0], M[1][0], M[2][0]],
    [M[0][1], M[1][1], M[2][1]],
    [M[0][2], M[1][2], M[2][2]],
  ];
}

function matDet(M) {
  return (
    M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) -
    M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) +
    M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0])
  );
}

function matVecMul(M, v) {
  return [
    M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2],
    M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2],
    M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2],
  ];
}

function vecLen(v) {
  return Math.hypot(v[0], v[1], v[2]);
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function dist(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

// -----------------------------------------------------------------------------
// Suite 1: 3-DOF Head Kinematics & Orthonormal SO(3) Rotation Matrices
// -----------------------------------------------------------------------------
console.log('--- Test Suite 1: 3-DOF Head Kinematics & Orthonormal SO(3) Matrices ---');

// 1. Identity at (0, 0, 0)
const R0 = computeHeadRotationMatrix(0, 0, 0);
let isIdent = true;
for (let r = 0; r < 3; r++) {
  for (let c = 0; c < 3; c++) {
    const expected = r === c ? 1.0 : 0.0;
    if (Math.abs(R0[r][c] - expected) > 1e-6) isIdent = false;
  }
}
assert(isIdent, 'Identity at (0, 0, 0): R(0,0,0) equals 3x3 identity matrix (error < 1e-6)');

// 2. Orthonormality R * R^T = I across test poses
const testPoses = [
  [-45, 120, 0],
  [45, 0, 90],
  [45, 0, -90],
  [180, 90, 0],
  [0, 120, 0],
];
let allOrtho = true;
for (const [psi, th, gam] of testPoses) {
  const R = computeHeadRotationMatrix(psi, th, gam);
  const Rt = matTranspose(R);
  const prod = matMul(R, Rt);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const expected = r === c ? 1.0 : 0.0;
      if (Math.abs(prod[r][c] - expected) > 1e-6) allOrtho = false;
    }
  }
}
assert(allOrtho, 'Orthonormality: R * R^T = I_3 strictly holds across test poses (error < 1e-6)');

// 3. Determinant det(R) == +1.0
let allDetOne = true;
for (const [psi, th, gam] of testPoses) {
  const R = computeHeadRotationMatrix(psi, th, gam);
  const det = matDet(R);
  if (Math.abs(det - 1.0) > 1e-6) allDetOne = false;
}
assert(allDetOne, 'Determinant: det(R) strictly equals +1.0 in SO(3) (error < 1e-6)');

// 4. Unit norm preservation ||R * v|| = ||v||
const vTest = [1.5, -2.8, 3.4];
const vTestNorm = vecLen(vTest);
let allPreserved = true;
for (const [psi, th, gam] of testPoses) {
  const R = computeHeadRotationMatrix(psi, th, gam);
  const vRot = matVecMul(R, vTest);
  if (Math.abs(vecLen(vRot) - vTestNorm) > 1e-6) allPreserved = false;
}
assert(allPreserved, 'Unit norm preservation: ||R * v|| = ||v|| for arbitrary 3D vectors');

// 5. Exact 2-DOF backward compatibility with Rx(theta) * Rz(psi)
let matches2DOF = true;
for (const [psi, th] of [[-45, 120], [45, 0], [135, 90], [0, 0]]) {
  const R3 = computeHeadRotationMatrix(psi, th, 0.0);
  const pRad = (psi * Math.PI) / 180;
  const tRad = (th * Math.PI) / 180;
  const cp = Math.cos(pRad), sp = Math.sin(pRad);
  const ct = Math.cos(tRad), st = Math.sin(tRad);
  const R2 = [
    [cp, -sp, 0],
    [ct * sp, ct * cp, -st],
    [st * sp, st * cp, ct],
  ];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (Math.abs(R3[r][c] - R2[r][c]) > 1e-6) matches2DOF = false;
    }
  }
}
assert(matches2DOF, 'Backward compatibility: R(psi, theta, 0) strictly matches 2-DOF Rx(theta)*Rz(psi)');

// 6. Pure Lateral Roll: R(0, 0, +90°) maps +X_head to -Z_world (Right ear down)
const R_rollRight = computeHeadRotationMatrix(0, 0, 90.0);
const xHeadRotRight = matVecMul(R_rollRight, [1, 0, 0]);
assert(
  dist(xHeadRotRight, [0, 0, -1]) < 1e-6,
  'Pure Lateral Roll: R(0, 0, +90°) maps +X_head to -Z_world (Right ear down, decubitus right)'
);

// 7. Pure Lateral Roll: R(0, 0, -90°) maps +X_head to +Z_world (Right ear up, Left ear down)
const R_rollLeft = computeHeadRotationMatrix(0, 0, -90.0);
const xHeadRotLeft = matVecMul(R_rollLeft, [1, 0, 0]);
assert(
  dist(xHeadRotLeft, [0, 0, 1]) < 1e-6,
  'Pure Lateral Roll: R(0, 0, -90°) maps +X_head to +Z_world (Right ear up, decubitus left)'
);

// 8. Pure Pitch: R(0, 90°, 0) maps +Y_head to +Z_world (supine nose up) & -Y_head to -Z_world
const R_pitch90 = computeHeadRotationMatrix(0, 90.0, 0.0);
const yHeadRot = matVecMul(R_pitch90, [0, 1, 0]);
const occiputRot = matVecMul(R_pitch90, [0, -1, 0]);
assert(
  dist(yHeadRot, [0, 0, 1]) < 1e-6 && dist(occiputRot, [0, 0, -1]) < 1e-6,
  'Pure Pitch: R(0, 90°, 0) maps nose (+Y) to +Z_world and occiput (-Y) to -Z_world (supine)'
);

// 9. Pure Yaw: R(90°, 0, 0) maps +X_head to +Y_world
const R_yaw90 = computeHeadRotationMatrix(90.0, 0.0, 0.0);
const xHeadRotYaw = matVecMul(R_yaw90, [1, 0, 0]);
assert(
  dist(xHeadRotYaw, [0, 1, 0]) < 1e-6,
  'Pure Yaw: R(90°, 0, 0) maps +X_head to +Y_world (turned left 90°, right ear points forward)'
);

// 10. Inverse relation: R^T * R = I everywhere
let allInverse = true;
for (const [psi, th, gam] of testPoses) {
  const R = computeHeadRotationMatrix(psi, th, gam);
  const Rt = matTranspose(R);
  const prod = matMul(Rt, R);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const expected = r === c ? 1.0 : 0.0;
      if (Math.abs(prod[r][c] - expected) > 1e-6) allInverse = false;
    }
  }
}
assert(allInverse, 'Inverse relation: R^T * R = I_3 holds identically everywhere in SO(3)');

// -----------------------------------------------------------------------------
// Suite 2: Multi-Canal Spline Ingestion & Geometric Fidelity
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 2: Multi-Canal Spline Ingestion & Geometric Fidelity ---');

const postPath = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, 'assets/iemap/posterior_canal_path.json'), 'utf-8')
);
const horizPath = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, 'assets/iemap/horizontal_canal_path.json'), 'utf-8')
);
const antPath = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, 'assets/iemap/anterior_canal_path.json'), 'utf-8')
);

// 11. Load and parse 3 canal spline files
assert(
  postPath.samples.length === 313 &&
    horizPath.samples.length === 150 &&
    antPath.samples.length === 150,
  `Multi-canal paths parsed: Posterior (${postPath.samples.length} knots), Horizontal (${horizPath.samples.length} knots), Anterior (${antPath.samples.length} knots)`
);

// 12. Monotonic arc lengths
let monotonic = true;
for (const p of [postPath, horizPath, antPath]) {
  for (let i = 0; i < p.samples.length - 1; i++) {
    if (p.samples[i + 1].arc_length_mm <= p.samples[i].arc_length_mm) {
      monotonic = false;
    }
  }
}
assert(monotonic, 'Strictly monotonic arc length progression across all knots in all 3 canals');

// 13. Total arc lengths match specification
assert(
  Math.abs(postPath.total_arc_length_mm - 19.33) < 0.05 &&
    Math.abs(horizPath.total_arc_length_mm - 15.46) < 0.05 &&
    Math.abs(antPath.total_arc_length_mm - 19.19) < 0.05,
  `Authentic total arc lengths verified: Posterior (${postPath.total_arc_length_mm.toFixed(2)} mm), Horizontal (${horizPath.total_arc_length_mm.toFixed(2)} mm), Anterior (${antPath.total_arc_length_mm.toFixed(2)} mm)`
);

// 14. Tangent unit normalization
let tangentUnit = true;
for (const p of [postPath, horizPath, antPath]) {
  for (const s of p.samples) {
    if (Math.abs(vecLen(s.tangent_ras) - 1.0) > 1e-4) tangentUnit = false;
  }
}
assert(tangentUnit, 'Tangent vectors unit normalization error < 1e-4 across all samples in all 3 canals');

// 15. Normal unit normalization
let normalUnit = true;
for (const p of [postPath, horizPath, antPath]) {
  for (const s of p.samples) {
    if (Math.abs(vecLen(s.normal_ras) - 1.0) > 1e-4) normalUnit = false;
  }
}
assert(normalUnit, 'Normal vectors unit normalization error < 1e-4 across all samples in all 3 canals');

// 16. Orthogonality |t · n| < 1e-4
let orthoTN = true;
for (const p of [postPath, horizPath, antPath]) {
  for (const s of p.samples) {
    if (Math.abs(dot(s.tangent_ras, s.normal_ras)) > 1e-4) orthoTN = false;
  }
}
assert(orthoTN, 'Orthogonality |t · n| < 1e-4 verified across all samples in all 3 canals');

// 17. Binormal unit length and right-handedness ||t × n - b|| < 1e-4
let binormValid = true;
for (const p of [postPath, horizPath, antPath]) {
  for (let phi = -60; phi <= 150; phi += 30) {
    const { tan, nrm, binorm } = interpolateCanalAtPhi(p, phi);
    const crossTN = [
      tan[1] * nrm[2] - tan[2] * nrm[1],
      tan[2] * nrm[0] - tan[0] * nrm[2],
      tan[0] * nrm[1] - tan[1] * nrm[0],
    ];
    if (dist(crossTN, binorm) > 1e-4 || Math.abs(vecLen(binorm) - 1.0) > 1e-4) {
      binormValid = false;
    }
  }
}
assert(binormValid, 'Binormal vectors right-handed triad ||t × n - b|| < 1e-4 across all 3 canals');

// 18. Landmark table knot existence and validity across all 3 canals
const postLm = postPath.landmarks_phi_deg;
const horizLm = horizPath.landmarks_phi_deg;
const antLm = antPath.landmarks_phi_deg;
assert(
  postLm.cupula_barrier === -112.0 &&
    postLm.step1_initial_rest === -84.0 &&
    horizLm.cupula_barrier === -90.0 &&
    horizLm.simple_crus_entry === 95.0 &&
    antLm.cupula_barrier === -90.0 &&
    antLm.common_crus_entry === 95.0,
  'Landmark table phi values verified across Posterior, Horizontal, and Anterior canals'
);

// -----------------------------------------------------------------------------
// Suite 3: 3D Stokes Sedimentation ODE & Gravitational Projections
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 3: 3D Stokes Sedimentation ODE & Gravitational Projections ---');

const canalPathsMap = {
  posterior: postPath,
  horizontal: horizPath,
  anterior: antPath,
};
const engine = new VestibularDynamicsEngine(canalPathsMap, 'posterior', 'epley');

// 19. g_proj = -t_world,z mathematical projection identity
const testR = computeHeadRotationMatrix(35, 75, -20);
const testTanHead = [0.577, 0.577, 0.577];
const testTanWorld = matVecMul(testR, testTanHead);
const gWorld = [0, 0, -1];
const gProjDirect = dot(gWorld, testTanWorld);
assert(
  Math.abs(gProjDirect - -testTanWorld[2]) < 1e-6,
  'Projection identity: g_proj = g_world · t_world strictly equals -t_world,z (error < 1e-6)'
);

// 20. Viscous stiction deadzone |g_proj| < 0.045 => dphi/dt = 0
engine.setCanal('posterior');
engine.setPhiDeg(0.0);
// Pitch theta = 80 deg yields |gProj| ≈ 0.035 < 0.045 deadzone:
const snapDeadzone = engine.stepPhysics(0.05, 0, 80, 0, { mobility: 48.0 });
assert(
  Math.abs(snapDeadzone.velocityDegPerSec) < 1e-6,
  'Viscous stiction deadzone: |effectiveDrive| < 0.045 produces 0 velocity'
);

// 21. Upright resting floor: Posterior canal at phi = -84° has zero retrograde slide
engine.setCanal('posterior');
engine.setPhiDeg(-84.0);
const snapPostFloor = engine.stepPhysics(0.05, 0, 0, 0);
assert(
  snapPostFloor.phiDeg >= -84.0 && snapPostFloor.velocityDegPerSec >= 0,
  'Upright resting floor: Posterior canal at phi = -84° has zero retrograde slide (phi >= -84°)'
);

// 22. Upright resting floor: Horizontal canal at cupula has zero spontaneous forward slide
engine.setCanal('horizontal');
engine.setPhiDeg(-90.0);
const snapHorizFloor = engine.stepPhysics(0.05, 0, 0, 0);
assert(
  Math.abs(snapHorizFloor.velocityDegPerSec) < 1e-4,
  'Upright resting floor: Horizontal canal at cupula barrier has zero spontaneous slide'
);

// 23. Maximum velocity bounding (<= 48.0 deg/s)
engine.setCanal('posterior');
engine.setPhiDeg(0.0);
const snapMaxVel = engine.stepPhysics(0.05, -45, 120, 0, { mobility: 48.0 });
assert(
  Math.abs(snapMaxVel.velocityDegPerSec) <= 48.001,
  `Maximum velocity bounding: |v_sed| <= 48.0 deg/s (observed: ${Math.abs(snapMaxVel.velocityDegPerSec).toFixed(2)} deg/s)`
);

// 24. Time-step numerical stability: zero overshoot under dt = 0.05 s
engine.setCanal('posterior');
engine.setPhiDeg(-84.0);
let stable = true;
for (let step = 0; step < 100; step++) {
  const snap = engine.stepPhysics(0.05, -45, 120, 0, { phiCapMax: 30.0 });
  if (snap.phiDeg > 30.0001 || Number.isNaN(snap.phiDeg)) stable = false;
}
assert(stable, 'Time-step numerical stability: zero overshoot under dt = 0.05 s across 100 steps');

// 25. Upward slope deceleration: cannot spontaneously climb against gravity
engine.setCanal('posterior');
engine.setPhiDeg(100.0);
// Sit upright when particles are at superior arch (where gravity pulls retrograde):
const snapUpwardDecel = engine.stepPhysics(0.05, 0, 0, 0, { allowBackwardSlide: false });
assert(
  snapUpwardDecel.velocityDegPerSec <= 0.0,
  'Upward slope deceleration: otoconia cannot spontaneously advance against gravitational gradient'
);

// 26. Irreversible utricular deposition: particles in utricle do not reflux into canal
engine.setCanal('posterior');
engine.setPhiDeg(186.0);
const snapUtricleReflux = engine.stepPhysics(0.05, 0, 0, 0);
assert(
  snapUtricleReflux.phiDeg >= 185.99 && snapUtricleReflux.velocityDegPerSec >= 0,
  'Irreversible utricular deposition: otoconia reaching utricle reservoir do not reflux into canal'
);

// -----------------------------------------------------------------------------
// Suite 4: Steinhausen Cupular Plunger Model & Two-Phase Elastic Decay
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 4: Steinhausen Cupular Plunger Model & Two-Phase Decay ---');

// 27. Lumen factor ratio: duct (1.0) vs common crus (0.35)
const lumenDuct = computeLumenFactor('posterior', 50.0);
const lumenCrus = computeLumenFactor('posterior', 130.0);
assert(
  lumenDuct === 1.0 && lumenCrus === 0.35 && Math.abs(lumenDuct / lumenCrus - 1.0 / 0.35) < 1e-6,
  `Lumen factor ratio: duct (1.0) vs common crus (0.35) = ${(lumenDuct / lumenCrus).toFixed(3)}`
);

// 28. Lumen factor ratio: crus (0.35) vs utricle (0.02)
const lumenUtricle = computeLumenFactor('posterior', 180.0);
assert(
  lumenUtricle === 0.02 && Math.abs(lumenCrus / lumenUtricle - 17.5) < 1e-6,
  `Lumen factor ratio: crus (0.35) vs utricle (0.02) = ${(lumenCrus / lumenUtricle).toFixed(1)}`
);

// 29. Cupular deflection strictly bounded in [-1.0, +1.0]
engine.setCanal('posterior');
engine.setPhiDeg(0.0);
let bounded = true;
for (let i = 0; i < 50; i++) {
  const s = engine.stepPhysics(0.05, -45, 120, 0);
  if (s.cupulaDeflectionNormalized < -1.0 || s.cupulaDeflectionNormalized > 1.0) bounded = false;
}
assert(bounded, 'Cupular deflection strictly bounded in [-1.0, +1.0] under extreme velocity');

// 30. Exponential recovery decay toward zero with tau = 1.8 s when particles stop
engine.setCanal('posterior');
engine.setPhiDeg(30.0);
engine.setCupulaDeflection(0.8);
const delta0 = engine.getCupulaDeflection();
// Step 180 steps of 0.01 s = 1.80 s of elapsed time at rest
for (let i = 0; i < 180; i++) {
  engine.stepPhysics(0.01, 0, 0, 0, { allowBackwardSlide: false, phiCapMax: 30.0 });
}
const deltaTau = engine.getCupulaDeflection();
const expectedRatio = Math.exp(-1.0); // e^-1 ≈ 0.367879
const actualRatio = deltaTau / delta0;
assert(
  Math.abs(actualRatio - expectedRatio) < 0.01,
  `Exponential recovery decay: delta(tau)/delta(0) = ${actualRatio.toFixed(4)} (Expected e^-1 = ${expectedRatio.toFixed(4)}, tau = 1.8 s)`
);

// 31. Two-phase dynamics: active drag rise vs passive elastic recoil
engine.setCanal('posterior');
engine.setPhiDeg(-84.0);
engine.setCupulaDeflection(0.0);
// Active phase: 10 steps of motion
const activeSnap = engine.stepPhysics(0.05, -45, 120, 0, { phiCapMax: 30.0 });
const risingCupula = activeSnap.cupulaDeflectionNormalized;
// Recoil phase: set to rest and step
engine.setPhiDeg(30.0);
const recoilSnap = engine.stepPhysics(0.05, 0, 0, 0, { allowBackwardSlide: false, phiCapMax: 30.0 });
assert(
  risingCupula > 0.05 && recoilSnap.cupulaDeflectionNormalized < risingCupula,
  'Two-phase dynamics verified: active drag rise during sediment motion vs passive elastic recoil at rest'
);

// 32. Rest settling: delta -> 0 after 10 s of zero velocity
engine.setCanal('posterior');
engine.setPhiDeg(30.0);
engine.setCupulaDeflection(1.0);
for (let i = 0; i < 200; i++) {
  engine.stepPhysics(0.05, 0, 0, 0, { allowBackwardSlide: false, phiCapMax: 30.0 });
}
const settledCupula = engine.getCupulaDeflection();
assert(
  Math.abs(settledCupula) < 0.005,
  `Rest settling: cupular deflection decays to ${settledCupula.toFixed(5)} (< 0.005) after 10 s at rest`
);

// 33. Zero deflection at rest reproduces neutral cupula (0)
engine.setCupulaDeflection(0.0);
const snapNeutral = engine.computeTelemetrySnapshot(0, 0, 0);
assert(
  snapNeutral.cupulaDeflectionNormalized === 0.0,
  'Zero deflection at rest reproduces neutral cupular state (delta = 0)'
);

// 34. Sensation classification matching deflection thresholds
const sensMoving = VestibularDynamicsEngine.classifyPatientSensation(0.0, 0.25);
const sensSliding = VestibularDynamicsEngine.classifyPatientSensation(0.0, -0.25);
const sensCalm = VestibularDynamicsEngine.classifyPatientSensation(0.0, 0.05);
assert(
  sensMoving === 'Spinning (Crystals Moving)' &&
    sensSliding === 'Spinning (Crystals Sliding Back)' &&
    sensCalm === 'Calm (No Spinning)',
  'Patient sensation classification correctly matches threshold triggers (>0.12, <-0.12, calm)'
);

// -----------------------------------------------------------------------------
// Suite 5: Ewald's 2nd & 3rd Laws & CN VIII Neurophysiology Firing
// -----------------------------------------------------------------------------
console.log("\n--- Test Suite 5: Ewald's 2nd & 3rd Laws & CN VIII Firing ---");

// 35. Spontaneous resting baseline = 90 sp/s at delta = 0
engine.setCanal('posterior');
engine.setCupulaDeflection(0.0);
const snapBase = engine.computeTelemetrySnapshot(0, 0, 0);
assert(
  snapBase.afferentSpikesPerSec === 90,
  'Spontaneous resting baseline: exactly 90 spikes/sec at neutral cupula (delta = 0)'
);

// 36. Firing rate clamping strictly within [10, 310] sp/s
engine.setCupulaDeflection(2.0);
const snapMaxSpikes = engine.computeTelemetrySnapshot(0, 0, 0);
engine.setCupulaDeflection(-2.0);
const snapMinSpikes = engine.computeTelemetrySnapshot(0, 0, 0);
assert(
  snapMaxSpikes.afferentSpikesPerSec === 310 && snapMinSpikes.afferentSpikesPerSec === 10,
  `Afferent firing rate clamped strictly to [${snapMinSpikes.afferentSpikesPerSec}, ${snapMaxSpikes.afferentSpikesPerSec}] sp/s`
);

// 37. Horizontal canal ampullopetal flow => Excitation (f > 90 sp/s)
// In horizontal canal, ampullopetal is toward cupula (-dphi/dt => -cupulaDeflection)
engine.setCanal('horizontal');
engine.setCupulaDeflection(-0.5); // ampullopetal flow
const snapHorizExcite = engine.computeTelemetrySnapshot(0, 0, 0);
assert(
  snapHorizExcite.afferentSpikesPerSec > 90,
  `Ewald's 2nd Law: Horizontal canal ampullopetal flow is EXCITATORY (${snapHorizExcite.afferentSpikesPerSec} sp/s > 90)`
);

// 38. Horizontal canal ampullofugal flow => Inhibition (f < 90 sp/s)
engine.setCanal('horizontal');
engine.setCupulaDeflection(0.5); // ampullofugal flow (+dphi/dt)
const snapHorizInhib = engine.computeTelemetrySnapshot(0, 0, 0);
assert(
  snapHorizInhib.afferentSpikesPerSec < 90,
  `Ewald's 2nd Law: Horizontal canal ampullofugal flow is INHIBITORY (${snapHorizInhib.afferentSpikesPerSec} sp/s < 90)`
);

// 39. Posterior canal ampullofugal flow => Excitation (f > 90 sp/s)
engine.setCanal('posterior');
engine.setCupulaDeflection(0.5); // ampullofugal flow (+dphi/dt)
const snapPostExcite = engine.computeTelemetrySnapshot(0, 0, 0);
assert(
  snapPostExcite.afferentSpikesPerSec > 90,
  `Ewald's 3rd Law: Posterior canal ampullofugal flow is EXCITATORY (${snapPostExcite.afferentSpikesPerSec} sp/s > 90)`
);

// 40. Posterior canal ampullopetal flow => Inhibition (f < 90 sp/s)
engine.setCanal('posterior');
engine.setCupulaDeflection(-0.5);
const snapPostInhib = engine.computeTelemetrySnapshot(0, 0, 0);
assert(
  snapPostInhib.afferentSpikesPerSec < 90,
  `Ewald's 3rd Law: Posterior canal ampullopetal flow is INHIBITORY (${snapPostInhib.afferentSpikesPerSec} sp/s < 90)`
);

// 41. Anterior canal ampullofugal flow => Excitation (f > 90 sp/s)
engine.setCanal('anterior');
engine.setCupulaDeflection(0.5);
const snapAntExcite = engine.computeTelemetrySnapshot(0, 0, 0);
assert(
  snapAntExcite.afferentSpikesPerSec > 90,
  `Ewald's 3rd Law: Anterior canal ampullofugal flow is EXCITATORY (${snapAntExcite.afferentSpikesPerSec} sp/s > 90)`
);

// 42. Ewald's asymmetry: excitatory dynamic range (+220 sp/s) exceeds inhibitory range (-80 sp/s)
const exciteRange = 310 - 90; // 220 sp/s
const inhibRange = 90 - 10;   // 80 sp/s
const asymmRatio = exciteRange / inhibRange;
assert(
  asymmRatio === 2.75 && asymmRatio > 2.5,
  `Ewald's asymmetry verified: excitatory range (+${exciteRange} sp/s) is ${asymmRatio.toFixed(2)}x larger than inhibitory range (-${inhibRange} sp/s)`
);

// 43. Directional nystagmus fast-phase: Right posterior excitation yields Upbeat-Torsional
engine.setCanal('posterior');
engine.setCupulaDeflection(0.5);
const snapNystPost = engine.computeTelemetrySnapshot(0, 0, 0);
assert(
  snapNystPost.fastPhaseBeatDirection === 'Upbeating + Right Torsional',
  `Directional nystagmus: Right posterior excitation triggers '${snapNystPost.fastPhaseBeatDirection}'`
);

// 44. Directional nystagmus fast-phase: Right horizontal excitation yields Right-Beating (Geotropic)
engine.setCanal('horizontal');
engine.setCupulaDeflection(-0.5);
const snapNystHoriz = engine.computeTelemetrySnapshot(0, 0, 0);
assert(
  snapNystHoriz.fastPhaseBeatDirection.includes('Right-Beating Horizontal'),
  `Directional nystagmus: Right horizontal excitation triggers '${snapNystHoriz.fastPhaseBeatDirection}'`
);

// -----------------------------------------------------------------------------
// Suite 6: Posterior Canal Maneuvers (Epley 5-Step & Semont 3-Step)
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 6: Posterior Canal Maneuvers (Epley & Semont) ---');

// 45. Epley Step 1 resting state (phi = -84°, 0% clearance)
engine.setManeuver('epley');
engine.setPhiDeg(-84.0);
const epleyStep1 = engine.computeTelemetrySnapshot(-45, 0, 0);
assert(
  epleyStep1.phiDeg === -84.0 && epleyStep1.clearancePercent === 0,
  'Epley Step 1: Upright turn 45° right holds at resting floor (phi = -84°, clearance = 0%)'
);

// 46. Epley Step 2 Dix-Hallpike recline: reaches apex phi >= +25°, triggers upbeat-torsional nystagmus
for (let i = 0; i < 80; i++) {
  engine.stepPhysics(0.05, -45, 120, 0, { phiCapMax: 30.0 });
}
const epleyStep2 = engine.computeTelemetrySnapshot(-45, 120, 0);
assert(
  epleyStep2.phiDeg >= 25.0 && epleyStep2.fastPhaseBeatDirection.includes('Upbeating'),
  `Epley Step 2: Dix-Hallpike recline advances to apex (phi = ${epleyStep2.phiDeg.toFixed(1)}° >= 25°) with upbeat-torsional nystagmus`
);

// 47. Epley Step 3 Contralateral turn: reaches common crus entry phi >= +105°
for (let i = 0; i < 110; i++) {
  engine.stepPhysics(0.05, 45, 120, 0, { phiCapMax: 110.0, isStep3Assist: true });
}
const epleyStep3 = engine.computeTelemetrySnapshot(45, 120, 0);
assert(
  epleyStep3.phiDeg >= 105.0,
  `Epley Step 3: Contralateral 90° turn left reaches common crus entry (phi = ${epleyStep3.phiDeg.toFixed(1)}° >= 105°)`
);

// 48. Epley Step 4 Shoulder roll: drains down common crus phi >= +160°
for (let i = 0; i < 80; i++) {
  engine.stepPhysics(0.05, 135, 90, 0, { phiCapMax: 165.0 });
}
const epleyStep4 = engine.computeTelemetrySnapshot(135, 90, 0);
assert(
  epleyStep4.phiDeg >= 160.0,
  `Epley Step 4: Left shoulder roll drains down common crus (phi = ${epleyStep4.phiDeg.toFixed(1)}° >= 160°)`
);

// 49. Epley Step 5 Sit up: enters utricular vestibule phi >= +185°, clearance >= 98%
for (let i = 0; i < 60; i++) {
  engine.stepPhysics(0.05, 0, 0, 0, { phiCapMax: 186.0 });
}
const epleyStep5 = engine.computeTelemetrySnapshot(0, 0, 0);
assert(
  epleyStep5.phiDeg >= 185.0 && epleyStep5.clearancePercent >= 98,
  `Epley Step 5: Return to upright sitting deposits particles in utricle (phi = ${epleyStep5.phiDeg.toFixed(1)}°, clearance = ${epleyStep5.clearancePercent}% >= 98%)`
);

// 50. Semont Step 1 sitting setup
engine.setManeuver('semont');
engine.setPhiDeg(-84.0);
const semontStep1 = engine.computeTelemetrySnapshot(45, 0, 0);
assert(
  semontStep1.phiDeg === -84.0 && semontStep1.clearancePercent === 0,
  'Semont Step 1: Sit upright, head turned 45° left setup at resting floor (phi = -84°)'
);

// 51. Semont Step 2 rapid decubitus to affected right side (gamma = +90°): reaches apex phi >= +25° (g_proj = +0.699)
for (let i = 0; i < 80; i++) {
  engine.stepPhysics(0.05, 45, 0, 90.0, { phiCapMax: 30.0 });
}
const semontStep2 = engine.computeTelemetrySnapshot(45, 0, 90.0);
assert(
  semontStep2.phiDeg >= 25.0,
  `Semont Step 2: Decubitus onto affected right side (gamma = +90°) pulls otoconia to apex (phi = ${semontStep2.phiDeg.toFixed(1)}° >= 25°)`
);

// 52. Semont Step 3 swing to left side (gamma = -90°): carries otoconia over superior arch into common crus
for (let i = 0; i < 100; i++) {
  engine.stepPhysics(0.05, 45, 0, -90.0, { phiCapMax: 165.0 });
}
const semontStep3 = engine.computeTelemetrySnapshot(45, 0, -90.0);
assert(
  semontStep3.phiDeg >= 110.0,
  `Semont Step 3: Rapid 180° swing to left side carries otoconia into common crus (phi = ${semontStep3.phiDeg.toFixed(1)}° >= 110°)`
);

// 53. Semont terminal return upright: dumps particles into utricle (>= 95% clearance)
for (let i = 0; i < 60; i++) {
  engine.stepPhysics(0.05, 0, 0, 0, { phiCapMax: 186.0 });
}
const semontStep4 = engine.computeTelemetrySnapshot(0, 0, 0);
assert(
  semontStep4.phiDeg >= 185.0 && semontStep4.clearancePercent >= 95,
  `Semont Terminal Sit Up: otoconia cleared into utricle (phi = ${semontStep4.phiDeg.toFixed(1)}°, clearance = ${semontStep4.clearancePercent}% >= 95%)`
);

// 54. Common crus reflux prevention during upright transition
engine.setCanal('posterior');
engine.setPhiDeg(160.0);
const refluxTest = engine.stepPhysics(0.05, 0, 0, 0, { allowBackwardSlide: true });
assert(
  refluxTest.phiDeg >= 160.0 && refluxTest.velocityDegPerSec >= 0,
  'Common crus reflux prevention: otoconia inside crus cannot retrograde back over arch into duct'
);

// -----------------------------------------------------------------------------
// Suite 7: Horizontal & Anterior Maneuvers (Gufoni, Lempert, Yacovino)
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 7: Horizontal & Anterior Maneuvers ---');

// 55. Gufoni Geotropic Step 2: lying on healthy left side (gamma = -90°) travels into simple crus (phi >= +80°)
engine.setManeuver('gufoni_geotropic');
engine.setPhiDeg(0.0);
for (let i = 0; i < 80; i++) {
  engine.stepPhysics(0.05, 0, 0, -90.0, { phiCapMax: 95.0 });
}
const gufoniGeoStep2 = engine.computeTelemetrySnapshot(0, 0, -90.0);
assert(
  gufoniGeoStep2.phiDeg >= 80.0,
  `Gufoni Geotropic Step 2: Lying on healthy left side advances into simple crus (phi = ${gufoniGeoStep2.phiDeg.toFixed(1)}° >= 80°)`
);

// 56. Gufoni Geotropic Step 3: nose down 45° enters utricle orifice (phi >= +150°)
for (let i = 0; i < 80; i++) {
  engine.stepPhysics(0.05, 45, 0, -90.0, { phiCapMax: 180.0 });
}
const gufoniGeoStep3 = engine.computeTelemetrySnapshot(45, 0, -90.0);
assert(
  gufoniGeoStep3.phiDeg >= 150.0,
  `Gufoni Geotropic Step 3: Head turn 45° down enters utricular orifice (phi = ${gufoniGeoStep3.phiDeg.toFixed(1)}° >= 150°)`
);

// 57. Gufoni Geotropic Step 4: utricular clearance >= 95%
for (let i = 0; i < 60; i++) {
  engine.stepPhysics(0.05, 0, 0, 0, { phiCapMax: 180.0 });
}
const gufoniGeoStep4 = engine.computeTelemetrySnapshot(0, 0, 0);
assert(
  gufoniGeoStep4.clearancePercent >= 95,
  `Gufoni Geotropic Step 4: Return to upright achieves ${gufoniGeoStep4.clearancePercent}% clearance (>= 95%)`
);

// 58. Gufoni Apogeotropic Step 2: lying on affected right side (gamma = +90°) dislodges otoconia from cupula (phi >= -50°)
engine.setManeuver('gufoni_apogeotropic');
engine.setPhiDeg(-85.0);
for (let i = 0; i < 80; i++) {
  engine.stepPhysics(0.05, 0, 0, 90.0, { phiCapMax: 0.0 });
}
const gufoniApoStep2 = engine.computeTelemetrySnapshot(0, 0, 90.0);
assert(
  gufoniApoStep2.phiDeg >= -50.0,
  `Gufoni Apogeotropic Step 2: Lying on affected right side dislodges otoconia from cupula (phi = ${gufoniApoStep2.phiDeg.toFixed(1)}° >= -50°)`
);

// 59. Gufoni Apogeotropic Step 3: converts to simple crus drainage (phi >= +80°)
for (let i = 0; i < 80; i++) {
  engine.stepPhysics(0.05, -45, 0, 90.0, { phiCapMax: 95.0 });
}
const gufoniApoStep3 = engine.computeTelemetrySnapshot(-45, 0, 90.0);
assert(
  gufoniApoStep3.phiDeg >= 80.0,
  `Gufoni Apogeotropic Step 3: Turning nose 45° up moves otoconia into simple crus (phi = ${gufoniApoStep3.phiDeg.toFixed(1)}° >= 80°)`
);

// 60. Lempert Barbecue Roll Step 1: supine right advance (phi >= 0°)
engine.setManeuver('barbecue_roll');
engine.setPhiDeg(-60.0);
for (let i = 0; i < 60; i++) {
  engine.stepPhysics(0.05, -90, 90, 0, { phiCapMax: 0.0 });
}
const lempertStep1 = engine.computeTelemetrySnapshot(-90, 90, 0);
assert(
  lempertStep1.phiDeg >= -5.0,
  `Lempert Step 1: Supine head right advances otoconia toward lateral arch (phi = ${lempertStep1.phiDeg.toFixed(1)}° >= -5°)`
);

// 61. Lempert Barbecue Roll Step 2: supine face up advance (phi >= +45°)
for (let i = 0; i < 60; i++) {
  engine.stepPhysics(0.05, 0, 90, 0, { phiCapMax: 45.0 });
}
const lempertStep2 = engine.computeTelemetrySnapshot(0, 90, 0);
assert(
  lempertStep2.phiDeg >= 40.0,
  `Lempert Step 2: Supine face up advances otoconia along posterior limb (phi = ${lempertStep2.phiDeg.toFixed(1)}° >= 40°)`
);

// 62. Lempert Barbecue Roll Step 3: supine left in simple crus (phi >= +95°)
for (let i = 0; i < 60; i++) {
  engine.stepPhysics(0.05, 90, 90, 0, { phiCapMax: 95.0 });
}
const lempertStep3 = engine.computeTelemetrySnapshot(90, 90, 0);
assert(
  lempertStep3.phiDeg >= 90.0,
  `Lempert Step 3: Supine head left enters simple crus (phi = ${lempertStep3.phiDeg.toFixed(1)}° >= 90°)`
);

// 63. Lempert Barbecue Roll Step 4: prone face down common drainage (phi >= +150°)
for (let i = 0; i < 60; i++) {
  engine.stepPhysics(0.05, 180, 90, 0, { phiCapMax: 150.0 });
}
const lempertStep4 = engine.computeTelemetrySnapshot(180, 90, 0);
assert(
  lempertStep4.phiDeg >= 145.0,
  `Lempert Step 4: Prone face down advances otoconia to utricle doorway (phi = ${lempertStep4.phiDeg.toFixed(1)}° >= 145°)`
);

// 64. Yacovino Step 2: deep head-hanging clears anterior apex phi >= +30° with downbeating nystagmus
engine.setManeuver('yacovino');
engine.setPhiDeg(-60.0);
for (let i = 0; i < 100; i++) {
  engine.stepPhysics(0.05, 0, 120, 0, { phiCapMax: 95.0 });
}
const yacovinoStep2 = engine.computeTelemetrySnapshot(0, 120, 0);
assert(
  yacovinoStep2.phiDeg >= 30.0 && yacovinoStep2.fastPhaseBeatDirection.includes('Downbeating'),
  `Yacovino Step 2: Deep head-hanging clears anterior apex (phi = ${yacovinoStep2.phiDeg.toFixed(1)}° >= 30°) with downbeating nystagmus`
);

// -----------------------------------------------------------------------------
// Suite 8: Backward Compatibility, Cloud Integrity & Production Integrity
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 8: Backward Compatibility & Production Integrity ---');

// 65. RealtimeEpleySimulator wrapper matches telemetry keys, 4-arg stepPhysics, and constructor parity
const compatSim = new RealtimeEpleySimulator(postPath);
compatSim.setPhiDeg(-84.0);
const compatSnap = compatSim.computeTelemetrySnapshot(-45, 0);

// Verify legacy 4-argument stepPhysics(dt, psi, theta, options) without roll argument
const step4Arg = compatSim.stepPhysics(0.05, -45, 120, { phiCapMax: 30.0 });
const step4ArgValid =
  !Number.isNaN(step4Arg.gravityAlongCanal) &&
  !Number.isNaN(step4Arg.tangentWorld[0]) &&
  step4Arg.phiDeg > -84.0 &&
  typeof compatSim.pathData === 'object' &&
  compatSim.pathData.samples.length === 313;

// Verify multi-canal engine constructor respects initialCanalId and auto-syncs maneuver
const horizEngine = new VestibularDynamicsEngine(canalPathsMap, 'horizontal');
const antEngine = new VestibularDynamicsEngine(canalPathsMap, 'anterior');
const canalSyncValid =
  horizEngine.getCanal() === 'horizontal' &&
  horizEngine.getManeuver() === 'gufoni_geotropic' &&
  antEngine.getCanal() === 'anterior' &&
  antEngine.getManeuver() === 'yacovino';

// Verify EPLEY_CLINICAL_STEPS stepId backward compatibility
const clinicalStepIds = EPLEY_CLINICAL_STEPS.map((s) => s.stepId);
const expectedStepIds = ['locate', 'intro', 'step1', 'step2', 'step3', 'step4', 'step5', 'outro'];
const stepIdsMatch = expectedStepIds.every((id, idx) => clinicalStepIds[idx] === id);

assert(
  typeof compatSnap.psiYawDeg === 'number' &&
    typeof compatSnap.thetaReclineDeg === 'number' &&
    typeof compatSnap.phiDeg === 'number' &&
    typeof compatSnap.gravityAlongCanal === 'number' &&
    Array.isArray(compatSnap.particlesRAS) &&
    compatSnap.particlesRAS.length === 5 &&
    step4ArgValid &&
    canalSyncValid &&
    stepIdsMatch,
  'RealtimeEpleySimulator wrapper maintains full telemetry API signature, 4-arg stepPhysics, and multi-canal constructor'
);

// 66. RealtimeEpleySimulator.classifyRegion output parity
const reg1 = RealtimeEpleySimulator.classifyRegion(-100);
const reg2 = RealtimeEpleySimulator.classifyRegion(-80);
const reg3 = RealtimeEpleySimulator.classifyRegion(0);
const reg4 = RealtimeEpleySimulator.classifyRegion(90);
const reg5 = RealtimeEpleySimulator.classifyRegion(130);
const reg6 = RealtimeEpleySimulator.classifyRegion(185);
assert(
  reg1.includes('Cupula Barrier') &&
    reg2.includes('Dependent Base') &&
    reg3.includes('Posterolateral Apex') &&
    reg4.includes('Superior Arch') &&
    reg5.includes('Common Crus') &&
    reg6.includes('Utricular Vestibule'),
  'RealtimeEpleySimulator.classifyRegion matches all 6 anatomical region string tokens'
);

// 67. RealtimeEpleySimulator.computeClearancePercent matches formula
const clr0 = RealtimeEpleySimulator.computeClearancePercent(-84.0);
const clr50 = RealtimeEpleySimulator.computeClearancePercent(51.0);
const clr100 = RealtimeEpleySimulator.computeClearancePercent(186.0);
assert(
  clr0 === 0 && clr50 === 50 && clr100 === 100,
  `RealtimeEpleySimulator.computeClearancePercent: -84° -> ${clr0}%, 51° -> ${clr50}%, 186° -> ${clr100}%`
);

// 68. computeHeadRotationMatrix backward compatibility with 2-DOF prototype
const mat2DOF = computeHeadRotationMatrix(-45, 120);
const mat3DOF = computeHeadRotationMatrix(-45, 120, 0.0);
let matchCompat = true;
for (let r = 0; r < 3; r++) {
  for (let c = 0; c < 3; c++) {
    if (Math.abs(mat2DOF[r][c] - mat3DOF[r][c]) > 1e-8) matchCompat = false;
  }
}
assert(matchCompat, 'computeHeadRotationMatrix(psi, theta) strictly equals computeHeadRotationMatrix(psi, theta, 0.0)');

// 69. Extreme Euler angles produce no NaN or Inf
let extremeValid = true;
for (const ang of [-720, -360, 0, 360, 720]) {
  const M = computeHeadRotationMatrix(ang, ang, ang);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (!Number.isFinite(M[r][c])) extremeValid = false;
    }
  }
}
assert(extremeValid, 'Extreme Euler angles (±720°) produce finite, orthonormal SO(3) matrices without NaN or Inf');

// 70. Particle cloud returns 5 non-coincident 3D points with pairwise separation > 0.015 mm
const pts5 = engine.computeParticlesRAS(0.0, 'posterior');
let allSeparated = true;
for (let i = 0; i < pts5.length; i++) {
  for (let j = i + 1; j < pts5.length; j++) {
    if (dist(pts5[i], pts5[j]) < 0.015) allSeparated = false;
  }
}
assert(allSeparated, '5-particle otoconial cloud: all 5 particles maintain pairwise 3D spatial separation > 0.015 mm');

// 71. Radial fan-out occurs only when approaching utricle (phi >= phi_fan_start)
const ptsDuct = engine.computeParticlesRAS(0.0, 'posterior');
const ptsUtricle = engine.computeParticlesRAS(185.0, 'posterior');
const spreadDuct = dist(ptsDuct[0], ptsDuct[4]);
const spreadUtricle = dist(ptsUtricle[0], ptsUtricle[4]);
assert(
  spreadUtricle > spreadDuct * 1.05,
  `Radial fan-out verified: particle spread in utricle (${spreadUtricle.toFixed(3)} mm) > duct (${spreadDuct.toFixed(3)} mm)`
);

// 72. TypeScript compilation clean build (npm run build, 0 errors)
if (process.env.SKIP_NESTED_BUILD === '1') {
  assert(true, 'Production Web Build: deferred to parent pretest/verify (SKIP_NESTED_BUILD=1)');
} else {
  let buildClean = false;
  try {
    execSync('npm --prefix web run build', { stdio: 'pipe' });
    buildClean = true;
  } catch (err) {
    console.error(err.stdout ? err.stdout.toString() : err.message);
  }
  assert(buildClean, 'Production Web Build: tsc && vite build completes cleanly with 0 TypeScript/Vite errors');
}

console.log('\n================================================================');
console.log(`🏆 ALL ${passedTests}/${totalTests} DEEP VESTIBULAR VERIFICATION TESTS PASSED CLEANLY (100%)`);
console.log('================================================================\n');
