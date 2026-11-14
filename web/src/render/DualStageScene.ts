import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  DISSECTION_PRESETS,
  IEMAP_STRUCTURES,
  KEY_STRUCTURE_MESH_NAMES,
  LAB_PRESETS,
  StructureOntologyItem,
  SystemGroupId,
  VisibilityState,
} from '../data/ontology';
import { fetchObjGeometry } from '../data/objLoader';
import {
  createGate3StructureMaterial,
  updateGate3MaterialState,
} from './gate3Materials';
import {
  computeMeshGreenwoodX,
  getCoordinatesForFrequency,
  greenwoodFrequency,
  greenwoodPosition,
  interpolateGreenwoodXFromIntersection,
} from '../data/greenwoodEngine';
import {
  RadiologyPlaneId,
  CTWindowMode,
  RADIOLOGY_PLANES,
  SCDS_PARAMETERS,
  getShaderClipUniforms,
} from '../data/radiologyEngine';
import {
  getLoadedRadiologyVolume,
  MPR_FOV_MM,
  onRadiologyVolumeReady,
  preloadRadiologyVolumes,
  resliceVolumeToRGBA,
} from '../data/radiologyVolume';
import {
  loadAllCanalPaths,
  type CanalId,
} from '../data/canalPaths';
import {
  VestibularDynamicsEngine,
  type VestibularTelemetryState,
} from '../physics/vestibularEngine';
import {
  computeVHITHeadQuaternion,
  type VHITCanalPair,
  type CaloricConvectionState,
} from '../physics/diagnosticVestibularEngine';
import {
  type Gate3ShaderUniforms,
  getGreenwoodColor,
} from './gate3Materials';
import {
  type SurgicalProcedure,
  type CIArrayType,
  type CIApproach,
  type KoosStage,
  type CIInsertionState,
  type LabyrinthectomyState,
  type NeurectomyState,
  SURGICAL_CAMERA_PERSPECTIVES,
  SURGICAL_LANDMARKS,
  computeCIInsertionKinematics,
  computeLabyrinthectomyAblation,
  computeNeurectomyElectrophysiology,
  evaluateScalaTympaniSpline,
} from '../physics/surgicalEngine';

export interface IVORDrawerTarget {
  getIsOpen(): boolean;
  updateTelemetry(telem: VestibularTelemetryState, simDt: number): void;
  clearVHITPlayback(): void;
  updateVHITPlayback(elapsed: number, ms: number, pair?: 'horizontal' | 'ralp' | 'larp', direction?: 1 | -1): void;
  getVHITBuffer(): {
    headVelArray: Float32Array;
    invertedEyeVelArray: Float32Array;
    saccadeFlags: Uint8Array;
    cn8FiringRateArray: Float32Array;
  } | null;
}

export interface ISurgicalDrawerTarget {
  updateTelemetry(state: SurgicalLabState): void;
}

export type SurgicalStateCallback = (state: SurgicalLabState) => void;

interface PinCandidate {
  pin: ProjectedPin2D;
  priority: number;
  maxDist: number;
  depth: number;
}

export type LabelDensityMode = 'off' | 'key' | 'all';
export type ReadingDepth = 'simple' | 'detailed';
export type LabMode = 'anatomy' | 'hearing' | 'vestibular' | 'radiology' | 'surgical';

export interface SurgicalLabState {
  activeProcedure: SurgicalProcedure;
  ciState: CIInsertionState;
  labyState: LabyrinthectomyState;
  neurectomyState: NeurectomyState;
}

export interface HearingLabState {
  activeFrequency: number;
  activeGreenwoodX: number;
  isPlaying: boolean;
  activePresetId: string | null;
  lossSector: [number, number] | null;
}

export interface RadiologyLabState {
  activePlane: RadiologyPlaneId;
  sliceDepthMm: number;
  clipInverted: boolean;
  showPlaneHelper: boolean;
  scdsActive: boolean;
  windowMode: CTWindowMode;
}

export interface ProjectedPin2D {
  id: string;
  rawId: string;
  label: string;
  sublabel: string;
  category: 'structure';
  colorHex: string;
  screenX: number;
  screenY: number;
  visible: boolean;
  occluded: boolean;
  meshName: string;
}

export interface LabSceneSnapshot {
  labMode: LabMode;
  hearingState: HearingLabState;
  radiologyState: RadiologyLabState;
  surgicalState: SurgicalLabState;
  selectedMesh: string | null;
  hoveredMesh: string | null;
  visibilityMap: Record<string, VisibilityState>;
  bonyPeelPercent: number;
  explodePercent: number;
  labelMode: LabelDensityMode;
  readingDepth: ReadingDepth;
  activePresetId: string;
  canUndo: boolean;
  isIsolated: boolean;
  loadingProgress: number;
  loadingCompletedCount: number;
  loadingTotalCount: number;
  loadingItemLabel: string;
  isLoaded: boolean;
}

interface MeshEntry {
  ontology: StructureOntologyItem;
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  tetherLine: THREE.Line;
  tetherPositions: Float32Array;
}

export class DualStageScene {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private envRenderTarget: THREE.WebGLRenderTarget | null = null;
  private isLightTheme = false;
  private isReducedMotion = false;
  private motionMql: MediaQueryList | null = null;
  private onMotionChangeBound?: () => void;

  // Stage Lighting & Helper Refs
  private ambientLight!: THREE.AmbientLight;
  private dirKeyLight!: THREE.DirectionalLight;
  private dirFillLight!: THREE.DirectionalLight;
  private dirRimLight!: THREE.DirectionalLight;
  private radPlaneQuadMat: THREE.MeshBasicMaterial | null = null;
  private radPlaneEdgeMat: THREE.LineBasicMaterial | null = null;
  private radPlaneCrossMat: THREE.LineBasicMaterial | null = null;

  // Sidebar / Bottom-Sheet Viewport Framing Insets
  private targetLeftInset = 0;
  private targetBottomInset = 0;
  private currentLeftInset = 0;
  private currentBottomInset = 0;
  private appliedOffsetX = 0;
  private appliedOffsetY = 0;
  private appliedViewW = 0;
  private appliedViewH = 0;

  // Single-Stage WebGL Full-Screen Canvas Scene
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private labyrinthRoot: THREE.Group;

  private meshEntries: Map<string, MeshEntry> = new Map();
  private pickableMeshes: THREE.Mesh[] = [];

  // Smooth Camera Fly-To Animation
  private flyAnim: {
    active: boolean;
    startTime: number;
    durationMs: number;
    fromPos: THREE.Vector3;
    toPos: THREE.Vector3;
    fromTarget: THREE.Vector3;
    toTarget: THREE.Vector3;
    fromUp?: THREE.Vector3;
    toUp?: THREE.Vector3;
  } | null = null;

  // Undo History Stack for Dissection Operations
  private undoStack: Array<Record<string, VisibilityState>> = [];

  // Tonotopy Cursor & Saved Anatomy State
  private tonotopyCursorMesh: THREE.Mesh | null = null;
  private tonotopyHaloMesh: THREE.Mesh | null = null;
  private readonly scratchBeaconColor = new THREE.Color();
  private readonly scratchWhiteColor = new THREE.Color(0xffffff);
  private savedAnatomyState: {
    visibilityMap: Record<string, VisibilityState>;
    bonyPeelPercent: number;
    cameraPos: THREE.Vector3;
    controlsTarget: THREE.Vector3;
    cameraUp: THREE.Vector3;
  } | null = null;
  private lossRangeVector = new THREE.Vector2(0, 0);
  private onHearingToneRequestCallbacks: Array<(freqHz: number) => void> = [];
  private static readonly DUMMY_CLIP_NORMAL = new THREE.Vector3(0, 0, -1);
  private tempRendererSize = new THREE.Vector2();
  private tempNDC = new THREE.Vector2();
  private scratchPinVector = new THREE.Vector3();

  // Pin projection pre-allocated buffers
  private pinCandidates: PinCandidate[] = [];
  private activeCandidates: PinCandidate[] = [];
  private static readonly comparePinCandidates = (
    a: PinCandidate,
    b: PinCandidate
  ): number => (a.priority - b.priority) || (a.depth - b.depth);
  private acceptedBoxes: Array<{ x: number; y: number; w: number; h: number }> = Array.from(
    { length: 32 },
    () => ({ x: 0, y: 0, w: 0, h: 0 })
  );
  private acceptedBoxCount = 0;
  private projectedPinResults: ProjectedPin2D[] = [];

  // DOM Event Listener references for complete disposal
  private isDisposed = false;
  private handleContextLostBound?: (event: Event) => void;
  private handleContextRestoredBound?: () => void;
  private onPointerDownBound?: (ev: PointerEvent) => void;
  private onPointerMoveBound?: (ev: PointerEvent) => void;
  private onPointerUpBound?: (ev: PointerEvent) => void;
  private onPointerCancelBound?: (ev: PointerEvent) => void;
  private onDblClickBound?: (ev: MouseEvent) => void;

  // Radiology 3D Helpers & SCDS Visualizer
  private radiologyPlaneHelperGroup: THREE.Group | null = null;
  private scdsVisualizerGroup: THREE.Group | null = null;
  private scdsWaveArcs: Array<{ mesh: THREE.Mesh; initialScale: number; phaseOffset: number }> = [];
  private clipNormalVec = new THREE.Vector3(0, 0, 1);
  private tempPlaneMatrix = new THREE.Matrix4();
  private tempBasisX = new THREE.Vector3();
  private tempBasisY = new THREE.Vector3();
  private tempBasisZ = new THREE.Vector3();
  private static readonly RAD_TEXTURE_SIZE = 192;
  private radSliceData: Uint8Array<ArrayBuffer> | null = null;
  private radSliceTexture: THREE.DataTexture | null = null;
  private radSliceHasVolume = false;
  private unsubRadVolumeReady: (() => void) | null = null;

  // Vestibular Dynamics Engine & 3D Otoconial Cloud
  private vestibularEngine: VestibularDynamicsEngine | null = null;
  private otoconiaGroup: THREE.Group | null = null;
  private otoconiaMeshes: THREE.Mesh[] = [];
  private vorDrawer: IVORDrawerTarget | null = null;
  private currentYaw = 0;
  private currentPitch = 0;
  private currentRoll = 0;
  private vestSubmode: 'bppv' | 'caloric' | 'vhit' = 'bppv';

  // Diagnostic Vestibular Testing State: Laterality & vHIT Kinematic Animation
  private currentLaterality: 'right' | 'left' = 'right';
  private vhitAnim: {
    active: boolean;
    startTime: number;
    pair: VHITCanalPair;
    direction: 1 | -1;
    onComplete?: () => void;
  } | null = null;
  private readonly qVHITTmp = new THREE.Quaternion();
  private readonly qIdentity = new THREE.Quaternion(0, 0, 0, 1);
  private readonly vhitQuatArray = new Float64Array(4);
  private readonly LABYRINTH_PIVOT_RAS = new THREE.Vector3(4.5, 1.4, 0.5);
  private readonly tempPivotRotated = new THREE.Vector3();
  private readonly headRotMatrix4 = new THREE.Matrix4();
  private readonly headTargetQuat = new THREE.Quaternion();
  private readonly gravityIndicatorOffsets: ReadonlyArray<readonly [number, number, number]> = [
    [0, 0, 0],
    [0.16, 0.08, 0.05],
    [-0.14, -0.06, 0.09],
    [0.09, -0.14, -0.05],
    [-0.08, 0.14, -0.07],
  ];
  private gravityIndicatorGroup: THREE.Group | null = null;
  private hearingAttenuationGain = 1.0;
  private activeCaloricState: {
    active: boolean;
    cupulaDeflection: number;
    afferentFiringRate: number;
    slowPhaseHorizDegPerSec: number;
    fastPhaseBeatDirection: string;
    flowDirection: string;
    isAmpullopetal: boolean;
  } | null = null;

  // Surgical Simulation Suite
  private surgicalDrawer: ISurgicalDrawerTarget | null = null;
  private onSurgicalStateCallbacks: Array<SurgicalStateCallback> = [];
  private ciElectrodeGroup: THREE.Group | null = null;
  private ciCarrierMesh: THREE.Line | null = null;
  private ciCarrierTubeMesh: THREE.Mesh | null = null;
  private ciContactMeshes: THREE.Mesh[] = [];
  private ciStarterTipMesh: THREE.Mesh | null = null;
  private ciEntryPortalGroup: THREE.Group | null = null;
  private ciEntryRingMat: THREE.MeshBasicMaterial | null = null;
  private ciEntryArrowMat: THREE.MeshBasicMaterial | null = null;
  private labySurgicalGroup: THREE.Group | null = null;
  private labyBurrMesh: THREE.Mesh | null = null;
  private labyBurrMat: THREE.MeshStandardMaterial | null = null;
  private iacSurgicalGroup: THREE.Group | null = null;
  private iacNerveCN7: THREE.Mesh | null = null;
  private iacNerveCochlear: THREE.Mesh | null = null;
  private iacNerveSVN: THREE.Mesh | null = null;
  private iacNerveIVN: THREE.Mesh | null = null;
  private iacCleavageMesh: THREE.Mesh | null = null;
  private iacTumorMesh: THREE.Mesh | null = null;
  private iacToolGroup: THREE.Group | null = null;
  private iacToolTipMat: THREE.MeshStandardMaterial | null = null;
  private readonly scratchEntryPos = new THREE.Vector3();
  private readonly scratchEntryNext = new THREE.Vector3();
  private readonly scratchEntryDir = new THREE.Vector3();
  private readonly scratchUpZ = new THREE.Vector3(0, 0, 1);
  private ciCenterPointsTmp: [number, number, number][] = Array.from({ length: 65 }, () => [0, 0, 0]);
  private surgicalSimTime = 0.0;

  // Reactive State
  private state: LabSceneSnapshot = {
    labMode: 'anatomy',
    hearingState: {
      activeFrequency: 1000,
      activeGreenwoodX: greenwoodPosition(1000),
      isPlaying: false,
      activePresetId: null,
      lossSector: null,
    },
    radiologyState: {
      activePlane: 'poschl',
      sliceDepthMm: 1.2,
      clipInverted: false,
      showPlaneHelper: true,
      scdsActive: false,
      windowMode: 'bone',
    },
    surgicalState: {
      activeProcedure: 'cochlear_implant',
      ciState: computeCIInsertionKinematics(0),
      labyState: computeLabyrinthectomyAblation(0),
      neurectomyState: computeNeurectomyElectrophysiology(0),
    },
    selectedMesh: 'ls_Hsapiens_Sp',
    hoveredMesh: null,
    visibilityMap: {},
    bonyPeelPercent: 80,
    explodePercent: 0,
    labelMode: 'key',
    readingDepth: 'simple',
    activePresetId: 'overview',
    canUndo: false,
    isIsolated: false,
    loadingProgress: 0,
    loadingCompletedCount: 0,
    loadingTotalCount: IEMAP_STRUCTURES.length,
    loadingItemLabel: 'Initializing WebGL & 3D Anatomy Lab...',
    isLoaded: false,
  };

  private onStateChangeCallbacks: Array<(snap: LabSceneSnapshot) => void> = [];
  private onPinsUpdateCallbacks: Array<(pins: ProjectedPin2D[]) => void> = [];
  private onStructurePickedCallbacks: Array<(meshName: string) => void> = [];
  private onVestibularTelemetryCallbacks: Array<(telem: VestibularTelemetryState) => void> = [];

  private raycaster = new THREE.Raycaster();
  private pointerDownPos = new THREE.Vector2();
  private activePointers = new Set<number>();
  private isMultiTouch = false;
  private animationFrameId = 0;
  private lastFrameTime = performance.now();

  public getSelectedMesh(): string | null {
    return this.state.selectedMesh;
  }

  public getDomElement(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  constructor(container: HTMLElement) {
    this.container = container;

    for (const item of IEMAP_STRUCTURES) {
      this.state.visibilityMap[item.meshName] = item.defaultState;
      this.pinCandidates.push({
        pin: {
          id: `struct_${item.meshName}`,
          rawId: item.meshName,
          label: item.shortLabel,
          sublabel: `${item.displayName} (${item.latinName})`,
          category: 'structure',
          colorHex: item.colorHex,
          screenX: 0,
          screenY: 0,
          visible: false,
          occluded: false,
          meshName: item.meshName,
        },
        priority: 1,
        maxDist: 42,
        depth: 0,
      });
    }

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      premultipliedAlpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.AgXToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.touchAction = 'none';

    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      this.motionMql = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.isReducedMotion = this.motionMql.matches;
      this.onMotionChangeBound = () => {
        this.isReducedMotion = Boolean(this.motionMql?.matches);
      };
      this.motionMql.addEventListener('change', this.onMotionChangeBound);
    }

    this.handleContextLostBound = (event: Event) => {
      event.preventDefault(); // Required by WebGL specification
      this.handleContextLost();
    };
    this.handleContextRestoredBound = () => {
      this.handleContextRestored();
    };
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLostBound, false);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestoredBound, false);
    this.container.appendChild(this.renderer.domElement);

    // Single-Stage High-Magnification 27-Mesh IE-Map Labyrinth Scene (RAS space)
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.2, 250);
    this.camera.up.set(0, 0, 1);
    this.camera.position.set(22.5, -10.5, 7.5);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.target.set(4.5, 1.5, 0.2);
    this.controls.minDistance = 5.0;
    this.controls.maxDistance = 85.0;
    this.controls.maxPolarAngle = Math.PI - 0.02;
    this.controls.minPolarAngle = 0.02;
    this.controls.update();

    // 3-Point Studio Lighting + PMREM RoomEnvironment IBL
    this.initEnvironmentLighting();

    this.ambientLight = new THREE.AmbientLight(0xd9e8f0, 0.72);
    this.scene.add(this.ambientLight);

    this.dirKeyLight = new THREE.DirectionalLight(0xfffcf5, 1.35);
    this.dirKeyLight.position.set(20, -25, 25);
    this.scene.add(this.dirKeyLight);

    this.dirFillLight = new THREE.DirectionalLight(0x75c79e, 0.52);
    this.dirFillLight.position.set(-25, 20, 15);
    this.scene.add(this.dirFillLight);

    this.dirRimLight = new THREE.DirectionalLight(0x52dcf2, 0.72);
    this.dirRimLight.position.set(0, 10, 30);
    this.scene.add(this.dirRimLight);

    this.labyrinthRoot = new THREE.Group();
    this.scene.add(this.labyrinthRoot);

    // Glowing 3D Tonotopic Resonant Beacon (frequency-tinted core + additive halo)
    const cursorGeom = new THREE.SphereGeometry(0.22, 20, 20);
    const cursorMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#ffffff'),
      transparent: true,
      opacity: 0.96,
      depthTest: true,
    });
    this.tonotopyCursorMesh = new THREE.Mesh(cursorGeom, cursorMat);
    this.tonotopyCursorMesh.renderOrder = 999;
    this.tonotopyCursorMesh.visible = false;

    const haloGeom = new THREE.SphereGeometry(0.46, 20, 20);
    const haloMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#52dcf2'),
      transparent: true,
      opacity: 0.44,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    });
    this.tonotopyHaloMesh = new THREE.Mesh(haloGeom, haloMat);
    this.tonotopyHaloMesh.renderOrder = 1000;
    this.tonotopyCursorMesh.add(this.tonotopyHaloMesh);

    this.labyrinthRoot.add(this.tonotopyCursorMesh);

    this.initRadiology3DHelpers();
    this.initOtoconiaVisualizer();
    this.initGravityIndicator();
    this.initSurgicalArray();
    this.setupPointerInteractions();
  }

  private initEnvironmentLighting(): void {
    try {
      this.envRenderTarget?.dispose();
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      const roomEnv = new RoomEnvironment();
      this.envRenderTarget = pmrem.fromScene(roomEnv, 0.04);
      this.scene.environment = this.envRenderTarget.texture;
      this.scene.environmentIntensity = this.isLightTheme ? 0.48 : 0.72;
      roomEnv.dispose();
      pmrem.dispose();
    } catch {
      this.envRenderTarget = null;
    }
  }

  public setThemePolarity(isLightPaper: boolean): void {
    if (this.isLightTheme === isLightPaper) return;
    this.isLightTheme = isLightPaper;
    const themeVal = isLightPaper ? 1.0 : 0.0;

    for (const entry of this.meshEntries.values()) {
      const u = entry.material.uniforms as unknown as Gate3ShaderUniforms;
      if (u.uThemeLight) {
        u.uThemeLight.value = themeVal;
      }
    }

    if (this.ambientLight) {
      this.ambientLight.intensity = isLightPaper ? 0.56 : 0.72;
    }
    if (this.dirKeyLight) {
      this.dirKeyLight.intensity = isLightPaper ? 1.18 : 1.35;
    }
    if (this.dirFillLight) {
      this.dirFillLight.intensity = isLightPaper ? 0.42 : 0.52;
    }
    if (this.dirRimLight) {
      this.dirRimLight.intensity = isLightPaper ? 0.48 : 0.72;
    }
    this.scene.environmentIntensity = isLightPaper ? 0.48 : 0.72;

    const planeColor = isLightPaper ? 0x0c667e : 0x52dcf2;
    if (this.radPlaneQuadMat) {
      if (this.radSliceHasVolume) {
        this.radPlaneQuadMat.color.setHex(0xffffff);
        this.radPlaneQuadMat.opacity = 0.86;
      } else {
        this.radPlaneQuadMat.color.setHex(planeColor);
        this.radPlaneQuadMat.opacity = isLightPaper ? 0.14 : 0.12;
      }
    }
    if (this.radPlaneEdgeMat) {
      this.radPlaneEdgeMat.color.setHex(planeColor);
    }
    if (this.radPlaneCrossMat) {
      this.radPlaneCrossMat.color.setHex(planeColor);
    }

    const tetherOpacity = isLightPaper ? 0.52 : 0.42;
    for (const entry of this.meshEntries.values()) {
      (entry.tetherLine.material as THREE.LineBasicMaterial).opacity = tetherOpacity;
    }
  }

  public setStageFraming(leftInsetPx: number, bottomInsetPx: number): void {
    this.targetLeftInset = Math.max(0, leftInsetPx);
    this.targetBottomInset = Math.max(0, bottomInsetPx);
    if (this.isReducedMotion) {
      this.currentLeftInset = this.targetLeftInset;
      this.currentBottomInset = this.targetBottomInset;
      this.applyStageFraming(true);
    }
  }

  private applyStageFraming(force = false): void {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    const clampedLeft = Math.min(this.currentLeftInset, w * 0.44);
    const clampedBottom = Math.min(this.currentBottomInset, h * 0.48);
    const offsetX = -Math.round(clampedLeft * 0.48);
    const offsetY = Math.round(clampedBottom * 0.40);
    const sizeChanged = w !== this.appliedViewW || h !== this.appliedViewH;

    if (
      !force &&
      !sizeChanged &&
      Math.abs(offsetX - this.appliedOffsetX) < 0.5 &&
      Math.abs(offsetY - this.appliedOffsetY) < 0.5
    ) {
      return;
    }

    this.appliedViewW = w;
    this.appliedViewH = h;
    this.appliedOffsetX = offsetX;
    this.appliedOffsetY = offsetY;

    if (offsetX === 0 && offsetY === 0) {
      if (this.camera.view?.enabled) {
        this.camera.clearViewOffset();
      } else {
        this.camera.updateProjectionMatrix();
      }
    } else {
      this.camera.setViewOffset(w, h, offsetX, offsetY, w, h);
    }
  }

  private initOtoconiaVisualizer(): void {
    this.otoconiaGroup = new THREE.Group();
    this.otoconiaGroup.renderOrder = 5;
    this.otoconiaMeshes = [];

    const particleGeom = new THREE.SphereGeometry(0.135, 12, 12);
    const particleMat = new THREE.MeshBasicMaterial({
      color: 0xffc857,
      transparent: true,
      opacity: 0.98,
    });

    const haloGeom = new THREE.SphereGeometry(0.22, 8, 8);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xff9800,
      transparent: true,
      opacity: 0.48,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    for (let i = 0; i < 5; i++) {
      const mesh = new THREE.Mesh(particleGeom, particleMat);
      mesh.scale.setScalar(1.35);
      mesh.renderOrder = 5;
      const halo = new THREE.Mesh(haloGeom, haloMat);
      halo.renderOrder = 6;
      mesh.add(halo);
      this.otoconiaGroup.add(mesh);
      this.otoconiaMeshes.push(mesh);
    }
    this.otoconiaGroup.visible = false;
    this.labyrinthRoot.add(this.otoconiaGroup);
  }

  private initGravityIndicator(): void {
    this.gravityIndicatorGroup = new THREE.Group();
    this.gravityIndicatorGroup.name = 'vestibular_gravity_vector';
    // Positioned cleanly beside the tilted labyrinth in world RAS space pointing straight down (-Z)
    this.gravityIndicatorGroup.position.set(12.2, -1.8, 3.8);

    const shaftMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.9,
    });
    const shaftGeom = new THREE.CylinderGeometry(0.11, 0.11, 2.8, 12);
    shaftGeom.rotateX(Math.PI * 0.5); // Align cylinder length along world Z
    const shaftMesh = new THREE.Mesh(shaftGeom, shaftMat);
    shaftMesh.position.set(0, 0, -1.4);
    this.gravityIndicatorGroup.add(shaftMesh);

    const headGeom = new THREE.ConeGeometry(0.32, 0.78, 16);
    headGeom.rotateX(-Math.PI * 0.5); // Tip pointing straight along world -Z
    const headMesh = new THREE.Mesh(headGeom, shaftMat);
    headMesh.position.set(0, 0, -3.1);
    this.gravityIndicatorGroup.add(headMesh);

    const horizonGeom = new THREE.RingGeometry(0.45, 0.62, 28);
    const horizonMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
    });
    const horizonRing = new THREE.Mesh(horizonGeom, horizonMat);
    horizonRing.position.set(0, 0, 0);
    this.gravityIndicatorGroup.add(horizonRing);

    this.gravityIndicatorGroup.visible = false;
    this.scene.add(this.gravityIndicatorGroup);
  }

  private initSurgicalArray(): void {
    this.ciElectrodeGroup = new THREE.Group();
    this.ciElectrodeGroup.name = 'surgical_ci_electrode_group';

    // 1. Procedural 3D Silicone Carrier Tube Geometry (64 longitudinal segments, 8 radial slices)
    const SEGMENTS = 64;
    const RADIAL = 8;
    const vertexCount = (SEGMENTS + 1) * (RADIAL + 1);
    const indexCount = SEGMENTS * RADIAL * 6;

    const tubePositions = new Float32Array(vertexCount * 3);
    const tubeNormals = new Float32Array(vertexCount * 3);
    const tubeIndices = new Uint16Array(indexCount);

    let idx = 0;
    for (let j = 0; j < SEGMENTS; j++) {
      for (let i = 0; i < RADIAL; i++) {
        const a = j * (RADIAL + 1) + i;
        const b = (j + 1) * (RADIAL + 1) + i;
        const c = (j + 1) * (RADIAL + 1) + (i + 1);
        const d = j * (RADIAL + 1) + (i + 1);

        tubeIndices[idx++] = a;
        tubeIndices[idx++] = b;
        tubeIndices[idx++] = d;

        tubeIndices[idx++] = b;
        tubeIndices[idx++] = c;
        tubeIndices[idx++] = d;
      }
    }

    const tubeGeo = new THREE.BufferGeometry();
    tubeGeo.setAttribute('position', new THREE.BufferAttribute(tubePositions, 3));
    tubeGeo.setAttribute('normal', new THREE.BufferAttribute(tubeNormals, 3));
    tubeGeo.setIndex(new THREE.BufferAttribute(tubeIndices, 1));

    const tubeMat = new THREE.MeshStandardMaterial({
      color: 0xcfd8dc,
      roughness: 0.32,
      metalness: 0.18,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    this.ciCarrierTubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
    this.ciElectrodeGroup.add(this.ciCarrierTubeMesh);

    // Also keep center line for surgical tracking
    const linePositions = new Float32Array((SEGMENTS + 1) * 3);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x64748b,
      transparent: true,
      opacity: 0.6,
    });
    this.ciCarrierMesh = new THREE.Line(lineGeo, lineMat);
    this.ciElectrodeGroup.add(this.ciCarrierMesh);

    // 2. 22 Platinum electrode contact rings with Greenwood spectral colors (pre-allocated)
    // Contact 0 = E1 (apical lead, lowest frequency, normX = 0, violet)
    // Contact 21 = E22 (basal lead, highest frequency, normX = 1, scarlet red)
    const contactGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.38, 12);
    this.ciContactMeshes = [];
    for (let i = 0; i < 22; i++) {
      const normX = Math.max(0.0, Math.min(1.0, i / 21));
      const color = getGreenwoodColor(normX);
      const contactMat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.4,
        metalness: 0.92,
        roughness: 0.12,
      });
      const mesh = new THREE.Mesh(contactGeo, contactMat);
      mesh.visible = false;
      this.ciElectrodeGroup.add(mesh);
      this.ciContactMeshes.push(mesh);
    }

    // 3. Basal Entry Starter Tip (always visible at s = 0 mm portal) & CI Entry Portal Ring
    const starterGeom = new THREE.SphereGeometry(0.32, 16, 16);
    const starterMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.55,
      metalness: 0.5,
      roughness: 0.25,
    });
    this.ciStarterTipMesh = new THREE.Mesh(starterGeom, starterMat);
    const rwBase = SURGICAL_LANDMARKS.scalaTympaniLumenBase;
    this.ciStarterTipMesh.position.set(rwBase[0], rwBase[1], rwBase[2]);
    this.ciStarterTipMesh.renderOrder = 12;
    this.ciElectrodeGroup.add(this.ciStarterTipMesh);

    this.ciEntryPortalGroup = new THREE.Group();
    this.ciEntryPortalGroup.name = 'surgical_ci_entry_portal';
    this.ciEntryRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
    });
    const portalRing = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.08, 12, 32), this.ciEntryRingMat);
    this.ciEntryPortalGroup.add(portalRing);

    this.ciEntryArrowMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.85,
    });
    const arrowShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.35, 10), this.ciEntryArrowMat);
    arrowShaft.rotation.x = Math.PI * 0.5;
    arrowShaft.position.set(0, 0, -0.95);
    this.ciEntryPortalGroup.add(arrowShaft);
    const arrowCone = new THREE.Mesh(new THREE.ConeGeometry(0.20, 0.45, 12), this.ciEntryArrowMat);
    arrowCone.rotation.x = Math.PI * 0.5;
    arrowCone.position.set(0, 0, -0.15);
    this.ciEntryPortalGroup.add(arrowCone);
    this.ciEntryPortalGroup.visible = false;
    this.labyrinthRoot.add(this.ciEntryPortalGroup);

    this.ciElectrodeGroup.visible = false;
    this.ciElectrodeGroup.renderOrder = 10;
    this.labyrinthRoot.add(this.ciElectrodeGroup);

    // 4. Transmastoid Labyrinthectomy Group: 3D CN VII (Facial Nerve) + Donaldson's Line + Burr
    this.labySurgicalGroup = new THREE.Group();
    this.labySurgicalGroup.name = 'surgical_labyrinthectomy_landmarks';

    const cn7Curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(7.1, 2.2, 0.4), // Tympanic segment inferior to Lat SCC
      new THREE.Vector3(9.4, -1.2, 0.1), // Second Genu
      new THREE.Vector3(
        SURGICAL_LANDMARKS.facialNerveMastoid[0],
        SURGICAL_LANDMARKS.facialNerveMastoid[1],
        SURGICAL_LANDMARKS.facialNerveMastoid[2]
      ),
      new THREE.Vector3(10.5, -2.1, -6.8), // Stylomastoid exit
    ]);
    const cn7Mat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xca8a04,
      emissiveIntensity: 0.42,
      roughness: 0.28,
      metalness: 0.15,
    });
    const cn7Tube = new THREE.Mesh(new THREE.TubeGeometry(cn7Curve, 32, 0.26, 12, false), cn7Mat);
    cn7Tube.renderOrder = 10;
    this.labySurgicalGroup.add(cn7Tube);

    // Donaldson's Line bisecting Horizontal Canal longitudinally toward Posterior Canal & Endolymphatic Sac
    const donaldsonGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(6.2, 1.8, 0.9),
      new THREE.Vector3(12.2, -5.6, -2.0),
    ]);
    const donaldsonLine = new THREE.Line(
      donaldsonGeom,
      new THREE.LineBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.92,
      })
    );
    this.labySurgicalGroup.add(donaldsonLine);

    this.labyBurrMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.3,
      metalness: 0.85,
      roughness: 0.18,
    });
    this.labyBurrMesh = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 16), this.labyBurrMat);
    this.labyBurrMesh.position.set(11.2, -3.5, 2.8);
    this.labyBurrMesh.renderOrder = 11;
    this.labySurgicalGroup.add(this.labyBurrMesh);
    this.labySurgicalGroup.visible = false;
    this.labyrinthRoot.add(this.labySurgicalGroup);

    // 5. Retrosigmoid IAC / CPA Neurectomy Bundle ("7-Up, Coke Down", Bill's Bar, Falciform Crest, Koos Tumor)
    this.iacSurgicalGroup = new THREE.Group();
    this.iacSurgicalGroup.name = 'surgical_iac_bundle';

    const iacPorus = new THREE.Vector3(...SURGICAL_LANDMARKS.iacPorusAcusticus);
    const iacFundus = new THREE.Vector3(...SURGICAL_LANDMARKS.iacFundusMidpoint);
    const iacCPA = new THREE.Vector3(-3.4, -0.4, -0.5);
    const nerveLen = iacFundus.distanceTo(iacCPA);
    const nerveMid = iacFundus.clone().add(iacCPA).multiplyScalar(0.5);
    const nerveDir = iacFundus.clone().sub(iacCPA).normalize();
    const qAxis = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), nerveDir);
    const anteriorOffset = new THREE.Vector3(0, 0.42, 0).applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), nerveDir)
    );
    void anteriorOffset;

    // Porus Acusticus dural ring marker
    const porusMat = new THREE.MeshBasicMaterial({
      color: 0x94a3b8,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    });
    const porusRing = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.08, 12, 32), porusMat);
    porusRing.position.copy(iacPorus);
    porusRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), nerveDir);
    this.iacSurgicalGroup.add(porusRing);

    // Falciform Crest (horizontal transverse divider at IAC Fundus) & Bill's Bar (vertical crest)
    const crestMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      transparent: true,
      opacity: 0.78,
      roughness: 0.4,
    });
    const falciform = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.9, 0.14), crestMat);
    falciform.position.copy(iacFundus);
    this.iacSurgicalGroup.add(falciform);

    const billsBar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.95), crestMat);
    billsBar.position.set(iacFundus.x, iacFundus.y, iacFundus.z + 0.45);
    this.iacSurgicalGroup.add(billsBar);

    const nerveGeo = new THREE.CylinderGeometry(0.15, 0.15, nerveLen, 14);
    const makeNerve = (colorHex: number, emissiveHex: number, offY: number, offZ: number): THREE.Mesh => {
      const m = new THREE.Mesh(
        nerveGeo,
        new THREE.MeshStandardMaterial({
          color: colorHex,
          emissive: emissiveHex,
          emissiveIntensity: 0.35,
          roughness: 0.28,
        })
      );
      m.position.set(nerveMid.x, nerveMid.y + offY, nerveMid.z + offZ);
      m.quaternion.copy(qAxis);
      m.renderOrder = 10;
      this.iacSurgicalGroup!.add(m);
      return m;
    };

    // Anterior-Superior: CN VII Facial ("7-Up"), Anterior-Inferior: Cochlear ("Coke Down")
    this.iacNerveCN7 = makeNerve(0xfacc15, 0xb45309, 0.36, 0.38);
    this.iacNerveCochlear = makeNerve(0x34d399, 0x059669, 0.36, -0.38);
    // Posterior-Superior: SVN, Posterior-Inferior: IVN (accessible from Retrosigmoid approach)
    this.iacNerveSVN = makeNerve(0x38bdf8, 0x0284c7, -0.36, 0.38);
    this.iacNerveIVN = makeNerve(0x818cf8, 0x4f46e5, -0.36, -0.38);

    // Microsurgical Cleavage Plane Sheet (between Cochlear and Vestibular bundles)
    this.iacCleavageMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(nerveLen * 0.72, 1.35),
      new THREE.MeshBasicMaterial({
        color: 0x34d399,
        transparent: true,
        opacity: 0.24,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    this.iacCleavageMesh.position.set(nerveMid.x + 0.6, nerveMid.y, nerveMid.z);
    this.iacCleavageMesh.quaternion.copy(qAxis);
    this.iacCleavageMesh.rotateZ(Math.PI * 0.5);
    this.iacSurgicalGroup.add(this.iacCleavageMesh);

    // Koos I-IV Vestibular Schwannoma Tumor Ellipsoid (zero-GC scaling in-place)
    this.iacTumorMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.0, 24, 24),
      new THREE.MeshStandardMaterial({
        color: 0xfb7185,
        emissive: 0xbe123c,
        emissiveIntensity: 0.28,
        transparent: true,
        opacity: 0.72,
        roughness: 0.38,
      })
    );
    this.iacTumorMesh.position.set(1.2, 0.55, 0.05);
    this.iacTumorMesh.visible = false;
    this.iacTumorMesh.renderOrder = 11;
    this.iacSurgicalGroup.add(this.iacTumorMesh);

    // Active Micro-Instrument Tip (Scissors / Hook / Bipolar)
    this.iacToolGroup = new THREE.Group();
    this.iacToolTipMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.5,
      metalness: 0.85,
      roughness: 0.2,
    });
    const toolShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.09, 2.4, 10),
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.85, roughness: 0.2 })
    );
    toolShaft.position.set(0, -1.2, 0);
    this.iacToolGroup.add(toolShaft);
    const toolTip = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.55, 12), this.iacToolTipMat);
    toolTip.position.set(0, 0.25, 0);
    this.iacToolGroup.add(toolTip);
    this.iacToolGroup.position.set(1.6, -2.5, 0.1);
    this.iacSurgicalGroup.add(this.iacToolGroup);

    this.iacSurgicalGroup.visible = false;
    this.labyrinthRoot.add(this.iacSurgicalGroup);
  }

  // ===========================================================================
  // ASSET LOADING — 27 IE-Map Anatomical Meshes
  // ===========================================================================
  public async loadAllAssets(): Promise<void> {
    const totalTasks = IEMAP_STRUCTURES.length;
    let completed = 0;
    this.state.loadingTotalCount = totalTasks;

    const bumpProgress = (itemLabel: string) => {
      completed++;
      this.state.loadingCompletedCount = completed;
      this.state.loadingItemLabel = itemLabel;
      this.state.loadingProgress = Math.min(100, Math.round((completed / totalTasks) * 100));
      this.emitState();
    };

    // Pre-load all 3 semicircular canal paths concurrently with meshes
    const canalPathsPromise = loadAllCanalPaths()
      .then((canalPaths) => {
        this.vestibularEngine = new VestibularDynamicsEngine(canalPaths, 'posterior', 'epley');
      })
      .catch((err) => {
        console.warn('DualStageScene: Failed to load canal paths', err);
      });

    // Parallel load of all 27 IE-Map OBJ meshes and 3 canal paths
    await Promise.all([
      Promise.all(
        IEMAP_STRUCTURES.map(async (item) => {
          const url = `/assets/iemap/obj/${item.meshName}.obj`;
          const geometry = await fetchObjGeometry(url);

          if (item.systemGroup === 'cochlear_system') {
            const greenwoodX = computeMeshGreenwoodX(geometry);
            geometry.setAttribute('aGreenwoodX', new THREE.BufferAttribute(greenwoodX, 1));
          }

          const material = createGate3StructureMaterial({
            colorHex: item.colorHex,
            baseAlpha: item.baseAlpha,
            emissionStrength: item.emissionStrength,
          });

          const mesh = new THREE.Mesh(geometry, material);
          mesh.name = item.meshName;
          mesh.userData.meshName = item.meshName;

          if (item.systemGroup === 'ampullae_cupulae' && item.meshName.includes('_Cup_')) {
            mesh.renderOrder = 1;
          } else if (
            item.systemGroup === 'cochlear_system' &&
            item.meshName !== 'mesh_david_cochlea'
          ) {
            mesh.renderOrder = 2;
          } else if (item.systemGroup === 'otolith_vestibule') {
            mesh.renderOrder = 3;
          } else if (
            item.systemGroup === 'semicircular_ducts' ||
            item.systemGroup === 'ampullae_cupulae'
          ) {
            mesh.renderOrder = 4;
          } else if (item.meshName === 'mesh_david_cochlea') {
            mesh.renderOrder = 5;
          } else {
            mesh.renderOrder = 6;
          }

          const tetherPositions = new Float32Array(6);
          const tetherGeom = new THREE.BufferGeometry();
          tetherGeom.setAttribute('position', new THREE.BufferAttribute(tetherPositions, 3));
          const tetherMat = new THREE.LineBasicMaterial({
            color: new THREE.Color(item.colorHex),
            transparent: true,
            opacity: this.isLightTheme ? 0.52 : 0.42,
            depthWrite: false,
          });
          const tetherLine = new THREE.Line(tetherGeom, tetherMat);
          tetherLine.visible = false;

          this.labyrinthRoot.add(mesh);
          this.labyrinthRoot.add(tetherLine);
          this.pickableMeshes.push(mesh);

          this.meshEntries.set(item.meshName, {
            ontology: item,
            mesh,
            material,
            tetherLine,
            tetherPositions,
          });

          bumpProgress(`Loaded RAS mesh: ${item.displayName} (${item.meshName}.obj)`);
        })
      ),
      canalPathsPromise,
    ]);

    this.state.isLoaded = true;
    this.state.loadingProgress = 100;
    this.applySceneStateToMeshes();
    this.emitState();
  }

  // ===========================================================================
  // SHADER & MESH UPDATES (Bone Shell Peel, Radial Explode & Highlight)
  // ===========================================================================
  private computeEffectiveHearingWaveAmplitude(): number {
    if (this.state.labMode !== 'hearing') return 0.0;
    const { isPlaying, lossSector, activeGreenwoodX, activePresetId } = this.state.hearingState;
    const baseAmp = isPlaying ? 1.0 : 0.42;
    if (activePresetId === 'acoustic_trauma' || activePresetId === 'labyrinthectomy_anacusis') {
      return baseAmp * 0.14;
    }
    const inLossSector = Boolean(
      lossSector &&
      activeGreenwoodX >= lossSector[0] &&
      activeGreenwoodX <= lossSector[1]
    );
    const lossDamping = inLossSector
      ? Math.min(0.65, Math.max(0.24, this.hearingAttenuationGain))
      : Math.max(0.24, this.hearingAttenuationGain);
    return baseAmp * lossDamping;
  }

  private syncAuxiliaryGroupVisibility(): void {
    const mode = this.state.labMode;
    const proc = this.state.surgicalState.activeProcedure;
    if (this.otoconiaGroup) {
      this.otoconiaGroup.visible = mode === 'vestibular';
    }
    if (this.gravityIndicatorGroup) {
      this.gravityIndicatorGroup.visible = mode === 'vestibular' && this.vestSubmode === 'bppv';
    }
    if (this.tonotopyCursorMesh) {
      this.tonotopyCursorMesh.visible = mode === 'hearing';
    }
    if (this.ciElectrodeGroup) {
      this.ciElectrodeGroup.visible = mode === 'surgical' && proc === 'cochlear_implant';
    }
    if (this.ciEntryPortalGroup) {
      this.ciEntryPortalGroup.visible = mode === 'surgical' && proc === 'cochlear_implant';
    }
    if (this.labySurgicalGroup) {
      this.labySurgicalGroup.visible = mode === 'surgical' && proc === 'labyrinthectomy';
    }
    if (this.iacSurgicalGroup) {
      this.iacSurgicalGroup.visible = mode === 'surgical' && proc === 'neurectomy';
    }
  }

  private applySceneStateToMeshes(): void {
    const {
      labMode,
      hearingState,
      surgicalState,
      visibilityMap,
      bonyPeelPercent,
      explodePercent,
      selectedMesh,
      hoveredMesh,
    } = this.state;

    const isHearingMode = labMode === 'hearing';
    const isRadiologyMode = labMode === 'radiology';
    const isVestibularMode = labMode === 'vestibular';
    const isSurgicalMode = labMode === 'surgical';
    const explodeFactor = explodePercent / 100.0;

    // Radiology clipping uniforms calculation
    let clipActive = false;
    let clipNormal = DualStageScene.DUMMY_CLIP_NORMAL;
    let clipConstant = 1000.0;

    if (isRadiologyMode) {
      clipActive = true;
      const planeDef = RADIOLOGY_PLANES[this.state.radiologyState.activePlane];
      const clipUniforms = getShaderClipUniforms(
        planeDef,
        this.state.radiologyState.sliceDepthMm,
        this.state.radiologyState.clipInverted
      );
      this.clipNormalVec.set(...clipUniforms.uClipNormal);
      clipNormal = this.clipNormalVec;
      clipConstant = clipUniforms.uClipConstant;
    }

    for (const [meshName, entry] of this.meshEntries.entries()) {
      const { ontology, mesh, material, tetherLine, tetherPositions } = entry;
      let effState: VisibilityState = visibilityMap[meshName] ?? ontology.defaultState;
      let overrideOpacity: number | undefined;

      let tonotopyMode = 0.0;
      let activeGreenwoodX = -1.0;
      let waveAmplitude = 0.0;
      let lossMaskActive = 0.0;

      if (isHearingMode) {
        if (ontology.systemGroup === 'cochlear_system') {
          effState = 'visible';
          activeGreenwoodX = hearingState.activeGreenwoodX;
          waveAmplitude = this.computeEffectiveHearingWaveAmplitude();
          lossMaskActive = hearingState.lossSector ? 1.0 : 0.0;
          if (meshName === 'mesh_david_cochlea') {
            tonotopyMode = 1.0;
            overrideOpacity = 0.96;
          } else {
            // Crystal-translucent spectral scalae let the Organ of Corti traveling wave shine through
            tonotopyMode = 0.55;
            overrideOpacity = 0.28;
          }
        } else if (ontology.systemGroup === 'bony_capsule') {
          effState = 'hidden';
        } else {
          // Vestibular system ghosted to 15% opacity
          effState = 'ghost';
          overrideOpacity = 0.15;
        }
      } else if (isSurgicalMode) {
        const proc = surgicalState.activeProcedure;
        if (proc === 'cochlear_implant') {
          if (ontology.systemGroup === 'cochlear_system') {
            effState = 'visible';
            if (meshName === 'mesh_david_cochlea') {
              overrideOpacity = 0.24;
            } else if (meshName === 'seg_coch_inner_scala_tympani') {
              overrideOpacity = 0.46;
            } else if (meshName === 'seg_coch_inner_scala_vestibuli') {
              overrideOpacity = 0.26;
            } else {
              overrideOpacity = 0.32;
            }
          } else if (ontology.systemGroup === 'bony_capsule') {
            effState = 'hidden';
          } else {
            effState = 'ghost';
            overrideOpacity = 0.15;
          }
        } else if (proc === 'labyrinthectomy') {
          if (ontology.systemGroup === 'bony_capsule') {
            effState = surgicalState.labyState.step >= 1 ? 'ghost' : 'visible';
            overrideOpacity = surgicalState.labyState.step >= 1 ? 0.24 : 0.72;
          } else if (
            ontology.systemGroup === 'semicircular_ducts' ||
            ontology.systemGroup === 'ampullae_cupulae' ||
            ontology.systemGroup === 'otolith_vestibule'
          ) {
            if (
              surgicalState.labyState.neuroepitheliumAblated &&
              ontology.systemGroup !== 'semicircular_ducts'
            ) {
              effState = 'ghost';
              overrideOpacity = 0.12;
            } else {
              effState = 'visible';
              overrideOpacity = 0.78;
            }
          } else {
            effState = 'ghost';
            overrideOpacity = 0.18;
          }
        } else {
          // Retrosigmoid Neurectomy & CPA Exposure
          if (ontology.systemGroup === 'bony_capsule') {
            effState = 'hidden';
          } else if (ontology.systemGroup === 'cochlear_system') {
            effState = 'visible';
            overrideOpacity = meshName === 'mesh_david_cochlea' ? 0.55 : 0.34;
          } else if (
            surgicalState.neurectomyState.vestibularNerveTransected &&
            ontology.systemGroup === 'otolith_vestibule'
          ) {
            effState = 'ghost';
            overrideOpacity = 0.22;
          } else {
            effState = 'visible';
            overrideOpacity = 0.55;
          }
        }
      } else if (isRadiologyMode) {
        // Outer Bony Capsule remains solid/translucent bone (85% opacity) to reveal internal cavities upon slicing
        if (ontology.systemGroup === 'bony_capsule') {
          effState = 'visible';
          overrideOpacity = 0.85;
        } else {
          effState = 'visible';
          overrideOpacity = Math.max(0.75, ontology.baseAlpha);
        }
      } else if (isVestibularMode) {
        // Vestibular Mode: Translucent semicircular ducts (48% opacity, depthWrite: false) reveal internal otoconia & cupulae
        // Ampullae/cupulae & vestibule remain crisp (84%), while Cochlea & Bony Capsule ghost to 15%
        if (ontology.systemGroup === 'semicircular_ducts') {
          effState = 'visible';
          overrideOpacity = 0.48;
        } else if (
          ontology.systemGroup === 'ampullae_cupulae' ||
          ontology.systemGroup === 'otolith_vestibule'
        ) {
          effState = 'visible';
          overrideOpacity = 0.84;
        } else {
          effState = 'ghost';
          overrideOpacity = 0.15;
        }
      } else {
        // Outer Bone Shell Peel (0% = solid, 25-95% = transparent glass, >=96% = hidden)
        if (ontology.systemGroup === 'bony_capsule') {
          if (bonyPeelPercent >= 96) {
            effState = 'hidden';
          } else if (effState !== 'hidden') {
            const bonyFactor = Math.max(0.0, 1.0 - bonyPeelPercent / 100.0);
            if (bonyPeelPercent >= 25) {
              effState = 'ghost';
              overrideOpacity = Math.max(0.08, bonyFactor * 0.85);
            } else {
              effState = 'visible';
              overrideOpacity = 0.42 + bonyFactor * 0.48;
            }
          }
        }
      }

      mesh.visible = effState !== 'hidden';

      // Radial Explode Part Offsets & Tether Lines
      const ox = ontology.explodeOffsetRAS[0] * explodeFactor;
      const oy = ontology.explodeOffsetRAS[1] * explodeFactor;
      const oz = ontology.explodeOffsetRAS[2] * explodeFactor;
      mesh.position.set(ox, oy, oz);

      if (explodeFactor > 0.02 && effState !== 'hidden') {
        const cx = ontology.centroidRAS[0];
        const cy = ontology.centroidRAS[1];
        const cz = ontology.centroidRAS[2];
        tetherPositions[0] = cx;
        tetherPositions[1] = cy;
        tetherPositions[2] = cz;
        tetherPositions[3] = cx + ox;
        tetherPositions[4] = cy + oy;
        tetherPositions[5] = cz + oz;
        tetherLine.geometry.attributes.position.needsUpdate = true;
        tetherLine.visible = true;
      } else {
        tetherLine.visible = false;
      }

      // Highlight logic: Selected = 1.0, Hovered = 0.45, Default = 0.0
      let highlightLevel = 0.0;
      if (selectedMesh === meshName) {
        highlightLevel = 1.0;
      } else if (hoveredMesh === meshName) {
        highlightLevel = 0.45;
      }

      updateGate3MaterialState(material, {
        state: effState,
        baseAlpha: ontology.baseAlpha,
        overrideOpacity,
        highlightLevel,
        themeLight: this.isLightTheme ? 1.0 : 0.0,
        clipActive,
        clipNormal,
        clipConstant,
        tonotopyMode,
        activeGreenwoodX,
        waveAmplitude,
        lossMaskActive,
        lossRange: this.lossRangeVector,
        lossSeverity: 0.92,
      });
    }

    // Update 3D Tonotopic Resonant Beacon
    if (this.tonotopyCursorMesh) {
      if (isHearingMode) {
        const coords = getCoordinatesForFrequency(this.state.hearingState.activeFrequency);
        this.tonotopyCursorMesh.position.set(coords[0], coords[1], coords[2]);
        this.updateTonotopyBeaconColor(this.state.hearingState.activeGreenwoodX);
        this.tonotopyCursorMesh.visible = true;
      } else {
        this.tonotopyCursorMesh.visible = false;
      }
    }

    // Update Radiology 3D Helpers
    this.updateRadiologyHelpers();
  }

  // ===========================================================================
  // CAMERA FLY-TO ANIMATION
  // ===========================================================================
  private startCameraFly(
    toPos: THREE.Vector3,
    toTarget: THREE.Vector3,
    durationMs = 500,
    toUp?: THREE.Vector3
  ): void {
    this.flyAnim = {
      active: true,
      startTime: performance.now(),
      durationMs,
      fromPos: this.camera.position.clone(),
      toPos,
      fromTarget: this.controls.target.clone(),
      toTarget,
      fromUp: this.camera.up.clone(),
      toUp: toUp ? toUp.clone() : undefined,
    };
  }

  public flyToStructure(meshName: string): void {
    const entry = this.meshEntries.get(meshName);
    if (!entry) return;

    const { ontology, mesh } = entry;
    const targetRAS = new THREE.Vector3(
      ontology.centroidRAS[0] + mesh.position.x,
      ontology.centroidRAS[1] + mesh.position.y,
      ontology.centroidRAS[2] + mesh.position.z
    );

    const viewOffset = new THREE.Vector3(
      ontology.cameraViewOffsetRAS[0],
      ontology.cameraViewOffsetRAS[1],
      ontology.cameraViewOffsetRAS[2]
    );

    const destPos = targetRAS.clone().add(viewOffset);
    this.startCameraFly(destPos, targetRAS, 520);
  }

  public resetView(): void {
    this.startCameraFly(
      new THREE.Vector3(22.5, -10.5, 7.5),
      new THREE.Vector3(4.5, 1.5, 0.2),
      500,
      new THREE.Vector3(0, 0, 1)
    );
    this.state.isIsolated = false;
    const prevSelected = this.state.selectedMesh;
    this.applyDissectionPreset('overview', false);
    if (prevSelected) {
      this.state.selectedMesh = prevSelected;
    }
    this.emitState();
  }

  // ===========================================================================
  // LAB MODE TRANSITIONS (Anatomy Atlas, Hearing Tonotopy, Virtual Radiology)
  // ===========================================================================
  public setLabMode(mode: LabMode): void {
    if (this.state.labMode === mode) return;

    this.cancelVHITThrust();

    if (mode !== 'vestibular') {
      this.setCaloricUniforms(false, 0, 0, 0);
      this.setCaloricSimulationState(false, null);
      if (this.currentLaterality !== 'right') {
        this.setLabyrinthLaterality('right');
      }
    }

    if (mode === 'radiology') {
      // Save current anatomy state for lossless restoration
      if (!this.savedAnatomyState) {
        this.savedAnatomyState = {
          visibilityMap: { ...this.state.visibilityMap },
          bonyPeelPercent: this.state.bonyPeelPercent,
          cameraPos: this.camera.position.clone(),
          controlsTarget: this.controls.target.clone(),
          cameraUp: this.camera.up.clone(),
        };
      }

      this.state.labMode = 'radiology';
      this.state.selectedMesh = 'ls_Hsapiens_Sa';
      preloadRadiologyVolumes(this.state.radiologyState.windowMode);

      // If SCDS defect was already enabled, ensure Poschl plane
      if (this.state.radiologyState.scdsActive) {
        this.state.radiologyState.activePlane = 'poschl';
      }

      const plane = RADIOLOGY_PLANES[this.state.radiologyState.activePlane];
      this.startCameraFly(
        new THREE.Vector3(...plane.cameraPosRAS),
        new THREE.Vector3(...plane.cameraTargetRAS),
        550,
        new THREE.Vector3(...plane.cameraUpRAS)
      );
    } else if (mode === 'hearing') {
      // Save current anatomy state for lossless restoration
      if (!this.savedAnatomyState) {
        this.savedAnatomyState = {
          visibilityMap: { ...this.state.visibilityMap },
          bonyPeelPercent: this.state.bonyPeelPercent,
          cameraPos: this.camera.position.clone(),
          controlsTarget: this.controls.target.clone(),
          cameraUp: this.camera.up.clone(),
        };
      }

      this.state.labMode = 'hearing';
      this.state.selectedMesh = 'mesh_david_cochlea';

      // Anterolateral cochlear perspective fly-to
      const targetRAS = new THREE.Vector3(1.77, 6.38, -2.96);
      const camPos = new THREE.Vector3(13.5, 14.0, 2.5);
      this.startCameraFly(camPos, targetRAS, 550, new THREE.Vector3(0, 0, 1));
    } else if (mode === 'vestibular') {
      // Save current anatomy state for lossless restoration
      if (!this.savedAnatomyState) {
        this.savedAnatomyState = {
          visibilityMap: { ...this.state.visibilityMap },
          bonyPeelPercent: this.state.bonyPeelPercent,
          cameraPos: this.camera.position.clone(),
          controlsTarget: this.controls.target.clone(),
          cameraUp: this.camera.up.clone(),
        };
      }

      this.state.labMode = 'vestibular';
      const activeCanal = this.vestibularEngine?.getCanal() || 'posterior';
      this.state.selectedMesh =
        this.vestSubmode !== 'bppv' || activeCanal === 'horizontal'
          ? 'ls_Hsapiens_Sl'
          : activeCanal === 'anterior'
          ? 'ls_Hsapiens_Sa'
          : 'ls_Hsapiens_Sp';

      // Optimal labyrinth vestibular perspective fly-to
      const camPos = new THREE.Vector3(21.5, -11.5, 7.2);
      const targetRAS = new THREE.Vector3(4.5, 1.5, 0.2);
      this.startCameraFly(camPos, targetRAS, 550, new THREE.Vector3(0, 0, 1));
    } else if (mode === 'surgical') {
      if (!this.savedAnatomyState) {
        this.savedAnatomyState = {
          visibilityMap: { ...this.state.visibilityMap },
          bonyPeelPercent: this.state.bonyPeelPercent,
          cameraPos: this.camera.position.clone(),
          controlsTarget: this.controls.target.clone(),
          cameraUp: this.camera.up.clone(),
        };
      }

      this.state.labMode = 'surgical';
      const proc = this.state.surgicalState.activeProcedure;
      this.state.selectedMesh =
        proc === 'cochlear_implant'
          ? 'mesh_david_cochlea'
          : proc === 'labyrinthectomy'
          ? 'ls_Hsapiens_Sl'
          : 'ls_Hsapiens_utricle';
      this.flyToSurgicalProcedure(proc);
    } else if (mode === 'anatomy') {
      this.state.labMode = 'anatomy';
      if (this.savedAnatomyState) {
        this.state.visibilityMap = { ...this.savedAnatomyState.visibilityMap };
        this.state.bonyPeelPercent = this.savedAnatomyState.bonyPeelPercent;
        this.startCameraFly(
          this.savedAnatomyState.cameraPos,
          this.savedAnatomyState.controlsTarget,
          500,
          this.savedAnatomyState.cameraUp
        );
      }
    }

    this.syncAuxiliaryGroupVisibility();

    if (this.state.labMode !== 'surgical') {
      const entrySV = this.meshEntries.get('seg_coch_inner_scala_vestibuli');
      if (entrySV && entrySV.material) {
        entrySV.material.uniforms.uTranslocationBreach.value = 0.0;
      }
      const entrySl = this.meshEntries.get('ls_Hsapiens_Sl');
      if (entrySl && entrySl.material) {
        entrySl.material.uniforms.uSurgicalDrillActive.value = 0.0;
        entrySl.material.uniforms.uCanalUnroofed.value.set(0, 0, 0);
      }
      const entrySa = this.meshEntries.get('ls_Hsapiens_Sa');
      if (entrySa && entrySa.material) {
        entrySa.material.uniforms.uCanalUnroofed.value.set(0, 0, 0);
      }
      const entrySp = this.meshEntries.get('ls_Hsapiens_Sp');
      if (entrySp && entrySp.material) {
        entrySp.material.uniforms.uCanalUnroofed.value.set(0, 0, 0);
      }
      const entryOtsu = this.meshEntries.get('segT2_th1.07_Otsu');
      if (entryOtsu && entryOtsu.material) {
        entryOtsu.material.uniforms.uSurgicalDrillActive.value = 0.0;
      }
    }

    if (this.state.labMode !== 'vestibular') {
      const entrySl = this.meshEntries.get('ls_Hsapiens_Sl');
      if (entrySl && entrySl.material) {
        const u = entrySl.material.uniforms as unknown as Gate3ShaderUniforms;
        if (u.uCaloricActive) u.uCaloricActive.value = 0.0;
        if (u.uCaloricTempDiff) u.uCaloricTempDiff.value = 0.0;
        if (u.uCaloricDiffusion) u.uCaloricDiffusion.value = 0.0;
        if (u.uCaloricTime) u.uCaloricTime.value = 0.0;
      }
      this.activeCaloricState = null;
    }

    this.applySceneStateToMeshes();
    this.emitState();
  }

  private updateTonotopyBeaconColor(greenwoodX: number): void {
    if (!this.tonotopyCursorMesh) return;
    const c = getGreenwoodColor(greenwoodX);
    this.scratchBeaconColor.copy(c);
    const coreMat = this.tonotopyCursorMesh.material as THREE.MeshBasicMaterial;
    coreMat.color.copy(this.scratchBeaconColor).lerp(this.scratchWhiteColor, 0.35);
    if (this.tonotopyHaloMesh) {
      const haloMat = this.tonotopyHaloMesh.material as THREE.MeshBasicMaterial;
      haloMat.color.copy(this.scratchBeaconColor);
    }
  }

  public setHearingFrequency(freqHz: number, triggerAudio = true): void {
    const clamped = Math.max(20, Math.min(20000, freqHz));
    const x = greenwoodPosition(clamped);
    this.state.hearingState.activeFrequency = clamped;
    this.state.hearingState.activeGreenwoodX = x;

    for (const entry of this.meshEntries.values()) {
      if (entry.ontology.systemGroup === 'cochlear_system') {
        entry.material.uniforms.uActiveGreenwoodX.value = x;
        if (this.state.labMode === 'hearing') {
          const factor = entry.ontology.meshName === 'mesh_david_cochlea' ? 1.0 : 0.55;
          entry.material.uniforms.uWaveAmplitude.value =
            this.computeEffectiveHearingWaveAmplitude() * factor;
        }
      }
    }

    if (this.tonotopyCursorMesh) {
      const coords = getCoordinatesForFrequency(clamped);
      this.tonotopyCursorMesh.position.set(coords[0], coords[1], coords[2]);
      this.updateTonotopyBeaconColor(x);
      this.tonotopyCursorMesh.visible = this.state.labMode === 'hearing';
    }

    if (triggerAudio) {
      for (const cb of this.onHearingToneRequestCallbacks) {
        cb(clamped);
      }
    }

    this.emitState();
  }

  public setHearingThresholdGain(gain: number): void {
    this.hearingAttenuationGain = Math.max(0.08, Math.min(1.0, gain));
    if (this.state.labMode === 'hearing') {
      const amp = this.computeEffectiveHearingWaveAmplitude();
      for (const entry of this.meshEntries.values()) {
        if (entry.ontology.systemGroup === 'cochlear_system') {
          const factor = entry.ontology.meshName === 'mesh_david_cochlea' ? 1.0 : 0.55;
          entry.material.uniforms.uWaveAmplitude.value = amp * factor;
        }
      }
    }
  }

  public setHearingPlayback(isPlaying: boolean): void {
    this.state.hearingState.isPlaying = isPlaying;
    const amp = this.computeEffectiveHearingWaveAmplitude();
    for (const entry of this.meshEntries.values()) {
      if (entry.ontology.systemGroup === 'cochlear_system') {
        const factor = entry.ontology.meshName === 'mesh_david_cochlea' ? 1.0 : 0.55;
        entry.material.uniforms.uWaveAmplitude.value = amp * factor;
      }
    }
    this.emitState();
  }

  public setHearingLossSector(lossSector: [number, number] | null, presetId: string | null = null): void {
    this.state.hearingState.lossSector = lossSector;
    this.state.hearingState.activePresetId = presetId;

    const amp = this.computeEffectiveHearingWaveAmplitude();
    for (const entry of this.meshEntries.values()) {
      if (entry.ontology.systemGroup === 'cochlear_system') {
        if (lossSector) {
          this.lossRangeVector.set(lossSector[0], lossSector[1]);
          entry.material.uniforms.uLossMaskActive.value = 1.0;
          entry.material.uniforms.uLossRange.value.copy(this.lossRangeVector);
          entry.material.uniforms.uLossSeverity.value = 0.92;
        } else {
          entry.material.uniforms.uLossMaskActive.value = 0.0;
        }
        const factor = entry.ontology.meshName === 'mesh_david_cochlea' ? 1.0 : 0.55;
        entry.material.uniforms.uWaveAmplitude.value = amp * factor;
      }
    }
    this.emitState();
  }

  public onHearingToneRequest(cb: (freqHz: number) => void): void {
    this.onHearingToneRequestCallbacks.push(cb);
  }

  // ===========================================================================
  // VIRTUAL RADIOLOGY & SCDS ENGINE API
  // ===========================================================================
  private initRadiology3DHelpers(): void {
    // 1. 3D Technical Cutting Plane Quad Helper (24x24 mm)
    this.radiologyPlaneHelperGroup = new THREE.Group();

    const texSize = DualStageScene.RAD_TEXTURE_SIZE;
    this.radSliceData = new Uint8Array(texSize * texSize * 4);
    this.radSliceTexture = new THREE.DataTexture(
      this.radSliceData,
      texSize,
      texSize,
      THREE.RGBAFormat
    );
    this.radSliceTexture.minFilter = THREE.LinearFilter;
    this.radSliceTexture.magFilter = THREE.LinearFilter;
    this.radSliceTexture.wrapS = THREE.ClampToEdgeWrapping;
    this.radSliceTexture.wrapT = THREE.ClampToEdgeWrapping;
    this.radSliceTexture.flipY = false;

    const planeGeom = new THREE.PlaneGeometry(24, 24);
    this.radPlaneQuadMat = new THREE.MeshBasicMaterial({
      color: this.isLightTheme ? 0x0c667e : 0x52dcf2,
      transparent: true,
      opacity: this.isLightTheme ? 0.14 : 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const planeMesh = new THREE.Mesh(planeGeom, this.radPlaneQuadMat);
    this.radiologyPlaneHelperGroup.add(planeMesh);

    this.unsubRadVolumeReady = onRadiologyVolumeReady((mode) => {
      if (
        this.state.labMode === 'radiology' &&
        this.state.radiologyState.showPlaneHelper &&
        mode === this.state.radiologyState.windowMode
      ) {
        this.updateRadiologySliceTexture();
      }
    });

    const edges = new THREE.EdgesGeometry(planeGeom);
    this.radPlaneEdgeMat = new THREE.LineBasicMaterial({
      color: this.isLightTheme ? 0x0c667e : 0x52dcf2,
      transparent: true,
      opacity: 0.85,
    });
    const edgeLine = new THREE.LineSegments(edges, this.radPlaneEdgeMat);
    this.radiologyPlaneHelperGroup.add(edgeLine);

    // Subtle center crosshairs
    const crossPoints = [
      new THREE.Vector3(-12, 0, 0.01),
      new THREE.Vector3(12, 0, 0.01),
      new THREE.Vector3(0, -12, 0.01),
      new THREE.Vector3(0, 12, 0.01),
    ];
    const crossGeom = new THREE.BufferGeometry().setFromPoints(crossPoints);
    this.radPlaneCrossMat = new THREE.LineBasicMaterial({
      color: this.isLightTheme ? 0x0c667e : 0x52dcf2,
      transparent: true,
      opacity: 0.52,
    });
    const crossLine = new THREE.LineSegments(crossGeom, this.radPlaneCrossMat);
    this.radiologyPlaneHelperGroup.add(crossLine);
    this.radiologyPlaneHelperGroup.visible = false;
    this.scene.add(this.radiologyPlaneHelperGroup);

    // 2. SCDS 3D Defect Visualizer & Sound Shunting Arcs anchored at Superior Canal Roof Apex
    this.scdsVisualizerGroup = new THREE.Group();

    const roofApex = SCDS_PARAMETERS.canalRoofApexRAS;
    const collarGeom = new THREE.TorusGeometry(0.78, 0.14, 16, 32);
    const collarMat = new THREE.MeshBasicMaterial({
      color: 0xf0aa62,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
    });
    const collarMesh = new THREE.Mesh(collarGeom, collarMat);
    collarMesh.position.set(roofApex[0], roofApex[1], roofApex[2]);
    collarMesh.rotation.set(Math.PI * 0.18, -Math.PI * 0.12, 0);
    this.scdsVisualizerGroup.add(collarMesh);

    // Canal roof beacon marker [5.72, 1.28, 7.56]
    const roofMarkerGeom = new THREE.SphereGeometry(0.28, 16, 16);
    const roofMarkerMat = new THREE.MeshBasicMaterial({
      color: 0xffc875,
      transparent: true,
      opacity: 0.95,
    });
    const roofMarker = new THREE.Mesh(roofMarkerGeom, roofMarkerMat);
    roofMarker.position.set(roofApex[0], roofApex[1], roofApex[2]);
    this.scdsVisualizerGroup.add(roofMarker);

    // 3 Concentric acoustic sound dispersion arcs radiating upward towards middle cranial fossa (+Z)
    for (let i = 0; i < 3; i++) {
      const ringGeom = new THREE.RingGeometry(0.62, 0.84, 32, 1, 0, Math.PI);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xf0aa62,
        transparent: true,
        opacity: 0.68,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const arcMesh = new THREE.Mesh(ringGeom, ringMat);
      arcMesh.position.set(roofApex[0], roofApex[1], roofApex[2] + 0.25);
      arcMesh.rotation.set(Math.PI * 0.5, 0, Math.PI * 0.15);
      this.scdsVisualizerGroup.add(arcMesh);
      this.scdsWaveArcs.push({
        mesh: arcMesh,
        initialScale: 0.95 + i * 0.42,
        phaseOffset: i * 0.33,
      });
    }

    this.scdsVisualizerGroup.visible = false;
    this.scene.add(this.scdsVisualizerGroup);
  }

  private updateRadiologyHelpers(): void {
    const isRadiology = this.state.labMode === 'radiology';

    if (this.radiologyPlaneHelperGroup) {
      if (isRadiology && this.state.radiologyState.showPlaneHelper) {
        const plane = RADIOLOGY_PLANES[this.state.radiologyState.activePlane];
        const s = this.state.radiologyState.sliceDepthMm;
        this.tempBasisX.set(plane.inPlaneX[0], plane.inPlaneX[1], plane.inPlaneX[2]);
        this.tempBasisY.set(plane.inPlaneY[0], plane.inPlaneY[1], plane.inPlaneY[2]);
        this.tempBasisZ.set(plane.normalRAS[0], plane.normalRAS[1], plane.normalRAS[2]);
        this.tempPlaneMatrix.makeBasis(
          this.tempBasisX,
          this.tempBasisY,
          this.tempBasisZ
        );
        this.radiologyPlaneHelperGroup.setRotationFromMatrix(this.tempPlaneMatrix);
        this.radiologyPlaneHelperGroup.position.set(
          plane.centerRAS[0] + s * plane.normalRAS[0],
          plane.centerRAS[1] + s * plane.normalRAS[1],
          plane.centerRAS[2] + s * plane.normalRAS[2]
        );
        this.radiologyPlaneHelperGroup.visible = true;
        this.updateRadiologySliceTexture();
      } else {
        this.radiologyPlaneHelperGroup.visible = false;
      }
    }

    if (this.scdsVisualizerGroup) {
      this.scdsVisualizerGroup.visible = isRadiology && this.state.radiologyState.scdsActive;
    }
  }

  private updateRadiologySliceTexture(): void {
    if (!this.radSliceData || !this.radSliceTexture || !this.radPlaneQuadMat) return;
    const loadedVol = getLoadedRadiologyVolume(this.state.radiologyState.windowMode);
    if (!loadedVol) {
      if (this.radSliceHasVolume) {
        this.radSliceHasVolume = false;
        this.radPlaneQuadMat.map = null;
        this.radPlaneQuadMat.color.setHex(this.isLightTheme ? 0x0c667e : 0x52dcf2);
        this.radPlaneQuadMat.opacity = this.isLightTheme ? 0.14 : 0.12;
        this.radPlaneQuadMat.needsUpdate = true;
      }
      return;
    }

    const plane = RADIOLOGY_PLANES[this.state.radiologyState.activePlane];
    const texSize = DualStageScene.RAD_TEXTURE_SIZE;
    resliceVolumeToRGBA(
      loadedVol,
      plane,
      this.state.radiologyState.sliceDepthMm,
      texSize,
      texSize,
      this.radSliceData,
      {
        fovMm: MPR_FOV_MM,
        flipHorizontal: false, // 3D PlaneGeometry +X aligns with +inPlaneX
        flipVertical: false,   // DataTexture flipY=false: row 0 is uv.y=0 (-inPlaneY)
        oobR: 0,
        oobG: 0,
        oobB: 0,
        oobAlpha: 0,           // Transparent outside CT 19.92^3 mm bounds
        inBoundsAlpha: 220,
      }
    );
    this.radSliceTexture.needsUpdate = true;

    if (!this.radSliceHasVolume) {
      this.radSliceHasVolume = true;
      this.radPlaneQuadMat.map = this.radSliceTexture;
      this.radPlaneQuadMat.color.setHex(0xffffff);
      this.radPlaneQuadMat.opacity = 0.86;
      this.radPlaneQuadMat.needsUpdate = true;
    }
  }

  public setRadiologyPlane(planeId: RadiologyPlaneId): void {
    const plane = RADIOLOGY_PLANES[planeId];
    if (!plane) return;

    this.state.radiologyState.activePlane = planeId;
    this.state.radiologyState.sliceDepthMm = plane.defaultDepthMm;

    this.startCameraFly(
      new THREE.Vector3(...plane.cameraPosRAS),
      new THREE.Vector3(...plane.cameraTargetRAS),
      550,
      new THREE.Vector3(...plane.cameraUpRAS)
    );

    this.applySceneStateToMeshes();
    this.emitState();
  }

  public setRadiologyDepth(depthMm: number): void {
    const plane = RADIOLOGY_PLANES[this.state.radiologyState.activePlane];
    const clamped = Math.max(plane.minDepthMm, Math.min(plane.maxDepthMm, depthMm));
    this.state.radiologyState.sliceDepthMm = clamped;

    if (this.state.labMode === 'radiology') {
      const clipUniforms = getShaderClipUniforms(
        plane,
        clamped,
        this.state.radiologyState.clipInverted
      );
      // Fast O(1) in-place uniform update for 60fps scrubbing without GC
      for (const entry of this.meshEntries.values()) {
        entry.material.uniforms.uClipConstant.value = clipUniforms.uClipConstant;
      }
      this.updateRadiologyHelpers();
    }

    this.emitState();
  }

  public setRadiologyClipInverted(inverted: boolean): void {
    this.state.radiologyState.clipInverted = inverted;
    if (this.state.labMode === 'radiology') {
      const plane = RADIOLOGY_PLANES[this.state.radiologyState.activePlane];
      const clipUniforms = getShaderClipUniforms(
        plane,
        this.state.radiologyState.sliceDepthMm,
        inverted
      );
      this.clipNormalVec.set(...clipUniforms.uClipNormal);
      for (const entry of this.meshEntries.values()) {
        entry.material.uniforms.uClipNormal.value.copy(this.clipNormalVec);
        entry.material.uniforms.uClipConstant.value = clipUniforms.uClipConstant;
      }
    }
    this.emitState();
  }

  public setRadiologyPlaneHelperVisible(visible: boolean): void {
    this.state.radiologyState.showPlaneHelper = visible;
    this.updateRadiologyHelpers();
    this.emitState();
  }

  public setSCDSActive(active: boolean): void {
    this.state.radiologyState.scdsActive = active;
    if (active) {
      // Snap to Pöschl's plane and +1.2 mm halo peak
      this.state.radiologyState.activePlane = 'poschl';
      this.state.radiologyState.sliceDepthMm = 1.2;
      const plane = RADIOLOGY_PLANES.poschl;
      this.startCameraFly(
        new THREE.Vector3(...plane.cameraPosRAS),
        new THREE.Vector3(...plane.cameraTargetRAS),
        550,
        new THREE.Vector3(...plane.cameraUpRAS)
      );
    }
    this.applySceneStateToMeshes();
    this.emitState();
  }

  public setCTWindowMode(mode: CTWindowMode): void {
    this.state.radiologyState.windowMode = mode;
    if (this.state.labMode === 'radiology') {
      preloadRadiologyVolumes(mode);
      if (this.state.radiologyState.showPlaneHelper) {
        this.updateRadiologySliceTexture();
      }
    }
    this.emitState();
  }

  public getRadiologyState(): RadiologyLabState {
    return { ...this.state.radiologyState };
  }

  // ===========================================================================
  // PUBLIC LAB CONTROL API
  // ===========================================================================
  private pushUndoState(): void {
    this.undoStack.push({ ...this.state.visibilityMap });
    if (this.undoStack.length > 25) {
      this.undoStack.shift();
    }
    this.state.canUndo = this.undoStack.length > 0;
  }

  public undoDissection(): void {
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.state.visibilityMap = prev;
    this.state.canUndo = this.undoStack.length > 0;
    this.applySceneStateToMeshes();
    this.emitState();
  }

  public selectStructure(meshName: string | null, flyCamera = false): void {
    this.state.selectedMesh = meshName;
    if (meshName) {
      if (this.state.isIsolated) {
        for (const item of IEMAP_STRUCTURES) {
          this.state.visibilityMap[item.meshName] =
            item.meshName === meshName ? 'visible' : 'hidden';
        }
      } else if (this.state.visibilityMap[meshName] === 'hidden') {
        this.state.visibilityMap[meshName] = 'visible';
      }
    }
    this.applySceneStateToMeshes();
    if (meshName && flyCamera) {
      this.flyToStructure(meshName);
    }
    this.emitState();
  }

  public setStructureVisibility(meshName: string, vis: VisibilityState): void {
    this.pushUndoState();
    this.state.visibilityMap[meshName] = vis;
    this.applySceneStateToMeshes();
    this.emitState();
  }

  public setSystemGroupVisibility(groupId: SystemGroupId, vis: VisibilityState): void {
    this.pushUndoState();
    for (const item of IEMAP_STRUCTURES) {
      if (item.systemGroup === groupId) {
        this.state.visibilityMap[item.meshName] = vis;
      }
    }
    if (groupId === 'bony_capsule' && vis === 'visible') {
      this.state.bonyPeelPercent = 15;
    } else if (groupId === 'bony_capsule' && vis === 'ghost') {
      this.state.bonyPeelPercent = 75;
    }
    this.applySceneStateToMeshes();
    this.emitState();
  }

  public isolateSelected(): void {
    const target = this.state.selectedMesh;
    if (!target) return;
    this.pushUndoState();
    this.state.isIsolated = true;
    for (const item of IEMAP_STRUCTURES) {
      this.state.visibilityMap[item.meshName] = item.meshName === target ? 'visible' : 'hidden';
    }
    this.applySceneStateToMeshes();
    this.flyToStructure(target);
    this.emitState();
  }

  public restoreAllVisibility(): void {
    const prev = this.undoStack.pop();
    this.state.isIsolated = false;
    if (prev) {
      this.state.visibilityMap = prev;
    } else {
      for (const item of IEMAP_STRUCTURES) {
        this.state.visibilityMap[item.meshName] = item.defaultState;
      }
    }
    this.state.canUndo = this.undoStack.length > 0;
    this.applySceneStateToMeshes();
    this.emitState();
  }

  public applyDissectionPreset(presetId: string, recordUndo = true): void {
    const preset =
      LAB_PRESETS.find((p) => p.id === presetId) ||
      DISSECTION_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    if (recordUndo) {
      this.pushUndoState();
    }
    this.state.activePresetId = preset.id;
    this.state.bonyPeelPercent = preset.bonyPeelPercent;
    this.state.explodePercent = preset.explodePercent;
    this.state.isIsolated = false;

    for (const item of IEMAP_STRUCTURES) {
      this.state.visibilityMap[item.meshName] =
        preset.states[item.meshName] ?? item.defaultState;
    }

    if (preset.defaultSelectedMesh) {
      this.state.selectedMesh = preset.defaultSelectedMesh;
    }
    this.applySceneStateToMeshes();

    if (preset.id === 'hearing_snail') {
      this.startCameraFly(
        new THREE.Vector3(10.5, 14.2, 0.8),
        new THREE.Vector3(1.4, 6.0, -2.9),
        550
      );
    } else if (preset.id === 'balance_system') {
      this.startCameraFly(
        new THREE.Vector3(21.5, -11.5, 7.2),
        new THREE.Vector3(4.5, 1.5, 0.2),
        550
      );
    } else if (preset.id === 'exploded_view') {
      this.startCameraFly(
        new THREE.Vector3(31.5, -15.5, 11.5),
        new THREE.Vector3(4.8, 1.2, 0.0),
        550
      );
    } else {
      this.startCameraFly(
        new THREE.Vector3(22.5, -10.5, 7.5),
        new THREE.Vector3(4.5, 1.5, 0.2),
        550
      );
    }

    this.emitState();
  }

  public resetAllDissection(): void {
    this.undoStack = [];
    this.state.canUndo = false;
    this.state.isIsolated = false;
    this.applyDissectionPreset('overview', false);
  }

  public setSliders(params: {
    bonyPeelPercent?: number;
    explodePercent?: number;
  }): void {
    if (params.bonyPeelPercent !== undefined) {
      this.state.bonyPeelPercent = params.bonyPeelPercent;
      if (
        params.bonyPeelPercent < 95 &&
        this.state.visibilityMap['segT2_th1.07_Otsu'] === 'hidden'
      ) {
        this.state.visibilityMap['segT2_th1.07_Otsu'] = 'ghost';
      }
    }
    if (params.explodePercent !== undefined) {
      this.state.explodePercent = params.explodePercent;
      if (!this.flyAnim) {
        const minExplodeDist = 26.5 + (params.explodePercent / 100.0) * 11.5;
        this.scratchPinVector.subVectors(this.camera.position, this.controls.target);
        const curDist = this.scratchPinVector.length();
        if (curDist > 0.001 && curDist < minExplodeDist) {
          this.scratchPinVector.multiplyScalar(minExplodeDist / curDist);
          this.camera.position.copy(this.controls.target).add(this.scratchPinVector);
          this.controls.update();
        }
      }
    }
    this.applySceneStateToMeshes();
    this.emitState();
  }

  public setOverlays(params: {
    labelMode?: LabelDensityMode;
    readingDepth?: ReadingDepth;
  }): void {
    if (params.labelMode !== undefined) this.state.labelMode = params.labelMode;
    if (params.readingDepth !== undefined) this.state.readingDepth = params.readingDepth;
    this.emitState();
  }

  public setReadingDepth(depth: ReadingDepth): void {
    this.state.readingDepth = depth;
    this.emitState();
  }

  // ===========================================================================
  // POINTER INTERACTIONS & RAYCASTING
  // ===========================================================================
  private setupPointerInteractions(): void {
    const dom = this.renderer.domElement;

    this.onPointerDownBound = (ev: PointerEvent) => {
      this.activePointers.add(ev.pointerId);
      if (this.activePointers.size > 1) {
        this.isMultiTouch = true;
      }
      this.pointerDownPos.set(ev.clientX, ev.clientY);
    };

    this.onPointerMoveBound = (ev: PointerEvent) => {
      // Skip hover raycasting during touch interaction or when orbiting (mouse button held down)
      if (ev.pointerType === 'touch' || ev.buttons > 0) {
        return;
      }
      const hitMesh = this.raycastLabyrinthAtScreen(ev.clientX, ev.clientY);
      if (hitMesh !== this.state.hoveredMesh) {
        this.state.hoveredMesh = hitMesh;
        dom.style.cursor = hitMesh ? 'pointer' : 'grab';
        this.applySceneStateToMeshes();
      }
    };

    this.onPointerUpBound = (ev: PointerEvent) => {
      const wasMultiTouch = this.isMultiTouch;
      this.activePointers.delete(ev.pointerId);
      if (this.activePointers.size === 0) {
        this.isMultiTouch = false;
      }
      if (wasMultiTouch) return;

      const moveDist = Math.hypot(
        ev.clientX - this.pointerDownPos.x,
        ev.clientY - this.pointerDownPos.y
      );
      if (moveDist > 6) return;

      if (this.state.labMode === 'hearing') {
        const cochleaHit = this.raycastCochleaAtScreen(ev.clientX, ev.clientY);
        if (cochleaHit !== null) {
          const freq = greenwoodFrequency(cochleaHit);
          this.setHearingFrequency(freq, true);
          return;
        }
      }

      const hitMesh = this.raycastLabyrinthAtScreen(ev.clientX, ev.clientY);
      if (hitMesh) {
        this.selectStructure(hitMesh, true);
        this.notifyStructurePicked(hitMesh);
      }
    };

    this.onPointerCancelBound = (ev: PointerEvent) => {
      this.activePointers.delete(ev.pointerId);
      if (this.activePointers.size === 0) {
        this.isMultiTouch = false;
      }
    };

    this.onDblClickBound = (ev: MouseEvent) => {
      const hitMesh = this.raycastLabyrinthAtScreen(ev.clientX, ev.clientY);
      if (hitMesh) {
        this.selectStructure(hitMesh, true);
      }
    };

    dom.addEventListener('pointerdown', this.onPointerDownBound, { capture: true });
    dom.addEventListener('pointermove', this.onPointerMoveBound);
    dom.addEventListener('pointerup', this.onPointerUpBound);
    dom.addEventListener('pointercancel', this.onPointerCancelBound);
    dom.addEventListener('dblclick', this.onDblClickBound);
  }

  private raycastLabyrinthAtScreen(clientX: number, clientY: number): string | null {
    const bounds = this.renderer.domElement.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return null;

    const x = clientX - bounds.left;
    const y = clientY - bounds.top;

    if (x < 0 || x > bounds.width || y < 0 || y > bounds.height) {
      return null;
    }

    const ndcX = (x / bounds.width) * 2 - 1;
    const ndcY = -(y / bounds.height) * 2 + 1;
    this.tempNDC.set(ndcX, ndcY);
    this.raycaster.setFromCamera(this.tempNDC, this.camera);

    // 1. Raycast visible internal structures (skip outer bone shell to allow picking internal organs)
    const visibleInternal = this.pickableMeshes.filter((m) => {
      const name = m.userData.meshName as string;
      const isBone = name === 'segT2_th1.07_Otsu' || name === 'seg_coch_outer_T2';
      return m.visible && this.state.visibilityMap[name] !== 'hidden' && !isBone;
    });

    const internalHits = this.raycaster.intersectObjects(visibleInternal, false);
    if (internalHits.length > 0) {
      return internalHits[0].object.userData.meshName as string;
    }

    // 2. If no internal structure hit, check bone shell if peel is low
    if (this.state.bonyPeelPercent < 60) {
      const visibleBone = this.pickableMeshes.filter((m) => {
        const name = m.userData.meshName as string;
        const isBone = name === 'segT2_th1.07_Otsu' || name === 'seg_coch_outer_T2';
        return m.visible && this.state.visibilityMap[name] !== 'hidden' && isBone;
      });
      const boneHits = this.raycaster.intersectObjects(visibleBone, false);
      if (boneHits.length > 0) {
        return boneHits[0].object.userData.meshName as string;
      }
    }

    // 3. Fallback to any visible mesh
    const anyVisible = this.pickableMeshes.filter((m) => m.visible);
    const anyHits = this.raycaster.intersectObjects(anyVisible, false);
    if (anyHits.length > 0) {
      return anyHits[0].object.userData.meshName as string;
    }

    return null;
  }

  private raycastCochleaAtScreen(clientX: number, clientY: number): number | null {
    const bounds = this.renderer.domElement.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return null;

    const x = clientX - bounds.left;
    const y = clientY - bounds.top;

    if (x < 0 || x > bounds.width || y < 0 || y > bounds.height) {
      return null;
    }

    const ndcX = (x / bounds.width) * 2 - 1;
    const ndcY = -(y / bounds.height) * 2 + 1;
    this.tempNDC.set(ndcX, ndcY);
    this.raycaster.setFromCamera(this.tempNDC, this.camera);

    const cochleaEntry = this.meshEntries.get('mesh_david_cochlea');
    if (!cochleaEntry || !cochleaEntry.mesh.visible) return null;

    const hits = this.raycaster.intersectObject(cochleaEntry.mesh, false);
    if (hits.length > 0) {
      return interpolateGreenwoodXFromIntersection(hits[0], cochleaEntry.mesh);
    }
    return null;
  }

  // ===========================================================================
  // 3D LABELS PROJECTION TO 2D OVERLAY
  // ===========================================================================
  private computeProjectedPins(width: number, height: number): ProjectedPin2D[] {
    if (this.state.labelMode === 'off' || width <= 10 || height <= 10) {
      return [];
    }

    const camDist = this.camera.position.distanceTo(this.controls.target);
    const isAllMode = this.state.labelMode === 'all';

    this.activeCandidates.length = 0;
    this.acceptedBoxCount = 0;
    this.projectedPinResults.length = 0;

    for (let i = 0; i < IEMAP_STRUCTURES.length; i++) {
      const item = IEMAP_STRUCTURES[i];
      const entry = this.meshEntries.get(item.meshName);
      if (!entry || !entry.mesh.visible) continue;
      if (item.systemGroup === 'bony_capsule') continue;

      const isKeyStruct = KEY_STRUCTURE_MESH_NAMES.has(item.meshName);
      if (!isAllMode && !isKeyStruct) continue;

      if (this.state.labMode === 'hearing' && !item.meshName.includes('coch')) {
        continue;
      }
      if (
        this.state.labMode === 'vestibular' &&
        (item.meshName.includes('coch') || item.meshName.includes('segT2'))
      ) {
        continue;
      }

      const priority = isKeyStruct ? 1 : 2;
      const maxDist = isKeyStruct ? (isAllMode ? 55 : 42) : 28;

      this.scratchPinVector.set(
        item.centroidRAS[0] + entry.mesh.position.x,
        item.centroidRAS[1] + entry.mesh.position.y,
        item.centroidRAS[2] + entry.mesh.position.z
      );
      this.scratchPinVector.project(this.camera);

      const vx = this.scratchPinVector.x;
      const vy = this.scratchPinVector.y;
      const vz = this.scratchPinVector.z;

      const sx = (vx * 0.5 + 0.5) * width;
      const sy = (-(vy * 0.5) + 0.5) * height;
      const inFrustum =
        vz > -1.0 &&
        vz < 1.0 &&
        sx >= 10 &&
        sx <= width - 10 &&
        sy >= 10 &&
        sy <= height - 10;

      const cand = this.pinCandidates[i];
      if (!cand) continue;

      cand.pin.screenX = sx;
      cand.pin.screenY = sy;
      cand.pin.visible = inFrustum;
      cand.pin.occluded = vz > 0.985;
      cand.priority = priority;
      cand.maxDist = maxDist;
      cand.depth = vz;

      this.activeCandidates.push(cand);
    }

    // Filter distance & avoid collisions
    this.activeCandidates.sort(DualStageScene.comparePinCandidates);

    for (let i = 0; i < this.activeCandidates.length; i++) {
      const cand = this.activeCandidates[i];
      if (!cand.pin.visible || camDist > cand.maxDist) {
        continue;
      }

      const boxW = Math.max(90, cand.pin.label.length * 7 + 22);
      const boxH = 26;

      // Strictly clamp pin center so that pin box always remains within screen bounds
      if (width > boxW + 16) {
        cand.pin.screenX = Math.max(boxW / 2 + 8, Math.min(width - boxW / 2 - 8, cand.pin.screenX));
      }
      if (height > boxH + 16) {
        cand.pin.screenY = Math.max(14 + 8, Math.min(height - 14 - 8, cand.pin.screenY));
      }

      // Zero-GC vertical nudge pass (0, -22, +22 px) before dropping clustered pins
      let accepted = false;
      let finalBx = 0;
      let finalBy = 0;
      const baseScreenY = cand.pin.screenY;

      for (let n = 0; n < 3; n++) {
        const dy = n === 0 ? 0 : n === 1 ? -22 : 22;
        const ny =
          height > boxH + 16
            ? Math.max(14 + 8, Math.min(height - 14 - 8, baseScreenY + dy))
            : baseScreenY + dy;
        const bx = cand.pin.screenX - boxW / 2;
        const by = ny - 14;

        if (bx < 8 || bx + boxW > width - 8 || by < 8 || by + boxH > height - 8) {
          continue;
        }

        let collides = false;
        for (let j = 0; j < this.acceptedBoxCount; j++) {
          const acc = this.acceptedBoxes[j];
          if (
            !(
              bx + boxW < acc.x - 8 ||
              bx > acc.x + acc.w + 8 ||
              by + boxH < acc.y - 6 ||
              by > acc.y + acc.h + 6
            )
          ) {
            collides = true;
            break;
          }
        }

        if (!collides) {
          cand.pin.screenY = ny;
          finalBx = bx;
          finalBy = by;
          accepted = true;
          break;
        }
      }

      if (accepted) {
        let box = this.acceptedBoxes[this.acceptedBoxCount];
        if (!box) {
          box = { x: 0, y: 0, w: 0, h: 0 };
          this.acceptedBoxes.push(box);
        }
        box.x = finalBx;
        box.y = finalBy;
        box.w = boxW;
        box.h = boxH;
        this.acceptedBoxCount++;
        this.projectedPinResults.push(cand.pin);
      }
    }

    return this.projectedPinResults;
  }

  // ===========================================================================
  // 60FPS RENDER LOOP
  // ===========================================================================
  public startRenderLoop(): void {
    if (this.animationFrameId !== 0) return;
    this.lastFrameTime = performance.now();
    const renderFrame = (now: number) => {
      this.animationFrameId = requestAnimationFrame(renderFrame);
      const dt = Math.min(0.1, (now - this.lastFrameTime) * 0.001);
      this.lastFrameTime = now;

      // Update Traveling Wave Phase & Beacon Halo on Cochlea System
      if (this.state.labMode === 'hearing') {
        const isPlaying = this.state.hearingState.isPlaying;
        for (const entry of this.meshEntries.values()) {
          if (entry.ontology.systemGroup === 'cochlear_system') {
            entry.material.uniforms.uWavePhase.value += dt * (isPlaying ? 18.0 : 4.2);
          }
        }
        if (this.tonotopyHaloMesh) {
          const pulse = isPlaying
            ? 1.0 + 0.22 * Math.sin(now * 0.008)
            : 0.94 + 0.08 * Math.sin(now * 0.003);
          this.tonotopyHaloMesh.scale.setScalar(pulse);
        }
      }

      // Update Surgical Simulation Time on Shaders
      if (this.state.labMode === 'surgical') {
        this.surgicalSimTime += dt;
        const entrySV = this.meshEntries.get('seg_coch_inner_scala_vestibuli');
        if (entrySV && entrySV.material) {
          entrySV.material.uniforms.uSurgicalTime.value = this.surgicalSimTime;
        }
        const entrySl = this.meshEntries.get('ls_Hsapiens_Sl');
        if (entrySl && entrySl.material) {
          entrySl.material.uniforms.uSurgicalTime.value = this.surgicalSimTime;
        }
        const entrySa = this.meshEntries.get('ls_Hsapiens_Sa');
        if (entrySa && entrySa.material) {
          entrySa.material.uniforms.uSurgicalTime.value = this.surgicalSimTime;
        }
        const entrySp = this.meshEntries.get('ls_Hsapiens_Sp');
        if (entrySp && entrySp.material) {
          entrySp.material.uniforms.uSurgicalTime.value = this.surgicalSimTime;
        }
        const entryOtsu = this.meshEntries.get('segT2_th1.07_Otsu');
        if (entryOtsu && entryOtsu.material) {
          entryOtsu.material.uniforms.uSurgicalTime.value = this.surgicalSimTime;
        }
      }

      // Update Camera Fly-To interpolation
      if (this.flyAnim && this.flyAnim.active) {
        const elapsed = now - this.flyAnim.startTime;
        const u = Math.min(1.0, elapsed / this.flyAnim.durationMs);
        const ease = 1.0 - Math.pow(1.0 - u, 3);
        this.camera.position.lerpVectors(
          this.flyAnim.fromPos,
          this.flyAnim.toPos,
          ease
        );
        this.controls.target.lerpVectors(
          this.flyAnim.fromTarget,
          this.flyAnim.toTarget,
          ease
        );
        if (this.flyAnim.fromUp && this.flyAnim.toUp) {
          this.camera.up.lerpVectors(this.flyAnim.fromUp, this.flyAnim.toUp, ease).normalize();
        }
        if (u >= 1.0) {
          this.flyAnim.active = false;
        }
      }

      // Animate SCDS Sound Shunting Dispersion Waves
      if (
        this.state.labMode === 'radiology' &&
        this.state.radiologyState.scdsActive &&
        this.scdsWaveArcs.length > 0
      ) {
        const t = now * 0.0025;
        for (const arc of this.scdsWaveArcs) {
          const phase = (t + arc.phaseOffset) % 1.0;
          const s = arc.initialScale + phase * 0.75;
          arc.mesh.scale.set(s, s, s);
          const mat = arc.mesh.material as THREE.MeshBasicMaterial;
          mat.opacity = (1.0 - phase) * 0.65;
        }
      }

      // Advance Vestibular Physics & Otoconia Particles in Vestibular Mode
      if (this.state.labMode === 'vestibular') {
        const simDt = Math.min(dt, 0.033);
        let telem: VestibularTelemetryState;

        if (this.vestSubmode === 'bppv') {
          if (this.vestibularEngine) {
            telem = this.vestibularEngine.stepPhysics(
              simDt,
              this.currentYaw,
              this.currentPitch,
              this.currentRoll
            );
            const isGufoniCupulolith =
              this.vestibularEngine.getManeuver() === 'gufoni_apogeotropic' &&
              this.vestibularEngine.getStepIndex() <= 1;
            const particles = this.vestibularEngine.getParticles();
            for (let i = 0; i < 5; i++) {
              const mesh = this.otoconiaMeshes[i];
              if (!mesh) continue;
              if (isGufoniCupulolith) {
                const off = this.gravityIndicatorOffsets[i];
                mesh.position.set(7.66 + off[0], 2.88 + off[1], 1.03 + off[2]);
              } else {
                const p = particles[i];
                if (p) {
                  mesh.position.set(p[0], p[1], p[2]);
                }
              }
            }
          } else {
            telem = this.createDefaultVestibularTelemetry('posterior');
          }
        } else {
          // Diagnostic testing modes: caloric or vhit
          if (this.vestibularEngine) {
            telem = { ...this.vestibularEngine.getTelemetry(this.currentYaw, this.currentPitch, this.currentRoll) };
          } else {
            telem = this.createDefaultVestibularTelemetry('horizontal');
          }

          if (this.vestSubmode === 'caloric') {
            telem.canalId = 'horizontal';
            telem.clearancePercent = 0;
            telem.patientSensation = 'Calm (No Spinning)';
            telem.nystagmusState = 'Resting Equilibrium';

            if (this.activeCaloricState && this.activeCaloricState.active) {
              telem.cupulaDeflectionNormalized = this.activeCaloricState.cupulaDeflection;
              telem.afferentSpikesPerSec = this.activeCaloricState.afferentFiringRate;
              telem.slowPhaseVelocityDegPerSec = {
                horizontal: this.activeCaloricState.slowPhaseHorizDegPerSec,
                vertical: 0,
                torsional: 0,
              };
              telem.fastPhaseBeatDirection = this.activeCaloricState.fastPhaseBeatDirection;
              telem.ewaldLawActive = this.activeCaloricState.isAmpullopetal
                ? "Ewald's 2nd Law: Ampullopetal excitation (horizontal canal)"
                : "Ewald's 2nd Law: Ampullofugal inhibition (horizontal canal)";
              telem.nystagmusState = `Caloric Convection: ${this.activeCaloricState.fastPhaseBeatDirection}`;
              telem.patientSensation = this.activeCaloricState.slowPhaseHorizDegPerSec !== 0
                ? 'Spinning (Crystals Moving)'
                : 'Calm (No Spinning)';
            }
          } else {
            // 'vhit'
            const vCanal: CanalId =
              this.vhitAnim?.pair === 'ralp'
                ? 'anterior'
                : this.vhitAnim?.pair === 'larp'
                ? 'posterior'
                : 'horizontal';
            telem.canalId = vCanal;
            telem.clearancePercent = 0;
            telem.cupulaDeflectionNormalized = 0;
            telem.afferentSpikesPerSec = 90;
            telem.slowPhaseVelocityDegPerSec = { horizontal: 0, vertical: 0, torsional: 0 };
            telem.fastPhaseBeatDirection = 'None (Resting)';
            telem.ewaldLawActive = "Ewald's Law: High-Acceleration Dynamic VOR Evaluation";
            telem.patientSensation = 'Calm (No Spinning)';
            telem.nystagmusState = 'Target Fixed (Resting Fixation)';
          }
        }

        if (this.vorDrawer && this.vorDrawer.getIsOpen()) {
          this.vorDrawer.updateTelemetry(telem, simDt);
        }

        const cupulaGlow = Math.min(
          1.0,
          Math.abs(telem.cupulaDeflectionNormalized) * 0.9 +
            Math.abs(telem.afferentSpikesPerSec - 90) / 140.0
        );
        this.applyVestibularCupulaGlow(telem.canalId, cupulaGlow);

        for (let i = 0; i < this.onVestibularTelemetryCallbacks.length; i++) {
          this.onVestibularTelemetryCallbacks[i](telem);
        }
      }

      // 3D Head / Labyrinth Physical Tilt in BPPV Mode relative to World Gravity (-Z)
      if (!this.vhitAnim || !this.vhitAnim.active) {
        if (this.state.labMode === 'vestibular' && this.vestSubmode === 'bppv') {
          const psi = (this.currentYaw * Math.PI) / 180.0;
          const th = (this.currentPitch * Math.PI) / 180.0;
          const gam = (this.currentRoll * Math.PI) / 180.0;
          const cPsi = Math.cos(psi);
          const sPsi = Math.sin(psi);
          const cTh = Math.cos(th);
          const sTh = Math.sin(th);
          const cGam = Math.cos(gam);
          const sGam = Math.sin(gam);
          this.headRotMatrix4.set(
            cPsi * cGam, -sPsi, cPsi * sGam, 0,
            cTh * sPsi * cGam + sTh * sGam, cTh * cPsi, cTh * sPsi * sGam - sTh * cGam, 0,
            sTh * sPsi * cGam - cTh * sGam, sTh * cPsi, sTh * sPsi * sGam + cTh * cGam, 0,
            0, 0, 0, 1
          );
          this.headTargetQuat.setFromRotationMatrix(this.headRotMatrix4);
          this.labyrinthRoot.quaternion.slerp(this.headTargetQuat, Math.min(1.0, dt * 8.5));
          this.tempPivotRotated.copy(this.LABYRINTH_PIVOT_RAS).applyQuaternion(this.labyrinthRoot.quaternion);
          this.labyrinthRoot.position.copy(this.LABYRINTH_PIVOT_RAS).sub(this.tempPivotRotated);
        } else if (this.labyrinthRoot.quaternion.angleTo(this.qIdentity) > 0.002) {
          this.labyrinthRoot.quaternion.slerp(this.qIdentity, Math.min(1.0, dt * 10.0));
          this.tempPivotRotated.copy(this.LABYRINTH_PIVOT_RAS).applyQuaternion(this.labyrinthRoot.quaternion);
          this.labyrinthRoot.position.copy(this.LABYRINTH_PIVOT_RAS).sub(this.tempPivotRotated);
        } else {
          this.labyrinthRoot.quaternion.identity();
          this.labyrinthRoot.position.set(0, 0, 0);
        }
      }

      // vHIT Head Impulse Passive Rotation Animation
      if (this.vhitAnim && this.vhitAnim.active) {
        const elapsed = (now - this.vhitAnim.startTime) / 1000.0;
        if (elapsed <= 0.120) {
          computeVHITHeadQuaternion(elapsed, this.vhitAnim.pair, this.vhitAnim.direction, this.vhitQuatArray);
          this.qVHITTmp.set(this.vhitQuatArray[0], this.vhitQuatArray[1], this.vhitQuatArray[2], this.vhitQuatArray[3]);
          this.labyrinthRoot.quaternion.copy(this.qVHITTmp);
        } else if (elapsed <= 0.300) {
          computeVHITHeadQuaternion(0.120, this.vhitAnim.pair, this.vhitAnim.direction, this.vhitQuatArray);
          this.qVHITTmp.set(this.vhitQuatArray[0], this.vhitQuatArray[1], this.vhitQuatArray[2], this.vhitQuatArray[3]);
          this.labyrinthRoot.quaternion.copy(this.qVHITTmp);
        } else if (elapsed <= 0.600) {
          const returnFrac = (elapsed - 0.300) / 0.300;
          const s = returnFrac * returnFrac * (3.0 - 2.0 * returnFrac);
          computeVHITHeadQuaternion(0.120, this.vhitAnim.pair, this.vhitAnim.direction, this.vhitQuatArray);
          this.qVHITTmp.set(this.vhitQuatArray[0], this.vhitQuatArray[1], this.vhitQuatArray[2], this.vhitQuatArray[3]);
          this.labyrinthRoot.quaternion.slerpQuaternions(this.qVHITTmp, this.qIdentity, s);
        } else {
          this.labyrinthRoot.quaternion.identity();
          this.controls.enabled = true;
          if (this.vorDrawer) {
            this.vorDrawer.clearVHITPlayback();
          }
          const cb = this.vhitAnim.onComplete;
          this.vhitAnim = null;
          if (cb) cb();
        }

        // Live high-speed vHIT playback stream to VORDrawer & Eye Avatar
        if (this.vhitAnim && this.vorDrawer && elapsed <= 0.350) {
          const ms = Math.min(349, Math.floor(elapsed * 1000));
          this.vorDrawer.updateVHITPlayback(elapsed, ms, this.vhitAnim.pair, this.vhitAnim.direction);

          // Stream live vHIT CN VIII firing rate and kinematics to telemetry bus
          const vhitBuf = this.vorDrawer.getVHITBuffer();
          if (vhitBuf) {
            const cn8Firing = vhitBuf.cn8FiringRateArray[ms];
            const vCanal: CanalId =
              this.vhitAnim.pair === 'ralp'
                ? 'anterior'
                : this.vhitAnim.pair === 'larp'
                ? 'posterior'
                : 'horizontal';
            const baseTelem = this.vestibularEngine
              ? this.vestibularEngine.getTelemetry(this.currentYaw, this.currentPitch, this.currentRoll)
              : this.createDefaultVestibularTelemetry(vCanal);
            const vhitTelem: VestibularTelemetryState = {
              ...baseTelem,
              canalId: vCanal,
              cupulaDeflectionNormalized: Math.min(1.0, vhitBuf.headVelArray[ms] / 150.0),
              afferentSpikesPerSec: cn8Firing,
              slowPhaseVelocityDegPerSec: { horizontal: vhitBuf.invertedEyeVelArray[ms], vertical: 0, torsional: 0 },
              fastPhaseBeatDirection: vhitBuf.saccadeFlags[ms] > 0 ? 'Catch-Up Saccade' : 'VOR Compensation',
              ewaldLawActive: cn8Firing > 120
                ? "Ewald's Law: High-speed ampullopetal angular acceleration excitation"
                : "Ewald's Law: High-speed angular acceleration response",
              clearancePercent: 0,
              patientSensation: vhitBuf.saccadeFlags[ms] > 0
                ? 'Spinning (Crystals Moving)'
                : 'Calm (No Spinning)',
              nystagmusState: vhitBuf.saccadeFlags[ms] === 1
                ? 'Covert Saccade (Intra-Thrust)'
                : vhitBuf.saccadeFlags[ms] === 2
                ? 'Overt Saccade (Post-Thrust Refixation)'
                : 'VOR Conjugate Slow Phase',
            };
            const vhitGlow = Math.min(1.0, Math.abs(vhitBuf.headVelArray[ms]) / 160.0);
            this.applyVestibularCupulaGlow(vCanal, vhitGlow);
            for (let i = 0; i < this.onVestibularTelemetryCallbacks.length; i++) {
              this.onVestibularTelemetryCallbacks[i](vhitTelem);
            }
          }
        }
      }

      this.controls.update();

      // Smooth sidebar/bottom-sheet stage framing inset transition (zero allocations)
      if (
        Math.abs(this.currentLeftInset - this.targetLeftInset) > 0.4 ||
        Math.abs(this.currentBottomInset - this.targetBottomInset) > 0.4
      ) {
        if (this.isReducedMotion) {
          this.currentLeftInset = this.targetLeftInset;
          this.currentBottomInset = this.targetBottomInset;
        } else {
          const factor = 1 - Math.exp(-dt * 12);
          this.currentLeftInset = THREE.MathUtils.lerp(this.currentLeftInset, this.targetLeftInset, factor);
          this.currentBottomInset = THREE.MathUtils.lerp(this.currentBottomInset, this.targetBottomInset, factor);
        }
        this.applyStageFraming(false);
      } else if (
        this.currentLeftInset !== this.targetLeftInset ||
        this.currentBottomInset !== this.targetBottomInset
      ) {
        this.currentLeftInset = this.targetLeftInset;
        this.currentBottomInset = this.targetBottomInset;
        this.applyStageFraming(true);
      }

      const canvasW = this.container.clientWidth;
      const canvasH = this.container.clientHeight;
      if (canvasW === 0 || canvasH === 0) return;

      const targetPR = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
      if (this.renderer.getPixelRatio() !== targetPR) {
        this.renderer.setPixelRatio(targetPR);
        this.renderer.setSize(canvasW, canvasH, false);
        this.camera.aspect = canvasW / canvasH;
        this.camera.fov = canvasW < canvasH ? 40 : 34;
        this.applyStageFraming(true);
      }

      const rendererSize = this.renderer.getSize(this.tempRendererSize);
      if (rendererSize.x !== canvasW || rendererSize.y !== canvasH) {
        this.renderer.setSize(canvasW, canvasH, false);
        this.camera.aspect = canvasW / canvasH;
        this.camera.fov = canvasW < canvasH ? 40 : 34;
        this.applyStageFraming(true);
      }

      this.renderer.render(this.scene, this.camera);

      if (this.onPinsUpdateCallbacks.length > 0) {
        const pins = this.computeProjectedPins(canvasW, canvasH);
        for (const cb of this.onPinsUpdateCallbacks) {
          cb(pins);
        }
      }
    };

    this.animationFrameId = requestAnimationFrame(renderFrame);
  }

  public getSnapshot(): LabSceneSnapshot {
    return { ...this.state };
  }

  public onStateChange(cb: (snap: LabSceneSnapshot) => void): void {
    this.onStateChangeCallbacks.push(cb);
  }

  public onPinsUpdate(cb: (pins: ProjectedPin2D[]) => void): void {
    this.onPinsUpdateCallbacks.push(cb);
  }

  public onStructurePicked(cb: (meshName: string) => void): void {
    this.onStructurePickedCallbacks.push(cb);
  }

  public onVestibularTelemetry(cb: (telem: VestibularTelemetryState) => void): void {
    this.onVestibularTelemetryCallbacks.push(cb);
  }

  public onSurgicalStateUpdate(cb: SurgicalStateCallback): () => void {
    this.onSurgicalStateCallbacks.push(cb);
    return () => {
      const idx = this.onSurgicalStateCallbacks.indexOf(cb);
      if (idx !== -1) {
        this.onSurgicalStateCallbacks.splice(idx, 1);
      }
    };
  }

  private notifySurgicalState(): void {
    for (let i = 0; i < this.onSurgicalStateCallbacks.length; i++) {
      this.onSurgicalStateCallbacks[i](this.state.surgicalState);
    }
    if (this.surgicalDrawer) {
      this.surgicalDrawer.updateTelemetry(this.state.surgicalState);
    }
  }

  private handleContextLost(): void {
    console.warn('[DualStageScene] WebGL context lost.');
    if (this.animationFrameId !== 0) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = 0;
    }
  }

  private handleContextRestored(): void {
    if (this.isDisposed) return;
    console.info('[DualStageScene] WebGL context restored. Resuming render loop...');
    this.initEnvironmentLighting();
    this.lastFrameTime = performance.now();
    this.startRenderLoop();
  }

  private createDefaultVestibularTelemetry(canal: CanalId = 'posterior'): VestibularTelemetryState {
    return {
      canalId: canal,
      maneuverId: 'epley',
      stepIndex: 0,
      psiYawDeg: this.currentYaw,
      thetaPitchDeg: this.currentPitch,
      thetaReclineDeg: 0,
      gammaRollDeg: this.currentRoll,
      phiDeg: 0,
      arcMm: 0,
      velocityDegPerSec: 0,
      gravityAlongCanal: 0,
      cupulaDeflectionNormalized: 0,
      afferentSpikesPerSec: 90,
      nystagmusState: 'Target Fixed (Resting Fixation)',
      slowPhaseVelocityDegPerSec: { horizontal: 0, vertical: 0, torsional: 0 },
      fastPhaseBeatDirection: 'None (Resting)',
      ewaldLawActive: canal === 'posterior'
        ? "Ewald's 3rd Law: Ampullofugal flow excites posterior canal"
        : "Ewald's 2nd Law: Ampullopetal flow excites horizontal canal",
      anatomicalRegion: canal === 'posterior' ? 'Posterior Ampulla' : 'Horizontal Ampulla',
      clearancePercent: 0,
      patientSensation: 'Calm (No Spinning)',
      patientLocation: 'Sitting Upright',
      centerRAS: [0, 0, 0],
      tangentRAS: [0, 0, 0],
      tangentWorld: [0, 0, 0],
      particlesRAS: [],
    };
  }

  private notifyStructurePicked(meshName: string): void {
    for (const cb of this.onStructurePickedCallbacks) {
      cb(meshName);
    }
  }

  private emitState(): void {
    const snap = this.getSnapshot();
    for (const cb of this.onStateChangeCallbacks) {
      cb(snap);
    }
  }

  public getVestibularEngine(): VestibularDynamicsEngine | null {
    return this.vestibularEngine;
  }

  public setVestibularEngine(engine: VestibularDynamicsEngine): void {
    this.vestibularEngine = engine;
  }

  public getOtoconiaGroup(): THREE.Group | null {
    return this.otoconiaGroup;
  }

  public getOtoconiaMeshes(): THREE.Mesh[] {
    return this.otoconiaMeshes;
  }

  public setHeadOrientation(yaw: number, pitch: number, roll: number): void {
    this.currentYaw = yaw;
    this.currentPitch = pitch;
    this.currentRoll = roll;
  }

  private applyVestibularCupulaGlow(activeCanal: CanalId, intensity: number): void {
    const clamped = Math.max(0.0, Math.min(1.0, intensity));
    const pairs: Array<[CanalId, string]> = [
      ['posterior', 'ls_Hsapiens_Post_Cup_Duct'],
      ['posterior', 'ls_Hsapiens_Post_Cup_Ut'],
      ['horizontal', 'ls_Hsapiens_Lat_Cup_Duct'],
      ['horizontal', 'ls_Hsapiens_Lat_Cup_Ut'],
      ['anterior', 'ls_Hsapiens_Ant_Cup_Duct'],
      ['anterior', 'ls_Hsapiens_Ant_Cup_Ut'],
    ];
    for (let i = 0; i < pairs.length; i++) {
      const [cId, meshName] = pairs[i];
      const entry = this.meshEntries.get(meshName);
      if (!entry) continue;
      let baseHL = 0.0;
      if (this.state.selectedMesh === meshName) baseHL = 1.0;
      else if (this.state.hoveredMesh === meshName) baseHL = 0.45;
      const glow = this.state.labMode === 'vestibular' && cId === activeCanal ? clamped : 0.0;
      entry.material.uniforms.uHighlight.value = Math.max(baseHL, glow);
    }
  }

  public setVestibularSubmode(submode: 'bppv' | 'caloric' | 'vhit'): void {
    this.vestSubmode = submode;
    this.applyVestibularCupulaGlow('posterior', 0.0);
    this.syncAuxiliaryGroupVisibility();
  }

  public getVestibularSubmode(): 'bppv' | 'caloric' | 'vhit' {
    return this.vestSubmode;
  }

  public getHeadOrientation(): { yaw: number; pitch: number; roll: number } {
    return { yaw: this.currentYaw, pitch: this.currentPitch, roll: this.currentRoll };
  }

  public setVORDrawer(drawer: IVORDrawerTarget | null): void {
    this.vorDrawer = drawer;
  }

  public getVORDrawer(): IVORDrawerTarget | null {
    return this.vorDrawer;
  }

  public resetVestibularCrystals(): void {
    if (this.vestibularEngine) {
      this.vestibularEngine.resetStateToManeuver(this.vestibularEngine.getManeuver());
      const particles = this.vestibularEngine.getParticles();
      for (let i = 0; i < 5; i++) {
        const p = particles[i];
        if (p && this.otoconiaMeshes[i]) {
          this.otoconiaMeshes[i].position.set(p[0], p[1], p[2]);
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Diagnostic Vestibular Testing API (Caloric & vHIT)
  // ---------------------------------------------------------------------------

  public setCaloricUniforms(
    active: boolean,
    tempDiff: number,
    diffusion: number,
    timeSec: number
  ): void {
    const entry = this.meshEntries.get('ls_Hsapiens_Sl');
    if (entry && entry.material) {
      const u = entry.material.uniforms as unknown as Gate3ShaderUniforms;
      const shouldBeActive = active && this.state.labMode === 'vestibular';
      u.uCaloricActive.value = shouldBeActive ? 1.0 : 0.0;
      u.uCaloricTempDiff.value = shouldBeActive ? tempDiff : 0.0;
      u.uCaloricDiffusion.value = shouldBeActive ? diffusion : 0.0;
      u.uCaloricTime.value = shouldBeActive ? timeSec : 0.0;
    }
  }

  public setLabyrinthLaterality(ear: 'right' | 'left'): void {
    this.currentLaterality = ear;
    const isLeft = ear === 'left';
    this.labyrinthRoot.scale.x = isLeft ? -1.0 : 1.0;
    this.labyrinthRoot.updateMatrixWorld(true);

    const mirroredVal = isLeft ? 1.0 : 0.0;
    for (const entry of this.meshEntries.values()) {
      if (entry.material && entry.material.uniforms) {
        const u = entry.material.uniforms as unknown as Gate3ShaderUniforms;
        if (u.uMirrored) {
          u.uMirrored.value = mirroredVal;
        }
      }
    }
  }

  public getLabyrinthLaterality(): 'right' | 'left' {
    return this.currentLaterality;
  }

  public setCaloricSimulationState(
    active: boolean,
    conv: CaloricConvectionState | null,
    alexSPV = 0
  ): void {
    if (!active || !conv) {
      this.activeCaloricState = null;
      return;
    }
    const slowPhaseHoriz =
      conv.fastPhaseBeatDirection === 'Right-Beating'
        ? -alexSPV
        : conv.fastPhaseBeatDirection === 'Left-Beating'
        ? +alexSPV
        : 0;

    this.activeCaloricState = {
      active: true,
      cupulaDeflection: Math.abs(conv.cupulaDeflection),
      afferentFiringRate: conv.afferentFiringRate,
      slowPhaseHorizDegPerSec: slowPhaseHoriz,
      fastPhaseBeatDirection: conv.fastPhaseBeatDirection,
      flowDirection: conv.flowDirection,
      isAmpullopetal: conv.isAmpullopetal,
    };
  }

  public getCaloricSimulationState(): {
    active: boolean;
    cupulaDeflection: number;
    afferentFiringRate: number;
    slowPhaseHorizDegPerSec: number;
    fastPhaseBeatDirection: string;
    flowDirection: string;
    isAmpullopetal: boolean;
  } | null {
    return this.activeCaloricState;
  }

  public flyToCaloricPosture(): void {
    // Supine +30° head-up posture (θ_pitch = +60°)
    this.currentYaw = 0.0;
    this.currentPitch = 60.0;
    this.currentRoll = 0.0;

    const fromPos = this.camera.position.clone();
    const toPos = new THREE.Vector3(18.0, -14.0, 16.0);
    const fromTarget = this.controls.target.clone();
    const toTarget = new THREE.Vector3(6.0, 2.0, 2.0);

    this.flyAnim = {
      active: true,
      startTime: performance.now(),
      durationMs: 900,
      fromPos,
      toPos,
      fromTarget,
      toTarget,
      fromUp: this.camera.up.clone(),
      toUp: new THREE.Vector3(0, 0, 1),
    };
  }

  public triggerVHITThrust(
    pair: VHITCanalPair,
    direction: 1 | -1 = 1,
    onComplete?: () => void
  ): void {
    if (this.vhitAnim && this.vhitAnim.active) return;
    this.controls.enabled = false;
    this.vhitAnim = {
      active: true,
      startTime: performance.now(),
      pair,
      direction,
      onComplete,
    };
  }

  public cancelVHITThrust(): void {
    if (this.vhitAnim) {
      const cb = this.vhitAnim.onComplete;
      this.vhitAnim.active = false;
      this.vhitAnim = null;
      if (cb) {
        try {
          cb();
        } catch {
          // swallow any callback errors on cancel
        }
      }
    }
    if (this.controls) {
      this.controls.enabled = true;
    }
    if (this.labyrinthRoot) {
      this.labyrinthRoot.quaternion.identity();
    }
  }

  // ---------------------------------------------------------------------------
  // Stage 4: Surgical Simulation API (CI, Labyrinthectomy, Neurectomy)
  // ---------------------------------------------------------------------------

  public setSurgicalDrawer(drawer: ISurgicalDrawerTarget | null): void {
    this.surgicalDrawer = drawer;
    if (this.surgicalDrawer) {
      this.surgicalDrawer.updateTelemetry(this.state.surgicalState);
    }
  }

  public getSurgicalDrawer(): ISurgicalDrawerTarget | null {
    return this.surgicalDrawer;
  }

  public getSurgicalState(): SurgicalLabState {
    return this.state.surgicalState;
  }

  public setSurgicalProcedure(procedure: SurgicalProcedure): void {
    this.state.surgicalState.activeProcedure = procedure;
    this.state.selectedMesh =
      procedure === 'cochlear_implant'
        ? 'mesh_david_cochlea'
        : procedure === 'labyrinthectomy'
        ? 'ls_Hsapiens_Sl'
        : 'ls_Hsapiens_utricle';
    if (this.state.labMode === 'surgical') {
      this.flyToSurgicalProcedure(procedure);
    }
    this.syncAuxiliaryGroupVisibility();
    this.applySceneStateToMeshes();
    this.notifySurgicalState();
    this.emitState();
  }

  public flyToSurgicalProcedure(procedure: SurgicalProcedure): void {
    let camInfo = SURGICAL_CAMERA_PERSPECTIVES.cochlearImplant;
    if (procedure === 'labyrinthectomy') {
      camInfo = SURGICAL_CAMERA_PERSPECTIVES.labyrinthectomy;
    } else if (procedure === 'neurectomy') {
      camInfo = SURGICAL_CAMERA_PERSPECTIVES.neurectomy;
    }

    this.startCameraFly(
      new THREE.Vector3(...camInfo.cameraPosRAS),
      new THREE.Vector3(...camInfo.targetRAS),
      550,
      new THREE.Vector3(...camInfo.cameraUpRAS)
    );
  }

  public updateCIArray(
    depthMm: number,
    arrayType: CIArrayType = 'lateral_wall',
    approach: CIApproach = 'round_window',
    pitchDev = 0,
    yawDev = 0
  ): CIInsertionState {
    const ciState = computeCIInsertionKinematics(depthMm, arrayType, approach, pitchDev, yawDev);
    this.state.surgicalState.ciState = ciState;

    if (this.ciCarrierMesh && this.ciContactMeshes.length > 0) {
      const posAttr = this.ciCarrierMesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      const positions = posAttr.array as Float32Array;
      const SEGMENTS = 64;
      const RADIAL = 8;

      const sMax = ciState.insertionDepthMm;
      const visibleCount = sMax > 0.05 ? SEGMENTS + 1 : 0;

      // Orient CI Entry Portal Ring + Approach Arrow & keep starter tip visible at 0.0 mm
      const p0 = evaluateScalaTympaniSpline(0.0, approach, arrayType, pitchDev, yawDev);
      const p1 = evaluateScalaTympaniSpline(1.6, approach, arrayType, pitchDev, yawDev);
      if (this.ciEntryPortalGroup) {
        this.scratchEntryPos.set(p0[0], p0[1], p0[2]);
        this.scratchEntryNext.set(p1[0], p1[1], p1[2]);
        this.scratchEntryDir.subVectors(this.scratchEntryNext, this.scratchEntryPos).normalize();
        this.ciEntryPortalGroup.position.copy(this.scratchEntryPos);
        this.ciEntryPortalGroup.quaternion.setFromUnitVectors(this.scratchUpZ, this.scratchEntryDir);
        const portalHex = approach === 'cochleostomy' ? 0xf59e0b : 0x38bdf8;
        this.ciEntryRingMat?.color.setHex(portalHex);
        this.ciEntryArrowMat?.color.setHex(portalHex);
      }
      if (this.ciStarterTipMesh) {
        this.ciStarterTipMesh.position.set(p0[0], p0[1], p0[2]);
        this.ciStarterTipMesh.visible = sMax <= 0.15;
      }

      for (let i = 0; i <= SEGMENTS; i++) {
        const frac = i / SEGMENTS;
        const s = frac * sMax;
        const pt = evaluateScalaTympaniSpline(s, approach, arrayType, pitchDev, yawDev);
        this.ciCenterPointsTmp[i] = pt;
        positions[i * 3] = pt[0];
        positions[i * 3 + 1] = pt[1];
        positions[i * 3 + 2] = pt[2];
      }
      posAttr.needsUpdate = true;
      this.ciCarrierMesh.geometry.setDrawRange(0, visibleCount);
      this.ciCarrierMesh.visible = visibleCount > 0;

      // Update Procedural 3D Silicone Carrier Tube Mesh vertices
      if (this.ciCarrierTubeMesh) {
        const tubePosAttr = this.ciCarrierTubeMesh.geometry.getAttribute('position') as THREE.BufferAttribute;
        const tubePositions = tubePosAttr.array as Float32Array;
        const radius = 0.20;

        for (let j = 0; j <= SEGMENTS; j++) {
          const pt = this.ciCenterPointsTmp[j];
          const nextPt = j < SEGMENTS ? this.ciCenterPointsTmp[j + 1] : this.ciCenterPointsTmp[j];
          const prevPt = j > 0 ? this.ciCenterPointsTmp[j - 1] : this.ciCenterPointsTmp[j];

          let tx = nextPt[0] - prevPt[0];
          let ty = nextPt[1] - prevPt[1];
          let tz = nextPt[2] - prevPt[2];
          const tLen = Math.hypot(tx, ty, tz) || 1e-4;
          tx /= tLen;
          ty /= tLen;
          tz /= tLen;

          let nx = -ty;
          let ny = tx;
          let nz = 0;
          let nLen = Math.hypot(nx, ny, nz);
          if (nLen < 1e-3) {
            nx = 1;
            ny = 0;
            nz = 0;
          } else {
            nx /= nLen;
            ny /= nLen;
            nz /= nLen;
          }

          const bx = ty * nz - tz * ny;
          const by = tz * nx - tx * nz;
          const bz = tx * ny - ty * nx;

          for (let i = 0; i <= RADIAL; i++) {
            const angle = (i / RADIAL) * Math.PI * 2;
            const cosA = Math.cos(angle);
            const sinA = Math.sin(angle);
            const vx = pt[0] + radius * (cosA * nx + sinA * bx);
            const vy = pt[1] + radius * (cosA * ny + sinA * by);
            const vz = pt[2] + radius * (cosA * nz + sinA * bz);

            const vIdx = (j * (RADIAL + 1) + i) * 3;
            tubePositions[vIdx] = vx;
            tubePositions[vIdx + 1] = vy;
            tubePositions[vIdx + 2] = vz;
          }
        }
        tubePosAttr.needsUpdate = true;
        this.ciCarrierTubeMesh.geometry.setDrawRange(0, visibleCount > 0 ? SEGMENTS * RADIAL * 6 : 0);
        this.ciCarrierTubeMesh.visible = visibleCount > 0;
      }

      // Position the 22 platinum contacts
      // Contact 0 = E1 (apical lead at array tip)
      // Contact 21 = E22 (basal lead near round window)
      for (let i = 0; i < 22; i++) {
        const offset = i * 1.10;
        const contactDepth = sMax - offset;
        const mesh = this.ciContactMeshes[i];
        if (mesh) {
          if (contactDepth > 0.0 && contactDepth <= sMax) {
            const pt = evaluateScalaTympaniSpline(contactDepth, approach, arrayType, pitchDev, yawDev);
            mesh.position.set(pt[0], pt[1], pt[2]);
            mesh.visible = true;
          } else {
            mesh.visible = false;
          }
        }
      }
    }

    // Flashing crimson breach alarm uniform on scala vestibuli upon rupture
    const entrySV = this.meshEntries.get('seg_coch_inner_scala_vestibuli');
    if (entrySV && entrySV.material) {
      entrySV.material.uniforms.uTranslocationBreach.value = ciState.isRuptured ? 1.0 : 0.0;
    }

    this.notifySurgicalState();
    this.emitState();
    return ciState;
  }

  public updateLabyrinthectomy(
    step: 0 | 1 | 2 | 3,
    compensationHours = 0,
    drillActive = false
  ): LabyrinthectomyState {
    const labyState = computeLabyrinthectomyAblation(step, compensationHours, drillActive);
    this.state.surgicalState.labyState = labyState;

    // Otologic drill cutaway and canal milling uniforms across all 3 canals and otic capsule
    const lateralCanal = this.meshEntries.get('ls_Hsapiens_Sl');
    if (lateralCanal && lateralCanal.material) {
      lateralCanal.material.uniforms.uSurgicalDrillActive.value = drillActive ? 1.0 : 0.0;
      lateralCanal.material.uniforms.uCanalUnroofed.value.set(
        labyState.canalsMilled.horizontal ? 1.0 : 0.0,
        0.0,
        0.0
      );
    }

    const superiorCanal = this.meshEntries.get('ls_Hsapiens_Sa');
    if (superiorCanal && superiorCanal.material) {
      superiorCanal.material.uniforms.uCanalUnroofed.value.set(
        0.0,
        labyState.canalsMilled.superior ? 1.0 : 0.0,
        0.0
      );
    }

    const posteriorCanal = this.meshEntries.get('ls_Hsapiens_Sp');
    if (posteriorCanal && posteriorCanal.material) {
      posteriorCanal.material.uniforms.uCanalUnroofed.value.set(
        0.0,
        0.0,
        labyState.canalsMilled.posterior ? 1.0 : 0.0
      );
    }

    const oticCapsule = this.meshEntries.get('segT2_th1.07_Otsu');
    if (oticCapsule && oticCapsule.material) {
      oticCapsule.material.uniforms.uSurgicalDrillActive.value = drillActive ? 1.0 : 0.0;
      // Step 1+ unroofs mastoid cortical bone over antrum to reveal canals
      oticCapsule.material.uniforms.uOpacity.value = step >= 1 ? 0.24 : 0.72;
    }

    if (this.labyBurrMesh && this.labyBurrMat) {
      if (step === 0) {
        this.labyBurrMesh.position.set(
          SURGICAL_LANDMARKS.mastoidAntrumTarget[0],
          SURGICAL_LANDMARKS.mastoidAntrumTarget[1],
          SURGICAL_LANDMARKS.mastoidAntrumTarget[2]
        );
      } else if (step === 1) {
        this.labyBurrMesh.position.set(8.68, 0.45, 0.82); // Lateral SCC arch
      } else if (step === 2) {
        this.labyBurrMesh.position.set(6.2, 1.4, 0.5); // Common vestibule entry
      } else {
        this.labyBurrMesh.position.set(7.4, 2.4, 0.9); // Neuroepithelial ampullary curettage
      }
      this.labyBurrMat.emissive.setHex(drillActive ? 0xef4444 : 0x38bdf8);
      this.labyBurrMat.emissiveIntensity = drillActive ? 0.95 : 0.35;
    }

    // Step 4 (Curettage): Neuroepithelial evacuation & ghosting
    const neuroepithelialMeshes = [
      'ls_Hsapiens_utricle',
      'ls_Hsapiens_UCp',
      'mesh_david_sacculus',
      'ls_Hsapiens_Al',
      'ls_Hsapiens_Aa',
      'ls_Hsapiens_Ap',
      'ls_Hsapiens_Lat_Cup_Duct',
      'ls_Hsapiens_Ant_Cup_Duct',
      'ls_Hsapiens_Post_Cup_Duct',
    ];

    for (const meshName of neuroepithelialMeshes) {
      const entry = this.meshEntries.get(meshName);
      if (entry && entry.material) {
        if (labyState.neuroepitheliumAblated) {
          entry.material.uniforms.uGhostMode.value = 1.0;
          entry.material.uniforms.uOpacity.value = 0.1;
        } else {
          entry.material.uniforms.uGhostMode.value = 0.0;
          entry.material.uniforms.uOpacity.value = entry.ontology.baseAlpha;
        }
      }
    }

    this.notifySurgicalState();
    this.emitState();
    return labyState;
  }

  public updateNeurectomy(
    step: 0 | 1 | 2 | 3,
    koosStage: KoosStage = 0,
    toolProximity = 5.0,
    tractionGrams = 0.0,
    tool: 'scissors' | 'hook' | 'bipolar' = 'scissors',
    cleavage = true
  ): NeurectomyState {
    const neurectomyState = computeNeurectomyElectrophysiology(
      step,
      koosStage,
      toolProximity,
      tractionGrams,
      tool,
      cleavage
    );
    this.state.surgicalState.neurectomyState = neurectomyState;

    // Step 2 & 3: Cleavage plane and selective vestibular transection preserving cochlear nerve
    const cochleaEntry = this.meshEntries.get('mesh_david_cochlea');
    if (cochleaEntry && cochleaEntry.material) {
      // Cochlear nerve hearing division preserved with prominence
      cochleaEntry.material.uniforms.uHighlight.value = step >= 2 ? 0.65 : 0.0;
    }

    const vestibularMeshes = [
      'ls_Hsapiens_utricle',
      'ls_Hsapiens_UCp',
      'mesh_david_sacculus',
    ];
    for (const meshName of vestibularMeshes) {
      const entry = this.meshEntries.get(meshName);
      if (entry && entry.material) {
        if (neurectomyState.vestibularNerveTransected) {
          // Vestibular division divided: ghosted
          entry.material.uniforms.uGhostMode.value = 1.0;
          entry.material.uniforms.uOpacity.value = 0.22;
        } else {
          entry.material.uniforms.uGhostMode.value = 0.0;
          entry.material.uniforms.uOpacity.value = entry.ontology.baseAlpha;
        }
      }
    }

    // 3D 4-Quadrant IAC Bundle + Koos Stage I-IV Schwannoma Tumor + Micro-Instrument
    if (this.iacTumorMesh) {
      if (koosStage === 0) {
        this.iacTumorMesh.visible = false;
      } else {
        this.iacTumorMesh.visible = true;
        if (koosStage === 1) {
          this.iacTumorMesh.position.set(2.4, 0.95, 0.15);
          this.iacTumorMesh.scale.set(0.75, 0.55, 0.52);
        } else if (koosStage === 2) {
          this.iacTumorMesh.position.set(1.1, 0.55, 0.05);
          this.iacTumorMesh.scale.set(1.45, 1.05, 0.98);
        } else if (koosStage === 3) {
          this.iacTumorMesh.position.set(-0.35, 0.15, -0.05);
          this.iacTumorMesh.scale.set(2.35, 1.75, 1.55);
        } else {
          this.iacTumorMesh.position.set(-1.35, -0.15, -0.15);
          this.iacTumorMesh.scale.set(3.25, 2.45, 2.15);
        }
      }
    }

    if (this.iacNerveCN7) {
      const m = this.iacNerveCN7.material as THREE.MeshStandardMaterial;
      m.emissive.setHex(
        neurectomyState.isEMGAlarmActive || neurectomyState.tractionRisk === 'CRITICAL'
          ? 0xef4444
          : 0xb45309
      );
      m.emissiveIntensity = neurectomyState.isEMGAlarmActive ? 0.95 : 0.35;
    }
    if (this.iacNerveCochlear) {
      const m = this.iacNerveCochlear.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = step >= 2 ? 0.72 : 0.32;
    }
    if (this.iacNerveSVN && this.iacNerveIVN) {
      const svMat = this.iacNerveSVN.material as THREE.MeshStandardMaterial;
      const ivMat = this.iacNerveIVN.material as THREE.MeshStandardMaterial;
      const transected = neurectomyState.vestibularNerveTransected;
      svMat.transparent = transected;
      ivMat.transparent = transected;
      svMat.opacity = transected ? 0.25 : 1.0;
      ivMat.opacity = transected ? 0.25 : 1.0;
      this.iacNerveSVN.scale.set(1, transected ? 0.72 : 1.0, 1);
      this.iacNerveIVN.scale.set(1, transected ? 0.72 : 1.0, 1);
    }
    if (this.iacCleavageMesh) {
      this.iacCleavageMesh.visible = cleavage && step >= 1;
    }
    if (this.iacToolGroup && this.iacToolTipMat) {
      const advFrac = step >= 3 ? 0.92 : step === 2 ? 0.72 : step === 1 ? 0.45 : 0.15;
      const proximityShift = Math.max(0.0, Math.min(1.0, 1.0 - toolProximity / 8.0));
      this.iacToolGroup.position.set(
        2.0 - (1.0 - advFrac) * 0.6,
        -3.4 + (advFrac * 2.1 + proximityShift * 0.9),
        0.15
      );
      this.iacToolTipMat.color.setHex(
        tool === 'bipolar' ? 0xf87171 : tool === 'hook' ? 0xfbbf24 : 0x38bdf8
      );
      this.iacToolTipMat.emissive.setHex(
        tool === 'bipolar' ? 0xdc2626 : tool === 'hook' ? 0xd97706 : 0x0284c7
      );
    }

    this.applySceneStateToMeshes();
    this.notifySurgicalState();
    this.emitState();
    return neurectomyState;
  }

  public dispose(): void {
    this.isDisposed = true;
    cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = 0;
    this.cancelVHITThrust();
    this.setCaloricUniforms(false, 0, 0, 0);
    this.setCaloricSimulationState(false, null);

    if (this.motionMql && this.onMotionChangeBound) {
      this.motionMql.removeEventListener('change', this.onMotionChangeBound);
    }

    if (this.envRenderTarget) {
      this.envRenderTarget.dispose();
      this.envRenderTarget = null;
    }

    if (this.unsubRadVolumeReady) {
      this.unsubRadVolumeReady();
      this.unsubRadVolumeReady = null;
    }

    if (this.radSliceTexture) {
      this.radSliceTexture.dispose();
      this.radSliceTexture = null;
      this.radSliceData = null;
    }

    if (this.controls) {
      this.controls.dispose();
    }

    const dom = this.renderer?.domElement;
    if (dom) {
      if (this.handleContextLostBound) {
        dom.removeEventListener('webglcontextlost', this.handleContextLostBound);
      }
      if (this.handleContextRestoredBound) {
        dom.removeEventListener('webglcontextrestored', this.handleContextRestoredBound);
      }
      if (this.onPointerDownBound) {
        dom.removeEventListener('pointerdown', this.onPointerDownBound, { capture: true });
      }
      if (this.onPointerMoveBound) {
        dom.removeEventListener('pointermove', this.onPointerMoveBound);
      }
      if (this.onPointerUpBound) {
        dom.removeEventListener('pointerup', this.onPointerUpBound);
      }
      if (this.onPointerCancelBound) {
        dom.removeEventListener('pointercancel', this.onPointerCancelBound);
      }
      if (this.onDblClickBound) {
        dom.removeEventListener('dblclick', this.onDblClickBound);
      }
      if (dom.parentElement) {
        dom.parentElement.removeChild(dom);
      }
    }

    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.LineSegments) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((mat) => mat.dispose());
        } else if (obj.material) {
          obj.material.dispose();
        }
      }
    });

    this.meshEntries.clear();
    this.onStateChangeCallbacks.length = 0;
    this.onPinsUpdateCallbacks.length = 0;
    this.onStructurePickedCallbacks.length = 0;
    this.onVestibularTelemetryCallbacks.length = 0;

    this.renderer.dispose();
  }
}

export { DualStageScene as SingleStageScene };
