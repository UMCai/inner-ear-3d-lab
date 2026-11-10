/**
 * web/src/render/eyeAvatar.ts
 *
 * 3D Eye Avatar & VOR Kinematics Engine.
 * Stage 3 — Step 3: Gate 3 Medaium Architecture.
 *
 * Provides:
 * 1. Three.js GLTF scene graph pipeline for assets/iemap/eye_avatar.glb
 * 2. 3-DOF Listing's Law Kinematics: single-axis Listing plane rotation (qz strictly == 0)
 *    with active vestibular cyclotorsion around optical axis (-Z)
 * 3. Bilateral Cyclovergent Coupling: Right extorsion and Left intorsion for upbeat-right
 *    torsional nystagmus, conjugate horizontal yaw, conjugate vertical pitch
 * 4. Sawtooth Nystagmus Waveform & Neural Integrator: slow drift integration,
 *    central saccadic burst generator (400–700°/s, 25–40 ms, anti-parallel reset),
 *    retinal slip threshold (3.0°–6.0°), inter-saccadic timeout (200–350 ms),
 *    and brainstem neural integrator elastic leak (tau = 0.8 s)
 * 5. Infrared VNG Mode & P-CR Telemetry: monochromatic NIR shader toggle,
 *    3D-to-2D pupil centroid projection, and closed-form paraxial Purkinje glint reflection
 * 6. 60fps Zero-Allocation Ring Buffer: NystagmogramRingBuffer with pre-allocated typed arrays
 *    and static scratch math vectors/quaternions.
 */

if (typeof globalThis !== 'undefined' && typeof (globalThis as any).self === 'undefined') {
  (globalThis as any).self = globalThis;
}

import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { VestibularTelemetryState } from '../physics/vestibularEngine.ts';

export interface ScreenCoord {
  x: number;
  y: number;
  visible: boolean;
}

export interface EyeTelemetry {
  horizontalDeg: number;
  verticalDeg: number;
  torsionalRightDeg: number;
  torsionalLeftDeg: number;
  slowPhaseVelocityDegPerSec: number;
  fastPhaseBeatDirection: string;
  isFastPhaseActive: boolean;
  pupilScreenR: ScreenCoord;
  pupilScreenL: ScreenCoord;
  glintScreenR: ScreenCoord;
  glintScreenL: ScreenCoord;
}

export type VisualMode = 'natural' | 'infrared_vng';
export type GazeMode = 'bilateral' | 'right_only' | 'left_only';

export interface EyeAvatarConfig {
  canvas?: HTMLCanvasElement;
  logicalWidth?: number;
  logicalHeight?: number;
  pixelRatio?: number;
  visualMode?: VisualMode;
  gazeMode?: GazeMode;
  glbPath?: string;
}

/**
 * 60fps Zero-Allocation Nystagmogram Ring Buffer
 * Pre-allocated typed arrays for 10 seconds of streaming data at 60Hz.
 * Scalar push method guarantees 0 per-frame heap object allocations.
 */
export class NystagmogramRingBuffer {
  private readonly capacity: number;
  private readonly timeArray: Float32Array;
  private readonly horizontalArray: Float32Array;
  private readonly verticalArray: Float32Array;
  private readonly torsionalArray: Float32Array;
  private readonly spvArray: Float32Array;
  private readonly fastPhaseFlags: Uint8Array;
  private writeIndex = 0;
  private count = 0;

  constructor(capacity = 600) {
    this.capacity = capacity;
    this.timeArray = new Float32Array(capacity);
    this.horizontalArray = new Float32Array(capacity);
    this.verticalArray = new Float32Array(capacity);
    this.torsionalArray = new Float32Array(capacity);
    this.spvArray = new Float32Array(capacity);
    this.fastPhaseFlags = new Uint8Array(capacity);
  }

  public push(
    timestampSec: number,
    hDeg: number,
    vDeg: number,
    tDeg: number,
    spvDegPerSec: number,
    isFastPhase: boolean
  ): void {
    const idx = this.writeIndex;
    this.timeArray[idx] = timestampSec;
    this.horizontalArray[idx] = hDeg;
    this.verticalArray[idx] = vDeg;
    this.torsionalArray[idx] = tDeg;
    this.spvArray[idx] = spvDegPerSec;
    this.fastPhaseFlags[idx] = isFastPhase ? 1 : 0;
    this.writeIndex = (this.writeIndex + 1) % this.capacity;
    if (this.count < this.capacity) {
      this.count++;
    }
  }

  public getCount(): number {
    return this.count;
  }

  public getCapacity(): number {
    return this.capacity;
  }

  public getWriteIndex(): number {
    return this.writeIndex;
  }

  public getTimeArray(): Float32Array {
    return this.timeArray;
  }

  public getHorizontalArray(): Float32Array {
    return this.horizontalArray;
  }

  public getVerticalArray(): Float32Array {
    return this.verticalArray;
  }

  public getTorsionalArray(): Float32Array {
    return this.torsionalArray;
  }

  public getSpvArray(): Float32Array {
    return this.spvArray;
  }

  public getFastPhaseFlags(): Uint8Array {
    return this.fastPhaseFlags;
  }

  public clear(): void {
    this.writeIndex = 0;
    this.count = 0;
    this.timeArray.fill(0);
    this.horizontalArray.fill(0);
    this.verticalArray.fill(0);
    this.torsionalArray.fill(0);
    this.spvArray.fill(0);
    this.fastPhaseFlags.fill(0);
  }
}

// -----------------------------------------------------------------------------
// Pre-allocated static scratch buffers for 60fps zero-allocation execution
// -----------------------------------------------------------------------------
const _qListing = new THREE.Quaternion();
const _qTorsion = new THREE.Quaternion();
const _qEyeR = new THREE.Quaternion();
const _qEyeL = new THREE.Quaternion();
const _vPupilLocal = new THREE.Vector3(0, 0, -0.0092);
const _vCorneaCenterLocal = new THREE.Vector3(0, 0, -0.0057);
const _vPupilWorldR = new THREE.Vector3();
const _vPupilWorldL = new THREE.Vector3();
const _vCorneaCenterWorldR = new THREE.Vector3();
const _vCorneaCenterWorldL = new THREE.Vector3();
const _vGlintWorldR = new THREE.Vector3();
const _vGlintWorldL = new THREE.Vector3();
const _vLightDir = new THREE.Vector3();
const _vCamDir = new THREE.Vector3();
const _vHalf = new THREE.Vector3();
const _vScreenPos = new THREE.Vector3();

// -----------------------------------------------------------------------------
// High-Fidelity Procedural Ocular Textures (Zero external image dependencies)
// -----------------------------------------------------------------------------
let _cachedIrisTexture: THREE.DataTexture | null = null;
let _cachedIrisNormalTexture: THREE.DataTexture | null = null;
let _cachedScleraTexture: THREE.DataTexture | null = null;

function generateProceduralIrisData(size = 512): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  const cx = (size - 1) * 0.5;
  const cy = (size - 1) * 0.5;
  const half = size * 0.5;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const nx = (x - cx) / half;
      const ny = (y - cy) / half;
      const r = Math.hypot(nx, ny);

      if (r > 1.0) {
        data[idx] = 0;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
        data[idx + 3] = 0;
        continue;
      }

      const theta = Math.atan2(ny, nx);

      // Multi-octave fibrous radial architecture with slight angular tortuosity
      const thetaWarp =
        theta +
        0.040 * Math.sin(6 * theta) +
        0.020 * Math.sin(14 * theta) +
        0.010 * Math.sin(28 * theta);
      const s32 = 0.5 + 0.5 * Math.cos(32 * thetaWarp);
      const s64 = 0.5 + 0.5 * Math.cos(64 * thetaWarp + 0.6);
      const s128 = 0.5 + 0.5 * Math.cos(128 * thetaWarp + 1.3);
      const s256 = 0.5 + 0.5 * Math.cos(256 * thetaWarp + 2.1);
      const fibers = 0.38 * s32 + 0.30 * s64 + 0.20 * s128 + 0.12 * s256;

      // Collarette zigzag ring at r ~ 0.48
      const rCollarette =
        0.48 +
        0.035 * Math.cos(16 * theta) +
        0.018 * Math.sin(32 * theta) +
        0.008 * Math.cos(48 * theta);
      const collarette = Math.exp(-((r - rCollarette) ** 2) / 0.0035);

      // Crypts of Fuchs: diamond/oval recesses along collarette
      const cryptMod = Math.pow(0.5 + 0.5 * Math.cos(16 * theta + 0.3 * Math.sin(32 * theta)), 3.0);
      const crypts = Math.exp(-((r - 0.52) ** 2) / 0.006) * cryptMod;

      // Pupillary zone & peripupillary ring
      const pupilRuff = Math.exp(-((r - 0.245) ** 2) / 0.0015);

      // Ciliary contraction furrows
      const furrow1 = 0.14 * Math.exp(-((r - 0.68) ** 2) / 0.0012);
      const furrow2 = 0.11 * Math.exp(-((r - 0.77) ** 2) / 0.0012);
      const furrow3 = 0.08 * Math.exp(-((r - 0.86) ** 2) / 0.0012);
      const furrows = furrow1 + furrow2 + furrow3;

      // Dark Limbal Ring (annulus at r ~ 0.86 to 0.98)
      const limbalRing = Math.max(0.0, Math.min(1.0, (r - 0.85) / 0.11));
      const limbusFade = Math.max(0.0, Math.min(1.0, (0.98 - r) / 0.035));
      const isPupilHole = r < 0.22;

      // Outer ciliary tone: rich ocean slate-blue with subtle green/grey stroma
      const ciliaryR = 0.14 + 0.26 * fibers - 0.14 * furrows - 0.12 * crypts;
      const ciliaryG = 0.38 + 0.28 * fibers - 0.10 * furrows - 0.10 * crypts;
      const ciliaryB = 0.58 + 0.30 * fibers - 0.06 * furrows - 0.06 * crypts;

      // Warm golden/amber peripupillary tone & collarette starburst
      const amberR = 0.68 + 0.24 * fibers + 0.20 * collarette;
      const amberG = 0.48 + 0.18 * fibers + 0.14 * collarette;
      const amberB = 0.22 + 0.10 * fibers + 0.06 * collarette;

      // Melanin gradient: amber blends into ciliary blue
      let tAmber = Math.max(0.0, Math.min(1.0, 1.0 - (r - 0.25) / 0.26)) * 0.85 + 0.45 * collarette;
      tAmber = Math.max(0.0, Math.min(1.0, tAmber));

      let R = ciliaryR * (1.0 - tAmber) + amberR * tAmber;
      let G = ciliaryG * (1.0 - tAmber) + amberG * tAmber;
      let B = ciliaryB * (1.0 - tAmber) + amberB * tAmber;

      // Darken pupillary ruff
      R *= (1.0 - 0.60 * pupilRuff);
      G *= (1.0 - 0.65 * pupilRuff);
      B *= (1.0 - 0.70 * pupilRuff);

      // Apply dark limbal ring
      R *= (1.0 - 0.80 * limbalRing);
      G *= (1.0 - 0.80 * limbalRing);
      B *= (1.0 - 0.76 * limbalRing);

      if (isPupilHole) {
        data[idx] = 4;
        data[idx + 1] = 4;
        data[idx + 2] = 4;
        data[idx + 3] = 0; // transparent pupil aperture
      } else {
        data[idx] = Math.round(Math.max(0, Math.min(255, R * 255 * limbusFade)));
        data[idx + 1] = Math.round(Math.max(0, Math.min(255, G * 255 * limbusFade)));
        data[idx + 2] = Math.round(Math.max(0, Math.min(255, B * 255 * limbusFade)));
        data[idx + 3] = Math.round(limbusFade * 255);
      }
    }
  }
  return data;
}

function generateProceduralIrisNormalData(size = 512): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  const cx = (size - 1) * 0.5;
  const cy = (size - 1) * 0.5;
  const half = size * 0.5;

  const getHeight = (x: number, y: number) => {
    const nx = (x - cx) / half;
    const ny = (y - cy) / half;
    const r = Math.hypot(nx, ny);
    if (r > 0.98 || r < 0.23) return 0;
    const theta = Math.atan2(ny, nx);
    const thetaWarp = theta + 0.04 * Math.sin(6 * theta) + 0.02 * Math.sin(14 * theta);
    const fibers =
      0.4 * (0.5 + 0.5 * Math.cos(32 * thetaWarp)) +
      0.3 * (0.5 + 0.5 * Math.cos(64 * thetaWarp)) +
      0.3 * (0.5 + 0.5 * Math.cos(128 * thetaWarp));
    const collarette = Math.exp(-((r - 0.48) ** 2) / 0.004);
    return fibers * 0.7 + collarette * 0.3;
  };

  const bumpScale = 4.0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const xL = Math.max(0, x - 1);
      const xR = Math.min(size - 1, x + 1);
      const yD = Math.max(0, y - 1);
      const yU = Math.min(size - 1, y + 1);

      const dx = (getHeight(xR, y) - getHeight(xL, y)) * bumpScale;
      const dy = (getHeight(x, yU) - getHeight(x, yD)) * bumpScale;
      const dz = 1.0;
      const len = Math.hypot(dx, dy, dz);

      data[idx] = Math.round(((-dx / len) * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round(((-dy / len) * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round(((dz / len) * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }
  return data;
}

function generateProceduralScleraData(size = 512): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  const cx = (size - 1) * 0.5;
  const cy = (size - 1) * 0.5;
  const half = size * 0.5;

  const vesselsDeep = new Float32Array(size * size);
  const vesselsSup = new Float32Array(size * size);

  const trunkAngles = [
    0.05, 0.20, 0.38, 1.25, 1.55, 2.80, 3.08, -0.12, -0.32, -1.28, -1.62, -2.78, -3.02, 3.14,
  ];

  for (let tIdx = 0; tIdx < trunkAngles.length; tIdx++) {
    const th0 = trunkAngles[tIdx];
    const nPts = 60;
    const phase1 = ((tIdx * 1.618) % 1) * Math.PI * 2;
    const phase2 = ((tIdx * 2.718) % 1) * Math.PI * 2;

    for (let i = 0; i < nPts; i++) {
      const tVal = i / (nPts - 1);
      const rCurve = 0.96 * (1.0 - tVal) + 0.44 * tVal;
      const thCurve =
        th0 +
        0.08 * Math.sin(Math.PI * 3.0 * tVal + phase1) +
        0.03 * Math.cos(Math.PI * 8.0 * tVal + phase2);
      const px = Math.round(cx + rCurve * half * Math.cos(thCurve));
      const py = Math.round(cy + rCurve * half * Math.sin(thCurve));
      const radPx = 2.2 * (1.0 - 0.55 * tVal);
      const iRad = Math.ceil(radPx) + 2;

      const x0 = Math.max(0, px - iRad);
      const x1 = Math.min(size, px + iRad + 1);
      const y0 = Math.max(0, py - iRad);
      const y1 = Math.min(size, py + iRad + 1);

      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const d2 = (sx - px) ** 2 + (sy - py) ** 2;
          const splat = Math.exp(-d2 / (2.0 * (radPx * 0.7) ** 2));
          const vIdx = sy * size + sx;
          if (splat > vesselsSup[vIdx]) vesselsSup[vIdx] = splat;
        }
      }

      if (i === 21 || i === 39) {
        const sideSign = (tIdx + i) % 2 === 0 ? 1.0 : -1.0;
        const branchPts = 30;
        for (let b = 0; b < branchPts; b++) {
          const tb = b / (branchPts - 1);
          const rb = rCurve * (1.0 - tb) + (rCurve - 0.18) * tb;
          const thb = thCurve + sideSign * 0.16 * tb + 0.04 * Math.sin(Math.PI * 4.0 * tb);
          const bpx = Math.round(cx + rb * half * Math.cos(thb));
          const bpy = Math.round(cy + rb * half * Math.sin(thb));
          const bradPx = 1.4 * (1.0 - 0.5 * tb);
          const biRad = Math.ceil(bradPx) + 1;

          const bx0 = Math.max(0, bpx - biRad);
          const bx1 = Math.min(size, bpx + biRad + 1);
          const by0 = Math.max(0, bpy - biRad);
          const by1 = Math.min(size, bpy + biRad + 1);

          for (let bsy = by0; bsy < by1; bsy++) {
            for (let bsx = bx0; bsx < bx1; bsx++) {
              const bd2 = (bsx - bpx) ** 2 + (bsy - bpy) ** 2;
              const bsplat = Math.exp(-bd2 / (2.0 * (bradPx * 0.6) ** 2));
              const bvIdx = bsy * size + bsx;
              if (bsplat * 0.85 > vesselsDeep[bvIdx]) vesselsDeep[bvIdx] = bsplat * 0.85;
            }
          }
        }
      }
    }
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const vIdx = y * size + x;
      const nx = (x - cx) / half;
      const ny = (y - cy) / half;
      const r = Math.hypot(nx, ny);
      const theta = Math.atan2(ny, nx);

      const ao = Math.max(0.72, Math.min(1.0, 1.0 - 0.24 * (r ** 2.2)));
      const horizBlush = 0.035 * (Math.cos(theta) ** 2) * Math.max(0, Math.min(1, (r - 0.35) / 0.55));

      const baseR = (0.95 + horizBlush) * ao;
      const baseG = (0.93 + 0.5 * horizBlush) * ao;
      const baseB = (0.91 - 0.5 * horizBlush) * ao;

      const arcade =
        Math.exp(-((r - 0.45) ** 2) / 0.001) *
        (0.5 + 0.5 * Math.cos(36 * theta + 0.5 * Math.sin(72 * theta)));
      const deepVal = Math.max(vesselsDeep[vIdx], arcade * 0.60);

      const corneaMask = Math.max(0.0, Math.min(1.0, (r - 0.42) / 0.04));
      const supVal = vesselsSup[vIdx] * corneaMask;
      const deepMasked = deepVal * corneaMask;

      const deepR = 0.72,
        deepG = 0.34,
        deepB = 0.34;
      const supR = 0.76,
        supG = 0.16,
        supB = 0.16;

      let R = baseR * (1.0 - deepMasked * 0.75) + deepR * (deepMasked * 0.75);
      let G = baseG * (1.0 - deepMasked * 0.75) + deepG * (deepMasked * 0.75);
      let B = baseB * (1.0 - deepMasked * 0.75) + deepB * (deepMasked * 0.75);

      R = R * (1.0 - supVal * 0.85) + supR * (supVal * 0.85);
      G = G * (1.0 - supVal * 0.85) + supG * (supVal * 0.85);
      B = B * (1.0 - supVal * 0.85) + supB * (supVal * 0.85);

      const limbusTransition = Math.exp(-((r - 0.43) ** 2) / 0.0015);
      R = R * (1.0 - 0.14 * limbusTransition) + 0.78 * (0.14 * limbusTransition);
      G = G * (1.0 - 0.12 * limbusTransition) + 0.82 * (0.12 * limbusTransition);
      B = B * (1.0 - 0.06 * limbusTransition) + 0.88 * (0.06 * limbusTransition);

      data[idx] = Math.round(Math.max(0, Math.min(255, R * 255)));
      data[idx + 1] = Math.round(Math.max(0, Math.min(255, G * 255)));
      data[idx + 2] = Math.round(Math.max(0, Math.min(255, B * 255)));
      data[idx + 3] = 255;
    }
  }
  return data;
}

export function getOrCreateIrisTexture(): THREE.DataTexture {
  if (!_cachedIrisTexture) {
    const data = generateProceduralIrisData(512);
    _cachedIrisTexture = new THREE.DataTexture(data as unknown as BufferSource, 512, 512, THREE.RGBAFormat);
    _cachedIrisTexture.needsUpdate = true;
    _cachedIrisTexture.colorSpace = THREE.SRGBColorSpace;
    _cachedIrisTexture.generateMipmaps = true;
    _cachedIrisTexture.minFilter = THREE.LinearMipmapLinearFilter;
    _cachedIrisTexture.magFilter = THREE.LinearFilter;
  }
  return _cachedIrisTexture;
}

export function getOrCreateIrisNormalTexture(): THREE.DataTexture {
  if (!_cachedIrisNormalTexture) {
    const data = generateProceduralIrisNormalData(512);
    _cachedIrisNormalTexture = new THREE.DataTexture(data as unknown as BufferSource, 512, 512, THREE.RGBAFormat);
    _cachedIrisNormalTexture.needsUpdate = true;
    _cachedIrisNormalTexture.generateMipmaps = true;
    _cachedIrisNormalTexture.minFilter = THREE.LinearMipmapLinearFilter;
    _cachedIrisNormalTexture.magFilter = THREE.LinearFilter;
  }
  return _cachedIrisNormalTexture;
}

export function getOrCreateScleraTexture(): THREE.DataTexture {
  if (!_cachedScleraTexture) {
    const data = generateProceduralScleraData(512);
    _cachedScleraTexture = new THREE.DataTexture(data as unknown as BufferSource, 512, 512, THREE.RGBAFormat);
    _cachedScleraTexture.needsUpdate = true;
    _cachedScleraTexture.colorSpace = THREE.SRGBColorSpace;
    _cachedScleraTexture.generateMipmaps = true;
    _cachedScleraTexture.minFilter = THREE.LinearMipmapLinearFilter;
    _cachedScleraTexture.magFilter = THREE.LinearFilter;
  }
  return _cachedScleraTexture;
}

/**
 * EyeAvatarEngine
 *
 * Real-time 3D ocular avatar and VOR kinematic rendering engine.
 */
export class EyeAvatarEngine {
  public static readonly IR_LIGHT_POS = new THREE.Vector3(0.02, 0.04, -0.16);
  public static readonly CAMERA_POS = new THREE.Vector3(0.0, 0.0, -0.165);
  public static readonly CORNEA_RADIUS = 0.0078; // 7.8 mm anatomical corneal curvature

  // Scene Graph
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer | null = null;
  public canvas: HTMLCanvasElement | null = null;

  // GLTF Node hierarchy references
  public root: THREE.Object3D | null = null;
  public eyeAvatarRoot: THREE.Object3D | null = null;
  public pivotR: THREE.Object3D | null = null;
  public pivotL: THREE.Object3D | null = null;
  public irisR: THREE.Mesh | null = null;
  public irisL: THREE.Mesh | null = null;
  public pupilR: THREE.Mesh | null = null;
  public pupilL: THREE.Mesh | null = null;
  public scleraGroupR: THREE.Group | null = null;
  public scleraGroupL: THREE.Group | null = null;
  public scleraR: THREE.Mesh | null = null;
  public scleraL: THREE.Mesh | null = null;
  public corneaR: THREE.Mesh | null = null;
  public corneaL: THREE.Mesh | null = null;

  public readonly initialPivotPosR = new THREE.Vector3(0.031, 0, 0);
  public readonly initialPivotPosL = new THREE.Vector3(-0.031, 0, 0);

  // Material registry for uniform updates
  private materials: THREE.Material[] = [];

  // Configuration & viewport
  private logicalWidth: number;
  private logicalHeight: number;
  private pixelRatio: number;
  private visualMode: VisualMode;
  private gazeMode: GazeMode;
  private readonly glbPath: string;
  private contextLostHandler: ((ev: Event) => void) | null = null;
  private contextRestoredHandler: (() => void) | null = null;

  // Kinematic state
  private readonly eyeAngle = { h: 0, v: 0, t: 0 };
  private readonly retinalSlip = { h: 0, v: 0, t: 0 };
  private isFastPhase = false;
  private saccadeTime = 0;
  private saccadeDuration = 0.030; // seconds
  private readonly saccadeStart = { h: 0, v: 0, t: 0 };
  private readonly saccadeTarget = { h: 0, v: 0, t: 0 };
  private timeSinceLastSaccade = 0;
  private currentTime = 0;
  private lastSpv = 0;
  private fastPhaseBeatDirection = 'None (Resting)';

  // Pupil responsiveness state
  private currentPupilScale = 1.0;
  private targetPupilScale = 1.0;

  // Telemetry caching
  private readonly ringBuffer = new NystagmogramRingBuffer(600);
  private readonly screenPupilR: ScreenCoord = { x: 0, y: 0, visible: false };
  private readonly screenPupilL: ScreenCoord = { x: 0, y: 0, visible: false };
  private readonly screenGlintR: ScreenCoord = { x: 0, y: 0, visible: false };
  private readonly screenGlintL: ScreenCoord = { x: 0, y: 0, visible: false };

  private readonly telemetryCache: EyeTelemetry = {
    horizontalDeg: 0,
    verticalDeg: 0,
    torsionalRightDeg: 0,
    torsionalLeftDeg: 0,
    slowPhaseVelocityDegPerSec: 0,
    fastPhaseBeatDirection: 'None (Resting)',
    isFastPhaseActive: false,
    pupilScreenR: { x: 0, y: 0, visible: false },
    pupilScreenL: { x: 0, y: 0, visible: false },
    glintScreenR: { x: 0, y: 0, visible: false },
    glintScreenL: { x: 0, y: 0, visible: false },
  };

  constructor(config?: EyeAvatarConfig) {
    this.logicalWidth = config?.logicalWidth || 640;
    this.logicalHeight = config?.logicalHeight || 360;
    this.pixelRatio = config?.pixelRatio || 1.0;
    this.visualMode = config?.visualMode || 'natural';
    this.gazeMode = config?.gazeMode || 'bilateral';
    this.glbPath = config?.glbPath || '/assets/iemap/eye_avatar.glb';

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(
      this.visualMode === 'infrared_vng' ? 0x050805 : 0x0e1117
    );

    // Setup anterior perspective camera looking down -Z optical axis
    const aspect = this.logicalWidth / this.logicalHeight;
    this.camera = new THREE.PerspectiveCamera(35, aspect, 0.01, 10.0);
    this.camera.position.copy(EyeAvatarEngine.CAMERA_POS);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateMatrixWorld(true);

    // Realistic Balanced Illumination
    // Ambient fill prevents pitch shadows while preserving 3D form
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.48);
    this.scene.add(ambientLight);

    // Warm key directional light produces crisp corneal specular glints
    const dirLight = new THREE.DirectionalLight(0xfffaf2, 1.05);
    dirLight.position.set(0.08, 0.18, -0.22);
    this.scene.add(dirLight);

    // Cool fill light balances medial/nasal sclera shading
    const rimLight = new THREE.DirectionalLight(0xdbeafe, 0.40);
    rimLight.position.set(-0.12, -0.06, -0.20);
    this.scene.add(rimLight);

    // Paraxial Purkinje glint point light
    const irPointLight = new THREE.PointLight(0xffffff, 0.85, 1.0);
    irPointLight.position.copy(EyeAvatarEngine.IR_LIGHT_POS);
    this.scene.add(irPointLight);

    // Initialize immediate procedural photorealistic eye avatar
    this.createProceduralEyeAvatar();

    if (config?.canvas) {
      this.attachCanvas(config.canvas);
    }
  }

  // ---------------------------------------------------------------------------
  // Static Mathematical & Kinematic Utilities
  // ---------------------------------------------------------------------------

  /**
   * Listing's Law Single-Axis Rotation Quaternion
   * For visual fixations and saccades, the rotation axis lies in Listing's plane
   * orthogonal to primary gaze (-Z). This strictly guarantees q.z === 0.
   *
   * @param yawDeg Horizontal gaze in degrees (positive = rightward)
   * @param pitchDeg Vertical gaze in degrees (positive = upward)
   * @param target Optional quaternion to store result
   */
  public static computeListingQuaternion(
    yawDeg: number,
    pitchDeg: number,
    target = new THREE.Quaternion()
  ): THREE.Quaternion {
    const yawRad = (yawDeg * Math.PI) / 180;
    const pitchRad = (pitchDeg * Math.PI) / 180;
    const theta = Math.hypot(pitchRad, yawRad);

    if (theta < 1e-6) {
      target.set(0, 0, 0, 1);
      return target;
    }

    const ux = pitchRad / theta;
    const uy = -yawRad / theta;
    const sinHalf = Math.sin(theta * 0.5);
    const cosHalf = Math.cos(theta * 0.5);

    target.set(ux * sinHalf, uy * sinHalf, 0, cosHalf);
    target.normalize();
    return target;
  }

  /**
   * Active Vestibular Cyclotorsion Quaternion
   * Active rotation around optical axis (-Z). Positive angle tilts the
   * 12 o'clock pole toward patient right (+X).
   *
   * @param torsionDeg Torsion in degrees (positive = right torsional)
   * @param target Optional quaternion to store result
   */
  public static computeTorsionQuaternion(
    torsionDeg: number,
    target = new THREE.Quaternion()
  ): THREE.Quaternion {
    const phiRad = (torsionDeg * Math.PI) / 180;
    const sinHalf = Math.sin(phiRad * 0.5);
    const cosHalf = Math.cos(phiRad * 0.5);

    target.set(0, 0, -sinHalf, cosHalf);
    target.normalize();
    return target;
  }

  /**
   * 3-DOF VOR Eye Orientation Quaternion
   * Violates Listing's Law via active cyclotorsion: q_eye = q_torsion * q_Listing
   */
  public static computeEyeQuaternion(
    yawDeg: number,
    pitchDeg: number,
    torsionDeg: number,
    target = new THREE.Quaternion()
  ): THREE.Quaternion {
    const qList = EyeAvatarEngine.computeListingQuaternion(yawDeg, pitchDeg, _qListing);
    const qTor = EyeAvatarEngine.computeTorsionQuaternion(torsionDeg, _qTorsion);
    target.multiplyQuaternions(qTor, qList);
    target.normalize();
    return target;
  }

  /**
   * Closed-form paraxial Purkinje glint reflection point on corneal dome
   */
  public static computePurkinjeGlint(
    corneaCenterWorld: THREE.Vector3,
    lightPos: THREE.Vector3 = EyeAvatarEngine.IR_LIGHT_POS,
    camPos: THREE.Vector3 = EyeAvatarEngine.CAMERA_POS,
    target = new THREE.Vector3()
  ): THREE.Vector3 {
    _vLightDir.subVectors(lightPos, corneaCenterWorld).normalize();
    _vCamDir.subVectors(camPos, corneaCenterWorld).normalize();
    _vHalf.addVectors(_vLightDir, _vCamDir).normalize();
    target.copy(corneaCenterWorld).addScaledVector(_vHalf, EyeAvatarEngine.CORNEA_RADIUS);
    return target;
  }

  /**
   * Clinical Near-Infrared Monochromatic Luminance
   * Transforms RGB to 850–940 nm NIR goggle response with high contrast stretch.
   */
  public static computeNirLuminance(r: number, g: number, b: number): number {
    const iNir = 0.299 * r + 0.587 * g + 0.114 * b;
    const t = Math.max(0.0, Math.min(1.0, (iNir - 0.12) / (0.88 - 0.12)));
    const iHigh = t * t * (3.0 - 2.0 * t);
    return Math.max(0.0, Math.min(1.0, iHigh));
  }

  /**
   * Minimum-Jerk Smoothstep Trajectory Profile (Flash & Hogan 1985)
   * h(sigma) = 10*sigma^3 - 15*sigma^4 + 6*sigma^5 for sigma in [0, 1].
   * Enforces zero initial and terminal velocity, acceleration, and jerk.
   */
  public static minimumJerkProfile(sigma: number): number {
    const s = Math.max(0, Math.min(1, sigma));
    const s3 = s * s * s;
    return s3 * (10 + s * (-15 + 6 * s));
  }

  /**
   * Derivative of minimum-jerk profile: dh/dsigma.
   * Peak derivative at sigma = 0.5 is exactly 1.875.
   */
  public static minimumJerkDerivative(sigma: number): number {
    const s = Math.max(0, Math.min(1, sigma));
    return 30 * s * s * (1 - 2 * s + s * s);
  }

  /**
   * Peak Saccade Velocity in brainstem burst range [400°/s, 700°/s]
   */
  public static computePeakSaccadeVelocity(
    displacementDeg: number,
    saccadeDurationSec: number
  ): number {
    if (saccadeDurationSec <= 0) return 400.0;
    const rawPeak = (Math.abs(displacementDeg) / saccadeDurationSec) * 1.875 * 1.6;
    return Math.max(400.0, Math.min(700.0, rawPeak));
  }

  /**
   * Clinical telemetry angle formatter with directional tokens
   */
  public static formatAngleReadout(
    angleDeg: number,
    axis: 'horizontal' | 'vertical' | 'torsional'
  ): string {
    const eps = 0.05;
    if (axis === 'horizontal') {
      if (angleDeg > eps) return `+${angleDeg.toFixed(1)}° (Right)`;
      if (angleDeg < -eps) return `${angleDeg.toFixed(1)}° (Left)`;
      return `0.0° (Center)`;
    }
    if (axis === 'vertical') {
      if (angleDeg > eps) return `+${angleDeg.toFixed(1)}° (Up)`;
      if (angleDeg < -eps) return `${angleDeg.toFixed(1)}° (Down)`;
      return `0.0° (Center)`;
    }
    if (angleDeg > eps) return `+${angleDeg.toFixed(1)}° (Right Torsion)`;
    if (angleDeg < -eps) return `${angleDeg.toFixed(1)}° (Left Torsion)`;
    return `0.0° (Neutral)`;
  }

  // ---------------------------------------------------------------------------
  // Asset Loading & Scene Graph Ingestion
  // ---------------------------------------------------------------------------

  /**
   * Primary asset loading method (alias for loadAvatar to satisfy interface requirements)
   */
  public async load(source?: string | ArrayBuffer): Promise<void> {
    return this.loadAvatar(source);
  }

  /**
   * Asynchronously loads eye avatar glTF asset from URL or ArrayBuffer
   */
  public async loadAvatar(source?: string | ArrayBuffer): Promise<void> {
    if (source instanceof ArrayBuffer) {
      return this.parseAvatar(source);
    }

    const targetUrl = typeof source === 'string' ? source : this.glbPath;
    const loader = new GLTFLoader();
    return new Promise((resolve, reject) => {
      loader.load(
        targetUrl,
        (gltf) => {
          this.setupSceneGraph(gltf);
          resolve();
        },
        undefined,
        (err) => reject(err)
      );
    });
  }

  /**
   * Ingest pre-loaded ArrayBuffer (used by headless tests and custom pipelines)
   */
  public async parseAvatar(arrayBuffer: ArrayBuffer): Promise<void> {
    const loader = new GLTFLoader();
    return new Promise((resolve, reject) => {
      loader.parse(
        arrayBuffer,
        '',
        (gltf) => {
          this.setupSceneGraph(gltf);
          resolve();
        },
        (err) => reject(err)
      );
    });
  }

  /**
   * Applies photorealistic ocular shaders and textures
   */
  private applyRealisticEyeMaterials(): void {
    const irisTexture = getOrCreateIrisTexture();
    const irisNormal = getOrCreateIrisNormalTexture();
    const scleraTexture = getOrCreateScleraTexture();

    // 1. Crystal-clear corneal dome with high-gloss specular highlight glint
    const corneaMatR = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.18,
      roughness: 0.02,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.01,
      ior: 1.336,
      depthWrite: false,
    });
    corneaMatR.name = 'Mat_EyeCornea_Realistic_R';

    const corneaMatL = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.18,
      roughness: 0.02,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.01,
      ior: 1.336,
      depthWrite: false,
    });
    corneaMatL.name = 'Mat_EyeCornea_Realistic_L';

    if (this.corneaR) {
      this.corneaR.material = corneaMatR;
      this.corneaR.renderOrder = 10;
    }
    if (this.corneaL) {
      this.corneaL.material = corneaMatL;
      this.corneaL.renderOrder = 10;
    }

    // 2. High-fidelity radial stroma iris with Crypts of Fuchs, Collarette & Limbal Ring
    if (this.irisR) {
      this.irisR.material = new THREE.MeshStandardMaterial({
        map: irisTexture,
        normalMap: irisNormal,
        roughness: 0.35,
        metalness: 0.02,
        transparent: true,
        side: THREE.DoubleSide,
      });
      this.irisR.material.name = 'Mat_EyeIris_Realistic_R';
    }
    if (this.irisL) {
      this.irisL.material = new THREE.MeshStandardMaterial({
        map: irisTexture,
        normalMap: irisNormal,
        roughness: 0.35,
        metalness: 0.02,
        transparent: true,
        side: THREE.DoubleSide,
      });
      this.irisL.material.name = 'Mat_EyeIris_Realistic_L';
    }

    // 3. Warm ivory sclera with branching microvasculature & perilimbal arcade
    if (this.scleraR) {
      this.scleraR.material = new THREE.MeshPhysicalMaterial({
        map: scleraTexture,
        roughness: 0.25,
        metalness: 0.0,
        clearcoat: 0.8,
        clearcoatRoughness: 0.12,
        side: THREE.FrontSide,
      });
      this.scleraR.material.name = 'Mat_EyeSclera_Realistic_R';
    }
    if (this.scleraL) {
      this.scleraL.material = new THREE.MeshPhysicalMaterial({
        map: scleraTexture,
        roughness: 0.25,
        metalness: 0.0,
        clearcoat: 0.8,
        clearcoatRoughness: 0.12,
        side: THREE.FrontSide,
      });
      this.scleraL.material.name = 'Mat_EyeSclera_Realistic_L';
    }

    // 4. Black pupil cavity
    if (this.pupilR) {
      this.pupilR.material = new THREE.MeshBasicMaterial({
        color: 0x010101,
        side: THREE.DoubleSide,
      });
      this.pupilR.material.name = 'Mat_EyePupil_Realistic_R';
    }
    if (this.pupilL) {
      this.pupilL.material = new THREE.MeshBasicMaterial({
        color: 0x010101,
        side: THREE.DoubleSide,
      });
      this.pupilL.material.name = 'Mat_EyePupil_Realistic_L';
    }
  }

  /**
   * Registers all meshes in this.materials and injects monochromatic NIR shader uniform
   */
  private registerMaterials(): void {
    if (!this.root) return;
    this.materials = [];
    this.root.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).material) {
        const mesh = child as THREE.Mesh;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
          if (this.materials.includes(mat)) {
            continue;
          }
          this.materials.push(mat);
          mat.userData.uInfraredMode = { value: this.visualMode === 'infrared_vng' ? 1.0 : 0.0 };

          if (!mat.userData.__nirInjected) {
            mat.userData.__nirInjected = true;
            const origCompile = mat.onBeforeCompile;
            mat.onBeforeCompile = (
              shader: THREE.WebGLProgramParametersWithUniforms,
              rend: THREE.WebGLRenderer
            ) => {
              if (origCompile) origCompile(shader, rend);
              shader.uniforms.uInfraredMode = mat.userData.uInfraredMode;
              shader.fragmentShader = `
                uniform float uInfraredMode;
                ${shader.fragmentShader}
              `;
              shader.fragmentShader = shader.fragmentShader.replace(
                '#include <dithering_fragment>',
                `
                #include <dithering_fragment>
                if (uInfraredMode > 0.5) {
                  float iNir = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
                  float iHigh = smoothstep(0.12, 0.88, iNir);
                  gl_FragColor = vec4(vec3(iHigh * 0.88, iHigh * 0.96, iHigh * 0.88), gl_FragColor.a);
                }
                `
              );
            };
            mat.needsUpdate = true;
          }
        }
      }
    });
  }

  /**
   * Immediate procedural fallback eye avatar (guarantees non-blank, realistic 3D eyes)
   */
  private createProceduralEyeAvatar(): void {
    if (this.root) return;

    this.eyeAvatarRoot = new THREE.Object3D();
    this.eyeAvatarRoot.name = 'EyeAvatarRoot';
    this.root = this.eyeAvatarRoot;
    this.scene.add(this.root);

    const makeEye = (side: 'R' | 'L', xPos: number) => {
      const pivot = new THREE.Object3D();
      pivot.name = `EyePivot_${side}`;
      pivot.position.set(xPos, 0, 0);
      this.eyeAvatarRoot!.add(pivot);

      // Sclera mesh: 24.0 mm diameter sphere (R = 12.0 mm)
      const scleraGeom = new THREE.SphereGeometry(0.012, 32, 24);
      // Map polar UV coordinates from anterior pole (0, 0, -0.012)
      const sPos = scleraGeom.getAttribute('position');
      const sUvs = scleraGeom.getAttribute('uv');
      for (let i = 0; i < sPos.count; i++) {
        const x = sPos.getX(i);
        const y = sPos.getY(i);
        const u = 0.5 + x / (2.05 * 0.012);
        const v = 0.5 + y / (2.05 * 0.012);
        sUvs.setXY(i, u, v);
      }
      sUvs.needsUpdate = true;
      const scleraMesh = new THREE.Mesh(scleraGeom);
      scleraMesh.name = `GEO-head_sculpting_realisticsclera${side}001`;
      pivot.add(scleraMesh);

      // Cornea mesh: anterior dome extending to z = -0.0120 m (-12.0 mm) facing camera (-Z)
      const R_c = EyeAvatarEngine.CORNEA_RADIUS;
      const thetaLen = Math.PI * 0.38;
      const corneaGeom = new THREE.SphereGeometry(
        R_c,
        32,
        16,
        0,
        Math.PI * 2,
        0,
        thetaLen
      );
      corneaGeom.rotateX(-Math.PI / 2);
      corneaGeom.translate(0, 0, -0.0042);
      const corneaMesh = new THREE.Mesh(corneaGeom);
      corneaMesh.name = `GEO-head_sculpting_realisticsclera${side}001_1`;
      pivot.add(corneaMesh);

      // Iris mesh: disk located at z = -0.0092 mm with normal facing camera (-Z)
      const irisGeom = new THREE.RingGeometry(0.0018, 0.0060, 32);
      irisGeom.rotateY(Math.PI);
      irisGeom.translate(0, 0, -0.0092);
      const irisMesh = new THREE.Mesh(irisGeom);
      irisMesh.name = `Iris_${side}`;
      pivot.add(irisMesh);

      // Pupil backing: circular aperture disk at z = -0.0091 mm with normal facing camera (-Z)
      const pupilGeom = new THREE.CircleGeometry(0.0022, 32);
      pupilGeom.rotateY(Math.PI);
      pupilGeom.translate(0, 0, -0.0091);
      const pupilMesh = new THREE.Mesh(pupilGeom);
      pupilMesh.name = `PupilBacking_${side}`;
      pivot.add(pupilMesh);

      if (side === 'R') {
        this.pivotR = pivot;
        this.initialPivotPosR.copy(pivot.position);
        this.scleraR = scleraMesh;
        this.corneaR = corneaMesh;
        this.irisR = irisMesh;
        this.pupilR = pupilMesh;
      } else {
        this.pivotL = pivot;
        this.initialPivotPosL.copy(pivot.position);
        this.scleraL = scleraMesh;
        this.corneaL = corneaMesh;
        this.irisL = irisMesh;
        this.pupilL = pupilMesh;
      }
    };

    makeEye('R', 0.031);
    makeEye('L', -0.031);

    this.applyRealisticEyeMaterials();
    this.registerMaterials();

    this.scene.updateMatrixWorld(true);
    this.updateScreenCoordinates();
  }

  /**
   * Traverses and binds GLTF node hierarchy
   */
  public setupSceneGraph(gltf: GLTF): void {
    if (this.root && this.root.parent) {
      this.scene.remove(this.root);
      this.root.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          (child as THREE.Mesh).geometry?.dispose();
        }
      });
    }

    this.root = gltf.scene;
    this.scene.add(this.root);

    this.root.traverse((child) => {
      const name = child.name;

      if (name === 'EyeAvatarRoot') {
        this.eyeAvatarRoot = child;
      } else if (name === 'EyePivot_R') {
        this.pivotR = child;
        this.initialPivotPosR.copy(child.position);
      } else if (name === 'EyePivot_L') {
        this.pivotL = child;
        this.initialPivotPosL.copy(child.position);
      } else if (name === 'Iris_R') {
        this.irisR = child as THREE.Mesh;
      } else if (name === 'Iris_L') {
        this.irisL = child as THREE.Mesh;
      } else if (name === 'PupilBacking_R') {
        this.pupilR = child as THREE.Mesh;
      } else if (name === 'PupilBacking_L') {
        this.pupilL = child as THREE.Mesh;
      } else if (name === 'Sclera_R') {
        this.scleraGroupR = child as THREE.Group;
      } else if (name === 'Sclera_L') {
        this.scleraGroupL = child as THREE.Group;
      } else if (name === 'GEO-head_sculpting_realisticscleraR001_1') {
        this.corneaR = child as THREE.Mesh;
      } else if (name === 'GEO-head_sculpting_realisticscleraL001_1') {
        this.corneaL = child as THREE.Mesh;
      } else if (name === 'GEO-head_sculpting_realisticscleraR001') {
        this.scleraR = child as THREE.Mesh;
      } else if (name === 'GEO-head_sculpting_realisticscleraL001') {
        this.scleraL = child as THREE.Mesh;
      }
    });

    this.applyRealisticEyeMaterials();
    this.registerMaterials();

    this.scene.updateMatrixWorld(true);
    this.updateScreenCoordinates();
  }

  // ---------------------------------------------------------------------------
  // 60fps Kinematics & Simulation Loop (Strict Zero Allocations)
  // ---------------------------------------------------------------------------

  /**
   * Advances simulation step: accumulates slow phase slip, triggers saccadic resets,
   * updates Listing's Law quaternions, and writes to scalar telemetry ring buffer.
   */
  public update(dt: number, vestibularTelemetry?: VestibularTelemetryState | null): void {
    const safeDt = Math.max(0.0001, Math.min(0.1, dt));
    this.currentTime += safeDt;

    const telem = vestibularTelemetry || ({} as Partial<VestibularTelemetryState>);
    const cupulaDeflection = Math.abs(telem.cupulaDeflectionNormalized || 0);
    const spv = telem.slowPhaseVelocityDegPerSec || {
      horizontal: 0,
      vertical: 0,
      torsional: 0,
    };
    const spvMag = Math.hypot(spv.horizontal, spv.vertical, spv.torsional);
    this.lastSpv = spvMag;
    this.fastPhaseBeatDirection = telem.fastPhaseBeatDirection || 'None (Resting)';

    if (this.isFastPhase) {
      // -----------------------------------------------------------------------
      // Fast Phase: Ballistic Minimum-Jerk Saccadic Reset
      // -----------------------------------------------------------------------
      this.saccadeTime += safeDt;
      const sigma = Math.min(1.0, this.saccadeTime / this.saccadeDuration);
      const h = EyeAvatarEngine.minimumJerkProfile(sigma);

      this.eyeAngle.h = this.saccadeStart.h + (this.saccadeTarget.h - this.saccadeStart.h) * h;
      this.eyeAngle.v = this.saccadeStart.v + (this.saccadeTarget.v - this.saccadeStart.v) * h;
      this.eyeAngle.t = this.saccadeStart.t + (this.saccadeTarget.t - this.saccadeStart.t) * h;

      if (sigma >= 1.0) {
        this.isFastPhase = false;
        this.timeSinceLastSaccade = 0;
        this.retinalSlip.h = 0;
        this.retinalSlip.v = 0;
        this.retinalSlip.t = 0;
      }
    } else {
      // -----------------------------------------------------------------------
      // Slow Phase Drift or Neural Integrator Decay
      // -----------------------------------------------------------------------
      this.timeSinceLastSaccade += safeDt;

      const hasVestibularDrive = (cupulaDeflection > 0.08 || spvMag > 0.5) && spvMag > 0.1;

      if (hasVestibularDrive) {
        // Active vestibular drive
        this.retinalSlip.h += spv.horizontal * safeDt;
        this.retinalSlip.v += spv.vertical * safeDt;
        this.retinalSlip.t += spv.torsional * safeDt;

        this.eyeAngle.h += spv.horizontal * safeDt;
        this.eyeAngle.v += spv.vertical * safeDt;
        this.eyeAngle.t += spv.torsional * safeDt;

        const slipMag = Math.hypot(this.retinalSlip.h, this.retinalSlip.v, this.retinalSlip.t);
        const threshold = Math.max(3.0, Math.min(6.0, 3.5 + 2.5 * cupulaDeflection));
        const timeout = 0.200 + 0.150 * (1.0 - Math.min(1.0, cupulaDeflection));

        const shouldTriggerThreshold = slipMag >= threshold;
        const shouldTriggerTimeout = this.timeSinceLastSaccade >= timeout && slipMag >= 1.0;

        if (shouldTriggerThreshold || shouldTriggerTimeout) {
          // Trigger ballistic saccade
          this.isFastPhase = true;
          this.saccadeTime = 0;
          this.saccadeDuration = Math.max(0.025, Math.min(0.040, 0.020 + 0.0025 * slipMag));

          this.saccadeStart.h = this.eyeAngle.h;
          this.saccadeStart.v = this.eyeAngle.v;
          this.saccadeStart.t = this.eyeAngle.t;

          // Target: anti-parallel reset with slight physiological overshoot (-10%)
          this.saccadeTarget.h = -0.10 * this.saccadeStart.h;
          this.saccadeTarget.v = -0.10 * this.saccadeStart.v;
          this.saccadeTarget.t = -0.10 * this.saccadeStart.t;
        }
      } else {
        // Brainstem neural integrator elastic leak: tau = 0.8 s
        const decay = Math.exp(-safeDt / 0.8);
        this.eyeAngle.h *= decay;
        this.eyeAngle.v *= decay;
        this.eyeAngle.t *= decay;
        this.retinalSlip.h *= decay;
        this.retinalSlip.v *= decay;
        this.retinalSlip.t *= decay;

        if (Math.hypot(this.eyeAngle.h, this.eyeAngle.v, this.eyeAngle.t) < 0.001) {
          this.eyeAngle.h = 0;
          this.eyeAngle.v = 0;
          this.eyeAngle.t = 0;
          this.retinalSlip.h = 0;
          this.retinalSlip.v = 0;
          this.retinalSlip.t = 0;
        }
      }
    }

    // -------------------------------------------------------------------------
    // Compute 3-DOF Listing's Law & VOR Quaternions
    // -------------------------------------------------------------------------
    EyeAvatarEngine.computeEyeQuaternion(
      this.eyeAngle.h,
      this.eyeAngle.v,
      this.eyeAngle.t,
      _qEyeR
    );
    EyeAvatarEngine.computeEyeQuaternion(
      this.eyeAngle.h,
      this.eyeAngle.v,
      this.eyeAngle.t,
      _qEyeL
    );

    // Apply to pivot transforms respecting gaze mode
    if (this.pivotR) {
      if (this.gazeMode === 'bilateral' || this.gazeMode === 'right_only') {
        this.pivotR.quaternion.copy(_qEyeR);
      } else {
        this.pivotR.quaternion.identity();
      }
      this.pivotR.position.copy(this.initialPivotPosR);
    }

    if (this.pivotL) {
      if (this.gazeMode === 'bilateral' || this.gazeMode === 'left_only') {
        this.pivotL.quaternion.copy(_qEyeL);
      } else {
        this.pivotL.quaternion.identity();
      }
      this.pivotL.position.copy(this.initialPivotPosL);
    }

    // Dynamic Pupil Responsiveness: Hippus, light adaptation & sympathetic dilation
    const basePupilTarget = this.visualMode === 'infrared_vng' ? 1.35 : 1.0;
    const hippus = 1.0 + 0.028 * Math.sin(this.currentTime * 1.7) + 0.014 * Math.sin(this.currentTime * 3.4);
    const saccadeDilation = this.isFastPhase ? 1.08 : 1.0;
    this.targetPupilScale = basePupilTarget * hippus * saccadeDilation;
    this.currentPupilScale += (this.targetPupilScale - this.currentPupilScale) * (1.0 - Math.exp(-safeDt * 7.0));

    if (this.pupilR) {
      this.pupilR.scale.set(this.currentPupilScale, this.currentPupilScale, 1.0);
    }
    if (this.pupilL) {
      this.pupilL.scale.set(this.currentPupilScale, this.currentPupilScale, 1.0);
    }

    // Update screen coordinates & telemetry
    this.updateScreenCoordinates();

    // Push scalars to rolling ring buffer (ZERO heap allocations)
    this.ringBuffer.push(
      this.currentTime,
      this.eyeAngle.h,
      this.eyeAngle.v,
      this.eyeAngle.t,
      this.lastSpv,
      this.isFastPhase
    );
  }

  // ---------------------------------------------------------------------------
  // Viewport & Screen Projection
  // ---------------------------------------------------------------------------

  private updateScreenCoordinates(): void {
    if (this.pivotR) {
      _vPupilWorldR.copy(_vPupilLocal).applyQuaternion(this.pivotR.quaternion).add(this.pivotR.position);
      this.projectToScreen(_vPupilWorldR, this.screenPupilR);

      _vCorneaCenterWorldR.copy(_vCorneaCenterLocal).applyQuaternion(this.pivotR.quaternion).add(this.pivotR.position);
      EyeAvatarEngine.computePurkinjeGlint(_vCorneaCenterWorldR, EyeAvatarEngine.IR_LIGHT_POS, this.camera.position, _vGlintWorldR);
      this.projectToScreen(_vGlintWorldR, this.screenGlintR);
    }

    if (this.pivotL) {
      _vPupilWorldL.copy(_vPupilLocal).applyQuaternion(this.pivotL.quaternion).add(this.pivotL.position);
      this.projectToScreen(_vPupilWorldL, this.screenPupilL);

      _vCorneaCenterWorldL.copy(_vCorneaCenterLocal).applyQuaternion(this.pivotL.quaternion).add(this.pivotL.position);
      EyeAvatarEngine.computePurkinjeGlint(_vCorneaCenterWorldL, EyeAvatarEngine.IR_LIGHT_POS, this.camera.position, _vGlintWorldL);
      this.projectToScreen(_vGlintWorldL, this.screenGlintL);
    }
  }

  private projectToScreen(worldPos: THREE.Vector3, out: ScreenCoord): void {
    _vScreenPos.copy(worldPos).project(this.camera);
    out.x = ((_vScreenPos.x + 1.0) * 0.5) * this.logicalWidth;
    out.y = ((-_vScreenPos.y + 1.0) * 0.5) * this.logicalHeight;
    out.visible = _vScreenPos.z > -1.0 && _vScreenPos.z < 1.0;
  }

  // ---------------------------------------------------------------------------
  // Public Telemetry & Control API
  // ---------------------------------------------------------------------------

  /**
   * Retrieves current eye telemetry. Updates target object in-place (0 allocations).
   */
  public getTelemetry(target?: EyeTelemetry): EyeTelemetry {
    const t = target || this.telemetryCache;
    t.horizontalDeg = this.eyeAngle.h;
    t.verticalDeg = this.eyeAngle.v;
    t.torsionalRightDeg = this.eyeAngle.t;
    t.torsionalLeftDeg = this.eyeAngle.t;
    t.slowPhaseVelocityDegPerSec = this.lastSpv;
    t.fastPhaseBeatDirection = this.fastPhaseBeatDirection;
    t.isFastPhaseActive = this.isFastPhase;

    t.pupilScreenR.x = this.screenPupilR.x;
    t.pupilScreenR.y = this.screenPupilR.y;
    t.pupilScreenR.visible = this.screenPupilR.visible;

    t.pupilScreenL.x = this.screenPupilL.x;
    t.pupilScreenL.y = this.screenPupilL.y;
    t.pupilScreenL.visible = this.screenPupilL.visible;

    t.glintScreenR.x = this.screenGlintR.x;
    t.glintScreenR.y = this.screenGlintR.y;
    t.glintScreenR.visible = this.screenGlintR.visible;

    t.glintScreenL.x = this.screenGlintL.x;
    t.glintScreenL.y = this.screenGlintL.y;
    t.glintScreenL.visible = this.screenGlintL.visible;

    return t;
  }

  public getRingBuffer(): NystagmogramRingBuffer {
    return this.ringBuffer;
  }

  public getEyeAngle(target?: { h: number; v: number; t: number }): { h: number; v: number; t: number } {
    if (target) {
      target.h = this.eyeAngle.h;
      target.v = this.eyeAngle.v;
      target.t = this.eyeAngle.t;
      return target;
    }
    return { ...this.eyeAngle };
  }

  public getRetinalSlip(target?: { h: number; v: number; t: number }): { h: number; v: number; t: number } {
    if (target) {
      target.h = this.retinalSlip.h;
      target.v = this.retinalSlip.v;
      target.t = this.retinalSlip.t;
      return target;
    }
    return { ...this.retinalSlip };
  }

  public getIsFastPhase(): boolean {
    return this.isFastPhase;
  }

  public getSaccadeDuration(): number {
    return this.saccadeDuration;
  }

  /**
   * Directly drives instantaneous gaze angles and screen projections (for high-speed vHIT trials)
   */
  public setGazeAngles(hDeg: number, vDeg: number, tDeg = 0, isFastPhase = false): void {
    this.eyeAngle.h = hDeg;
    this.eyeAngle.v = vDeg;
    this.eyeAngle.t = tDeg;
    this.isFastPhase = isFastPhase;

    EyeAvatarEngine.computeEyeQuaternion(this.eyeAngle.h, this.eyeAngle.v, this.eyeAngle.t, _qEyeR);
    EyeAvatarEngine.computeEyeQuaternion(this.eyeAngle.h, this.eyeAngle.v, this.eyeAngle.t, _qEyeL);

    if (this.pivotR) {
      if (this.gazeMode === 'bilateral' || this.gazeMode === 'right_only') {
        this.pivotR.quaternion.copy(_qEyeR);
      } else {
        this.pivotR.quaternion.identity();
      }
      this.pivotR.position.copy(this.initialPivotPosR);
    }

    if (this.pivotL) {
      if (this.gazeMode === 'bilateral' || this.gazeMode === 'left_only') {
        this.pivotL.quaternion.copy(_qEyeL);
      } else {
        this.pivotL.quaternion.identity();
      }
      this.pivotL.position.copy(this.initialPivotPosL);
    }

    if (this.pupilR) {
      this.pupilR.scale.set(this.currentPupilScale, this.currentPupilScale, 1.0);
    }
    if (this.pupilL) {
      this.pupilL.scale.set(this.currentPupilScale, this.currentPupilScale, 1.0);
    }

    this.updateScreenCoordinates();
  }

  public setVisualMode(mode: VisualMode): void {
    this.visualMode = mode;
    this.targetPupilScale = mode === 'infrared_vng' ? 1.35 : 1.0;
    this.scene.background = new THREE.Color(
      mode === 'infrared_vng' ? 0x050805 : 0x0e1117
    );

    const uniformVal = mode === 'infrared_vng' ? 1.0 : 0.0;
    for (const mat of this.materials) {
      if (mat.userData.uInfraredMode) {
        mat.userData.uInfraredMode.value = uniformVal;
      }
    }
  }

  public setGazeMode(mode: GazeMode): void {
    this.gazeMode = mode;
  }

  public attachCanvas(canvas: HTMLCanvasElement): void {
    if (this.canvas && this.contextLostHandler) {
      this.canvas.removeEventListener('webglcontextlost', this.contextLostHandler);
      this.contextLostHandler = null;
    }
    if (this.canvas && this.contextRestoredHandler) {
      this.canvas.removeEventListener('webglcontextrestored', this.contextRestoredHandler);
      this.contextRestoredHandler = null;
    }

    this.canvas = canvas;
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        powerPreference: 'high-performance',
      });
      this.renderer.setPixelRatio(this.pixelRatio);
      this.renderer.setSize(this.logicalWidth, this.logicalHeight, false);

      this.contextLostHandler = (ev: Event) => {
        ev.preventDefault();
        console.warn('EyeAvatarEngine: WebGL context lost.');
      };
      this.contextRestoredHandler = () => {
        console.info('EyeAvatarEngine: WebGL context restored.');
        if (this.renderer) {
          this.renderer.setSize(this.logicalWidth, this.logicalHeight, false);
        }
      };
      this.canvas.addEventListener('webglcontextlost', this.contextLostHandler, false);
      this.canvas.addEventListener('webglcontextrestored', this.contextRestoredHandler, false);
    } catch {
      this.renderer = null;
    }
  }

  public resize(logicalWidth: number, logicalHeight: number): void {
    this.logicalWidth = logicalWidth;
    this.logicalHeight = logicalHeight;
    this.camera.aspect = logicalWidth / logicalHeight;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld(true);

    if (this.renderer) {
      this.renderer.setSize(logicalWidth, logicalHeight, false);
    }
    this.updateScreenCoordinates();
  }

  public render(): void {
    if (this.renderer) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  public dispose(): void {
    if (this.canvas) {
      if (this.contextLostHandler) {
        this.canvas.removeEventListener('webglcontextlost', this.contextLostHandler);
        this.contextLostHandler = null;
      }
      if (this.contextRestoredHandler) {
        this.canvas.removeEventListener('webglcontextrestored', this.contextRestoredHandler);
        this.contextRestoredHandler = null;
      }
    }
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
    for (const mat of this.materials) {
      mat.dispose();
    }
    this.materials = [];
    if (this.root) {
      this.root.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          (child as THREE.Mesh).geometry?.dispose();
        }
      });
      this.scene.remove(this.root);
      this.root = null;
    }
    this.eyeAvatarRoot = null;
    this.pivotR = null;
    this.pivotL = null;
    this.irisR = null;
    this.irisL = null;
    this.pupilR = null;
    this.pupilL = null;
    this.scleraGroupR = null;
    this.scleraGroupL = null;
    this.scleraR = null;
    this.scleraL = null;
    this.corneaR = null;
    this.corneaL = null;
    this.canvas = null;
  }
}
