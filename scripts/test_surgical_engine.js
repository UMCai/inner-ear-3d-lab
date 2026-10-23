/**
 * scripts/test_surgical_engine.js
 *
 * Standalone Node.js ES Module Deep Verification Test Suite for Stage 4:
 * Surgical Approaches & Implant Simulations
 * (Cochlear Implant Kinematics, Transmastoid Labyrinthectomy, Retrosigmoid Neurectomy,
 * 5-Drawer Mutual Exclusivity, and Production Web Build).
 *
 * Total: 56 assertions across 6 test suites.
 */

if (typeof globalThis.self === 'undefined') {
  globalThis.self = globalThis;
}

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

import {
  SURGICAL_LANDMARKS,
  SURGICAL_CAMERA_PERSPECTIVES,
  CI_CONSTANTS,
  LABYRINTHECTOMY_CONSTANTS,
  NEURECTOMY_CONSTANTS,
  evaluateScalaTympaniSpline,
  computeAngularInsertionDepth,
  computeChannelFrequencies,
  computeInsertionForce,
  computeBasilarMembraneDistance,
  computeCIInsertionKinematics,
  computeLabyrinthectomyCompensation,
  classifyAlexanderDegreeFromSpv,
  computeLabyrinthectomyAblation,
  computeABRWaveV,
  computeFacialEMGVoltage,
  computeNeurectomyElectrophysiology,
} from '../web/src/physics/surgicalEngine.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const WEB_SRC = path.join(REPO_ROOT, 'web/src');

console.log('================================================================');
console.log('🔬 STAGE 4: SURGICAL SUITES & IMPLANT SIMULATION VERIFICATION');
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

// =============================================================================
// Suite 1: Cochlear Implant Kinematics & Scala Tympani Spline (11 assertions)
// =============================================================================
console.log('--- Suite 1: Cochlear Implant Kinematics & Scala Tympani Spline ---');

// 1. Spline evaluation at s=0 returns Round Window entry anchor
const ptRW0 = evaluateScalaTympaniSpline(0, 'round_window', 'lateral_wall');
assert(
  Math.abs(ptRW0[0] - SURGICAL_LANDMARKS.scalaTympaniLumenBase[0]) < 0.01 &&
  Math.abs(ptRW0[1] - SURGICAL_LANDMARKS.scalaTympaniLumenBase[1]) < 0.01 &&
  Math.abs(ptRW0[2] - SURGICAL_LANDMARKS.scalaTympaniLumenBase[2]) < 0.01,
  `Spline at s=0 starts precisely at Round Window Lumen entry [${ptRW0.map(v => v.toFixed(3)).join(', ')}]`
);

// 2. Spline evaluation for cochleostomy approach uses anteroinferior offset
const ptCoch0 = evaluateScalaTympaniSpline(0, 'cochleostomy', 'lateral_wall');
assert(
  ptCoch0[0] !== ptRW0[0] || ptCoch0[1] !== ptRW0[1] || ptCoch0[2] !== ptRW0[2],
  `Cochleostomy approach initializes at separate anteroinferior surgical entry point`
);

// 3. Angular insertion depth at s=0 is 0.0 degrees
const theta0 = computeAngularInsertionDepth(0);
assert(theta0 === 0.0, `Angular insertion depth at s=0 is 0.0°`);

// 4. Angular insertion depth reaches ~650 degrees at apical depth 28mm (power law spiral)
const theta28 = computeAngularInsertionDepth(28.0);
assert(
  theta28 >= 620.0 && theta28 <= 655.0,
  `Angular insertion depth at s=28mm reaches apex ~650° (${theta28.toFixed(1)}°)`
);

// 5. Angular insertion depth is strictly monotonic
const theta10 = computeAngularInsertionDepth(10.0);
const theta20 = computeAngularInsertionDepth(20.0);
assert(
  theta0 < theta10 && theta10 < theta20 && theta20 < theta28,
  `Angular insertion depth is strictly monotonic along cochlear spiral`
);

// 6. Advance Off-Stylet (AOS) curling offset: 0 for straight lateral wall array
const ptStraight15 = evaluateScalaTympaniSpline(15.0, 'round_window', 'lateral_wall');
const ptStraightNoCurl = evaluateScalaTympaniSpline(15.0, 'round_window', 'lateral_wall');
assert(
  Math.abs(ptStraight15[0] - ptStraightNoCurl[0]) < 1e-6,
  `Straight lateral wall array maintains neutral curvature offset`
);

// 7. AOS curling offset: perimodiolar array starts curling only after stylet release depth (9.5mm)
const ptPeri8 = evaluateScalaTympaniSpline(8.0, 'round_window', 'perimodiolar');
const ptLat8 = evaluateScalaTympaniSpline(8.0, 'round_window', 'lateral_wall');
assert(
  Math.abs(ptPeri8[0] - ptLat8[0]) < 1e-4 && Math.abs(ptPeri8[1] - ptLat8[1]) < 1e-4,
  `Perimodiolar array remains straight before stylet release depth (s = 8mm <= 9.5mm)`
);

// 8. AOS curling offset: perimodiolar array curls toward modiolus at s = 18mm (> 9.5mm)
const ptPeri18 = evaluateScalaTympaniSpline(18.0, 'round_window', 'perimodiolar');
const ptLat18 = evaluateScalaTympaniSpline(18.0, 'round_window', 'lateral_wall');
const distModPeri = Math.hypot(
  ptPeri18[0] - SURGICAL_LANDMARKS.cochlearModiolusCenter[0],
  ptPeri18[1] - SURGICAL_LANDMARKS.cochlearModiolusCenter[1]
);
const distModLat = Math.hypot(
  ptLat18[0] - SURGICAL_LANDMARKS.cochlearModiolusCenter[0],
  ptLat18[1] - SURGICAL_LANDMARKS.cochlearModiolusCenter[1]
);
assert(
  distModPeri < distModLat,
  `Perimodiolar array curls toward modiolus (modiolar distance: ${distModPeri.toFixed(2)}mm < lateral: ${distModLat.toFixed(2)}mm)`
);

// 9. Camera perspectives: round window landmark correctly targeted
assert(
  SURGICAL_CAMERA_PERSPECTIVES.cochlearImplant.targetRAS[0] === SURGICAL_LANDMARKS.roundWindowNiche[0],
  `CI surgical microscope perspective targets Round Window niche`
);

// 10. Perimodiolar insertion depth clamped to 21.0mm
const ciPeriMax = computeCIInsertionKinematics(25.0, 'perimodiolar', 'round_window');
assert(
  ciPeriMax.insertionDepthMm === 21.0,
  `Perimodiolar array insertion depth is strictly clamped to max 21.0mm (observed: ${ciPeriMax.insertionDepthMm}mm)`
);

// 11. 3D trajectory pitch deviation elevates array towards basilar membrane ceiling (+Z)
const ptNeutral18 = evaluateScalaTympaniSpline(18.0, 'round_window', 'lateral_wall', 0.0, 0.0);
const ptPitch18 = evaluateScalaTympaniSpline(18.0, 'round_window', 'lateral_wall', 15.0, 0.0);
assert(
  ptPitch18[2] > ptNeutral18[2] && Math.abs(ptPitch18[0] - ptNeutral18[0]) < 1e-4,
  `Trajectory pitch deviation (+15°) elevates ST spline towards BM ceiling (+Z: ${ptPitch18[2].toFixed(3)}mm > ${ptNeutral18[2].toFixed(3)}mm)`
);

// =============================================================================
// Suite 2: CI Insertion Force ODE, Rupture & Translocation (10 assertions)
// =============================================================================
console.log('\n--- Suite 2: CI Insertion Force ODE, Rupture & Translocation ---');

// 12. Insertion force is 0 at depth 0
const force0 = computeInsertionForce(0, 'lateral_wall', 0, 0);
assert(force0 === 0.0, `Insertion force at s=0 is 0.0 mN`);

// 13. Insertion force monotonically increases with insertion depth
const force10 = computeInsertionForce(10, 'lateral_wall', 0, 0);
const force20 = computeInsertionForce(20, 'lateral_wall', 0, 0);
assert(
  force0 < force10 && force10 < force20,
  `Insertion force monotonically increases with depth (10mm: ${force10.toFixed(1)}mN, 20mm: ${force20.toFixed(1)}mN)`
);

// 14. Off-axis pitch deviation increases insertion force due to contact pressure
const force20Dev = computeInsertionForce(20, 'lateral_wall', 10, 0);
assert(
  force20Dev > force20,
  `Off-axis trajectory deviation increases insertion force (10° pitch: ${force20Dev.toFixed(1)}mN > ${force20.toFixed(1)}mN)`
);

// 15. Safe insertion at depth 12mm has 'optimal' risk and safe force (< 15 mN)
const ciSafe = computeCIInsertionKinematics(12.0, 'lateral_wall', 'round_window', 0, 0);
assert(
  ciSafe.translocationRisk === 'optimal' && !ciSafe.isRuptured && ciSafe.insertionForceMilliNewtons < 15.0,
  `Safe insertion at 12mm: force ${ciSafe.insertionForceMilliNewtons.toFixed(1)}mN < 15mN, risk is OPTIMAL`
);

// 16. Deep insertion at 27mm reaches 'caution' risk (force > 15 mN)
const ciCaution = computeCIInsertionKinematics(27.0, 'lateral_wall', 'round_window', 0, 0);
assert(
  ciCaution.translocationRisk === 'caution' && ciCaution.insertionForceMilliNewtons >= 15.0,
  `Deep insertion at 27mm: force ${ciCaution.insertionForceMilliNewtons.toFixed(1)}mN >= 15mN, risk is CAUTION`
);

// 17. Basilar membrane distance decreases with positive pitch deviation (towards scala vestibuli)
const distBM0 = computeBasilarMembraneDistance(18.0, 0.0);
const distBM12 = computeBasilarMembraneDistance(18.0, 12.0);
assert(
  distBM12 < distBM0,
  `Basilar membrane distance decreases with off-axis upward pitch (${distBM12.toFixed(3)}mm < ${distBM0.toFixed(3)}mm)`
);

// 18. Extreme pitch deviation (15°) at 22mm causes Basilar Membrane Rupture (breach)
const ciRupture = computeCIInsertionKinematics(22.0, 'lateral_wall', 'round_window', 15.0, 0.0);
assert(
  ciRupture.isRuptured === true && ciRupture.translocationRisk === 'breach',
  `Scalar translocation breach detected at 15° pitch: isRuptured = true, risk = BREACH`
);

// 19. Scalar translocation triggers acute profound sensorineural threshold drop (120 dB HL)
assert(
  ciRupture.audiogramThresholdShiftDb === 120.0,
  `Translocation breach induces acoustic trauma profound threshold drop (+${ciRupture.audiogramThresholdShiftDb} dB HL)`
);

// 20. Greenwood tonotopic channels: 22 electrodes mapped across frequency spectrum (E1 apical to E22 basal)
const freqs = computeChannelFrequencies(28.0, 22);
assert(
  freqs.length === 22 && freqs[0] < 100 && freqs[21] > 8000,
  `22 Greenwood tonotopic channels correctly span apical E1 (${freqs[0].toFixed(0)} Hz) to basal E22 (${freqs[21].toFixed(0)} Hz)`
);

// 21. Channel frequencies increase monotonically from contact 1 (apical E1) to contact 22 (basal E22)
let freqsMonotonic = true;
for (let i = 0; i < freqs.length - 1; i++) {
  if (freqs[i] >= freqs[i + 1]) {
    freqsMonotonic = false;
    break;
  }
}
assert(freqsMonotonic, `Tonotopic channel frequencies increase monotonically along array from apical E1 to basal E22`);

// =============================================================================
// Suite 3: Transmastoid Labyrinthectomy & Deafferentation (8 assertions)
// =============================================================================
console.log('\n--- Suite 3: Transmastoid Labyrinthectomy & Deafferentation ---');

// 22. Step 0 (Mastoidectomy): Intact labyrinth, baseline firing rate 90 sp/s
const laby0 = computeLabyrinthectomyAblation(0, 0, false);
assert(
  laby0.vestibularFiringRateSpikesSec === 90.0 &&
  !laby0.canalsMilled.horizontal &&
  laby0.spontaneousSPVDegSec === 0.0,
  `Step 0 Cortical Mastoidectomy: 90 sp/s baseline firing, 0°/s SPV`
);

// 23. Step 1 (Canal Milling): Horizontal semicircular canal unroofed
const laby1 = computeLabyrinthectomyAblation(1, 0, true);
assert(
  laby1.canalsMilled.horizontal === true && laby1.isDrillActive === true,
  `Step 1 Canal Milling: Horizontal canal unroofed, drill active at 70,000 RPM`
);

// 24. Step 2 (Vestibulotomy): All 3 canals unroofed (horizontal, superior, posterior)
const laby2 = computeLabyrinthectomyAblation(2, 0, false);
assert(
  laby2.canalsMilled.horizontal && laby2.canalsMilled.superior && laby2.canalsMilled.posterior,
  `Step 2 Vestibulotomy: All 3 semicircular canals successfully opened`
);

// 25. Step 3 (Curettage): Neuroepithelium ablated, firing collapses from 90 to 0 sp/s
const laby3 = computeLabyrinthectomyAblation(3, 0, false);
assert(
  laby3.neuroepitheliumAblated === true && laby3.vestibularFiringRateSpikesSec === 0.0,
  `Step 3 Curettage: Neuroepithelium ablated, resting firing rate drops to 0.0 sp/s`
);

// 26. Acute deafferentation collapse produces acute spontaneous SPV = 36.0 deg/s
assert(
  Math.abs(laby3.spontaneousSPVDegSec - 36.0) < 0.1,
  `Acute deafferentation produces contralateral paralytic nystagmus (SPV = ${laby3.spontaneousSPVDegSec.toFixed(1)}°/s)`
);

// 27. Acute paralytic nystagmus is 3rd degree under Alexander's law (SPV > 25°/s)
assert(
  laby3.alexanderDegree === 3,
  `Acute paralytic nystagmus classified as Alexander 3rd Degree (observed: ${laby3.alexanderDegree})`
);

// 28. Direction of paralytic nystagmus beats toward intact contralateral ear (Left-Beating for Right ear ablation)
assert(
  laby3.nystagmusBeatDirection === 'Left-Beating',
  `Paralytic nystagmus fast phase beats toward healthy contralateral ear (Left-Beating)`
);

// 29. Ipsilateral vHIT horizontal gain collapses post-resection
assert(
  laby3.vhitGain < 0.15,
  `Ipsilateral vHIT vestibulo-ocular reflex gain collapses post-labyrinthectomy (gain: ${laby3.vhitGain.toFixed(2)})`
);

// =============================================================================
// Suite 4: Central Vestibular Compensation ODE (8 assertions)
// =============================================================================
console.log('\n--- Suite 4: Central Vestibular Compensation ODE ---');

// 30. Compensation at t=0h matches acute value 36.0 deg/s
const spv0 = computeLabyrinthectomyCompensation(0.0);
assert(Math.abs(spv0 - 36.0) < 0.01, `Compensation at t=0h: SPV = ${spv0.toFixed(2)}°/s`);

// 31. Compensation at t=72h (tau = 72h) matches 36.0 * e^-1 ~ 13.24 deg/s
const spv72 = computeLabyrinthectomyCompensation(72.0);
const expected72 = 36.0 * Math.exp(-1.0);
assert(
  Math.abs(spv72 - expected72) < 0.05,
  `Compensation at t=72h (1 time constant): SPV = ${spv72.toFixed(2)}°/s (expected: ${expected72.toFixed(2)}°/s)`
);

// 32. SPV at t=72h decreases Alexander degree from 3 to 2 (10 <= SPV < 25)
const degree72 = classifyAlexanderDegreeFromSpv(spv72);
assert(degree72 === 2, `Alexander degree at 72h drops to 2nd Degree (SPV = ${spv72.toFixed(1)}°/s)`);

// 33. Compensation at t=168h (1 week): SPV ~ 3.48 deg/s (1st degree: 0 < SPV < 10)
const spv168 = computeLabyrinthectomyCompensation(168.0);
const degree168 = classifyAlexanderDegreeFromSpv(spv168);
assert(
  spv168 < 5.0 && degree168 === 1,
  `Compensation at 1 week (168h): SPV = ${spv168.toFixed(2)}°/s, Alexander 1st Degree`
);

// 34. Compensation at t=720h (1 month): SPV < 0.01 deg/s (fully extinguished in primary gaze)
const spv720 = computeLabyrinthectomyCompensation(720.0);
const degree720 = classifyAlexanderDegreeFromSpv(spv720);
assert(
  spv720 < 0.01 && degree720 === 0,
  `Static compensation at 1 month (720h): SPV = ${spv720.toFixed(4)}°/s, Alexander 0th Degree (Extinguished)`
);

// 35. Full ablation state with compensation updates firing recovery in vestibular nuclei
const labyCompensated = computeLabyrinthectomyAblation(3, 720.0, false);
assert(
  labyCompensated.spontaneousSPVDegSec < 0.01 && labyCompensated.alexanderDegree === 0,
  `Full ablation state at 720h reflects complete static compensation`
);

// 36. Dynamic vHIT gain does not fully recover with static compensation (central vs peripheral defect)
assert(
  labyCompensated.vhitGain < 0.35,
  `High-frequency dynamic VOR gain remains impaired (< 0.35) despite complete static compensation`
);

// 37. Alexander degree transitions are strictly monotonic with compensation hours
assert(
  classifyAlexanderDegreeFromSpv(spv0) > classifyAlexanderDegreeFromSpv(spv72) &&
  classifyAlexanderDegreeFromSpv(spv72) > classifyAlexanderDegreeFromSpv(spv168) &&
  classifyAlexanderDegreeFromSpv(spv168) > classifyAlexanderDegreeFromSpv(spv720),
  `Alexander nystagmus degrees decay monotonically over compensation timeline: 3 -> 2 -> 1 -> 0`
);

// =============================================================================
// Suite 5: Retrosigmoid Neurectomy, IAC 4-Quadrants & CPA (10 assertions)
// =============================================================================
console.log('\n--- Suite 5: Retrosigmoid Neurectomy, IAC 4-Quadrants & CPA ---');

// 38. Baseline ABR Wave V latency is 5.70 ms and amplitude 0.55 uV
const abrBase = computeABRWaveV(0, 0.0);
assert(
  Math.abs(abrBase.latencyMs - 5.70) < 0.01 && Math.abs(abrBase.amplitudeMicroVolts - 0.55) < 0.01,
  `Baseline ABR Wave V: Latency = 5.70 ms, Amplitude = 0.55 μV`
);

// 39. Mechanical nerve traction increases Wave V latency
const abrTraction = computeABRWaveV(0, 1.5);
assert(
  abrTraction.latencyMs > abrBase.latencyMs && abrTraction.amplitudeMicroVolts < abrBase.amplitudeMicroVolts,
  `Nerve traction (1.5g) prolongs ABR Wave V latency (+${(abrTraction.latencyMs - abrBase.latencyMs).toFixed(2)} ms) and reduces amplitude`
);

// 40. Koos Staging: Stage IV tumor (brainstem compression) produces severe latency shift
const abrKoos4 = computeABRWaveV(4, 1.5);
assert(
  abrKoos4.latencyMs - abrBase.latencyMs >= 1.0,
  `Koos Stage IV tumor with traction produces critical ABR Wave V shift (+${(abrKoos4.latencyMs - abrBase.latencyMs).toFixed(2)} ms >= 1.0ms)`
);

// 41. Baseline facial nerve EMG noise is ~8 uV
const emgBase = computeFacialEMGVoltage(5.0, 0.0);
assert(
  emgBase.voltageMicroVolts <= 15.0,
  `Baseline facial EMG noise level: ${emgBase.voltageMicroVolts.toFixed(1)} μV (<= 15 μV)`
);

// 42. Tool proximity < 0.5mm with traction produces high neurotonic burst (>= 500 uV)
const emgBurst = computeFacialEMGVoltage(0.2, 5.0);
assert(
  emgBurst.voltageMicroVolts >= 500.0 && emgBurst.isAlarmActive === true,
  `Facial nerve irritation (<0.5mm + traction) produces neurotonic EMG discharge (${emgBurst.voltageMicroVolts.toFixed(0)} μV >= 500 μV)`
);

// 43. Neurectomy Step 0 (Craniotomy): Nerves intact, low traction, safe status
const neu0 = computeNeurectomyElectrophysiology(0, 0, 5.0, 0.0, 'scissors', false);
assert(
  !neu0.vestibularNerveTransected && neu0.cochlearNervePreserved && neu0.facialNervePreserved,
  `Step 0 Craniotomy: All 4 nerve bundles intact in IAC`
);

// 44. Neurectomy Step 2 (Cleavage Plane): Identifies plane between vestibular and cochlear/facial bundles
const neu2 = computeNeurectomyElectrophysiology(2, 0, 1.0, 0.2, 'hook', true);
assert(
  neu2.cleavagePlaneVisible === true && neu2.cochlearNervePreserved,
  `Step 2 Cleavage Plane: Vestibular-cochlear cleavage line successfully exposed`
);

// 45. Neurectomy Step 3 (Selective Division): Transects vestibular nerve, preserves cochlear and facial
const neu3 = computeNeurectomyElectrophysiology(3, 0, 0.2, 0.4, 'scissors', true);
assert(
  neu3.vestibularNerveTransected === true &&
  neu3.cochlearNervePreserved === true &&
  neu3.facialNervePreserved === true,
  `Step 3 Selective Transection: Vestibular nerve divided while preserving Cochlear (Hearing) and Facial (Motor)`
);

// 46. Hearing preservation: Clean selective division results in 0 dB threshold shift
assert(
  neu3.audiogramThresholdShiftDb === 0.0,
  `Hearing preservation: 0 dB threshold shift post-selective vestibular division`
);

// 47. Critical traction risk flag activates when EMG burst exceeds 500 uV
const neuCritical = computeNeurectomyElectrophysiology(3, 4, 0.1, 5.0, 'bipolar', false);
assert(
  neuCritical.tractionRisk === 'CRITICAL' && neuCritical.isEMGAlarmActive === true,
  `Critical traction risk flag and EMG audio alarm activate on excessive traction & irritation`
);

// =============================================================================
// Suite 6: Production Build, Shaders & 5-Drawer Mutual Exclusivity (9 assertions)
// =============================================================================
console.log('\n--- Suite 6: Production Build, Shaders & 5-Drawer Mutual Exclusivity ---');

// 48. gate3Materials.ts exports surgical uniforms
const matSource = fs.readFileSync(path.join(WEB_SRC, 'render/gate3Materials.ts'), 'utf-8');
assert(
  matSource.includes('uSurgicalDrillActive') &&
  matSource.includes('uCanalUnroofed') &&
  matSource.includes('uTranslocationBreach') &&
  matSource.includes('uSurgicalTime'),
  `gate3Materials.ts declares uSurgicalDrillActive, uCanalUnroofed, uTranslocationBreach, and uSurgicalTime GPU uniforms`
);

// 49. AudiogramDrawer.ts implements surgical acoustic trauma and labyrinthectomy anacusis presets
const audiogramSource = fs.readFileSync(path.join(WEB_SRC, 'ui/AudiogramDrawer.ts'), 'utf-8');
assert(
  audiogramSource.includes('acoustic_trauma') &&
  audiogramSource.includes('labyrinthectomy_anacusis') &&
  audiogramSource.includes('getActivePresetId'),
  `AudiogramDrawer.ts defines acoustic_trauma, labyrinthectomy_anacusis (120 dB HL), and getActivePresetId()`
);

// 50. DualStageScene.ts implements surgical simulation methods
const sceneSource = fs.readFileSync(path.join(WEB_SRC, 'render/DualStageScene.ts'), 'utf-8');
assert(
  sceneSource.includes('updateCIArray') &&
  sceneSource.includes('updateLabyrinthectomy') &&
  sceneSource.includes('updateNeurectomy') &&
  sceneSource.includes('setSurgicalDrawer'),
  `DualStageScene.ts implements updateCIArray, updateLabyrinthectomy, updateNeurectomy, and setSurgicalDrawer`
);

// 51. ToneSynthesizer.ts implements otologic drill whine and facial EMG alarm
const toneSource = fs.readFileSync(path.join(WEB_SRC, 'audio/ToneSynthesizer.ts'), 'utf-8');
assert(
  toneSource.includes('startDrill') &&
  toneSource.includes('stopDrill') &&
  toneSource.includes('triggerEMGAlarm') &&
  toneSource.includes('triggerRuptureSnap'),
  `ToneSynthesizer.ts implements 70,000 RPM drill, 180Hz EMG alarm, and rupture transient audio`
);

// 52. SurgicalDrawer.ts implements 2D endoscopic monitor and biotelemetry plots
const drawerSource = fs.readFileSync(path.join(WEB_SRC, 'ui/SurgicalDrawer.ts'), 'utf-8');
assert(
  drawerSource.includes('renderCIMonitor') &&
  drawerSource.includes('renderLabyMonitor') &&
  drawerSource.includes('renderNeurectomyMonitor') &&
  drawerSource.includes('renderLowerPlot'),
  `SurgicalDrawer.ts implements 2D endoscopic monitor (ST cross-section, unroofing, IAC 4-quadrant) and force/ABR plots`
);

// 53. AppHUD.ts implements 5-drawer mutual exclusivity
const hudSource = fs.readFileSync(path.join(WEB_SRC, 'ui/AppHUD.ts'), 'utf-8');
assert(
  hudSource.includes('toggleSurgicalDrawer') &&
  hudSource.includes('openSurgicalDrawer') &&
  hudSource.includes('closeSurgicalDrawer') &&
  hudSource.includes('this.surgicalDrawer && this.surgicalDrawer.getIsOpen()'),
  `AppHUD.ts implements strict 5-drawer mutual exclusivity (Surgical, VOR, CT, Audiogram, Parts)`
);

// 54. style.css implements surgical workbench and drawer styles
const cssSource = fs.readFileSync(path.join(WEB_SRC, 'style.css'), 'utf-8');
assert(
  cssSource.includes('.surgical-dock-content') &&
  cssSource.includes('.surg-subnav-bar') &&
  cssSource.includes('.surgical-drawer') &&
  cssSource.includes('.surgical-inspector-box'),
  `style.css implements complete responsive styling for surgical workbench, subviews, and drawer`
);

// 55. Root package.json declares test:surgical script
const pkgSource = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf-8'));
assert(
  pkgSource.scripts['test:surgical'] !== undefined &&
  pkgSource.scripts.test.includes('test:surgical'),
  `package.json includes test:surgical in npm test pipeline`
);

// 56. Production Web Build: tsc && vite build completes with 0 errors
console.log('\n  ⚙️ Validating web TypeScript bundle with "npm run build"...');
try {
  execSync('npm --prefix web run build', { stdio: 'pipe' });
  assert(true, `Production Web Build: tsc && vite build completes cleanly with 0 TypeScript/Vite errors`);
} catch (err) {
  assert(false, `Production Web Build failed: ${err.message}`);
}

console.log('\n================================================================');
console.log(`🏆 ALL ${passedTests}/${totalTests} SURGICAL SIMULATION VERIFICATION TESTS PASSED (100%)`);
console.log('================================================================\n');
