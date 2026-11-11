import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { fetchObjGeometry } from '../data/objLoader';
import {
  COCHLEA_SPLINE_KNOTS,
  computeMeshGreenwoodX,
  getCoordinatesForFrequency,
  greenwoodPosition,
} from '../data/greenwoodEngine';
import {
  loadCanalPath,
  interpolateCanalAtPhi,
  type CanalPathData,
} from '../data/canalPaths';
import {
  CI_CONSTANTS,
  EPLEY_STEPS,
  IEMAP_STRUCTURES,
  KEY_STRUCTURE_MESH_NAMES,
  LAB_PRESETS,
  RADIOLOGY_PLANES,
  STRUCTURE_BY_MESH,
  evaluateScalaTympaniSpline,
  getShaderClipUniforms,
  type LabelDensity,
  type RadiologyPlaneId,
  type ShowcaseMode,
  type StructureOntologyItem,
  type SurgicalProcedure,
  type VestibularSubmode,
} from './showcaseData';
import type { VisibilityState } from '../data/ontology';

export interface ProjectedPin {
  meshName: string;
  label: string;
  colorHex: string;
  x: number;
  y: number;
  visible: boolean;
  selected: boolean;
}

export interface HeroSceneCallbacks {
  onSelectStructure?: (item: StructureOntologyItem) => void;
  onPinsUpdate?: (pins: ReadonlyArray<ProjectedPin>, count: number) => void;
  onLoadedCount?: (loaded: number, total: number) => void;
}

interface StructureMeshRecord {
  item: StructureOntologyItem;
  mesh: THREE.Mesh;
  uniforms: ShowcaseShaderUniforms;
  material: THREE.ShaderMaterial;
  visState: VisibilityState;
}

interface ShowcaseShaderUniforms {
  [uniform: string]: THREE.IUniform<unknown>;
  uBaseColor: THREE.IUniform<THREE.Color>;
  uOpacity: THREE.IUniform<number>;
  uEmission: THREE.IUniform<number>;
  uGhostMode: THREE.IUniform<number>;
  uHighlight: THREE.IUniform<number>;
  uThemeLight: THREE.IUniform<number>;
  uClipActive: THREE.IUniform<number>;
  uClipNormal: THREE.IUniform<THREE.Vector3>;
  uClipConstant: THREE.IUniform<number>;
  uTonotopyMode: THREE.IUniform<number>;
  uActiveGreenwoodX: THREE.IUniform<number>;
  uWavePhase: THREE.IUniform<number>;
  uLossMaskActive: THREE.IUniform<number>;
  uLossRange: THREE.IUniform<THREE.Vector2>;
  uLossSeverity: THREE.IUniform<number>;
  uCaloricActive: THREE.IUniform<number>;
  uCaloricTempDiff: THREE.IUniform<number>;
  uTranslocationBreach: THREE.IUniform<number>;
  uTime: THREE.IUniform<number>;
}

const VERTEX_SHADER = /* glsl */ `
  attribute float aGreenwoodX;

  varying vec3 vNormalView;
  varying vec3 vViewPosition;
  varying vec3 vWorldPosition;
  varying vec3 vSpecimenPosition;
  varying vec3 vNormalWorld;
  varying float vGreenwoodX;

  void main() {
    vGreenwoodX = aGreenwoodX;
    vSpecimenPosition = position;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    vNormalWorld = normalize(mat3(modelMatrix) * normal);

    vec4 mvPosition = viewMatrix * worldPos;
    vViewPosition = -mvPosition.xyz;
    vNormalView = normalize(normalMatrix * normal);

    gl_Position = projectionMatrix * mvPosition;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uBaseColor;
  uniform float uOpacity;
  uniform float uEmission;
  uniform float uGhostMode;
  uniform float uHighlight;
  uniform float uThemeLight;
  uniform float uClipActive;
  uniform vec3 uClipNormal;
  uniform float uClipConstant;

  uniform float uTonotopyMode;
  uniform float uActiveGreenwoodX;
  uniform float uWavePhase;
  uniform float uLossMaskActive;
  uniform vec2 uLossRange;
  uniform float uLossSeverity;

  uniform float uCaloricActive;
  uniform float uCaloricTempDiff;
  uniform float uTranslocationBreach;
  uniform float uTime;

  varying vec3 vNormalView;
  varying vec3 vViewPosition;
  varying vec3 vWorldPosition;
  varying vec3 vSpecimenPosition;
  varying vec3 vNormalWorld;
  varying float vGreenwoodX;

  vec3 getLinearGreenwoodColor(float x) {
    float cx = clamp(x, 0.0, 1.0);
    // Linearized perceptual tonotopic ramp (Apex deep indigo-teal -> Mid emerald/gold -> Base coral)
    vec3 c0 = vec3(0.05, 0.03, 0.42);
    vec3 c1 = vec3(0.02, 0.22, 0.64);
    vec3 c2 = vec3(0.02, 0.48, 0.56);
    vec3 c3 = vec3(0.06, 0.52, 0.16);
    vec3 c4 = vec3(0.76, 0.46, 0.02);
    vec3 c5 = vec3(0.76, 0.16, 0.03);
    vec3 c6 = vec3(0.66, 0.03, 0.08);

    if (cx < 0.17) return mix(c0, c1, cx / 0.17);
    if (cx < 0.33) return mix(c1, c2, (cx - 0.17) / 0.16);
    if (cx < 0.50) return mix(c2, c3, (cx - 0.33) / 0.17);
    if (cx < 0.68) return mix(c3, c4, (cx - 0.50) / 0.18);
    if (cx < 0.84) return mix(c4, c5, (cx - 0.68) / 0.16);
    return mix(c5, c6, (cx - 0.84) / 0.16);
  }

  void main() {
    float clipDist = dot(vSpecimenPosition, uClipNormal) + uClipConstant;
    if (uClipActive > 0.5 && clipDist < 0.0) {
      discard;
    }

    vec3 viewDir = normalize(vViewPosition);
    vec3 normal = normalize(vNormalView);
    if (!gl_FrontFacing) {
      normal = -normal;
    }

    float ndotv = clamp(abs(dot(normal, viewDir)), 0.0, 1.0);
    float fresnel = pow(1.0 - ndotv, mix(2.6, 2.1, uThemeLight));

    vec3 nWorld = normalize(gl_FrontFacing ? vNormalWorld : -vNormalWorld);
    vec3 keyDir = normalize(vec3(0.50, -0.56, 0.66));
    vec3 fillDir = normalize(vec3(-0.62, 0.46, 0.32));
    vec3 rimDir = normalize(vec3(0.0, 0.25, 0.96));

    float keyTerm = max(dot(nWorld, keyDir), -0.20) * 0.52 + 0.48;
    float fillTerm = max(dot(nWorld, fillDir), 0.0) * 0.22;
    float topTerm = max(dot(nWorld, rimDir), 0.0) * 0.18;

    vec3 halfVec = normalize(keyDir + viewDir);
    float spec = pow(max(dot(normal, halfVec), 0.0), 34.0) * 0.28;

    // Theme-aware pigment strength so specimen reads crisply on BOTH obsidian and drafting paper
    vec3 pigment = mix(uBaseColor * 0.92, uBaseColor * 0.62, uThemeLight);
    vec3 litColor = pigment * (keyTerm + fillTerm + topTerm + uEmission * 0.28);

    vec3 darkRim = mix(uBaseColor * 1.25, vec3(0.10, 0.55, 0.52), 0.36 + uHighlight * 0.42);
    vec3 lightRim = mix(uBaseColor * 0.42, vec3(0.02, 0.24, 0.32), 0.45 + uHighlight * 0.45);
    vec3 rimColor = mix(darkRim, lightRim, uThemeLight);

    litColor += rimColor * fresnel * mix(0.45 + uHighlight * 0.65, 0.38 + uHighlight * 0.55, uThemeLight);
    litColor += vec3(0.75, 0.85, 0.90) * spec * (1.0 - uGhostMode * 0.65);

    if (uTonotopyMode > 0.01) {
      vec3 specColor = getLinearGreenwoodColor(vGreenwoodX);
      vec3 tonoLit = specColor * (keyTerm * 0.95 + fillTerm + topTerm * 0.78 + 0.32);
      if (uActiveGreenwoodX >= 0.0) {
        float x0 = uActiveGreenwoodX;
        float dist = abs(vGreenwoodX - x0);
        float peak = exp(-pow(dist / 0.055, 2.0));
        float wave = 0.0;
        if (vGreenwoodX >= x0) {
          wave = exp(-(vGreenwoodX - x0) * 6.5) * sin((vGreenwoodX - x0) * 52.0 - uWavePhase);
        }
        tonoLit += specColor * (wave * 0.24);
        tonoLit += mix(vec3(0.92), specColor * 1.35, 0.42) * (peak * 0.68);
      }
      if (uLossMaskActive > 0.5 && vGreenwoodX >= uLossRange.x && vGreenwoodX <= uLossRange.y) {
        float lum = dot(tonoLit, vec3(0.2126, 0.7152, 0.0722));
        vec3 desat = mix(vec3(lum * 0.42), vec3(0.68, 0.05, 0.12), 0.82);
        tonoLit = mix(tonoLit, desat, clamp(uLossSeverity, 0.0, 1.0));
      }
      litColor = mix(litColor, tonoLit, uTonotopyMode);
    }

    if (uCaloricActive > 0.01) {
      float uTherm = clamp((abs(vSpecimenPosition.x) - 4.2) / 6.5, 0.0, 1.0);
      vec3 warmCol = mix(vec3(0.62, 0.05, 0.14), vec3(0.86, 0.28, 0.02), uTherm);
      vec3 coldCol = mix(vec3(0.04, 0.18, 0.65), vec3(0.08, 0.52, 0.78), uTherm);
      vec3 thermCol = (uCaloricTempDiff >= 0.0) ? warmCol : coldCol;
      litColor = mix(litColor, thermCol * (0.85 + 0.35 * fresnel), 0.78 * uCaloricActive);
    }

    if (uClipActive > 0.5) {
      float edge = 1.0 - smoothstep(0.0, 0.28, clipDist);
      vec3 cutColor = mix(vec3(0.18, 0.78, 0.72), vec3(0.03, 0.36, 0.46), uThemeLight);
      litColor = mix(litColor, cutColor * 1.25, edge * 0.88);
    }

    if (uHighlight > 0.01) {
      litColor = mix(litColor, rimColor * 1.15, uHighlight * (0.20 + 0.42 * fresnel));
    }

    if (uTranslocationBreach > 0.01) {
      float pulse = 0.65 + 0.35 * sin(uTime * 12.0);
      litColor = mix(litColor, vec3(0.78, 0.04, 0.14) * pulse, uTranslocationBreach * 0.72);
    }

    float finalAlpha = uOpacity;
    if (uGhostMode > 0.5) {
      float ghostRim = pow(1.0 - ndotv, 1.8);
      float bfAtten = gl_FrontFacing ? 1.0 : 0.28;
      float baseFill = mix(0.03, 0.06, uThemeLight);
      float rimWeight = mix(0.38, 0.44, uThemeLight);
      finalAlpha = clamp((baseFill + rimWeight * ghostRim) * uOpacity * bfAtten, 0.02, 0.52);
      vec3 ghostDarkCol = mix(uBaseColor * 0.55, vec3(0.12, 0.54, 0.60), ghostRim * 0.55);
      vec3 ghostLightCol = mix(vec3(0.28, 0.34, 0.38), vec3(0.04, 0.28, 0.36), ghostRim * 0.65);
      litColor = mix(ghostDarkCol, ghostLightCol, uThemeLight);
    } else if (uOpacity < 0.85) {
      float bfAtten = gl_FrontFacing ? 1.0 : 0.44;
      finalAlpha = clamp(mix(uOpacity * 0.60, min(0.95, uOpacity * 1.38), fresnel) * bfAtten + uHighlight * 0.14, 0.08, 0.95);
    }

    if (uTonotopyMode > 0.01) {
      finalAlpha = mix(finalAlpha, mix(0.86, 0.93, uThemeLight), uTonotopyMode * 0.72);
    }

    if (uClipActive > 0.5 && !gl_FrontFacing) {
      finalAlpha = max(finalAlpha, 0.38);
    }

    gl_FragColor = vec4(litColor, finalAlpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class HeroSpecimen3D {
  private readonly container: HTMLElement;
  private readonly callbacks: HeroSceneCallbacks;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly envRT: THREE.WebGLRenderTarget;

  private readonly rootGroup = new THREE.Group();
  private readonly scaffoldGroup = new THREE.Group();
  private readonly fallbackSpiralLine: THREE.Line;
  private readonly caliperRing: THREE.Mesh;
  private readonly caliperMat: THREE.MeshStandardMaterial;

  private readonly structureRecords = new Map<string, StructureMeshRecord>();
  private readonly pickableMeshes: THREE.Mesh[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointerNDC = new THREE.Vector2();
  private readonly pointerDownPos = new THREE.Vector2();
  private readonly scratchVec = new THREE.Vector3();
  private readonly scratchVec2 = new THREE.Vector3();
  private readonly rendererSize = new THREE.Vector2();
  private readonly pinPool: ProjectedPin[] = IEMAP_STRUCTURES.map((item) => ({
    meshName: item.meshName,
    label: item.shortLabel,
    colorHex: item.colorHex,
    x: 0,
    y: 0,
    visible: false,
    selected: false,
  }));

  // Camera framing defaults (RAS +Z Superior)
  private readonly defaultTarget = new THREE.Vector3(4.5, 1.5, 1.15);
  private readonly defaultPosDesktop = new THREE.Vector3(27.2, -12.6, 9.4);
  private readonly defaultUp = new THREE.Vector3(0, 0, 1);

  // Mode context helpers
  private readonly tonoCursorGroup = new THREE.Group();
  private readonly tonoCursorSphere: THREE.Mesh;
  private readonly tonoCursorRing: THREE.Mesh;

  private readonly radPlaneGroup = new THREE.Group();
  private readonly radPlaneQuad: THREE.Mesh;
  private readonly radPlaneOutline: THREE.LineLoop;
  private readonly radPlaneQuadMat: THREE.MeshBasicMaterial;
  private readonly radPlaneOutlineMat: THREE.LineBasicMaterial;
  private readonly scdsMarker: THREE.Group;

  private readonly otoconiaGroup = new THREE.Group();
  private readonly otoconiaMeshes: THREE.Mesh[] = [];
  private posteriorCanalPath: CanalPathData | null = null;

  private readonly ciGroup = new THREE.Group();
  private readonly ciLineGeom: THREE.BufferGeometry;
  private readonly ciLinePositions: Float32Array;
  private readonly ciLine: THREE.Line;
  private readonly ciLineMat: THREE.LineBasicMaterial;
  private readonly ciContacts: THREE.Mesh[] = [];

  // Interactive & animation state
  private rafId = 0;
  private isDisposed = false;
  private isReducedMotion = false;
  private userInteracting = false;
  private lastUserInteractionMs = 0;
  private simTime = 0;
  private lastTickMs = performance.now();

  private activeMode: ShowcaseMode = 'anatomy';
  private isLightTheme = false;
  private selectedMeshName = 'mesh_david_cochlea';
  private isolatedMeshName: string | null = null;
  private activePresetId = 'overview';
  private bonyPeelPercent = 80;
  private explodePercent = 0;
  private labelDensity: LabelDensity = 'key';

  private targetLeftInset = 0;
  private targetBottomInset = 0;
  private currentLeftInset = 0;
  private currentBottomInset = 0;
  private appliedOffsetX = 0;
  private appliedOffsetY = 0;
  private appliedViewW = 0;
  private appliedViewH = 0;

  private hearingFreqHz = 1000;
  private lossRange: [number, number] | null = null;

  private radPlaneId: RadiologyPlaneId = 'poschl';
  private radDepthMm = 1.2;
  private scdsActive = false;

  private vestSubmode: VestibularSubmode = 'bppv';
  private vestStepIdx = 1;
  private vestYawDeg = 45;
  private vestPitchDeg = -30;
  private vestRollDeg = 0;

  private surgProc: SurgicalProcedure = 'cochlear_implant';
  private surgCiDepthMm = 18.0;
  private surgLabStep = 1;

  private flyAnim: {
    active: boolean;
    startMs: number;
    durationMs: number;
    fromPos: THREE.Vector3;
    toPos: THREE.Vector3;
    fromTarget: THREE.Vector3;
    toTarget: THREE.Vector3;
    fromUp: THREE.Vector3;
    toUp: THREE.Vector3;
  } | null = null;

  // Bound listeners for cleanup
  private readonly resizeObserver: ResizeObserver;
  private readonly motionMql: MediaQueryList;
  private readonly onMotionChangeBound: () => void;
  private readonly onContextLostBound: (ev: Event) => void;
  private readonly onContextRestoredBound: () => void;
  private readonly onPointerDownBound: (ev: PointerEvent) => void;
  private readonly onPointerUpBound: (ev: PointerEvent) => void;
  private readonly onControlsStartBound: () => void;
  private readonly onControlsEndBound: () => void;

  // Disposable asset registry for mode helpers
  private readonly extraDisposables: Array<{ dispose: () => void }> = [];

  constructor(container: HTMLElement, callbacks: HeroSceneCallbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;

    this.motionMql = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.isReducedMotion = this.motionMql.matches;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      premultipliedAlpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.AgXToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.touchAction = 'none';
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();

    const width = Math.max(container.clientWidth, 300);
    const height = Math.max(container.clientHeight, 300);
    const initAspect = width / height;
    this.camera = new THREE.PerspectiveCamera(initAspect < 1 ? 40 : 34, initAspect, 0.2, 260);
    this.camera.up.set(0, 0, 1);

    this.camera.position.copy(
      this.computeFramedPos(this.defaultPosDesktop, this.defaultTarget, initAspect)
    );

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.envRT = pmrem.fromScene(roomEnv, 0.04);
    this.scene.environment = this.envRT.texture;
    roomEnv.dispose();
    pmrem.dispose();

    // Sculptural 3-point key/rim/bounce studio lighting
    const ambient = new THREE.AmbientLight(0xdbe6ef, 0.28);
    const keyLight = new THREE.DirectionalLight(0xf6f9fc, 2.25);
    keyLight.position.set(18, -22, 24);
    const rimLight = new THREE.DirectionalLight(0x7be0e8, 0.95);
    rimLight.position.set(-18, 16, 20);
    const fillLight = new THREE.DirectionalLight(0xecd09e, 0.55);
    fillLight.position.set(8, 22, -16);
    this.scene.add(ambient, keyLight, rimLight, fillLight);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.enablePan = false;
    this.controls.target.copy(this.defaultTarget);
    this.controls.minDistance = 7;
    this.controls.maxDistance = 68;
    this.controls.minPolarAngle = 0.08;
    this.controls.maxPolarAngle = Math.PI - 0.08;
    this.controls.update();

    this.scene.add(this.rootGroup);

    // 1. Frame-0 Stereotaxic Caliper Ring + Instant Fallback Spiral
    const caliperRadius = 7.9;
    const ringGeom = new THREE.TorusGeometry(caliperRadius, 0.032, 10, 96);
    this.caliperMat = new THREE.MeshStandardMaterial({
      color: 0x3b6c78,
      metalness: 0.72,
      roughness: 0.34,
      transparent: true,
      opacity: 0.34,
    });
    this.caliperRing = new THREE.Mesh(ringGeom, this.caliperMat);
    this.caliperRing.position.set(4.5, 1.4, -1.8);
    this.scaffoldGroup.add(this.caliperRing);
    this.extraDisposables.push(ringGeom, this.caliperMat);

    // Cardinal RAS reference ticks
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const tickGeom = new THREE.BoxGeometry(0.42, 0.045, 0.045);
      const tick = new THREE.Mesh(tickGeom, this.caliperMat);
      tick.position.set(
        4.5 + Math.cos(angle) * caliperRadius,
        1.4 + Math.sin(angle) * caliperRadius,
        -1.8
      );
      tick.rotation.z = angle;
      this.scaffoldGroup.add(tick);
      this.extraDisposables.push(tickGeom);
    }

    const spiralPts = COCHLEA_SPLINE_KNOTS.map(([x, y, z]) => new THREE.Vector3(x, y, z));
    const spiralGeom = new THREE.BufferGeometry().setFromPoints(spiralPts);
    const spiralMat = new THREE.LineBasicMaterial({
      color: 0x2ec4b6,
      transparent: true,
      opacity: 0.65,
    });
    this.fallbackSpiralLine = new THREE.Line(spiralGeom, spiralMat);
    this.scaffoldGroup.add(this.fallbackSpiralLine);
    this.extraDisposables.push(spiralGeom, spiralMat);
    this.rootGroup.add(this.scaffoldGroup);

    // 2. Hearing Resonant Locus Helper
    const sphereGeom = new THREE.SphereGeometry(0.36, 20, 20);
    const sphereMat = new THREE.MeshStandardMaterial({
      color: 0x2ec4b6,
      emissive: 0x2ec4b6,
      emissiveIntensity: 0.85,
      roughness: 0.2,
      metalness: 0.1,
    });
    this.tonoCursorSphere = new THREE.Mesh(sphereGeom, sphereMat);
    const haloGeom = new THREE.TorusGeometry(0.62, 0.045, 10, 40);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x8ef2ea,
      transparent: true,
      opacity: 0.8,
    });
    this.tonoCursorRing = new THREE.Mesh(haloGeom, haloMat);
    this.tonoCursorGroup.add(this.tonoCursorSphere, this.tonoCursorRing);
    this.tonoCursorGroup.visible = false;
    this.rootGroup.add(this.tonoCursorGroup);
    this.extraDisposables.push(sphereGeom, sphereMat, haloGeom, haloMat);

    // 3. Radiology Oblique MPR Helper Plane + SCDS Marker (pinned to kept-side SSC roof [5.95, 1.28, 7.42])
    const quadGeom = new THREE.PlaneGeometry(13.5, 13.5);
    this.radPlaneQuadMat = new THREE.MeshBasicMaterial({
      color: 0x2ec4b6,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.radPlaneQuad = new THREE.Mesh(quadGeom, this.radPlaneQuadMat);

    const outlinePts = [
      new THREE.Vector3(-6.75, -6.75, 0),
      new THREE.Vector3(6.75, -6.75, 0),
      new THREE.Vector3(6.75, 6.75, 0),
      new THREE.Vector3(-6.75, 6.75, 0),
    ];
    const outlineGeom = new THREE.BufferGeometry().setFromPoints(outlinePts);
    this.radPlaneOutlineMat = new THREE.LineBasicMaterial({
      color: 0x2ec4b6,
      transparent: true,
      opacity: 0.78,
    });
    this.radPlaneOutline = new THREE.LineLoop(outlineGeom, this.radPlaneOutlineMat);
    this.radPlaneGroup.add(this.radPlaneQuad, this.radPlaneOutline);
    this.radPlaneGroup.visible = false;
    this.rootGroup.add(this.radPlaneGroup);

    const scdsCollarGeom = new THREE.TorusGeometry(0.46, 0.065, 12, 32);
    const scdsCoreGeom = new THREE.SphereGeometry(0.20, 14, 14);
    const scdsMat = new THREE.MeshStandardMaterial({
      color: 0xf46b78,
      emissive: 0xc82333,
      emissiveIntensity: 0.85,
      roughness: 0.28,
    });
    this.scdsMarker = new THREE.Group();
    const scdsCollar = new THREE.Mesh(scdsCollarGeom, scdsMat);
    // Align collar axis along Superior Canal tangent (Pöschl inPlaneX)
    scdsCollar.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(...RADIOLOGY_PLANES.poschl.inPlaneX)
    );
    const scdsCore = new THREE.Mesh(scdsCoreGeom, scdsMat);
    this.scdsMarker.add(scdsCollar, scdsCore);
    // Exact kept-side Pöschl +1.2 mm crown vertex cluster on ls_Hsapiens_Sa
    this.scdsMarker.position.set(5.96, 1.29, 7.46);
    this.scdsMarker.visible = false;
    this.rootGroup.add(this.scdsMarker);
    this.extraDisposables.push(
      quadGeom,
      this.radPlaneQuadMat,
      outlineGeom,
      this.radPlaneOutlineMat,
      scdsCollarGeom,
      scdsCoreGeom,
      scdsMat
    );

    // 4. Vestibular Gold Otoconia Cloud (9 pre-allocated crystal spheres)
    const otoGeom = new THREE.SphereGeometry(0.16, 14, 14);
    const otoMat = new THREE.MeshStandardMaterial({
      color: 0xe5a93c,
      emissive: 0x8a5812,
      emissiveIntensity: 0.45,
      metalness: 0.28,
      roughness: 0.25,
    });
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(otoGeom, otoMat);
      this.otoconiaMeshes.push(m);
      this.otoconiaGroup.add(m);
    }
    this.otoconiaGroup.visible = false;
    this.rootGroup.add(this.otoconiaGroup);
    this.extraDisposables.push(otoGeom, otoMat);

    // 5. Surgical CI Spiral Electrode Carrier + Platinum Contacts (pre-allocated)
    const ciSegCount = 56;
    this.ciLinePositions = new Float32Array(ciSegCount * 3);
    this.ciLineGeom = new THREE.BufferGeometry();
    this.ciLineGeom.setAttribute('position', new THREE.BufferAttribute(this.ciLinePositions, 3));
    this.ciLineMat = new THREE.LineBasicMaterial({ color: 0xe2ecf4, transparent: true, opacity: 0.96 });
    this.ciLine = new THREE.Line(this.ciLineGeom, this.ciLineMat);
    this.ciLine.frustumCulled = false;
    this.ciLine.renderOrder = 3;
    this.ciGroup.add(this.ciLine);

    const contactGeom = new THREE.SphereGeometry(0.155, 14, 14);
    const contactMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      emissive: 0x2ec4b6,
      emissiveIntensity: 0.42,
      metalness: 0.85,
      roughness: 0.18,
    });
    for (let i = 0; i < CI_CONSTANTS.defaultElectrodeCount; i++) {
      const contact = new THREE.Mesh(contactGeom, contactMat);
      contact.renderOrder = 3;
      this.ciContacts.push(contact);
      this.ciGroup.add(contact);
    }
    this.ciGroup.visible = false;
    this.rootGroup.add(this.ciGroup);
    this.extraDisposables.push(this.ciLineGeom, this.ciLineMat, contactGeom, contactMat);

    // Event wiring
    this.onMotionChangeBound = () => {
      this.isReducedMotion = this.motionMql.matches;
    };
    this.motionMql.addEventListener('change', this.onMotionChangeBound);

    this.onContextLostBound = (ev: Event) => {
      ev.preventDefault();
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = 0;
      }
    };
    this.onContextRestoredBound = () => {
      if (!this.isDisposed && !this.rafId) {
        this.startLoop();
      }
    };
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLostBound, false);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.onContextRestoredBound, false);

    this.onPointerDownBound = (ev: PointerEvent) => {
      this.pointerDownPos.set(ev.clientX, ev.clientY);
    };
    this.onPointerUpBound = (ev: PointerEvent) => {
      if (ev.button !== 0) return;
      const dist = Math.hypot(ev.clientX - this.pointerDownPos.x, ev.clientY - this.pointerDownPos.y);
      if (dist <= 6) {
        this.pickAtClientCoords(ev.clientX, ev.clientY);
      }
    };
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDownBound);
    this.renderer.domElement.addEventListener('pointerup', this.onPointerUpBound);

    this.onControlsStartBound = () => {
      this.userInteracting = true;
      this.flyAnim = null;
    };
    this.onControlsEndBound = () => {
      this.userInteracting = false;
      this.lastUserInteractionMs = performance.now();
    };
    this.controls.addEventListener('start', this.onControlsStartBound);
    this.controls.addEventListener('end', this.onControlsEndBound);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.resize();

    void this.loadCanonicalLabyrinth();
    this.startLoop();
  }

  public getDomElement(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  public setLightTheme(isLight: boolean): void {
    this.isLightTheme = isLight;
    const val = isLight ? 1.0 : 0.0;
    for (const rec of this.structureRecords.values()) {
      rec.uniforms.uThemeLight.value = val;
    }
    this.caliperMat.color.setHex(isLight ? 0x3b4752 : 0x5c8b96);
    this.caliperMat.opacity = isLight ? 0.30 : 0.36;
    this.radPlaneOutlineMat.color.setHex(isLight ? 0x0c667e : 0x2ec4b6);
    this.radPlaneQuadMat.color.setHex(isLight ? 0x0c667e : 0x2ec4b6);
    this.radPlaneQuadMat.opacity = isLight ? 0.11 : 0.08;
    this.ciLineMat.color.setHex(isLight ? 0x1e293b : 0xe2ecf4);
  }

  private flyToRadiologyPlane(planeId: RadiologyPlaneId): void {
    const plane = RADIOLOGY_PLANES[planeId];
    const target = new THREE.Vector3(...plane.cameraTargetRAS);
    const rawPos = new THREE.Vector3(...plane.cameraPosRAS);
    const basePos = target.clone().add(rawPos.sub(target).multiplyScalar(1.16));
    const upVec = new THREE.Vector3(...plane.cameraUpRAS).normalize();
    if (this.isReducedMotion) {
      this.rootGroup.rotation.set(0, 0, 0);
    }
    this.flyTo(this.computeFramedPos(basePos, target), target, 520, upVec);
  }

  public setMode(mode: ShowcaseMode): void {
    this.activeMode = mode;
    this.isolatedMeshName = null;
    if (mode === 'anatomy') {
      this.applyPreset(this.activePresetId);
      this.resetCamera();
    } else if (mode === 'hearing') {
      this.applyVisibilityOverride({
        'segT2_th1.07_Otsu': 'hidden',
        seg_coch_outer_T2: 'hidden',
        mesh_david_cochlea: 'visible',
        seg_coch_inner_scala_vestibuli: 'hidden',
        seg_coch_inner_scala_tympani: 'hidden',
        seg_coch_inner_cupula: 'hidden',
        ls_Hsapiens_Sp: 'ghost',
        ls_Hsapiens_Sa: 'ghost',
        ls_Hsapiens_Sl: 'ghost',
      });
      const target = new THREE.Vector3(3.5, 2.3, 0.1);
      this.flyTo(
        this.computeFramedPos(new THREE.Vector3(25.4, -12.0, 6.2), target),
        target,
        520
      );
    } else if (mode === 'radiology') {
      this.applyVisibilityOverride({
        'segT2_th1.07_Otsu': 'visible',
        seg_coch_outer_T2: 'hidden',
        mesh_david_cochlea: 'visible',
        seg_coch_inner_scala_vestibuli: 'hidden',
        seg_coch_inner_scala_tympani: 'hidden',
        seg_coch_inner_cupula: 'hidden',
        ls_Hsapiens_Sa: 'visible',
        ls_Hsapiens_Sp: 'visible',
        ls_Hsapiens_Sl: 'visible',
      });
      this.flyToRadiologyPlane(this.radPlaneId);
    } else if (mode === 'vestibular') {
      this.applyVisibilityOverride({
        'segT2_th1.07_Otsu': 'ghost',
        seg_coch_outer_T2: 'hidden',
        mesh_david_cochlea: 'ghost',
        seg_coch_inner_scala_vestibuli: 'hidden',
        seg_coch_inner_scala_tympani: 'hidden',
        seg_coch_inner_cupula: 'hidden',
        ls_Hsapiens_Sp: 'visible',
        ls_Hsapiens_Sa: 'visible',
        ls_Hsapiens_Sl: 'visible',
        ls_Hsapiens_CCp: 'visible',
        ls_Hsapiens_utricle: 'visible',
        ls_Hsapiens_Ap: 'visible',
      });
      this.resetCamera();
    } else if (mode === 'surgical') {
      this.applyVisibilityOverride({
        'segT2_th1.07_Otsu': 'hidden',
        seg_coch_outer_T2: 'hidden',
        mesh_david_cochlea: 'hidden',
        seg_coch_inner_scala_tympani: 'visible',
        seg_coch_inner_scala_vestibuli: 'ghost',
        seg_coch_inner_cupula: 'hidden',
        ls_Hsapiens_Sp: 'visible',
        ls_Hsapiens_Sa: 'visible',
        ls_Hsapiens_Sl: 'visible',
      });
      const target = new THREE.Vector3(3.8, 1.9, 0.4);
      this.flyTo(
        this.computeFramedPos(new THREE.Vector3(26.2, -12.4, 7.4), target),
        target,
        520
      );
    }
    this.syncAllMeshAppearance();
  }

  public applyPreset(presetId: string): void {
    this.activePresetId = presetId;
    this.isolatedMeshName = null;
    const preset = LAB_PRESETS.find((p) => p.id === presetId) ?? LAB_PRESETS[0];
    this.bonyPeelPercent = preset.bonyPeelPercent;
    this.explodePercent = preset.explodePercent;
    for (const [name, rec] of this.structureRecords) {
      const override = preset.states[name];
      rec.visState = override ?? rec.item.defaultState;
    }
    if (preset.defaultSelectedMesh) {
      this.selectedMeshName = preset.defaultSelectedMesh;
    }
    this.syncAllMeshAppearance();
  }

  public setBonyPeel(percent: number): void {
    this.bonyPeelPercent = Math.max(0, Math.min(100, percent));
    this.syncAllMeshAppearance();
  }

  public setExplode(percent: number): void {
    this.explodePercent = Math.max(0, Math.min(100, percent));
    const scale = this.explodePercent / 100;
    for (const rec of this.structureRecords.values()) {
      const [ox, oy, oz] = rec.item.explodeOffsetRAS;
      rec.mesh.position.set(ox * scale, oy * scale, oz * scale);
    }
  }

  public setStructureVisibility(meshName: string, state: VisibilityState): void {
    const rec = this.structureRecords.get(meshName);
    if (!rec) return;
    rec.visState = state;
    this.syncAllMeshAppearance();
  }

  public getStructureVisibility(meshName: string): VisibilityState {
    return this.structureRecords.get(meshName)?.visState ?? STRUCTURE_BY_MESH[meshName]?.defaultState ?? 'visible';
  }

  public selectStructure(meshName: string, focusCamera = false): void {
    if (!STRUCTURE_BY_MESH[meshName]) return;
    this.selectedMeshName = meshName;
    if (focusCamera) {
      const item = STRUCTURE_BY_MESH[meshName];
      const [cx, cy, cz] = item.centroidRAS;
      const [vx, vy, vz] = item.cameraViewOffsetRAS;
      this.flyTo(
        new THREE.Vector3(cx + vx, cy + vy, cz + vz),
        new THREE.Vector3(cx, cy, cz),
        560
      );
    }
    this.syncAllMeshAppearance();
  }

  public toggleIsolate(meshName: string): boolean {
    if (this.isolatedMeshName === meshName) {
      this.isolatedMeshName = null;
      this.applyPreset(this.activePresetId);
      return false;
    }
    this.isolatedMeshName = meshName;
    this.selectedMeshName = meshName;
    this.syncAllMeshAppearance();
    return true;
  }

  public isIsolated(): boolean {
    return this.isolatedMeshName !== null;
  }

  public resetCamera(): void {
    this.rootGroup.rotation.set(0, 0, 0);
    this.flyTo(
      this.computeFramedPos(this.defaultPosDesktop, this.defaultTarget),
      this.defaultTarget.clone(),
      520
    );
  }

  private computeFramedPos(
    basePos: THREE.Vector3,
    target: THREE.Vector3,
    aspectOverride?: number
  ): THREE.Vector3 {
    const aspect =
      aspectOverride ??
      Math.max(0.35, this.container.clientWidth / Math.max(1, this.container.clientHeight));
    const offset = basePos.clone().sub(target);
    if (aspect < 1.0) {
      // Scale distance smoothly on tall portrait viewports so horizontal canal bounds remain uncropped
      const factor = Math.min(1.62, Math.max(1.14, 0.96 / Math.max(aspect, 0.45)));
      offset.multiplyScalar(factor);
    }
    return target.clone().add(offset);
  }

  public setLabelDensity(density: LabelDensity): void {
    this.labelDensity = density;
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

  public setHearingState(freqHz: number, lossRange: [number, number] | null): void {
    this.hearingFreqHz = freqHz;
    this.lossRange = lossRange;
    const [cx, cy, cz] = getCoordinatesForFrequency(freqHz);
    this.tonoCursorGroup.position.set(cx, cy, cz);
    this.tonoCursorGroup.lookAt(this.camera.position);
    this.syncAllMeshAppearance();
  }

  public setRadiologyState(planeId: RadiologyPlaneId, depthMm: number, scdsActive: boolean): void {
    const planeChanged = planeId !== this.radPlaneId;
    this.radPlaneId = planeId;
    this.radDepthMm = depthMm;
    this.scdsActive = scdsActive;

    const plane = RADIOLOGY_PLANES[planeId];
    const [cx, cy, cz] = plane.centerRAS;
    const [nx, ny, nz] = plane.normalRAS;
    const [ux, uy, uz] = plane.inPlaneX;
    const [vx, vy, vz] = plane.inPlaneY;

    this.radPlaneGroup.position.set(
      cx + nx * depthMm,
      cy + ny * depthMm,
      cz + nz * depthMm
    );
    const rotMat = new THREE.Matrix4().makeBasis(
      new THREE.Vector3(ux, uy, uz),
      new THREE.Vector3(vx, vy, vz),
      new THREE.Vector3(nx, ny, nz)
    );
    this.radPlaneGroup.quaternion.setFromRotationMatrix(rotMat);
    if (this.activeMode === 'radiology' && planeChanged) {
      this.flyToRadiologyPlane(planeId);
    }
    this.syncAllMeshAppearance();
  }

  public setVestibularState(
    submode: VestibularSubmode,
    stepIdx: number,
    yawDeg: number,
    pitchDeg: number,
    rollDeg: number
  ): void {
    this.vestSubmode = submode;
    this.vestStepIdx = stepIdx;
    this.vestYawDeg = yawDeg;
    this.vestPitchDeg = pitchDeg;
    this.vestRollDeg = rollDeg;
    this.updateOtoconiaPositions();
    this.syncAllMeshAppearance();
  }

  public setSurgicalState(proc: SurgicalProcedure, ciDepthMm: number, labStep: number): void {
    this.surgProc = proc;
    this.surgCiDepthMm = ciDepthMm;
    this.surgLabStep = labStep;
    this.updateCIArrayGeometry();
    this.syncAllMeshAppearance();
  }

  private applyVisibilityOverride(overrides: Partial<Record<string, VisibilityState>>): void {
    for (const [name, rec] of this.structureRecords) {
      rec.visState = overrides[name] ?? rec.item.defaultState;
    }
  }

  private syncAllMeshAppearance(): void {
    const peelFactor = Math.max(0.05, 1.0 - (this.bonyPeelPercent / 100) * 0.9);
    const clipUniforms = getShaderClipUniforms(RADIOLOGY_PLANES[this.radPlaneId], this.radDepthMm, false);
    const activeGX = greenwoodPosition(this.hearingFreqHz);

    this.tonoCursorGroup.visible = this.activeMode === 'hearing';
    this.radPlaneGroup.visible = this.activeMode === 'radiology';
    this.scdsMarker.visible = this.activeMode === 'radiology' && this.scdsActive;
    this.otoconiaGroup.visible = this.activeMode === 'vestibular' && this.vestSubmode === 'bppv';
    this.ciGroup.visible = this.activeMode === 'surgical' && this.surgProc === 'cochlear_implant';

    for (const [name, rec] of this.structureRecords) {
      const isSelected = name === this.selectedMeshName;
      let effState = rec.visState;
      if (this.isolatedMeshName !== null) {
        effState = name === this.isolatedMeshName ? 'visible' : 'ghost';
      }

      if (effState === 'hidden') {
        rec.mesh.visible = false;
        continue;
      }

      rec.mesh.visible = true;
      const isBoneShell = rec.item.systemGroup === 'bony_capsule';
      const ghosted = effState === 'ghost' || (isBoneShell && this.bonyPeelPercent > 15 && this.activeMode !== 'radiology');

      const desiredSide =
        this.activeMode === 'radiology' || rec.item.systemGroup === 'ampullae_cupulae'
          ? THREE.DoubleSide
          : THREE.FrontSide;
      if (rec.material.side !== desiredSide) {
        rec.material.side = desiredSide;
        rec.material.needsUpdate = true;
      }

      let targetOpacity = isBoneShell ? Math.min(rec.item.baseAlpha, peelFactor) : rec.item.baseAlpha;
      if (this.activeMode === 'radiology' && isBoneShell) {
        targetOpacity = 0.42;
      } else if (
        this.activeMode === 'surgical' &&
        this.surgProc === 'cochlear_implant' &&
        name === 'seg_coch_inner_scala_tympani'
      ) {
        targetOpacity = 0.46;
      }

      rec.uniforms.uGhostMode.value = ghosted ? 1.0 : 0.0;
      rec.uniforms.uOpacity.value = targetOpacity;
      rec.uniforms.uHighlight.value = isSelected ? 1.0 : 0.0;
      rec.uniforms.uThemeLight.value = this.isLightTheme ? 1.0 : 0.0;

      // Mode-driven GPU shader uniforms
      rec.uniforms.uClipActive.value = this.activeMode === 'radiology' ? clipUniforms.uClipActive : 0.0;
      rec.uniforms.uClipNormal.value.set(...clipUniforms.uClipNormal);
      rec.uniforms.uClipConstant.value = clipUniforms.uClipConstant;

      const isCochleaPart =
        name === 'mesh_david_cochlea' ||
        name === 'seg_coch_inner_scala_tympani' ||
        name === 'seg_coch_inner_scala_vestibuli';
      rec.uniforms.uTonotopyMode.value = this.activeMode === 'hearing' && isCochleaPart ? 1.0 : 0.0;
      rec.uniforms.uActiveGreenwoodX.value = activeGX;

      if (this.lossRange) {
        rec.uniforms.uLossMaskActive.value = 1.0;
        rec.uniforms.uLossRange.value.set(this.lossRange[0], this.lossRange[1]);
        rec.uniforms.uLossSeverity.value = 0.88;
      } else {
        rec.uniforms.uLossMaskActive.value = 0.0;
      }

      const isLatCanal = name === 'ls_Hsapiens_Sl';
      rec.uniforms.uCaloricActive.value =
        this.activeMode === 'vestibular' && this.vestSubmode === 'caloric' && isLatCanal ? 1.0 : 0.0;
      rec.uniforms.uCaloricTempDiff.value = 7.0;

      const isLabTarget =
        this.activeMode === 'surgical' &&
        this.surgProc === 'labyrinthectomy' &&
        this.surgLabStep >= 2 &&
        (name === 'ls_Hsapiens_Sl' || name === 'ls_Hsapiens_Sa' || name === 'ls_Hsapiens_Sp');
      const ciBreach =
        this.activeMode === 'surgical' &&
        this.surgProc === 'cochlear_implant' &&
        this.surgCiDepthMm >= 25.5 &&
        isCochleaPart;
      rec.uniforms.uTranslocationBreach.value = ciBreach || isLabTarget ? 1.0 : 0.0;

      rec.material.depthWrite = !ghosted && rec.uniforms.uOpacity.value >= 0.82;
      rec.mesh.renderOrder = ghosted || isBoneShell ? 2 : 1;
    }
  }

  private updateOtoconiaPositions(): void {
    if (!this.posteriorCanalPath) return;
    const step = EPLEY_STEPS[Math.max(0, Math.min(EPLEY_STEPS.length - 1, this.vestStepIdx))];
    const basePhi = step.targetPhiDeg;
    for (let i = 0; i < this.otoconiaMeshes.length; i++) {
      const offsetPhi = (i - 4) * 2.2;
      const sample = interpolateCanalAtPhi(this.posteriorCanalPath, basePhi + offsetPhi);
      const jitterR = ((i % 3) - 1) * 0.08;
      this.otoconiaMeshes[i].position.set(
        sample.pos[0] + sample.nrm[0] * jitterR,
        sample.pos[1] + sample.nrm[1] * jitterR,
        sample.pos[2] + sample.nrm[2] * jitterR
      );
    }
  }

  private updateCIArrayGeometry(): void {
    const segCount = this.ciLinePositions.length / 3;
    const depth = Math.max(0, Math.min(CI_CONSTANTS.straightMaxDepthMm, this.surgCiDepthMm));
    for (let i = 0; i < segCount; i++) {
      const s = (i / Math.max(1, segCount - 1)) * depth;
      const [x, y, z] = evaluateScalaTympaniSpline(s, 'round_window', 'lateral_wall', 0, 0);
      this.ciLinePositions[i * 3] = x;
      this.ciLinePositions[i * 3 + 1] = y;
      this.ciLinePositions[i * 3 + 2] = z;
    }
    const posAttr = this.ciLineGeom.getAttribute('position') as THREE.BufferAttribute;
    posAttr.needsUpdate = true;

    for (let i = 0; i < this.ciContacts.length; i++) {
      const contactS = depth - i * CI_CONSTANTS.contactPitchMm;
      if (contactS <= 0 || depth <= 0.1) {
        this.ciContacts[i].visible = false;
      } else {
        this.ciContacts[i].visible = true;
        const [cx, cy, cz] = evaluateScalaTympaniSpline(contactS, 'round_window', 'lateral_wall', 0, 0);
        this.ciContacts[i].position.set(cx, cy, cz);
      }
    }
  }

  private async loadCanonicalLabyrinth(): Promise<void> {
    // Load Posterior canal path concurrently for Vestibular mode otoconia
    void loadCanalPath('posterior')
      .then((pathData) => {
        if (this.isDisposed) return;
        this.posteriorCanalPath = pathData;
        this.updateOtoconiaPositions();
      })
      .catch(() => {
        // Canal spline unavailable; non-fatal for initial render
      });

    // Prioritize core silhouette meshes first so labyrinth appears immediately
    const priorityOrder = [...IEMAP_STRUCTURES].sort((a, b) => {
      const pA = KEY_STRUCTURE_MESH_NAMES.has(a.meshName) ? 0 : 1;
      const pB = KEY_STRUCTURE_MESH_NAMES.has(b.meshName) ? 0 : 1;
      return pA - pB;
    });

    const total = priorityOrder.length;
    let completed = 0;
    const batchSize = 6;

    for (let i = 0; i < total; i += batchSize) {
      if (this.isDisposed) return;
      const batch = priorityOrder.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (item) => {
          try {
            const url = `/assets/iemap/obj/${item.meshName}.obj`;
            const geometry = await fetchObjGeometry(url);
            if (this.isDisposed) {
              geometry.dispose();
              return;
            }
            const vertCount = geometry.getAttribute('position').count;
            let greenwoodVals: Float32Array;
            if (
              item.meshName === 'mesh_david_cochlea' ||
              item.meshName === 'seg_coch_inner_scala_tympani' ||
              item.meshName === 'seg_coch_inner_scala_vestibuli'
            ) {
              greenwoodVals = computeMeshGreenwoodX(geometry);
            } else {
              greenwoodVals = new Float32Array(vertCount);
            }
            geometry.setAttribute('aGreenwoodX', new THREE.BufferAttribute(greenwoodVals, 1));

            const uniforms: ShowcaseShaderUniforms = {
              uBaseColor: { value: new THREE.Color(item.colorHex) },
              uOpacity: { value: item.baseAlpha },
              uEmission: { value: item.emissionStrength },
              uGhostMode: { value: item.defaultState === 'ghost' ? 1.0 : 0.0 },
              uHighlight: { value: item.meshName === this.selectedMeshName ? 1.0 : 0.0 },
              uThemeLight: { value: this.isLightTheme ? 1.0 : 0.0 },
              uClipActive: { value: 0.0 },
              uClipNormal: { value: new THREE.Vector3(0, 0, -1) },
              uClipConstant: { value: 0.0 },
              uTonotopyMode: { value: 0.0 },
              uActiveGreenwoodX: { value: greenwoodPosition(this.hearingFreqHz) },
              uWavePhase: { value: 0.0 },
              uLossMaskActive: { value: 0.0 },
              uLossRange: { value: new THREE.Vector2(0, 0) },
              uLossSeverity: { value: 0.85 },
              uCaloricActive: { value: 0.0 },
              uCaloricTempDiff: { value: 7.0 },
              uTranslocationBreach: { value: 0.0 },
              uTime: { value: 0.0 },
            };

            const material = new THREE.ShaderMaterial({
              vertexShader: VERTEX_SHADER,
              fragmentShader: FRAGMENT_SHADER,
              uniforms,
              transparent: true,
              side: item.systemGroup === 'ampullae_cupulae' ? THREE.DoubleSide : THREE.FrontSide,
              polygonOffset: item.systemGroup === 'bony_capsule',
              polygonOffsetFactor: 1,
              polygonOffsetUnits: 1,
              toneMapped: true,
              depthWrite: item.defaultState !== 'ghost' && item.baseAlpha >= 0.82,
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.name = item.meshName;
            mesh.userData.structureItem = item;
            this.rootGroup.add(mesh);
            this.pickableMeshes.push(mesh);

            this.structureRecords.set(item.meshName, {
              item,
              mesh,
              uniforms,
              material,
              visState: item.defaultState,
            });

            if (item.meshName === 'mesh_david_cochlea') {
              this.fallbackSpiralLine.visible = false;
            }
          } catch {
            // Skip failed mesh cleanly
          } finally {
            completed += 1;
            this.callbacks.onLoadedCount?.(completed, total);
          }
        })
      );
      this.syncAllMeshAppearance();
      this.setExplode(this.explodePercent);
    }
    this.updateCIArrayGeometry();
  }

  private pickAtClientCoords(clientX: number, clientY: number): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    this.pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickableMeshes, false);
    for (const hit of hits) {
      if (!hit.object.visible) continue;
      const item = hit.object.userData.structureItem as StructureOntologyItem | undefined;
      if (item && item.systemGroup !== 'bony_capsule') {
        this.selectStructure(item.meshName, false);
        this.callbacks.onSelectStructure?.(item);
        return;
      }
    }
    for (const hit of hits) {
      if (!hit.object.visible) continue;
      const item = hit.object.userData.structureItem as StructureOntologyItem | undefined;
      if (item) {
        this.selectStructure(item.meshName, false);
        this.callbacks.onSelectStructure?.(item);
        return;
      }
    }
  }

  private flyTo(
    toPos: THREE.Vector3,
    toTarget: THREE.Vector3,
    durationMs: number,
    toUp: THREE.Vector3 = this.defaultUp
  ): void {
    if (this.isReducedMotion || durationMs <= 0) {
      this.camera.up.copy(toUp).normalize();
      this.camera.position.copy(toPos);
      this.controls.target.copy(toTarget);
      this.controls.update();
      this.flyAnim = null;
      return;
    }
    this.flyAnim = {
      active: true,
      startMs: performance.now(),
      durationMs,
      fromPos: this.camera.position.clone(),
      toPos,
      fromTarget: this.controls.target.clone(),
      toTarget,
      fromUp: this.camera.up.clone().normalize(),
      toUp: toUp.clone().normalize(),
    };
  }

  private resize(): void {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    const aspect = w / h;
    this.camera.aspect = aspect;
    this.camera.fov = aspect < 1 ? 40 : 34;
    this.renderer.setSize(w, h, false);
    this.applyStageFraming(true);
  }

  private startLoop(): void {
    const tick = (now: number): void => {
      if (this.isDisposed) return;
      this.rafId = requestAnimationFrame(tick);

      const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTickMs) / 1000));
      this.lastTickMs = now;
      if (!this.isReducedMotion) {
        this.simTime += dt;
      }

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

      // Smooth camera fly-to
      if (this.flyAnim?.active) {
        const rawT = (now - this.flyAnim.startMs) / this.flyAnim.durationMs;
        if (rawT >= 1) {
          this.camera.up.copy(this.flyAnim.toUp);
          this.camera.position.copy(this.flyAnim.toPos);
          this.controls.target.copy(this.flyAnim.toTarget);
          this.flyAnim = null;
        } else {
          const ease = 1 - Math.pow(1 - rawT, 3);
          this.camera.up.lerpVectors(this.flyAnim.fromUp, this.flyAnim.toUp, ease).normalize();
          this.camera.position.lerpVectors(this.flyAnim.fromPos, this.flyAnim.toPos, ease);
          this.controls.target.lerpVectors(this.flyAnim.fromTarget, this.flyAnim.toTarget, ease);
        }
      }

      // Radiology orthographic alignment vs Vestibular head tilt vs gentle editorial turntable
      if (this.activeMode === 'radiology') {
        if (this.isReducedMotion) {
          this.rootGroup.rotation.set(0, 0, 0);
        } else {
          this.rootGroup.rotation.x = THREE.MathUtils.lerp(this.rootGroup.rotation.x, 0, 0.16);
          this.rootGroup.rotation.y = THREE.MathUtils.lerp(this.rootGroup.rotation.y, 0, 0.16);
          this.rootGroup.rotation.z = THREE.MathUtils.lerp(this.rootGroup.rotation.z, 0, 0.16);
        }
      } else if (this.activeMode === 'vestibular' && this.vestSubmode === 'bppv') {
        const targetZ = THREE.MathUtils.degToRad(this.vestYawDeg * 0.25);
        const targetX = THREE.MathUtils.degToRad((this.vestPitchDeg + 30) * 0.2);
        const targetY = THREE.MathUtils.degToRad(this.vestRollDeg * 0.25);
        this.rootGroup.rotation.z = THREE.MathUtils.lerp(this.rootGroup.rotation.z, targetZ, 0.1);
        this.rootGroup.rotation.x = THREE.MathUtils.lerp(this.rootGroup.rotation.x, targetX, 0.1);
        this.rootGroup.rotation.y = THREE.MathUtils.lerp(this.rootGroup.rotation.y, targetY, 0.1);
      } else if (!this.isReducedMotion && !this.userInteracting && now - this.lastUserInteractionMs > 2800) {
        // Gentle stereotaxic specimen turntable oscillation around Z
        this.rootGroup.rotation.x = THREE.MathUtils.lerp(this.rootGroup.rotation.x, 0, 0.08);
        this.rootGroup.rotation.y = THREE.MathUtils.lerp(this.rootGroup.rotation.y, 0, 0.08);
        this.rootGroup.rotation.z = Math.sin(this.simTime * 0.22) * 0.18;
      }

      // In-place uniform animation (ZERO allocations)
      for (const rec of this.structureRecords.values()) {
        rec.uniforms.uWavePhase.value = this.simTime * 5.2;
        rec.uniforms.uTime.value = this.simTime;
      }
      if (this.tonoCursorGroup.visible) {
        this.tonoCursorRing.lookAt(this.camera.position);
        const s = this.isReducedMotion ? 1.0 : 0.92 + 0.18 * Math.sin(this.simTime * 3.6);
        this.tonoCursorRing.scale.set(s, s, s);
      }
      if (this.scdsMarker.visible) {
        const s = this.isReducedMotion ? 1.0 : 0.95 + 0.15 * Math.sin(this.simTime * 4.5);
        this.scdsMarker.scale.set(s, s, s);
      }

      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      this.emitProjectedPins();
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private emitProjectedPins(): void {
    if (!this.callbacks.onPinsUpdate) return;
    if (this.labelDensity === 'off') {
      this.callbacks.onPinsUpdate(this.pinPool, 0);
      return;
    }

    this.renderer.getSize(this.rendererSize);
    const w = this.rendererSize.x;
    const h = this.rendererSize.y;
    if (w <= 0 || h <= 0) return;

    this.rootGroup.updateMatrixWorld();
    let activeCount = 0;
    const maxPins = this.labelDensity === 'key' ? (w < 720 ? 3 : 4) : IEMAP_STRUCTURES.length;
    const minSepX = w < 720 ? 156 : 132;
    const minSepY = w < 720 ? 48 : 42;

    // Two passes ensure active selection gets priority before calm neighbor pins
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < IEMAP_STRUCTURES.length; i++) {
        if (activeCount >= maxPins) break;
        const item = IEMAP_STRUCTURES[i];
        const isSelected = item.meshName === this.selectedMeshName;
        if ((pass === 0) !== isSelected) continue;
        if (this.labelDensity === 'key' && !isSelected && !KEY_STRUCTURE_MESH_NAMES.has(item.meshName)) {
          continue;
        }
        const rec = this.structureRecords.get(item.meshName);
        if (rec && !rec.mesh.visible) continue;
        if (item.systemGroup === 'bony_capsule' && this.labelDensity !== 'all' && !isSelected) continue;

        this.scratchVec.set(...item.centroidRAS);
        if (rec) {
          this.scratchVec.add(rec.mesh.position);
        }
        this.scratchVec.applyMatrix4(this.rootGroup.matrixWorld);
        this.scratchVec2.copy(this.scratchVec).project(this.camera);

        const visible =
          this.scratchVec2.z >= -1 &&
          this.scratchVec2.z <= 1 &&
          Math.abs(this.scratchVec2.x) <= 0.90 &&
          Math.abs(this.scratchVec2.y) <= 0.86;

        if (!visible) continue;

        const x = (this.scratchVec2.x * 0.5 + 0.5) * w;
        const y = (-this.scratchVec2.y * 0.5 + 0.5) * h;

        let overlaps = false;
        for (let j = 0; j < activeCount; j++) {
          const prev = this.pinPool[j];
          if (Math.abs(x - prev.x) < minSepX && Math.abs(y - prev.y) < minSepY) {
            overlaps = true;
            break;
          }
        }
        if (overlaps) continue;

        const slot = this.pinPool[activeCount];
        slot.meshName = item.meshName;
        slot.label = item.shortLabel;
        slot.colorHex = item.colorHex;
        slot.x = x;
        slot.y = y;
        slot.visible = true;
        slot.selected = isSelected;
        activeCount += 1;
      }
    }
    this.callbacks.onPinsUpdate(this.pinPool, activeCount);
  }

  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;

    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }

    this.resizeObserver.disconnect();
    this.motionMql.removeEventListener('change', this.onMotionChangeBound);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLostBound, false);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.onContextRestoredBound, false);
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDownBound);
    this.renderer.domElement.removeEventListener('pointerup', this.onPointerUpBound);
    this.controls.removeEventListener('start', this.onControlsStartBound);
    this.controls.removeEventListener('end', this.onControlsEndBound);

    for (const rec of this.structureRecords.values()) {
      rec.mesh.geometry.dispose();
      rec.material.dispose();
    }
    this.structureRecords.clear();
    for (const disp of this.extraDisposables) {
      disp.dispose();
    }

    this.envRT.dispose();
    this.controls.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
