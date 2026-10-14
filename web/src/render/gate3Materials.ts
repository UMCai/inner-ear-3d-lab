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
  // Tonotopy & Hearing Lab Uniforms
  uTonotopyMode: { value: number };
  uActiveGreenwoodX: { value: number };
  uResonantBandwidth: { value: number };
  uWavePhase: { value: number };
  uWaveAmplitude: { value: number };
  uLossMaskActive: { value: number };
  uLossRange: { value: THREE.Vector2 };
  uLossSeverity: { value: number };
}

const VERTEX_SHADER = /* glsl */ `
  attribute float aGreenwoodX;

  varying vec3 vNormalView;
  varying vec3 vViewPosition;
  varying vec3 vWorldPosition;
  varying vec3 vNormalWorld;
  varying float vGreenwoodX;

  void main() {
    vGreenwoodX = aGreenwoodX;
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

  // Hearing Lab Tonotopy Uniforms
  uniform float uTonotopyMode;
  uniform float uActiveGreenwoodX;
  uniform float uResonantBandwidth;
  uniform float uWavePhase;
  uniform float uWaveAmplitude;
  uniform float uLossMaskActive;
  uniform vec2 uLossRange;
  uniform float uLossSeverity;

  varying vec3 vNormalView;
  varying vec3 vViewPosition;
  varying vec3 vWorldPosition;
  varying vec3 vNormalWorld;
  varying float vGreenwoodX;

  vec3 getGreenwoodSpectralColor(float x) {
    float cx = clamp(x, 0.0, 1.0);
    // 7-stop perceptual rainbow spectrum:
    // 0: Apex (20 Hz, Violet) -> 1: ~70 Hz (Royal Blue) -> 2: ~300 Hz (Cyan)
    // -> 3: ~1.2 kHz (Emerald) -> 4: ~4.0 kHz (Amber Gold) -> 5: ~10 kHz (Orange) -> 6: Base (20.7 kHz, Scarlet)
    vec3 c0 = vec3(0.38, 0.10, 0.78);
    vec3 c1 = vec3(0.12, 0.38, 0.96);
    vec3 c2 = vec3(0.10, 0.82, 0.94);
    vec3 c3 = vec3(0.20, 0.88, 0.45);
    vec3 c4 = vec3(0.98, 0.80, 0.14);
    vec3 c5 = vec3(0.98, 0.45, 0.12);
    vec3 c6 = vec3(0.95, 0.12, 0.22);

    if (cx < 0.17) {
      return mix(c0, c1, cx / 0.17);
    } else if (cx < 0.33) {
      return mix(c1, c2, (cx - 0.17) / (0.33 - 0.17));
    } else if (cx < 0.50) {
      return mix(c2, c3, (cx - 0.33) / (0.50 - 0.33));
    } else if (cx < 0.68) {
      return mix(c3, c4, (cx - 0.50) / (0.68 - 0.50));
    } else if (cx < 0.84) {
      return mix(c4, c5, (cx - 0.68) / (0.84 - 0.68));
    } else {
      return mix(c5, c6, (cx - 0.84) / (1.00 - 0.84));
    }
  }

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

    // Tonotopic Rainbow & von Békésy Traveling Wave
    if (uTonotopyMode > 0.01) {
      vec3 spectralColor = getGreenwoodSpectralColor(vGreenwoodX);
      vec3 tonotopyLit = spectralColor * (keyTerm * 0.95 + fillTerm + topTerm * 0.8 + 0.38);

      // Active resonant tone & asymmetric von Békésy wave
      if (uActiveGreenwoodX >= 0.0 && uWaveAmplitude > 0.01) {
        float x0 = uActiveGreenwoodX;
        float bw = max(0.012, uResonantBandwidth);

        // 1. Asymmetric traveling wave:
        // Energy starts at base (x=1.0) traveling apically towards x0, building amplitude,
        // then rapidly decays beyond x0 towards apex (x < x0).
        float wave = 0.0;
        if (vGreenwoodX >= x0) {
          float distBase = vGreenwoodX - x0;
          float envelope = exp(-distBase * 6.5);
          float carrier = sin((vGreenwoodX - x0) * 55.0 - uWavePhase);
          wave = envelope * carrier;
        } else {
          float distApex = x0 - vGreenwoodX;
          float steepCutoff = exp(-distApex * 28.0);
          wave = steepCutoff * sin(distApex * 35.0 - uWavePhase);
        }

        // 2. Resonant Core Peak (Gaussian localization)
        float coreDist = abs(vGreenwoodX - x0);
        float core = exp(-pow(coreDist / bw, 2.0));

        tonotopyLit += spectralColor * (wave * 0.38 * uWaveAmplitude);
        vec3 coreGlow = mix(vec3(1.0), spectralColor * 1.6, 0.4);
        tonotopyLit += coreGlow * (core * 0.95 * uWaveAmplitude);
      }

      // 3. Clinical Audiogram Hearing Loss Sector
      if (uLossMaskActive > 0.5) {
        if (vGreenwoodX >= uLossRange.x && vGreenwoodX <= uLossRange.y) {
          float gray = dot(tonotopyLit, vec3(0.299, 0.587, 0.114));
          vec3 crimson = vec3(0.92, 0.16, 0.28);
          vec3 damaged = mix(vec3(gray) * 0.65, crimson, 0.88);
          tonotopyLit = mix(tonotopyLit, damaged, clamp(uLossSeverity, 0.0, 1.0));
        }
      }

      litColor = mix(litColor, tonotopyLit, uTonotopyMode);
    }

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

    if (uTonotopyMode > 0.01) {
      finalAlpha = mix(finalAlpha, 0.88, uTonotopyMode * 0.35);
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
    uTonotopyMode: { value: 0.0 },
    uActiveGreenwoodX: { value: -1.0 },
    uResonantBandwidth: { value: 0.035 },
    uWavePhase: { value: 0.0 },
    uWaveAmplitude: { value: 0.0 },
    uLossMaskActive: { value: 0.0 },
    uLossRange: { value: new THREE.Vector2(0.0, 0.0) },
    uLossSeverity: { value: 0.0 },
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
    tonotopyMode?: number;
    activeGreenwoodX?: number;
    resonantBandwidth?: number;
    wavePhase?: number;
    waveAmplitude?: number;
    lossMaskActive?: number;
    lossRange?: THREE.Vector2;
    lossSeverity?: number;
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

  if (params.tonotopyMode !== undefined) u.uTonotopyMode.value = params.tonotopyMode;
  if (params.activeGreenwoodX !== undefined) u.uActiveGreenwoodX.value = params.activeGreenwoodX;
  if (params.resonantBandwidth !== undefined) u.uResonantBandwidth.value = params.resonantBandwidth;
  if (params.wavePhase !== undefined) u.uWavePhase.value = params.wavePhase;
  if (params.waveAmplitude !== undefined) u.uWaveAmplitude.value = params.waveAmplitude;
  if (params.lossMaskActive !== undefined) u.uLossMaskActive.value = params.lossMaskActive;
  if (params.lossRange !== undefined) u.uLossRange.value.copy(params.lossRange);
  if (params.lossSeverity !== undefined) u.uLossSeverity.value = params.lossSeverity;
}

