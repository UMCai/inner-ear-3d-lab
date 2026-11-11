---
name: threejs-lighting
description: "Light types and physical units, shadow maps, HDR environment lighting, light probes, and lighting performance, on WebGL or with WebGPU and TSL. Use when adding or tuning lights, fixing shadow acne, setting up image-based lighting, or dimming an environment map."
---

# Three.js Lighting

Targets **three.js 0.170.0** (matching `web/package.json` and `@types/three@0.170.0`). Examples use `WebGLRenderer` (WebGL2); addons import from `three/examples/jsm/...` (repo convention) or `three/addons/...` (also mapped in `three@0.170.0`).

## Quick Start

```javascript
import * as THREE from "three";

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(4, 3, 8);

// A single directional light: intensity is a plain multiplier, no distance falloff
const dirLight = new THREE.DirectionalLight(0xffffff, 3);
dirLight.position.set(5, 10, 5);
scene.add(dirLight);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshStandardMaterial({ color: 0x808080 })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const mesh = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: 0x3a76c4 })
);
scene.add(mesh);

// Shadows need three switches: renderer, light, and the meshes that cast and receive
renderer.shadowMap.enabled = true;
dirLight.castShadow = true;
mesh.castShadow = true;
floor.receiveShadow = true;

function animate() {
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);
```

## Light Types and Units

| Light | Shadows | Intensity | Notes |
|---|---|---|---|
| AmbientLight | no | multiplier | Flat fill from every direction |
| HemisphereLight | no | multiplier | Sky color from above, ground color from below |
| DirectionalLight | yes | multiplier | Parallel rays (sun); shines at its target |
| PointLight | yes, six faces | candela | Inverse-square falloff (decay 2) |
| SpotLight | yes | candela | Cone; inverse-square falloff (decay 2) |
| RectAreaLight | no | nits | Only MeshStandardMaterial and MeshPhysicalMaterial |
| LightProbe | no | multiplier | Spherical-harmonics ambient, usually baked |

PointLight and SpotLight intensity is candela with inverse-square falloff (`decay` 2 by default): a 1-candela light 5 units away contributes 1/25, so useful values depend on distance and typically run to the hundreds (the official docs' examples use 80 to 1000). `light.power` sets the same thing in lumens. `light.distance` is a smooth cutoff range (0 means no limit). Directional, ambient and hemisphere intensities are plain multipliers with no unit. RectAreaLight intensity is nits (candela per square metre).

## Ambient and Hemisphere

```javascript
// AmbientLight(color, intensity) — a flat multiplier on every lit material
const ambient = new THREE.AmbientLight(0x404040, 0.5);
scene.add(ambient);

// HemisphereLight(skyColor, groundColor, intensity)
const hemi = new THREE.HemisphereLight(0x87ceeb, 0x8b6f47, 0.6);
scene.add(hemi);
```

## DirectionalLight

```javascript
// DirectionalLight(color, intensity): parallel rays from position towards target; the distance only matters to the shadow camera
const dirLight = new THREE.DirectionalLight(0xffffff, 3);
dirLight.position.set(5, 10, 5);

// Shines from its position towards target; add the target to the scene when you move it
dirLight.target.position.set(0, 0, 0);
scene.add(dirLight.target);
scene.add(dirLight);
```

## PointLight and SpotLight

```javascript
// PointLight(color, intensity in candela, distance, decay)
const bulb = new THREE.PointLight(0xffdcb0, 100, 20, 2);
bulb.position.set(0, 4, 0);
scene.add(bulb);

// SpotLight(color, intensity in candela, distance, angle, penumbra, decay)
const deskLamp = new THREE.SpotLight(0xffffff, 250, 30, Math.PI / 6, 0.4, 2);
deskLamp.position.set(2, 5, 0);
deskLamp.target.position.set(0, 0, 0);
scene.add(deskLamp.target);
scene.add(deskLamp);

// Prefer lumens: power writes the candela intensity for you
bulb.power = 800;
```

`angle` is the cone half-angle in radians with an upper bound of Math.PI / 2; `penumbra` (0 to 1) softens the cone edge.

## RectAreaLight

A rectangular emitter for soft window- or strip-style lighting. It lights only MeshStandardMaterial and MeshPhysicalMaterial, and it cannot cast shadows.

```javascript
import { RectAreaLightHelper } from "three/addons/helpers/RectAreaLightHelper.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";

// RectAreaLight: add the LTC lookup textures to the renderer's uniforms, once
RectAreaLightUniformsLib.init();

// RectAreaLight(color, intensity in nits, width, height)
const windowLight = new THREE.RectAreaLight(0xffffff, 5, 4, 10);
windowLight.position.set(-5, 5, 0);
windowLight.lookAt(0, 0, 0); // emits from its front face
scene.add(windowLight);

// The helper must be added as a child of the light
const helper = new RectAreaLightHelper(windowLight);
windowLight.add(helper);
```

## Shadows

```javascript
// 1. Renderer: shadow maps are off by default; PCFSoftShadowMap smooths edges nicely,
// PCFShadowMap also filters (and uses shadow.radius), VSMShadowMap blurs the map itself,
// BasicShadowMap is hard-edged
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// 2. Light
const dirLight = new THREE.DirectionalLight(0xffffff, 3);
dirLight.position.set(5, 10, 5);
dirLight.castShadow = true;
scene.add(dirLight);

// 3. Objects
mesh.castShadow = true;
mesh.receiveShadow = true;
```

`shadow.radius` above 1 widens the `PCFShadowMap` filter and the `VSMShadowMap` blur (not used with `PCFSoftShadowMap` or `BasicShadowMap`). VSM also exposes `shadow.blurSamples` (default 8), and `PointLight` shadows do not support VSM at all — `WebGLRenderer` warns and skips the light's shadow. With `VSMShadowMap`, every mesh that receives shadows also casts them.

### Tuning a directional shadow

```javascript
const dirLight = new THREE.DirectionalLight(0xffffff, 3);
dirLight.position.set(5, 10, 5); // every caster must lie between near and far from here
dirLight.castShadow = true;

// The shadow camera sits at the light's position and looks at its target: near and far
// are distances from the light; left/right/top/bottom frame the area around the target
const shadowCam = dirLight.shadow.camera;
shadowCam.left = -10;
shadowCam.right = 10;
shadowCam.top = 10;
shadowCam.bottom = -10;
shadowCam.near = 0.5;
shadowCam.far = 50;
shadowCam.updateProjectionMatrix(); // needed whenever these change after the first render

dirLight.shadow.mapSize.set(2048, 2048); // powers of two

// Acne: normalBias offsets the lookup along the surface normal (light grazing a surface);
// bias offsets the depth compared against the map — start tiny, negative fights acne
dirLight.shadow.normalBias = 0.02;
dirLight.shadow.bias = -0.0001;

// Lighten shadows without adding fill lights: 0 removes, 1 is full darkness
dirLight.shadow.intensity = 0.7;
```

### Point and spot shadow cameras are derived

The renderer rebuilds these cameras on every shadow pass: a spot light's shadow fov is `2 × angle × shadow.focus` (in degrees) and its far comes from `light.distance`; a point light's far also comes from `light.distance`. The fov is always overwritten, and a manual `far` survives only while `distance` is 0. Control the cone with `angle` and `shadow.focus`, the range with `distance`.

```javascript
const deskLamp = new THREE.SpotLight(0xffffff, 250, 30);
deskLamp.castShadow = true;
deskLamp.shadow.mapSize.set(1024, 1024);
deskLamp.shadow.focus = 0.9; // shadow fov as a fraction of the light's cone
deskLamp.shadow.bias = -0.0001;
```

Visualize a directional or spot light's shadow camera with `new THREE.CameraHelper(light.shadow.camera)` added to the scene, and call the helper's `update()` after changing the camera.

### Contact shadows (fake, cheap)

A shadow map per light is overkill for a grounded look; a radial-gradient blob costs one textured quad.

```javascript
// A soft blob under the object: no shadow map, works under both renderers
const size = 128;
const canvas = document.createElement("canvas");
canvas.width = canvas.height = size;
const ctx = canvas.getContext("2d");
const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
gradient.addColorStop(0, "rgba(0,0,0,0.6)");
gradient.addColorStop(1, "rgba(0,0,0,0)");
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, size, size);

const shadowTexture = new THREE.CanvasTexture(canvas);
shadowTexture.colorSpace = THREE.SRGBColorSpace; // a canvas used as a color map is sRGB

const blob = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),
  new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false })
);
blob.rotation.x = -Math.PI / 2;
blob.position.y = 0.001; // just above the floor to avoid z-fighting
scene.add(blob);
```

For a blob that follows the object's silhouette, render depth from below into a render target and blur it — the official `webgl_shadow_contact` example does this with `HorizontalBlurShader` and `VerticalBlurShader` from `three/addons/shaders/`.

## Light Helpers

```javascript
const dirLight = new THREE.DirectionalLight(0xffffff, 3);
const hemi = new THREE.HemisphereLight(0x87ceeb, 0x8b6f47, 0.6);
const bulb = new THREE.PointLight(0xffdcb0, 100, 20);
const deskLamp = new THREE.SpotLight(0xffffff, 250, 30);
scene.add(dirLight, hemi, bulb, deskLamp);

// Built-in helpers are objects: add them to the scene
const dirHelper = new THREE.DirectionalLightHelper(dirLight, 5);
const pointHelper = new THREE.PointLightHelper(bulb, 0.5);
const spotHelper = new THREE.SpotLightHelper(deskLamp);
const hemiHelper = new THREE.HemisphereLightHelper(hemi, 5);
scene.add(dirHelper, pointHelper, spotHelper, hemiHelper);
```

Every light helper copies the light's color only in `update()`, and DirectionalLightHelper, SpotLightHelper and HemisphereLightHelper also re-aim only there: call `update()` after recoloring a light, and after moving or re-aiming one of those three.

## Environment Lighting (IBL)

```javascript
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";

// WebGLRenderer prefilters an equirect environment texture automatically via WebGLCubeUVMaps
const hdr = await new RGBELoader().loadAsync("sunset.hdr");
hdr.mapping = THREE.EquirectangularReflectionMapping;

scene.environment = hdr; // lights the scene
scene.background = hdr; // optional: also draw it behind the scene
scene.environmentIntensity = 1; // scales the lighting contribution only
scene.environmentRotation.set(0, Math.PI / 4, 0); // rotates the lighting
scene.backgroundBlurriness = 0; // blurs the background, not the lighting
scene.backgroundIntensity = 1;
scene.backgroundRotation.set(0, 0, 0); // rotates the background independently
```

`scene.environment` lights `MeshStandardMaterial` and `MeshPhysicalMaterial`, plus `MeshLambertMaterial` and `MeshPhongMaterial` under `WebGLRenderer`. Keep `PMREMGenerator` for procedural environments generated from a scene (such as `RoomEnvironment`, which requires zero external HDR asset fetches); on an equirectangular file `WebGLRenderer` prefilters on assignment when `EquirectangularReflectionMapping` is set:

```javascript
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const pmrem = new THREE.PMREMGenerator(renderer);
const room = new RoomEnvironment();
const envRT = pmrem.fromScene(room, 0.04);
scene.environment = envRT.texture;
room.dispose(); // frees the room's geometries and materials
pmrem.dispose();
// Retain envRT to dispose() on teardown
```

A cube texture works as an environment without any mapping line:

```javascript
const cubeEnv = await new THREE.CubeTextureLoader().loadAsync([
  "px.jpg",
  "nx.jpg",
  "py.jpg",
  "ny.jpg",
  "pz.jpg",
  "nz.jpg",
]);

scene.environment = cubeEnv;
scene.background = cubeEnv;
```

## Light Probes

```javascript
import { LightProbeGenerator } from "three/examples/jsm/lights/LightProbeGenerator.js";

// Bake ambient spherical harmonics from what a cube camera sees
const cubeCamera = new THREE.CubeCamera(0.1, 100, new THREE.WebGLCubeRenderTarget(256));
cubeCamera.update(renderer, scene);

const lightProbe = await LightProbeGenerator.fromCubeRenderTarget(renderer, cubeCamera.renderTarget);
scene.add(lightProbe);
```

`LightProbeGenerator.fromCubeTexture(cubeTexture)` derives one synchronously from an already-loaded cube texture.

## Common Setups

```javascript
// Three-point lighting: key, fill, rim
const keyLight = new THREE.DirectionalLight(0xffffff, 2);
keyLight.position.set(5, 6, 4);

const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
fillLight.position.set(-5, 3, 5);

const backLight = new THREE.DirectionalLight(0xffffff, 1);
backLight.position.set(-4, 5, -6);

scene.add(keyLight, fillLight, backLight);
```

```javascript
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

// Clinical / product showcase: soft studio IBL + directional key and rim light
const pmrem = new THREE.PMREMGenerator(renderer);
const room = new RoomEnvironment();
const studioEnv = pmrem.fromScene(room, 0.04);
scene.environment = studioEnv.texture;
scene.environmentIntensity = 0.75;
room.dispose();
pmrem.dispose();

const key = new THREE.DirectionalLight(0xffffff, 1.8);
key.position.set(20, -25, 25);
const rim = new THREE.DirectionalLight(0x52dcf2, 0.9);
rim.position.set(0, 10, 30);
scene.add(key, rim);
```

## Animating Lights

```javascript
// Clock drives elapsed time safely per frame (three@0.170.0)
const clock = new THREE.Clock();

const lamp = new THREE.PointLight(0xffd0a0, 100, 20);
scene.add(lamp);

function animate() {
  const t = clock.getElapsedTime();
  lamp.position.set(Math.cos(t) * 4, 3, Math.sin(t) * 4);
  lamp.intensity = 100 + Math.sin(t * 2) * 30;

  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);
```

(If using `Timer` from `three/examples/jsm/misc/Timer.js`, note that in `0.170.0` `Timer` handles `visibilitychange` automatically inside its constructor and has no `.connect(document)` method.)

## Performance

- `WebGLRenderer` compiles the active light configuration into every lit built-in material: adding or removing a light, or toggling `castShadow`, forces shader recompilation. Remove unused lights; toggle lights at runtime through `intensity = 0`.
- Every shadow-casting light adds depth passes (six per `PointLight`). Leave `castShadow` off where nothing needs the shadow.
- Static scenes: render shadows on demand with `renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;` (and `light.shadow.autoUpdate = false; light.shadow.needsUpdate = true;` per light).
- Keep directional shadow frustums tight around the specimen to maximize texel density.
- Lights are not filtered per mesh by layers: a light's layers are tested only against the camera's layers.

## Common Mistakes

- `light.layers.set(1);` → lights filter against camera layers, not mesh layers: `light.layers` switches the light on/off for the active camera, not per object.
- `new THREE.PointLight(0xffffff, 1, 100);` → `new THREE.PointLight(0xffffff, 100, 20);`: point and spot intensity is candela with inverse-square falloff (`decay = 2`), so 1 contributes almost nothing at distance; typical values run to the hundreds.
- `renderer.useLegacyLights = true;` → `useLegacyLights` was removed in modern Three.js; tune `PointLight`/`SpotLight` intensities in candela instead.
- `lightProbe.copy(LightProbeGenerator.fromCubeRenderTarget(renderer, rt));` → `lightProbe.copy(await LightProbeGenerator.fromCubeRenderTarget(renderer, rt));`: `fromCubeRenderTarget` is async and returns a Promise.
- `new ContactShadows({ opacity: 0.5 });` → three.js has no `ContactShadows` class (that is a React Three Fiber `drei` helper); bake or paint a radial-gradient shadow plane under the object instead.
- `import { HDRLoader } ...` → `import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";`: `HDRLoader` does not exist in `three@0.170.0`; use `RGBELoader`.
- `import { SunLight } ...` or `LightProbeGridWebGL` → neither exists in `three@0.170.0`; fit a `DirectionalLight` shadow camera frustum manually or bake a `LightProbe` / `RoomEnvironment`.
- `const timer = new THREE.Timer(); timer.connect(document);` → `THREE.Timer` is not in core in `0.170.0` and `jsm/misc/Timer.js` has no `.connect()` method; use `new THREE.Clock()` or `Timer` directly with `timer.update(timestamp)`.
- `scene.environment = pmremGenerator.fromEquirectangular(texture).texture;` → `texture.mapping = THREE.EquirectangularReflectionMapping; scene.environment = texture;`: `WebGLRenderer` prefilters equirectangular environments automatically via `WebGLCubeUVMaps`; keep `PMREMGenerator` for `fromScene(room, 0.04)`.
- `scene.background = hdr;` → `hdr.mapping = THREE.EquirectangularReflectionMapping; scene.background = hdr;`: `RGBELoader` returns a UV-mapped texture, so without `EquirectangularReflectionMapping` the background draws as a flat quad.
- `spotLight.shadow.camera.fov = 30;` → `spotLight.shadow.focus = 0.9;`: the shadow camera's fov is recomputed each pass as `2 × angle × focus` in degrees, so control it through `angle` and `shadow.focus`.
- `const lamp = new THREE.PointLight(0xffffff, 100, 20); lamp.shadow.camera.far = 50;` → `const lamp = new THREE.PointLight(0xffffff, 100, 50);`: a non-zero `distance` overwrites the shadow camera's `far` on every shadow pass.
- `material.envMapIntensity = 0.5;` → `scene.environmentIntensity = 0.5;`: `material.envMapIntensity` works when `scene.environment` or `material.envMap` is set, while `scene.environmentIntensity` scales `scene.environment` globally for all PBR materials.

## See Also

- `threejs-materials` — how materials respond to light (`roughness`, `metalness`, `clearcoat`, `envMapIntensity`)
- `threejs-shaders` — custom GLSL effects (`fresnel` rims, `#include <tonemapping_fragment>`, `#include <colorspace_fragment>`)
- `threejs-postprocessing` — `EffectComposer`, `UnrealBloomPass`, `OutputPass` under `three@0.170.0`
