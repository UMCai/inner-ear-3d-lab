/**
 * web/src/physics/surgicalEngine.ts
 *
 * Stage 4 Master Physics & Electrophysiological Engine:
 * Surgical Approaches, Implant Kinematics & Clinical Biomechanics
 *
 * Implements:
 * 1. Cochlear Implant (CI) Kinematics along Scala Tympani 3D Lumen Spline (s ∈ [0, 28mm], θ ∈ [0°, 650°]).
 * 2. Advance Off-Stylet (AOS) 2-Phase Curvature ODE for Pre-Curved Perimodiolar Arrays.
 * 3. Real-Time Greenwood Tonotopic Channel Matching (16–22 Platinum Electrode Contacts).
 * 4. Insertion Force ODE (F_ins = F_fric + F_bend + F_contact) & Scalar Translocation Collision Warning System.
 * 5. Transmastoid Labyrinthectomy 4-Step Resection Kinematics, Acute Vestibular Deafferentation Collapse (90 -> 0 sp/s),
 *    Contralateral Spontaneous Paralytic Nystagmus (SPV ~ 36°/s, Alexander 3rd Degree), and Central Compensation ODE (τ_comp = 72h).
 * 6. Retrosigmoid Neurectomy & Acoustic Neuroma CPA Exposure: IAC 4-Quadrant Kinematics (Bill's Bar, Falciform Crest,
 *    CN VII, Cochlear Nerve, SVN, IVN), Cleavage Plane Normal, Selective Division Transection Preserving Tonotopy/Hearing,
 *    Koos Tumor Staging (Stages 0–IV), Click-Evoked ABR Wave V Latency/Amplitude ODE, and Facial Nerve EMG Discharges.
 */

import {
  COCHLEA_SPLINE_KNOTS,
  greenwoodFrequency,
} from '../data/greenwoodEngine.ts';

// =============================================================================
// 1. Surgical Coordinate Anchors & Constants (RAS Stereotaxic mm)
// =============================================================================

export const SURGICAL_LANDMARKS = {
  macewenApproachVector: [18.5, -8.2, 4.5] as const,
  mastoidAntrumTarget: [11.2, -3.5, 2.8] as const,
  facialNerveMastoid: [9.8, -2.1, -3.2] as const,
  chordaTympaniOrigin: [10.4, -1.8, -5.5] as const,
  facialRecessTarget: [10.1, -1.95, -4.35] as const,
  roundWindowNiche: [4.665, 1.022, -2.432] as const,
  cochleostomyTarget: [4.2, 1.45, -2.8] as const,
  basilarMembraneBase: [4.665, 1.022, -2.432] as const,
  scalaTympaniLumenBase: [4.665, 1.022, -2.882] as const,
  iacPorusAcusticus: [2.8, 1.1, 0.1] as const,
  iacFundusMidpoint: [4.1, 1.3, 0.4] as const,
  billsBarCrista: [4.05, 1.25, 0.85] as const,
  falciformCrista: [4.1, 1.3, 0.4] as const,
  sigmoidSinusLimit: [11.2, -6.0, -2.0] as const,
  jugularBulbDome: [6.8, -0.5, -6.4] as const,
  cochlearModiolusCenter: [2.2, 5.2, -2.2] as const,
};

export const SURGICAL_CAMERA_PERSPECTIVES = {
  cochlearImplant: {
    cameraPosRAS: [18.0, -10.0, 5.0] as [number, number, number],
    targetRAS: [4.665, 1.022, -2.432] as [number, number, number], // Round Window
    cameraUpRAS: [0, 0, 1] as [number, number, number],
  },
  labyrinthectomy: {
    cameraPosRAS: [22.0, -12.0, 7.0] as [number, number, number],
    targetRAS: [8.68, 0.45, 0.82] as [number, number, number], // Lateral Semicircular Canal
    cameraUpRAS: [0, 0, 1] as [number, number, number],
  },
  neurectomy: {
    cameraPosRAS: [-12.0, -18.0, 3.5] as [number, number, number],
    targetRAS: [2.8, 1.1, 0.1] as [number, number, number], // Porus Acusticus
    cameraUpRAS: [0, 0, 1] as [number, number, number],
  },
};

export const CI_CONSTANTS = {
  cochleaLengthMm: 28.79,
  totalSpiralAngleDeg: 650.0,
  spiralExponent: 0.88,
  lumenHeightOffsetMm: 0.45, // baseline distance from ST center to basilar membrane
  defaultElectrodeCount: 22,
  contactPitchMm: 1.1,
  straightMaxDepthMm: 28.0,
  perimodiolarMaxDepthMm: 21.0,
  styletReleaseDepthMm: 9.5,
  curlLambdaMm: 3.2,
  curlMaxOffsetMm: 0.65,
  maxSafeForceMilliNewtons: 15.0,
  cautionForceMilliNewtons: 28.0,
  translocationBreachForceMilliNewtons: 30.0,
  translocationBreachDistMm: 0.1,
  translocationBreachPitchDeg: 15.0,
};

export const LABYRINTHECTOMY_CONSTANTS = {
  restingFiringRateSpikesSec: 90.0,
  spvCoefficient: 0.4, // SPV_acute = 0.40 * 90 = 36.0 deg/s
  acuteSpvDegSec: 36.0,
  compensationTauHours: 72.0,
  normalDrillRpm: 70000,
};

export const NEURECTOMY_CONSTANTS = {
  baselineWaveVLatencyMs: 5.7,
  baselineWaveVAmplitudeMicroVolts: 0.55,
  cleavagePlaneNormal: [-0.32, 0.88, 0.35] as [number, number, number],
  cleavagePlanePoint: [2.8, 1.1, 0.1] as [number, number, number],
  baselineEMGNoiseMicroVolts: 8.0,
  emgAlarmThresholdMicroVolts: 500.0,
};

// =============================================================================
// 2. Types & Interfaces
// =============================================================================

export type SurgicalProcedure = 'cochlear_implant' | 'labyrinthectomy' | 'neurectomy';
export type CIArrayType = 'lateral_wall' | 'perimodiolar';
export type CIApproach = 'round_window' | 'cochleostomy';
export type TranslocationRiskLevel = 'optimal' | 'caution' | 'breach';
export type KoosStage = 0 | 1 | 2 | 3 | 4; // 0=None, 1=Intracanalicular, 2=CPA, 3=Brainstem, 4=Compression

export interface CIInsertionState {
  insertionDepthMm: number;
  angularDepthDeg: number;
  arrayType: CIArrayType;
  approach: CIApproach;
  pitchDeviationDeg: number;
  yawDeviationDeg: number;
  insertionForceMilliNewtons: number;
  distanceToBasilarMembraneMm: number;
  translocationRisk: TranslocationRiskLevel;
  activeElectrodesInCochlea: number;
  channelFrequenciesHz: number[];
  isRuptured: boolean;
  audiogramThresholdShiftDb: number;
  tipCoordinatesRAS: [number, number, number];
}

export interface LabyrinthectomyState {
  step: 0 | 1 | 2 | 3; // 0=Mastoidectomy, 1=Canalectomy, 2=Vestibulotomy, 3=Curettage
  isDrillActive: boolean;
  drillRpm: number;
  canalsMilled: { horizontal: boolean; superior: boolean; posterior: boolean };
  neuroepitheliumAblated: boolean;
  vestibularFiringRateSpikesSec: number;
  spontaneousSPVDegSec: number;
  compensationTimeHours: number;
  vhitGain: number;
  alexanderDegree: 0 | 1 | 2 | 3;
  nystagmusBeatDirection: 'Left-Beating' | 'Right-Beating' | 'None';
  audiogramThresholdShiftDb: number;
}

export interface NeurectomyState {
  step: 0 | 1 | 2 | 3; // 0=Craniotomy, 1=CPA Exposure, 2=Cleavage Ident, 3=Transection
  activeTool: 'scissors' | 'hook' | 'bipolar';
  cleavagePlaneVisible: boolean;
  koosStage: KoosStage;
  vestibularNerveTransected: boolean;
  cochlearNervePreserved: boolean;
  facialNervePreserved: boolean;
  abrWaveVLatencyMs: number;
  abrWaveVAmplitudeMicroVolts: number;
  facialEMGVoltageMicroVolts: number;
  isEMGAlarmActive: boolean;
  tractionRisk: 'SAFE' | 'WARNING' | 'CRITICAL';
  audiogramThresholdShiftDb: number;
}

// =============================================================================
// 3. Cochlear Implant (CI) Kinematics & Mechanics
// =============================================================================

/**
 * Computes angular insertion depth θ(s) in degrees along the cochlear spiral:
 * θ(s) = θ_total * (s / L)^γ_spiral
 */
export function computeAngularInsertionDepth(
  depthMm: number,
  totalLengthMm = CI_CONSTANTS.cochleaLengthMm
): number {
  if (depthMm <= 0.0) return 0.0;
  const clampedDepth = Math.max(0.0, Math.min(totalLengthMm, depthMm));
  const ratio = clampedDepth / totalLengthMm;
  const angle = CI_CONSTANTS.totalSpiralAngleDeg * Math.pow(ratio, CI_CONSTANTS.spiralExponent);
  return Math.round(angle * 10) / 10;
}

/**
 * Computes Greenwood characteristic place frequencies for N electrode contacts (E1 apical to EN basal).
 */
export function computeChannelFrequencies(
  tipDepthMm: number,
  contactCount = CI_CONSTANTS.defaultElectrodeCount,
  contactPitchMm = CI_CONSTANTS.contactPitchMm,
  cochleaLengthMm = CI_CONSTANTS.cochleaLengthMm
): number[] {
  const frequencies: number[] = new Array(contactCount);

  for (let i = 0; i < contactCount; i++) {
    // E0 (apical lead at tip, i=0) to E_(N-1) (basal lead, i=contactCount-1)
    const offsetFromTip = i * contactPitchMm;
    const contactDepth = Math.max(0.0, tipDepthMm - offsetFromTip);
    const normalizedPos = Math.max(0.0, Math.min(1.0, 1.0 - contactDepth / cochleaLengthMm));
    frequencies[i] = Math.round(greenwoodFrequency(normalizedPos));
  }

  return frequencies;
}

/**
 * Evaluates 3D RAS position along the Scala Tympani centerline spline.
 */
export function evaluateScalaTympaniSpline(
  depthMm: number,
  approach: CIApproach = 'round_window',
  arrayType: CIArrayType = 'lateral_wall',
  pitchDevDeg = 0.0,
  yawDevDeg = 0.0
): [number, number, number] {
  const clampedDepth = Math.max(0.0, Math.min(CI_CONSTANTS.cochleaLengthMm, depthMm));
  // normalized x: 1.0 at Round Window base (s=0), 0.0 at Apex (s=28.79)
  const normX = Math.max(0.0, Math.min(1.0, 1.0 - clampedDepth / CI_CONSTANTS.cochleaLengthMm));

  const knotCount = COCHLEA_SPLINE_KNOTS.length;
  const scaledIdx = normX * (knotCount - 1);
  const idx = Math.min(knotCount - 2, Math.floor(scaledIdx));
  const frac = scaledIdx - idx;

  const k0 = COCHLEA_SPLINE_KNOTS[idx];
  const k1 = COCHLEA_SPLINE_KNOTS[idx + 1];

  let x = k0[0] + (k1[0] - k0[0]) * frac;
  let y = k0[1] + (k1[1] - k0[1]) * frac;
  // Scala tympani lumen runs ~0.45mm inferior (-Z) to basilar partition
  let z = k0[2] + (k1[2] - k0[2]) * frac - CI_CONSTANTS.lumenHeightOffsetMm;

  if (approach === 'cochleostomy') {
    // Cochleostomy entry is ~1.0mm anteroinferior to RW, blending into ST lumen
    const blend = Math.max(0.0, 1.0 - clampedDepth / 3.0);
    x += (SURGICAL_LANDMARKS.cochleostomyTarget[0] - SURGICAL_LANDMARKS.roundWindowNiche[0]) * blend;
    y += (SURGICAL_LANDMARKS.cochleostomyTarget[1] - SURGICAL_LANDMARKS.roundWindowNiche[1]) * blend;
    z += (SURGICAL_LANDMARKS.cochleostomyTarget[2] - SURGICAL_LANDMARKS.scalaTympaniLumenBase[2]) * blend;
  }

  // Pre-curved perimodiolar AOS curling beyond stylet release point (9.5mm)
  if (arrayType === 'perimodiolar' && clampedDepth > CI_CONSTANTS.styletReleaseDepthMm) {
    const curlDelta = clampedDepth - CI_CONSTANTS.styletReleaseDepthMm;
    const curlFactor = 1.0 - Math.exp(-curlDelta / CI_CONSTANTS.curlLambdaMm);
    const modiolus = SURGICAL_LANDMARKS.cochlearModiolusCenter;

    // Vector towards modiolus center
    const toModX = modiolus[0] - x;
    const toModY = modiolus[1] - y;
    const len = Math.hypot(toModX, toModY);
    if (len > 1e-4) {
      const offset = CI_CONSTANTS.curlMaxOffsetMm * curlFactor;
      x += (toModX / len) * offset;
      y += (toModY / len) * offset;
    }
  }

  // 3D pitch and yaw trajectory deviation deflection
  if (clampedDepth > 0.0 && (pitchDevDeg !== 0.0 || yawDevDeg !== 0.0)) {
    const pitchRad = (pitchDevDeg * Math.PI) / 180.0;
    const yawRad = (yawDevDeg * Math.PI) / 180.0;
    // Pitch elevates towards basilar membrane roof (+Z)
    const zDeflect = clampedDepth * Math.sin(pitchRad) * 0.115;
    // Yaw deflects anteroposteriorly (+Y)
    const yDeflect = clampedDepth * Math.sin(yawRad) * 0.115;
    z += zDeflect;
    y += yDeflect;
  }

  return [x, y, z];
}

/**
 * Computes mechanical axial insertion force in milliNewtons (mN):
 * F_ins = F_fric + F_bend + F_contact
 */
export function computeInsertionForce(
  depthMm: number,
  arrayType: CIArrayType = 'lateral_wall',
  pitchDevDeg = 0.0,
  yawDevDeg = 0.0
): number {
  if (depthMm <= 0.0) return 0.0;
  const s = Math.max(0.0, Math.min(CI_CONSTANTS.straightMaxDepthMm, depthMm));

  // 1. Sliding Perilymph Friction (rises with contact length and curvature)
  const fFric = 1.5 + 0.32 * s + 0.0075 * s * s;

  // 2. Elastic Bending Resistance
  const bendStiffness = arrayType === 'perimodiolar' ? 1.05 : 0.65;
  const fBend = bendStiffness * Math.pow(s / CI_CONSTANTS.straightMaxDepthMm, 1.8) * 6.5;

  // 3. Wall Contact & Deviation Impingement
  const totalDev = Math.hypot(pitchDevDeg, yawDevDeg);
  let fContact = 0.0;

  if (totalDev > 6.0) {
    const excessDev = totalDev - 6.0;
    fContact += 0.8 * Math.pow(excessDev, 1.75) * (0.4 + 0.6 * (s / 15.0));
  }

  // Pitch deviation towards ceiling (basilar membrane) causes intense localized force spike
  if (pitchDevDeg > 10.0 && s >= 6.0) {
    const pitchExcess = pitchDevDeg - 10.0;
    fContact += 1.8 * Math.pow(pitchExcess, 1.9) * (0.3 + 0.7 * Math.min(1.5, s / 10.0));
  }

  const totalForce = fFric + fBend + fContact;
  return Math.round(totalForce * 10) / 10;
}

/**
 * Computes distance from advancing tip to the basilar membrane partition in mm:
 * d_BM(s) = h_lumen - Δz_traj(s)
 */
export function computeBasilarMembraneDistance(depthMm: number, pitchDevDeg = 0.0): number {
  if (depthMm <= 0.0) return CI_CONSTANTS.lumenHeightOffsetMm;
  const s = Math.max(0.0, depthMm);

  // Pitch deviation elevates tip towards the basilar membrane roof
  const elevation = s * Math.sin((Math.max(0.0, pitchDevDeg) * Math.PI) / 180.0) * 0.115;
  const dist = CI_CONSTANTS.lumenHeightOffsetMm - elevation;
  return Math.max(0.02, Math.round(dist * 100) / 100);
}

/**
 * Computes complete CI insertion kinematics and translocation detection.
 */
export function computeCIInsertionKinematics(
  depthMm: number,
  arrayType: CIArrayType = 'lateral_wall',
  approach: CIApproach = 'round_window',
  pitchDevDeg = 0.0,
  yawDevDeg = 0.0
): CIInsertionState {
  const maxDepth =
    arrayType === 'perimodiolar'
      ? CI_CONSTANTS.perimodiolarMaxDepthMm
      : CI_CONSTANTS.straightMaxDepthMm;
  const clampedDepth = Math.max(0.0, Math.min(maxDepth, depthMm));

  const angularDepthDeg = computeAngularInsertionDepth(clampedDepth);
  const insertionForce = computeInsertionForce(clampedDepth, arrayType, pitchDevDeg, yawDevDeg);
  const distanceToBM = computeBasilarMembraneDistance(clampedDepth, pitchDevDeg);

  // Number of active electrode contacts inside the cochlea
  const activeElectrodes = Math.max(
    0,
    Math.min(
      CI_CONSTANTS.defaultElectrodeCount,
      Math.floor(clampedDepth / CI_CONSTANTS.contactPitchMm) + 1
    )
  );

  const channelFrequenciesHz = computeChannelFrequencies(
    clampedDepth,
    CI_CONSTANTS.defaultElectrodeCount,
    CI_CONSTANTS.contactPitchMm
  );

  // Scalar Translocation Warning & Rupture Detection
  let translocationRisk: TranslocationRiskLevel = 'optimal';
  let isRuptured = false;
  let audiogramThresholdShiftDb = 0;

  if (
    (distanceToBM < CI_CONSTANTS.translocationBreachDistMm &&
      insertionForce >= CI_CONSTANTS.translocationBreachForceMilliNewtons) ||
    (pitchDevDeg >= CI_CONSTANTS.translocationBreachPitchDeg && clampedDepth >= 8.0)
  ) {
    translocationRisk = 'breach';
    isRuptured = true;
    audiogramThresholdShiftDb = 120; // Complete acoustic hair cell destruction
  } else if (
    distanceToBM < 0.35 ||
    insertionForce >= CI_CONSTANTS.maxSafeForceMilliNewtons ||
    Math.hypot(pitchDevDeg, yawDevDeg) >= 8.0
  ) {
    translocationRisk = 'caution';
  }

  const tipCoordinatesRAS = evaluateScalaTympaniSpline(
    clampedDepth,
    approach,
    arrayType,
    pitchDevDeg,
    yawDevDeg
  );

  return {
    insertionDepthMm: clampedDepth,
    angularDepthDeg,
    arrayType,
    approach,
    pitchDeviationDeg: pitchDevDeg,
    yawDeviationDeg: yawDevDeg,
    insertionForceMilliNewtons: insertionForce,
    distanceToBasilarMembraneMm: distanceToBM,
    translocationRisk,
    activeElectrodesInCochlea: activeElectrodes,
    channelFrequenciesHz,
    isRuptured,
    audiogramThresholdShiftDb,
    tipCoordinatesRAS,
  };
}

// =============================================================================
// 4. Transmastoid Labyrinthectomy Biomechanics & Neurophysiology
// =============================================================================

/**
 * Computes spontaneous slow-phase velocity (SPV) with exponential central vestibular compensation:
 * SPV(t) = SPV_acute * exp(-t / τ_comp)
 */
export function computeLabyrinthectomyCompensation(
  compensationHours: number,
  acuteSpv = LABYRINTHECTOMY_CONSTANTS.acuteSpvDegSec,
  tauHours = LABYRINTHECTOMY_CONSTANTS.compensationTauHours
): number {
  if (compensationHours <= 0.0) return acuteSpv;
  const decay = Math.exp(-compensationHours / tauHours);
  const compensatedSpv = acuteSpv * decay;
  return Math.round(compensatedSpv * 10) / 10;
}

/**
 * Classifies Alexander's Law degree for spontaneous nystagmus based on SPV.
 */
export function classifyAlexanderDegreeFromSpv(spvDegSec: number): 0 | 1 | 2 | 3 {
  if (spvDegSec <= 3.0) return 0;
  if (spvDegSec < 10.0) return 1;
  if (spvDegSec <= 25.0) return 2;
  return 3;
}

/**
 * Computes complete Labyrinthectomy surgical state.
 */
export function computeLabyrinthectomyAblation(
  step: 0 | 1 | 2 | 3,
  compensationHours = 0.0,
  isDrillActive = false
): LabyrinthectomyState {
  const canalsMilled = {
    horizontal: step >= 1,
    superior: step >= 1,
    posterior: step >= 1,
  };

  const neuroepitheliumAblated = step === 3;
  let vestibularFiringRate = LABYRINTHECTOMY_CONSTANTS.restingFiringRateSpikesSec;
  let spontaneousSPVDegSec = 0.0;
  let vhitGain = 1.0;
  let alexanderDegree: 0 | 1 | 2 | 3 = 0;
  let nystagmusBeatDirection: 'Left-Beating' | 'Right-Beating' | 'None' = 'None';
  let audiogramThresholdShiftDb = 0;

  if (neuroepitheliumAblated) {
    vestibularFiringRate = 0.0; // Complete deafferentation collapse
    spontaneousSPVDegSec = computeLabyrinthectomyCompensation(compensationHours);
    alexanderDegree = classifyAlexanderDegreeFromSpv(spontaneousSPVDegSec);
    nystagmusBeatDirection = 'Left-Beating'; // Beats toward healthy left ear (contralateral)
    vhitGain = 0.08; // Total canal areflexia
    audiogramThresholdShiftDb = 120; // Permanent surgical dead ear (anacusis)
  } else if (step === 2) {
    // Vestibulotomy partial disturbance
    vestibularFiringRate = 45.0;
    spontaneousSPVDegSec = 14.0;
    alexanderDegree = 2;
    nystagmusBeatDirection = 'Left-Beating';
    vhitGain = 0.45;
    audiogramThresholdShiftDb = 60;
  }

  return {
    step,
    isDrillActive,
    drillRpm: isDrillActive ? LABYRINTHECTOMY_CONSTANTS.normalDrillRpm : 0,
    canalsMilled,
    neuroepitheliumAblated,
    vestibularFiringRateSpikesSec: vestibularFiringRate,
    spontaneousSPVDegSec,
    compensationTimeHours: compensationHours,
    vhitGain,
    alexanderDegree,
    nystagmusBeatDirection,
    audiogramThresholdShiftDb,
  };
}

// =============================================================================
// 5. Retrosigmoid Neurectomy & Acoustic Neuroma CPA Electrophysiology
// =============================================================================

/**
 * Computes ABR Wave V latency prolongation and amplitude attenuation under Koos tumor staging and traction:
 * Δτ_V = Koos * 0.30ms + tractionGrams * 0.05ms
 */
export function computeABRWaveV(
  koosStage: KoosStage,
  tractionForceGrams = 0.0
): { latencyMs: number; amplitudeMicroVolts: number; risk: 'SAFE' | 'WARNING' | 'CRITICAL' } {
  const deltaLatency = koosStage * 0.32 + Math.max(0.0, tractionForceGrams) * 0.35;
  const latencyMs = Math.round((NEURECTOMY_CONSTANTS.baselineWaveVLatencyMs + deltaLatency) * 100) / 100;

  const rawAmp =
    NEURECTOMY_CONSTANTS.baselineWaveVAmplitudeMicroVolts -
    koosStage * 0.08 -
    Math.max(0.0, tractionForceGrams) * 0.12;
  const amplitudeMicroVolts = Math.round(Math.max(0.05, rawAmp) * 100) / 100;

  let risk: 'SAFE' | 'WARNING' | 'CRITICAL' = 'SAFE';
  if (deltaLatency > 0.8 || amplitudeMicroVolts < 0.2) {
    risk = 'CRITICAL';
  } else if (deltaLatency > 0.4 || amplitudeMicroVolts < 0.35) {
    risk = 'WARNING';
  }

  return { latencyMs, amplitudeMicroVolts, risk };
}

/**
 * Computes Facial Nerve (CN VII) EMG discharge voltage based on instrument proximity and traction:
 * Quiescent baseline: ~8 μV
 * Mechanical burst: 100–300 μV
 * Traction/stretch alarm: > 500 μV
 */
export function computeFacialEMGVoltage(
  toolProximityMm = 5.0,
  tractionForceGrams = 0.0
): { voltageMicroVolts: number; isAlarmActive: boolean } {
  let voltage = NEURECTOMY_CONSTANTS.baselineEMGNoiseMicroVolts;

  // Mechanical proximity trigger (< 1.5mm)
  if (toolProximityMm < 1.5) {
    const proximityIntensity = Math.max(0.0, 1.5 - toolProximityMm) / 1.5;
    voltage += proximityIntensity * 220.0;
  }

  // Traction/stretch discharge
  if (tractionForceGrams > 0.0) {
    voltage += Math.min(800.0, tractionForceGrams * 95.0);
  }

  voltage = Math.round(voltage * 10) / 10;
  const isAlarmActive = voltage >= NEURECTOMY_CONSTANTS.emgAlarmThresholdMicroVolts;

  return { voltageMicroVolts: voltage, isAlarmActive };
}

/**
 * Computes complete Retrosigmoid Neurectomy and Acoustic Neuroma electrophysiological state.
 */
export function computeNeurectomyElectrophysiology(
  step: 0 | 1 | 2 | 3,
  koosStage: KoosStage = 0,
  toolProximityMm = 5.0,
  tractionForceGrams = 0.0,
  activeTool: 'scissors' | 'hook' | 'bipolar' = 'scissors',
  cleavagePlaneVisible = true
): NeurectomyState {
  const abr = computeABRWaveV(koosStage, tractionForceGrams);
  const emg = computeFacialEMGVoltage(toolProximityMm, tractionForceGrams);

  // Selective vestibular neurectomy: transect vestibular division at Step 3,
  // strictly preserving the cochlear division and CN VII!
  const vestibularNerveTransected = step === 3;
  const cochlearNervePreserved = true; // Hearing preservation goal achieved!
  const facialNervePreserved = emg.voltageMicroVolts < 750.0;

  return {
    step,
    activeTool,
    cleavagePlaneVisible,
    koosStage,
    vestibularNerveTransected,
    cochlearNervePreserved,
    facialNervePreserved,
    abrWaveVLatencyMs: abr.latencyMs,
    abrWaveVAmplitudeMicroVolts: abr.amplitudeMicroVolts,
    facialEMGVoltageMicroVolts: emg.voltageMicroVolts,
    isEMGAlarmActive: emg.isAlarmActive,
    tractionRisk: abr.risk,
    audiogramThresholdShiftDb: 0, // Natural hearing intact!
  };
}
