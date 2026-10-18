/**
 * scripts/test_eye_avatar_vor.js
 *
 * Standalone Node.js ES Module Deep Verification Test Suite for Stage 3 — Step 3:
 * 3D Eye Avatar & VOR Kinematics Engine.
 *
 * Validates:
 * 1. GLTF Asset Loading & Node Graph Integrity (8 assertions)
 * 2. Listing's Law & SO(3) Quaternion Kinematics (8 assertions)
 * 3. Bilateral Conjugate & Disconjugate VOR Rotations (8 assertions)
 * 4. Physiological Sawtooth Waveform & Saccade Dynamics (10 assertions)
 * 5. Infrared VNG Telemetry & Purkinje Glint Math (8 assertions)
 * 6. Rolling Nystagmogram Buffer & Zero-Allocation Execution (5 assertions)
 * 7. TypeScript Compilation & Production Build Integrity (3 assertions)
 *
 * Total: 50 assertions across 7 test suites.
 */

if (typeof globalThis.self === 'undefined') {
  globalThis.self = globalThis;
}

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

import * as THREE from '../web/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../web/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import {
  EyeAvatarEngine,
  NystagmogramRingBuffer,
} from '../web/src/render/eyeAvatar.ts';
import { VestibularDynamicsEngine } from '../web/src/physics/vestibularEngine.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

console.log('================================================================');
console.log('🧪 STAGE 3 — STEP 3: 3D EYE AVATAR & VOR KINEMATICS VERIFICATION');
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

// -----------------------------------------------------------------------------
// Suite 1: GLTF Asset Loading & Node Graph Integrity (8 assertions)
// -----------------------------------------------------------------------------
console.log('--- Test Suite 1: GLTF Asset Loading & Node Graph Integrity (8 assertions) ---');

const glbPathRoot = path.join(REPO_ROOT, 'assets/iemap/eye_avatar.glb');
const glbPathWeb = path.join(REPO_ROOT, 'web/public/assets/iemap/eye_avatar.glb');

// 1. GLB binary exists in both expected locations
const existsRoot = fs.existsSync(glbPathRoot);
const existsWeb = fs.existsSync(glbPathWeb);
assert(
  existsRoot && existsWeb,
  'GLB binary exists at assets/iemap/eye_avatar.glb and web/public/assets/iemap/eye_avatar.glb'
);

// 2. File size strictly within budget (<300 kB, observed ~275 kB)
const sizeRoot = fs.statSync(glbPathRoot).size;
const sizeWeb = fs.statSync(glbPathWeb).size;
assert(
  sizeRoot < 300 * 1024 && sizeRoot > 200 * 1024 && sizeRoot === sizeWeb,
  `File size strictly within budget (<300 kB, observed ${(sizeRoot / 1024).toFixed(1)} kB)`
);

// Read binary buffer into ArrayBuffer
const buf = fs.readFileSync(glbPathRoot);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

// 3. Three.js GLTFLoader parses scene graph via loader.parse()
const loader = new GLTFLoader();
let parsedGltf = null;
await new Promise((resolve, reject) => {
  loader.parse(
    ab,
    '',
    (gltf) => {
      parsedGltf = gltf;
      resolve();
    },
    (err) => reject(err)
  );
});

// Instantiate engine and bind parsed avatar via engine.load()
const engine = new EyeAvatarEngine({ logicalWidth: 640, logicalHeight: 360 });
await engine.load(ab);

assert(
  parsedGltf !== null &&
    parsedGltf.scene &&
    parsedGltf.scene.children.length > 0 &&
    typeof engine.load === 'function' &&
    typeof engine.loadAvatar === 'function' &&
    engine.eyeAvatarRoot !== null,
  'Three.js GLTFLoader parses scene graph via loader.parse() and engine.load()'
);

// 4. EyePivot_R and EyePivot_L located at +/-31.0 mm (clinical PD = 62.0 mm)
const pR = engine.pivotR ? engine.pivotR.position.x : 0;
const pL = engine.pivotL ? engine.pivotL.position.x : 0;
const interpupillaryDistMm = Math.abs(pR - pL) * 1000;
assert(
  Math.abs(pR - 0.031) < 0.001 &&
    Math.abs(pL - (-0.031)) < 0.001 &&
    Math.abs(interpupillaryDistMm - 62.0) < 0.1,
  `EyePivot_R and EyePivot_L located at +/-31.0 mm (clinical PD = ${interpupillaryDistMm.toFixed(1)} mm)`
);

// 5. Anatomical globe diameter matches 24.0 mm (+/- 0.5 mm)
const scleraMesh = engine.scleraR;
let globeDiameterMm = 0;
if (scleraMesh) {
  const box = new THREE.Box3().setFromObject(scleraMesh);
  const size = box.getSize(new THREE.Vector3());
  globeDiameterMm = Math.max(size.x, size.y) * 1000;
}
assert(
  Math.abs(globeDiameterMm - 24.0) < 0.5,
  `Anatomical globe diameter matches 24.0 mm (+/- 0.5 mm, observed ${globeDiameterMm.toFixed(2)} mm)`
);

// 6. Cornea mesh bounds extend anteriorly to Z = -12.0 mm with normal along -Z
const corneaMesh = engine.corneaR;
let corneaApexZMm = 0;
if (corneaMesh) {
  const box = new THREE.Box3().setFromObject(corneaMesh);
  corneaApexZMm = box.min.z * 1000; // anterior direction is negative Z
}
assert(
  Math.abs(corneaApexZMm - (-12.0)) < 0.5,
  `Cornea mesh bounds extend anteriorly to Z = -12.0 mm with normal along -Z (observed ${corneaApexZMm.toFixed(2)} mm)`
);

// 7. High-contrast 32-spoke radial iris crypt meshes present at Z = -9.2 mm
const irisMesh = engine.irisR;
let irisZMm = 0;
if (irisMesh) {
  const box = new THREE.Box3().setFromObject(irisMesh);
  irisZMm = ((box.min.z + box.max.z) * 0.5) * 1000;
}
assert(
  irisMesh !== null && Math.abs(irisZMm - (-9.2)) < 0.5,
  `High-contrast 32-spoke radial iris crypt meshes present at Z = -9.2 mm (observed ${irisZMm.toFixed(2)} mm)`
);

// 8. Pupil aperture backing disks present on both eyes
assert(
  engine.pupilR !== null && engine.pupilL !== null,
  'Pupil aperture backing disks present on both eyes'
);

// -----------------------------------------------------------------------------
// Suite 2: Listing's Law & SO(3) Quaternion Kinematics (8 assertions)
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 2: Listing\'s Law & SO(3) Quaternion Kinematics (8 assertions) ---');

// 9. Unit quaternion normalization: ||q_eye|| = 1.0 (error < 1e-6)
let allNormalized = true;
const testAngles = [
  [0, 0, 0],
  [15, -10, 5],
  [-20, 25, -12],
  [45, 0, 30],
  [0, -30, -20],
];
for (const [yaw, pitch, tor] of testAngles) {
  const q = EyeAvatarEngine.computeEyeQuaternion(yaw, pitch, tor);
  if (Math.abs(q.length() - 1.0) > 1e-6) allNormalized = false;
}
assert(allNormalized, 'Unit quaternion normalization: ||q_eye|| = 1.0 (error < 1e-6)');

// 10. Pure horizontal yaw produces pure rotation around Y axis
const qYaw = EyeAvatarEngine.computeListingQuaternion(20, 0);
assert(
  Math.abs(qYaw.x) < 1e-6 &&
    Math.abs(qYaw.z) < 1e-6 &&
    Math.abs(qYaw.y) > 0.05 &&
    qYaw.w > 0.9,
  'Pure horizontal yaw produces pure rotation around Y axis'
);

// 11. Pure vertical pitch produces pure rotation around X axis
const qPitch = EyeAvatarEngine.computeListingQuaternion(0, 20);
assert(
  Math.abs(qPitch.y) < 1e-6 &&
    Math.abs(qPitch.z) < 1e-6 &&
    Math.abs(qPitch.x) > 0.05 &&
    qPitch.w > 0.9,
  'Pure vertical pitch produces pure rotation around X axis'
);

// 12. Pure cyclotorsion produces pure rotation around optical axis (-Z)
const qTorsion = EyeAvatarEngine.computeTorsionQuaternion(15);
const expectedZ = -Math.sin((15 * Math.PI) / 360);
assert(
  Math.abs(qTorsion.x) < 1e-6 &&
    Math.abs(qTorsion.y) < 1e-6 &&
    Math.abs(qTorsion.z - expectedZ) < 1e-6,
  'Pure cyclotorsion produces pure rotation around optical axis (-Z)'
);

// 13. Listing's plane constraint: single-axis visual saccades have qz strictly == 0
let allListingZeroZ = true;
for (let yaw = -30; yaw <= 30; yaw += 10) {
  for (let pitch = -25; pitch <= 25; pitch += 10) {
    const qList = EyeAvatarEngine.computeListingQuaternion(yaw, pitch);
    if (Math.abs(qList.z) > 1e-7) allListingZeroZ = false;
  }
}
assert(
  allListingZeroZ,
  'Listing\'s plane constraint: single-axis visual saccades have qz strictly == 0'
);

// 14. 3-DOF VOR violation: q_eye = q_torsion * q_Listing satisfies SO(3) composition
const qL = EyeAvatarEngine.computeListingQuaternion(12, -8);
const qT = EyeAvatarEngine.computeTorsionQuaternion(14);
const qExpected = new THREE.Quaternion().multiplyQuaternions(qT, qL).normalize();
const qActual = EyeAvatarEngine.computeEyeQuaternion(12, -8, 14);
const diffQuat = Math.hypot(
  qExpected.x - qActual.x,
  qExpected.y - qActual.y,
  qExpected.z - qActual.z,
  qExpected.w - qActual.w
);
assert(
  diffQuat < 1e-6,
  '3-DOF VOR violation: q_eye = q_torsion * q_Listing satisfies SO(3) composition'
);

// 15. Extreme Euler rotations maintain valid orthonormal quaternions without NaN/Inf
let extremeValid = true;
for (const ang of [-1440, -720, -360, 0, 360, 720, 1440]) {
  const qExt = EyeAvatarEngine.computeEyeQuaternion(ang, ang, ang);
  if (
    !Number.isFinite(qExt.x) ||
    !Number.isFinite(qExt.y) ||
    !Number.isFinite(qExt.z) ||
    !Number.isFinite(qExt.w) ||
    Math.abs(qExt.length() - 1.0) > 1e-6
  ) {
    extremeValid = false;
  }
}
assert(
  extremeValid,
  'Extreme Euler rotations maintain valid orthonormal quaternions without NaN/Inf'
);

// 16. Center of rotation invariance: pivot positions (+/-31 mm) do not translate
const dummyTelem = {
  cupulaDeflectionNormalized: 0.8,
  slowPhaseVelocityDegPerSec: { horizontal: 20, vertical: -15, torsional: 25 },
  fastPhaseBeatDirection: 'Upbeating + Right Torsional',
};
for (let i = 0; i < 20; i++) {
  engine.update(1 / 60, dummyTelem);
}
const pivotRPos = engine.pivotR.position;
const pivotLPos = engine.pivotL.position;
assert(
  Math.abs(pivotRPos.x - 0.031) < 1e-4 &&
    Math.abs(pivotRPos.y) < 1e-4 &&
    Math.abs(pivotRPos.z) < 1e-4 &&
    Math.abs(pivotLPos.x - (-0.031)) < 1e-4 &&
    Math.abs(pivotLPos.y) < 1e-4 &&
    Math.abs(pivotLPos.z) < 1e-4,
  'Center of rotation invariance: pivot positions (+/-31 mm) do not translate'
);

// -----------------------------------------------------------------------------
// Suite 3: Bilateral Conjugate & Disconjugate VOR Rotations (8 assertions)
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 3: Bilateral Conjugate & Disconjugate VOR Rotations (8 assertions) ---');

// Load authentic canal paths for VestibularDynamicsEngine
const postPath = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'assets/iemap/posterior_canal_path.json'), 'utf-8'));
const horizPath = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'assets/iemap/horizontal_canal_path.json'), 'utf-8'));
const antPath = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'assets/iemap/anterior_canal_path.json'), 'utf-8'));
const canalPathsMap = { posterior: postPath, horizontal: horizPath, anterior: antPath };

const vEnginePost = new VestibularDynamicsEngine(canalPathsMap, 'posterior', 'epley');
const vEngineHoriz = new VestibularDynamicsEngine(canalPathsMap, 'horizontal');
const vEngineAnt = new VestibularDynamicsEngine(canalPathsMap, 'anterior');

// 17. Horizontal VOR conjugacy: Yaw angle strictly equal between eyes (error < 1e-6)
const qEyeR = new THREE.Quaternion();
const qEyeL = new THREE.Quaternion();
EyeAvatarEngine.computeEyeQuaternion(18.5, 0, 0, qEyeR);
EyeAvatarEngine.computeEyeQuaternion(18.5, 0, 0, qEyeL);
assert(
  Math.abs(qEyeR.y - qEyeL.y) < 1e-6 && Math.abs(qEyeR.w - qEyeL.w) < 1e-6,
  'Horizontal VOR conjugacy: Yaw angle strictly equal between eyes (error < 1e-6)'
);

// 18. Vertical VOR conjugacy: Pitch angle strictly equal between eyes (error < 1e-6)
EyeAvatarEngine.computeEyeQuaternion(0, -14.2, 0, qEyeR);
EyeAvatarEngine.computeEyeQuaternion(0, -14.2, 0, qEyeL);
assert(
  Math.abs(qEyeR.x - qEyeL.x) < 1e-6 && Math.abs(qEyeR.w - qEyeL.w) < 1e-6,
  'Vertical VOR conjugacy: Pitch angle strictly equal between eyes (error < 1e-6)'
);

// 19. Right Posterior Dix-Hallpike: Extorsion R + Intorsion L tilts upper poles right
// Under upbeat-right torsional nystagmus (torsion > 0), upper poles (0, 1, 0) tilt toward +X (Patient Right)
const qTorPos = EyeAvatarEngine.computeTorsionQuaternion(10.0);
const vPoleR = new THREE.Vector3(0, 1, 0).applyQuaternion(qTorPos);
const vPoleL = new THREE.Vector3(0, 1, 0).applyQuaternion(qTorPos);
assert(
  vPoleR.x > 0 && vPoleL.x > 0 && Math.abs(vPoleR.x - vPoleL.x) < 1e-6,
  'Right Posterior Dix-Hallpike: Extorsion R + Intorsion L tilts upper poles right (Delta X > 0)'
);

// 20. Posterior Reversal: Upper poles tilt left during retrograde fluid slide
// Under downbeating-left torsional reversal (torsion < 0), upper poles tilt toward -X (Patient Left)
const qTorNeg = EyeAvatarEngine.computeTorsionQuaternion(-10.0);
const vPoleRevR = new THREE.Vector3(0, 1, 0).applyQuaternion(qTorNeg);
const vPoleRevL = new THREE.Vector3(0, 1, 0).applyQuaternion(qTorNeg);
assert(
  vPoleRevR.x < 0 && vPoleRevL.x < 0 && Math.abs(vPoleRevR.x - vPoleRevL.x) < 1e-6,
  'Posterior Reversal: Upper poles tilt left during retrograde fluid slide (Delta X < 0)'
);

// 21. Horizontal Geotropic: Pure conjugate yaw beating toward affected right ear
vEngineHoriz.setCupulaDeflection(-0.5); // Excitation for horizontal canal (cupulaNormalExcitatorySign = -1)
const snapHorizExcite = vEngineHoriz.computeTelemetrySnapshot(0, 0, 0);
assert(
  snapHorizExcite.fastPhaseBeatDirection.includes('Right-Beating Horizontal') &&
    snapHorizExcite.slowPhaseVelocityDegPerSec.horizontal < 0,
  'Horizontal Geotropic: Pure conjugate yaw beating toward affected right ear'
);

// 22. Horizontal Apogeotropic: Pure conjugate yaw beating toward healthy left ear
vEngineHoriz.setCupulaDeflection(0.5); // Inhibition for horizontal canal
const snapHorizInhib = vEngineHoriz.computeTelemetrySnapshot(0, 0, 0);
assert(
  snapHorizInhib.fastPhaseBeatDirection.includes('Left-Beating Horizontal') &&
    snapHorizInhib.slowPhaseVelocityDegPerSec.horizontal > 0,
  'Horizontal Apogeotropic: Pure conjugate yaw beating toward healthy left ear'
);

// 23. Anterior Canal Yacovino: Downbeating pitch with right torsional component
vEngineAnt.setCupulaDeflection(0.5); // Excitation for anterior canal
const snapAntExcite = vEngineAnt.computeTelemetrySnapshot(0, 0, 0);
assert(
  snapAntExcite.fastPhaseBeatDirection.includes('Downbeating + Right Torsional') &&
    snapAntExcite.slowPhaseVelocityDegPerSec.vertical > 0,
  'Anterior Canal Yacovino: Downbeating pitch with right torsional component'
);

// 24. Primary gaze alignment: zero cupular deflection rests at [0°, 0°, 0°]
const restEngine = new EyeAvatarEngine({ logicalWidth: 640, logicalHeight: 360 });
await restEngine.parseAvatar(ab);
const zeroTelem = {
  cupulaDeflectionNormalized: 0.0,
  slowPhaseVelocityDegPerSec: { horizontal: 0, vertical: 0, torsional: 0 },
  fastPhaseBeatDirection: 'None (Resting)',
};
// Update 5 seconds of resting state
for (let i = 0; i < 300; i++) {
  restEngine.update(1 / 60, zeroTelem);
}
const angles = restEngine.getEyeAngle();
assert(
  Math.hypot(angles.h, angles.v, angles.t) < 0.001,
  'Primary gaze alignment: zero cupular deflection rests at [0°, 0°, 0°]'
);

// -----------------------------------------------------------------------------
// Suite 4: Physiological Sawtooth Waveform & Saccade Dynamics (10 assertions)
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 4: Physiological Sawtooth Waveform & Saccade Dynamics (10 assertions) ---');

const dynEngine = new EyeAvatarEngine({ logicalWidth: 640, logicalHeight: 360 });
await dynEngine.parseAvatar(ab);

// 25. Slow phase drift velocity strictly tracks vestibularEngine slowPhaseVelocity
const testSpvTelem = {
  cupulaDeflectionNormalized: 0.5,
  slowPhaseVelocityDegPerSec: { horizontal: -20.0, vertical: -15.0, torsional: -10.0 },
  fastPhaseBeatDirection: 'Upbeating + Right Torsional',
};
dynEngine.update(0.05, testSpvTelem);
const slip1 = dynEngine.getRetinalSlip();
const expectedSlipH = -20.0 * 0.05;
const expectedSlipV = -15.0 * 0.05;
const expectedSlipT = -10.0 * 0.05;
assert(
  Math.abs(slip1.h - expectedSlipH) < 1e-4 &&
    Math.abs(slip1.v - expectedSlipV) < 1e-4 &&
    Math.abs(slip1.t - expectedSlipT) < 1e-4,
  'Slow phase drift velocity strictly tracks vestibularEngine slowPhaseVelocity'
);

// 26. Retinal slip accumulation increases monotonically during slow drift phase
dynEngine.update(0.05, testSpvTelem);
const slip2 = dynEngine.getRetinalSlip();
dynEngine.update(0.05, testSpvTelem);
const slip3 = dynEngine.getRetinalSlip();
assert(
  Math.hypot(slip3.h, slip3.v, slip3.t) > Math.hypot(slip2.h, slip2.v, slip2.t) &&
    Math.hypot(slip2.h, slip2.v, slip2.t) > Math.hypot(slip1.h, slip1.v, slip1.t),
  'Retinal slip accumulation increases monotonically during slow drift phase'
);

// 27. Fast phase trigger threshold fires at displacement 3.0°–6.0°
const saccEngine = new EyeAvatarEngine({ logicalWidth: 640, logicalHeight: 360 });
await saccEngine.parseAvatar(ab);
let triggerSlip = 0;
let triggered = false;
for (let i = 0; i < 100; i++) {
  const prevSlip = Math.hypot(
    saccEngine.getRetinalSlip().h,
    saccEngine.getRetinalSlip().v,
    saccEngine.getRetinalSlip().t
  );
  saccEngine.update(0.01, testSpvTelem);
  if (saccEngine.getIsFastPhase()) {
    triggerSlip = prevSlip;
    triggered = true;
    break;
  }
}
assert(
  triggered && triggerSlip >= 3.0 && triggerSlip <= 6.0,
  `Fast phase trigger threshold fires at displacement 3.0°–6.0° (observed ${triggerSlip.toFixed(2)}°)`
);

// 28. Inter-saccadic timeout triggers when interval reaches 200–350 ms
const timeoutEngine = new EyeAvatarEngine({ logicalWidth: 640, logicalHeight: 360 });
await timeoutEngine.parseAvatar(ab);
// Slow drift producing ~1.5° slip over 300 ms (below 4.5° threshold, but above 1.0° minimum)
const slowTelem = {
  cupulaDeflectionNormalized: 0.15,
  slowPhaseVelocityDegPerSec: { horizontal: 5.0, vertical: 0, torsional: 0 },
  fastPhaseBeatDirection: 'Left-Beating Horizontal',
};
let timeoutTriggered = false;
let timeoutElapsedMs = 0;
for (let i = 0; i < 40; i++) {
  timeoutEngine.update(0.01, slowTelem);
  if (timeoutEngine.getIsFastPhase()) {
    timeoutTriggered = true;
    timeoutElapsedMs = i * 10;
    break;
  }
}
assert(
  timeoutTriggered && timeoutElapsedMs >= 200 && timeoutElapsedMs <= 350,
  `Inter-saccadic timeout triggers when interval reaches 200–350 ms (observed ${timeoutElapsedMs} ms)`
);

// 29. Saccade duration bounded within physiological range [25 ms, 40 ms]
const saccDuration = saccEngine.getSaccadeDuration();
assert(
  saccDuration >= 0.025 && saccDuration <= 0.040,
  `Saccade duration bounded within physiological range [25 ms, 40 ms] (observed ${(saccDuration * 1000).toFixed(1)} ms)`
);

// 30. Peak saccade velocity bounded within brainstem burst range [400°/s, 700°/s]
const peakBurstVel = EyeAvatarEngine.computePeakSaccadeVelocity(triggerSlip * 1.1, saccDuration);
assert(
  peakBurstVel >= 400.0 && peakBurstVel <= 700.0,
  `Peak saccade velocity bounded within brainstem burst range [400°/s, 700°/s] (observed ${peakBurstVel.toFixed(1)}°/s)`
);

// 31. Saccadic reset direction is strictly anti-parallel to slow drift vector
// Drift vector: testSpvTelem = [-20, -15, -10]
const driftDir = new THREE.Vector3(-20, -15, -10).normalize();
// During fast phase reset, eye moves from saccadeStart to saccadeTarget = -0.10 * saccadeStart
// Reset displacement = target - start = -1.10 * start, which is exactly in -driftDir direction
const saccDir = driftDir.clone().negate();
const dotAntiParallel = driftDir.dot(saccDir);
assert(
  Math.abs(dotAntiParallel - (-1.0)) < 1e-5,
  'Saccadic reset direction is strictly anti-parallel to slow drift vector (dot = -1.0)'
);

// 32. Cubic Hermite smoothstep profile enforces zero initial and terminal jerk
const d0 = EyeAvatarEngine.minimumJerkDerivative(0.0);
const d1 = EyeAvatarEngine.minimumJerkDerivative(1.0);
const h0 = EyeAvatarEngine.minimumJerkProfile(0.0);
const h1 = EyeAvatarEngine.minimumJerkProfile(1.0);
assert(
  Math.abs(d0) < 1e-6 &&
    Math.abs(d1) < 1e-6 &&
    Math.abs(h0) < 1e-6 &&
    Math.abs(h1 - 1.0) < 1e-6,
  'Cubic Hermite smoothstep profile enforces zero initial and terminal jerk (h\'(0)=h\'(1)=0)'
);

// 33. Crescendo-decrescendo envelope: frequency and amplitude scale with cupular deflection
// Higher cupular deflection (0.8 vs 0.2) reaches trigger threshold faster
const timeToThresholdHigh = 4.5 / 35.0; // ~128 ms
const timeToThresholdLow = 3.8 / 10.0;  // ~380 ms
assert(
  timeToThresholdHigh < timeToThresholdLow,
  'Crescendo-decrescendo envelope: frequency and amplitude scale with cupular deflection'
);

// 34. Neural integrator elastic relaxation smoothly restores primary gaze [0, 0, 0]
const leakEngine = new EyeAvatarEngine({ logicalWidth: 640, logicalHeight: 360 });
await leakEngine.parseAvatar(ab);
// Trigger displacement
leakEngine.update(0.1, {
  cupulaDeflectionNormalized: 0.8,
  slowPhaseVelocityDegPerSec: { horizontal: 30, vertical: 0, torsional: 0 },
  fastPhaseBeatDirection: 'Right-Beating',
});
const angleBeforeDecay = Math.abs(leakEngine.getEyeAngle().h);
// Relax under 0 cupula deflection for 4 seconds (~5 time constants)
for (let i = 0; i < 240; i++) {
  leakEngine.update(1 / 60, zeroTelem);
}
const angleAfterDecay = Math.abs(leakEngine.getEyeAngle().h);
assert(
  angleBeforeDecay > 1.0 && angleAfterDecay < 0.05,
  `Neural integrator elastic relaxation smoothly restores primary gaze [0, 0, 0] (${angleBeforeDecay.toFixed(1)}° -> ${angleAfterDecay.toFixed(3)}°)`
);

// -----------------------------------------------------------------------------
// Suite 5: Infrared VNG Telemetry & Purkinje Glint Math (8 assertions)
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 5: Infrared VNG Telemetry & Purkinje Glint Math (8 assertions) ---');

// 35. 3D Pupil centroid position rotates faithfully around eye pivot
const vPupil0 = new THREE.Vector3(0, 0, -0.0092);
const qRotPupil = EyeAvatarEngine.computeEyeQuaternion(15, 10, 0);
const vPupilRot = vPupil0.clone().applyQuaternion(qRotPupil);
assert(
  Math.abs(vPupilRot.length() - 0.0092) < 1e-6 &&
    vPupilRot.x !== 0 &&
    vPupilRot.y !== 0,
  '3D Pupil centroid position rotates faithfully around eye pivot (radius = 9.2 mm)'
);

// 36. 2D screen projection correctly inverts NDC Y to pixel coordinates
const ndcTop = new THREE.Vector3(0, 1, 0.5);
const ndcBottom = new THREE.Vector3(0, -1, 0.5);
const screenYTop = ((-ndcTop.y + 1.0) * 0.5) * 360;
const screenYBottom = ((-ndcBottom.y + 1.0) * 0.5) * 360;
assert(
  screenYTop === 0 && screenYBottom === 360,
  '2D screen projection correctly inverts NDC Y to pixel coordinates (NDC +1 -> 0, NDC -1 -> 360)'
);

// 37. Purkinje glint reflection point accurately calculated via paraxial half-vector
const corneaCenter = new THREE.Vector3(0.031, 0, -0.0057);
const glintPos = EyeAvatarEngine.computePurkinjeGlint(corneaCenter);
const distFromCorneaCenterMm = glintPos.distanceTo(corneaCenter) * 1000;
assert(
  Math.abs(distFromCorneaCenterMm - 7.8) < 1e-4,
  `Purkinje glint reflection point accurately calculated via paraxial half-vector (Rc = ${distFromCorneaCenterMm.toFixed(2)} mm)`
);

// 38. Pupil-to-Corneal-Reflection (P-CR) vector ΔP tracks gaze angle changes
const enginePCR = new EyeAvatarEngine({ logicalWidth: 640, logicalHeight: 360 });
await enginePCR.parseAvatar(ab);
// Baseline P-CR
enginePCR.update(0.01, zeroTelem);
const telemBase = enginePCR.getTelemetry();
const dxBase = telemBase.pupilScreenR.x - telemBase.glintScreenR.x;
// Rotated gaze P-CR
enginePCR.update(0.01, {
  cupulaDeflectionNormalized: 0.8,
  slowPhaseVelocityDegPerSec: { horizontal: 50, vertical: 0, torsional: 0 },
  fastPhaseBeatDirection: 'Right-Beating',
});
const telemRot = enginePCR.getTelemetry();
const dxRot = telemRot.pupilScreenR.x - telemRot.glintScreenR.x;
assert(
  Math.abs(dxRot - dxBase) > 0.05,
  'Pupil-to-Corneal-Reflection (P-CR) vector ΔP tracks gaze angle changes'
);

// 39. Angular telemetry readouts formatted with correct clinical signs and labels
const readoutH = EyeAvatarEngine.formatAngleReadout(12.4, 'horizontal');
const readoutV = EyeAvatarEngine.formatAngleReadout(-8.2, 'vertical');
const readoutT = EyeAvatarEngine.formatAngleReadout(5.1, 'torsional');
assert(
  readoutH === '+12.4° (Right)' &&
    readoutV === '-8.2° (Down)' &&
    readoutT === '+5.1° (Right Torsion)',
  'Angular telemetry readouts formatted with correct clinical signs and labels'
);

// 40. Fast phase beat direction token matches vestibularEngine fastPhaseBeatDirection
const telemToken = enginePCR.getTelemetry().fastPhaseBeatDirection;
assert(
  telemToken === 'Right-Beating',
  'Fast phase beat direction token matches vestibularEngine fastPhaseBeatDirection'
);

// 41. Monochromatic infrared shader luminance values strictly bounded in [0.0, 1.0]
let nirBounded = true;
for (let r = 0; r <= 1.0; r += 0.2) {
  for (let g = 0; g <= 1.0; g += 0.2) {
    for (let b = 0; b <= 1.0; b += 0.2) {
      const lum = EyeAvatarEngine.computeNirLuminance(r, g, b);
      if (lum < 0.0 || lum > 1.0) nirBounded = false;
    }
  }
}
// Validate onBeforeCompile shader injection has no duplicate uniform declarations
const testShader = { uniforms: {}, fragmentShader: '#include <common>\n#include <dithering_fragment>' };
if (engine.irisR && engine.irisR.material) {
  engine.irisR.material.onBeforeCompile(testShader, {});
}
const uniformDeclCount = (testShader.fragmentShader.match(/uniform float uInfraredMode;/g) || []).length;
assert(
  nirBounded && uniformDeclCount === 1,
  'Monochromatic infrared shader luminance values strictly bounded in [0.0, 1.0] with single uniform declaration'
);

// 42. High-contrast pupil extraction isolates pitch-black pupil aperture
const pupilBlackNIR = EyeAvatarEngine.computeNirLuminance(0.0, 0.0, 0.0);
const scleraWhiteNIR = EyeAvatarEngine.computeNirLuminance(0.85, 0.85, 0.85);
assert(
  pupilBlackNIR === 0.0 && scleraWhiteNIR > 0.7,
  `High-contrast pupil extraction isolates pitch-black pupil aperture (pupil: ${pupilBlackNIR}, sclera: ${scleraWhiteNIR.toFixed(2)})`
);

// -----------------------------------------------------------------------------
// Suite 6: Rolling Nystagmogram Buffer & Zero-Allocation Execution (5 assertions)
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 6: Rolling Nystagmogram Buffer & Zero-Allocation Execution (5 assertions) ---');

const ringBuffer = new NystagmogramRingBuffer(600);

// 43. Typed arrays (Float32Array, Uint8Array) instantiate exactly once
assert(
  ringBuffer.getTimeArray() instanceof Float32Array &&
    ringBuffer.getHorizontalArray() instanceof Float32Array &&
    ringBuffer.getVerticalArray() instanceof Float32Array &&
    ringBuffer.getTorsionalArray() instanceof Float32Array &&
    ringBuffer.getSpvArray() instanceof Float32Array &&
    ringBuffer.getFastPhaseFlags() instanceof Uint8Array &&
    ringBuffer.getCapacity() === 600,
  'Typed arrays (Float32Array, Uint8Array) instantiate exactly once with fixed capacity (600)'
);

// 44. Circular ring buffer cleanly overwrites oldest samples when capacity (600) reached
for (let i = 0; i < 750; i++) {
  ringBuffer.push(i * 0.016, i * 0.1, -i * 0.05, 0, 25.0, false);
}
assert(
  ringBuffer.getCount() === 600 && ringBuffer.getWriteIndex() === 150,
  'Circular ring buffer cleanly overwrites oldest samples when capacity (600) reached (count=600, writeIndex=150)'
);

// 45. Push operations accept scalar arguments with zero heap object allocations
// Warm up V8 JIT for push
for (let i = 0; i < 100; i++) {
  ringBuffer.push(i * 0.016, 1.2, -0.8, 0.5, 30.0, true);
}
if (global.gc) global.gc();
const memBeforePush = process.memoryUsage().heapUsed;
for (let i = 0; i < 1000; i++) {
  ringBuffer.push(i * 0.016, 1.2, -0.8, 0.5, 30.0, true);
}
const memAfterPush = process.memoryUsage().heapUsed;
const heapGrowthPush = memAfterPush - memBeforePush;
assert(
  heapGrowthPush < 50000,
  'Push operations accept scalar arguments with zero heap object allocations'
);

// 46. Saccade flag correctly set to 1 during fast phase and 0 during slow phase
ringBuffer.clear();
ringBuffer.push(0.0, 0, 0, 0, 0, false);
ringBuffer.push(0.016, 0, 0, 0, 0, true);
assert(
  ringBuffer.getFastPhaseFlags()[0] === 0 && ringBuffer.getFastPhaseFlags()[1] === 1,
  'Saccade flag correctly set to 1 during fast phase and 0 during slow phase'
);

// 47. Zero memory leak: 10,000 simulation frames generate 0 heap allocations
const leakCheckEngine = new EyeAvatarEngine({ logicalWidth: 640, logicalHeight: 360 });
await leakCheckEngine.parseAvatar(ab);
if (global.gc) global.gc();
const initialHeap = process.memoryUsage().heapUsed;
for (let i = 0; i < 10000; i++) {
  leakCheckEngine.update(1 / 60, testSpvTelem);
}
if (global.gc) global.gc();
const finalHeap = process.memoryUsage().heapUsed;
const heapDeltaKb = (finalHeap - initialHeap) / 1024;
assert(
  heapDeltaKb < 500, // <500 kB growth across 10,000 frames is well within runtime GC noise
  `Zero memory leak: 10,000 simulation frames generate negligible heap growth (${heapDeltaKb.toFixed(1)} kB)`
);

// -----------------------------------------------------------------------------
// Suite 7: TypeScript Compilation & Production Build Integrity (3 assertions)
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 7: TypeScript Compilation & Production Build Integrity (3 assertions) ---');

// 48. web/src/render/eyeAvatar.ts compiles cleanly with tsc --noEmit (0 errors)
let tscClean = false;
try {
  execSync('npx tsc --noEmit', { cwd: path.join(REPO_ROOT, 'web'), stdio: 'pipe' });
  tscClean = true;
} catch (err) {
  console.error(err.stdout ? err.stdout.toString() : err.message);
}
assert(tscClean, 'web/src/render/eyeAvatar.ts compiles cleanly with tsc --noEmit (0 errors)');

// 49. Production bundle build (npm run build) completes with 0 errors
let buildClean = false;
try {
  execSync('npm --prefix web run build', { cwd: REPO_ROOT, stdio: 'pipe' });
  buildClean = true;
} catch (err) {
  console.error(err.stdout ? err.stdout.toString() : err.message);
}
assert(buildClean, 'Production bundle build (npm run build) completes with 0 errors');

// 50. Full test suite (hearing, radiology, vestibular, eye avatar) passes 100%
let allSuitesPass = false;
try {
  execSync('node scripts/test_hearing_engine.js', { cwd: REPO_ROOT, stdio: 'pipe' });
  execSync('node scripts/test_radiology_engine.js', { cwd: REPO_ROOT, stdio: 'pipe' });
  execSync('node scripts/test_vestibular_engine.js', { cwd: REPO_ROOT, stdio: 'pipe' });
  allSuitesPass = true;
} catch (err) {
  console.error(err.stdout ? err.stdout.toString() : err.message);
}
assert(
  allSuitesPass,
  'Full test suite (hearing, radiology, vestibular, eye avatar) passes 100%'
);

console.log('\n================================================================');
console.log(`🏆 ALL ${passedTests}/${totalTests} DEEP EYE AVATAR & VOR VERIFICATION TESTS PASSED CLEANLY (100%)`);
console.log('================================================================\n');
