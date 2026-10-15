import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
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

export type LabelDensityMode = 'off' | 'key' | 'all';
export type ReadingDepth = 'simple' | 'detailed';
export type LabMode = 'anatomy' | 'hearing' | 'vestibular' | 'radiology';

export interface HearingLabState {
  activeFrequency: number;
  activeGreenwoodX: number;
  isPlaying: boolean;
  activePresetId: string | null;
  lossSector: [number, number] | null;
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
  } | null = null;

  // Undo History Stack for Dissection Operations
  private undoStack: Array<Record<string, VisibilityState>> = [];

  // Tonotopy Cursor & Saved Anatomy State
  private tonotopyCursorMesh: THREE.Mesh | null = null;
  private savedAnatomyState: {
    visibilityMap: Record<string, VisibilityState>;
    bonyPeelPercent: number;
    cameraPos: THREE.Vector3;
    controlsTarget: THREE.Vector3;
  } | null = null;
  private lossRangeVector = new THREE.Vector2(0, 0);
  private onHearingToneRequestCallbacks: Array<(freqHz: number) => void> = [];
  private static readonly DUMMY_CLIP_NORMAL = new THREE.Vector3(0, 0, -1);
  private tempRendererSize = new THREE.Vector2();
  private tempNDC = new THREE.Vector2();

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

  private raycaster = new THREE.Raycaster();
  private pointerDownPos = new THREE.Vector2();
  private activePointers = new Set<number>();
  private isMultiTouch = false;
  private animationFrameId = 0;
  private lastFrameTime = performance.now();

  public getSelectedMesh(): string | null {
    return this.state.selectedMesh;
  }

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
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.touchAction = 'none';
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

    // 3-Point Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    this.scene.add(ambientLight);

    const dirKey = new THREE.DirectionalLight(0xffffff, 1.2);
    dirKey.position.set(20, -25, 25);
    this.scene.add(dirKey);

    const dirFill = new THREE.DirectionalLight(0x75c79e, 0.45);
    dirFill.position.set(-25, 20, 15);
    this.scene.add(dirFill);

    const dirRim = new THREE.DirectionalLight(0x52dcf2, 0.65);
    dirRim.position.set(0, 10, 30);
    this.scene.add(dirRim);

    this.labyrinthRoot = new THREE.Group();
    this.scene.add(this.labyrinthRoot);

    // Glowing 3D Tonotopic Resonant Cursor Sphere
    const cursorGeom = new THREE.SphereGeometry(0.32, 16, 16);
    const cursorMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#ffffff'),
      transparent: true,
      opacity: 0.95,
      depthTest: false,
    });
    this.tonotopyCursorMesh = new THREE.Mesh(cursorGeom, cursorMat);
    this.tonotopyCursorMesh.renderOrder = 999;
    this.tonotopyCursorMesh.visible = false;
    this.labyrinthRoot.add(this.tonotopyCursorMesh);

    this.setupPointerInteractions();
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

    // Parallel load of all 27 IE-Map OBJ meshes
    await Promise.all(
      IEMAP_STRUCTURES.map(async (item) => {
        const url = `/assets/iemap/obj/${item.meshName}.obj`;
        const geometry = await fetchObjGeometry(url);

        if (item.meshName === 'mesh_david_cochlea') {
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
          opacity: 0.55,
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
    );

    this.state.isLoaded = true;
    this.state.loadingProgress = 100;
    this.applySceneStateToMeshes();
    this.emitState();
  }

  // ===========================================================================
  // SHADER & MESH UPDATES (Bone Shell Peel, Radial Explode & Highlight)
  // ===========================================================================
  private applySceneStateToMeshes(): void {
    const {
      labMode,
      hearingState,
      visibilityMap,
      bonyPeelPercent,
      explodePercent,
      selectedMesh,
      hoveredMesh,
    } = this.state;

    const isHearingMode = labMode === 'hearing';
    const explodeFactor = explodePercent / 100.0;

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
          if (meshName === 'mesh_david_cochlea') {
            tonotopyMode = 1.0;
            activeGreenwoodX = hearingState.activeGreenwoodX;
            waveAmplitude = hearingState.isPlaying ? 1.0 : 0.0;
            lossMaskActive = hearingState.lossSector ? 1.0 : 0.0;
            overrideOpacity = 0.88;
          } else {
            // Keep internal scala chambers visible through translucent spectral cochlea
            overrideOpacity = 0.82;
          }
        } else if (ontology.systemGroup === 'bony_capsule') {
          effState = 'hidden';
        } else {
          // Vestibular system ghosted to 15% opacity
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
        clipActive: false,
        clipNormal: DualStageScene.DUMMY_CLIP_NORMAL,
        clipConstant: 1000.0,
        tonotopyMode,
        activeGreenwoodX,
        waveAmplitude,
        lossMaskActive,
        lossRange: this.lossRangeVector,
        lossSeverity: 0.92,
      });
    }

    // Update 3D Tonotopic Resonant Cursor Sphere
    if (this.tonotopyCursorMesh) {
      if (isHearingMode) {
        const coords = getCoordinatesForFrequency(this.state.hearingState.activeFrequency);
        this.tonotopyCursorMesh.position.set(coords[0], coords[1], coords[2]);
        this.tonotopyCursorMesh.visible = true;
      } else {
        this.tonotopyCursorMesh.visible = false;
      }
    }
  }

  // ===========================================================================
  // CAMERA FLY-TO ANIMATION
  // ===========================================================================
  private startCameraFly(toPos: THREE.Vector3, toTarget: THREE.Vector3, durationMs = 500): void {
    this.flyAnim = {
      active: true,
      startTime: performance.now(),
      durationMs,
      fromPos: this.camera.position.clone(),
      toPos,
      fromTarget: this.controls.target.clone(),
      toTarget,
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
      500
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
  // HEARING LAB & TONOTOPY ENGINE API
  // ===========================================================================
  public setLabMode(mode: LabMode): void {
    if (this.state.labMode === mode) return;

    if (mode === 'hearing') {
      // Save current anatomy state for lossless restoration
      this.savedAnatomyState = {
        visibilityMap: { ...this.state.visibilityMap },
        bonyPeelPercent: this.state.bonyPeelPercent,
        cameraPos: this.camera.position.clone(),
        controlsTarget: this.controls.target.clone(),
      };

      this.state.labMode = 'hearing';
      this.state.selectedMesh = 'mesh_david_cochlea';

      // Anterolateral cochlear perspective fly-to
      const targetRAS = new THREE.Vector3(1.77, 6.38, -2.96);
      const camPos = new THREE.Vector3(13.5, 14.0, 2.5);
      this.startCameraFly(camPos, targetRAS, 550);
    } else if (mode === 'anatomy') {
      this.state.labMode = 'anatomy';
      if (this.savedAnatomyState) {
        this.state.visibilityMap = { ...this.savedAnatomyState.visibilityMap };
        this.state.bonyPeelPercent = this.savedAnatomyState.bonyPeelPercent;
        this.startCameraFly(
          this.savedAnatomyState.cameraPos,
          this.savedAnatomyState.controlsTarget,
          500
        );
      }
    }

    this.applySceneStateToMeshes();
    this.emitState();
  }

  public setHearingFrequency(freqHz: number, triggerAudio = true): void {
    const clamped = Math.max(20, Math.min(20000, freqHz));
    const x = greenwoodPosition(clamped);
    this.state.hearingState.activeFrequency = clamped;
    this.state.hearingState.activeGreenwoodX = x;

    const cochleaEntry = this.meshEntries.get('mesh_david_cochlea');
    if (cochleaEntry) {
      cochleaEntry.material.uniforms.uActiveGreenwoodX.value = x;
    }

    if (this.tonotopyCursorMesh) {
      const coords = getCoordinatesForFrequency(clamped);
      this.tonotopyCursorMesh.position.set(coords[0], coords[1], coords[2]);
      this.tonotopyCursorMesh.visible = this.state.labMode === 'hearing';
    }

    if (triggerAudio) {
      for (const cb of this.onHearingToneRequestCallbacks) {
        cb(clamped);
      }
    }

    this.emitState();
  }

  public setHearingPlayback(isPlaying: boolean): void {
    this.state.hearingState.isPlaying = isPlaying;
    const cochleaEntry = this.meshEntries.get('mesh_david_cochlea');
    if (cochleaEntry) {
      cochleaEntry.material.uniforms.uWaveAmplitude.value = isPlaying ? 1.0 : 0.0;
    }
    this.emitState();
  }

  public setHearingLossSector(lossSector: [number, number] | null, presetId: string | null = null): void {
    this.state.hearingState.lossSector = lossSector;
    this.state.hearingState.activePresetId = presetId;

    const cochleaEntry = this.meshEntries.get('mesh_david_cochlea');
    if (cochleaEntry) {
      if (lossSector) {
        this.lossRangeVector.set(lossSector[0], lossSector[1]);
        cochleaEntry.material.uniforms.uLossMaskActive.value = 1.0;
        cochleaEntry.material.uniforms.uLossRange.value.copy(this.lossRangeVector);
        cochleaEntry.material.uniforms.uLossSeverity.value = 0.92;
      } else {
        cochleaEntry.material.uniforms.uLossMaskActive.value = 0.0;
      }
    }
    this.emitState();
  }

  public onHearingToneRequest(cb: (freqHz: number) => void): void {
    this.onHearingToneRequestCallbacks.push(cb);
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
        new THREE.Vector3(25.0, -12.0, 9.0),
        new THREE.Vector3(4.5, 1.5, 0.2),
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

    dom.addEventListener(
      'pointerdown',
      (ev) => {
        this.activePointers.add(ev.pointerId);
        if (this.activePointers.size > 1) {
          this.isMultiTouch = true;
        }
        this.pointerDownPos.set(ev.clientX, ev.clientY);
      },
      { capture: true }
    );

    dom.addEventListener('pointermove', (ev) => {
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
    });

    dom.addEventListener('pointerup', (ev) => {
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
    });

    dom.addEventListener('pointercancel', (ev) => {
      this.activePointers.delete(ev.pointerId);
      if (this.activePointers.size === 0) {
        this.isMultiTouch = false;
      }
    });

    dom.addEventListener('dblclick', (ev) => {
      const hitMesh = this.raycastLabyrinthAtScreen(ev.clientX, ev.clientY);
      if (hitMesh) {
        this.selectStructure(hitMesh, true);
      }
    });
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
    if (this.state.labelMode === 'off') {
      return [];
    }

    if (width <= 10 || height <= 10) return [];

    const camDist = this.camera.position.distanceTo(this.controls.target);
    const isAllMode = this.state.labelMode === 'all';

    const projectWorldPoint = (worldPt: THREE.Vector3) => {
      const v = worldPt.clone().project(this.camera);
      const sx = (v.x * 0.5 + 0.5) * width;
      const sy = (-(v.y * 0.5) + 0.5) * height;
      const inFrustum =
        v.z > -1.0 &&
        v.z < 1.0 &&
        sx >= 10 &&
        sx <= width - 10 &&
        sy >= 10 &&
        sy <= height - 10;
      return { sx, sy, inFrustum, depth: v.z };
    };

    interface CandidatePin {
      pin: ProjectedPin2D;
      priority: number;
      maxDist: number;
      depth: number;
    }

    let candidates: CandidatePin[] = [];

    for (const item of IEMAP_STRUCTURES) {
      const entry = this.meshEntries.get(item.meshName);
      if (!entry || !entry.mesh.visible) continue;
      if (item.systemGroup === 'bony_capsule') continue;

      const isKeyStruct = KEY_STRUCTURE_MESH_NAMES.has(item.meshName);
      if (!isAllMode && !isKeyStruct) continue;

      const priority = isKeyStruct ? 1 : 2;
      const maxDist = isKeyStruct ? (isAllMode ? 55 : 42) : 28;

      const pt = new THREE.Vector3(
        item.centroidRAS[0] + entry.mesh.position.x,
        item.centroidRAS[1] + entry.mesh.position.y,
        item.centroidRAS[2] + entry.mesh.position.z
      );
      const proj = projectWorldPoint(pt);

      candidates.push({
        pin: {
          id: `struct_${item.meshName}`,
          rawId: item.meshName,
          label: item.shortLabel,
          sublabel: `${item.displayName} (${item.latinName})`,
          category: 'structure',
          colorHex: item.colorHex,
          screenX: proj.sx,
          screenY: proj.sy,
          visible: proj.inFrustum,
          occluded: proj.depth > 0.985,
          meshName: item.meshName,
        },
        priority,
        maxDist,
        depth: proj.depth,
      });
    }

    if (this.state.labMode === 'hearing') {
      candidates = candidates.filter((c) => c.pin.meshName.includes('coch'));
    }

    // Filter distance & avoid collisions
    candidates.sort((a, b) => a.priority - b.priority || a.depth - b.depth);

    const acceptedBoxes: Array<{ x: number; y: number; w: number; h: number }> = [];
    const results: ProjectedPin2D[] = [];

    for (const cand of candidates) {
      if (!cand.pin.visible || camDist > cand.maxDist) {
        continue;
      }

      const boxW = Math.max(90, cand.pin.label.length * 7 + 22);
      const boxH = 26;
      const box = {
        x: cand.pin.screenX - boxW / 2,
        y: cand.pin.screenY - 14,
        w: boxW,
        h: boxH,
      };

      let collides = false;
      for (const acc of acceptedBoxes) {
        if (
          !(
            box.x + box.w < acc.x - 8 ||
            box.x > acc.x + acc.w + 8 ||
            box.y + box.h < acc.y - 6 ||
            box.y > acc.y + acc.h + 6
          )
        ) {
          collides = true;
          break;
        }
      }

      if (!collides) {
        acceptedBoxes.push(box);
        results.push(cand.pin);
      }
    }

    return results;
  }

  // ===========================================================================
  // 60FPS RENDER LOOP
  // ===========================================================================
  public startRenderLoop(): void {
    const renderFrame = (now: number) => {
      this.animationFrameId = requestAnimationFrame(renderFrame);
      const dt = Math.min(0.1, (now - this.lastFrameTime) * 0.001);
      this.lastFrameTime = now;

      // Update Traveling Wave Phase on Cochlea Material
      if (this.state.labMode === 'hearing' && this.state.hearingState.isPlaying) {
        const cochleaEntry = this.meshEntries.get('mesh_david_cochlea');
        if (cochleaEntry) {
          cochleaEntry.material.uniforms.uWavePhase.value += dt * 18.0;
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
        if (u >= 1.0) {
          this.flyAnim.active = false;
        }
      }

      this.controls.update();

      const canvasW = this.container.clientWidth;
      const canvasH = this.container.clientHeight;
      if (canvasW === 0 || canvasH === 0) return;

      const rendererSize = this.renderer.getSize(this.tempRendererSize);
      if (rendererSize.x !== canvasW || rendererSize.y !== canvasH) {
        this.renderer.setSize(canvasW, canvasH, false);
        this.camera.aspect = canvasW / canvasH;
        this.camera.updateProjectionMatrix();
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

  public dispose(): void {
    cancelAnimationFrame(this.animationFrameId);
    this.renderer.dispose();
  }
}

export { DualStageScene as SingleStageScene };
