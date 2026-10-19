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
const _vTemp = new THREE.Vector3();

/**
 * EyeAvatarEngine
 *
 * Real-time 3D ocular avatar and VOR kinematic rendering engine.
 */
export class EyeAvatarEngine {
  public static readonly IR_LIGHT_POS = new THREE.Vector3(0.02, 0.04, -0.20);
  public static readonly CAMERA_POS = new THREE.Vector3(0.0, 0.0, -0.22);
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

    // Illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(0.05, 0.15, -0.25);
    this.scene.add(dirLight);

    const irPointLight = new THREE.PointLight(0xffffff, 0.8, 1.0);
    irPointLight.position.copy(EyeAvatarEngine.IR_LIGHT_POS);
    this.scene.add(irPointLight);

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
   * Traverses and binds GLTF node hierarchy
   */
  public setupSceneGraph(gltf: GLTF): void {
    if (this.root && this.root.parent) {
      this.scene.remove(this.root);
    }

    this.root = gltf.scene;
    this.scene.add(this.root);
    this.materials = [];

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

      // Configure materials for NIR shader uniform updates (strictly deduplicated)
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
            mat.onBeforeCompile = (shader: THREE.WebGLProgramParametersWithUniforms, rend: THREE.WebGLRenderer) => {
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

      if (cupulaDeflection > 0.12 && spvMag > 0.1) {
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

  public setVisualMode(mode: VisualMode): void {
    this.visualMode = mode;
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
