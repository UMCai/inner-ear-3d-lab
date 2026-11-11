---
name: threejs-postprocessing
description: "Three.js post-processing: composer pass chains, built-in renderer effects, and the WebGPU/TSL node pipeline — bloom, depth of field, ambient occlusion, custom screen effects. Use when adding visual effects, color grading, blur, glow, or screen-space shaders, on WebGL or with WebGPU and TSL."
---

# Three.js Post-Processing

Targets **three.js 0.170.0** (matching `web/package.json` and `@types/three@0.170.0`). Examples use `EffectComposer` + `WebGLRenderer` (WebGL2); addons import from `three/examples/jsm/...` (repo convention) or `three/addons/...`.

## Quick Start

```javascript
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 5);

// A bright emissive sphere gives bloom something to pick up
const mesh = new THREE.Mesh(
  new THREE.SphereGeometry(1, 32, 16),
  new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffffff, emissiveIntensity: 2 }),
);
scene.add(mesh);

// The composer replaces renderer.render(). Render the scene, then effects,
// then OutputPass last: it applies renderer.toneMapping and outputColorSpace once.
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
// bloomPass.strength, .radius and .threshold are live properties; threshold is the luminance above which things glow
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

function animate() {
  composer.render(); // not renderer.render()
}

renderer.setAnimationLoop(animate);
```

## Pass Order

The composer's buffers hold linear colors; tone mapping and the sRGB conversion happen once, in `OutputPass`, using the renderer's settings. Build chains in this order: `RenderPass` → linear-space effects (bloom, depth of field, SSAO, outline, ...) → `SMAAPass`, after the effects whose edges it should smooth → `OutputPass` → FXAA (`new ShaderPass(FXAAShader)` from `three/examples/jsm/shaders/FXAAShader.js`) only when FXAA is used, because FXAA reads sRGB input. Without FXAA, `OutputPass` is the last pass.

`SSAOPass` darkens the image produced by the previous pass, so a `RenderPass` must come before it. `RenderPixelatedPass` renders the scene itself and replaces `RenderPass`. `pass.enabled = false` skips a pass without rebuilding the chain.

```javascript
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

const dpr = renderer.getPixelRatio();
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85));
composer.addPass(new SMAAPass(window.innerWidth * dpr, window.innerHeight * dpr)); // width & height required in 0.170.0
composer.addPass(new OutputPass());
```

## Composer Setup

- The composer copies the renderer's pixel ratio at construction. Call `renderer.setPixelRatio()` before constructing it, or `composer.setPixelRatio()` afterwards.
- The composer's buffers are not multisampled; `antialias: true` on the renderer does not reach them. For MSAA on the scene render and the composer's buffers, pass your own buffer with `samples` (CSS-pixel size) and size the composer once:

```javascript
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";

const composer = new EffectComposer(
  renderer,
  new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
    type: THREE.HalfFloatType,
    samples: 4, // MSAA on the composer's two buffers
  }),
);
composer.setSize(window.innerWidth, window.innerHeight); // scales the buffer by the pixel ratio
```

- On resize, call `camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); composer.setSize(w, h);` — the composer resizes its buffers and every pass, pixel-ratio included. Never resize a pass by hand.
- `composer.render()` drives time-based passes (FilmPass) from its own internal timer; pass a delta in seconds only if you manage time yourself.
- The composer assigns `renderToScreen` to the last enabled pass every frame. Set `composer.renderToScreen = false` only to keep the result off screen, as selective bloom does below.

## Selective Bloom

Bloom only meshes marked with a layer: paint everything else black for a bloom-only composer that renders off screen, then mix its texture into a final composer that renders the clean scene. `scene.background` is not a mesh: set it to `null` around `bloomComposer.render()`, or it is added to the final image a second time; on resize, call `setSize` on both composers.

```javascript
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

const BLOOM_LAYER = 1;
const bloomLayer = new THREE.Layers();
bloomLayer.set(BLOOM_LAYER); // test mask: matches any object enabled on this layer

mesh.layers.enable(BLOOM_LAYER); // add the layer; set() would remove the mesh from layer 0

// Paint non-bloomed meshes black, then restore them
const darkMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
const materials = new Map();

function darkenNonBloomed(object) {
  if (object.isMesh && bloomLayer.test(object.layers) === false) {
    materials.set(object, object.material);
    object.material = darkMaterial;
  }
}

function restoreMaterial(object) {
  if (materials.has(object)) {
    object.material = materials.get(object);
    materials.delete(object);
  }
}

// Bloom-only composer; with renderToScreen off, its result stays in renderTarget2
const bloomComposer = new EffectComposer(renderer);
bloomComposer.renderToScreen = false;
bloomComposer.addPass(new RenderPass(scene, camera));
bloomComposer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85));

// Final composer: the clean scene plus the bloom texture, mixed by a ShaderPass
const finalComposer = new EffectComposer(renderer);
finalComposer.addPass(new RenderPass(scene, camera));
finalComposer.addPass(
  new ShaderPass(
    new THREE.ShaderMaterial({
      uniforms: {
        baseTexture: { value: null }, // filled from the previous pass
        bloomTexture: { value: bloomComposer.renderTarget2.texture },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D baseTexture;
        uniform sampler2D bloomTexture;
        varying vec2 vUv;
        void main() {
          gl_FragColor = texture2D(baseTexture, vUv) + texture2D(bloomTexture, vUv);
        }
      `,
    }),
    "baseTexture",
  ),
);
finalComposer.addPass(new OutputPass());

function animate() {
  const background = scene.background;
  scene.background = null; // not a mesh: it would bloom and be added twice
  scene.traverse(darkenNonBloomed); // black scene: only marked meshes bloom
  bloomComposer.render();
  scene.traverse(restoreMaterial);
  scene.background = background;
  finalComposer.render(); // clean scene + bloom to the screen
}

renderer.setAnimationLoop(animate);
```

## Depth of Field

```javascript
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera)); // BokehPass reads this color image

const bokehPass = new BokehPass(scene, camera, {
  focus: 10.0, // view-space depth that stays sharp, in world units
  aperture: 0.025, // how far out of focus things blur
  maxblur: 0.01, // cap on the blur radius
});
composer.addPass(bokehPass);
composer.addPass(new OutputPass());

// Refocus at runtime: distanceTo matches the view-space depth for objects near the view center
bokehPass.uniforms.focus.value = camera.position.distanceTo(mesh.position);
```

## Ambient Occlusion

```javascript
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const composer = new EffectComposer(renderer);

// SSAOPass darkens the previous image, so the scene render must come first
composer.addPass(new RenderPass(scene, camera));

const ssaoPass = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
ssaoPass.kernelRadius = 16;
ssaoPass.minDistance = 0.005;
ssaoPass.maxDistance = 0.1;
composer.addPass(ssaoPass);
composer.addPass(new OutputPass());

// Debug views: ssaoPass.output = SSAOPass.OUTPUT.SSAO (or Blur, Depth, Normal); the default shows the shaded scene
```

## Outline

```javascript
import * as THREE from "three";
import { OutlinePass } from "three/addons/postprocessing/OutlinePass.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const outlinePass = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), scene, camera);
outlinePass.selectedObjects = [mesh]; // only these are outlined
outlinePass.edgeStrength = 3;
outlinePass.visibleEdgeColor.set(0xffffff);
outlinePass.hiddenEdgeColor.set(0x190a05); // parts hidden behind other objects
composer.addPass(outlinePass);
composer.addPass(new OutputPass());
```

## More Passes

Film grain, glitch, halftone and vignette are drop-in filters for the middle of the chain. `ColorCorrectionShader` works like the vignette: a `ShaderPass` with `powRGB` / `mulRGB` / `addRGB` uniform vectors. Its default powRGB of (2, 2, 2) darkens the image; start from (1, 1, 1) for neutral.

```javascript
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { FilmPass } from "three/addons/postprocessing/FilmPass.js";
import { GlitchPass } from "three/addons/postprocessing/GlitchPass.js";
import { HalftonePass } from "three/addons/postprocessing/HalftonePass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { VignetteShader } from "three/addons/shaders/VignetteShader.js";

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const filmPass = new FilmPass(0.35, false); // grain intensity, grayscale; animates from the composer's delta
composer.addPass(filmPass);

const glitchPass = new GlitchPass();
glitchPass.goWild = true; // glitch every frame; false (the default) glitches at random intervals
composer.addPass(glitchPass);

const halftonePass = new HalftonePass(window.innerWidth, window.innerHeight, {
  shape: 1,
  radius: 4,
  scatter: 0,
  greyscale: false,
}); // (width, height, params) required in 0.170.0; shape: 1 dot, 2 ellipse, 3 line, 4 square, 5 diamond
composer.addPass(halftonePass);

const vignettePass = new ShaderPass(VignetteShader); // uniforms: offset and darkness
vignettePass.uniforms.offset.value = 1.0;
vignettePass.uniforms.darkness.value = 1.0;
composer.addPass(vignettePass);

composer.addPass(new OutputPass());
```

`RenderPixelatedPass` renders the scene itself, so it replaces `RenderPass` instead of following it:

```javascript
import { RenderPixelatedPass } from "three/addons/postprocessing/RenderPixelatedPass.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const composer = new EffectComposer(renderer);
const pixelatedPass = new RenderPixelatedPass(6, scene, camera); // 6 = pixel size
pixelatedPass.normalEdgeStrength = 0.3; // edges where the surface normal changes (creases)
pixelatedPass.depthEdgeStrength = 0.4; // depth-discontinuity edges
composer.addPass(pixelatedPass);
composer.addPass(new OutputPass());
```

## Custom Passes

Wrap any `ShaderMaterial`-style shader object in a `ShaderPass`. The `tDiffuse` uniform receives the previous pass output. Keep custom effects before `OutputPass` while they work in linear space; place one after it only if it needs sRGB input, like FXAA.

```javascript
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

const WaveShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    intensity: { value: 1.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float intensity;
    varying vec2 vUv;
    void main() {
      vec2 uv = vUv;
      uv.x += sin(uv.y * 10.0 + time) * 0.01 * intensity; // wave distortion
      gl_FragColor = texture2D(tDiffuse, uv);
    }
  `,
};

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const wavePass = new ShaderPass(WaveShader);
composer.addPass(wavePass);
composer.addPass(new OutputPass());

// Drive time uniforms from Clock (three@0.170.0)
const clock = new THREE.Clock();

function animate() {
  wavePass.uniforms.time.value = clock.getElapsedTime();
  composer.render();
}

renderer.setAnimationLoop(animate);
```

> [!NOTE]
> `renderer.setEffects()` and `outputBufferType: THREE.HalfFloatType` were added in later Three.js releases and do **not** exist in `three@0.170.0`. Use `EffectComposer` (with a `HalfFloatType` `WebGLRenderTarget` when HDR/MSAA precision is needed) for all post-processing passes here.

## WebGPU and TSL (`0.170.0` Experimental Note)

Under `WebGPURenderer` in `three@0.170.0`, node-based post-processing uses `THREE.PostProcessing` (not `RenderPipeline`, which is not exported in `0.170.0`), building `pass()` and display nodes from `three/examples/jsm/tsl/display/*.js` (e.g. `BloomNode.js`, `DepthOfFieldNode.js`, `FXAANode.js`, `OutlineNode.js`, `GTAONode.js`).

```javascript
import * as THREE from "three/webgpu";
import { pass } from "three/tsl";
import { bloom } from "three/examples/jsm/tsl/display/BloomNode.js";

const renderer = new THREE.WebGPURenderer({ antialias: true });
await renderer.init();
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const postProcessing = new THREE.PostProcessing(renderer);
const scenePass = pass(scene, camera);
const scenePassColor = scenePass.getTextureNode("output");
postProcessing.outputNode = scenePassColor.add(bloom(scenePassColor, 1.5, 0.4, 0.85));

function animate() {
  postProcessing.render();
}

renderer.setAnimationLoop(animate);
```

## Common Mistakes

- `composer.addPass(new ShaderPass(GammaCorrectionShader))` → `composer.addPass(new OutputPass())`: `GammaCorrectionShader` only applies sRGB gamma, while `OutputPass` applies renderer `toneMapping` (e.g. `AgXToneMapping`), exposure, and `outputColorSpace` once; only passes that need sRGB input (`ShaderPass(FXAAShader)`) follow `OutputPass`.
- `composer.addPass(bloomPass); composer.render();` → `composer.addPass(bloomPass); composer.addPass(new OutputPass()); composer.render();`: composer buffers are linear, so omitting `OutputPass` skips tone mapping and sRGB output encoding.
- `new FXAAPass()` or `import ... from ".../FXAAPass.js"` → `new ShaderPass(FXAAShader)` from `three/examples/jsm/shaders/FXAAShader.js` (and set `fxaaPass.material.uniforms.resolution.value.set(1 / (w * dpr), 1 / (h * dpr))` on setup and resize): `FXAAPass` does not exist in `0.170.0`.
- `new SMAAPass()` or `new HalftonePass(params)` → in `0.170.0` both require width & height arguments (`new SMAAPass(w * dpr, h * dpr)`, `new HalftonePass(w, h, params)`).
- `renderer.setEffects([bloomPass])` → does not exist in `three@0.170.0`; use `EffectComposer` + `RenderPass` + `UnrealBloomPass` + `OutputPass`.
- `new THREE.RenderPipeline(renderer)` → not exported in `three@0.170.0`; `three/webgpu` exports `THREE.PostProcessing` in `0.170.0`.
- `const timer = new THREE.Timer(); timer.connect(document);` → `THREE.Timer` is not in core in `0.170.0` and `jsm/misc/Timer.js` has no `.connect()` method; use `new THREE.Clock()`.
- `composer.addPass(fxaaPass); composer.addPass(outputPass);` → `composer.addPass(outputPass); composer.addPass(fxaaPass);`: FXAA needs sRGB input so it follows `OutputPass`, while `SMAAPass` works in linear space before `OutputPass`.
- `new UnrealBloomPass(new THREE.Vector2(w / 2, h / 2), ...)` → pass full composer size (`w, h`); `addPass` resizes passes to the composer size anyway.
- `bloomPass.renderToScreen = false` → `bloomComposer.renderToScreen = false`: the composer reassigns `renderToScreen` on enabled passes every frame, so keep selective bloom off screen at the composer level.
- `composer.render(); renderer.render(scene, camera);` → `bloomComposer.render(); finalComposer.render();`: the second `renderer.render()` clears the canvas and erases the composer output; selective bloom mixes `bloomComposer.renderTarget2.texture` via a `ShaderPass`.
- `new EffectComposer(renderer)` when using `alpha: true` on `WebGLRenderer`: note that translucent glass/showcase backings with CSS backdrops require preserving alpha or rendering the background inside WebGL unless render target alpha is kept intact cleanly (`HalfFloatType` RGBA).

## See Also

- `threejs-lighting` — `AgXToneMapping`, `RoomEnvironment` IBL, and light intensities
- `threejs-shaders` — GLSL `ShaderMaterial` authoring (`#include <tonemapping_fragment>`, `#include <colorspace_fragment>`)
- `webgl-3d-object` — transparent alpha canvas setup for showcase framing
