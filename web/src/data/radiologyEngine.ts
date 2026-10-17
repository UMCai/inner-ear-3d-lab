/**
 * web/src/data/radiologyEngine.ts
 *
 * Stereotaxic Radiology Engine for Virtual Temporal Bone MPR & SCDS Third-Window Simulation.
 *
 * Provides:
 * 1. Mathematical definitions of the 4 canonical clinical slicing planes (Pöschl, Stenvers, Axial, Coronal)
 *    in the Right-Anterior-Superior (RAS) stereotaxic millimeter coordinate frame.
 * 2. Orthonormal triads (u, v, n) where u x v = n, ||u|| = ||v|| = ||n|| = 1.0.
 * 3. Exact GPU half-space clipping uniform translations with zero metric drift.
 * 4. 100% continuous landmark lookup dictionaries across calibrated depth ranges.
 * 5. Superior Canal Dehiscence Syndrome (SCDS) third-window fiducials and biomechanics parameters.
 */

export type RadiologyPlaneId = 'poschl' | 'stenvers' | 'axial' | 'coronal';
export type CTWindowMode = 'bone' | 'mri_t2';

export interface SlicingPlaneDefinition {
  id: RadiologyPlaneId;
  title: string;
  sublabel: string;
  clinicalPearl: string;
  normalRAS: [number, number, number];
  inPlaneX: [number, number, number]; // u vector (screen horizontal)
  inPlaneY: [number, number, number]; // v vector (screen vertical)
  centerRAS: [number, number, number];
  minDepthMm: number;
  maxDepthMm: number;
  stepMm: number;
  defaultDepthMm: number;
  cameraPosRAS: [number, number, number];
  cameraTargetRAS: [number, number, number];
  cameraUpRAS: [number, number, number];
  orientationLabels: {
    top: string;
    bottom: string;
    left: string;
    right: string;
  };
}

export interface PlaneLandmark {
  min: number;
  max: number;
  label: string;
  pearl?: string;
  structures: string[];
}

export interface SCDSDefectDefinition {
  apexRAS: [number, number, number]; // Slicer markup SSC_ant_apex [3.85, 0.45, 4.30]
  defectLengthMm: number; // 1.5 mm pathognomonic defect
  canalRoofApexRAS: [number, number, number]; // [5.72, 1.28, 7.56]
  targetMesh: string; // ls_Hsapiens_Sa
  defaultPoschlDepthMm: number; // +1.2 mm
  triad: {
    tullio: string;
    hennebert: string;
    autophony: string;
  };
}

// ---------------------------------------------------------------------------
// Vector Math Helpers
// ---------------------------------------------------------------------------
function dot(a: [number, number, number], b: [number, number, number]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function norm(v: [number, number, number]): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

function normalize(v: [number, number, number]): [number, number, number] {
  const l = norm(v);
  if (l === 0) return [0, 0, 1];
  return [v[0] / l, v[1] / l, v[2] / l];
}

// ---------------------------------------------------------------------------
// The 4 Canonical Clinical Slicing Planes (RAS Stereotaxic Coordinates)
// ---------------------------------------------------------------------------
export const RADIOLOGY_PLANES: Record<RadiologyPlaneId, SlicingPlaneDefinition> = {
  poschl: {
    id: 'poschl',
    title: "Pöschl's Plane",
    sublabel: 'Oblique Sagittal · Parallel to SSC',
    clinicalPearl:
      'Gold standard for Superior Semicircular Canal Dehiscence (SSCD). Profiles the entire osseous canal lumen halo in a single circular cut.',
    normalRAS: normalize([0.814, -0.578, -0.056]),
    inPlaneX: normalize([0.576, 0.816, -0.055]),
    inPlaneY: normalize([0.077, 0.013, 0.997]),
    centerRAS: [4.40, 2.01, -0.31],
    minDepthMm: -9.0,
    maxDepthMm: 9.0,
    stepMm: 0.1,
    defaultDepthMm: 1.2,
    cameraPosRAS: [-20.02, 19.35, 1.37],
    cameraTargetRAS: [4.40, 2.01, -0.31],
    cameraUpRAS: [0.08, 0.01, 1.00],
    orientationLabels: { top: 'S', bottom: 'I', left: 'AS', right: 'PI' },
  },
  stenvers: {
    id: 'stenvers',
    title: "Stenvers' Plane",
    sublabel: 'Oblique Coronal · Perpendicular to SSC',
    clinicalPearl:
      'Strictly 90° orthogonal to Pöschl. Profiles the anterior and posterior limbs of the superior canal end-on, vestibule, and vestibular aqueduct.',
    normalRAS: normalize([0.576, 0.816, -0.055]),
    inPlaneX: normalize([-0.814, 0.578, 0.056]),
    inPlaneY: normalize([0.077, 0.013, 0.997]),
    centerRAS: [4.40, 2.01, -0.31],
    minDepthMm: -6.0,
    maxDepthMm: 6.0,
    stepMm: 0.1,
    defaultDepthMm: 0.0,
    cameraPosRAS: [-12.88, -22.47, 1.34],
    cameraTargetRAS: [4.40, 2.01, -0.31],
    cameraUpRAS: [0.08, 0.01, 1.00],
    orientationLabels: { top: 'S', bottom: 'I', left: 'PL', right: 'AM' },
  },
  axial: {
    id: 'axial',
    title: 'True Axial Plane',
    sublabel: 'Transverse MPR · Lateral Canal Signet Ring',
    clinicalPearl:
      'Classic otologic axial cut showing the lateral semicircular canal "signet ring sign", basal cochlear turn, and internal auditory canal (IAC).',
    normalRAS: normalize([0.000, 0.000, 1.000]),
    inPlaneX: normalize([1.000, 0.000, 0.000]),
    inPlaneY: normalize([0.000, 1.000, 0.000]),
    centerRAS: [4.40, 2.01, -0.31],
    minDepthMm: -7.0,
    maxDepthMm: 9.0,
    stepMm: 0.1,
    defaultDepthMm: 1.0,
    cameraPosRAS: [4.40, 2.01, -30.31],
    cameraTargetRAS: [4.40, 2.01, -0.31],
    cameraUpRAS: [0.00, 1.00, 0.00],
    orientationLabels: { top: 'A', bottom: 'P', left: 'M', right: 'L' },
  },
  coronal: {
    id: 'coronal',
    title: 'True Coronal Plane',
    sublabel: 'Frontal MPR · Cochlear Modiolus 2.5 Turns',
    clinicalPearl:
      'Profiles all 2.5 spiral turns of the cochlea, the central modiolus, promontory, and horizontal tympanic segment of the facial nerve (CN VII).',
    normalRAS: normalize([0.000, 1.000, 0.000]),
    inPlaneX: normalize([-1.000, 0.000, 0.000]),
    inPlaneY: normalize([0.000, 0.000, 1.000]),
    centerRAS: [4.40, 2.01, -0.31],
    minDepthMm: -8.5,
    maxDepthMm: 7.5,
    stepMm: 0.1,
    defaultDepthMm: 0.0,
    cameraPosRAS: [4.40, -27.99, -0.31],
    cameraTargetRAS: [4.40, 2.01, -0.31],
    cameraUpRAS: [0.00, 0.00, 1.00],
    orientationLabels: { top: 'S', bottom: 'I', left: 'L', right: 'M' },
  },
};

// ---------------------------------------------------------------------------
// Continuous Depth Landmark Dictionaries (100% Coverage, 0 Gaps)
// ---------------------------------------------------------------------------
export const RADIOLOGY_LANDMARKS: Record<RadiologyPlaneId, PlaneLandmark[]> = {
  poschl: [
    {
      min: -9.0,
      max: -5.0,
      label: 'Cochlear Basal Turn & Modiolus',
      pearl: 'Medial otic capsule wall, cochlear promontory, and basal cochlear turn.',
      structures: ['mesh_david_cochlea'],
    },
    {
      min: -5.0,
      max: -1.0,
      label: 'Saccule, Vestibule & Internal Auditory Canal',
      pearl: 'Fluid vestibule cavity, saccular macula, and porus acusticus internus.',
      structures: ['mesh_david_sacculus', 'ls_Hsapiens_utricle'],
    },
    {
      min: -1.0,
      max: 0.5,
      label: 'Common Crus & Ampullae',
      pearl: 'Confluence of anterior and posterior vertical canals entering vestibule.',
      structures: ['ls_Hsapiens_CCa', 'ls_Hsapiens_Aa'],
    },
    {
      min: 0.5,
      max: 2.0,
      label: 'Superior Canal Osseous Halo (SSCD Gold Standard)',
      pearl: 'Complete circular lumen ring of SSC; site of apical bone dehiscence (+1.2 mm peak halo).',
      structures: ['ls_Hsapiens_Sa'],
    },
    {
      min: 2.0,
      max: 5.5,
      label: 'Lateral & Posterior Canal Arches',
      pearl: 'Tangential sections across horizontal canal and posterior descending limb.',
      structures: ['ls_Hsapiens_Sl', 'ls_Hsapiens_Sp'],
    },
    {
      min: 5.5,
      max: 9.0,
      label: 'Lateral Petrous Cortex & Mastoid Air Cells',
      pearl: 'Squamous temporal bone boundary, tegmen tympani, and mastoid cortex.',
      structures: ['segT2_th1.07_Otsu'],
    },
  ],
  stenvers: [
    {
      min: -6.0,
      max: -2.5,
      label: 'Posterior Canal Arch & Common Crus',
      pearl: 'Profiles posterior canal arc and retro-vestibular labyrinth.',
      structures: ['ls_Hsapiens_Sp'],
    },
    {
      min: -2.5,
      max: -0.5,
      label: 'Posterior Limb of SSC & Vestibular Aqueduct',
      pearl: 'Evaluates Enlarged Vestibular Aqueduct (EVA > 1.5 mm midpoint) and posterior limb.',
      structures: ['ls_Hsapiens_Sa'],
    },
    {
      min: -0.5,
      max: 1.5,
      label: 'Vestibule, Oval Window & SSC Arch Profile',
      pearl: 'Symmetrical end-on profile of both SSC limbs and oval window stapes footplate.',
      structures: ['ls_Hsapiens_utricle', 'ls_Hsapiens_Sa'],
    },
    {
      min: 1.5,
      max: 3.5,
      label: 'Anterior Limb of SSC & Basal Cochlear Turn',
      pearl: 'Anterior canal ampullary ascent and round window niche for cochlear implant trajectory.',
      structures: ['ls_Hsapiens_Sa', 'mesh_david_cochlea'],
    },
    {
      min: 3.5,
      max: 6.0,
      label: 'Cochlear Modiolus (2.5 turns) & Carotid Canal',
      pearl: 'Spiral cochlear architecture and petrous internal carotid artery canal.',
      structures: ['mesh_david_cochlea'],
    },
  ],
  axial: [
    {
      min: -7.0,
      max: -3.5,
      label: 'Basal Cochlear Turn & Hypotympanum',
      pearl: 'Lowest petrous section showing round window membrane and jugular fossa.',
      structures: ['mesh_david_cochlea'],
    },
    {
      min: -3.5,
      max: -0.5,
      label: 'Cochlea (Modiolus), Saccule & Round Window Niche',
      pearl: 'Classic "two and a half turn" cochlear cut and vestibule floor.',
      structures: ['mesh_david_cochlea', 'mesh_david_sacculus'],
    },
    {
      min: -0.5,
      max: 2.0,
      label: 'Lateral Canal Signet Ring & IAC Porus/Fundus',
      pearl: 'Pathognomonic otologic sign: horizontal canal signet ring + internal auditory canal.',
      structures: ['ls_Hsapiens_Sl', 'ls_Hsapiens_utricle'],
    },
    {
      min: 2.0,
      max: 5.0,
      label: 'Superior Canal Ampulla & Common Crus',
      pearl: 'Bifurcation of common crus and superior ampullary nerve crest.',
      structures: ['ls_Hsapiens_Aa', 'ls_Hsapiens_CCa'],
    },
    {
      min: 5.0,
      max: 9.0,
      label: 'Superior Canal Arch Roof & Arcuate Eminence',
      pearl: 'Subarcuate fossa and arcuate eminence dural bulge on petrous ridge.',
      structures: ['ls_Hsapiens_Sa'],
    },
  ],
  coronal: [
    {
      min: -8.5,
      max: -4.5,
      label: 'Posterior Canal Crus & Mastoid Segment CN VII',
      pearl: 'Descending vertical facial nerve canal and posterior canal apex.',
      structures: ['ls_Hsapiens_Sp'],
    },
    {
      min: -4.5,
      max: -1.5,
      label: 'Vestibular Aqueduct & Common Crus',
      pearl: 'Endolymphatic duct trajectory toward posterior fossa operculum.',
      structures: ['ls_Hsapiens_CCa'],
    },
    {
      min: -1.5,
      max: 1.5,
      label: 'Vestibule, Oval Window & Tympanic Segment CN VII',
      pearl: 'Stapes footplate in oval window and horizontal facial nerve segment.',
      structures: ['ls_Hsapiens_utricle'],
    },
    {
      min: 1.5,
      max: 4.5,
      label: 'Cochlear Modiolus (2.5 turns) & Promontory',
      pearl: 'Classic coronal modiolus cut displaying interscalar septa and cochlear turns.',
      structures: ['mesh_david_cochlea'],
    },
    {
      min: 4.5,
      max: 7.5,
      label: 'Anterior Cochlear Apex & Carotid Gutter',
      pearl: 'Apical cochlear turn and anterior petrous apex adjacent to Meckel cave.',
      structures: ['mesh_david_cochlea'],
    },
  ],
};

// ---------------------------------------------------------------------------
// SCDS Third-Window Anatomical & Biomechanical Parameters
// ---------------------------------------------------------------------------
export const SCDS_PARAMETERS: SCDSDefectDefinition = {
  apexRAS: [3.85, 0.45, 4.30], // Slicer markup fiducial SSC_ant_apex
  defectLengthMm: 1.5,
  canalRoofApexRAS: [5.72, 1.28, 7.56],
  targetMesh: 'ls_Hsapiens_Sa',
  defaultPoschlDepthMm: 1.2,
  triad: {
    tullio:
      'Sound-induced vertigo: Loud acoustic tones (100–500 Hz, 90–100 dB SPL) produce ampullofugal hydraulic streaming, provoking vertical-torsional nystagmus.',
    hennebert:
      'Pressure-induced vertigo: Positive pressure in the external canal (tragal compression or pneumatic otoscopy) directly displaces the compliant dehiscence.',
    autophony:
      'Supranormal bone conduction (< 0 dB HL) and autophony: Patients hear their own eye movements (swishing sound), footsteps, and heartbeat with startling volume.',
  },
};

// ---------------------------------------------------------------------------
// GPU Clipping Uniform Calculation
// ---------------------------------------------------------------------------
export interface ShaderClipUniforms {
  uClipActive: number;
  uClipNormal: [number, number, number];
  uClipConstant: number;
}

export function getShaderClipUniforms(
  plane: SlicingPlaneDefinition,
  depthMm: number,
  inverted = false
): ShaderClipUniforms {
  const n = plane.normalRAS;
  const C = plane.centerRAS;
  const cDotN = dot(C, n);

  if (!inverted) {
    return {
      uClipActive: 1.0,
      uClipNormal: [n[0], n[1], n[2]],
      uClipConstant: -(cDotN + depthMm),
    };
  } else {
    return {
      uClipActive: 1.0,
      uClipNormal: [-n[0], -n[1], -n[2]],
      uClipConstant: +(cDotN + depthMm),
    };
  }
}

// ---------------------------------------------------------------------------
// Landmark Lookup
// ---------------------------------------------------------------------------
export function getLandmarkForDepth(
  planeId: RadiologyPlaneId,
  depthMm: number
): PlaneLandmark {
  const list = RADIOLOGY_LANDMARKS[planeId] || RADIOLOGY_LANDMARKS.poschl;
  const found = list.find((item) => depthMm >= item.min && depthMm <= item.max);
  if (found) return found;

  // Fallback to closest boundary landmark
  if (depthMm < list[0].min) return list[0];
  return list[list.length - 1];
}
