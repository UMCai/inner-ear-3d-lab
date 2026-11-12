import * as THREE from 'three';
import { VisibilityState } from '../data/ontology';

export interface Gate3ShaderUniforms {
  uBaseColor: { value: THREE.Color };
  uOpacity: { value: number };
  uEmission: { value: number };
  uRimPower: { value: number };
  uGhostMode: { value: number };
  uHighlight: { value: number };
  uThemeLight: { value: number };
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
  // Caloric Thermal Convection Uniforms
  uCaloricActive: { value: number };
  uCaloricTempDiff: { value: number };
  uCaloricDiffusion: { value: number };
  uCaloricTime: { value: number };
  // Contralateral Mirrored Mode Normal Correction
  uMirrored: { value: number };
  // Surgical Simulation Uniforms
  uSurgicalDrillActive: { value: number };
  uCanalUnroofed: { value: THREE.Vector3 };
  uTranslocationBreach: { value: number };
  uSurgicalTime: { value: number };
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
  uniform float uThemeLight;
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

  // Caloric Thermal Convection Uniforms
  uniform float uCaloricActive;
  uniform float uCaloricTempDiff;
  uniform float uCaloricDiffusion;
  uniform float uCaloricTime;
  uniform float uMirrored;

  // Surgical Simulation Uniforms
  uniform float uSurgicalDrillActive;
  uniform vec3 uCanalUnroofed;
  uniform float uTranslocationBreach;
  uniform float uSurgicalTime;

  varying vec3 vNormalView;
  varying vec3 vViewPosition;
  varying vec3 vWorldPosition;
  varying vec3 vNormalWorld;
  varying float vGreenwoodX;

  vec3 getGreenwoodSpectralColor(float x) {
    float cx = clamp(x, 0.0, 1.0);
    // Linearized 7-stop perceptual rainbow spectrum for AgX + sRGB output:
    // 0: Apex (20 Hz, Violet) -> 1: ~70 Hz (Royal Blue) -> 2: ~300 Hz (Cyan)
    // -> 3: ~1.2 kHz (Emerald) -> 4: ~4.0 kHz (Amber Gold) -> 5: ~10 kHz (Orange) -> 6: Base (20.7 kHz, Scarlet)
    vec3 c0 = vec3(0.05, 0.03, 0.42);
    vec3 c1 = vec3(0.02, 0.22, 0.64);
    vec3 c2 = vec3(0.02, 0.48, 0.56);
    vec3 c3 = vec3(0.06, 0.52, 0.16);
    vec3 c4 = vec3(0.76, 0.46, 0.02);
    vec3 c5 = vec3(0.76, 0.16, 0.03);
    vec3 c6 = vec3(0.66, 0.03, 0.08);

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
    float clipDist = 1000.0;
    if (uClipActive > 0.5) {
      clipDist = dot(vWorldPosition, uClipNormal) + uClipConstant;
      if (clipDist < 0.0) {
        discard;
      }
    }

    // Discrete Surgical Canal Arch Unroofing Masks
    // uCanalUnroofed.x = Horizontal/Lateral Canal (ls_Hsapiens_Sl)
    // uCanalUnroofed.y = Superior Canal (ls_Hsapiens_Sa)
    // uCanalUnroofed.z = Posterior Canal (ls_Hsapiens_Sp)
    if (uCanalUnroofed.x > 0.5 && vNormalWorld.z > 0.38 && vWorldPosition.x > 4.5) {
      discard;
    }
    if (uCanalUnroofed.y > 0.5 && vNormalWorld.z > 0.40 && vWorldPosition.z > 2.5) {
      discard;
    }
    if (uCanalUnroofed.z > 0.5 && (vNormalWorld.z > 0.38 || vNormalWorld.y < -0.35) && vWorldPosition.y < -1.0) {
      discard;
    }

    vec3 viewDir = normalize(vViewPosition);
    vec3 normal = normalize(vNormalView);
    // Under contralateral mirrored mode (scale.x = -1.0), triangle winding order inverts,
    // so gl_FrontFacing is false for external surfaces.
    bool isFacingOut = (uMirrored > 0.5) ? (!gl_FrontFacing) : gl_FrontFacing;
    bool isBackface = !isFacingOut;
    if (isBackface) {
      normal = -normal;
    }

    // Single-surface glass mode (for patient head cutaway): discard backfaces to prevent self-overlap
    if (uSingleSurface > 0.5 && isBackface) {
      discard;
    }

    float ndotv = clamp(abs(dot(normal, viewDir)), 0.0, 1.0);
    float rimPow = mix(max(1.8, uRimPower), 2.1, uThemeLight);
    float fresnel = pow(1.0 - ndotv, rimPow);

    // Gate 3 3-point studio lighting in world/view space
    vec3 keyDir = normalize(vec3(0.50, -0.56, 0.66));
    vec3 fillDir = normalize(vec3(-0.62, 0.46, 0.32));
    vec3 topDir = normalize(vec3(0.0, 0.25, 0.96));

    vec3 nWorld = normalize(isFacingOut ? vNormalWorld : -vNormalWorld);
    float keyTerm = max(dot(nWorld, keyDir), -0.20) * 0.52 + 0.48;
    float fillTerm = max(dot(nWorld, fillDir), 0.0) * 0.22;
    float topTerm = max(dot(nWorld, topDir), 0.0) * 0.18;

    // Specular wet-tissue sheen (calibrated linear)
    vec3 halfVec = normalize(keyDir + viewDir);
    float spec = pow(max(dot(normal, halfVec), 0.0), 34.0) * 0.28;

    // Theme-aware pigment strength so specimen reads crisply on BOTH obsidian and light drafting paper
    vec3 pigment = mix(uBaseColor * 0.92, uBaseColor * 0.62, uThemeLight);
    vec3 litColor = pigment * (keyTerm + fillTerm + topTerm + uEmission * 0.30);

    vec3 darkRim = mix(uBaseColor * 1.25, vec3(0.10, 0.55, 0.52), 0.36 + uHighlight * 0.42);
    vec3 lightRim = mix(uBaseColor * 0.42, vec3(0.02, 0.24, 0.32), 0.45 + uHighlight * 0.45);
    vec3 rimColor = mix(darkRim, lightRim, uThemeLight);

    litColor += rimColor * fresnel * mix(0.46 + uEmission * 0.35 + uHighlight * 0.65, 0.38 + uHighlight * 0.55, uThemeLight);
    litColor += vec3(0.75, 0.85, 0.90) * spec * (1.0 - uGhostMode * 0.65);

    // Tonotopic Rainbow & von Békésy Traveling Wave
    if (uTonotopyMode > 0.01) {
      vec3 spectralColor = getGreenwoodSpectralColor(vGreenwoodX);
      vec3 tonotopyLit = spectralColor * (keyTerm * 0.95 + fillTerm + topTerm * 0.78 + 0.32);

      // Active resonant tone & asymmetric von Békésy wave
      if (uActiveGreenwoodX >= 0.0 && uWaveAmplitude > 0.01) {
        float x0 = uActiveGreenwoodX;
        float bw = max(0.012, uResonantBandwidth);

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

        float coreDist = abs(vGreenwoodX - x0);
        float core = exp(-pow(coreDist / bw, 2.0));

        tonotopyLit += spectralColor * (wave * 0.28 * uWaveAmplitude);
        vec3 coreGlow = mix(vec3(0.92), spectralColor * 1.35, 0.42);
        tonotopyLit += coreGlow * (core * 0.72 * uWaveAmplitude);
      }

      // Clinical Audiogram Hearing Loss Sector (linearized)
      if (uLossMaskActive > 0.5) {
        if (vGreenwoodX >= uLossRange.x && vGreenwoodX <= uLossRange.y) {
          float lum = dot(tonotopyLit, vec3(0.2126, 0.7152, 0.0722));
          vec3 crimson = vec3(0.68, 0.05, 0.12);
          vec3 damaged = mix(vec3(lum * 0.42), crimson, 0.82);
          tonotopyLit = mix(tonotopyLit, damaged, clamp(uLossSeverity, 0.0, 1.0));
        }
      }

      litColor = mix(litColor, tonotopyLit, uTonotopyMode);
    }

    // Caloric Thermal Convection Shader on Lateral Duct
    if (uCaloricActive > 0.01 && uCaloricDiffusion > 0.001) {
      float xCoord = abs(vWorldPosition.x);
      float uThermal = clamp((xCoord - 4.2) / (10.7 - 4.2), 0.0, 1.0);

      float flowDir = (uCaloricTempDiff > 0.0) ? 1.0 : -1.0;
      float flowRipple = sin(uThermal * 18.0 + uCaloricTime * 4.0 * flowDir) * 0.15 + 0.85;

      vec3 thermalColor;
      if (uCaloricTempDiff < -20.0) {
        vec3 iceBase = vec3(0.02, 0.25, 0.56);
        vec3 frostPeak = vec3(0.72, 0.86, 0.98);
        float sparkle = pow(max(0.0, sin(uThermal * 40.0 + uCaloricTime * 6.0)), 4.0) * 0.32;
        thermalColor = mix(iceBase, frostPeak, uThermal) * (flowRipple + sparkle);
      } else if (uCaloricTempDiff < 0.0) {
        vec3 coldDeep = vec3(0.03, 0.14, 0.62);
        vec3 coldLight = vec3(0.06, 0.48, 0.78);
        thermalColor = mix(coldDeep, coldLight, uThermal) * flowRipple;
      } else {
        vec3 warmAmpulla = vec3(0.62, 0.04, 0.12);
        vec3 warmArch = vec3(0.86, 0.24, 0.02);
        thermalColor = mix(warmAmpulla, warmArch, uThermal) * flowRipple;
      }

      float thermalIntensity = clamp(abs(uCaloricTempDiff) / 7.0, 0.5, 2.0) * uCaloricDiffusion * uCaloricActive;
      litColor = mix(litColor, thermalColor * (1.05 + fresnel * 0.35), min(0.92, thermalIntensity * 0.85));
    }

    // Cross-section cut edge highlight glow (within 0.24 mm of clipping plane, theme-calibrated)
    if (uClipActive > 0.5) {
      float cutEdge = 1.0 - smoothstep(0.0, 0.26, clipDist);
      vec3 cutColor = mix(vec3(0.18, 0.78, 0.72), vec3(0.03, 0.36, 0.46), uThemeLight);
      litColor = mix(litColor, cutColor * 1.25, cutEdge * 0.88);
    }

    // Selection / hover highlight boost
    if (uHighlight > 0.01) {
      litColor = mix(litColor, rimColor * 1.15, uHighlight * (0.20 + 0.44 * fresnel));
    }

    // Surgical Translocation Crimson Flash Alarm
    if (uTranslocationBreach > 0.01) {
      vec3 crimsonBreach = vec3(0.78, 0.04, 0.14);
      float pulse = 0.65 + 0.35 * sin(uSurgicalTime * 16.0);
      litColor = mix(litColor, crimsonBreach * (1.15 * pulse), uTranslocationBreach * 0.82);
    }

    // Surgical Otologic Drill Cutting Visual
    if (uSurgicalDrillActive > 0.5) {
      float drillDist = length(vWorldPosition - vec3(8.68, 0.45, 0.82));
      if (drillDist < 3.2) {
        float drillFlicker = 0.85 + 0.15 * sin(uSurgicalTime * 45.0);
        litColor = mix(litColor, vec3(0.95, 0.78, 0.22) * 1.3 * drillFlicker, (1.0 - drillDist / 3.2) * 0.65);
      }
    }

    // Canal unroofing glistening cut edge highlight
    if (uCanalUnroofed.x > 0.5 || uCanalUnroofed.y > 0.5 || uCanalUnroofed.z > 0.5) {
      float unroofEdge = smoothstep(0.30, 0.40, vNormalWorld.z);
      vec3 unroofCol = mix(vec3(0.68, 0.86, 0.98), vec3(0.18, 0.38, 0.48), uThemeLight);
      litColor = mix(litColor, unroofCol * 1.25, unroofEdge * 0.4);
    }

    float finalAlpha = uOpacity;

    if (uGhostMode > 0.5) {
      // Fresnel X-Ray Ghost Silhouette: transparent interior, crisp luminous/drafting rim
      float ghostRim = pow(1.0 - ndotv, 1.8);
      float bfAtten = isBackface ? 0.28 : 1.0;
      float baseFill = mix(0.03, 0.06, uThemeLight);
      float rimWeight = mix(0.40, 0.44, uThemeLight);
      finalAlpha = clamp((baseFill + rimWeight * ghostRim) * uOpacity * bfAtten, 0.02, 0.56);
      vec3 ghostDarkCol = mix(uBaseColor * 0.55, vec3(0.12, 0.54, 0.60), ghostRim * 0.55);
      vec3 ghostLightCol = mix(vec3(0.28, 0.34, 0.38), vec3(0.04, 0.28, 0.36), ghostRim * 0.65);
      litColor = mix(ghostDarkCol, ghostLightCol, uThemeLight);
      if (uHighlight > 0.01) {
        finalAlpha = clamp(finalAlpha + 0.24 * uHighlight, 0.05, 0.85);
      }
    } else if (uOpacity < 0.82) {
      // Gate 3 translucent lumen shader: clear front lumen + attenuated backface + crisp rim
      float bfAtten = isBackface ? 0.42 : 1.0;
      float edgeAlpha = mix(uOpacity * 0.56, min(0.95, uOpacity * 1.42), fresnel);
      finalAlpha = clamp(edgeAlpha * bfAtten + uHighlight * 0.16, 0.07, 0.95);
    }

    if (uTonotopyMode > 0.01) {
      finalAlpha = mix(finalAlpha, mix(0.86, 0.93, uThemeLight), uTonotopyMode * 0.65);
    }

    if (uClipActive > 0.5 && isBackface) {
      finalAlpha = max(finalAlpha, 0.36);
    }

    gl_FragColor = vec4(litColor, finalAlpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
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
    uThemeLight: { value: 0.0 },
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
    uCaloricActive: { value: 0.0 },
    uCaloricTempDiff: { value: 0.0 },
    uCaloricDiffusion: { value: 0.0 },
    uCaloricTime: { value: 0.0 },
    uMirrored: { value: 0.0 },
    uSurgicalDrillActive: { value: 0.0 },
    uCanalUnroofed: { value: new THREE.Vector3(0, 0, 0) },
    uTranslocationBreach: { value: 0.0 },
    uSurgicalTime: { value: 0.0 },
  };

  const isTranslucent = options.baseAlpha < 0.85 || Boolean(options.singleSurface);

  return new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms: uniforms as unknown as Record<string, THREE.IUniform>,
    transparent: true,
    toneMapped: true,
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
    themeLight?: number;
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
    caloricActive?: number;
    caloricTempDiff?: number;
    caloricDiffusion?: number;
    caloricTime?: number;
    surgicalDrillActive?: number;
    canalUnroofed?: THREE.Vector3;
    translocationBreach?: number;
    surgicalTime?: number;
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
  if (params.themeLight !== undefined) u.uThemeLight.value = params.themeLight;
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
  if (params.caloricActive !== undefined) u.uCaloricActive.value = params.caloricActive;
  if (params.caloricTempDiff !== undefined) u.uCaloricTempDiff.value = params.caloricTempDiff;
  if (params.caloricDiffusion !== undefined) u.uCaloricDiffusion.value = params.caloricDiffusion;
  if (params.caloricTime !== undefined) u.uCaloricTime.value = params.caloricTime;
  if (params.surgicalDrillActive !== undefined) u.uSurgicalDrillActive.value = params.surgicalDrillActive;
  if (params.canalUnroofed !== undefined) u.uCanalUnroofed.value.copy(params.canalUnroofed);
  if (params.translocationBreach !== undefined) u.uTranslocationBreach.value = params.translocationBreach;
  if (params.surgicalTime !== undefined) u.uSurgicalTime.value = params.surgicalTime;
}

/**
 * Donald D. Greenwood perceptual 7-stop spectral color in TypeScript space.
 */
export function getGreenwoodColor(x: number): THREE.Color {
  const cx = Math.max(0.0, Math.min(1.0, x));
  const c0 = new THREE.Color(0.38, 0.10, 0.78);
  const c1 = new THREE.Color(0.12, 0.38, 0.96);
  const c2 = new THREE.Color(0.10, 0.82, 0.94);
  const c3 = new THREE.Color(0.20, 0.88, 0.45);
  const c4 = new THREE.Color(0.98, 0.80, 0.14);
  const c5 = new THREE.Color(0.98, 0.45, 0.12);
  const c6 = new THREE.Color(0.95, 0.12, 0.22);

  if (cx < 0.17) return c0.clone().lerp(c1, cx / 0.17);
  if (cx < 0.33) return c1.clone().lerp(c2, (cx - 0.17) / (0.33 - 0.17));
  if (cx < 0.50) return c2.clone().lerp(c3, (cx - 0.33) / (0.50 - 0.33));
  if (cx < 0.68) return c3.clone().lerp(c4, (cx - 0.50) / (0.68 - 0.50));
  if (cx < 0.84) return c4.clone().lerp(c5, (cx - 0.68) / (0.84 - 0.68));
  return c5.clone().lerp(c6, (cx - 0.84) / (1.00 - 0.84));
}

