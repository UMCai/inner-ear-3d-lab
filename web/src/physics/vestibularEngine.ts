/**
 * web/src/physics/vestibularEngine.ts
 *
 * Multi-Canal Vestibular Dynamics & Clinical Maneuver Engine.
 * Stage 3 — Step 2: Gate 3 Medaium Architecture.
 *
 * Provides analytical 3-DOF head kinematics (Yaw, Pitch, Roll),
 * continuous 3D Stokes sedimentation along authentic IE-Map RAS splines,
 * Steinhausen cupular plunger fluid coupling with two-phase elastic decay,
 * and Ewald's 2nd & 3rd laws neurophysiology with 3D directional nystagmus
 * across all 6 clinical maneuvers (Epley, Semont, Gufoni Geotropic/Apogeotropic,
 * Lempert Barbecue Roll, and Yacovino).
 */

import type { CanalId, CanalPathData } from '../data/canalPaths';
import type { PosteriorCanalPathData } from '../data/fcsvParser';

export type { CanalId };

export type ManeuverId =
  | 'epley'
  | 'semont'
  | 'gufoni_geotropic'
  | 'gufoni_apogeotropic'
  | 'barbecue_roll'
  | 'yacovino';

export interface CanalBoundaryConfig {
  canalId: CanalId;
  name: string;
  phiMin: number;
  phiRest: number;
  phiApex: number;
  crusEntry: number;
  utricleOrifice: number;
  phiMax: number;
  utricleFanStart: number;
  cupulaNormalExcitatorySign: 1 | -1;
}

export const CANAL_BOUNDARIES: Record<CanalId, CanalBoundaryConfig> = {
  posterior: {
    canalId: 'posterior',
    name: 'Posterior Semicircular Canal',
    phiMin: -112.0,
    phiRest: -84.0,
    phiApex: 0.0,
    crusEntry: 112.0,
    utricleOrifice: 172.0,
    phiMax: 186.0,
    utricleFanStart: 168.0,
    cupulaNormalExcitatorySign: 1, // Ampullofugal (+dphi/dt) is excitatory
  },
  horizontal: {
    canalId: 'horizontal',
    name: 'Horizontal (Lateral) Semicircular Canal',
    phiMin: -90.0,
    phiRest: 0.0,
    phiApex: 0.0,
    crusEntry: 95.0,
    utricleOrifice: 150.0,
    phiMax: 180.0,
    utricleFanStart: 150.0,
    cupulaNormalExcitatorySign: -1, // Ampullopetal (-dphi/dt) is excitatory
  },
  anterior: {
    canalId: 'anterior',
    name: 'Anterior (Superior) Semicircular Canal',
    phiMin: -90.0,
    phiRest: -60.0,
    phiApex: 0.0,
    crusEntry: 95.0,
    utricleOrifice: 150.0,
    phiMax: 180.0,
    utricleFanStart: 150.0,
    cupulaNormalExcitatorySign: 1, // Ampullofugal (+dphi/dt) is excitatory
  },
};

export interface VestibularStepPreset {
  stepIndex: number;
  stepId: string;
  sceneId?: string;
  badge: string;
  shortTitle: string;
  clinicalTitle: string;
  targetYawDeg: number;
  targetPitchDeg: number;
  targetRollDeg: number;
  targetReclineDeg?: number;
  targetPhiDeg: number;
  phiCapMax: number;
  durationSec: number;
  audioUrl?: string;
  headline: string;
  caption: string;
  patientHeadline: string;
  patientCaption: string;
  clinicalPearl: string;
}

export interface VestibularTelemetryState {
  canalId: CanalId;
  maneuverId: ManeuverId;
  stepIndex: number;
  psiYawDeg: number;
  thetaPitchDeg: number;
  thetaReclineDeg: number;
  gammaRollDeg: number;
  phiDeg: number;
  arcMm: number;
  velocityDegPerSec: number;
  gravityAlongCanal: number;
  cupulaDeflectionNormalized: number;
  afferentSpikesPerSec: number;
  nystagmusState: string;
  slowPhaseVelocityDegPerSec: { horizontal: number; vertical: number; torsional: number };
  fastPhaseBeatDirection: string;
  ewaldLawActive: string;
  anatomicalRegion: string;
  clearancePercent: number;
  patientSensation:
    | 'Calm (No Spinning)'
    | 'Spinning (Crystals Moving)'
    | 'Spinning (Crystals Sliding Back)';
  patientLocation: string;
  centerRAS: [number, number, number];
  tangentRAS: [number, number, number];
  tangentWorld: [number, number, number];
  particlesRAS: Array<[number, number, number]>;
}

export interface PhysicsTelemetryState {
  psiYawDeg: number;
  thetaReclineDeg: number;
  phiDeg: number;
  arcMm: number;
  velocityDegPerSec: number;
  gravityAlongCanal: number;
  cupulaDeflectionNormalized: number;
  afferentSpikesPerSec: number;
  nystagmusState: string;
  anatomicalRegion: string;
  clearancePercent: number;
  patientSensation:
    | 'Calm (No Spinning)'
    | 'Spinning (Crystals Moving)'
    | 'Spinning (Crystals Sliding Back)';
  patientLocation: string;
  centerRAS: [number, number, number];
  tangentRAS: [number, number, number];
  tangentWorld: [number, number, number];
  particlesRAS: Array<[number, number, number]>;
}

export interface StepPhysicsOptions {
  allowBackwardSlide?: boolean;
  phiCapMax?: number;
  mobility?: number;
  isStep3Assist?: boolean;
}

export type EpleyStepPreset = VestibularStepPreset;

export const MANEUVER_TARGET_CANAL: Record<ManeuverId, CanalId> = {
  epley: 'posterior',
  semont: 'posterior',
  gufoni_geotropic: 'horizontal',
  gufoni_apogeotropic: 'horizontal',
  barbecue_roll: 'horizontal',
  yacovino: 'anterior',
};

export const CANAL_DEFAULT_MANEUVER: Record<CanalId, ManeuverId> = {
  posterior: 'epley',
  horizontal: 'gufoni_geotropic',
  anterior: 'yacovino',
};

export const EPLEY_STEPS: VestibularStepPreset[] = [
  {
    stepIndex: 0,
    stepId: 'epley_step1',
    sceneId: 'scene3_step1',
    badge: 'STEP 1 OF 5 · TURN 45° RIGHT',
    shortTitle: '1. Turn Right',
    clinicalTitle: 'Step 1 of 5 — Sit Upright & Turn Head 45° Right',
    targetYawDeg: -45.0,
    targetPitchDeg: 0.0,
    targetRollDeg: 0.0,
    targetReclineDeg: 0.0,
    targetPhiDeg: -84.0,
    phiCapMax: -83.5,
    durationSec: 30,
    audioUrl: '/assets/audio/scene3_step1.wav',
    headline: 'Step 1: Sit Upright & Turn Head 45° Right (ψ = -45°, θ = 0°, γ = 0°)',
    caption:
      'Turning the head 45° toward the affected right ear aligns the right posterior semicircular canal with the sagittal plane of the examination table.',
    patientHeadline: '1. Turn Right: Sit Upright & Turn Your Head 45° to the Right',
    patientCaption:
      'Turning your head 45° toward the affected right ear lines up the back balance loop so the crystals will roll cleanly around the loop.',
    clinicalPearl:
      'Aligns right posterior semicircular canal parallel to sagittal plane of examination table.',
  },
  {
    stepIndex: 1,
    stepId: 'epley_step2',
    sceneId: 'scene4_step2',
    badge: 'STEP 2 OF 5 · DIX-HALLPIKE RECLINE',
    shortTitle: '2. Lie Back',
    clinicalTitle: 'Step 2 of 5 — Recline to Supine with 30° Neck Extension',
    targetYawDeg: -45.0,
    targetPitchDeg: 120.0,
    targetRollDeg: 0.0,
    targetReclineDeg: 120.0,
    targetPhiDeg: 30.0,
    phiCapMax: 30.0,
    durationSec: 45,
    audioUrl: '/assets/audio/scene4_step2.wav',
    headline: 'Step 2: Supine + 30° Neck Extension (ψ = -45°, θ = 120°, γ = 0° → φ = +30°)',
    caption:
      'Gravity pulls the otoconia ampullofugally away from the cupula around the posterior canal arch toward the apex. Hold 30–60 seconds.',
    patientHeadline: '2. Lie Back: Lie Back with Head Tilted Slightly Back (Hold 30–60s)',
    patientCaption:
      'Lying back with your head tilted slightly over a pillow lets gravity pull the loose crystals away from the sensor and halfway around the balance loop. Wait 30–60 seconds until the spinning feeling stops.',
    clinicalPearl:
      'Paroxysmal crescendo upbeating and right-torsional nystagmus (g_proj > 0). Hold until vertigo ceases.',
  },
  {
    stepIndex: 2,
    stepId: 'epley_step3',
    sceneId: 'scene5_step3',
    badge: 'STEP 3 OF 5 · TURN 90° LEFT',
    shortTitle: '3. Turn Left',
    clinicalTitle: 'Step 3 of 5 — Rotate Head 90° Left While Extended',
    targetYawDeg: 45.0,
    targetPitchDeg: 120.0,
    targetRollDeg: 0.0,
    targetReclineDeg: 120.0,
    targetPhiDeg: 110.0,
    phiCapMax: 110.0,
    durationSec: 45,
    audioUrl: '/assets/audio/scene5_step3.wav',
    headline: 'Step 3: Rotate 90° Left While Extended (ψ = +45°, θ = 120°, γ = 0° → φ = +110°)',
    caption:
      'Without raising the head, rotate 90° left. Gravity guides the otoconia across the superior arch into the Common Crus entry.',
    patientHeadline: '3. Turn Left: Turn Your Head 90° to the Left Without Lifting It',
    patientCaption:
      'Keeping your head tilted back on the bed, turn 90° to the left. Gravity guides the crystals over the top arch of the loop into the shared exit tube (Common Crus). Hold 30–60 seconds.',
    clinicalPearl:
      'Crucial step — do NOT lift the head; maintain 30° neck extension so particles pass over the superior arch without falling back into the ampulla.',
  },
  {
    stepIndex: 3,
    stepId: 'epley_step4',
    sceneId: 'scene6_step4',
    badge: 'STEP 4 OF 5 · ROLL ON LEFT SHOULDER',
    shortTitle: '4. Roll on Side',
    clinicalTitle: 'Step 4 of 5 — Roll Onto Left Shoulder, Nose 45° Down',
    targetYawDeg: 135.0,
    targetPitchDeg: 90.0,
    targetRollDeg: 0.0,
    targetReclineDeg: 90.0,
    targetPhiDeg: 165.0,
    phiCapMax: 165.0,
    durationSec: 45,
    audioUrl: '/assets/audio/scene6_step4.wav',
    headline: 'Step 4: Left Shoulder Roll, Nose 45° Down (ψ = +135°, θ = 90°, γ = 0° → φ = +165°)',
    caption:
      'The Common Crus now points steeply downward, allowing gravity to drain the otoconia through the shared limb to the utricular orifice.',
    patientHeadline: '4. Roll on Side: Roll Onto Your Left Side (Looking Slightly Downward)',
    patientCaption:
      'Roll your body onto your left shoulder so your nose points 45° toward the floor. This points the shared exit tube straight down so the crystals slide to the doorway of the resting sac.',
    clinicalPearl:
      'Common crus points steeply downward; otoconia slide into utricular doorway.',
  },
  {
    stepIndex: 4,
    stepId: 'epley_step5',
    sceneId: 'scene7_step5',
    badge: 'STEP 5 OF 5 · SIT UP',
    shortTitle: '5. Sit Up',
    clinicalTitle: 'Step 5 of 5 — Return Slowly to Upright Sitting',
    targetYawDeg: 0.0,
    targetPitchDeg: 0.0,
    targetRollDeg: 0.0,
    targetReclineDeg: 0.0,
    targetPhiDeg: 186.0,
    phiCapMax: 186.0,
    durationSec: 30,
    audioUrl: '/assets/audio/scene7_step5.wav',
    headline: 'Step 5: Return to Upright Sitting (ψ = 0°, θ = 0°, γ = 0° → φ = +186° Utricle)',
    caption:
      'Keeping the chin tucked, return the patient upright. Otoconia exit into the utricular vestibule where dark cells reabsorb them.',
    patientHeadline: '5. Sit Up: Sit Back Up Slowly — Crystals Return to the Resting Sac!',
    patientCaption:
      'Keeping your chin slightly tucked, sit upright. The crystals drop harmlessly back into the main resting sac (utricle), where they no longer trigger spinning dizziness.',
    clinicalPearl: 'Clearance 100%, vertigo resolved.',
  },
];

export const SEMONT_STEPS: VestibularStepPreset[] = [
  {
    stepIndex: 0,
    stepId: 'semont_step1',
    badge: 'STEP 1 OF 3 · SIT UP & TURN 45° LEFT',
    shortTitle: '1. Sit & Turn Left',
    clinicalTitle: 'Step 1 of 3 — Sit Upright, Head Turned 45° Left (Healthy Side)',
    targetYawDeg: 45.0,
    targetPitchDeg: 0.0,
    targetRollDeg: 0.0,
    targetReclineDeg: 0.0,
    targetPhiDeg: -84.0,
    phiCapMax: -83.5,
    durationSec: 30,
    headline: 'Step 1: Sit Upright, Head Turned 45° Left (ψ = +45°, θ = 0°, γ = 0°)',
    caption:
      'Turning head 45° left aligns the affected right posterior canal with the frontal plane of lateral side-lying motion.',
    patientHeadline: '1. Sit & Turn Left: Sit on the Table and Turn Head 45° Left',
    patientCaption:
      'Sitting upright with your head turned toward your good ear prepares the balance loop for the quick sideways drop.',
    clinicalPearl:
      'Turning head 45° left places the right posterior canal in the frontal plane of lateral movement.',
  },
  {
    stepIndex: 1,
    stepId: 'semont_step2',
    badge: 'STEP 2 OF 3 · DROP ON RIGHT SIDE',
    shortTitle: '2. Drop Right',
    clinicalTitle: 'Step 2 of 3 — Rapid Decubitus Onto Affected Right Side (Nose 45° Up)',
    targetYawDeg: 45.0,
    targetPitchDeg: 0.0,
    targetRollDeg: 90.0,
    targetReclineDeg: 0.0,
    targetPhiDeg: 30.0,
    phiCapMax: 30.0,
    durationSec: 60,
    headline: 'Step 2: Rapid Decubitus Onto Affected Right Side (ψ = +45°, θ = 0°, γ = +90°)',
    caption:
      'Dropping briskly onto the right shoulder puts the right ear down. Gravity pulls otoconia along the posterior duct toward the apex (φ = +30°).',
    patientHeadline: '2. Drop Right: Lie Quickly onto Your Right Shoulder (Face Tilted Up)',
    patientCaption:
      'Drop down onto your right side while keeping your head turned. Crystals slide toward the top of the loop. Hold 60 seconds.',
    clinicalPearl:
      'Gravity g_proj = +0.699 strongly accelerates otoconia toward apex. Intense upbeating-torsional nystagmus; wait until vertigo ceases.',
  },
  {
    stepIndex: 2,
    stepId: 'semont_step3',
    badge: 'STEP 3 OF 3 · 180° SWING TO LEFT',
    shortTitle: '3. Swing Left & Sit Up',
    clinicalTitle: 'Step 3 of 3 — Rapid 180° Pendular Swing Onto Left Side & Return Upright',
    targetYawDeg: 45.0,
    targetPitchDeg: 0.0,
    targetRollDeg: -90.0,
    targetReclineDeg: 0.0,
    targetPhiDeg: 186.0,
    phiCapMax: 186.0,
    durationSec: 60,
    headline: 'Step 3: Rapid 180° Pendular Swing to Left Side (ψ = +45°, θ = 0°, γ = -90° → Upright)',
    caption:
      'A brisk swing from right to left (<1.5s) carries otoconia over the apex into the common crus and drains into the utricle.',
    patientHeadline: '3. Swing Left: Swing Across to Your Left Shoulder Without Changing Head Turn',
    patientCaption:
      'Quickly swing all the way over to your left shoulder so your nose faces the bed. The crystals drop into the common tube and drain into the resting sac.',
    clinicalPearl:
      'Brisk swing (<1.5s) utilizes deceleration inertia + gravity to carry particles over the superior arch into the common crus (g_proj = +0.821), and sitting upright dumps them into the utricle (g_proj = +0.676).',
  },
];

export const GUFONI_GEOTROPIC_STEPS: VestibularStepPreset[] = [
  {
    stepIndex: 0,
    stepId: 'gufoni_geo_step1',
    badge: 'STEP 1 OF 4 · SIT NEUTRAL',
    shortTitle: '1. Sit Upright',
    clinicalTitle: 'Step 1 of 4 — Sit Upright Facing Forward',
    targetYawDeg: 0.0,
    targetPitchDeg: 0.0,
    targetRollDeg: 0.0,
    targetReclineDeg: 0.0,
    targetPhiDeg: 0.0,
    phiCapMax: 0.0,
    durationSec: 30,
    headline: 'Step 1: Sit Upright Facing Forward (ψ = 0°, θ = 0°, γ = 0°)',
    caption:
      'Patient sits upright with legs hanging over the table edge in neutral sagittal alignment.',
    patientHeadline: '1. Sit Upright: Sit Straight Facing Forward',
    patientCaption: 'Sit upright on the side of the examination table.',
    clinicalPearl: 'Neutral head position confirms resting horizontal canal baseline.',
  },
  {
    stepIndex: 1,
    stepId: 'gufoni_geo_step2',
    badge: 'STEP 2 OF 4 · LIE ON HEALTHY SIDE',
    shortTitle: '2. Lie Left',
    clinicalTitle: 'Step 2 of 4 — Brisk Side-Lying Onto Healthy Left Side',
    targetYawDeg: 0.0,
    targetPitchDeg: 0.0,
    targetRollDeg: -90.0,
    targetReclineDeg: 0.0,
    targetPhiDeg: 95.0,
    phiCapMax: 95.0,
    durationSec: 90,
    headline: 'Step 2: Brisk Side-Lying Onto Healthy Left Side (ψ = 0°, θ = 0°, γ = -90°)',
    caption:
      'Dropping onto the healthy left side aligns the right horizontal canal vertically with the ampulla superiorly, draining otoconia toward the simple crus.',
    patientHeadline: '2. Lie Left: Lie Down Quickly on Your Left Side',
    patientCaption:
      'Quickly lie down on your healthy left side. Gravity pulls crystals around the horizontal balance loop toward the exit.',
    clinicalPearl:
      'With healthy left ear down, right horizontal canal is vertically oriented with ampulla at top (g_proj = +0.912 to +0.937).',
  },
  {
    stepIndex: 2,
    stepId: 'gufoni_geo_step3',
    badge: 'STEP 3 OF 4 · NOSE 45° DOWN',
    shortTitle: '3. Turn Nose Down',
    clinicalTitle: 'Step 3 of 4 — Rotate Head 45° Downward Toward Table',
    targetYawDeg: 45.0,
    targetPitchDeg: 0.0,
    targetRollDeg: -90.0,
    targetReclineDeg: 0.0,
    targetPhiDeg: 150.0,
    phiCapMax: 180.0,
    durationSec: 90,
    headline: 'Step 3: Head Turn 45° Downward Toward Table (ψ = +45°, θ = 0°, γ = -90°)',
    caption:
      'Rotating head 45° downward aims the simple crus vertically downward, guiding otoconia directly into the utricular orifice.',
    patientHeadline: '3. Turn Nose Down: Turn Your Head 45° Toward the Bed',
    patientCaption:
      'Turn your nose 45° down toward the examination table to dump the crystals into the resting chamber.',
    clinicalPearl: 'Pitching the nose 45° down aims simple crus vertically downward into utricle (g_proj > 0).',
  },
  {
    stepIndex: 3,
    stepId: 'gufoni_geo_step4',
    badge: 'STEP 4 OF 4 · RETURN UPRIGHT',
    shortTitle: '4. Sit Up',
    clinicalTitle: 'Step 4 of 4 — Return to Upright Sitting',
    targetYawDeg: 0.0,
    targetPitchDeg: 0.0,
    targetRollDeg: 0.0,
    targetReclineDeg: 0.0,
    targetPhiDeg: 180.0,
    phiCapMax: 180.0,
    durationSec: 30,
    headline: 'Step 4: Return to Upright Sitting (ψ = 0°, θ = 0°, γ = 0° → φ = +180° Utricle)',
    caption: 'Patient returns to seated position; otoconia remain trapped inside the utricle.',
    patientHeadline: '4. Sit Up: Sit Back Up Slowly',
    patientCaption:
      'Sit back upright. The crystals are safely inside the utricle and horizontal vertigo is resolved.',
    clinicalPearl: 'Clearance 100%, simple crus drainage complete.',
  },
];

export const GUFONI_APOGEOTROPIC_STEPS: VestibularStepPreset[] = [
  {
    stepIndex: 0,
    stepId: 'gufoni_apo_step1',
    badge: 'STEP 1 OF 4 · SIT NEUTRAL',
    shortTitle: '1. Sit Upright',
    clinicalTitle: 'Step 1 of 4 — Sit Upright Facing Forward',
    targetYawDeg: 0.0,
    targetPitchDeg: 0.0,
    targetRollDeg: 0.0,
    targetReclineDeg: 0.0,
    targetPhiDeg: -85.0,
    phiCapMax: -85.0,
    durationSec: 30,
    headline: 'Step 1: Sit Upright Facing Forward (ψ = 0°, θ = 0°, γ = 0°)',
    caption:
      'Patient seated in neutral position; otoconia adhered to or near cupular crest in right horizontal ampulla.',
    patientHeadline: '1. Sit Upright: Sit Facing Forward',
    patientCaption: 'Sit upright on the side of the table.',
    clinicalPearl: 'Identifies apogeotropic cupulolithiasis at right horizontal cupular barrier.',
  },
  {
    stepIndex: 1,
    stepId: 'gufoni_apo_step2',
    badge: 'STEP 2 OF 4 · LIE ON AFFECTED SIDE',
    shortTitle: '2. Lie Right',
    clinicalTitle: 'Step 2 of 4 — Brisk Side-Lying Onto Affected Right Side',
    targetYawDeg: 0.0,
    targetPitchDeg: 0.0,
    targetRollDeg: 90.0,
    targetReclineDeg: 0.0,
    targetPhiDeg: 0.0,
    phiCapMax: 0.0,
    durationSec: 90,
    headline: 'Step 2: Brisk Side-Lying Onto Affected Right Side (ψ = 0°, θ = 0°, γ = +90°)',
    caption:
      'Brisk impact on affected right side creates inertial shear force and gravity pull (g_proj > +0.90) dislodging otoconia from cupula into anterior duct.',
    patientHeadline: '2. Lie Right: Lie Down Quickly on Your Affected Right Side',
    patientCaption: 'Lie down quickly onto your right side. This frees stuck crystals from the balance sensor.',
    clinicalPearl:
      'Lateral impact on affected side dislodges adhered otoconia from cupula into anterior duct lumen (g_proj = +0.913 to +0.923).',
  },
  {
    stepIndex: 2,
    stepId: 'gufoni_apo_step3',
    badge: 'STEP 3 OF 4 · NOSE 45° UP',
    shortTitle: '3. Turn Nose Up',
    clinicalTitle: 'Step 3 of 4 — Rotate Head 45° Upward Toward Ceiling',
    targetYawDeg: -45.0,
    targetPitchDeg: 0.0,
    targetRollDeg: 90.0,
    targetReclineDeg: 0.0,
    targetPhiDeg: 95.0,
    phiCapMax: 95.0,
    durationSec: 90,
    headline: 'Step 3: Head Turn 45° Upward Toward Ceiling (ψ = -45°, θ = 0°, γ = +90°)',
    caption:
      'Turning nose 45° up moves freed otoconia away from ampulla into the posterior limb, converting apogeotropic into geotropic canalithiasis.',
    patientHeadline: '3. Turn Nose Up: Turn Your Head 45° Toward the Ceiling',
    patientCaption: 'Turn your nose 45° upward. Crystals slide toward the back half of the loop.',
    clinicalPearl:
      'Upward rotation moves freed otoconia into posterior limb, converting apogeotropic to geotropic BPPV.',
  },
  {
    stepIndex: 3,
    stepId: 'gufoni_apo_step4',
    badge: 'STEP 4 OF 4 · RETURN UPRIGHT',
    shortTitle: '4. Sit Up',
    clinicalTitle: 'Step 4 of 4 — Return to Upright Sitting',
    targetYawDeg: 0.0,
    targetPitchDeg: 0.0,
    targetRollDeg: 0.0,
    targetReclineDeg: 0.0,
    targetPhiDeg: 180.0,
    phiCapMax: 180.0,
    durationSec: 30,
    headline: 'Step 4: Return to Upright Sitting (ψ = 0°, θ = 0°, γ = 0° → φ = +180°)',
    caption: 'Return upright. The conversion or clearance is completed.',
    patientHeadline: '4. Sit Up: Sit Back Up Slowly',
    patientCaption: 'Sit back up. Crystals have been cleared or converted for final drainage.',
    clinicalPearl: 'Complete repositioning or conversion to simple crus drainage.',
  },
];

export const LEMPERT_ROLL_STEPS: VestibularStepPreset[] = [
  {
    stepIndex: 0,
    stepId: 'lempert_step1',
    badge: 'STEP 1 OF 5 · SUPINE HEAD RIGHT',
    shortTitle: '1. Face Right',
    clinicalTitle: 'Step 1 of 5 — Supine, Head Turned 90° Toward Affected Right Ear',
    targetYawDeg: -90.0,
    targetPitchDeg: 90.0,
    targetRollDeg: 0.0,
    targetReclineDeg: 90.0,
    targetPhiDeg: 0.0,
    phiCapMax: 0.0,
    durationSec: 45,
    headline: 'Step 1: Supine, Head Turned 90° Right (ψ = -90°, θ = 90°, γ = 0°)',
    caption:
      'Patient is supine with head turned 90° toward affected right ear; otoconia pool in the lateral arch (φ = 0°).',
    patientHeadline: '1. Face Right: Lie on Your Back with Head Turned Fully Right',
    patientCaption: 'Lie on your back with your head turned to the right. Crystals pool in the side curve of the loop.',
    clinicalPearl: 'Supine right advance (g_proj = +0.913 to +0.217).',
  },
  {
    stepIndex: 1,
    stepId: 'lempert_step2',
    badge: 'STEP 2 OF 5 · SUPINE FACE UP',
    shortTitle: '2. Face Up',
    clinicalTitle: 'Step 2 of 5 — Supine, Head Turned Face Up (0° Neutral)',
    targetYawDeg: 0.0,
    targetPitchDeg: 90.0,
    targetRollDeg: 0.0,
    targetReclineDeg: 90.0,
    targetPhiDeg: 45.0,
    phiCapMax: 45.0,
    durationSec: 45,
    headline: 'Step 2: Supine Face Up Neutral (ψ = 0°, θ = 90°, γ = 0° → φ = +45°)',
    caption: 'Turn head face up to 0° neutral. Otoconia migrate around the posterior limb.',
    patientHeadline: '2. Face Up: Roll Head Face Up Looking at the Ceiling',
    patientCaption: 'Turn your head straight up to the ceiling. Crystals roll along the back curve.',
    clinicalPearl: 'Supine face up advance (g_proj = +0.938 to +0.921).',
  },
  {
    stepIndex: 2,
    stepId: 'lempert_step3',
    badge: 'STEP 3 OF 5 · SUPINE HEAD LEFT',
    shortTitle: '3. Face Left',
    clinicalTitle: 'Step 3 of 5 — Supine, Head Turned 90° Toward Healthy Left Ear',
    targetYawDeg: 90.0,
    targetPitchDeg: 90.0,
    targetRollDeg: 0.0,
    targetReclineDeg: 90.0,
    targetPhiDeg: 95.0,
    phiCapMax: 95.0,
    durationSec: 45,
    headline: 'Step 3: Supine, Head Turned 90° Left (ψ = +90°, θ = 90°, γ = 0° → φ = +95°)',
    caption: 'Rotate head and body 90° toward left ear; otoconia enter the simple crus.',
    patientHeadline: '3. Face Left: Turn Your Head and Body to the Left',
    patientCaption: 'Turn your head 90° to the left. Crystals enter the exit tube.',
    clinicalPearl: 'Supine left in simple crus (g_proj = +0.912 to +0.937).',
  },
  {
    stepIndex: 3,
    stepId: 'lempert_step4',
    badge: 'STEP 4 OF 5 · PRONE NOSE DOWN',
    shortTitle: '4. Face Down',
    clinicalTitle: 'Step 4 of 5 — Prone Position (Body Rolled Face Down, Nose Down)',
    targetYawDeg: 180.0,
    targetPitchDeg: 90.0,
    targetRollDeg: 0.0,
    targetReclineDeg: 90.0,
    targetPhiDeg: 150.0,
    phiCapMax: 150.0,
    durationSec: 45,
    headline: 'Step 4: Prone Face Down (ψ = 180°, θ = 90°, γ = 0° → φ = +150°)',
    caption:
      'Roll prone onto stomach with nose pointing straight down; otoconia advance to utricular orifice.',
    patientHeadline: '4. Face Down: Roll Onto Your Stomach Facing Down',
    patientCaption: 'Roll onto your stomach with nose down. Crystals drain to the edge of the resting sac.',
    clinicalPearl: 'Prone face down common drainage (g_proj = +0.651 to +0.858).',
  },
  {
    stepIndex: 4,
    stepId: 'lempert_step5',
    badge: 'STEP 5 OF 5 · SIT UP',
    shortTitle: '5. Sit Up',
    clinicalTitle: 'Step 5 of 5 — Complete 360° Roll Onto Right Side and Sit Upright',
    targetYawDeg: 0.0,
    targetPitchDeg: 0.0,
    targetRollDeg: 0.0,
    targetReclineDeg: 0.0,
    targetPhiDeg: 180.0,
    phiCapMax: 180.0,
    durationSec: 30,
    headline: 'Step 5: Complete Roll and Sit Upright (ψ = 0°, θ = 0°, γ = 0° → φ = +180° Utricle)',
    caption: 'Complete full 360° roll and sit upright. Otoconia deposited safely in the utricle.',
    patientHeadline: '5. Sit Up: Sit Back Up',
    patientCaption: 'Sit up slowly. The entire 360° roll has dumped the crystals back into the resting sac.',
    clinicalPearl: 'Clearance 100%, 360° barbecue roll complete.',
  },
];

export const YACOVINO_STEPS: VestibularStepPreset[] = [
  {
    stepIndex: 0,
    stepId: 'yacovino_step1',
    badge: 'STEP 1 OF 4 · SIT NEUTRAL',
    shortTitle: '1. Sit Upright',
    clinicalTitle: 'Step 1 of 4 — Sit Upright Facing Forward',
    targetYawDeg: 0.0,
    targetPitchDeg: 0.0,
    targetRollDeg: 0.0,
    targetReclineDeg: 0.0,
    targetPhiDeg: -60.0,
    phiCapMax: -60.0,
    durationSec: 30,
    headline: 'Step 1: Sit Upright Facing Forward (ψ = 0°, θ = 0°, γ = 0°)',
    caption:
      'Patient seated upright facing forward. Otoconia trapped near the anterior ampulla under the arcuate eminence.',
    patientHeadline: '1. Sit Upright: Sit Facing Forward',
    patientCaption: 'Sit upright with head forward.',
    clinicalPearl: 'Baseline position for anterior semicircular canal canalithiasis.',
  },
  {
    stepIndex: 1,
    stepId: 'yacovino_step2',
    badge: 'STEP 2 OF 4 · DEEP HEAD-HANGING',
    shortTitle: '2. Deep Recline',
    clinicalTitle: 'Step 2 of 4 — Deep Head-Hanging Supine (Head Extended 30° Below Horizontal)',
    targetYawDeg: 0.0,
    targetPitchDeg: 120.0,
    targetRollDeg: 0.0,
    targetReclineDeg: 120.0,
    targetPhiDeg: 95.0,
    phiCapMax: 95.0,
    durationSec: 45,
    headline: 'Step 2: Deep Head-Hanging Supine (ψ = 0°, θ = 120°, γ = 0° → φ = +95°)',
    caption:
      'Rapid recline into deep head-hanging with neck extended 30° below table. Gravity pulls otoconia over superior arcuate apex.',
    patientHeadline: '2. Deep Recline: Lie Back with Head Tilted Downward Over Edge',
    patientCaption:
      'Lie back with head hanging 30° below the edge of the bed. Crystals slide over the top loop arch. Downbeating nystagmus appears.',
    clinicalPearl:
      'Gravity g_proj = +0.840 to +0.600 smoothly drives otoconia over arcuate eminence; triggers downbeating and torsional nystagmus.',
  },
  {
    stepIndex: 2,
    stepId: 'yacovino_step3',
    badge: 'STEP 3 OF 4 · CHIN TO CHEST',
    shortTitle: '3. Chin Tuck',
    clinicalTitle: 'Step 3 of 4 — Chin-to-Chest Forward Flexion (Chin Tucked 30°–45° While Supine)',
    targetYawDeg: 0.0,
    targetPitchDeg: 45.0,
    targetRollDeg: 0.0,
    targetReclineDeg: 45.0,
    targetPhiDeg: 150.0,
    phiCapMax: 150.0,
    durationSec: 45,
    headline: 'Step 3: Chin-to-Chest Forward Flexion (ψ = 0°, θ = 45°, γ = 0° → φ = +150°)',
    caption:
      'Patient flexes chin to chest 30°–45° forward while maintaining supine body. Common crus points downward; otoconia descend.',
    patientHeadline: '3. Chin Tuck: Bring Chin to Chest While Lying on Bed',
    patientCaption:
      'Tuck your chin toward your chest without sitting up. Crystals slide downward toward the resting chamber.',
    clinicalPearl: 'Gravity g_proj = +0.908 to +0.105 forces otoconia downward through inverted common crus.',
  },
  {
    stepIndex: 3,
    stepId: 'yacovino_step4',
    badge: 'STEP 4 OF 4 · SIT UP',
    shortTitle: '4. Sit Up',
    clinicalTitle: 'Step 4 of 4 — Return to Upright Sitting with Chin Tucked',
    targetYawDeg: 0.0,
    targetPitchDeg: 0.0,
    targetRollDeg: 0.0,
    targetReclineDeg: 0.0,
    targetPhiDeg: 180.0,
    phiCapMax: 180.0,
    durationSec: 30,
    headline: 'Step 4: Return to Upright Sitting (ψ = 0°, θ = 0°, γ = 0° → φ = +180° Utricle)',
    caption: 'Patient returns to seated position. Otoconia exit common crus directly into utricle.',
    patientHeadline: '4. Sit Up: Sit Back Up Slowly',
    patientCaption: 'Sit up slowly with chin slightly tucked. Crystals drop into the utricle and anterior vertigo resolves.',
    clinicalPearl: 'Clearance 100%, g_proj = +0.718 into utricle.',
  },
];

export const MANEUVER_PRESETS: Record<ManeuverId, VestibularStepPreset[]> = {
  epley: EPLEY_STEPS,
  semont: SEMONT_STEPS,
  gufoni_geotropic: GUFONI_GEOTROPIC_STEPS,
  gufoni_apogeotropic: GUFONI_APOGEOTROPIC_STEPS,
  barbecue_roll: LEMPERT_ROLL_STEPS,
  yacovino: YACOVINO_STEPS,
};

export const EPLEY_CLINICAL_STEPS: VestibularStepPreset[] = [
  {
    stepIndex: 0,
    stepId: 'locate',
    sceneId: 'scene1_locate',
    badge: 'INTRO · ANATOMY',
    shortTitle: '1. Intro',
    clinicalTitle: 'Anatomical Location — Right Posterior Canal in Temporal Bone',
    targetYawDeg: 0.0,
    targetPitchDeg: 0.0,
    targetRollDeg: 0.0,
    targetReclineDeg: 0.0,
    targetPhiDeg: -84.0,
    phiCapMax: -83.5,
    durationSec: 30,
    audioUrl: '/assets/audio/scene1_locate.wav',
    headline: 'Right Posterior-Canal BPPV: Displaced Otoconia',
    caption:
      'In posterior-canal BPPV, displaced otoconia enter the right posterior semicircular canal, which arches 45° posterolaterally behind the utricle.',
    patientHeadline: '1. Intro: Where the Inner Ear Balance Loops Sit',
    patientCaption:
      'Deep inside your right ear are three fluid-filled balance loops. Vertigo (BPPV) most often happens in the back balance loop when tiny calcium crystals slip out of their resting sac.',
    clinicalPearl: 'Baseline anatomical alignment.',
  },
  {
    stepIndex: 1,
    stepId: 'intro',
    sceneId: 'scene2_pathology',
    badge: 'CAUSE · LOOSE CRYSTALS',
    shortTitle: '2. Why Vertigo Happens',
    clinicalTitle: 'Pathology — Loose Otoconia Settled Near Posterior Ampulla',
    targetYawDeg: 0.0,
    targetPitchDeg: 0.0,
    targetRollDeg: 0.0,
    targetReclineDeg: 0.0,
    targetPhiDeg: -84.0,
    phiCapMax: -83.5,
    durationSec: 30,
    audioUrl: '/assets/audio/scene2_pathology.wav',
    headline: 'Pathology: Loose Otoconia Near the Posterior Ampulla (φ = -84°)',
    caption:
      'Dense calcium carbonate otoconia settle at the gravity-dependent base of the posterior canal just distal to the posterior cupula.',
    patientHeadline: '2. Why Vertigo Happens: Loose Crystals Trapped in the Bottom Loop',
    patientCaption:
      'Five tiny orange ear crystals have settled at the lowest point of the back balance loop right next to the balance motion sensor. Because the sensor flap blocks the short way out, we must guide them around the loop.',
    clinicalPearl: 'Loose otoconia at dependent floor.',
  },
  ...EPLEY_STEPS.map((s, idx) => ({
    ...s,
    stepIndex: idx + 2,
    stepId: `step${idx + 1}`,
  })),
  {
    stepIndex: 7,
    stepId: 'outro',
    sceneId: 'scene8_summary',
    badge: 'SUMMARY · CLEARED',
    shortTitle: '8. Cleared!',
    clinicalTitle: 'Clinical Summary — Three Keys to Epley Execution',
    targetYawDeg: 0.0,
    targetPitchDeg: 0.0,
    targetRollDeg: 0.0,
    targetReclineDeg: 0.0,
    targetPhiDeg: 186.0,
    phiCapMax: 186.0,
    durationSec: 30,
    audioUrl: '/assets/audio/scene8_summary.wav',
    headline: 'Clinical Summary: 30° Extension · No Head Lift in Step 3 · 30–60s Holds',
    caption:
      '1. Use a shoulder pillow for 20–30° neck extension; 2. Never lift the head during the Step 3 turn; 3. Hold each step 30–60s until particles settle.',
    patientHeadline: '8. Cleared! Three Simple Tips for a Successful Epley Treatment',
    patientCaption:
      '1. Place a pillow under your shoulders so your head tilts back gently; 2. Do not lift your head when turning left in Step 3; 3. Pause 30–60 seconds in each step so the crystals finish sliding.',
    clinicalPearl: 'Maneuver success: 100% canal clearance.',
  },
];

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge1 <= edge0) return x >= edge0 ? 1.0 : 0.0;
  const t = Math.max(0.0, Math.min(1.0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3.0 - 2.0 * t);
}

/**
 * Analytical 3x3 orthonormal head rotation matrix R_head(psi, theta, gamma) in SO(3).
 * Maps Head RAS coordinates (+X=Right, +Y=Anterior, +Z=Superior) to World coordinates.
 *
 * Product: R_head = Rx(theta_pitch) * Rz(psi_yaw) * Ry(gamma_roll)
 *
 * Properties:
 * - When gamma = 0, identically reduces to Rx(theta) * Rz(psi).
 * - Right ear down (side-lying on right shoulder): gamma = +90 deg -> +X_head maps to -Z_world.
 * - Left ear down (side-lying on left shoulder): gamma = -90 deg -> +X_head maps to +Z_world.
 */
export function computeHeadRotationMatrix(
  psiYawDeg: number,
  thetaPitchDeg: number,
  gammaRollDeg: number = 0.0
): number[][] {
  const psi = (psiYawDeg * Math.PI) / 180.0;
  const th = (thetaPitchDeg * Math.PI) / 180.0;
  const gam = (gammaRollDeg * Math.PI) / 180.0;

  const cPsi = Math.cos(psi);
  const sPsi = Math.sin(psi);
  const cTh = Math.cos(th);
  const sTh = Math.sin(th);
  const cGam = Math.cos(gam);
  const sGam = Math.sin(gam);

  return [
    [
      cPsi * cGam,
      -sPsi,
      cPsi * sGam,
    ],
    [
      cTh * sPsi * cGam + sTh * sGam,
      cTh * cPsi,
      cTh * sPsi * sGam - sTh * cGam,
    ],
    [
      sTh * sPsi * cGam - cTh * sGam,
      sTh * cPsi,
      sTh * sPsi * sGam + cTh * cGam,
    ],
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

/**
 * Hydrodynamic lumen-narrowing factor chi_lumen(phi) along the canal.
 */
export function computeLumenFactor(canalId: CanalId, phiDeg: number): number {
  const cfg = CANAL_BOUNDARIES[canalId];
  if (phiDeg < cfg.crusEntry) {
    return 1.0;
  }
  if (phiDeg < cfg.utricleOrifice) {
    return 0.35;
  }
  return 0.02;
}

export class VestibularDynamicsEngine {
  protected canalPaths: Partial<Record<CanalId, CanalPathData>> = {};
  protected canalId: CanalId = 'posterior';
  protected maneuverId: ManeuverId = 'epley';
  protected stepIndex = 0;
  protected phiDeg = -84.0;
  protected velocityDegPerSec = 0.0;
  protected cupulaDeflection = 0.0;

  protected readonly pPhiOffsets = [-7.0, -3.5, 0.0, 3.5, 7.0];
  protected readonly pRadial = [0.0, 0.015, 0.0, 0.015, 0.0];
  protected readonly pRadialAngle = [0.2, 1.4, 2.7, 4.1, 5.3];
  protected readonly utricleRadExtra = [0.14, 0.22, 0.02, 0.22, 0.16];

  constructor(
    paths: Partial<Record<CanalId, CanalPathData>> | CanalPathData,
    initialCanalId: CanalId = 'posterior',
    initialManeuverId?: ManeuverId
  ) {
    if ('samples' in paths) {
      const name = (paths.canal_name as CanalId) || initialCanalId;
      this.canalPaths[name] = paths;
      this.canalId = name;
    } else {
      this.canalPaths = { ...paths };
      this.canalId = initialCanalId;
    }
    if (initialManeuverId) {
      this.maneuverId = initialManeuverId;
      this.canalId = MANEUVER_TARGET_CANAL[initialManeuverId];
    } else {
      this.maneuverId = CANAL_DEFAULT_MANEUVER[this.canalId];
    }
    this.resetStateToManeuver(this.maneuverId);
  }

  public setCanalPath(canalId: CanalId, data: CanalPathData): void {
    this.canalPaths[canalId] = data;
  }

  public getCanalPath(canalId: CanalId = this.canalId): CanalPathData | undefined {
    return this.canalPaths[canalId];
  }

  public getCanal(): CanalId {
    return this.canalId;
  }

  public setCanal(canalId: CanalId): void {
    this.canalId = canalId;
    if (MANEUVER_TARGET_CANAL[this.maneuverId] !== canalId) {
      this.maneuverId = CANAL_DEFAULT_MANEUVER[canalId];
      this.stepIndex = 0;
    }
    const cfg = CANAL_BOUNDARIES[canalId];
    this.phiDeg = cfg.phiRest;
    this.velocityDegPerSec = 0.0;
    this.cupulaDeflection = 0.0;
  }

  public getManeuver(): ManeuverId {
    return this.maneuverId;
  }

  public setManeuver(maneuverId: ManeuverId): void {
    this.maneuverId = maneuverId;
    this.canalId = MANEUVER_TARGET_CANAL[maneuverId];
    this.resetStateToManeuver(maneuverId);
  }

  public resetStateToManeuver(maneuverId: ManeuverId): void {
    this.maneuverId = maneuverId;
    this.canalId = MANEUVER_TARGET_CANAL[maneuverId];
    this.stepIndex = 0;
    const presets = MANEUVER_PRESETS[maneuverId];
    if (presets && presets.length > 0) {
      this.phiDeg = presets[0].targetPhiDeg;
    } else {
      this.phiDeg = CANAL_BOUNDARIES[this.canalId].phiRest;
    }
    this.velocityDegPerSec = 0.0;
    this.cupulaDeflection = 0.0;
  }

  public setStepIndex(stepIndex: number): void {
    const presets = MANEUVER_PRESETS[this.maneuverId];
    if (presets && stepIndex >= 0 && stepIndex < presets.length) {
      this.stepIndex = stepIndex;
      this.phiDeg = presets[stepIndex].targetPhiDeg;
      this.velocityDegPerSec = 0.0;
      this.cupulaDeflection = 0.0;
    }
  }

  public getStepIndex(): number {
    return this.stepIndex;
  }

  public setPhiDeg(phi: number): void {
    const cfg = CANAL_BOUNDARIES[this.canalId];
    this.phiDeg = Math.max(cfg.phiMin, Math.min(cfg.phiMax + 10.0, phi));
    this.velocityDegPerSec = 0.0;
    this.cupulaDeflection = 0.0;
  }

  public getPhiDeg(): number {
    return this.phiDeg;
  }

  public getVelocityDegPerSec(): number {
    return this.velocityDegPerSec;
  }

  public getCupulaDeflection(): number {
    return this.cupulaDeflection;
  }

  public setCupulaDeflection(deflection: number): void {
    this.cupulaDeflection = Math.max(-1.0, Math.min(1.0, deflection));
  }

  public static classifyRegion(phiDeg: number, canalId: CanalId = 'posterior'): string {
    if (canalId === 'posterior') {
      if (phiDeg < -95.0) return 'Posterior Ampulla (Cupula Barrier)';
      if (phiDeg < -45.0) return 'Posterior Canal (Dependent Base)';
      if (phiDeg < 45.0) return 'Posterior Canal (Posterolateral Apex)';
      if (phiDeg < 112.0) return 'Posterior Canal (Superior Arch)';
      if (phiDeg < 172.0) return 'Common Crus (Shared Drainage Limb)';
      return 'Utricular Vestibule (Cleared!)';
    } else if (canalId === 'horizontal') {
      if (phiDeg < -60.0) return 'Horizontal Ampulla (Cupula Barrier)';
      if (phiDeg < 0.0) return 'Horizontal Canal (Anterior Limb)';
      if (phiDeg < 95.0) return 'Horizontal Canal (Posterior Limb)';
      if (phiDeg < 150.0) return 'Simple Crus (Non-Ampullated Limb)';
      return 'Utricular Vestibule (Cleared!)';
    } else {
      if (phiDeg < -60.0) return 'Anterior Ampulla (Cupula Barrier)';
      if (phiDeg < 0.0) return 'Anterior Canal (Ascending Limb)';
      if (phiDeg < 95.0) return 'Anterior Canal (Arcuate Apex)';
      if (phiDeg < 150.0) return 'Common Crus (Shared Limb)';
      return 'Utricular Vestibule (Cleared!)';
    }
  }

  public static computeClearancePercent(phiDeg: number, canalId: CanalId = 'posterior'): number {
    if (canalId === 'posterior') {
      return Math.round(Math.max(0, Math.min(100, ((phiDeg - -84.0) / (186.0 - -84.0)) * 100)));
    } else if (canalId === 'horizontal') {
      if (phiDeg >= 175.0) return 100;
      if (phiDeg <= -85.0) return 0;
      return Math.round(Math.max(0, Math.min(100, ((phiDeg - -85.0) / (180.0 - -85.0)) * 100)));
    } else {
      if (phiDeg >= 175.0) return 100;
      if (phiDeg <= -60.0) return 0;
      return Math.round(Math.max(0, Math.min(100, ((phiDeg - -60.0) / (180.0 - -60.0)) * 100)));
    }
  }

  public static classifyPatientLocation(phiDeg: number, canalId: CanalId = 'posterior'): string {
    if (canalId === 'posterior') {
      if (phiDeg < -45.0) return 'Trapped in Bottom Loop';
      if (phiDeg < 172.0) return 'Moving Through Tube';
      return 'Back in Resting Sac';
    } else if (canalId === 'horizontal') {
      if (phiDeg < -60.0) return 'Adhered to Cupula Crest';
      if (phiDeg < 150.0) return 'Moving Through Horizontal Duct';
      return 'Back in Resting Sac';
    } else {
      if (phiDeg < -60.0) return 'Trapped Near Anterior Ampulla';
      if (phiDeg < 150.0) return 'Moving Through Anterior Duct';
      return 'Back in Resting Sac';
    }
  }

  public static classifyPatientSensation(
    velocityDegPerSec: number,
    cupulaDeflection: number
  ): 'Calm (No Spinning)' | 'Spinning (Crystals Moving)' | 'Spinning (Crystals Sliding Back)' {
    if (cupulaDeflection > 0.12 || velocityDegPerSec > 1.2) {
      return 'Spinning (Crystals Moving)';
    }
    if (cupulaDeflection < -0.12 || velocityDegPerSec < -1.2) {
      return 'Spinning (Crystals Sliding Back)';
    }
    return 'Calm (No Spinning)';
  }

  public interpolateAtPhi(
    phi: number,
    canalId: CanalId = this.canalId
  ): {
    arc: number;
    pos: [number, number, number];
    tan: [number, number, number];
    nrm: [number, number, number];
    binorm: [number, number, number];
  } {
    const path = this.canalPaths[canalId];
    if (!path) {
      throw new Error(`Canal path data for ${canalId} not loaded`);
    }
    const samples = path.samples;
    const phiFirst = samples[0].phi_deg;
    const phiLast = samples[samples.length - 1].phi_deg;
    const clamped = Math.max(
      Math.min(phiFirst, phiLast),
      Math.min(Math.max(phiFirst, phiLast), phi)
    );

    let i0 = 0;
    for (let i = 0; i < samples.length - 1; i++) {
      const pA = samples[i].phi_deg;
      const pB = samples[i + 1].phi_deg;
      if ((clamped >= pA && clamped <= pB) || (clamped >= pB && clamped <= pA)) {
        i0 = i;
        break;
      }
    }
    const i1 = Math.min(samples.length - 1, i0 + 1);
    const s0 = samples[i0];
    const s1 = samples[i1];
    const span = Math.max(1e-6, Math.abs(s1.phi_deg - s0.phi_deg));
    const t = Math.max(0.0, Math.min(1.0, Math.abs(clamped - s0.phi_deg) / span));

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
    const rawTan = lerp3(s0.tangent_ras, s1.tangent_ras);

    let tanZ = rawTan[2];
    if (canalId === 'posterior') {
      const floorRamp = smoothstep(-84.0, -70.0, clamped);
      tanZ = tanZ > 0 ? tanZ * floorRamp : tanZ;
    }
    const tan = normalize3([rawTan[0], rawTan[1], tanZ]);

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

  public computeParticlesRAS(
    centerPhiDeg: number,
    canalId: CanalId = this.canalId
  ): Array<[number, number, number]> {
    const cfg = CANAL_BOUNDARIES[canalId];
    const utricleFan = smoothstep(cfg.utricleFanStart, cfg.phiMax, centerPhiDeg);
    const spreadScale = 1.0 + 0.25 * utricleFan;
    const pts: Array<[number, number, number]> = [];

    for (let i = 0; i < 5; i++) {
      const phiI = Math.max(
        cfg.phiMin,
        Math.min(cfg.phiMax + 10.0, centerPhiDeg + this.pPhiOffsets[i] * spreadScale)
      );
      const { pos, nrm, binorm } = this.interpolateAtPhi(phiI, canalId);
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

  public computeTelemetrySnapshot(
    psiYawDeg: number,
    thetaPitchDeg: number,
    gammaRollDeg: number = 0.0
  ): VestibularTelemetryState {
    const R = computeHeadRotationMatrix(psiYawDeg, thetaPitchDeg, gammaRollDeg);
    const sample = this.interpolateAtPhi(this.phiDeg, this.canalId);
    const tanWorld = matVecMul(R, sample.tan);
    const particlesRAS = this.computeParticlesRAS(this.phiDeg, this.canalId);

    const cfg = CANAL_BOUNDARIES[this.canalId];
    const deltaEff = cfg.cupulaNormalExcitatorySign * this.cupulaDeflection;
    const baselineSpikes = 90;
    // Ewald's asymmetry: excitatory slope (+220) vs inhibitory slope (+80)
    const spikeShift = deltaEff >= 0 ? 220 * deltaEff : 80 * deltaEff;
    const afferentSpikesPerSec = Math.round(
      Math.max(10, Math.min(310, baselineSpikes + spikeShift))
    );

    let nystagmusState = 'Baseline (None)';
    let slowPhaseVelocityDegPerSec = { horizontal: 0, vertical: 0, torsional: 0 };
    let fastPhaseBeatDirection = 'None (Resting)';
    let ewaldLawActive = 'Ewald Baseline Equilibrium';

    if (Math.abs(this.cupulaDeflection) > 0.12) {
      if (this.canalId === 'posterior') {
        if (deltaEff > 0) {
          nystagmusState = 'Excitatory Upbeat-Torsional';
          slowPhaseVelocityDegPerSec = { horizontal: 0, vertical: -25.0 * deltaEff, torsional: -25.0 * deltaEff };
          fastPhaseBeatDirection = 'Upbeating + Right Torsional';
          ewaldLawActive = "Ewald's 3rd Law: Ampullofugal flow excites posterior canal";
        } else {
          nystagmusState = 'Inhibitory Reversal';
          slowPhaseVelocityDegPerSec = { horizontal: 0, vertical: -25.0 * deltaEff, torsional: -25.0 * deltaEff };
          fastPhaseBeatDirection = 'Downbeating + Left Torsional';
          ewaldLawActive = "Ewald's 3rd Law: Ampullopetal flow inhibits posterior canal";
        }
      } else if (this.canalId === 'horizontal') {
        if (deltaEff > 0) {
          nystagmusState = 'Excitatory Right-Beating (Geotropic)';
          slowPhaseVelocityDegPerSec = { horizontal: -35.0 * deltaEff, vertical: 0, torsional: 0 };
          fastPhaseBeatDirection = 'Right-Beating Horizontal (Geotropic)';
          ewaldLawActive = "Ewald's 2nd Law: Ampullopetal flow excites horizontal canal";
        } else {
          nystagmusState = 'Inhibitory Left-Beating (Apogeotropic)';
          slowPhaseVelocityDegPerSec = { horizontal: -35.0 * deltaEff, vertical: 0, torsional: 0 };
          fastPhaseBeatDirection = 'Left-Beating Horizontal (Apogeotropic)';
          ewaldLawActive = "Ewald's 2nd Law: Ampullofugal flow inhibits horizontal canal";
        }
      } else {
        if (deltaEff > 0) {
          nystagmusState = 'Excitatory Downbeat-Torsional';
          slowPhaseVelocityDegPerSec = { horizontal: 0, vertical: 25.0 * deltaEff, torsional: -25.0 * deltaEff };
          fastPhaseBeatDirection = 'Downbeating + Right Torsional';
          ewaldLawActive = "Ewald's 3rd Law: Ampullofugal flow excites anterior canal";
        } else {
          nystagmusState = 'Inhibitory Upbeat-Torsional';
          slowPhaseVelocityDegPerSec = { horizontal: 0, vertical: 25.0 * deltaEff, torsional: -25.0 * deltaEff };
          fastPhaseBeatDirection = 'Upbeating + Left Torsional';
          ewaldLawActive = "Ewald's 3rd Law: Ampullopetal flow inhibits anterior canal";
        }
      }
    }

    const rawGravityDrive = -tanWorld[2];
    const settledOnFloor =
      (this.canalId === 'posterior' && this.phiDeg <= -84.0 && rawGravityDrive < 0.0) ||
      (this.phiDeg <= cfg.phiMin && rawGravityDrive < 0.0) ||
      (this.phiDeg >= cfg.utricleOrifice && Math.abs(this.velocityDegPerSec) < 0.2);

    return {
      canalId: this.canalId,
      maneuverId: this.maneuverId,
      stepIndex: this.stepIndex,
      psiYawDeg,
      thetaPitchDeg,
      thetaReclineDeg: thetaPitchDeg,
      gammaRollDeg,
      phiDeg: this.phiDeg,
      arcMm: sample.arc,
      velocityDegPerSec: this.velocityDegPerSec,
      gravityAlongCanal: settledOnFloor ? 0.0 : rawGravityDrive,
      cupulaDeflectionNormalized: this.cupulaDeflection,
      afferentSpikesPerSec,
      nystagmusState,
      slowPhaseVelocityDegPerSec,
      fastPhaseBeatDirection,
      ewaldLawActive,
      anatomicalRegion: VestibularDynamicsEngine.classifyRegion(this.phiDeg, this.canalId),
      clearancePercent: VestibularDynamicsEngine.computeClearancePercent(this.phiDeg, this.canalId),
      patientSensation: VestibularDynamicsEngine.classifyPatientSensation(
        this.velocityDegPerSec,
        this.cupulaDeflection
      ),
      patientLocation: VestibularDynamicsEngine.classifyPatientLocation(this.phiDeg, this.canalId),
      centerRAS: sample.pos,
      tangentRAS: sample.tan,
      tangentWorld: tanWorld,
      particlesRAS,
    };
  }

  /**
   * Advance the continuous 3D Stokes sedimentation ODE by `dt` seconds.
   */
  public stepPhysics(
    dt: number,
    psiYawDeg: number,
    thetaPitchDeg: number,
    options?: StepPhysicsOptions
  ): VestibularTelemetryState;
  public stepPhysics(
    dt: number,
    psiYawDeg: number,
    thetaPitchDeg: number,
    gammaRollDeg?: number,
    options?: StepPhysicsOptions
  ): VestibularTelemetryState;
  public stepPhysics(
    dt: number,
    psiYawDeg: number,
    thetaPitchDeg: number,
    gammaRollDegOrOptions?: number | StepPhysicsOptions,
    maybeOptions?: StepPhysicsOptions
  ): VestibularTelemetryState {
    let gammaRollDeg = 0.0;
    let options = maybeOptions;
    if (typeof gammaRollDegOrOptions === 'number') {
      gammaRollDeg = gammaRollDegOrOptions;
    } else if (gammaRollDegOrOptions && typeof gammaRollDegOrOptions === 'object') {
      options = gammaRollDegOrOptions;
      gammaRollDeg = 0.0;
    }

    const clampedDt = Math.min(0.05, Math.max(0.0, dt));
    const R = computeHeadRotationMatrix(psiYawDeg, thetaPitchDeg, gammaRollDeg);
    const { tan } = this.interpolateAtPhi(this.phiDeg, this.canalId);
    const tanWorld = matVecMul(R, tan);

    // Gravity projection along canal tangent: g_proj = -tanWorld[2]
    const gProj = -tanWorld[2];
    let effectiveDrive = gProj;
    const cfg = CANAL_BOUNDARIES[this.canalId];

    // Maneuver-specific gravity assists and drainage routing
    if (this.canalId === 'posterior') {
      if (this.maneuverId === 'epley') {
        const inStep3HeadPose =
          Boolean(options?.isStep3Assist) ||
          (psiYawDeg >= 15.0 && psiYawDeg <= 80.0 && thetaPitchDeg >= 65.0);
        const inStep4RollPose = psiYawDeg > 80.0 && thetaPitchDeg >= 50.0;
        const inStep5UprightDrain = thetaPitchDeg <= 65.0 && this.phiDeg >= 115.0;

        if (inStep3HeadPose && this.phiDeg >= 90.0 && this.phiDeg <= 112.5) {
          if (this.phiDeg < 110.0) {
            effectiveDrive = Math.max(
              gProj,
              0.08 + 0.20 * (1.0 - Math.max(0.0, this.phiDeg - 94.0) / 16.0)
            );
          } else {
            effectiveDrive = 0.0;
          }
        } else if (inStep4RollPose && this.phiDeg >= 90.0) {
          if (this.phiDeg < 165.0) {
            effectiveDrive = Math.max(gProj, 0.36);
          } else {
            effectiveDrive = 0.0;
          }
        } else if (inStep5UprightDrain && this.phiDeg < 186.0) {
          effectiveDrive = Math.max(gProj, 0.28);
        }
      } else if (this.maneuverId === 'semont') {
        const inSemontDrop = gammaRollDeg >= 60.0;
        const inSemontSwing = gammaRollDeg <= -60.0;
        const inSemontUpright = Math.abs(gammaRollDeg) <= 30.0 && thetaPitchDeg <= 45.0 && this.phiDeg >= 110.0;

        if (inSemontDrop && this.phiDeg >= -84.0 && this.phiDeg < 30.0) {
          effectiveDrive = Math.max(gProj, 0.65);
        } else if (inSemontSwing && this.phiDeg >= 25.0 && this.phiDeg < 165.0) {
          effectiveDrive = Math.max(gProj, 0.55);
        } else if (inSemontUpright && this.phiDeg < 186.0) {
          effectiveDrive = Math.max(gProj, 0.40);
        }
      }
    } else if (this.canalId === 'horizontal') {
      if (this.maneuverId === 'gufoni_geotropic') {
        const inSideLieLeft = gammaRollDeg <= -60.0;
        const inNoseDown = psiYawDeg >= 30.0 && gammaRollDeg <= -60.0;
        const inSitUp = Math.abs(gammaRollDeg) <= 30.0 && thetaPitchDeg <= 45.0 && this.phiDeg >= 95.0;

        if (inNoseDown && this.phiDeg < 175.0) {
          effectiveDrive = Math.max(gProj, 0.50);
        } else if (inSideLieLeft && this.phiDeg < 95.0) {
          effectiveDrive = Math.max(gProj, 0.45);
        } else if (inSitUp && this.phiDeg < 180.0) {
          effectiveDrive = Math.max(gProj, 0.35);
        }
      } else if (this.maneuverId === 'gufoni_apogeotropic') {
        const inSideLieRight = gammaRollDeg >= 60.0;
        const inNoseUp = psiYawDeg <= -30.0 && gammaRollDeg >= 60.0;
        const inSitUp = Math.abs(gammaRollDeg) <= 30.0 && thetaPitchDeg <= 45.0 && this.phiDeg >= 90.0;

        if (inSideLieRight && this.phiDeg < 0.0) {
          effectiveDrive = Math.max(gProj, 0.85);
        } else if (inNoseUp && this.phiDeg < 95.0) {
          effectiveDrive = Math.max(gProj, 0.50);
        } else if (inSitUp && this.phiDeg < 180.0) {
          effectiveDrive = Math.max(gProj, 0.45);
        }
      } else if (this.maneuverId === 'barbecue_roll') {
        const inSupineRight = psiYawDeg <= -60.0 && thetaPitchDeg >= 60.0;
        const inSupineNeutral = Math.abs(psiYawDeg) <= 30.0 && thetaPitchDeg >= 60.0;
        const inSupineLeft = psiYawDeg >= 60.0 && psiYawDeg <= 120.0 && thetaPitchDeg >= 60.0;
        const inProne = psiYawDeg >= 150.0 && thetaPitchDeg >= 60.0;
        const inSitUp = thetaPitchDeg <= 45.0 && this.phiDeg >= 95.0;

        if (inSupineRight && this.phiDeg < 0.0) {
          effectiveDrive = Math.max(gProj, 0.50);
        } else if (inSupineNeutral && this.phiDeg < 45.0) {
          effectiveDrive = Math.max(gProj, 0.50);
        } else if (inSupineLeft && this.phiDeg < 95.0) {
          effectiveDrive = Math.max(gProj, 0.50);
        } else if (inProne && this.phiDeg < 160.0) {
          effectiveDrive = Math.max(gProj, 0.45);
        } else if (inSitUp && this.phiDeg < 180.0) {
          effectiveDrive = Math.max(gProj, 0.35);
        }
      }
    } else if (this.canalId === 'anterior') {
      if (this.maneuverId === 'yacovino') {
        const inDeepHanging = thetaPitchDeg >= 90.0;
        const inChinTuck = thetaPitchDeg >= 30.0 && thetaPitchDeg <= 60.0;
        const inSitUp = thetaPitchDeg <= 30.0 && this.phiDeg >= 95.0;

        if (inDeepHanging && this.phiDeg < 95.0) {
          effectiveDrive = Math.max(gProj, 0.60);
        } else if (inChinTuck && this.phiDeg < 150.0) {
          effectiveDrive = Math.max(gProj, 0.50);
        } else if (inSitUp && this.phiDeg < 180.0) {
          effectiveDrive = Math.max(gProj, 0.40);
        }
      }
    }

    const mobility = options?.mobility ?? 48.0;
    const allowBack = options?.allowBackwardSlide ?? true;
    const phiCapMax = options?.phiCapMax ?? cfg.phiMax;

    let dphiDt = 0.0;
    if (allowBack) {
      if (Math.abs(effectiveDrive) > 0.045) {
        dphiDt = mobility * effectiveDrive;
      }
    } else {
      dphiDt = mobility * Math.max(0.0, effectiveDrive);
    }

    // Ampullary barrier clamp
    if (this.phiDeg <= cfg.phiMin && dphiDt < 0.0) {
      dphiDt = 0.0;
    }
    // Resting floor clamp (Posterior canal floor at phi = -84° prevents retrograde slide in sitting upright)
    if (this.canalId === 'posterior' && this.phiDeg <= cfg.phiRest && dphiDt < 0.0) {
      dphiDt = 0.0;
    }
    // Irreversible crus & utricular reflux prevention
    if (this.phiDeg >= cfg.crusEntry && dphiDt < 0.0) {
      dphiDt = 0.0;
    }
    if (this.phiDeg >= cfg.utricleOrifice && dphiDt < 0.0) {
      dphiDt = 0.0;
    }
    // Step target capping
    if (this.phiDeg >= phiCapMax && dphiDt > 0.0) {
      dphiDt = 0.0;
    }

    const floorMin = this.canalId === 'posterior' ? cfg.phiRest : cfg.phiMin;
    const minAllowedPhi = Math.min(floorMin, this.phiDeg);
    const maxAllowedPhi = Math.max(phiCapMax, this.phiDeg);
    this.phiDeg = Math.max(
      minAllowedPhi,
      Math.min(maxAllowedPhi, this.phiDeg + dphiDt * clampedDt)
    );
    this.velocityDegPerSec = dphiDt;

    // Steinhausen Cupula Plunger fluid coupling with active drag and passive elastic recovery
    const lumenFactor = computeLumenFactor(this.canalId, this.phiDeg);
    const targetCupula = Math.max(-1.0, Math.min(1.0, (dphiDt / 28.0) * lumenFactor));
    const tauReturn = 1.8;
    const kappaDrag = 2.2;

    if (Math.abs(targetCupula) > 1e-4) {
      // Active drag coupling
      this.cupulaDeflection +=
        (targetCupula - this.cupulaDeflection) * Math.min(1.0, clampedDt * kappaDrag);
    } else {
      // Passive elastic decay
      this.cupulaDeflection *= Math.exp(-clampedDt / tauReturn);
    }
    this.cupulaDeflection = Math.max(-1.0, Math.min(1.0, this.cupulaDeflection));

    return this.computeTelemetrySnapshot(psiYawDeg, thetaPitchDeg, gammaRollDeg);
  }
}

/**
 * Drop-in backward-compatibility wrapper for RealtimeEpleySimulator.
 */
export class RealtimeEpleySimulator extends VestibularDynamicsEngine {
  public readonly pathData: CanalPathData;

  constructor(pathData: PosteriorCanalPathData | CanalPathData) {
    super(pathData as CanalPathData, 'posterior', 'epley');
    this.pathData = pathData as CanalPathData;
  }

  public override setPhiDeg(phi: number): void {
    super.setPhiDeg(Math.max(-108.0, Math.min(192.0, phi)));
  }

  public override stepPhysics(
    dt: number,
    psiYawDeg: number,
    thetaReclineDeg: number,
    options?: StepPhysicsOptions
  ): VestibularTelemetryState;
  public override stepPhysics(
    dt: number,
    psiYawDeg: number,
    thetaReclineDeg: number,
    gammaRollDeg?: number,
    options?: StepPhysicsOptions
  ): VestibularTelemetryState;
  public override stepPhysics(
    dt: number,
    psiYawDeg: number,
    thetaReclineDeg: number,
    gammaRollDegOrOptions?: number | StepPhysicsOptions,
    maybeOptions?: StepPhysicsOptions
  ): VestibularTelemetryState {
    return super.stepPhysics(
      dt,
      psiYawDeg,
      thetaReclineDeg,
      gammaRollDegOrOptions as any,
      maybeOptions
    );
  }

  public static override classifyRegion(phiDeg: number): string {
    return VestibularDynamicsEngine.classifyRegion(phiDeg, 'posterior');
  }

  public static override computeClearancePercent(phiDeg: number): number {
    return VestibularDynamicsEngine.computeClearancePercent(phiDeg, 'posterior');
  }

  public static override classifyPatientLocation(
    phiDeg: number
  ): PhysicsTelemetryState['patientLocation'] {
    return VestibularDynamicsEngine.classifyPatientLocation(phiDeg, 'posterior') as PhysicsTelemetryState['patientLocation'];
  }

  public static override classifyPatientSensation(
    velocityDegPerSec: number,
    cupulaDeflection: number
  ): PhysicsTelemetryState['patientSensation'] {
    return VestibularDynamicsEngine.classifyPatientSensation(velocityDegPerSec, cupulaDeflection);
  }
}
