import { PosteriorCanalPathData } from '../data/fcsvParser';

export interface EpleyStepPreset {
  stepIndex: number;
  stepId: string;
  sceneId: string;
  badge: string;
  shortTitle: string;
  clinicalTitle: string;
  targetYawDeg: number;
  targetReclineDeg: number;
  targetPhiDeg: number;
  phiCapMax: number;
  audioUrl: string;
  headline: string;
  caption: string;
}

export const EPLEY_CLINICAL_STEPS: EpleyStepPreset[] = [
  {
    stepIndex: 0,
    stepId: 'locate',
    sceneId: 'scene1_locate',
    badge: 'SHOT 1 · ANATOMY',
    shortTitle: '1. Locate Canal',
    clinicalTitle: 'Anatomical Location — Right Posterior Canal in Temporal Bone',
    targetYawDeg: 0.0,
    targetReclineDeg: 0.0,
    targetPhiDeg: -84.0,
    phiCapMax: -83.5,
    audioUrl: '/assets/audio/scene1_locate.wav',
    headline: 'Right Posterior-Canal BPPV: Displaced Otoconia',
    caption:
      'In posterior-canal BPPV, displaced otoconia enter the right posterior semicircular canal, which arches 45° posterolaterally behind the utricle.',
  },
  {
    stepIndex: 1,
    stepId: 'intro',
    sceneId: 'scene2_pathology',
    badge: 'SHOT 2 · PATHOLOGY',
    shortTitle: '2. Pathology',
    clinicalTitle: 'Pathology — Loose Otoconia Settled Near Posterior Ampulla',
    targetYawDeg: 0.0,
    targetReclineDeg: 0.0,
    targetPhiDeg: -84.0,
    phiCapMax: -83.5,
    audioUrl: '/assets/audio/scene2_pathology.wav',
    headline: 'Pathology: Loose Otoconia Near the Posterior Ampulla (φ = -84°)',
    caption:
      'Dense calcium carbonate otoconia settle at the gravity-dependent base of the posterior canal just distal to the posterior cupula.',
  },
  {
    stepIndex: 2,
    stepId: 'step1',
    sceneId: 'scene3_step1',
    badge: 'STEP 1 OF 5 · 45° RIGHT',
    shortTitle: '3. Step 1 (45° R)',
    clinicalTitle: 'Step 1 of 5 — Sit Upright & Rotate Head 45° Right',
    targetYawDeg: -45.0,
    targetReclineDeg: 0.0,
    targetPhiDeg: -84.0,
    phiCapMax: -83.5,
    audioUrl: '/assets/audio/scene3_step1.wav',
    headline: 'Step 1: Sit Upright & Turn Head 45° Right (ψ = -45°, θ = 0°)',
    caption:
      'Turning the head 45° toward the affected right ear aligns the right posterior semicircular canal with the sagittal plane of the examination table.',
  },
  {
    stepIndex: 3,
    stepId: 'step2',
    sceneId: 'scene4_step2',
    badge: 'STEP 2 OF 5 · SUPINE 30° EXT',
    shortTitle: '4. Step 2 (Recline)',
    clinicalTitle: 'Step 2 of 5 — Recline to Supine with 30° Neck Extension',
    targetYawDeg: -45.0,
    targetReclineDeg: 120.0,
    targetPhiDeg: 30.0,
    phiCapMax: 30.0,
    audioUrl: '/assets/audio/scene4_step2.wav',
    headline: 'Step 2: Supine + 30° Neck Extension (ψ = -45°, θ = 120° → φ = +30°)',
    caption:
      'Gravity pulls the otoconia ampullofugally away from the cupula around the posterior canal arch toward the apex. Hold 30–60 seconds.',
  },
  {
    stepIndex: 4,
    stepId: 'step3',
    sceneId: 'scene5_step3',
    badge: 'STEP 3 OF 5 · 90° LEFT TURN',
    shortTitle: '5. Step 3 (45° L)',
    clinicalTitle: 'Step 3 of 5 — Rotate Head 90° Left (Facing 45° Left)',
    targetYawDeg: 45.0,
    targetReclineDeg: 120.0,
    targetPhiDeg: 110.0,
    phiCapMax: 110.0,
    audioUrl: '/assets/audio/scene5_step3.wav',
    headline: 'Step 3: Rotate 90° Left While Extended (ψ = +45°, θ = 120° → φ = +110°)',
    caption:
      'Without raising the head, rotate 90° left. Gravity guides the otoconia across the superior arch into the Common Crus entry.',
  },
  {
    stepIndex: 5,
    stepId: 'step4',
    sceneId: 'scene6_step4',
    badge: 'STEP 4 OF 5 · SHOULDER ROLL',
    shortTitle: '6. Step 4 (Roll 135° L)',
    clinicalTitle: 'Step 4 of 5 — Roll Onto Left Shoulder, Nose 45° Down',
    targetYawDeg: 135.0,
    targetReclineDeg: 90.0,
    targetPhiDeg: 165.0,
    phiCapMax: 165.0,
    audioUrl: '/assets/audio/scene6_step4.wav',
    headline: 'Step 4: Left Shoulder Roll, Nose 45° Down (ψ = +135°, θ = 90° → φ = +165°)',
    caption:
      'The Common Crus now points steeply downward, allowing gravity to drain the otoconia through the shared limb to the utricular orifice.',
  },
  {
    stepIndex: 6,
    stepId: 'step5',
    sceneId: 'scene7_step5',
    badge: 'STEP 5 OF 5 · SIT UPRIGHT',
    shortTitle: '7. Step 5 (Sit Up)',
    clinicalTitle: 'Step 5 of 5 — Return Slowly to Upright Sitting',
    targetYawDeg: 0.0,
    targetReclineDeg: 0.0,
    targetPhiDeg: 186.0,
    phiCapMax: 186.0,
    audioUrl: '/assets/audio/scene7_step5.wav',
    headline: 'Step 5: Return to Upright Sitting (ψ = 0°, θ = 0° → φ = +186° Utricle)',
    caption:
      'Keeping the chin tucked, return the patient upright. Otoconia exit into the utricular vestibule where dark cells reabsorb them.',
  },
  {
    stepIndex: 7,
    stepId: 'outro',
    sceneId: 'scene8_summary',
    badge: 'SHOT 8 · CLINICAL SUMMARY',
    shortTitle: '8. Summary',
    clinicalTitle: 'Clinical Summary — Three Keys to Epley Execution',
    targetYawDeg: 0.0,
    targetReclineDeg: 0.0,
    targetPhiDeg: 186.0,
    phiCapMax: 186.0,
    audioUrl: '/assets/audio/scene8_summary.wav',
    headline: 'Clinical Summary: 30° Extension · No Head Lift in Step 3 · 30–60s Holds',
    caption:
      '1. Use a shoulder pillow for 20–30° neck extension; 2. Never lift the head during the Step 3 turn; 3. Hold each step 30–60s until particles settle.',
  },
];

export interface PhysicsTelemetryState {
  psiYawDeg: number;
  thetaReclineDeg: number;
  phiDeg: number;
  arcMm: number;
  velocityDegPerSec: number;
  gravityAlongCanal: number;
  cupulaDeflectionNormalized: number;
  afferentSpikesPerSec: number;
  nystagmusState: 'Baseline (None)' | 'Excitatory Upbeat-Torsional' | 'Inhibitory Reversal';
  anatomicalRegion: string;
  centerRAS: [number, number, number];
  tangentRAS: [number, number, number];
  tangentWorld: [number, number, number];
  particlesRAS: Array<[number, number, number]>;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge1 <= edge0) return x >= edge0 ? 1.0 : 0.0;
  const t = Math.max(0.0, Math.min(1.0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3.0 - 2.0 * t);
}

/**
 * Exact 3x3 head rotation matrix R_head = Rx(theta_recline) * Rz(psi_yaw)
 * matching `rotation_matrix_head` in `src/physics/epley_simulator.py`.
 */
export function computeHeadRotationMatrix(
  psiYawDeg: number,
  thetaReclineDeg: number
): number[][] {
  const psi = (psiYawDeg * Math.PI) / 180.0;
  const th = (thetaReclineDeg * Math.PI) / 180.0;

  const cPsi = Math.cos(psi);
  const sPsi = Math.sin(psi);
  const cTh = Math.cos(th);
  const sTh = Math.sin(th);

  // Rx(th) * Rz(psi)
  return [
    [cPsi, -sPsi, 0.0],
    [cTh * sPsi, cTh * cPsi, -sTh],
    [sTh * sPsi, sTh * cPsi, cTh],
  ];
}

function matVecMul(M: number[][], v: [number, number, number]): [number, number, number] {
  return [
    M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2],
    M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2],
    M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2],
  ];
}

function cross3(
  a: [number, number, number],
  b: [number, number, number]
): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normalize3(v: [number, number, number]): [number, number, number] {
  const len = Math.hypot(v[0], v[1], v[2]);
  if (len < 1e-8) return [1, 0, 0];
  return [v[0] / len, v[1] / len, v[2] / len];
}

export class RealtimeEpleySimulator {
  private pathData: PosteriorCanalPathData;
  private phiDeg = -84.0;
  private velocityDegPerSec = 0.0;
  private cupulaDeflection = 0.0;

  private readonly pPhiOffsets = [-7.0, -3.5, 0.0, 3.5, 7.0];
  private readonly pRadial = [0.0, 0.015, 0.0, 0.015, 0.0];
  private readonly pRadialAngle = [0.2, 1.4, 2.7, 4.1, 5.3];
  private readonly utricleRadExtra = [0.14, 0.22, 0.02, 0.22, 0.16];

  constructor(pathData: PosteriorCanalPathData) {
    this.pathData = pathData;
  }

  public setPhiDeg(phi: number): void {
    this.phiDeg = Math.max(-108.0, Math.min(192.0, phi));
    this.velocityDegPerSec = 0.0;
  }

  public getPhiDeg(): number {
    return this.phiDeg;
  }

  public static classifyRegion(phiDeg: number): string {
    if (phiDeg < -95.0) return 'Posterior Ampulla (Cupula Barrier)';
    if (phiDeg < -45.0) return 'Posterior Canal (Dependent Base)';
    if (phiDeg < 45.0) return 'Posterior Canal (Posterolateral Apex)';
    if (phiDeg < 112.0) return 'Posterior Canal (Superior Arch)';
    if (phiDeg < 172.0) return 'Common Crus (Shared Drainage Limb)';
    return 'Utricular Vestibule (Cleared!)';
  }

  public interpolateAtPhi(phi: number): {
    arc: number;
    pos: [number, number, number];
    tan: [number, number, number];
    nrm: [number, number, number];
    binorm: [number, number, number];
  } {
    const samples = this.pathData.samples;
    const clamped = Math.max(
      samples[0].phi_deg,
      Math.min(samples[samples.length - 1].phi_deg, phi)
    );

    let i0 = 0;
    for (let i = 0; i < samples.length - 1; i++) {
      if (clamped >= samples[i].phi_deg && clamped <= samples[i + 1].phi_deg) {
        i0 = i;
        break;
      }
    }
    const i1 = Math.min(samples.length - 1, i0 + 1);
    const s0 = samples[i0];
    const s1 = samples[i1];
    const span = Math.max(1e-6, s1.phi_deg - s0.phi_deg);
    const t = Math.max(0.0, Math.min(1.0, (clamped - s0.phi_deg) / span));

    const lerp3 = (
      a: [number, number, number],
      b: [number, number, number]
    ): [number, number, number] => [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    ];

    const arc = s0.arc_length_mm + (s1.arc_length_mm - s0.arc_length_mm) * t;
    const pos = lerp3(s0.position_ras, s1.position_ras);
    const tan = normalize3(lerp3(s0.tangent_ras, s1.tangent_ras));
    const rawNrm = lerp3(s0.normal_ras, s1.normal_ras);
    const dotTN = rawNrm[0] * tan[0] + rawNrm[1] * tan[1] + rawNrm[2] * tan[2];
    const nrm = normalize3([
      rawNrm[0] - dotTN * tan[0],
      rawNrm[1] - dotTN * tan[1],
      rawNrm[2] - dotTN * tan[2],
    ]);
    const binorm = normalize3(cross3(tan, nrm));

    return { arc, pos, tan, nrm, binorm };
  }

  public computeParticlesRAS(centerPhiDeg: number): Array<[number, number, number]> {
    const utricleFan = smoothstep(168.0, 185.0, centerPhiDeg);
    const spreadScale = 1.0 + 0.2 * utricleFan;
    const pts: Array<[number, number, number]> = [];

    for (let i = 0; i < 5; i++) {
      const phiI = Math.max(
        -96.0,
        Math.min(198.5, centerPhiDeg + this.pPhiOffsets[i] * spreadScale)
      );
      const { pos, nrm, binorm } = this.interpolateAtPhi(phiI);
      const r = this.pRadial[i] + this.utricleRadExtra[i] * utricleFan;
      const ang = this.pRadialAngle[i];
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      pts.push([
        pos[0] + r * (c * nrm[0] + s * binorm[0]),
        pos[1] + r * (c * nrm[1] + s * binorm[1]),
        pos[2] + r * (c * nrm[2] + s * binorm[2]),
      ]);
    }
    return pts;
  }

  /**
   * Advance the overdamped Stokes sedimentation ODE by `dt` seconds.
   */
  public stepPhysics(
    dt: number,
    psiYawDeg: number,
    thetaReclineDeg: number,
    options?: {
      allowBackwardSlide?: boolean;
      phiCapMax?: number;
      mobility?: number;
      isStep3Assist?: boolean;
    }
  ): PhysicsTelemetryState {
    const clampedDt = Math.min(0.05, Math.max(0.0, dt));
    const R = computeHeadRotationMatrix(psiYawDeg, thetaReclineDeg);
    const { arc, pos, tan } = this.interpolateAtPhi(this.phiDeg);
    const tanWorld = matVecMul(R, tan);

    // Downward world gravity g_world = (0, 0, -1) dotted with canal tangent T_world
    // -> g_proj = -tanWorld[2]
    const gProj = -tanWorld[2];

    let effectiveDrive = gProj;
    if (options?.isStep3Assist && this.phiDeg >= 96.0 && this.phiDeg <= 112.0) {
      effectiveDrive = Math.max(gProj, 0.18 * (1.0 - (this.phiDeg - 96.0) / 16.0));
    }

    const mobility = options?.mobility ?? 48.0;
    const allowBack = options?.allowBackwardSlide ?? true;
    const phiCapMax = options?.phiCapMax ?? 188.0;

    let dphiDt = 0.0;
    if (allowBack) {
      // Deadzone of |gProj| < 0.04 for static viscous stiction on canal floor
      if (Math.abs(effectiveDrive) > 0.04) {
        dphiDt = mobility * effectiveDrive;
      }
    } else {
      dphiDt = mobility * Math.max(0.0, effectiveDrive);
    }

    // Once particles enter the utricular vestibule (phi >= 182°), they drop onto the utricular floor and do not reflux back up the common crus
    if (this.phiDeg >= 182.0 && dphiDt < 0.0) {
      dphiDt = 0.0;
    }
    // Cupula barrier at phi = -94° prevents movement through the sealed posterior ampulla
    if (this.phiDeg <= -94.0 && dphiDt < 0.0) {
      dphiDt = 0.0;
    }
    if (this.phiDeg >= phiCapMax && dphiDt > 0.0) {
      dphiDt = 0.0;
    }

    this.phiDeg = Math.max(-94.0, Math.min(phiCapMax, this.phiDeg + dphiDt * clampedDt));
    this.velocityDegPerSec = dphiDt;

    // Steinhausen Cupula Plunger coupling:
    // Canalith motion inside the narrow membranous duct (phi < 112°) pulls endolymph, deflecting the elastic cupula
    const inNarrowDuct = this.phiDeg < 115.0 ? 1.0 : 0.15;
    const targetCupula = Math.max(-1.0, Math.min(1.0, (dphiDt / 28.0) * inNarrowDuct));
    const tauReturn = 1.8;
    this.cupulaDeflection +=
      (targetCupula - this.cupulaDeflection) * Math.min(1.0, clampedDt * (1.0 / tauReturn + 2.2));

    // Ewald's 3rd Law (Posterior Canal): Ampullofugal deflection (+cupula) excites CN VIII Inferior Ampullary Nerve
    const baselineSpikes = 90;
    const afferentSpikesPerSec = Math.round(
      Math.max(10, Math.min(310, baselineSpikes + this.cupulaDeflection * 175))
    );

    let nystagmusState: PhysicsTelemetryState['nystagmusState'] = 'Baseline (None)';
    if (this.cupulaDeflection > 0.12) {
      nystagmusState = 'Excitatory Upbeat-Torsional';
    } else if (this.cupulaDeflection < -0.12) {
      nystagmusState = 'Inhibitory Reversal';
    }

    const updatedSample = this.interpolateAtPhi(this.phiDeg);
    const updatedTanWorld = matVecMul(R, updatedSample.tan);
    const particlesRAS = this.computeParticlesRAS(this.phiDeg);

    return {
      psiYawDeg,
      thetaReclineDeg,
      phiDeg: this.phiDeg,
      arcMm: updatedSample.arc,
      velocityDegPerSec: this.velocityDegPerSec,
      gravityAlongCanal: -updatedTanWorld[2],
      cupulaDeflectionNormalized: this.cupulaDeflection,
      afferentSpikesPerSec,
      nystagmusState,
      anatomicalRegion: RealtimeEpleySimulator.classifyRegion(this.phiDeg),
      centerRAS: updatedSample.pos,
      tangentRAS: updatedSample.tan,
      tangentWorld: updatedTanWorld,
      particlesRAS,
    };
  }
}
