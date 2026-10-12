import * as THREE from 'three';
import { VisibilityState } from '../data/ontology';

export interface Gate3ShaderUniforms {
  uBaseColor: { value: THREE.Color };
  uOpacity: { value: number };
  uEmission: { value: number };
  uRimPower: { value: number };
  uGhostMode: { value: number };
  uHighlight: { value: number };
  uSingleSurface: { value: number };
  uClipActive: { value: number };
  uClipNormal: { value: THREE.Vector3 };
  uClipConstant: { value: number };
}

const VERTEX_SHADER = /* glsl */ `
  varying vec3 vNormalView;
  varying vec3 vViewPosition;
  varying vec3 vWorldPosition;
  varying vec3 vNormalWorld;

  void main() {
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
  uniform float uRimPower;
  uniform float uGhostMode;
  uniform float uHighlight;
  uniform float uSingleSurface;
  uniform float uClipActive;
  uniform vec3 uClipNormal;
  uniform float uClipConstant;

  varying vec3 vNormalView;
  varying vec3 vViewPosition;
  varying vec3 vWorldPosition;
  varying vec3 vNormalWorld;

  void main() {
    // Analytic 3D Cross-Section Clipping Plane in RAS space
    if (uClipActive > 0.5) {
      float clipDist = dot(vWorldPosition, uClipNormal) + uClipConstant;
      if (clipDist < 0.0) {
        discard;
      }
    }

    vec3 viewDir = normalize(vViewPosition);
    vec3 normal = normalize(vNormalView);
    bool isBackface = !gl_FrontFacing;
    if (isBackface) {
      normal = -normal;
    }

    // Single-surface glass mode (for patient head cutaway): discard backfaces to prevent self-overlap
    if (uSingleSurface > 0.5 && isBackface) {
      discard;
    }

    float ndotv = clamp(abs(dot(normal, viewDir)), 0.0, 1.0);
    float fresnel = pow(1.0 - ndotv, uRimPower);

    // Gate 3 3-point studio lighting in world/view space
    vec3 keyDir = normalize(vec3(0.45, -0.58, 0.68));
    vec3 fillDir = normalize(vec3(-0.62, 0.42, 0.35));
    vec3 topDir = normalize(vec3(0.0, 0.15, 0.98));

    vec3 nWorld = normalize(gl_FrontFacing ? vNormalWorld : -vNormalWorld);
    float keyTerm = max(dot(nWorld, keyDir), -0.25) * 0.48 + 0.52;
    float fillTerm = max(dot(nWorld, fillDir), 0.0) * 0.24;
    float topTerm = max(dot(nWorld, topDir), 0.0) * 0.16;

    // Specular wet-tissue sheen
    vec3 halfVec = normalize(keyDir + viewDir);
    float spec = pow(max(dot(normal, halfVec), 0.0), 28.0) * 0.26;

    vec3 litColor = uBaseColor * (keyTerm + fillTerm + topTerm + uEmission * 0.38);
    vec3 rimColor = mix(uBaseColor * 1.35, vec3(0.55, 0.92, 1.0), 0.35 + uHighlight * 0.45);
    litColor += rimColor * fresnel * (0.48 + uEmission * 0.45 + uHighlight * 0.75);
    litColor += vec3(0.88, 0.96, 1.0) * spec * (1.0 - uGhostMode * 0.6);

    // Cross-section cut edge highlight glow (within 0.18 mm of clipping plane)
    if (uClipActive > 0.5) {
      float clipDist = dot(vWorldPosition, uClipNormal) + uClipConstant;
      float cutEdge = 1.0 - smoothstep(0.0, 0.22, clipDist);
      litColor = mix(litColor, vec3(0.322, 0.863, 0.949) * 1.45, cutEdge * 0.85);
    }

    // Selection / hover highlight boost
    if (uHighlight > 0.01) {
      litColor = mix(litColor, rimColor * 1.25, uHighlight * (0.25 + 0.55 * fresnel));
    }

    float finalAlpha = uOpacity;

    if (uGhostMode > 0.5) {
      // Fresnel X-Ray Ghost Silhouette: transparent interior, crisp luminous rim
      float ghostRim = pow(1.0 - ndotv, 1.75);
      float bfAtten = isBackface ? 0.32 : 1.0;
      finalAlpha = clamp((0.04 + 0.46 * ghostRim) * uOpacity * bfAtten, 0.02, 0.62);
      litColor = mix(uBaseColor * 0.78, vec3(0.45, 0.82, 0.96), ghostRim * 0.65);
      if (uHighlight > 0.01) {
        finalAlpha = clamp(finalAlpha + 0.25 * uHighlight, 0.05, 0.85);
      }
    } else if (uOpacity < 0.82) {
      // Gate 3 translucent lumen shader: clear front lumen + attenuated backface + crisp rim
      float bfAtten = isBackface ? 0.38 : 1.0;
      float edgeAlpha = mix(uOpacity * 0.48, min(0.92, uOpacity * 1.58), fresnel);
      finalAlpha = clamp(edgeAlpha * bfAtten + uHighlight * 0.18, 0.05, 0.95);
    }

    gl_FragColor = vec4(litColor, finalAlpha);
  }
`;

export function createGate3StructureMaterial(options: {
  colorHex: string;
  baseAlpha: number;
  emissionStrength?: number;
  singleSurface?: boolean;
}): THREE.ShaderMaterial {
  const uniforms: Gate3ShaderUniforms = {
    uBaseColor: { value: new THREE.Color(options.colorHex) },
    uOpacity: { value: options.baseAlpha },
    uEmission: { value: options.emissionStrength ?? 0.2 },
    uRimPower: { value: 2.1 },
    uGhostMode: { value: 0.0 },
    uHighlight: { value: 0.0 },
    uSingleSurface: { value: options.singleSurface ? 1.0 : 0.0 },
    uClipActive: { value: 0.0 },
    uClipNormal: { value: new THREE.Vector3(0, 0, -1) },
    uClipConstant: { value: 10.0 },
  };

  const isTranslucent = options.baseAlpha < 0.85 || Boolean(options.singleSurface);

  return new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms: uniforms as unknown as Record<string, THREE.IUniform>,
    transparent: true,
    depthWrite: !isTranslucent,
    depthTest: true,
    side: THREE.DoubleSide,
  });
}

export function updateGate3MaterialState(
  mat: THREE.ShaderMaterial,
  params: {
    state: VisibilityState;
    baseAlpha: number;
    overrideOpacity?: number;
    highlightLevel: number; // 0 = none, 0.5 = hover, 1.0 = selected
    clipActive: boolean;
    clipNormal: THREE.Vector3;
    clipConstant: number;
  }
): void {
  const u = mat.uniforms as unknown as Gate3ShaderUniforms;
  const effectiveOpacity = params.overrideOpacity ?? params.baseAlpha;

  if (params.state === 'ghost') {
    u.uGhostMode.value = 1.0;
    u.uOpacity.value = Math.max(0.18, Math.min(1.0, effectiveOpacity));
    mat.depthWrite = false;
  } else {
    u.uGhostMode.value = 0.0;
    u.uOpacity.value = effectiveOpacity;
    mat.depthWrite = effectiveOpacity >= 0.84 && u.uSingleSurface.value < 0.5;
  }

  u.uHighlight.value = params.highlightLevel;
  u.uClipActive.value = params.clipActive ? 1.0 : 0.0;
  u.uClipNormal.value.copy(params.clipNormal);
  u.uClipConstant.value = params.clipConstant;
}
