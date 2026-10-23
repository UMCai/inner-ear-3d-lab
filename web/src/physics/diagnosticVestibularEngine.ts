/**
 * web/src/physics/diagnosticVestibularEngine.ts
 *
 * Diagnostic Vestibular Testing Suite: Caloric Irrigation (COWS) & Video Head Impulse Test (vHIT).
 * Stage 3 — Phase 3B: Gate 3 Medaium Clinical Engine.
 *
 * Physical & Neurophysiological Foundations:
 * 1. Caloric Irrigation Simulator:
 *    - Supine +30° head-up posture alignment (θ_pitch = +60° relative to vertical).
 *    - Endolymph thermal diffusion ODE & density perturbation Δρ = -β · ρ0 · ΔT(t).
 *    - Viscous Hagen-Poiseuille flow & Steinhausen overdamped cupular deflection.
 *    - Ewald's 2nd Law & COWS rule proof (Warm = Same, Cold = Opposite).
 *    - Alexander's Law: Gaze-dependent slow-phase velocity modulation & 1st/2nd/3rd Degree classification.
 *    - Jongkees Bithermal Formula: Canal Paresis (UW%), Directional Preponderance (DP%),
 *      Bilateral Vestibular Hypofunction, and Central Cerebellar Hyperactivity.
 *
 * 2. Video Head Impulse Test (vHIT) Simulator:
 *    - Passive unpredictable high-acceleration head thrusts (15° displacement, 120 ms duration,
 *      ωpeak = 250°/s, αpeak = 6,545°/s² minimum-jerk profile).
 *    - 3 Coplanar Push-Pull Canal Pairs: Horizontal (Yaw), RALP (+45°), LARP (-45°).
 *    - Closed-form SO(3) head quaternion generation.
 *    - International Curthoys-MacDougall 40–80 ms area-based regression VOR gain.
 *    - Saccadic burst generator: Covert saccades (70–100 ms) and Overt saccades (150–220 ms).
 *    - HIMP (Earth-fixed target) vs. SHIMP (Head-fixed suppression target) paradigms.
 *    - Pre-allocated zero-allocation VHITImpulseBuffer (350 samples, 0–350 ms).
 */

// =============================================================================
// 1. Physical & Physiological Constants
// =============================================================================

export const CALORIC_CONSTANTS = {
  BETA: 3.0e-4,              // Endolymph volumetric thermal expansion coefficient (1/K)
  RHO_0: 1000.0,             // Base endolymph density at 37°C (kg/m³)
  GRAVITY: 9.81,             // Acceleration due to gravity (m/s²)
  H_EFF: 0.0045,             // Effective vertical height of horizontal canal in supine +30° (m)
  VISCOSITY_ETA: 1.0e-3,     // Dynamic viscosity of endolymph (Pa·s)
  CANAL_LENGTH_L: 0.01546,   // Horizontal canal length (m)
  LUMEN_RADIUS_R: 0.00016,   // Horizontal canal lumen radius (m)
  T_PEAK: 35.0,              // Thermal diffusion peak time in temporal bone (s)
  TAU_CUPULA: 12.0,          // Overdamped Steinhausen cupular restoration time constant (s)
  BASE_FIRING_RATE: 90.0,    // Spontaneous resting firing rate of vestibular afferents (spikes/s)
  K_ALEXANDER: 0.40,         // Alexander's law gaze modulation coefficient
} as const;

export const VHIT_CONSTANTS = {
  DISPLACEMENT_DEG: 15.0,    // Angular head displacement (degrees)
  DURATION_SEC: 0.120,       // Head thrust duration (seconds)
  PEAK_VELOCITY_DEG_S: 250.0,// Peak angular velocity: 2 * Δθ / T (deg/s)
  PEAK_ACCEL_DEG_S2: 6544.98,// Peak angular acceleration: π * ωpeak / T (deg/s²)
  CURTHOYS_WINDOW_START_SEC: 0.040, // Area gain integration start (40 ms)
  CURTHOYS_WINDOW_END_SEC: 0.080,   // Area gain integration end (80 ms)
} as const;

// 3 Coplanar Canal Push-Pull RAS axes
export const CANAL_PAIR_AXES: Record<'horizontal' | 'ralp' | 'larp', [number, number, number]> = {
  horizontal: [0.0, 0.0, 1.0],
  ralp: [Math.SQRT1_2, -Math.SQRT1_2, 0.0], // +45° to sagittal plane
  larp: [Math.SQRT1_2, Math.SQRT1_2, 0.0],  // -45° to sagittal plane
};

// =============================================================================
// 2. Types & Interfaces
// =============================================================================

export type CaloricIrrigationType = 'R44' | 'R30' | 'L44' | 'L30' | 'Ice4';

export type AlexanderDegree = '1st Degree' | '2nd Degree' | '3rd Degree';

export interface CaloricConvectionState {
  deltaT: number;                  // Temperature diff at canal lumen (°C)
  deltaRho: number;                // Endolymph density change (kg/m³)
  buoyancyPressure: number;        // Hydrostatic buoyancy differential (Pa)
  convectiveVelocity: number;      // Endolymph flow velocity (m/s)
  isAmpullopetal: boolean;         // True if flow is directed toward ampulla
  isAmpullofugal: boolean;         // True if flow is directed away from ampulla
  flowDirection: 'ampullopetal' | 'ampullofugal' | 'neutral';
  cupulaDeflection: number;        // Normalized cupula displacement [-1.0, 1.0]
  afferentFiringRate: number;      // CN VIII firing rate (spikes/s)
  slowPhaseVelocity: number;       // Magnitude of SPV (°/s)
  fastPhaseBeatDirection: 'Right-Beating' | 'Left-Beating' | 'None (Resting)';
  beatDirectionDescription: string;// e.g. "Same Ear (Ipsilateral)" vs "Opposite Ear (Contralateral)"
}

export interface JongkeesResult {
  canalParesisPercent: number;     // Unilateral Weakness (UW%)
  directionalPreponderancePercent: number; // Directional Preponderance (DP%)
  pareticEar: 'right' | 'left' | 'symmetric';
  preponderanceDirection: 'right' | 'left' | 'symmetric';
  isBilateralWeakness: boolean;    // Total response < 20°/s
  isHyperactive: boolean;          // Total > 140°/s or single > 80°/s
  totalResponseDegPerSec: number;
  diagnosticFlags: string[];
  clinicalInterpretation: string;
}

export type VHITCanalPair = 'horizontal' | 'ralp' | 'larp';
export type VHITPathologyPreset = 'normal' | 'acute_neuritis' | 'chronic_schwannoma' | 'bilateral_loss';
export type VHITParadigm = 'himp' | 'shimp';

// =============================================================================
// 3. Caloric Convective Physics & COWS Engine
// =============================================================================

/**
 * Computes thermal diffusion envelope inside the temporal bone toward canal lumen
 * ΔT(t) = ΔT_irrigate * (t / t_peak) * exp(1 - t / t_peak)
 */
export function computeCaloricThermalDiffusion(deltaTIrrigate: number, tSec: number): number {
  if (tSec <= 0) return 0.0;
  const ratio = tSec / CALORIC_CONSTANTS.T_PEAK;
  return deltaTIrrigate * ratio * Math.exp(1.0 - ratio);
}

/**
 * Computes endolymph density change from volumetric thermal expansion
 * Δρ = -β · ρ0 · ΔT
 */
export function computeEndolymphDensityChange(deltaT: number): number {
  return -CALORIC_CONSTANTS.BETA * CALORIC_CONSTANTS.RHO_0 * deltaT;
}

/**
 * Computes convective hydrostatic buoyancy pressure differential across cupula
 * ΔP = -Δρ · g · Heff = β · ρ0 · g · Heff · ΔT
 */
export function computeBuoyancyPressure(deltaT: number): number {
  return (
    CALORIC_CONSTANTS.BETA *
    CALORIC_CONSTANTS.RHO_0 *
    CALORIC_CONSTANTS.GRAVITY *
    CALORIC_CONSTANTS.H_EFF *
    deltaT
  );
}

/**
 * Computes endolymph flow velocity via Hagen-Poiseuille laminar resistance
 * v = (r² / (8 · η · L)) · ΔP
 */
export function computeConvectiveVelocity(buoyancyPressure: number): number {
  const r = CALORIC_CONSTANTS.LUMEN_RADIUS_R;
  const eta = CALORIC_CONSTANTS.VISCOSITY_ETA;
  const L = CALORIC_CONSTANTS.CANAL_LENGTH_L;
  const conductance = (r * r) / (8.0 * eta * L);
  return conductance * buoyancyPressure;
}

/**
 * Evaluates comprehensive caloric convection state for a given temperature, time, and ear.
 * Implements Ewald's 2nd Law and the COWS Rule.
 */
export function computeCaloricConvection(
  deltaTIrrigate: number,
  tSec: number,
  ear: 'right' | 'left' = 'right'
): CaloricConvectionState {
  const deltaT = computeCaloricThermalDiffusion(deltaTIrrigate, tSec);
  const deltaRho = computeEndolymphDensityChange(deltaT);
  const buoyancyPressure = computeBuoyancyPressure(deltaT);
  const convectiveVelocity = computeConvectiveVelocity(buoyancyPressure);

  // In supine +30° head-up posture:
  // Warm irrigation (deltaT > 0, deltaRho < 0): endolymph warms, becomes lighter, and rises.
  // Because the horizontal canal arch is superior, rising endolymph flows toward the ampulla (ampullopetal).
  // Cold irrigation (deltaT < 0, deltaRho > 0): endolymph cools, becomes denser, and sinks.
  // Sinking endolymph flows away from the ampulla (ampullofugal).
  const isAmpullopetal = deltaTIrrigate > 0;
  const isAmpullofugal = deltaTIrrigate < 0;
  const flowDirection: 'ampullopetal' | 'ampullofugal' | 'neutral' =
    Math.abs(deltaT) < 0.05
      ? 'neutral'
      : isAmpullopetal
      ? 'ampullopetal'
      : 'ampullofugal';

  // Cupular deflection is proportional to velocity normalized to maximum physiological deflection
  // Scale factor calibrated so peak response for 44°C is ~0.53 deflection
  const normFactor = 28000.0;
  const cupulaDeflection = Math.max(-1.0, Math.min(1.0, convectiveVelocity * normFactor));

  // Ewald's 2nd Law for Horizontal Canal:
  // Ampullopetal flow (cupula deflected toward utricle, deflection > 0) is EXCITATORY (> 90 sp/s).
  // Ampullofugal flow (cupula deflected away from utricle, deflection < 0) is INHIBITORY (< 90 sp/s).
  let afferentFiringRate: number = CALORIC_CONSTANTS.BASE_FIRING_RATE;
  if (cupulaDeflection > 0) {
    afferentFiringRate += cupulaDeflection * 120.0; // Up to 210 sp/s
  } else {
    afferentFiringRate += cupulaDeflection * 60.0;  // Down to 30 sp/s
  }
  afferentFiringRate = Math.max(10.0, Math.min(310.0, afferentFiringRate));

  // VOR Slow Phase & Saccade Fast Phase (COWS Rule):
  // Warm Irrigation: Ear excited -> Slow phase moves contralaterally -> Fast phase beats IPSILATERALLY (Same).
  // Cold Irrigation: Ear inhibited -> Slow phase moves ipsilaterally -> Fast phase beats CONTRALATERALLY (Opposite).
  let fastPhaseBeatDirection: 'Right-Beating' | 'Left-Beating' | 'None (Resting)' = 'None (Resting)';
  let beatDirectionDescription = 'Resting';

  if (Math.abs(cupulaDeflection) > 0.02) {
    if (ear === 'right') {
      if (isAmpullopetal) {
        // Right Warm -> Fast phase Right (Same)
        fastPhaseBeatDirection = 'Right-Beating';
        beatDirectionDescription = 'Same Ear (Ipsilateral)';
      } else {
        // Right Cold / Ice -> Fast phase Left (Opposite)
        fastPhaseBeatDirection = 'Left-Beating';
        beatDirectionDescription = 'Opposite Ear (Contralateral)';
      }
    } else {
      // Left ear
      if (isAmpullopetal) {
        // Left Warm -> Fast phase Left (Same)
        fastPhaseBeatDirection = 'Left-Beating';
        beatDirectionDescription = 'Same Ear (Ipsilateral)';
      } else {
        // Left Cold / Ice -> Fast phase Right (Opposite)
        fastPhaseBeatDirection = 'Right-Beating';
        beatDirectionDescription = 'Opposite Ear (Contralateral)';
      }
    }
  }

  // Slow phase velocity magnitude (typically 0–45°/s for normal bithermal calorics)
  const slowPhaseVelocity = Math.abs(cupulaDeflection) * 55.0;

  return {
    deltaT,
    deltaRho,
    buoyancyPressure,
    convectiveVelocity,
    isAmpullopetal,
    isAmpullofugal,
    flowDirection,
    cupulaDeflection,
    afferentFiringRate,
    slowPhaseVelocity,
    fastPhaseBeatDirection,
    beatDirectionDescription,
  };
}

// =============================================================================
// 4. Alexander's Law Live Gaze Modulation
// =============================================================================

/**
 * Classifies peripheral vestibular nystagmus into clinical Alexander degrees
 * - 1st Degree: SPV0 < 10°/s (present only when gazing in direction of fast phase)
 * - 2nd Degree: 10°/s <= SPV0 <= 25°/s (present at center gaze and fast phase)
 * - 3rd Degree: SPV0 > 25°/s (present in all 3 gaze directions)
 */
export function classifyAlexanderDegree(spvBase: number): AlexanderDegree {
  if (spvBase < 10.0) return '1st Degree';
  if (spvBase <= 25.0) return '2nd Degree';
  return '3rd Degree';
}

/**
 * Modulates vestibular slow-phase velocity based on conjugate horizontal gaze angle.
 * SPV(ψ) = max(0, SPV0 * [1.0 + k_Alex * sgn(beatDir) * (ψ / 30°)])
 *
 * @param spvBase Baseline slow phase velocity at primary center gaze (0°)
 * @param gazeYawDeg Gaze position in degrees (-30° Left to +30° Right)
 * @param beatDirectionSign +1 for Right-beating nystagmus, -1 for Left-beating nystagmus
 */
export function computeAlexanderModulation(
  spvBase: number,
  gazeYawDeg: number,
  beatDirectionSign: number
): { modulatedSPV: number; clinicalDegree: AlexanderDegree } {
  const normGaze = Math.max(-1.0, Math.min(1.0, gazeYawDeg / 30.0));
  const rawModulation = 1.0 + CALORIC_CONSTANTS.K_ALEXANDER * beatDirectionSign * normGaze;
  // Floor clamp ensures peripheral nystagmus never reverses sign on contralateral gaze
  const modulatedSPV = Math.max(0.0, spvBase * rawModulation);
  const clinicalDegree = classifyAlexanderDegree(spvBase);

  return {
    modulatedSPV,
    clinicalDegree,
  };
}

// =============================================================================
// 5. Jongkees Formula Diagnostic Engine
// =============================================================================

/**
 * Evaluates Jongkees' formulas for Bithermal Caloric testing:
 * - Canal Paresis / Unilateral Weakness (UW%)
 * - Directional Preponderance (DP%)
 * - Bilateral Hypofunction & Central Disinhibition criteria
 */
export function calculateJongkees(
  r44: number,
  r30: number,
  l44: number,
  l30: number
): JongkeesResult {
  const rightTotal = r44 + r30;
  const leftTotal = l44 + l30;
  const total = rightTotal + leftTotal;

  const totalRightBeating = r44 + l30;
  const totalLeftBeating = l44 + r30;

  // Zero-denominator / areflexia guard
  if (total <= 1e-4) {
    return {
      canalParesisPercent: 0.0,
      directionalPreponderancePercent: 0.0,
      pareticEar: 'symmetric',
      preponderanceDirection: 'symmetric',
      isBilateralWeakness: true,
      isHyperactive: false,
      totalResponseDegPerSec: 0.0,
      diagnosticFlags: ['Zero Response / Areflexia', 'Bilateral Vestibulopathy'],
      clinicalInterpretation:
        'Complete bilateral absence of caloric nystagmus response. Confirmed bilateral vestibular areflexia; evaluate with ice water caloric (4°C) and rotary chair testing.',
    };
  }

  // Canal Paresis / Unilateral Weakness: UW = |(R44 + R30) - (L44 + L30)| / Total * 100%
  const uw = (Math.abs(rightTotal - leftTotal) / total) * 100.0;

  // Directional Preponderance: DP = |(R44 + L30) - (L44 + R30)| / Total * 100%
  const dp = (Math.abs(totalRightBeating - totalLeftBeating) / total) * 100.0;

  let pareticEar: 'right' | 'left' | 'symmetric' = 'symmetric';
  if (uw > 25.0) {
    pareticEar = rightTotal < leftTotal ? 'right' : 'left';
  }

  let preponderanceDirection: 'right' | 'left' | 'symmetric' = 'symmetric';
  if (dp > 25.0) {
    preponderanceDirection = totalRightBeating > totalLeftBeating ? 'right' : 'left';
  }

  const isBilateralWeakness = total < 20.0;
  const isHyperactive = total > 140.0 || Math.max(r44, r30, l44, l30) > 80.0;

  const diagnosticFlags: string[] = [];
  const interpParts: string[] = [];

  if (isBilateralWeakness) {
    diagnosticFlags.push('Bilateral Vestibulopathy');
    interpParts.push(
      `Bilateral caloric hypofunction (Total SPV = ${total.toFixed(1)}°/s < 20°/s threshold). Consistent with bilateral vestibular loss (e.g. ototoxicity, bilateral neuropathy).`
    );
  } else if (isHyperactive) {
    diagnosticFlags.push('Central Hyperactive Disinhibition');
    interpParts.push(
      `Hyperactive caloric responses (Total SPV = ${total.toFixed(1)}°/s > 140°/s). Suggests loss of cerebellar vermis / nodulus-floccular inhibitory tone.`
    );
  }

  if (uw > 25.0) {
    diagnosticFlags.push('Significant Unilateral Weakness');
    diagnosticFlags.push(pareticEar === 'right' ? 'Right Canal Paresis' : 'Left Canal Paresis');
    interpParts.push(
      `Significant ${pareticEar.toUpperCase()} Canal Paresis of ${uw.toFixed(1)}% (clinical threshold > 25%). Indicates peripheral vestibular deficit in the ${pareticEar} horizontal semicircular canal or superior vestibular nerve.`
    );
  } else if (!isBilateralWeakness && !isHyperactive) {
    diagnosticFlags.push('Normal Symmetric');
    interpParts.push(
      `Normal caloric symmetry with UW = ${uw.toFixed(1)}% (≤ 25%). Horizontal semicircular canals exhibit bilateral physiologic symmetry.`
    );
  }

  if (dp > 25.0) {
    diagnosticFlags.push('Directional Preponderance');
    interpParts.push(
      `Directional Preponderance of ${dp.toFixed(1)}% beating ${preponderanceDirection.toUpperCase()} (> 25%). Indicates asymmetry in vestibular tone or central vestibular pathways.`
    );
  }

  return {
    canalParesisPercent: Math.round(uw * 10) / 10,
    directionalPreponderancePercent: Math.round(dp * 10) / 10,
    pareticEar,
    preponderanceDirection,
    isBilateralWeakness,
    isHyperactive,
    totalResponseDegPerSec: Math.round(total * 10) / 10,
    diagnosticFlags,
    clinicalInterpretation: interpParts.join(' '),
  };
}

// Canonical Clinical Presets for Jongkees Matrix
export const CALORIC_CLINICAL_PRESETS = {
  normal: { r44: 22, r30: 20, l44: 21, l30: 21, label: 'Normal Symmetric' },
  right_neuritis: { r44: 4, r30: 5, l44: 24, l30: 26, label: 'Acute Right Vestibular Neuritis' },
  left_schwannoma: { r44: 28, r30: 25, l44: 8, l30: 9, label: 'Left Vestibular Schwannoma' },
  bilateral_gentamicin: { r44: 3, r30: 2, l44: 2, l30: 3, label: 'Bilateral Gentamicin Toxicity' },
  directional_preponderance: { r44: 32, r30: 10, l44: 12, l30: 30, label: 'Right Directional Preponderance' },
} as const;

// =============================================================================
// 6. vHIT High-Acceleration Impulse Kinematics & Saccades
// =============================================================================

/**
 * Analytical minimum-jerk head angular velocity:
 * ω(t) = ωpeak * sin²(π * t / T) for 0 <= t <= T
 */
export function computeVHITHeadVelocity(tSec: number): number {
  if (tSec < 0.0 || tSec > VHIT_CONSTANTS.DURATION_SEC) return 0.0;
  const sinVal = Math.sin((Math.PI * tSec) / VHIT_CONSTANTS.DURATION_SEC);
  return VHIT_CONSTANTS.PEAK_VELOCITY_DEG_S * sinVal * sinVal;
}

/**
 * Analytical minimum-jerk head angular displacement:
 * θ(t) = ωpeak * [ t / 2 - (T / 4π) * sin(2π * t / T) ] for 0 <= t <= T
 */
export function computeVHITHeadPosition(tSec: number): number {
  if (tSec <= 0.0) return 0.0;
  if (tSec >= VHIT_CONSTANTS.DURATION_SEC) return VHIT_CONSTANTS.DISPLACEMENT_DEG;
  const T = VHIT_CONSTANTS.DURATION_SEC;
  const term1 = tSec / 2.0;
  const term2 = (T / (4.0 * Math.PI)) * Math.sin((2.0 * Math.PI * tSec) / T);
  return VHIT_CONSTANTS.PEAK_VELOCITY_DEG_S * (term1 - term2);
}

/**
 * Analytical angular acceleration:
 * α(t) = (π * ωpeak / T) * sin(2π * t / T)
 */
export function computeVHITHeadAcceleration(tSec: number): number {
  if (tSec < 0.0 || tSec > VHIT_CONSTANTS.DURATION_SEC) return 0.0;
  const T = VHIT_CONSTANTS.DURATION_SEC;
  const coeff = (Math.PI * VHIT_CONSTANTS.PEAK_VELOCITY_DEG_S) / T;
  return coeff * Math.sin((2.0 * Math.PI * tSec) / T);
}

/**
 * Closed-form unit SO(3) head quaternion for passive head thrust:
 * q(t) = [ sin(θ(t)/2) * u, cos(θ(t)/2) ]
 */
export function computeVHITHeadQuaternion(
  tSec: number,
  pair: VHITCanalPair = 'horizontal',
  direction: 1 | -1 = 1,
  out?: [number, number, number, number] | Float64Array | Float32Array
): [number, number, number, number] | Float64Array | Float32Array {
  const thetaDeg = direction * computeVHITHeadPosition(tSec);
  const thetaRad = (thetaDeg * Math.PI) / 180.0;
  const axis = CANAL_PAIR_AXES[pair];

  const sinHalf = Math.sin(thetaRad * 0.5);
  const cosHalf = Math.cos(thetaRad * 0.5);

  const qx = axis[0] * sinHalf;
  const qy = axis[1] * sinHalf;
  const qz = axis[2] * sinHalf;
  const qw = cosHalf;

  // Strict unit normalization
  const mag = Math.hypot(qx, qy, qz, qw);
  const invMag = mag > 1e-6 ? 1.0 / mag : 0.0;
  const rx = mag > 1e-6 ? qx * invMag : 0;
  const ry = mag > 1e-6 ? qy * invMag : 0;
  const rz = mag > 1e-6 ? qz * invMag : 0;
  const rw = mag > 1e-6 ? qw * invMag : 1;

  if (out) {
    out[0] = rx;
    out[1] = ry;
    out[2] = rz;
    out[3] = rw;
    return out;
  }
  return [rx, ry, rz, rw];
}

/**
 * Helper to compute saccadic velocity burst using smooth minimum-jerk bell profile
 */
export function computeSaccadeVelocity(
  tSec: number,
  tStartSec: number,
  durationSec: number,
  peakVelDegS: number
): number {
  if (tSec < tStartSec || tSec > tStartSec + durationSec) return 0.0;
  const relT = (tSec - tStartSec) / durationSec;
  const s = Math.sin(Math.PI * relT);
  return peakVelDegS * s * s;
}

/**
 * International Curthoys-MacDougall 40–80 ms area-based regression VOR gain:
 * G = Area(Inverted Eye Velocity, 40-80ms) / Area(Head Velocity, 40-80ms)
 */
export function computeCurthoysGain(
  headVelocities: Float32Array | number[],
  invertedEyeVelocities: Float32Array | number[],
  dtSec = 0.001
): number {
  const startIdx = Math.round(VHIT_CONSTANTS.CURTHOYS_WINDOW_START_SEC / dtSec);
  const endIdx = Math.round(VHIT_CONSTANTS.CURTHOYS_WINDOW_END_SEC / dtSec);

  let headArea = 0.0;
  let eyeArea = 0.0;

  const maxLen = Math.min(headVelocities.length, invertedEyeVelocities.length);
  const safeEnd = Math.min(endIdx, maxLen);

  for (let i = startIdx; i < safeEnd; i++) {
    headArea += headVelocities[i] * dtSec;
    eyeArea += invertedEyeVelocities[i] * dtSec;
  }

  if (Math.abs(headArea) < 1e-4) return 0.0;
  return eyeArea / headArea;
}

// =============================================================================
// 7. Pre-Allocated Zero-Allocation VHIT Impulse Buffer
// =============================================================================

export class VHITImpulseBuffer {
  public static readonly CAPACITY = 350; // 350 ms window at 1 ms resolution
  public static readonly DT_SEC = 0.001; // 1 ms sample step

  public readonly timeArray: Float32Array;
  public readonly headVelArray: Float32Array;
  public readonly invertedEyeVelArray: Float32Array;
  public readonly rawEyeVelArray: Float32Array;
  public readonly headPosArray: Float32Array;
  public readonly saccadeFlags: Uint8Array; // 0: None, 1: Covert, 2: Overt, 3: SHIMP

  public calculatedGain = 1.0;
  public covertSaccadePresent = false;
  public overtSaccadePresent = false;
  public shimpSaccadePresent = false;

  constructor() {
    this.timeArray = new Float32Array(VHITImpulseBuffer.CAPACITY);
    this.headVelArray = new Float32Array(VHITImpulseBuffer.CAPACITY);
    this.invertedEyeVelArray = new Float32Array(VHITImpulseBuffer.CAPACITY);
    this.rawEyeVelArray = new Float32Array(VHITImpulseBuffer.CAPACITY);
    this.headPosArray = new Float32Array(VHITImpulseBuffer.CAPACITY);
    this.saccadeFlags = new Uint8Array(VHITImpulseBuffer.CAPACITY);

    for (let i = 0; i < VHITImpulseBuffer.CAPACITY; i++) {
      this.timeArray[i] = i * VHITImpulseBuffer.DT_SEC;
    }
  }

  public getCapacity(): number {
    return VHITImpulseBuffer.CAPACITY;
  }

  /**
   * Simulates a 350 ms clinical head impulse trial in-place (ZERO heap allocations).
   */
  public simulateTrial(
    preset: VHITPathologyPreset = 'normal',
    paradigm: VHITParadigm = 'himp',
    goggleSlippage = false
  ): void {
    let targetGain = 1.0;
    let hasCovert = false;
    let hasOvert = false;

    if (preset === 'normal') {
      targetGain = 1.0;
      hasCovert = false;
      hasOvert = false;
    } else if (preset === 'acute_neuritis') {
      targetGain = 0.35;
      hasCovert = false;
      hasOvert = true;
    } else if (preset === 'chronic_schwannoma') {
      targetGain = 0.38;
      hasCovert = true;
      hasOvert = true;
    } else if (preset === 'bilateral_loss') {
      targetGain = 0.15;
      hasCovert = true;
      hasOvert = true;
    }

    this.covertSaccadePresent = hasCovert && paradigm === 'himp';
    this.overtSaccadePresent = hasOvert && paradigm === 'himp';
    this.shimpSaccadePresent = paradigm === 'shimp' && targetGain >= 0.70;

    for (let i = 0; i < VHITImpulseBuffer.CAPACITY; i++) {
      const t = this.timeArray[i];
      const headVel = computeVHITHeadVelocity(t);
      const headPos = computeVHITHeadPosition(t);

      this.headVelArray[i] = headVel;
      this.headPosArray[i] = headPos;
      this.saccadeFlags[i] = 0;

      // Base VOR eye response (inverted trace = G * headVel)
      let invEyeVel = targetGain * headVel;

      // Goggle slippage artifact: initial overshoot bump followed by undershoot
      if (goggleSlippage && t >= 0.015 && t <= 0.075) {
        const slipPhase = (t - 0.015) / 0.060;
        const slipArtifact = Math.sin(slipPhase * Math.PI * 2.0) * 45.0;
        invEyeVel += slipArtifact;
      }

      // Covert Saccade (during thrust: 75–95 ms)
      if (this.covertSaccadePresent) {
        const covertVel = computeSaccadeVelocity(t, 0.080, 0.028, 420.0);
        if (covertVel > 5.0) {
          invEyeVel += covertVel;
          this.saccadeFlags[i] = 1;
        }
      }

      // Overt Saccade (after thrust: 160–210 ms)
      if (this.overtSaccadePresent) {
        const overtVel = computeSaccadeVelocity(t, 0.175, 0.035, 320.0);
        if (overtVel > 5.0) {
          invEyeVel += overtVel;
          this.saccadeFlags[i] = 2;
        }
      }

      // SHIMP Anti-Compensatory Saccade (after thrust in normal subject: 160–210 ms)
      if (this.shimpSaccadePresent) {
        const shimpVel = computeSaccadeVelocity(t, 0.180, 0.035, 340.0);
        if (shimpVel > 5.0) {
          invEyeVel += shimpVel;
          this.saccadeFlags[i] = 3;
        }
      }

      this.invertedEyeVelArray[i] = Math.max(0.0, invEyeVel);
      this.rawEyeVelArray[i] = -this.invertedEyeVelArray[i];
    }

    // Curthoys 40–80 ms area gain
    this.calculatedGain = computeCurthoysGain(
      this.headVelArray,
      this.invertedEyeVelArray,
      VHITImpulseBuffer.DT_SEC
    );
  }
}
