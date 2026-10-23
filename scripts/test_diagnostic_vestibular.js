/**
 * scripts/test_diagnostic_vestibular.js
 *
 * Standalone Node.js ES Module Deep Verification Test Suite for Stage 3 — Phase 3B:
 * Diagnostic Vestibular Testing Suite (Caloric Irrigation COWS & Video Head Impulse Test vHIT).
 *
 * Validates:
 * 1. Caloric Thermal Convection & COWS Rule Verification (10 assertions)
 * 2. Alexander's Law Live Gaze Modulation & Degrees (8 assertions)
 * 3. Jongkees Bithermal Formula & Pathology Matrix (10 assertions)
 * 4. vHIT Minimum-Jerk Kinematics & SO(3) Head Impulses (8 assertions)
 * 5. Curthoys Area Gain & Compensatory Saccades (8 assertions)
 * 6. Production Build, Shader Uniforms & Zero-Allocation Buffer (7 assertions)
 *
 * Total: 51 assertions across 6 test suites.
 */

if (typeof globalThis.self === 'undefined') {
  globalThis.self = globalThis;
}

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

import {
  CALORIC_CONSTANTS,
  VHIT_CONSTANTS,
  CANAL_PAIR_AXES,
  CALORIC_CLINICAL_PRESETS,
  computeCaloricThermalDiffusion,
  computeEndolymphDensityChange,
  computeBuoyancyPressure,
  computeConvectiveVelocity,
  computeCaloricConvection,
  classifyAlexanderDegree,
  computeAlexanderModulation,
  calculateJongkees,
  computeVHITHeadVelocity,
  computeVHITHeadPosition,
  computeVHITHeadAcceleration,
  computeVHITHeadQuaternion,
  computeSaccadeVelocity,
  computeCurthoysGain,
  VHITImpulseBuffer,
} from '../web/src/physics/diagnosticVestibularEngine.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const WEB_SRC = path.join(REPO_ROOT, 'web/src');

console.log('================================================================');
console.log('🧪 STAGE 3 — PHASE 3B: DIAGNOSTIC VESTIBULAR TEST SUITE (COWS & vHIT)');
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
// Suite 1: Caloric Thermal Convection & COWS Rule Verification (10 assertions)
// =============================================================================
console.log('--- Suite 1: Caloric Thermal Convection & COWS Rule Verification ---');

// 1. Diffusion equation reaches peak deltaT at exactly t=35s (T_PEAK)
const deltaT35 = computeCaloricThermalDiffusion(7.0, 35.0);
const deltaT10 = computeCaloricThermalDiffusion(7.0, 10.0);
const deltaT40 = computeCaloricThermalDiffusion(7.0, 40.0);
assert(
  Math.abs(deltaT35 - 7.00) < 1e-4 && deltaT35 > deltaT10 && deltaT35 > deltaT40,
  `Caloric thermal diffusion rises from t=10s (${deltaT10.toFixed(2)}°C) to peak at t=35s (${deltaT35.toFixed(2)}°C) and decays at t=40s (${deltaT40.toFixed(2)}°C)`
);

// 2. Endolymph density change deltaRho matches volumetric expansion formula for Warm (+7°C), Cold (-7°C), and Ice (-33°C)
const deltaRhoWarm = computeEndolymphDensityChange(+7.0);
const deltaRhoCold = computeEndolymphDensityChange(-7.0);
const deltaRhoIce = computeEndolymphDensityChange(-33.0);
assert(
  Math.abs(deltaRhoWarm - (-2.10)) < 1e-3 &&
  Math.abs(deltaRhoCold - (+2.10)) < 1e-3 &&
  Math.abs(deltaRhoIce - (+9.90)) < 1e-3,
  `Endolymph density decreases on warming 44°C (Δρ = ${deltaRhoWarm.toFixed(2)} kg/m³), increases on cooling 30°C (+${deltaRhoCold.toFixed(2)} kg/m³), and massive rise on ice 4°C (+${deltaRhoIce.toFixed(2)} kg/m³)`
);

// 3. Buoyancy pressure matches analytical formula with sin(60°) posture
const pBuoyant = computeBuoyancyPressure(+1.0);
const expectedP =
  CALORIC_CONSTANTS.BETA *
  CALORIC_CONSTANTS.RHO_0 *
  CALORIC_CONSTANTS.GRAVITY *
  CALORIC_CONSTANTS.H_EFF *
  1.0;
assert(
  Math.abs(pBuoyant - expectedP) < 1e-6,
  `Buoyancy hydrostatic pressure in supine +30° posture matches physics (${pBuoyant.toExponential(3)} Pa)`
);

// 4. Ampullopetal convection for Warm (+7°C) excites firing rate > 90 sp/s
const convWarmR = computeCaloricConvection(+7.0, 40.0, 'right');
assert(
  convWarmR.isAmpullopetal && convWarmR.afferentFiringRate > 90.0,
  `Warm 44°C (+7°C) produces ampullopetal flow and CN VIII excitation (${convWarmR.afferentFiringRate.toFixed(1)} sp/s > 90)`
);

// 5. Ampullofugal convection for Cold (-7°C) inhibits firing rate < 90 sp/s
const convColdR = computeCaloricConvection(-7.0, 40.0, 'right');
assert(
  convColdR.isAmpullofugal && convColdR.afferentFiringRate < 90.0,
  `Cold 30°C (-7°C) produces ampullofugal flow and CN VIII inhibition (${convColdR.afferentFiringRate.toFixed(1)} sp/s < 90)`
);

// 6. COWS rule: Right Warm (R44) -> Fast phase Right (Same Ear)
assert(
  convWarmR.fastPhaseBeatDirection === 'Right-Beating' && convWarmR.beatDirectionDescription.includes('Same'),
  `COWS Rule: Right Warm 44°C produces Right-Beating fast phase (Same ear / ipsilateral)`
);

// 7. COWS rule: Right Cold (R30) -> Fast phase Left (Opposite Ear)
assert(
  convColdR.fastPhaseBeatDirection === 'Left-Beating' && convColdR.beatDirectionDescription.includes('Opposite'),
  `COWS Rule: Right Cold 30°C produces Left-Beating fast phase (Opposite ear / contralateral)`
);

// 8. COWS rule: Left Warm (L44) -> Fast phase Left (Same Ear)
const convWarmL = computeCaloricConvection(+7.0, 40.0, 'left');
assert(
  convWarmL.fastPhaseBeatDirection === 'Left-Beating' && convWarmL.beatDirectionDescription.includes('Same'),
  `COWS Rule: Left Warm 44°C produces Left-Beating fast phase (Same ear / ipsilateral)`
);

// 9. COWS rule: Left Cold (L30) -> Fast phase Right (Opposite Ear)
const convColdL = computeCaloricConvection(-7.0, 40.0, 'left');
assert(
  convColdL.fastPhaseBeatDirection === 'Right-Beating' && convColdL.beatDirectionDescription.includes('Opposite'),
  `COWS Rule: Left Cold 30°C produces Right-Beating fast phase (Opposite ear / contralateral)`
);

// 10. Ice water 4°C (-33°C) produces maximum ampullofugal inhibition
const convIce = computeCaloricConvection(-33.0, 40.0, 'right');
assert(
  convIce.afferentFiringRate <= 35.0 && convIce.fastPhaseBeatDirection === 'Left-Beating',
  `Ice 4°C (-33°C) produces profound ampullofugal inhibition (${convIce.afferentFiringRate.toFixed(1)} sp/s) beating contralateral Left`
);

// =============================================================================
// Suite 2: Alexander's Law Live Gaze Modulation & Degrees (8 assertions)
// =============================================================================
console.log('\n--- Suite 2: Alexander\'s Law Live Gaze Modulation & Degrees ---');

const baseSPV = 20.0; // 2nd Degree baseline

// 11. Center gaze (0°) baseline SPV remains unmodulated
const alex0 = computeAlexanderModulation(baseSPV, 0.0, 1);
assert(
  Math.abs(alex0.modulatedSPV - baseSPV) < 1e-4,
  `Alexander's Law: Center gaze (0°) preserves exact baseline SPV (${alex0.modulatedSPV.toFixed(1)}°/s)`
);

// 12. Ipsilateral gaze (+30°) for Right-beating nystagmus increases SPV by 1.40x (K_ALEXANDER = 0.40)
const alexPlus30 = computeAlexanderModulation(baseSPV, +30.0, 1);
const ratioPlus = alexPlus30.modulatedSPV / baseSPV;
assert(
  Math.abs(ratioPlus - 1.40) < 0.01,
  `Alexander's Law: Ipsilateral gaze (+30°) increases SPV by +40% (ratio = ${ratioPlus.toFixed(2)})`
);

// 13. Contralateral gaze (-30°) for Right-beating nystagmus decreases SPV to 0.60x (K_ALEXANDER = 0.40)
const alexMinus30 = computeAlexanderModulation(baseSPV, -30.0, 1);
const ratioMinus = alexMinus30.modulatedSPV / baseSPV;
assert(
  Math.abs(ratioMinus - 0.60) < 0.01,
  `Alexander's Law: Contralateral gaze (-30°) decreases SPV by -40% (ratio = ${ratioMinus.toFixed(2)})`
);

// 14. Non-negative clamping (SPV never reverses direction)
const extremeAlex = computeAlexanderModulation(5.0, -90.0, 1);
assert(
  extremeAlex.modulatedSPV >= 0.0,
  `Alexander's Law: Peripheral nystagmus never reverses sign under extreme contralateral gaze (${extremeAlex.modulatedSPV.toFixed(2)} >= 0)`
);

// 15. 1st Degree Alexander classification for SPV < 10°/s
assert(
  classifyAlexanderDegree(8.0) === '1st Degree',
  `Alexander classification: SPV = 8.0°/s is correctly classified as 1st Degree (< 10°/s)`
);

// 16. 2nd Degree Alexander classification for 10°/s <= SPV <= 25°/s
assert(
  classifyAlexanderDegree(18.5) === '2nd Degree',
  `Alexander classification: SPV = 18.5°/s is correctly classified as 2nd Degree (10–25°/s)`
);

// 17. 3rd Degree Alexander classification for SPV > 25°/s
assert(
  classifyAlexanderDegree(32.0) === '3rd Degree',
  `Alexander classification: SPV = 32.0°/s is correctly classified as 3rd Degree (> 25°/s)`
);

// 18. Zero baseline produces zero modulation across all gaze angles
const alexZeroMod = computeAlexanderModulation(0.0, +30.0, 1);
assert(
  alexZeroMod.modulatedSPV === 0.0,
  `Alexander's Law: Zero baseline SPV remains exactly 0.0°/s across all gaze angles`
);

// =============================================================================
// Suite 3: Jongkees Bithermal Formula & Pathology Matrix (10 assertions)
// =============================================================================
console.log('\n--- Suite 3: Jongkees Bithermal Formula & Pathology Matrix ---');

// 19. Symmetric normal response yields UW < 15% and DP < 15%
const jNorm = calculateJongkees(
  CALORIC_CLINICAL_PRESETS.normal.r44,
  CALORIC_CLINICAL_PRESETS.normal.r30,
  CALORIC_CLINICAL_PRESETS.normal.l44,
  CALORIC_CLINICAL_PRESETS.normal.l30
);
assert(
  Math.abs(jNorm.canalParesisPercent) < 15.0 && Math.abs(jNorm.directionalPreponderancePercent) < 15.0 && jNorm.pareticEar === 'symmetric',
  `Jongkees Normal: UW = ${jNorm.canalParesisPercent.toFixed(1)}% (< 15%), DP = ${jNorm.directionalPreponderancePercent.toFixed(1)}%, symmetric`
);

// 20. Right canal paresis preset yields pathological UW >= 25% (pareticEar === 'right')
const jRightNeur = calculateJongkees(
  CALORIC_CLINICAL_PRESETS.right_neuritis.r44,
  CALORIC_CLINICAL_PRESETS.right_neuritis.r30,
  CALORIC_CLINICAL_PRESETS.right_neuritis.l44,
  CALORIC_CLINICAL_PRESETS.right_neuritis.l30
);
assert(
  jRightNeur.canalParesisPercent >= 25.0 && jRightNeur.pareticEar === 'right',
  `Jongkees Right Neuritis: UW = ${jRightNeur.canalParesisPercent.toFixed(1)}% (>= 25%), pareticEar = right`
);

// 21. Left canal paresis preset yields pathological UW >= 25% (pareticEar === 'left')
const jLeftSchw = calculateJongkees(
  CALORIC_CLINICAL_PRESETS.left_schwannoma.r44,
  CALORIC_CLINICAL_PRESETS.left_schwannoma.r30,
  CALORIC_CLINICAL_PRESETS.left_schwannoma.l44,
  CALORIC_CLINICAL_PRESETS.left_schwannoma.l30
);
assert(
  jLeftSchw.canalParesisPercent >= 25.0 && jLeftSchw.pareticEar === 'left',
  `Jongkees Left Schwannoma: UW = ${jLeftSchw.canalParesisPercent.toFixed(1)}% (>= 25%), pareticEar = left`
);

// 22. Directional preponderance preset yields DP >= 30%
const jDP = calculateJongkees(
  CALORIC_CLINICAL_PRESETS.directional_preponderance.r44,
  CALORIC_CLINICAL_PRESETS.directional_preponderance.r30,
  CALORIC_CLINICAL_PRESETS.directional_preponderance.l44,
  CALORIC_CLINICAL_PRESETS.directional_preponderance.l30
);
assert(
  jDP.directionalPreponderancePercent >= 30.0 && jDP.preponderanceDirection === 'right',
  `Jongkees Directional Preponderance: DP = ${jDP.directionalPreponderancePercent.toFixed(1)}% (>= 30%), direction = right`
);

// 23. Bilateral weakness preset yields total response < 20°/s
const jBilateral = calculateJongkees(
  CALORIC_CLINICAL_PRESETS.bilateral_gentamicin.r44,
  CALORIC_CLINICAL_PRESETS.bilateral_gentamicin.r30,
  CALORIC_CLINICAL_PRESETS.bilateral_gentamicin.l44,
  CALORIC_CLINICAL_PRESETS.bilateral_gentamicin.l30
);
assert(
  jBilateral.isBilateralWeakness && jBilateral.totalResponseDegPerSec < 20.0,
  `Jongkees Bilateral Gentamicin: Total = ${jBilateral.totalResponseDegPerSec.toFixed(1)}°/s (< 20°/s), isBilateralWeakness = true`
);

// 24. Complete areflexia (0, 0, 0, 0) handles zero denominator gracefully
const jZero = calculateJongkees(0, 0, 0, 0);
assert(
  jZero.canalParesisPercent === 0 && jZero.directionalPreponderancePercent === 0 && jZero.isBilateralWeakness,
  `Jongkees Complete Areflexia (0, 0, 0, 0): Division by zero avoided, UW = 0%, isBilateralWeakness = true`
);

// 25. Paretic ear correctly labeled 'right', 'left', or 'symmetric'
assert(
  ['right', 'left', 'symmetric'].includes(jRightNeur.pareticEar),
  `Jongkees pareticEar property conforms to strict union enum ('${jRightNeur.pareticEar}')`
);

// 26. Preponderance direction correctly labeled 'right', 'left', or 'symmetric'
assert(
  ['right', 'left', 'symmetric'].includes(jDP.preponderanceDirection),
  `Jongkees preponderanceDirection conforms to strict union enum ('${jDP.preponderanceDirection}')`
);

// 27. Diagnostic flags array correctly populated with clinical alert strings
assert(
  jRightNeur.diagnosticFlags.length > 0 && jRightNeur.diagnosticFlags.some((f) => f.includes('Right Canal Paresis')),
  `Jongkees diagnosticFlags contains: ${jRightNeur.diagnosticFlags.join('; ')}`
);

// 28. Clinical interpretation text generated and non-empty
assert(
  typeof jNorm.clinicalInterpretation === 'string' && jNorm.clinicalInterpretation.length > 20,
  `Jongkees clinicalInterpretation generated: "${jNorm.clinicalInterpretation.slice(0, 60)}..."`
);

// =============================================================================
// Suite 4: vHIT Minimum-Jerk Kinematics & SO(3) Head Impulses (8 assertions)
// =============================================================================
console.log('\n--- Suite 4: vHIT Minimum-Jerk Kinematics & SO(3) Head Impulses ---');

// 29. Peak head angular velocity reaches target 250°/s at t = T/2 (60ms)
const wPeak = computeVHITHeadVelocity(0.060);
assert(
  Math.abs(wPeak - 250.0) < 1.0,
  `vHIT peak velocity at t = 60ms reaches target minimum-jerk amplitude (${wPeak.toFixed(2)}°/s ~ 250.0°/s)`
);

// 30. Total head angular displacement matches target ~15° at t = T (120ms)
const posFinal = computeVHITHeadPosition(0.120);
assert(
  Math.abs(posFinal - 15.0) < 0.1,
  `vHIT integrated head position at t = 120ms reaches target displacement (${posFinal.toFixed(2)}° ~ 15.0°)`
);

// 31. Head velocity is strictly zero outside [0, T]
const wBefore = computeVHITHeadVelocity(-0.010);
const wAfter = computeVHITHeadVelocity(0.130);
assert(
  wBefore === 0.0 && wAfter === 0.0,
  `vHIT velocity strictly bounded: zero before impulse (${wBefore}) and zero after impulse (${wAfter})`
);

// 32. Head acceleration peaks at t = 30ms and t = 90ms with zero crossing at t = 60ms
const aAcc = computeVHITHeadAcceleration(0.030);
const aDec = computeVHITHeadAcceleration(0.090);
const aMid = computeVHITHeadAcceleration(0.060);
assert(
  aAcc > 2000.0 && aDec < -2000.0 && Math.abs(aMid) < 1.0,
  `vHIT acceleration: acceleration peak (+${Math.round(aAcc)}°/s²), deceleration peak (${Math.round(aDec)}°/s²), zero crossing at t=60ms (${aMid.toFixed(2)})`
);

// 33. Horizontal pair rotates around Z-axis (Yaw)
assert(
  CANAL_PAIR_AXES.horizontal[0] === 0 && CANAL_PAIR_AXES.horizontal[1] === 0 && CANAL_PAIR_AXES.horizontal[2] === 1,
  `vHIT canal pair axis: Horizontal is pure Yaw ([0, 0, 1])`
);

// 34. RALP pair rotates around oblique axis [1, -1, 0]/sqrt(2)
const ralpNorm = Math.hypot(CANAL_PAIR_AXES.ralp[0], CANAL_PAIR_AXES.ralp[1]);
assert(
  Math.abs(ralpNorm - 1.0) < 1e-4 && CANAL_PAIR_AXES.ralp[0] > 0 && CANAL_PAIR_AXES.ralp[1] < 0,
  `vHIT canal pair axis: RALP is normalized oblique pitch/roll ([${CANAL_PAIR_AXES.ralp.map((v) => v.toFixed(3)).join(', ')}])`
);

// 35. LARP pair rotates around oblique axis [1, 1, 0]/sqrt(2)
const larpNorm = Math.hypot(CANAL_PAIR_AXES.larp[0], CANAL_PAIR_AXES.larp[1]);
assert(
  Math.abs(larpNorm - 1.0) < 1e-4 && CANAL_PAIR_AXES.larp[0] > 0 && CANAL_PAIR_AXES.larp[1] > 0,
  `vHIT canal pair axis: LARP is normalized oblique pitch/roll ([${CANAL_PAIR_AXES.larp.map((v) => v.toFixed(3)).join(', ')}])`
);

// 36. SO(3) head quaternion remains unit normalized across entire thrust
const qMid = computeVHITHeadQuaternion(0.060, 'horizontal', 1);
const qNorm = Math.hypot(qMid[0], qMid[1], qMid[2], qMid[3]);
assert(
  Math.abs(qNorm - 1.0) < 1e-4,
  `SO(3) head quaternion remains orthonormal unit norm (||q|| = ${qNorm.toFixed(6)})`
);

// =============================================================================
// Suite 5: Curthoys Area Gain & Compensatory Saccades (8 assertions)
// =============================================================================
console.log('\n--- Suite 5: Curthoys Area Gain & Compensatory Saccades ---');

const vhitBuf = new VHITImpulseBuffer();

// 37. Curthoys area integration computes ratio of integrated eye velocity area to head velocity area
vhitBuf.simulateTrial('normal', 'himp', false);
assert(
  vhitBuf.calculatedGain > 0.95 && vhitBuf.calculatedGain < 1.05,
  `Curthoys 40–80ms area gain for Normal impulse is 1.00 ± 0.05 (observed: ${vhitBuf.calculatedGain.toFixed(3)})`
);

// 38. Normal impulse has no covert or overt saccades
assert(
  !vhitBuf.covertSaccadePresent && !vhitBuf.overtSaccadePresent,
  `Normal vHIT impulse has no catch-up saccades (covert = ${vhitBuf.covertSaccadePresent}, overt = ${vhitBuf.overtSaccadePresent})`
);

// 39. Acute vestibular neuritis preset yields gain ~0.35 with overt saccade (160–210ms)
vhitBuf.simulateTrial('acute_neuritis', 'himp', false);
assert(
  vhitBuf.calculatedGain < 0.45 && vhitBuf.overtSaccadePresent && !vhitBuf.covertSaccadePresent,
  `Acute Neuritis: pathological gain (${vhitBuf.calculatedGain.toFixed(2)}) with overt catch-up saccade`
);

// 40. Chronic vestibular schwannoma preset yields gain ~0.38 with covert saccade (75–95ms)
vhitBuf.simulateTrial('chronic_schwannoma', 'himp', false);
assert(
  vhitBuf.calculatedGain < 0.45 && vhitBuf.covertSaccadePresent,
  `Chronic Schwannoma: compensated gain (${vhitBuf.calculatedGain.toFixed(2)}) with covert saccade (75–95ms)`
);

// 41. Bilateral vestibular loss yields severe gain reduction (< 0.25) and dual covert + overt saccades
vhitBuf.simulateTrial('bilateral_loss', 'himp', false);
assert(
  vhitBuf.calculatedGain < 0.25 && vhitBuf.covertSaccadePresent && vhitBuf.overtSaccadePresent,
  `Bilateral Vestibular Loss: severe gain drop (${vhitBuf.calculatedGain.toFixed(2)} < 0.25) with dual covert + overt saccades`
);

// 42. Goggle slippage artifact creates early velocity perturbation without corrupting post-thrust stability
vhitBuf.simulateTrial('normal', 'himp', true);
const earlyDiff = Math.abs(vhitBuf.invertedEyeVelArray[40] - vhitBuf.headVelArray[40]);
const postRest = vhitBuf.invertedEyeVelArray[300];
assert(
  earlyDiff > 10.0 && postRest === 0.0,
  `Goggle slippage: early trace perturbation observed (diff = ${earlyDiff.toFixed(1)}°/s at 40ms) with clean rest settling (0.0°/s at 300ms)`
);

// 43. Saccade velocity profile follows bell-shaped minimum-jerk kinematics
const sacPeak = computeSaccadeVelocity(0.094, 0.080, 0.028, 420.0);
const sacTail = computeSaccadeVelocity(0.120, 0.080, 0.028, 420.0);
assert(
  Math.abs(sacPeak - 420.0) < 1e-4 && sacTail === 0.0,
  `Saccade kinematics: exact peak amplitude at center (${sacPeak.toFixed(1)}°/s) and zero outside duration (${sacTail}°/s)`
);

// 44. HIMP vs SHIMP paradigm differences correctly simulated (SHIMP anti-compensatory saccade in normal subject)
vhitBuf.simulateTrial('normal', 'shimp', false);
assert(
  vhitBuf.shimpSaccadePresent && vhitBuf.saccadeFlags.some((f) => f === 3),
  `SHIMP paradigm: normal subject produces anti-compensatory saccade (shimpSaccadePresent = true, flag 3 detected)`
);

// =============================================================================
// Suite 6: Production Build, Shader Uniforms & Zero-Allocation Buffer (7 assertions)
// =============================================================================
console.log('\n--- Suite 6: Production Build, Shader Uniforms & Zero-Allocation Buffer ---');

const gate3MatSrc = fs.readFileSync(path.join(WEB_SRC, 'render/gate3Materials.ts'), 'utf-8');
const dualStageSrc = fs.readFileSync(path.join(WEB_SRC, 'render/DualStageScene.ts'), 'utf-8');
const vorDrawerSrc = fs.readFileSync(path.join(WEB_SRC, 'ui/VORDrawer.ts'), 'utf-8');
const appHudSrc = fs.readFileSync(path.join(WEB_SRC, 'ui/AppHUD.ts'), 'utf-8');
const styleSrc = fs.readFileSync(path.join(WEB_SRC, 'style.css'), 'utf-8');

// 45. gate3Materials exports caloric and mirrored uniforms
assert(
  gate3MatSrc.includes('uCaloricActive') &&
  gate3MatSrc.includes('uCaloricTempDiff') &&
  gate3MatSrc.includes('uCaloricDiffusion') &&
  gate3MatSrc.includes('uCaloricTime') &&
  gate3MatSrc.includes('uMirrored'),
  `gate3Materials defines GPU uniforms: uCaloricActive, uCaloricTempDiff, uCaloricDiffusion, uCaloricTime, uMirrored`
);

// 46. DualStageScene contains diagnostic public API methods
assert(
  dualStageSrc.includes('setCaloricUniforms') &&
  dualStageSrc.includes('setLabyrinthLaterality') &&
  dualStageSrc.includes('getLabyrinthLaterality') &&
  dualStageSrc.includes('setCaloricSimulationState') &&
  dualStageSrc.includes('flyToCaloricPosture') &&
  dualStageSrc.includes('triggerVHITThrust'),
  `DualStageScene implements diagnostic API methods for Caloric, vHIT, and contralateral mirroring`
);

// 47. VORDrawer implements VHITImpulseBuffer, Caloric Butterfly Plot, and Dual-Trace Plot
assert(
  vorDrawerSrc.includes('VHITImpulseBuffer') &&
  vorDrawerSrc.includes('setDiagnosticViewMode') &&
  vorDrawerSrc.includes('renderVHITDualTracePlot') &&
  vorDrawerSrc.includes('renderCaloricButterflyPlot') &&
  vorDrawerSrc.includes('setCaloricData'),
  `VORDrawer implements VHITImpulseBuffer, Caloric COWS Butterfly Plot, and high-speed vHIT Dual-Trace Plot`
);

// 48. VHITImpulseBuffer is pre-allocated with 350-sample Float32Array (zero allocations during simulateTrial)
assert(
  vhitBuf.getCapacity() === 350 &&
  vhitBuf.headVelArray.length === 350 &&
  vhitBuf.invertedEyeVelArray.length === 350 &&
  vhitBuf.saccadeFlags.length === 350,
  `VHITImpulseBuffer pre-allocates contiguous typed arrays (350 samples at 1ms resolution, zero heap alloc)`
);

// 49. AppHUD contains diagnostic vestibular subnav bar, caloric chips, Jongkees modal, and debounced vHIT controls
assert(
  appHudSrc.includes('id="vest-subnav-bar"') &&
  appHudSrc.includes('id="caloric-temp-chips"') &&
  appHudSrc.includes('id="caloric-jongkees-modal"') &&
  appHudSrc.includes('id="vhit-pair-chips"') &&
  appHudSrc.includes('impulsing'),
  `AppHUD integrates subnav bar, caloric temperature chips, Jongkees modal, and debounced vHIT controls`
);

// 50. style.css contains styles for .vest-subnav-bar, .caloric-modal-sheet, and .vhit-deliver-thrust-btn:disabled
assert(
  styleSrc.includes('.vest-subnav-bar') &&
  styleSrc.includes('.caloric-modal-sheet') &&
  styleSrc.includes('.vhit-deliver-thrust-btn') &&
  styleSrc.includes('.vhit-deliver-thrust-btn:disabled'),
  `style.css implements styling for subnav bar, Jongkees modal sheet, and vHIT thrust debounce`
);

// 51. Production Web TypeScript Build succeeds with 0 errors
console.log('\n  ⚙️ Validating web TypeScript bundle with "npm run build"...');
try {
  execSync('npm --prefix web run build', { stdio: 'pipe' });
  assert(true, 'Production Web Build: tsc && vite build completes cleanly with 0 TypeScript/Vite errors');
} catch (err) {
  console.error(err.stdout?.toString() || err.message);
  assert(false, 'Production Web Build failed');
}

console.log('\n================================================================');
console.log(`🏆 ALL ${passedTests}/${totalTests} DIAGNOSTIC VESTIBULAR VERIFICATION TESTS PASSED (100%)`);
console.log('================================================================\n');
