import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  DISSECTION_PRESETS,
  getFiducialMeshName,
  getHumanReadableLabel,
  IEMAP_STRUCTURES,
  KEY_FIDUCIAL_IDS,
  KEY_STRUCTURE_MESH_NAMES,
  StructureOntologyItem,
  SystemGroupId,
  VisibilityState,
} from '../data/ontology';
import {
  FiducialPointRAS,
  loadAllFiducials,
  loadPosteriorCanalPath,
  PosteriorCanalPathData,
} from '../data/fcsvParser';
import { fetchObjGeometry } from '../data/objLoader';
import {
  createGate3StructureMaterial,
  updateGate3MaterialState,
} from './gate3Materials';
import {
  computeHeadRotationMatrix,
  EPLEY_CLINICAL_STEPS,
  PhysicsTelemetryState,
  RealtimeEpleySimulator,
} from '../physics/epleyPhysics';

export type LabAppMode = 'mode1_atlas' | 'mode2_physics';
export type ViewportLayoutMode = 'labyrinth_main' | 'head_main' | 'split_50_50';
export type ClipAxisMode = 'none' | 'axial_z' | 'coronal_y' | 'sagittal_x';
export type DissectionToolMode = 'inspect' | 'scalpel_hide' | 'scalpel_ghost';
export type LabelDensityMode = 'off' | 'key' | 'all';

export interface ProjectedPin2D {
  id: string;
  rawId: string;
  label: string;
  sublabel: string;
  category: 'fiducial' | 'structure' | 'plane';
  colorHex: string;
  screenX: number;
  screenY: number;
  visible: boolean;
  occluded: boolean;
  meshName?: string;
}

export interface LabSceneSnapshot {
  appMode: LabAppMode;
  selectedMesh: string | null;
  hoveredMesh: string | null;
  visibilityMap: Record<string, VisibilityState>;
  bonyPeelPercent: number;
  microCutawayPercent: number;
  explodePercent: number;
  headCutawayOpacity: number;
  clipAxis: ClipAxisMode;
  clipOffsetMm: number;
  clipFlip: boolean;
  showFiducials: boolean;
  labelMode: LabelDensityMode;
  showCanalPlanes: boolean;
  showSplineAndCanaliths: boolean;
  showPhysicsVectors: boolean;
  canalithPhiDeg: number;
  headYawDeg: number;
  headPitchDeg: number;
  syncCameras: boolean;
  layoutMode: ViewportLayoutMode;
  toolMode: DissectionToolMode;
  activePresetId: string;
  canUndo: boolean;
  loadingProgress: number;
  loadingCompletedCount: number;
  loadingTotalCount: number;
  loadingItemLabel: string;
  isLoaded: boolean;
  // Mode 2 Physics & Tour State
  livePhysicsEnabled: boolean;
  activeEpleyStepIdx: number;
  tourPlaying: boolean;
  audioMuted: boolean;
  telemetry: PhysicsTelemetryState | null;
}

interface MeshEntry {
  ontology: StructureOntologyItem;
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  tetherLine: THREE.Line;
  tetherPositions: Float32Array;
  embeddedMesh?: THREE.Mesh;
}

export class DualStageScene {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;

  // Stage A: High-Magnification 27-Mesh IE-Map Labyrinth Scene
  private labyrinthScene: THREE.Scene;
  private labyrinthCamera: THREE.PerspectiveCamera;
  private labyrinthControls: OrbitControls;
  private labyrinthRoot: THREE.Group;

  // Stage B: Macro Sculpted Patient Head & Embedded Labyrinth Scene
  private headScene: THREE.Scene;
  private headCamera: THREE.PerspectiveCamera;
  private headControls: OrbitControls;
  private headPivotGroup: THREE.Group;
  private headSkinMaterial!: THREE.ShaderMaterial;
  private headOriginAxes?: THREE.AxesHelper;

  private meshEntries: Map<string, MeshEntry> = new Map();
  private pickableMeshes: THREE.Mesh[] = [];

  // Overlays in Labyrinth Stage
  private fiducialsGroup: THREE.Group;
  private canalPlanesGroup: THREE.Group;
  private splineGroup: THREE.Group;
  private clipHelperGroup: THREE.Group;
  private vectorsGroup: THREE.Group;
  private gravityArrow!: THREE.ArrowHelper;
  private tangentArrow!: THREE.ArrowHelper;
  private clipPlaneMesh!: THREE.Mesh;
  private canalithSpheres: THREE.Mesh[] = [];
  private fiducialPoints: FiducialPointRAS[] = [];
  private canalPathData: PosteriorCanalPathData | null = null;
  private simulator: RealtimeEpleySimulator | null = null;

  // Head Pose Smooth Interpolation for Epley Steps
  private poseTransition: {
    active: boolean;
    startTime: number;
    durationMs: number;
    fromYaw: number;
    toYaw: number;
    fromPitch: number;
    toPitch: number;
    phiCapMax: number;
    isStep3Assist: boolean;
  } | null = null;
  private activeStepPhiCapMax: number | null = null;
  private isDraggingPhiSlider = false;
  private manualPhiHoldActive = false;
  private lockedSelectionMesh: string | null = null;

  // Audio Element for Guided 8-Shot Tour
  private tourAudio: HTMLAudioElement | null = null;
  private tourStepTimer: number | null = null;

  // Camera Fly-To Animation
  private flyAnim: {
    active: boolean;
    startTime: number;
    durationMs: number;
    fromPos: THREE.Vector3;
    toPos: THREE.Vector3;
    fromTarget: THREE.Vector3;
    toTarget: THREE.Vector3;
  } | null = null;

  // Undo History Stack for Dissection Operations
  private undoStack: Array<Record<string, VisibilityState>> = [];

  // Reactive State
  private state: LabSceneSnapshot = {
    appMode: 'mode1_atlas',
    selectedMesh: 'ls_Hsapiens_Sp',
    hoveredMesh: null,
    visibilityMap: {},
    bonyPeelPercent: 80,
    microCutawayPercent: 35,
    explodePercent: 0,
    headCutawayOpacity: 0.34,
    clipAxis: 'none',
    clipOffsetMm: 0.0,
    clipFlip: false,
    showFiducials: false,
    labelMode: 'key',
    showCanalPlanes: false,
    showSplineAndCanaliths: true,
    showPhysicsVectors: true,
    canalithPhiDeg: -84.0,
    headYawDeg: 0.0,
    headPitchDeg: 0.0,
    syncCameras: true,
    layoutMode: 'labyrinth_main',
    toolMode: 'inspect',
    activePresetId: 'full_atlas_xray',
    canUndo: false,
    loadingProgress: 0,
    loadingCompletedCount: 0,
    loadingTotalCount: IEMAP_STRUCTURES.length + 6 + 4 + 1,
    loadingItemLabel: 'Initializing WebGL & 3D Anatomy Pipeline...',
    isLoaded: false,
    livePhysicsEnabled: false,
    activeEpleyStepIdx: 0,
    tourPlaying: false,
    audioMuted: false,
    telemetry: null,
  };

  private onStateChangeCallbacks: Array<(snap: LabSceneSnapshot) => void> = [];
  private onPinsUpdateCallbacks: Array<(pins: ProjectedPin2D[]) => void> = [];
  private onTelemetryCallbacks: Array<(tel: PhysicsTelemetryState) => void> = [];
  private onStructurePickedCallbacks: Array<(meshName: string) => void> = [];

  private raycaster = new THREE.Raycaster();
  private pointerDownPos = new THREE.Vector2();
  private isSyncingCamera = false;
  private animationFrameId = 0;
  private lastFrameTime = performance.now();

  // Viewport rectangles in CSS pixels (origin top-left)
  private mainRect = { left: 0, top: 0, width: 1280, height: 800 };
  private pipRect = { left: 900, top: 72, width: 320, height: 230 };

  constructor(container: HTMLElement) {
    this.container = container;

    for (const item of IEMAP_STRUCTURES) {
      this.state.visibilityMap[item.meshName] = item.defaultState;
    }

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(new THREE.Color('#071014'), 1.0);
    this.renderer.autoClear = false;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.touchAction = 'none';
    this.container.appendChild(this.renderer.domElement);

    // -------------------------------------------------------------------------
    // Stage A: Labyrinth Scene Setup (RAS Coordinates: +X Right, +Y Ant, +Z Sup)
    // -------------------------------------------------------------------------
    this.labyrinthScene = new THREE.Scene();
    this.labyrinthCamera = new THREE.PerspectiveCamera(34, 16 / 9, 0.2, 250);
    this.labyrinthCamera.up.set(0, 0, 1);
    this.labyrinthCamera.position.set(22.5, -10.5, 7.5);

    this.labyrinthControls = new OrbitControls(
      this.labyrinthCamera,
      this.renderer.domElement
    );
    this.labyrinthControls.target.set(4.4, 1.5, 0.2);
    this.labyrinthControls.enableDamping = true;
    this.labyrinthControls.dampingFactor = 0.08;
    this.labyrinthControls.enableZoom = true;
    this.labyrinthControls.enableRotate = true;
    this.labyrinthControls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };
    this.labyrinthControls.minDistance = 4.0;
    this.labyrinthControls.maxDistance = 65.0;
    this.labyrinthControls.update();

    this.labyrinthRoot = new THREE.Group();
    this.labyrinthRoot.matrixAutoUpdate = false;
    this.labyrinthScene.add(this.labyrinthRoot);

    this.fiducialsGroup = new THREE.Group();
    this.canalPlanesGroup = new THREE.Group();
    this.splineGroup = new THREE.Group();
    this.clipHelperGroup = new THREE.Group();
    this.vectorsGroup = new THREE.Group(); // In World Space so g_world = (0, 0, -1) is straight down
    this.labyrinthRoot.add(this.fiducialsGroup);
    this.labyrinthRoot.add(this.canalPlanesGroup);
    this.labyrinthRoot.add(this.splineGroup);
    this.labyrinthRoot.add(this.clipHelperGroup);
    this.labyrinthScene.add(this.vectorsGroup);

    this.buildSpatialReferenceGrid();
    this.buildCanalPlanesOverlay();
    this.buildCrossSectionHelper();
    this.buildPhysicsVectors3D();

    // -------------------------------------------------------------------------
    // Stage B: Patient Head & Embedded Right Labyrinth Setup (RAS Millimeters)
    // -------------------------------------------------------------------------
    this.headScene = new THREE.Scene();
    this.headCamera = new THREE.PerspectiveCamera(32, 4 / 3, 5, 1500);
    this.headCamera.up.set(0, 0, 1);
    this.headCamera.position.set(240, 150, 45);

    this.headControls = new OrbitControls(
      this.headCamera,
      this.renderer.domElement
    );
    this.headControls.target.set(-12, 15, -10);
    this.headControls.enableDamping = true;
    this.headControls.dampingFactor = 0.08;
    this.headControls.enableZoom = true;
    this.headControls.enableRotate = true;
    this.headControls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };
    this.headControls.minDistance = 75;
    this.headControls.maxDistance = 650;
    this.headControls.enabled = false;
    this.headControls.update();

    this.headPivotGroup = new THREE.Group();
    this.headPivotGroup.matrixAutoUpdate = false;
    this.headScene.add(this.headPivotGroup);

    this.setupCameraSync();
    this.setupPointerInteractions();
  }

  public onStateChange(cb: (snap: LabSceneSnapshot) => void): void {
    this.onStateChangeCallbacks.push(cb);
  }

  public onPinsUpdate(cb: (pins: ProjectedPin2D[]) => void): void {
    this.onPinsUpdateCallbacks.push(cb);
  }

  public onTelemetryUpdate(cb: (tel: PhysicsTelemetryState) => void): void {
    this.onTelemetryCallbacks.push(cb);
  }

  public onStructurePicked(cb: (meshName: string) => void): void {
    this.onStructurePickedCallbacks.push(cb);
  }

  public notifyStructurePicked(meshName: string): void {
    for (const cb of this.onStructurePickedCallbacks) {
      cb(meshName);
    }
  }

  public getSnapshot(): LabSceneSnapshot {
    return {
      ...this.state,
      visibilityMap: { ...this.state.visibilityMap },
    };
  }

  private emitPins(): void {
    if (this.onPinsUpdateCallbacks.length === 0) return;
    const pins = this.computeProjectedPins();
    for (const cb of this.onPinsUpdateCallbacks) {
      cb(pins);
    }
  }

  private emitState(): void {
    const snap = this.getSnapshot();
    for (const cb of this.onStateChangeCallbacks) {
      cb(snap);
    }
    this.emitPins();
  }

  public setViewportRects(
    mainRect: { left: number; top: number; width: number; height: number },
    pipRect: { left: number; top: number; width: number; height: number }
  ): void {
    this.mainRect = mainRect;
    this.pipRect = pipRect;
  }

  // ===========================================================================
  // INITIAL ASSET LOADING (27 IE-Map Meshes + 6 Head Meshes + 4 FCSV + Spline)
  // ===========================================================================
  public async loadAllAssets(): Promise<void> {
    const totalTasks = IEMAP_STRUCTURES.length + 6 + 4 + 1;
    let completed = 0;
    this.state.loadingTotalCount = totalTasks;
    const bumpProgress = (itemLabel: string) => {
      completed++;
      this.state.loadingCompletedCount = completed;
      this.state.loadingItemLabel = itemLabel;
      this.state.loadingProgress = Math.min(100, Math.round((completed / totalTasks) * 100));
      this.emitState();
    };

    // 1. Load all 27 IE-Map meshes in parallel
    await Promise.all(
      IEMAP_STRUCTURES.map(async (item) => {
        const url = `/assets/iemap/obj/${item.meshName}.obj`;
        const geometry = await fetchObjGeometry(url);

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
          opacity: 0.55,
          depthWrite: false,
        });
        const tetherLine = new THREE.Line(tetherGeom, tetherMat);
        tetherLine.visible = false;

        this.labyrinthRoot.add(mesh);
        this.labyrinthRoot.add(tetherLine);
        this.pickableMeshes.push(mesh);

        let embeddedMesh: THREE.Mesh | undefined;
        if (item.systemGroup !== 'bony_capsule') {
          const embMat = createGate3StructureMaterial({
            colorHex: item.colorHex,
            baseAlpha: Math.min(1.0, item.baseAlpha + 0.32),
            emissionStrength: item.emissionStrength + 0.35,
          });
          embeddedMesh = new THREE.Mesh(geometry, embMat);
          embeddedMesh.name = `Emb_${item.meshName}`;
          embeddedMesh.renderOrder = 3;
          this.headPivotGroup.add(embeddedMesh);
        }

        this.meshEntries.set(item.meshName, {
          ontology: item,
          mesh,
          material,
          tetherLine,
          tetherPositions,
          embeddedMesh,
        });

        bumpProgress(`Loaded RAS mesh: ${item.displayName} (${item.meshName}.obj)`);
      })
    );

    // 2. Load the 6 RAS-aligned Patient Head Context Meshes
    const headFiles: Array<{
      file: string;
      colorHex: string;
      alpha: number;
      emission: number;
      singleSurface?: boolean;
      renderOrder: number;
      isHeadSkin?: boolean;
    }> = [
      {
        file: 'head_skin.obj',
        colorHex: '#6da5c9',
        alpha: this.state.headCutawayOpacity,
        emission: 0.16,
        singleSurface: true,
        renderOrder: 5,
        isHeadSkin: true,
      },
      {
        file: 'sclera_L.obj',
        colorHex: '#d9e6ee',
        alpha: 0.92,
        emission: 0.1,
        renderOrder: 1,
      },
      {
        file: 'sclera_R.obj',
        colorHex: '#d9e6ee',
        alpha: 0.92,
        emission: 0.1,
        renderOrder: 1,
      },
      {
        file: 'iris_L.obj',
        colorHex: '#52dcf2',
        alpha: 0.98,
        emission: 0.45,
        renderOrder: 2,
      },
      {
        file: 'iris_R.obj',
        colorHex: '#52dcf2',
        alpha: 0.98,
        emission: 0.45,
        renderOrder: 2,
      },
      {
        file: 'ear_locator_ring.obj',
        colorHex: '#52dcf2',
        alpha: 0.95,
        emission: 0.85,
        renderOrder: 6,
      },
    ];

    await Promise.all(
      headFiles.map(async (hf) => {
        const geom = await fetchObjGeometry(`/assets/head/${hf.file}`);
        const mat = createGate3StructureMaterial({
          colorHex: hf.colorHex,
          baseAlpha: hf.alpha,
          emissionStrength: hf.emission,
          singleSurface: hf.singleSurface,
        });
        if (hf.isHeadSkin) {
          this.headSkinMaterial = mat;
        }
        const m = new THREE.Mesh(geom, mat);
        m.renderOrder = hf.renderOrder;
        this.headPivotGroup.add(m);
        bumpProgress(`Loaded patient head mesh: ${hf.file}`);
      })
    );

    this.headOriginAxes = new THREE.AxesHelper(22);
    this.headOriginAxes.visible = false;
    this.headPivotGroup.add(this.headOriginAxes);

    // 3. Load 3D Slicer Fiducials (.fcsv) & Posterior Canal Centerline Spline
    const [fiducials, canalPath] = await Promise.all([
      loadAllFiducials((fcsvFile) => {
        bumpProgress(`Loaded 3D Slicer fiducials: ${fcsvFile}`);
      }),
      loadPosteriorCanalPath().then((res) => {
        bumpProgress('Loaded posterior_canal_path.json spline');
        return res;
      }),
    ]);

    this.fiducialPoints = fiducials;
    this.canalPathData = canalPath;
    this.simulator = new RealtimeEpleySimulator(canalPath);
    this.buildFiducialLandmarks3D();
    this.buildPosteriorSplineAndCanaliths3D();

    this.applySceneStateToMeshes();
    this.state.isLoaded = true;
    this.state.loadingProgress = 100;
    this.state.loadingCompletedCount = totalTasks;
    this.state.loadingItemLabel = 'All 27 meshes & 4 .fcsv fiducial sets ready';
    this.emitState();
  }

  // ===========================================================================
  // SPATIAL REFERENCE GRID, CANAL PLANES, FIDUCIALS & 3D PHYSICS VECTORS
  // ===========================================================================
  private buildSpatialReferenceGrid(): void {
    const gridGroup = new THREE.Group();
    const gridSize = 18;
    const step = 2;
    const positions: number[] = [];
    const zFloor = -6.8;
    const cx = 4.5;
    const cy = 1.5;

    for (let i = -gridSize; i <= gridSize; i += step) {
      positions.push(cx - gridSize, cy + i, zFloor, cx + gridSize, cy + i, zFloor);
      positions.push(cx + i, cy - gridSize, zFloor, cx + i, cy + gridSize, zFloor);
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0x1e333d,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    gridGroup.add(new THREE.LineSegments(geom, mat));
    this.labyrinthScene.add(gridGroup);
  }

  private buildPhysicsVectors3D(): void {
    // Downward World Gravity Vector g_world = (0, 0, -1) (Warm Amber)
    this.gravityArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(5, -2, -2),
      2.6,
      0xf0aa62,
      0.62,
      0.34
    );
    // Canal Tangent Vector T_world(phi) (Bioluminescent Cyan)
    this.tangentArrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(5, -2, -2),
      2.4,
      0x52dcf2,
      0.58,
      0.32
    );
    this.vectorsGroup.add(this.gravityArrow);
    this.vectorsGroup.add(this.tangentArrow);
    this.vectorsGroup.visible = false;
  }

  private buildCanalPlanesOverlay(): void {
    const planes: Array<{
      name: string;
      center: [number, number, number];
      normal: [number, number, number];
      radius: number;
      colorHex: string;
    }> = [
      {
        name: 'Right Posterior Canal Plane (LARP, 45° Posterolateral)',
        center: [6.27, -3.66, 0.13],
        normal: [-0.7071, -0.7071, 0.0],
        radius: 3.4,
        colorHex: '#52dcf2',
      },
      {
        name: 'Right Anterior Canal Plane (RALP, 45° Anterolateral)',
        center: [5.64, 1.15, 5.03],
        normal: [-0.7071, 0.7071, 0.0],
        radius: 3.3,
        colorHex: '#f0aa62',
      },
      {
        name: 'Right Lateral Canal Plane (Horizontal +30° Pitch)',
        center: [8.68, 0.45, 0.82],
        normal: [0.0, -0.5, 0.866],
        radius: 3.2,
        colorHex: '#75c79e',
      },
    ];

    for (const p of planes) {
      const group = new THREE.Group();
      group.position.set(p.center[0], p.center[1], p.center[2]);

      const targetNormal = new THREE.Vector3(p.normal[0], p.normal[1], p.normal[2]).normalize();
      const quat = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        targetNormal
      );
      group.quaternion.copy(quat);

      const discGeom = new THREE.CircleGeometry(p.radius, 48);
      const discMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(p.colorHex),
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      group.add(new THREE.Mesh(discGeom, discMat));

      const ringPts: THREE.Vector3[] = [];
      for (let i = 0; i <= 64; i++) {
        const ang = (i / 64) * Math.PI * 2;
        ringPts.push(new THREE.Vector3(Math.cos(ang) * p.radius, Math.sin(ang) * p.radius, 0));
      }
      const ringGeom = new THREE.BufferGeometry().setFromPoints(ringPts);
      const ringMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(p.colorHex),
        transparent: true,
        opacity: 0.78,
      });
      group.add(new THREE.Line(ringGeom, ringMat));

      const arrow = new THREE.ArrowHelper(
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(0, 0, 0),
        2.2,
        new THREE.Color(p.colorHex).getHex(),
        0.55,
        0.32
      );
      group.add(arrow);

      this.canalPlanesGroup.add(group);
    }

    this.canalPlanesGroup.visible = this.state.showCanalPlanes;
  }

  private buildCrossSectionHelper(): void {
    const planeGeom = new THREE.PlaneGeometry(18, 18);
    const planeMat = new THREE.MeshBasicMaterial({
      color: 0x52dcf2,
      transparent: true,
      opacity: 0.07,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.clipPlaneMesh = new THREE.Mesh(planeGeom, planeMat);

    const edges = new THREE.EdgesGeometry(planeGeom);
    const edgeLine = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({
        color: 0x52dcf2,
        transparent: true,
        opacity: 0.65,
      })
    );
    this.clipPlaneMesh.add(edgeLine);
    this.clipHelperGroup.add(this.clipPlaneMesh);
    this.clipHelperGroup.visible = false;
  }

  private buildFiducialLandmarks3D(): void {
    this.fiducialsGroup.clear();
    const sphereGeom = new THREE.SphereGeometry(0.14, 16, 12);

    const groupColor: Record<FiducialPointRAS['canalGroup'], string> = {
      posterior: '#52dcf2',
      anterior: '#f0aa62',
      lateral: '#75c79e',
      common_crus: '#9eaded',
    };

    for (const pt of this.fiducialPoints) {
      const col = groupColor[pt.canalGroup];
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(col),
      });
      const marker = new THREE.Mesh(sphereGeom, mat);
      marker.position.set(pt.positionRAS[0], pt.positionRAS[1], pt.positionRAS[2]);
      marker.renderOrder = 10;
      this.fiducialsGroup.add(marker);
    }
    this.fiducialsGroup.visible = this.state.showFiducials;
  }

  private buildPosteriorSplineAndCanaliths3D(): void {
    this.splineGroup.clear();
    this.canalithSpheres = [];
    if (!this.canalPathData) return;

    const samples = this.canalPathData.samples;
    const curvePts = samples.map(
      (s) => new THREE.Vector3(s.position_ras[0], s.position_ras[1], s.position_ras[2])
    );
    const splineGeom = new THREE.BufferGeometry().setFromPoints(curvePts);
    const splineMat = new THREE.LineBasicMaterial({
      color: 0x52dcf2,
      transparent: true,
      opacity: 0.72,
    });
    const splineLine = new THREE.Line(splineGeom, splineMat);
    splineLine.renderOrder = 8;
    this.splineGroup.add(splineLine);

    const sphereGeom = new THREE.SphereGeometry(0.155, 20, 16);
    const sphereMat = createGate3StructureMaterial({
      colorHex: '#fa8f24',
      baseAlpha: 1.0,
      emissionStrength: 1.5,
    });

    for (let i = 0; i < 5; i++) {
      const cMesh = new THREE.Mesh(sphereGeom, sphereMat);
      cMesh.renderOrder = 9;
      this.splineGroup.add(cMesh);
      this.canalithSpheres.push(cMesh);
    }

    this.updateCanalithPositionsForPhi(this.state.canalithPhiDeg);
    this.splineGroup.visible = this.state.showSplineAndCanaliths;
  }

  private updateCanalithPositionsForPhi(centerPhiDeg: number): void {
    if (!this.simulator || this.canalithSpheres.length === 0) return;
    const ptsRAS = this.simulator.computeParticlesRAS(centerPhiDeg);
    for (let i = 0; i < this.canalithSpheres.length; i++) {
      this.canalithSpheres[i].position.set(ptsRAS[i][0], ptsRAS[i][1], ptsRAS[i][2]);
    }
  }

  private applyHeadRotationMatrixToRoots(psiYawDeg: number, thetaReclineDeg: number): void {
    const R = computeHeadRotationMatrix(psiYawDeg, thetaReclineDeg);
    const m4 = new THREE.Matrix4().set(
      R[0][0], R[0][1], R[0][2], 0,
      R[1][0], R[1][1], R[1][2], 0,
      R[2][0], R[2][1], R[2][2], 0,
      0,       0,       0,       1
    );
    this.labyrinthRoot.matrix.copy(m4);
    this.labyrinthRoot.matrixWorldNeedsUpdate = true;
    this.headPivotGroup.matrix.copy(m4);
    this.headPivotGroup.matrixWorldNeedsUpdate = true;
  }

  // ===========================================================================
  // APPLY STATE TO MESHES (VISIBILITY, PEEL, MICRO-CUTAWAY, EXPLODE, SLICER)
  // ===========================================================================
  private applySceneStateToMeshes(): void {
    const {
      visibilityMap,
      bonyPeelPercent,
      microCutawayPercent,
      explodePercent,
      selectedMesh,
      hoveredMesh,
      clipAxis,
      clipOffsetMm,
      clipFlip,
      headYawDeg,
      headPitchDeg,
    } = this.state;

    // 1. Compute 3D Cross-Section Clipping Plane
    const clipActive = clipAxis !== 'none';
    const clipNormal = new THREE.Vector3(0, 0, -1);
    const labyrinthCenter = new THREE.Vector3(4.4, 2.0, -0.3);

    if (clipAxis === 'axial_z') {
      clipNormal.set(0, 0, clipFlip ? 1 : -1);
      this.clipPlaneMesh.position.set(labyrinthCenter.x, labyrinthCenter.y, clipOffsetMm);
      this.clipPlaneMesh.rotation.set(0, 0, 0);
    } else if (clipAxis === 'coronal_y') {
      clipNormal.set(0, clipFlip ? 1 : -1, 0);
      this.clipPlaneMesh.position.set(labyrinthCenter.x, clipOffsetMm, labyrinthCenter.z);
      this.clipPlaneMesh.rotation.set(Math.PI / 2, 0, 0);
    } else if (clipAxis === 'sagittal_x') {
      clipNormal.set(clipFlip ? 1 : -1, 0, 0);
      this.clipPlaneMesh.position.set(clipOffsetMm, labyrinthCenter.y, labyrinthCenter.z);
      this.clipPlaneMesh.rotation.set(0, Math.PI / 2, 0);
    }
    this.clipHelperGroup.visible = clipActive;
    const clipConstant = clipFlip ? -clipOffsetMm : clipOffsetMm;

    // 2. Apply Exact Head Rotation Matrix R_head(psi, theta)
    this.applyHeadRotationMatrixToRoots(headYawDeg, headPitchDeg);

    // 3. Update each of the 27 IE-Map structures
    const explodeFactor = explodePercent / 100.0;
    const microCutFrac = microCutawayPercent / 100.0;
    const bonyOpacityFactor = Math.max(0.0, 1.0 - bonyPeelPercent / 100.0);

    for (const [meshName, entry] of this.meshEntries.entries()) {
      const { ontology, mesh, material, tetherLine, tetherPositions, embeddedMesh } = entry;
      let effState: VisibilityState = visibilityMap[meshName] ?? ontology.defaultState;
      let overrideOpacity: number | undefined;

      if (ontology.systemGroup === 'bony_capsule') {
        if (bonyPeelPercent >= 96) {
          effState = 'hidden';
        } else if (effState !== 'hidden') {
          if (bonyPeelPercent >= 25) {
            effState = 'ghost';
            overrideOpacity = Math.max(0.12, bonyOpacityFactor * 0.85);
          } else {
            effState = 'visible';
            overrideOpacity = 0.35 + bonyOpacityFactor * 0.55;
          }
        }
      }

      const isOuterAmpullaOrCochlea =
        meshName === 'ls_Hsapiens_Ap' ||
        meshName === 'ls_Hsapiens_Aa' ||
        meshName === 'ls_Hsapiens_Al' ||
        meshName === 'mesh_david_cochlea';

      if (isOuterAmpullaOrCochlea && effState === 'visible') {
        if (microCutFrac >= 0.65) {
          effState = 'ghost';
          overrideOpacity = Math.max(0.18, ontology.baseAlpha * (1.15 - microCutFrac));
        } else if (microCutFrac > 0.05) {
          overrideOpacity = Math.max(0.22, ontology.baseAlpha * (1.0 - microCutFrac * 0.65));
        }
      }

      mesh.visible = effState !== 'hidden';
      if (embeddedMesh) {
        embeddedMesh.visible = effState !== 'hidden';
      }

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

      const highlightLevel =
        selectedMesh === meshName ? 1.0 : hoveredMesh === meshName ? 0.55 : 0.0;

      updateGate3MaterialState(material, {
        state: effState,
        baseAlpha: ontology.baseAlpha,
        overrideOpacity,
        highlightLevel,
        clipActive,
        clipNormal,
        clipConstant,
      });

      if (embeddedMesh) {
        updateGate3MaterialState(embeddedMesh.material as THREE.ShaderMaterial, {
          state: effState === 'ghost' ? 'ghost' : 'visible',
          baseAlpha: Math.min(1.0, ontology.baseAlpha + 0.35),
          highlightLevel: selectedMesh === meshName ? 1.0 : 0.0,
          clipActive: false,
          clipNormal,
          clipConstant: 0,
        });
      }
    }

    if (this.headSkinMaterial) {
      updateGate3MaterialState(this.headSkinMaterial, {
        state: this.state.headCutawayOpacity < 0.05 ? 'hidden' : 'visible',
        baseAlpha: this.state.headCutawayOpacity,
        highlightLevel: 0,
        clipActive: false,
        clipNormal,
        clipConstant: 0,
      });
    }

    this.fiducialsGroup.visible =
      this.state.showFiducials && this.state.labelMode !== 'off';
    this.canalPlanesGroup.visible = this.state.showCanalPlanes;
    if (this.headOriginAxes) {
      this.headOriginAxes.visible = this.state.showFiducials || this.state.showCanalPlanes;
    }
    this.splineGroup.visible = this.state.showSplineAndCanaliths;
    this.vectorsGroup.visible =
      this.state.appMode === 'mode2_physics' && this.state.showPhysicsVectors;

    this.updateCanalithPositionsForPhi(this.state.canalithPhiDeg);
  }

  // ===========================================================================
  // MODE 1 <-> MODE 2 SWITCHING & EPLEY CLINICAL TOUR CONTROLS
  // ===========================================================================
  public setAppMode(mode: LabAppMode): void {
    this.state.appMode = mode;
    this.poseTransition = null;
    if (mode === 'mode2_physics') {
      const curStep =
        EPLEY_CLINICAL_STEPS[this.state.activeEpleyStepIdx] ?? EPLEY_CLINICAL_STEPS[0];
      this.state.livePhysicsEnabled = true;
      this.state.showSplineAndCanaliths = true;
      this.state.headYawDeg = curStep.targetYawDeg;
      this.state.headPitchDeg = curStep.targetReclineDeg;
      this.activeStepPhiCapMax = curStep.phiCapMax;
      this.manualPhiHoldActive = false;
      this.applyDissectionPreset('gate3_bppv_pathway', false);
      if (this.simulator) {
        this.simulator.setPhiDeg(this.state.canalithPhiDeg);
        this.state.telemetry = this.simulator.computeTelemetrySnapshot(
          this.state.headYawDeg,
          this.state.headPitchDeg
        );
      }
    } else {
      this.stopGuidedTour();
      this.state.headYawDeg = 0.0;
      this.state.headPitchDeg = 0.0;
      this.state.livePhysicsEnabled = false;
      this.vectorsGroup.visible = false;
    }
    this.applySceneStateToMeshes();
    this.emitState();
  }

  public jumpToEpleyStep(stepIdx: number, playAudio = false): void {
    const clampedIdx = Math.max(0, Math.min(EPLEY_CLINICAL_STEPS.length - 1, stepIdx));
    const step = EPLEY_CLINICAL_STEPS[clampedIdx];
    this.state.activeEpleyStepIdx = clampedIdx;
    this.state.livePhysicsEnabled = true;
    this.activeStepPhiCapMax = step.phiCapMax;
    this.isDraggingPhiSlider = false;
    this.manualPhiHoldActive = false;

    if (this.tourAudio) {
      this.tourAudio.pause();
      this.tourAudio = null;
    }
    if (this.tourStepTimer !== null) {
      window.clearTimeout(this.tourStepTimer);
      this.tourStepTimer = null;
    }

    // Set initial phi just before transition so particles sediment naturally during the step
    if (this.simulator) {
      if (clampedIdx <= 2) {
        this.simulator.setPhiDeg(-84.0);
        this.state.canalithPhiDeg = -84.0;
      } else if (clampedIdx === 3 && this.simulator.getPhiDeg() > 25) {
        this.simulator.setPhiDeg(-84.0);
      } else if (clampedIdx === 4 && this.simulator.getPhiDeg() < 15) {
        this.simulator.setPhiDeg(30.0);
      } else if (clampedIdx === 5 && this.simulator.getPhiDeg() < 95) {
        this.simulator.setPhiDeg(110.0);
      } else if (clampedIdx >= 6 && this.simulator.getPhiDeg() < 150) {
        this.simulator.setPhiDeg(165.0);
      }
    }

    this.poseTransition = {
      active: true,
      startTime: performance.now(),
      durationMs: 1850,
      fromYaw: this.state.headYawDeg,
      toYaw: step.targetYawDeg,
      fromPitch: this.state.headPitchDeg,
      toPitch: step.targetReclineDeg,
      phiCapMax: step.phiCapMax,
      isStep3Assist: step.stepId === 'step3',
    };

    if (playAudio) {
      this.playStepAudio(step.audioUrl, () => {
        if (this.state.tourPlaying) {
          if (this.state.activeEpleyStepIdx < EPLEY_CLINICAL_STEPS.length - 1) {
            this.jumpToEpleyStep(this.state.activeEpleyStepIdx + 1, true);
          } else {
            this.state.tourPlaying = false;
            this.emitState();
          }
        }
      });
    }

    this.applySceneStateToMeshes();
    this.emitState();
  }

  public toggleGuidedTour(): void {
    if (this.state.tourPlaying) {
      this.stopGuidedTour();
    } else {
      if (this.state.appMode !== 'mode2_physics') {
        this.setAppMode('mode2_physics');
      }
      this.state.tourPlaying = true;
      this.jumpToEpleyStep(this.state.activeEpleyStepIdx, true);
    }
    this.emitState();
  }

  public stopGuidedTour(): void {
    this.state.tourPlaying = false;
    if (this.tourAudio) {
      this.tourAudio.pause();
      this.tourAudio = null;
    }
    if (this.tourStepTimer !== null) {
      window.clearTimeout(this.tourStepTimer);
      this.tourStepTimer = null;
    }
    this.emitState();
  }

  public setAudioMuted(muted: boolean): void {
    this.state.audioMuted = muted;
    if (this.tourAudio) {
      this.tourAudio.muted = muted;
    }
    this.emitState();
  }

  private playStepAudio(url: string, onEnded: () => void): void {
    if (this.tourAudio) {
      this.tourAudio.pause();
      this.tourAudio = null;
    }
    if (this.tourStepTimer !== null) {
      window.clearTimeout(this.tourStepTimer);
      this.tourStepTimer = null;
    }

    const audio = new Audio(url);
    audio.muted = this.state.audioMuted;
    this.tourAudio = audio;
    audio.addEventListener('ended', () => {
      this.tourStepTimer = window.setTimeout(onEnded, 500);
    });
    audio.play().catch(() => {
      // Fallback timer if browser autoplay policy blocks un-interacted audio
      this.tourStepTimer = window.setTimeout(onEnded, 6500);
    });
  }

  // ===========================================================================
  // SYNCHRONIZED CAMERA LINKING & FLY-TO ANIMATION
  // ===========================================================================
  private setupCameraSync(): void {
    this.labyrinthControls.addEventListener('change', () => {
      if (!this.state.syncCameras || this.isSyncingCamera) return;
      this.isSyncingCamera = true;
      const dir = this.labyrinthCamera.position
        .clone()
        .sub(this.labyrinthControls.target)
        .normalize();
      const headDist = this.headCamera.position.distanceTo(this.headControls.target);
      this.headCamera.position.copy(
        this.headControls.target.clone().addScaledVector(dir, headDist)
      );
      this.headCamera.up.copy(this.labyrinthCamera.up);
      this.headControls.update();
      this.isSyncingCamera = false;
    });

    this.headControls.addEventListener('change', () => {
      if (!this.state.syncCameras || this.isSyncingCamera) return;
      this.isSyncingCamera = true;
      const dir = this.headCamera.position
        .clone()
        .sub(this.headControls.target)
        .normalize();
      const labDist = this.labyrinthCamera.position.distanceTo(this.labyrinthControls.target);
      this.labyrinthCamera.position.copy(
        this.labyrinthControls.target.clone().addScaledVector(dir, labDist)
      );
      this.labyrinthCamera.up.copy(this.headCamera.up);
      this.labyrinthControls.update();
      this.isSyncingCamera = false;
    });
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
    targetRAS.applyMatrix4(this.labyrinthRoot.matrix);

    const viewOffset = new THREE.Vector3(
      ontology.cameraViewOffsetRAS[0],
      ontology.cameraViewOffsetRAS[1],
      ontology.cameraViewOffsetRAS[2]
    );

    const destPos = targetRAS.clone().add(viewOffset);
    this.startCameraFly(destPos, targetRAS, 520);
  }

  public snapCameraViewPreset(
    preset:
      | 'right_lateral'
      | 'anterior'
      | 'superior'
      | 'posterior_3_4'
      | 'medial'
      | 'posterior_ampulla_zoom'
      | 'cochlea_zoom'
  ): void {
    const center = new THREE.Vector3(4.5, 1.5, 0.2);
    let pos = new THREE.Vector3(23.0, 1.5, 1.5);
    let target = center.clone();

    switch (preset) {
      case 'right_lateral':
        pos.set(24.5, 1.5, 0.8);
        break;
      case 'anterior':
        pos.set(4.5, 22.5, 1.2);
        break;
      case 'superior':
        pos.set(4.5, 1.2, 23.5);
        break;
      case 'posterior_3_4':
        pos.set(21.5, -11.5, 7.2);
        break;
      case 'medial':
        pos.set(-16.5, 1.5, 1.2);
        break;
      case 'posterior_ampulla_zoom':
        target.set(4.09, -1.2, -2.29);
        pos.set(10.8, -6.8, -0.8);
        break;
      case 'cochlea_zoom':
        target.set(1.4, 6.0, -2.9);
        pos.set(10.5, 14.2, 0.8);
        break;
    }

    this.startCameraFly(pos, target, 550);
  }

  private startCameraFly(toPos: THREE.Vector3, toTarget: THREE.Vector3, durationMs = 500): void {
    this.flyAnim = {
      active: true,
      startTime: performance.now(),
      durationMs,
      fromPos: this.labyrinthCamera.position.clone(),
      toPos,
      fromTarget: this.labyrinthControls.target.clone(),
      toTarget,
    };
  }

  // ===========================================================================
  // PUBLIC DISSECTION & LAB CONTROL API
  // ===========================================================================
  private pushUndoState(): void {
    this.undoStack.push({ ...this.state.visibilityMap });
    if (this.undoStack.length > 30) {
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
    if (meshName && this.state.visibilityMap[meshName] === 'hidden') {
      this.state.visibilityMap[meshName] = 'visible';
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
    for (const item of IEMAP_STRUCTURES) {
      this.state.visibilityMap[item.meshName] = item.meshName === target ? 'visible' : 'hidden';
    }
    this.applySceneStateToMeshes();
    this.flyToStructure(target);
    this.emitState();
  }

  public ghostOthersAroundSelected(): void {
    const target = this.state.selectedMesh;
    if (!target) return;
    this.pushUndoState();
    for (const item of IEMAP_STRUCTURES) {
      if (item.meshName === target) {
        this.state.visibilityMap[item.meshName] = 'visible';
      } else if (item.systemGroup === 'bony_capsule') {
        this.state.visibilityMap[item.meshName] = 'hidden';
      } else {
        this.state.visibilityMap[item.meshName] = 'ghost';
      }
    }
    this.applySceneStateToMeshes();
    this.emitState();
  }

  public hideSelected(): void {
    const target = this.state.selectedMesh;
    if (!target) return;
    this.pushUndoState();
    this.state.visibilityMap[target] = 'hidden';
    this.applySceneStateToMeshes();
    this.emitState();
  }

  public applyDissectionPreset(presetId: string, recordUndo = true): void {
    const preset = DISSECTION_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    if (recordUndo) {
      this.pushUndoState();
    }
    this.state.activePresetId = preset.id;
    this.state.bonyPeelPercent = preset.bonyPeelPercent;
    this.state.microCutawayPercent = preset.microCutawayPercent;
    this.state.explodePercent = preset.explodePercent;
    this.state.clipAxis = 'none';

    for (const item of IEMAP_STRUCTURES) {
      this.state.visibilityMap[item.meshName] =
        preset.states[item.meshName] ?? item.defaultState;
    }

    if (preset.defaultSelectedMesh) {
      this.state.selectedMesh = preset.defaultSelectedMesh;
    }
    this.applySceneStateToMeshes();

    if (presetId === 'cupula_micro_dissection') {
      this.snapCameraViewPreset('posterior_ampulla_zoom');
    } else if (presetId === 'cochlear_scalae_cutaway') {
      this.snapCameraViewPreset('cochlea_zoom');
    } else {
      this.snapCameraViewPreset('posterior_3_4');
    }

    this.emitState();
  }

  public resetAllDissection(): void {
    this.stopGuidedTour();
    this.poseTransition = null;
    this.activeStepPhiCapMax = 188.0;
    this.isDraggingPhiSlider = false;
    this.manualPhiHoldActive = false;
    this.undoStack = [];
    this.state.canUndo = false;
    this.state.headYawDeg = 0;
    this.state.headPitchDeg = 0;
    this.state.canalithPhiDeg = -84.0;
    if (this.simulator) {
      this.simulator.setPhiDeg(-84.0);
      this.state.telemetry = this.simulator.computeTelemetrySnapshot(0, 0);
    }
    this.state.toolMode = 'inspect';
    this.applyDissectionPreset('full_atlas_xray', false);
  }

  public setLockedSelectionMesh(meshName: string | null): void {
    this.lockedSelectionMesh = meshName;
  }

  public setPhiSliderDragging(dragging: boolean): void {
    this.isDraggingPhiSlider = dragging;
    if (dragging) {
      this.poseTransition = null;
      this.activeStepPhiCapMax = 188.0;
      this.manualPhiHoldActive = true;
    }
  }

  public setSliders(params: {
    bonyPeelPercent?: number;
    microCutawayPercent?: number;
    explodePercent?: number;
    headCutawayOpacity?: number;
    canalithPhiDeg?: number;
    headYawDeg?: number;
    headPitchDeg?: number;
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
    if (params.microCutawayPercent !== undefined) {
      this.state.microCutawayPercent = params.microCutawayPercent;
    }
    if (params.explodePercent !== undefined) {
      this.state.explodePercent = params.explodePercent;
    }
    if (params.headCutawayOpacity !== undefined) {
      this.state.headCutawayOpacity = params.headCutawayOpacity;
    }
    if (params.canalithPhiDeg !== undefined) {
      this.poseTransition = null;
      this.activeStepPhiCapMax = 188.0;
      this.manualPhiHoldActive = true;
      this.state.canalithPhiDeg = params.canalithPhiDeg;
      if (this.simulator) {
        this.simulator.setPhiDeg(params.canalithPhiDeg);
        const snap = this.simulator.computeTelemetrySnapshot(
          this.state.headYawDeg,
          this.state.headPitchDeg
        );
        this.state.telemetry = snap;
        for (const cb of this.onTelemetryCallbacks) {
          cb(snap);
        }
      }
    }
    if (params.headYawDeg !== undefined) {
      this.poseTransition = null;
      this.activeStepPhiCapMax = 188.0;
      this.manualPhiHoldActive = false;
      this.state.headYawDeg = params.headYawDeg;
    }
    if (params.headPitchDeg !== undefined) {
      this.poseTransition = null;
      this.activeStepPhiCapMax = 188.0;
      this.manualPhiHoldActive = false;
      this.state.headPitchDeg = params.headPitchDeg;
    }
    this.applySceneStateToMeshes();
    this.emitState();
  }

  public setClippingPlane(axis: ClipAxisMode, offsetMm?: number, flip?: boolean): void {
    this.state.clipAxis = axis;
    if (offsetMm !== undefined) {
      this.state.clipOffsetMm = offsetMm;
    } else if (axis === 'axial_z') {
      this.state.clipOffsetMm = 0.2;
    } else if (axis === 'coronal_y') {
      this.state.clipOffsetMm = 2.0;
    } else if (axis === 'sagittal_x') {
      this.state.clipOffsetMm = 4.4;
    }
    if (flip !== undefined) {
      this.state.clipFlip = flip;
    }
    this.applySceneStateToMeshes();
    this.emitState();
  }

  public setOverlays(params: {
    showFiducials?: boolean;
    labelMode?: LabelDensityMode;
    showCanalPlanes?: boolean;
    showSplineAndCanaliths?: boolean;
    showPhysicsVectors?: boolean;
    livePhysicsEnabled?: boolean;
    syncCameras?: boolean;
    layoutMode?: ViewportLayoutMode;
    toolMode?: DissectionToolMode;
  }): void {
    if (params.showFiducials !== undefined) this.state.showFiducials = params.showFiducials;
    if (params.labelMode !== undefined) this.state.labelMode = params.labelMode;
    if (params.showCanalPlanes !== undefined) this.state.showCanalPlanes = params.showCanalPlanes;
    if (params.showSplineAndCanaliths !== undefined)
      this.state.showSplineAndCanaliths = params.showSplineAndCanaliths;
    if (params.showPhysicsVectors !== undefined)
      this.state.showPhysicsVectors = params.showPhysicsVectors;
    if (params.livePhysicsEnabled !== undefined) {
      this.state.livePhysicsEnabled = params.livePhysicsEnabled;
      if (params.livePhysicsEnabled) {
        this.manualPhiHoldActive = false;
      }
    }
    if (params.syncCameras !== undefined) this.state.syncCameras = params.syncCameras;
    if (params.layoutMode !== undefined) this.state.layoutMode = params.layoutMode;
    if (params.toolMode !== undefined) this.state.toolMode = params.toolMode;
    this.applySceneStateToMeshes();
    this.emitState();
  }

  public setCameraDistance(distance: number): void {
    const clamped = Math.max(
      this.labyrinthControls.minDistance,
      Math.min(this.labyrinthControls.maxDistance, distance)
    );
    const dir = this.labyrinthCamera.position
      .clone()
      .sub(this.labyrinthControls.target)
      .normalize();
    if (dir.lengthSq() < 1e-6) {
      dir.set(1, -0.5, 0.3).normalize();
    }
    this.labyrinthCamera.position
      .copy(this.labyrinthControls.target)
      .addScaledVector(dir, clamped);
    this.labyrinthControls.update();
  }

  public getCameraDistance(): number {
    return this.labyrinthCamera.position.distanceTo(this.labyrinthControls.target);
  }

  // ===========================================================================
  // RAYCASTING, HOVER & SCALPEL / INSPECT CLICK HANDLING
  // ===========================================================================
  private setupPointerInteractions(): void {
    const dom = this.renderer.domElement;

    dom.addEventListener(
      'pointerdown',
      (ev) => {
        this.pointerDownPos.set(ev.clientX, ev.clientY);
        this.updateActiveControlsForPointer(ev.clientX, ev.clientY);
      },
      { capture: true }
    );

    dom.addEventListener(
      'touchstart',
      (ev) => {
        if (ev.touches.length > 0) {
          const t = ev.touches[0];
          this.pointerDownPos.set(t.clientX, t.clientY);
          this.updateActiveControlsForPointer(t.clientX, t.clientY);
        }
      },
      { capture: true, passive: true }
    );

    dom.addEventListener('pointermove', (ev) => {
      const hitMesh = this.raycastLabyrinthAtScreen(ev.clientX, ev.clientY);
      if (hitMesh !== this.state.hoveredMesh) {
        this.state.hoveredMesh = hitMesh;
        dom.style.cursor = hitMesh ? 'pointer' : 'grab';
        this.applySceneStateToMeshes();
        this.emitState();
      }
    });

    dom.addEventListener('pointerup', (ev) => {
      const moveDist = Math.hypot(
        ev.clientX - this.pointerDownPos.x,
        ev.clientY - this.pointerDownPos.y
      );
      if (moveDist > 5) return;

      const hitMesh = this.raycastLabyrinthAtScreen(ev.clientX, ev.clientY);
      if (!hitMesh) return;

      if (this.state.toolMode === 'scalpel_hide') {
        this.setStructureVisibility(hitMesh, 'hidden');
      } else if (this.state.toolMode === 'scalpel_ghost') {
        this.setStructureVisibility(hitMesh, 'ghost');
      } else {
        if (!this.lockedSelectionMesh) {
          this.selectStructure(hitMesh, false);
        }
        this.notifyStructurePicked(hitMesh);
      }
    });

    dom.addEventListener('dblclick', (ev) => {
      const hitMesh = this.raycastLabyrinthAtScreen(ev.clientX, ev.clientY);
      if (hitMesh && !this.lockedSelectionMesh) {
        this.selectStructure(hitMesh, true);
      }
    });
  }

  private getLabyrinthViewportRect(): { left: number; top: number; width: number; height: number } {
    const { layoutMode } = this.state;
    if (layoutMode === 'labyrinth_main') {
      return this.mainRect;
    } else if (layoutMode === 'head_main') {
      return this.pipRect;
    } else {
      const halfW = Math.floor(this.mainRect.width / 2);
      return {
        left: this.mainRect.left + halfW,
        top: this.mainRect.top,
        width: this.mainRect.width - halfW,
        height: this.mainRect.height,
      };
    }
  }

  private getHeadViewportRect(): { left: number; top: number; width: number; height: number } {
    const { layoutMode } = this.state;
    if (layoutMode === 'labyrinth_main') {
      return this.pipRect;
    } else if (layoutMode === 'head_main') {
      return this.mainRect;
    } else {
      const halfW = Math.floor(this.mainRect.width / 2);
      return {
        left: this.mainRect.left,
        top: this.mainRect.top,
        width: halfW,
        height: this.mainRect.height,
      };
    }
  }

  private updateActiveControlsForPointer(clientX: number, clientY: number): void {
    const canvasBounds = this.renderer.domElement.getBoundingClientRect();
    const x = clientX - canvasBounds.left;
    const y = clientY - canvasBounds.top;

    const headRect = this.getHeadViewportRect();
    const inHeadRect =
      headRect.width > 4 &&
      headRect.height > 4 &&
      x >= headRect.left &&
      x <= headRect.left + headRect.width &&
      y >= headRect.top &&
      y <= headRect.top + headRect.height;

    if (this.state.layoutMode === 'labyrinth_main') {
      this.headControls.enabled = inHeadRect;
      this.labyrinthControls.enabled = !inHeadRect;
    } else if (this.state.layoutMode === 'head_main') {
      const labRect = this.getLabyrinthViewportRect();
      const inLabRect =
        labRect.width > 4 &&
        labRect.height > 4 &&
        x >= labRect.left &&
        x <= labRect.left + labRect.width &&
        y >= labRect.top &&
        y <= labRect.top + labRect.height;
      this.labyrinthControls.enabled = inLabRect;
      this.headControls.enabled = !inLabRect;
    } else {
      this.headControls.enabled = inHeadRect;
      this.labyrinthControls.enabled = !inHeadRect;
    }
  }

  private raycastLabyrinthAtScreen(clientX: number, clientY: number): string | null {
    const canvasBounds = this.renderer.domElement.getBoundingClientRect();
    const x = clientX - canvasBounds.left;
    const y = clientY - canvasBounds.top;

    if (this.state.layoutMode === 'labyrinth_main') {
      const pr = this.pipRect;
      if (x >= pr.left && x <= pr.left + pr.width && y >= pr.top && y <= pr.top + pr.height) {
        return null;
      }
    }

    const labRect = this.getLabyrinthViewportRect();
    if (
      x < labRect.left ||
      x > labRect.left + labRect.width ||
      y < labRect.top ||
      y > labRect.top + labRect.height
    ) {
      return null;
    }

    const ndcX = ((x - labRect.left) / labRect.width) * 2 - 1;
    const ndcY = -((y - labRect.top) / labRect.height) * 2 + 1;
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.labyrinthCamera);

    const visibleTargets = this.pickableMeshes.filter((m) => {
      const name = m.userData.meshName as string;
      return (
        m.visible &&
        this.state.visibilityMap[name] === 'visible' &&
        name !== 'segT2_th1.07_Otsu'
      );
    });

    const hits = this.raycaster.intersectObjects(visibleTargets, false);
    if (hits.length > 0) {
      return hits[0].object.userData.meshName as string;
    }

    const fallbackTargets = this.pickableMeshes.filter((m) => m.visible);
    const ghostHits = this.raycaster.intersectObjects(fallbackTargets, false);
    if (ghostHits.length > 0) {
      return ghostHits[0].object.userData.meshName as string;
    }

    return null;
  }

  // ===========================================================================
  // PROJECT 3D FIDUCIAL & STRUCTURE PINS TO 2D OVERLAY (PHASE 4)
  // ===========================================================================
  private computeProjectedPins(): ProjectedPin2D[] {
    if (this.state.labelMode === 'off' || this.state.layoutMode === 'head_main') {
      return [];
    }

    const labRect = this.getLabyrinthViewportRect();
    if (labRect.width <= 10 || labRect.height <= 10) return [];

    const camDist = this.labyrinthCamera.position.distanceTo(this.labyrinthControls.target);
    const isAllMode = this.state.labelMode === 'all';
    const checkPipOverlap =
      this.state.layoutMode === 'labyrinth_main' &&
      this.pipRect.width > 10 &&
      this.pipRect.height > 10;

    const projectWorldPoint = (worldPt: THREE.Vector3) => {
      const v = worldPt.clone().project(this.labyrinthCamera);
      const sx = labRect.left + (v.x * 0.5 + 0.5) * labRect.width;
      const sy = labRect.top + (-v.y * 0.5 + 0.5) * labRect.height;
      const inPipBox =
        checkPipOverlap &&
        sx >= this.pipRect.left - 36 &&
        sx <= this.pipRect.left + this.pipRect.width + 24 &&
        sy >= this.pipRect.top - 10 &&
        sy <= this.pipRect.top + this.pipRect.height + 24;
      const inFrustum =
        v.z >= -1 &&
        v.z <= 1 &&
        !inPipBox &&
        sx >= labRect.left + 20 &&
        sx <= labRect.left + labRect.width - 20 &&
        sy >= labRect.top + 28 &&
        sy <= labRect.top + labRect.height - 16;
      return { sx, sy, inFrustum, depth: v.z };
    };

    interface PinCandidate {
      pin: ProjectedPin2D;
      priority: number;
      maxDist: number;
      depth: number;
    }

    const candidates: PinCandidate[] = [];

    // 1. Selected structure pin (highest priority = 0)
    if (this.state.selectedMesh) {
      const entry = this.meshEntries.get(this.state.selectedMesh);
      if (entry && entry.mesh.visible) {
        const { ontology, mesh } = entry;
        const pt = new THREE.Vector3(
          ontology.centroidRAS[0] + mesh.position.x,
          ontology.centroidRAS[1] + mesh.position.y,
          ontology.centroidRAS[2] + mesh.position.z
        ).applyMatrix4(this.labyrinthRoot.matrix);
        const proj = projectWorldPoint(pt);
        candidates.push({
          pin: {
            id: `struct_${ontology.meshName}`,
            rawId: ontology.meshName,
            label: ontology.shortLabel,
            sublabel: `${ontology.displayName} (${ontology.latinName}) · Raw ID: ${ontology.meshName} / ${ontology.structureId}`,
            category: 'structure',
            colorHex: ontology.colorHex,
            screenX: proj.sx,
            screenY: proj.sy,
            visible: proj.inFrustum,
            occluded: false,
            meshName: ontology.meshName,
          },
          priority: 0,
          maxDist: 999,
          depth: proj.depth,
        });
      }
    }

    // 2. Structure pins (Key vs All, filtered by camera distance)
    for (const [meshName, entry] of this.meshEntries.entries()) {
      if (meshName === this.state.selectedMesh) continue;
      if (!entry.mesh.visible) continue;
      if (meshName === 'segT2_th1.07_Otsu' || meshName === 'seg_coch_outer_T2') continue;

      const isKeyStruct = KEY_STRUCTURE_MESH_NAMES.has(meshName);
      if (!isAllMode && !isKeyStruct) continue;

      const { ontology, mesh } = entry;
      const isMicroCupula = meshName.includes('_Cup_');
      const priority = isKeyStruct ? 1 : isMicroCupula ? 4 : 3;
      const maxDist = isKeyStruct
        ? isAllMode
          ? 48
          : 34
        : isMicroCupula
        ? isAllMode
          ? 18
          : 12
        : isAllMode
        ? 28
        : 18;

      const pt = new THREE.Vector3(
        ontology.centroidRAS[0] + mesh.position.x,
        ontology.centroidRAS[1] + mesh.position.y,
        ontology.centroidRAS[2] + mesh.position.z
      ).applyMatrix4(this.labyrinthRoot.matrix);
      const proj = projectWorldPoint(pt);

      candidates.push({
        pin: {
          id: `struct_${ontology.meshName}`,
          rawId: ontology.meshName,
          label: ontology.shortLabel,
          sublabel: `${ontology.displayName} (${ontology.latinName}) · Raw ID: ${ontology.meshName} / ${ontology.structureId}`,
          category: 'structure',
          colorHex: ontology.colorHex,
          screenX: proj.sx,
          screenY: proj.sy,
          visible: proj.inFrustum,
          occluded: proj.depth > 0.985,
          meshName: ontology.meshName,
        },
        priority,
        maxDist,
        depth: proj.depth,
      });
    }

    // 3. 3D Slicer Fiducial pins (mapped to human-readable labels, raw IDs in tooltip)
    if (this.state.showFiducials) {
      const groupColor: Record<FiducialPointRAS['canalGroup'], string> = {
        posterior: '#52dcf2',
        anterior: '#f0aa62',
        lateral: '#75c79e',
        common_crus: '#9eaded',
      };

      for (const f of this.fiducialPoints) {
        const isKeyFid = KEY_FIDUCIAL_IDS.has(f.label);
        if (!isAllMode && !isKeyFid && camDist > 16) continue;

        const priority = isKeyFid ? 2 : 3;
        const maxDist = isKeyFid ? (isAllMode ? 45 : 30) : isAllMode ? 28 : 16;

        const pt = new THREE.Vector3(
          f.positionRAS[0],
          f.positionRAS[1],
          f.positionRAS[2]
        ).applyMatrix4(this.labyrinthRoot.matrix);
        const proj = projectWorldPoint(pt);
        const strippedRaw = f.label.replace(/^SSC_/, '');

        candidates.push({
          pin: {
            id: `fid_${f.label}`,
            rawId: f.label,
            label: getHumanReadableLabel(f.label),
            sublabel: `${f.description} · Raw ID: ${f.label} (${strippedRaw})`,
            category: 'fiducial',
            colorHex: groupColor[f.canalGroup],
            screenX: proj.sx,
            screenY: proj.sy,
            visible: proj.inFrustum,
            occluded: proj.depth > 0.985,
            meshName: getFiducialMeshName(f.label, f.canalGroup),
          },
          priority,
          maxDist,
          depth: proj.depth,
        });
      }
    }

    // Sort by priority (selected structure first, then key structures, then key fiducials, then depth)
    candidates.sort((a, b) => a.priority - b.priority || a.depth - b.depth);

    // Distance-adaptive screen-space bounding-box collision culling:
    // As camera zooms in (camDist decreases), spacing margin shrinks so more detail is revealed without overlap.
    const distFactor = Math.max(0, Math.min(1, (camDist - 7) / 22));
    const padX = isAllMode ? 4 + distFactor * 8 : 8 + distFactor * 14;
    const padY = isAllMode ? 3 + distFactor * 6 : 6 + distFactor * 10;

    const acceptedBoxes: Array<{ left: number; right: number; top: number; bottom: number }> = [];
    const results: ProjectedPin2D[] = [];

    for (const cand of candidates) {
      if (!cand.pin.visible || camDist > cand.maxDist) {
        results.push({ ...cand.pin, visible: false });
        continue;
      }

      const w = Math.max(78, cand.pin.label.length * 6.8 + 28);
      const h = cand.pin.category === 'structure' ? 26 : 23;
      const box = {
        left: cand.pin.screenX - w * 0.5 - padX,
        right: cand.pin.screenX + w * 0.5 + padX,
        top: cand.pin.screenY - h * 1.25 - padY,
        bottom: cand.pin.screenY - h * 0.25 + padY,
      };

      let collides = false;
      for (const existing of acceptedBoxes) {
        if (
          box.left < existing.right &&
          box.right > existing.left &&
          box.top < existing.bottom &&
          box.bottom > existing.top
        ) {
          collides = true;
          break;
        }
      }

      if (collides) {
        results.push({ ...cand.pin, visible: false });
      } else {
        acceptedBoxes.push(box);
        results.push({ ...cand.pin, visible: true });
      }
    }

    return results;
  }

  // ===========================================================================
  // DUAL-STAGE 60FPS RENDER & STOKES PHYSICS LOOP
  // ===========================================================================
  public startRenderLoop(): void {
    const renderFrame = (now: number) => {
      this.animationFrameId = requestAnimationFrame(renderFrame);
      const dt = Math.min(0.05, Math.max(0.001, (now - this.lastFrameTime) / 1000.0));
      this.lastFrameTime = now;

      // 1. Update Smooth Epley Head Pose Transition (if active)
      if (this.poseTransition && this.poseTransition.active) {
        const elapsed = now - this.poseTransition.startTime;
        const u = Math.min(1.0, elapsed / this.poseTransition.durationMs);
        const w = u * u * (3.0 - 2.0 * u);
        this.state.headYawDeg =
          this.poseTransition.fromYaw +
          (this.poseTransition.toYaw - this.poseTransition.fromYaw) * w;
        this.state.headPitchDeg =
          this.poseTransition.fromPitch +
          (this.poseTransition.toPitch - this.poseTransition.fromPitch) * w;
        this.applyHeadRotationMatrixToRoots(this.state.headYawDeg, this.state.headPitchDeg);
        if (u >= 1.0) {
          this.poseTransition.active = false;
          this.poseTransition = null;
        }
      }

      // 2. Step Real-Time Stokes Otoconia Sedimentation Physics
      const isPausedByManualPhi =
        this.isDraggingPhiSlider || this.manualPhiHoldActive;
      if (this.simulator && this.state.livePhysicsEnabled && !isPausedByManualPhi) {
        const isGuidedStep = this.poseTransition !== null;
        const tel = this.simulator.stepPhysics(
          dt,
          this.state.headYawDeg,
          this.state.headPitchDeg,
          {
            allowBackwardSlide: !isGuidedStep,
            phiCapMax:
              (this.poseTransition
                ? this.poseTransition.phiCapMax
                : this.activeStepPhiCapMax) ?? undefined,
            isStep3Assist: Boolean(this.poseTransition?.isStep3Assist),
          }
        );

        this.state.canalithPhiDeg = tel.phiDeg;
        this.state.telemetry = tel;

        for (let i = 0; i < this.canalithSpheres.length; i++) {
          const p = tel.particlesRAS[i];
          this.canalithSpheres[i].position.set(p[0], p[1], p[2]);
        }

        // Update 3D Gravity Vector (g_world) & Canal Tangent Vector (T_world) at particle cluster center
        const worldCenter = new THREE.Vector3(
          tel.centerRAS[0],
          tel.centerRAS[1],
          tel.centerRAS[2]
        ).applyMatrix4(this.labyrinthRoot.matrix);
        this.gravityArrow.position.copy(worldCenter);
        this.gravityArrow.setDirection(new THREE.Vector3(0, 0, -1));
        this.tangentArrow.position.copy(worldCenter);
        this.tangentArrow.setDirection(
          new THREE.Vector3(
            tel.tangentWorld[0],
            tel.tangentWorld[1],
            tel.tangentWorld[2]
          ).normalize()
        );

        for (const cb of this.onTelemetryCallbacks) {
          cb(tel);
        }
      }

      // 3. Update Camera Fly-To interpolation
      if (this.flyAnim && this.flyAnim.active) {
        const elapsed = now - this.flyAnim.startTime;
        const u = Math.min(1.0, elapsed / this.flyAnim.durationMs);
        const ease = 1.0 - Math.pow(1.0 - u, 3);
        this.labyrinthCamera.position.lerpVectors(
          this.flyAnim.fromPos,
          this.flyAnim.toPos,
          ease
        );
        this.labyrinthControls.target.lerpVectors(
          this.flyAnim.fromTarget,
          this.flyAnim.toTarget,
          ease
        );
        if (u >= 1.0) {
          this.flyAnim.active = false;
        }
      }

      this.labyrinthControls.update();
      this.headControls.update();

      const canvasW = this.container.clientWidth;
      const canvasH = this.container.clientHeight;
      if (canvasW === 0 || canvasH === 0) return;

      const rendererSize = this.renderer.getSize(new THREE.Vector2());
      if (rendererSize.x !== canvasW || rendererSize.y !== canvasH) {
        this.renderer.setSize(canvasW, canvasH, false);
      }

      this.renderer.setScissorTest(false);
      this.renderer.clear(true, true, true);
      this.renderer.setScissorTest(true);

      const labRect = this.getLabyrinthViewportRect();
      const headRect = this.getHeadViewportRect();

      const renderStageInRect = (
        scene: THREE.Scene,
        camera: THREE.PerspectiveCamera,
        rect: { left: number; top: number; width: number; height: number },
        clearBgHex: string
      ) => {
        if (rect.width <= 4 || rect.height <= 4) return;
        const glX = rect.left;
        const glY = canvasH - (rect.top + rect.height);
        camera.aspect = rect.width / rect.height;
        camera.updateProjectionMatrix();

        this.renderer.setViewport(glX, glY, rect.width, rect.height);
        this.renderer.setScissor(glX, glY, rect.width, rect.height);
        this.renderer.setClearColor(new THREE.Color(clearBgHex), 1.0);
        this.renderer.clear(true, true, true);
        this.renderer.render(scene, camera);
      };

      if (this.state.layoutMode === 'labyrinth_main') {
        renderStageInRect(this.labyrinthScene, this.labyrinthCamera, labRect, '#071014');
        renderStageInRect(this.headScene, this.headCamera, headRect, '#0b161c');
      } else if (this.state.layoutMode === 'head_main') {
        renderStageInRect(this.headScene, this.headCamera, headRect, '#071014');
        renderStageInRect(this.labyrinthScene, this.labyrinthCamera, labRect, '#0b161c');
      } else {
        renderStageInRect(this.headScene, this.headCamera, headRect, '#081217');
        renderStageInRect(this.labyrinthScene, this.labyrinthCamera, labRect, '#071014');
      }

      this.renderer.setScissorTest(false);

      if (this.onPinsUpdateCallbacks.length > 0) {
        const pins = this.computeProjectedPins();
        for (const cb of this.onPinsUpdateCallbacks) {
          cb(pins);
        }
      }
    };

    this.animationFrameId = requestAnimationFrame(renderFrame);
  }

  public dispose(): void {
    this.stopGuidedTour();
    cancelAnimationFrame(this.animationFrameId);
    this.renderer.dispose();
  }
}
