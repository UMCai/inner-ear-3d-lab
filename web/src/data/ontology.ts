export type VisibilityState = 'visible' | 'ghost' | 'hidden';

export type SystemGroupId =
  | 'bony_capsule'
  | 'semicircular_ducts'
  | 'ampullae_cupulae'
  | 'otolith_vestibule'
  | 'cochlear_system';

export interface SystemGroupMeta {
  id: SystemGroupId;
  title: string;
  shortTitle: string;
  subtitle: string;
  accentHex: string;
  description: string;
}

export interface StructureOntologyItem {
  meshName: string;
  structureId: string;
  displayName: string;
  shortLabel: string;
  latinName: string;
  etymology: string;
  systemGroup: SystemGroupId;
  subGroup: string;
  defaultState: VisibilityState;
  colorHex: string;
  baseAlpha: number;
  emissionStrength: number;
  centroidRAS: [number, number, number];
  explodeOffsetRAS: [number, number, number];
  cameraViewOffsetRAS: [number, number, number];
  fluidCompartment: 'Endolymph (High K+, +80 mV)' | 'Perilymph (High Na+, 0 mV)' | 'Gelatinous Cupula Diaphragm' | 'Otic Capsule / Perilymph Shell';
  innervation: string;
  verticesCount: number;
  facesCount: number;
  morphometry: string;
  physiologicalFunction: string;
  clinicalPearl: string;
  patientSummary: string;
  sources?: string[];
}

export interface DissectionPreset {
  id: string;
  title: string;
  badge: string;
  description: string;
  bonyPeelPercent: number;
  microCutawayPercent: number;
  explodePercent: number;
  states: Partial<Record<string, VisibilityState>>;
  defaultSelectedMesh?: string;
  cameraPresetId?: string;
}

export const SYSTEM_GROUPS: Record<SystemGroupId, SystemGroupMeta> = {
  semicircular_ducts: {
    id: 'semicircular_ducts',
    title: 'Balance Loops (Semicircular Canals)',
    shortTitle: 'Balance Loops',
    subtitle: '3 Fluid-Filled Loops That Sense Head Turning & Tilting',
    accentHex: '#52dcf2',
    description:
      'Membranous semicircular ducts suspended within the bony canals. Organized in functional coplanar pairs (LARP, RALP, Horizontal) to transduce 3D head angular velocity.',
  },
  ampullae_cupulae: {
    id: 'ampullae_cupulae',
    title: 'Balance Sensors (Ampullae & Cupulae)',
    shortTitle: 'Balance Sensors',
    subtitle: 'Gelatinous Motion-Sensing Flaps at the Base of Each Loop',
    accentHex: '#f0aa62',
    description:
      'Dilated ampullary chambers at the utricular end of each semicircular duct housing the saddle-shaped crista ampullaris and the elastic 3-zone cupula diaphragm.',
  },
  otolith_vestibule: {
    id: 'otolith_vestibule',
    title: 'Gravity & Resting Sacs (Utricle & Saccule)',
    shortTitle: 'Resting Sacs',
    subtitle: 'Main Chambers Where Balance Crystals Normally Rest',
    accentHex: '#75c79e',
    description:
      'Central vestibular sacs containing horizontal (utricular) and vertical (saccular) maculae weighted by calcium carbonate otoconia crystals.',
  },
  cochlear_system: {
    id: 'cochlear_system',
    title: 'Hearing Snail (Cochlea & Chambers)',
    shortTitle: 'Hearing Snail',
    subtitle: 'Spiral Hearing Organ & Fluid Sound Chambers',
    accentHex: '#7fa8d4',
    description:
      '2.6-turn helico-spiral auditory organ partitioned into ascending perilymphatic Scala Vestibuli, central endolymphatic Scala Media, and descending Scala Tympani.',
  },
  bony_capsule: {
    id: 'bony_capsule',
    title: 'Outer Bone Shell (Bony Labyrinth)',
    shortTitle: 'Outer Bone Shell',
    subtitle: 'Protective Temporal Bone Shell Around the Inner Ear',
    accentHex: '#8fa4bc',
    description:
      'Dense petrous bone envelope derived from T2 MRI Otsu segmentation enclosing the perilymphatic space around the delicate membranous labyrinth.',
  },
};

export const IEMAP_STRUCTURES: StructureOntologyItem[] = [
  // ============================================================================
  // 1. SEMICIRCULAR DUCTS & CRURA (6 Meshes)
  // ============================================================================
  {
    meshName: 'ls_Hsapiens_Sp',
    structureId: 'right.posterior_duct',
    displayName: 'Posterior Semicircular Duct',
    shortLabel: 'Posterior Semicircular Duct',
    latinName: 'Ductus semicircularis posterior',
    etymology: 'Latin: ductus (channel) + semi (half) + circularis (ring) + posterior (behind)',
    systemGroup: 'semicircular_ducts',
    subGroup: 'Posterior Canal Pathway',
    defaultState: 'visible',
    colorHex: '#52dcf2',
    baseAlpha: 0.42,
    emissionStrength: 0.35,
    centroidRAS: [6.27, -3.66, 0.13],
    explodeOffsetRAS: [5.5, -5.5, 0.4],
    cameraViewOffsetRAS: [16.5, -11.5, 4.5],
    fluidCompartment: 'Endolymph (High K+, +80 mV)',
    innervation: 'Posterior Ampullary Nerve (Inferior Vestibular Division of CN VIII)',
    verticesCount: 5846,
    facesCount: 11688,
    morphometry: 'Radius of curvature ~2.85 mm; lumen diameter ~0.32 mm; oriented in the right LARP plane (~45° posterolateral).',
    physiologicalFunction:
      'Senses angular acceleration in the pitch-roll LARP plane (coplanar with the contralateral Left Anterior canal). Ampullofugal endolymph flow (away from ampulla) depolarizes hair cells (Ewald’s 3rd Law).',
    clinicalPearl:
      'Accountable for 85–90% of all BPPV cases because its inferior ampullary limb sits at the most gravity-dependent point of the labyrinth in both upright and supine postures.',
    patientSummary:
      'The back balance loop of the inner ear that senses when you tip your head backward or lie down. Loose crystals most often collect here in BPPV ("ear crystal vertigo") because it sits at the lowest point of the inner ear.',
  },
  {
    meshName: 'ls_Hsapiens_Sa',
    structureId: 'right.anterior_duct',
    displayName: 'Anterior (Superior) Semicircular Duct',
    shortLabel: 'Anterior Semicircular Duct',
    latinName: 'Ductus semicircularis anterior',
    etymology: 'Latin: anterior (foremost / superior vertical canal)',
    systemGroup: 'semicircular_ducts',
    subGroup: 'Anterior Canal Pathway',
    defaultState: 'visible',
    colorHex: '#6c87ad',
    baseAlpha: 0.64,
    emissionStrength: 0.14,
    centroidRAS: [5.64, 1.15, 5.03],
    explodeOffsetRAS: [2.2, 1.8, 6.8],
    cameraViewOffsetRAS: [16.0, 7.5, 11.0],
    fluidCompartment: 'Endolymph (High K+, +80 mV)',
    innervation: 'Anterior Ampullary Nerve (Superior Vestibular Division of CN VIII)',
    verticesCount: 4964,
    facesCount: 9924,
    morphometry: 'Superior-most arch of the labyrinth (reaching Z = +7.56 mm in RAS); oriented ~41–45° anterolaterally in the RALP plane.',
    physiologicalFunction:
      'Detects forward/diagonal pitch rotations in the RALP plane (paired with the Left Posterior canal). Ampullofugal flow causes excitation and upward/torsional VOR slow-phase eye movement.',
    clinicalPearl:
      'Thinning of the overlying petrous bone causes Superior Semicircular Canal Dehiscence Syndrome (SCDS), creating a pathologic "third mobile window" with Tullio phenomenon and autophony.',
    patientSummary:
      'The top balance loop of the inner ear that senses forward nodding movements. Because it sits at the highest point of the balance system, loose crystals rarely stay trapped here.',
  },
  {
    meshName: 'ls_Hsapiens_Sl',
    structureId: 'right.lateral_duct',
    displayName: 'Lateral (Horizontal) Semicircular Duct',
    shortLabel: 'Lateral Semicircular Duct',
    latinName: 'Ductus semicircularis lateralis',
    etymology: 'Latin: latus (flank / side — horizontal yaw canal)',
    systemGroup: 'semicircular_ducts',
    subGroup: 'Lateral Canal Pathway',
    defaultState: 'visible',
    colorHex: '#637ea3',
    baseAlpha: 0.64,
    emissionStrength: 0.14,
    centroidRAS: [8.68, 0.45, 0.82],
    explodeOffsetRAS: [7.5, 0.5, 0.8],
    cameraViewOffsetRAS: [18.5, 4.5, 9.5],
    fluidCompartment: 'Endolymph (High K+, +80 mV)',
    innervation: 'Lateral Ampullary Nerve (Superior Vestibular Division of CN VIII)',
    verticesCount: 3638,
    facesCount: 7272,
    morphometry: 'Projects laterally to X = +10.71 mm; tilted ~30° upward anteriorly relative to the Frankfort horizontal plane.',
    physiologicalFunction:
      'Primary sensor for horizontal head yaw rotation. Follows Ewald’s 2nd Law: ampullopetal flow (toward the utricle/ampulla) depolarizes hair cells because kinocilia face the utricular side.',
    clinicalPearl:
      'Involved in ~10% of BPPV (geotropic or apogeotropic horizontal nystagmus on Supine Roll Test, treated with the BBQ / Lempert 360° roll or Gufoni maneuver) and caloric testing (requiring 60° supine head elevation to make this canal vertical).',
    patientSummary:
      'The side-to-side balance loop that senses when you turn your head left or right (such as rolling over in bed). It is the second most common loop affected by loose ear crystals.',
  },
  {
    meshName: 'ls_Hsapiens_CCp',
    structureId: 'right.common_crus_posterior',
    displayName: 'Common Crus — Posterior Limb',
    shortLabel: 'Common Crus (Posterior)',
    latinName: 'Crus osseum commune (pars posterior)',
    etymology: 'Latin: crus (leg / limb) + commune (shared)',
    systemGroup: 'semicircular_ducts',
    subGroup: 'Common Crus Confluence',
    defaultState: 'visible',
    colorHex: '#9eaded',
    baseAlpha: 0.48,
    emissionStrength: 0.25,
    centroidRAS: [3.96, -0.75, 1.08],
    explodeOffsetRAS: [-1.8, -2.5, 2.2],
    cameraViewOffsetRAS: [13.5, -8.5, 5.5],
    fluidCompartment: 'Endolymph (High K+, +80 mV)',
    innervation: 'Non-sensory endolymphatic return conduit',
    verticesCount: 2320,
    facesCount: 4624,
    morphometry: 'Courses anteromedially and inferiorly from the superior posterior arch (phi = 112°) to the utricular orifice (phi = 172°).',
    physiologicalFunction:
      'Forms the posterior half of the shared non-ampullated return trunk uniting the posterior and anterior semicircular ducts before entering the superior utricle.',
    clinicalPearl:
      'Critical escape chute during Steps 3 and 4 of the Epley maneuver: contralateral 45° left head turn and shoulder roll orient CCp downward so canaliths drain cleanly into the utricle.',
    patientSummary:
      'The shared exit tube that connects the back balance loop to the main resting sac (utricle). During the Epley head-turning maneuver, loose crystals slide down through this chute to exit the balance loop.',
  },
  {
    meshName: 'ls_Hsapiens_CCa',
    structureId: 'right.common_crus_anterior',
    displayName: 'Common Crus — Anterior Limb',
    shortLabel: 'Common Crus (Anterior)',
    latinName: 'Crus membranaceum commune (pars anterior)',
    etymology: 'Latin: crus commune (shared limb, anterior duct tributary)',
    systemGroup: 'semicircular_ducts',
    subGroup: 'Common Crus Confluence',
    defaultState: 'visible',
    colorHex: '#8d9de0',
    baseAlpha: 0.44,
    emissionStrength: 0.18,
    centroidRAS: [3.97, -0.77, 1.12],
    explodeOffsetRAS: [-2.2, 0.8, 3.4],
    cameraViewOffsetRAS: [13.5, -6.5, 6.0],
    fluidCompartment: 'Endolymph (High K+, +80 mV)',
    innervation: 'Non-sensory endolymphatic return conduit',
    verticesCount: 3302,
    facesCount: 6576,
    morphometry: 'Descends from the posteromedial arch of the anterior semicircular duct to merge seamlessly with CCp.',
    physiologicalFunction:
      'Provides low-resistance endolymphatic continuity between the non-ampullated limb of the anterior duct and the utricular vestibule.',
    clinicalPearl:
      'During an improperly angled Epley maneuver (excessive neck flexion in Step 3/4), otoconia inside the Common Crus can reflux retrograde into the anterior canal ("canal switch" BPPV).',
    patientSummary:
      'The upper half of the shared return tube where the top and back balance loops meet before emptying into the main balance sac. Keeping the chin slightly tucked during head turns helps loose crystals slide straight down into the resting sac rather than drifting into the upper loop.',
  },
  {
    meshName: 'ls_Hsapiens_SC',
    structureId: 'right.simple_crus_limb',
    displayName: 'Simple Crus of Lateral Duct',
    shortLabel: 'Simple Crus (Lateral)',
    latinName: 'Crus membranaceum simplex',
    etymology: 'Latin: crus simplex (single/unshared limb)',
    systemGroup: 'semicircular_ducts',
    subGroup: 'Lateral Canal Pathway',
    defaultState: 'visible',
    colorHex: '#667d9e',
    baseAlpha: 0.56,
    emissionStrength: 0.14,
    centroidRAS: [4.89, -0.25, -0.53],
    explodeOffsetRAS: [2.8, -1.6, -1.5],
    cameraViewOffsetRAS: [14.5, -5.5, 3.0],
    fluidCompartment: 'Endolymph (High K+, +80 mV)',
    innervation: 'Non-sensory posterior utricular entry of lateral duct',
    verticesCount: 2084,
    facesCount: 4136,
    morphometry: 'Medial non-ampullated limb of the lateral semicircular duct entering the posterolateral utricular sinus.',
    physiologicalFunction:
      'Completes the closed fluid torus of the horizontal semicircular duct by returning endolymph directly into the utricular cistern.',
    clinicalPearl:
      'Exit pathway for geotropic horizontal canalithiasis during the Lempert (BBQ) 360° roll maneuver.',
    patientSummary:
      'The back return end of the horizontal balance loop where fluid flows back into the main resting sac.',
  },

  // ============================================================================
  // 2. AMPULLAE & 3-PART CUPULAE (12 Meshes)
  // ============================================================================
  {
    meshName: 'ls_Hsapiens_Ap',
    structureId: 'right.posterior_ampulla',
    displayName: 'Posterior Membranous Ampulla',
    shortLabel: 'Posterior Ampulla',
    latinName: 'Ampulla membranacea posterior',
    etymology: 'Latin: ampulla (two-handled globular Roman flask)',
    systemGroup: 'ampullae_cupulae',
    subGroup: 'Posterior Ampullary Apparatus',
    defaultState: 'visible',
    colorHex: '#f0aa62',
    baseAlpha: 0.78,
    emissionStrength: 0.28,
    centroidRAS: [4.07, -1.10, -2.29],
    explodeOffsetRAS: [2.2, -3.8, -4.2],
    cameraViewOffsetRAS: [11.5, -7.5, -1.5],
    fluidCompartment: 'Endolymph (High K+, +80 mV)',
    innervation: 'Posterior Ampullary Nerve (Singular Nerve of Morgagni, CN VIII Inf.)',
    verticesCount: 1496,
    facesCount: 2988,
    morphometry: 'Bulbous dilation (~1.1 mm diameter) at the inferior-anterior origin of the posterior semicircular duct.',
    physiologicalFunction:
      'Houses the posterior crista ampullaris and cupula. Acts as a hydraulic pressure-amplifying chamber at the base of the posterior canal.',
    clinicalPearl:
      'In Posterior-Canal BPPV, otoconia settle just distal to this ampulla (at phi = -84°). Use the "Ampulla Micro-Cutaway" slider to ghost this outer wall and inspect the 3-part cupula inside!',
    patientSummary:
      'A small sensor chamber at the bottom of the back balance loop. It contains the motion sensor (cupula) that tells your brain whether your head is tilting.',
  },
  {
    meshName: 'ls_Hsapiens_Post_Cup_Duct',
    structureId: 'right.posterior_cupula_duct',
    displayName: 'Posterior Cupula — Ductal Surface',
    shortLabel: 'Post. Cupula (Duct Face)',
    latinName: 'Cupula cristae ampullaris posterioris (facies ductalis)',
    etymology: 'Latin: cupula (little dome / inverted cask)',
    systemGroup: 'ampullae_cupulae',
    subGroup: 'Posterior Ampullary Apparatus',
    defaultState: 'visible',
    colorHex: '#ffbe6b',
    baseAlpha: 0.94,
    emissionStrength: 0.42,
    centroidRAS: [4.32, -1.32, -2.34],
    explodeOffsetRAS: [3.8, -5.2, -5.2],
    cameraViewOffsetRAS: [9.5, -5.5, -1.8],
    fluidCompartment: 'Gelatinous Cupula Diaphragm',
    innervation: 'Type I & II Vestibular Hair Cells (Kinocilia on Canal/Ductal Side)',
    verticesCount: 290,
    facesCount: 520,
    morphometry: 'Distal face of the posterior cupula facing the long arm of the posterior semicircular duct.',
    physiologicalFunction:
      'Receives direct hydrodynamic piston drag when otoconia sediment away from (`ampullofugal`) or toward (`ampullopetal`) the posterior ampulla.',
    clinicalPearl:
      'During the Dix-Hallpike test, otoconia falling away from this surface pull endolymph like a plunger, deflecting the cupula toward the duct and triggering upbeat-torsional nystagmus.',
    patientSummary:
      'The canal-facing side of the soft gel flap (cupula) inside the back balance sensor. When loose crystals slide through the canal, they pull fluid away from this flap, bending it and causing a brief spinning sensation.',
  },
  {
    meshName: 'ls_Hsapiens_Post_Cup_Ut',
    structureId: 'right.posterior_cupula_utricle',
    displayName: 'Posterior Cupula — Utricular Surface',
    shortLabel: 'Post. Cupula (Utricular Face)',
    latinName: 'Cupula cristae ampullaris posterioris (facies utricularis)',
    etymology: 'Latin: cupula (dome) + utriculus (little leather bag)',
    systemGroup: 'ampullae_cupulae',
    subGroup: 'Posterior Ampullary Apparatus',
    defaultState: 'visible',
    colorHex: '#ffd28a',
    baseAlpha: 0.92,
    emissionStrength: 0.36,
    centroidRAS: [3.84, -0.99, -2.24],
    explodeOffsetRAS: [1.0, -3.0, -5.2],
    cameraViewOffsetRAS: [9.5, -5.5, -1.8],
    fluidCompartment: 'Gelatinous Cupula Diaphragm',
    innervation: 'Posterior Ampullary Nerve (CN VIII Inferior Division)',
    verticesCount: 154,
    facesCount: 244,
    morphometry: 'Proximal face of the posterior cupula bordering the inferior utricular cistern.',
    physiologicalFunction:
      'Forms an impermeable fluid seal across the ampulla while deflecting elastically with a Steinhausen return time constant of ~7–12 seconds.',
    clinicalPearl:
      'Forms a physical barrier (`phi = -112°`) preventing long-arm posterior canaliths from taking a shortcut directly through the ampulla into the utricle.',
    patientSummary:
      'The inner side of the gel sensor flap that blocks crystals from taking a shortcut straight into the resting sac—which is why the Epley maneuver guides crystals the long way around the loop.',
  },
  {
    meshName: 'ls_Hsapiens_Post_Cup_Wall',
    structureId: 'right.posterior_cupula_wall',
    displayName: 'Posterior Cupula — Crista & Perimeter Wall',
    shortLabel: 'Post. Cupula (Crista Wall)',
    latinName: 'Crista ampullaris posterior & septum cruciatum',
    etymology: 'Latin: crista (crest / ridge) + paries (wall)',
    systemGroup: 'ampullae_cupulae',
    subGroup: 'Posterior Ampullary Apparatus',
    defaultState: 'visible',
    colorHex: '#f59342',
    baseAlpha: 0.90,
    emissionStrength: 0.38,
    centroidRAS: [4.09, -1.20, -2.29],
    explodeOffsetRAS: [2.4, -4.1, -5.8],
    cameraViewOffsetRAS: [9.5, -5.5, -1.8],
    fluidCompartment: 'Gelatinous Cupula Diaphragm',
    innervation: 'Calyx & Bouton Afferents of Scarpa’s Ganglion (Inferior Branch)',
    verticesCount: 824,
    facesCount: 1640,
    morphometry: 'Circumferential attachment ring anchoring the cupula to the saddle-shaped crista ampullaris and ampullary roof.',
    physiologicalFunction:
      'Embeds the stereocilia and kinocilia bundles of ~7,000 vestibular hair cells; shear displacement gates mechanosensitive TMC1/TMC2 K+ channels.',
    clinicalPearl:
      'In Cupulolithiasis (heavy cupula), otoconia adhere directly to this cupular structure, producing persistent positional nystagmus without latency or rapid fatigue.',
    patientSummary:
      'The base of the gel sensor where tiny sensory hairs detect bending and send balance signals to the brain.',
  },
  {
    meshName: 'ls_Hsapiens_Aa',
    structureId: 'right.anterior_ampulla',
    displayName: 'Anterior Membranous Ampulla',
    shortLabel: 'Anterior Ampulla',
    latinName: 'Ampulla membranacea anterior',
    etymology: 'Latin: ampulla (flask) + anterior (front/superior)',
    systemGroup: 'ampullae_cupulae',
    subGroup: 'Anterior Ampullary Apparatus',
    defaultState: 'visible',
    colorHex: '#d4956a',
    baseAlpha: 0.72,
    emissionStrength: 0.18,
    centroidRAS: [6.21, 3.30, 2.32],
    explodeOffsetRAS: [3.2, 4.5, 3.5],
    cameraViewOffsetRAS: [13.5, 9.5, 5.5],
    fluidCompartment: 'Endolymph (High K+, +80 mV)',
    innervation: 'Anterior Ampullary Nerve (Superior Vestibular Division of CN VIII)',
    verticesCount: 2080,
    facesCount: 4156,
    morphometry: 'Located anterolaterally at the superior-anterior pole of the utricle (RAS center +6.21, +3.30, +2.32 mm), immediately adjacent to the lateral ampulla.',
    physiologicalFunction:
      'Contains the anterior crista ampullaris and cupula; transduces diagonal pitch-roll rotations in the RALP plane.',
    clinicalPearl:
      'Anterior canal BPPV is rare (<2% of cases) because this ampulla sits high and anterior, allowing self-clearance of debris during normal upright head posture.',
    patientSummary:
      'The small sensor chamber at the front end of the top balance loop that detects forward head nodding.',
  },
  {
    meshName: 'ls_Hsapiens_Ant_Cup_Duct',
    structureId: 'atlas.ls_Hsapiens_Ant_Cup_Duct',
    displayName: 'Anterior Cupula — Ductal Surface',
    shortLabel: 'Ant. Cupula (Duct Face)',
    latinName: 'Cupula cristae ampullaris anterioris (facies ductalis)',
    etymology: 'Latin: cupula (little dome, ductal aspect)',
    systemGroup: 'ampullae_cupulae',
    subGroup: 'Anterior Ampullary Apparatus',
    defaultState: 'visible',
    colorHex: '#f2b880',
    baseAlpha: 0.90,
    emissionStrength: 0.30,
    centroidRAS: [6.29, 3.38, 2.50],
    explodeOffsetRAS: [4.4, 5.8, 4.8],
    cameraViewOffsetRAS: [12.0, 8.5, 5.0],
    fluidCompartment: 'Gelatinous Cupula Diaphragm',
    innervation: 'Anterior Ampullary Nerve (Kinocilia polarized toward canal side)',
    verticesCount: 450,
    facesCount: 852,
    morphometry: 'Superior-ductal surface of the anterior cupula facing the ascending anterior semicircular duct.',
    physiologicalFunction:
      'Deflects during ampullofugal flow (excitation) when the head pitches forward and to the right.',
    clinicalPearl:
      'Excitation of this cupula activates the ipsilateral Superior Rectus and contralateral Inferior Oblique extraocular muscles.',
    patientSummary:
      'The canal-facing side of the soft gel motion sensor inside the top balance loop. It bends when fluid moves during forward or diagonal head nods.',
  },
  {
    meshName: 'ls_Hsapiens_Ant_Cup_Ut',
    structureId: 'atlas.ls_Hsapiens_Ant_Cup_Ut',
    displayName: 'Anterior Cupula — Utricular Surface',
    shortLabel: 'Ant. Cupula (Utricular Face)',
    latinName: 'Cupula cristae ampullaris anterioris (facies utricularis)',
    etymology: 'Latin: cupula (little dome, utricular aspect)',
    systemGroup: 'ampullae_cupulae',
    subGroup: 'Anterior Ampullary Apparatus',
    defaultState: 'visible',
    colorHex: '#ffd1a1',
    baseAlpha: 0.90,
    emissionStrength: 0.28,
    centroidRAS: [6.01, 3.12, 2.06],
    explodeOffsetRAS: [2.6, 4.8, 3.8],
    cameraViewOffsetRAS: [12.0, 8.5, 5.0],
    fluidCompartment: 'Gelatinous Cupula Diaphragm',
    innervation: 'Anterior Ampullary Nerve (CN VIII Superior Division)',
    verticesCount: 410,
    facesCount: 728,
    morphometry: 'Inferomedial surface of the anterior cupula facing the anterior utricular recess.',
    physiologicalFunction:
      'Transmits differential endolymph pressure between the utricular vestibule and the anterior duct.',
    clinicalPearl:
      'Ampullopetal deflection toward this surface hyperpolarizes anterior canal hair cells, reducing baseline firing below ~90 spikes/s.',
    patientSummary:
      'The inner sac-facing side of the soft gel motion sensor inside the top balance loop, separating the loop fluid from the main balance sac.',
  },
  {
    meshName: 'ls_Hsapiens_Ant_Cup_Wall',
    structureId: 'atlas.ls_Hsapiens_Ant_Cup_Wall',
    displayName: 'Anterior Cupula — Crista & Perimeter Wall',
    shortLabel: 'Ant. Cupula (Crista Wall)',
    latinName: 'Crista ampullaris anterior',
    etymology: 'Latin: crista (sensory ridge) + anterior',
    systemGroup: 'ampullae_cupulae',
    subGroup: 'Anterior Ampullary Apparatus',
    defaultState: 'visible',
    colorHex: '#e89e58',
    baseAlpha: 0.88,
    emissionStrength: 0.32,
    centroidRAS: [6.15, 3.24, 2.27],
    explodeOffsetRAS: [3.5, 5.3, 4.3],
    cameraViewOffsetRAS: [12.0, 8.5, 5.0],
    fluidCompartment: 'Gelatinous Cupula Diaphragm',
    innervation: 'Superior Vestibular Nerve (CN VIII)',
    verticesCount: 1112,
    facesCount: 2196,
    morphometry: 'Complete perimeter seal and neuroepithelial crista ridge inside the anterior ampulla.',
    physiologicalFunction:
      'Anchors the gelatinous cupula across the anterior ampullary lumen.',
    clinicalPearl:
      'Assessed clinically via the Video Head Impulse Test (vHIT) in the RALP plane.',
    patientSummary:
      'The sensory base and rim that anchor the gel motion sensor flap inside the top balance loop and send forward-tilt signals to the brain.',
  },
  {
    meshName: 'ls_Hsapiens_Al',
    structureId: 'right.lateral_ampulla',
    displayName: 'Lateral Membranous Ampulla',
    shortLabel: 'Lateral Ampulla',
    latinName: 'Ampulla membranacea lateralis',
    etymology: 'Latin: ampulla (flask) + lateralis (lateral/horizontal)',
    systemGroup: 'ampullae_cupulae',
    subGroup: 'Lateral Ampullary Apparatus',
    defaultState: 'visible',
    colorHex: '#c98b5f',
    baseAlpha: 0.72,
    emissionStrength: 0.18,
    centroidRAS: [7.35, 2.90, 1.00],
    explodeOffsetRAS: [5.2, 3.6, 1.0],
    cameraViewOffsetRAS: [15.0, 8.5, 4.0],
    fluidCompartment: 'Endolymph (High K+, +80 mV)',
    innervation: 'Lateral Ampullary Nerve (Superior Vestibular Division of CN VIII)',
    verticesCount: 2002,
    facesCount: 4000,
    morphometry: 'Situated at the anterior-lateral end of the horizontal duct (RAS +7.35, +2.90, +1.00 mm), just inferior and lateral to the anterior ampulla.',
    physiologicalFunction:
      'Contains the horizontal crista ampullaris and cupula for yaw angular velocity transduction.',
    clinicalPearl:
      'Because it lies closest to the medial wall of the middle ear (tympanic cavity / epitympanic recess), it is the primary structure stimulated during bithermal caloric irrigation.',
    patientSummary:
      'The sensor chamber at the front of the horizontal balance loop that detects left-and-right head turns.',
  },
  {
    meshName: 'ls_Hsapiens_Lat_Cup_Duct',
    structureId: 'atlas.ls_Hsapiens_Lat_Cup_Duct',
    displayName: 'Lateral Cupula — Ductal Surface',
    shortLabel: 'Lat. Cupula (Duct Face)',
    latinName: 'Cupula cristae ampullaris lateralis (facies ductalis)',
    etymology: 'Latin: cupula lateralis (ductal aspect)',
    systemGroup: 'ampullae_cupulae',
    subGroup: 'Lateral Ampullary Apparatus',
    defaultState: 'visible',
    colorHex: '#f2b880',
    baseAlpha: 0.92,
    emissionStrength: 0.30,
    centroidRAS: [7.66, 2.88, 1.03],
    explodeOffsetRAS: [6.8, 4.4, 1.2],
    cameraViewOffsetRAS: [13.5, 7.5, 3.2],
    fluidCompartment: 'Gelatinous Cupula Diaphragm',
    innervation: 'Lateral Ampullary Nerve (Kinocilia on Utricular Side — Ewald’s 2nd Law)',
    verticesCount: 94,
    facesCount: 152,
    morphometry: 'Lateral face of the horizontal cupula facing the arch of the lateral semicircular duct.',
    physiologicalFunction:
      'Receives endolymph pressure during yaw head rotations; ampullopetal push from this side toward the utricle excites the nerve.',
    clinicalPearl:
      'Rightward head yaw causes leftward inertial endolymph lag (ampullopetal flow), deflecting this surface toward the utricle and driving compensatory leftward slow-phase VOR eye movement.',
    patientSummary:
      'The canal-facing side of the soft gel motion sensor inside the horizontal balance loop. It bends when fluid shifts during left-to-right head turns.',
  },
  {
    meshName: 'ls_Hsapiens_Lat_Cup_Ut',
    structureId: 'atlas.ls_Hsapiens_Lat_Cup_Ut',
    displayName: 'Lateral Cupula — Utricular Surface',
    shortLabel: 'Lat. Cupula (Utricular Face)',
    latinName: 'Cupula cristae ampullaris lateralis (facies utricularis)',
    etymology: 'Latin: cupula lateralis (utricular aspect)',
    systemGroup: 'ampullae_cupulae',
    subGroup: 'Lateral Ampullary Apparatus',
    defaultState: 'visible',
    colorHex: '#ffd1a1',
    baseAlpha: 0.92,
    emissionStrength: 0.28,
    centroidRAS: [7.15, 2.84, 0.97],
    explodeOffsetRAS: [5.4, 4.4, 0.8],
    cameraViewOffsetRAS: [13.5, 7.5, 3.2],
    fluidCompartment: 'Gelatinous Cupula Diaphragm',
    innervation: 'Superior Vestibular Nerve (CN VIII)',
    verticesCount: 64,
    facesCount: 96,
    morphometry: 'Medial-anterior surface of the horizontal cupula facing the utricular recess.',
    physiologicalFunction:
      'Faces the kinociliary pole of the horizontal crista hair cells.',
    clinicalPearl:
      'In apogeotropic horizontal BPPV (cupulolithiasis or anterior-arm canalithiasis), otoconia weigh down the lateral cupula, causing persistent direction-changing nystagmus.',
    patientSummary:
      'The inner sac-facing side of the soft gel motion sensor inside the horizontal balance loop, facing the main balance sac.',
  },
  {
    meshName: 'ls_Hsapiens_Lat_Cup_Wall',
    structureId: 'atlas.ls_Hsapiens_Lat_Cup_Wall',
    displayName: 'Lateral Cupula — Crista & Perimeter Wall',
    shortLabel: 'Lat. Cupula (Crista Wall)',
    latinName: 'Crista ampullaris lateralis',
    etymology: 'Latin: crista lateralis (horizontal sensory ridge)',
    systemGroup: 'ampullae_cupulae',
    subGroup: 'Lateral Ampullary Apparatus',
    defaultState: 'visible',
    colorHex: '#e89e58',
    baseAlpha: 0.88,
    emissionStrength: 0.32,
    centroidRAS: [7.37, 2.86, 0.99],
    explodeOffsetRAS: [6.1, 4.4, 1.0],
    cameraViewOffsetRAS: [13.5, 7.5, 3.2],
    fluidCompartment: 'Gelatinous Cupula Diaphragm',
    innervation: 'Superior Vestibular Nerve (CN VIII)',
    verticesCount: 1034,
    facesCount: 2068,
    morphometry: 'Annular seal and crista neuroepithelium of the lateral ampulla.',
    physiologicalFunction:
      'Drives the horizontal vestibulo-ocular reflex (Mist/Medial Rectus & Lateral Rectus coupling via CN III and CN VI).',
    clinicalPearl:
      'Often affected in vestibular neuritis (which preferentially involves the Superior Vestibular Nerve supplying the lateral and anterior ampullae plus the utricle).',
    patientSummary:
      'The sensory base and rim that anchor the gel motion sensor flap inside the horizontal balance loop and send side-to-side turn signals to the brain.',
  },

  // ============================================================================
  // 3. OTOLITH VESTIBULE: UTRICLE & SACCULE (3 Meshes)
  // ============================================================================
  {
    meshName: 'ls_Hsapiens_utricle',
    structureId: 'right.utricle',
    displayName: 'Utricle (Otolith Organ)',
    shortLabel: 'Utricle',
    latinName: 'Utriculus',
    etymology: 'Latin: utriculus (diminutive of uter — small leather wine-bag)',
    systemGroup: 'otolith_vestibule',
    subGroup: 'Utricular Vestibule',
    defaultState: 'visible',
    colorHex: '#75c79e',
    baseAlpha: 0.52,
    emissionStrength: 0.22,
    centroidRAS: [4.58, 1.87, 0.35],
    explodeOffsetRAS: [0.0, 0.0, 0.0],
    cameraViewOffsetRAS: [14.0, 4.5, 4.5],
    fluidCompartment: 'Endolymph (High K+, +80 mV)',
    innervation: 'Utricular Nerve (Superior Vestibular Division of CN VIII)',
    verticesCount: 4418,
    facesCount: 8832,
    morphometry: 'Central oblong sac in the posterosuperior vestibule; all 3 semicircular ducts open into the utricle via 5 orifices.',
    physiologicalFunction:
      'Contains the horizontally oriented Macula Utriculi (weighted by CaCO3 otoconia with hair cells polarized toward the curved central striola) to sense horizontal linear acceleration and static head tilt.',
    clinicalPearl:
      'Both the SOURCE and the DESTINATION of BPPV: otoconia detach from the utricular macula to cause BPPV, and the Epley maneuver returns them via the Common Crus back into the utricle where dark cells reabsorb them.',
    patientSummary:
      'The main balance sac where tiny calcium crystals (otoconia) normally live and help you sense gravity. BPPV happens when crystals slip out of this sac into a balance loop, and the Epley maneuver guides them safely back home here.',
  },
  {
    meshName: 'ls_Hsapiens_UCp',
    structureId: 'right.posterior_utricular_limb',
    displayName: 'Posterior Utricular Cistern (Sinus Posterior)',
    shortLabel: 'Utricular Cistern',
    latinName: 'Sinus posterior utriculi',
    etymology: 'Latin: sinus (bay / recess) + posterior utriculi',
    systemGroup: 'otolith_vestibule',
    subGroup: 'Utricular Vestibule',
    defaultState: 'visible',
    colorHex: '#62b38b',
    baseAlpha: 0.44,
    emissionStrength: 0.16,
    centroidRAS: [4.05, 0.29, -0.76],
    explodeOffsetRAS: [-1.4, -1.2, -1.6],
    cameraViewOffsetRAS: [13.5, -2.5, 2.0],
    fluidCompartment: 'Endolymph (High K+, +80 mV)',
    innervation: 'Vestibular Dark Cell Epithelium (K+ Homeostasis & Ca2+ Reabsorption)',
    verticesCount: 4036,
    facesCount: 8044,
    morphometry: 'Inferoposterior extension of the utricle linking the utricular body to the posterior ampulla (Ap).',
    physiologicalFunction:
      'Funnels endolymph between the main utricular vestibule and the posterior ampullary opening.',
    clinicalPearl:
      'When sleep or head trauma dislodges otoconia from the utricular macula, gravity funnels them through this posterior sinus into the adjacent posterior canal.',
    patientSummary:
      'The lower back pocket of the main balance sac (utricle) leading toward the back balance loop.',
  },
  {
    meshName: 'mesh_david_sacculus',
    structureId: 'right.saccule',
    displayName: 'Saccule (Vertical Otolith Organ)',
    shortLabel: 'Saccule',
    latinName: 'Sacculus',
    etymology: 'Latin: sacculus (little sack / pouch)',
    systemGroup: 'otolith_vestibule',
    subGroup: 'Saccular Recess',
    defaultState: 'visible',
    colorHex: '#5ca39e',
    baseAlpha: 0.62,
    emissionStrength: 0.18,
    centroidRAS: [3.57, 3.03, -0.87],
    explodeOffsetRAS: [-3.2, 2.2, -2.6],
    cameraViewOffsetRAS: [12.5, 6.5, 1.5],
    fluidCompartment: 'Endolymph (High K+, +80 mV)',
    innervation: 'Saccular Nerve (Inferior Vestibular Division of CN VIII)',
    verticesCount: 1770,
    facesCount: 3536,
    morphometry: 'Spherical endolymphatic sac in the anteroinferior vestibule (spherical recess), connected to the cochlea via the ductus reuniens.',
    physiologicalFunction:
      'Houses the parasagittally (vertically) oriented Macula Sacculi (hair cells polarized away from the striola) to detect vertical linear acceleration (elevator motion) and gravity.',
    clinicalPearl:
      'Directly tested by Cervical Vestibular Evoked Myogenic Potentials (cVEMP), which measure sternocleidomastoid relaxation in response to loud clicks/tone bursts stimulating the saccule and Inferior Vestibular Nerve.',
    patientSummary:
      'The second crystal-weighted balance sac that senses up-and-down movement, like riding in an elevator.',
  },

  // ============================================================================
  // 4. SEGMENTED COCHLEA & SCALAE (4 Meshes)
  // ============================================================================
  {
    meshName: 'mesh_david_cochlea',
    structureId: 'right.cochlea',
    displayName: 'Membranous Cochlear Spiral (David Atlas)',
    shortLabel: 'Cochlea (Envelope)',
    latinName: 'Labyrinthus cochlearis / Ductus cochlearis',
    etymology: 'Greek: kochlias (snail shell with spiral turns)',
    systemGroup: 'cochlear_system',
    subGroup: 'Cochlear Spiral',
    defaultState: 'visible',
    colorHex: '#6b82a6',
    baseAlpha: 0.68,
    emissionStrength: 0.14,
    centroidRAS: [1.77, 6.38, -2.96],
    explodeOffsetRAS: [-4.5, 5.5, -3.5],
    cameraViewOffsetRAS: [11.5, 13.5, 1.5],
    fluidCompartment: 'Endolymph (High K+, +80 mV)',
    innervation: 'Cochlear Nerve / Spiral Ganglion (CN VIII Auditory Division)',
    verticesCount: 7812,
    facesCount: 15620,
    morphometry: 'Coils ~2.6 turns (~35 mm basilar membrane length) anteriorly, inferiorly, and medially from the vestibule.',
    physiologicalFunction:
      'Performs real-time mechanical Fourier frequency analysis via the Greenwood tonotopic map: high frequencies (20 kHz) resonate at the stiff base, low frequencies (20 Hz) at the compliant apex.',
    clinicalPearl:
      'Peel or ghost this envelope using the "Ampulla & Cochlea Micro-Cutaway" slider to reveal the internal Scala Vestibuli, Scala Tympani, and Helicotrema Cupula!',
    patientSummary:
      'The snail-shaped hearing organ of the inner ear. While it shares fluid pathways with the balance system next door, its job is turning sound vibrations into hearing signals.',
  },
  {
    meshName: 'seg_coch_inner_scala_vestibuli',
    structureId: 'atlas.seg_coch_inner_scala_vestibuli',
    displayName: 'Scala Vestibuli (Ascending Perilymph Chamber)',
    shortLabel: 'Scala Vestibuli',
    latinName: 'Scala vestibuli',
    etymology: 'Latin: scala (staircase / ladder) + vestibuli (of the entrance hall)',
    systemGroup: 'cochlear_system',
    subGroup: 'Cochlear Chambers (Scalae)',
    defaultState: 'visible',
    colorHex: '#63b0f2',
    baseAlpha: 0.82,
    emissionStrength: 0.22,
    centroidRAS: [1.33, 6.19, -3.01],
    explodeOffsetRAS: [-6.5, 7.8, -1.2],
    cameraViewOffsetRAS: [10.5, 13.5, 1.0],
    fluidCompartment: 'Perilymph (High Na+, 0 mV)',
    innervation: 'Borders Reissner’s Membrane & Cochlear Duct (CN VIII)',
    verticesCount: 10818,
    facesCount: 21632,
    morphometry: 'Superior/anterior spiral perilymphatic duct commencing at the Oval Window (stapes footplate) and ascending to the helicotrema.',
    physiologicalFunction:
      'Transmits acoustic hydraulic pressure waves generated by the stapes footplate up the cochlear spiral, deflecting Reissner’s membrane and the basilar membrane.',
    clinicalPearl:
      'Continuous with the perilymph of the vestibule; in otosclerosis, stapes fixation at the oval window blocks acoustic energy entry into the Scala Vestibuli.',
    patientSummary:
      'The upper fluid tunnel inside the snail-shaped hearing organ that carries incoming sound waves upward toward its tip.',
  },
  {
    meshName: 'seg_coch_inner_scala_tympani',
    structureId: 'atlas.seg_coch_inner_scala_tympani',
    displayName: 'Scala Tympani (Descending Perilymph Chamber)',
    shortLabel: 'Scala Tympani',
    latinName: 'Scala tympani',
    etymology: 'Latin: scala (staircase) + tympani (of the drum / round window)',
    systemGroup: 'cochlear_system',
    subGroup: 'Cochlear Chambers (Scalae)',
    defaultState: 'visible',
    colorHex: '#9d7cf2',
    baseAlpha: 0.82,
    emissionStrength: 0.22,
    centroidRAS: [0.63, 5.38, -2.91],
    explodeOffsetRAS: [-8.2, 5.2, -5.8],
    cameraViewOffsetRAS: [10.5, 13.5, -1.5],
    fluidCompartment: 'Perilymph (High Na+, 0 mV)',
    innervation: 'Immediately underlies the Basilar Membrane & Spiral Ganglion',
    verticesCount: 11954,
    facesCount: 23904,
    morphometry: 'Inferior/posterior spiral perilymphatic chamber descending from the helicotrema to terminate at the Secondary Tympanic Membrane (Round Window).',
    physiologicalFunction:
      'Provides incompressible fluid pressure relief at the Round Window and communicates with subarachnoid CSF via the Cochlear Aqueduct.',
    clinicalPearl:
      'Surgical target for Cochlear Implantation: electrode arrays are inserted via the Round Window niche directly into the Scala Tympani to stimulate spiral ganglion neurons tonotopically.',
    patientSummary:
      'The lower fluid tunnel inside the snail-shaped hearing organ; this is also the pathway where cochlear implant electrodes are gently placed to restore hearing.',
  },
  {
    meshName: 'seg_coch_inner_cupula',
    structureId: 'atlas.seg_coch_inner_cupula',
    displayName: 'Cochlear Cupula & Helicotrema Apex',
    shortLabel: 'Cochlear Apex (Helicotrema)',
    latinName: 'Cupula cochleae / Helicotrema',
    etymology: 'Greek: helix (coil) + trema (hole / communication at apex)',
    systemGroup: 'cochlear_system',
    subGroup: 'Cochlear Chambers (Scalae)',
    defaultState: 'visible',
    colorHex: '#4fe3d2',
    baseAlpha: 0.90,
    emissionStrength: 0.34,
    centroidRAS: [1.65, 7.58, -2.30],
    explodeOffsetRAS: [-6.8, 10.2, -2.8],
    cameraViewOffsetRAS: [9.5, 14.5, 0.5],
    fluidCompartment: 'Perilymph (High Na+, 0 mV)',
    innervation: 'Apical Spiral Ganglion Fibers (Low-Frequency 20–200 Hz Coding)',
    verticesCount: 2528,
    facesCount: 5052,
    morphometry: 'Apical cap of the cochlear spiral (RAS +1.65, +7.58, -2.30 mm) where the cochlear modiolus terminates.',
    physiologicalFunction:
      'Contains the Helicotrema—the apical orifice where perilymph of the ascending Scala Vestibuli meets the descending Scala Tympani, and where low-frequency bass tones (20–100 Hz) peak.',
    clinicalPearl:
      'Acts as a hydraulic high-pass filter protecting the Organ of Corti from static barometric pressure shifts.',
    patientSummary:
      'The very tip of the snail-shaped hearing spiral where the upper and lower fluid tunnels meet and deep bass sounds are detected.',
  },

  // ============================================================================
  // 5. BONY LABYRINTH / OTIC CAPSULE (2 Meshes)
  // ============================================================================
  {
    meshName: 'segT2_th1.07_Otsu',
    structureId: 'atlas.segT2_th1.07_Otsu',
    displayName: 'Bony Labyrinth Otic Capsule (Full Perilymph Shell)',
    shortLabel: 'Bony Labyrinth Shell',
    latinName: 'Labyrinthus osseus (capsula otica)',
    etymology: 'Greek: labyrinthos (maze) + Latin: osseus (of bone)',
    systemGroup: 'bony_capsule',
    subGroup: 'Otic Capsule Boundary',
    defaultState: 'ghost',
    colorHex: '#7da1c4',
    baseAlpha: 0.22,
    emissionStrength: 0.10,
    centroidRAS: [4.40, 2.01, -0.31],
    explodeOffsetRAS: [0.0, 0.0, 8.5],
    cameraViewOffsetRAS: [19.5, 8.5, 8.0],
    fluidCompartment: 'Otic Capsule / Perilymph Shell',
    innervation: 'Periosteal lining innervated by tympanic plexus & meningeal branches',
    verticesCount: 16996,
    facesCount: 33992,
    morphometry: 'Complete 3D outer perilymphatic boundary extracted from high-field T2 MRI (Otsu threshold 1.07), spanning 13.8 mm (X) x 14.9 mm (Y) x 14.4 mm (Z).',
    physiologicalFunction:
      'Hardest bone in the human body; shields the suspended membranous labyrinth and maintains the perilymphatic fluid cushion.',
    clinicalPearl:
      'Adjust the "Bony Capsule Peel" slider to transition this shell between solid bone, Fresnel X-Ray glass, and fully peeled dissection!',
    patientSummary:
      'The protective shell of hard skull bone that surrounds and cushions the delicate inner ear tubes.',
  },
  {
    meshName: 'seg_coch_outer_T2',
    structureId: 'atlas.seg_coch_outer_T2',
    displayName: 'Outer Bony Cochlear Capsule (T2 Segmentation)',
    shortLabel: 'Outer Cochlear Capsule',
    latinName: 'Capsula ossea cochleae',
    etymology: 'Latin: capsula (small box) + cochlea (snail shell)',
    systemGroup: 'bony_capsule',
    subGroup: 'Otic Capsule Boundary',
    defaultState: 'hidden',
    colorHex: '#6c8cab',
    baseAlpha: 0.26,
    emissionStrength: 0.10,
    centroidRAS: [1.53, 5.51, -3.03],
    explodeOffsetRAS: [-9.5, 8.5, -4.5],
    cameraViewOffsetRAS: [13.5, 13.5, 1.5],
    fluidCompartment: 'Otic Capsule / Perilymph Shell',
    innervation: 'Cochlear Otic Capsule',
    verticesCount: 25144,
    facesCount: 50284,
    morphometry: 'High-resolution 50,284-triangle outer cochlear envelope enclosing the Scala Vestibuli, Scala Tympani, and Cochlear Duct.',
    physiologicalFunction:
      'Forms the rigid acoustic boundary around the cochlear spiral.',
    clinicalPearl:
      'In cochlear otosclerosis (otospongiosis), demineralization of this capsule causes mixed conductive and sensorineural hearing loss ("halo sign" on temporal bone CT).',
    patientSummary:
      'The outer protective bone shell surrounding the snail-shaped hearing organ.',
  },
];

export const VERIFIED_ATLAS_CITATIONS = {
  iemap2021:
    'Ahmadi et al., Sci Rep 11, 3293 (2021). doi:10.1038/s41598-021-82716-0 — IE-Map Inner Ear Template & Labyrinth Atlas (Zenodo 10625570)',
  david2016:
    'David et al., Sci Rep 6, 32772 (2016). doi:10.1038/srep32772 — Human Membranous Labyrinth Micro-CT Reconstruction',
  bppvGuideline2017:
    'Bhattacharyya et al., Otolaryngol Head Neck Surg 156(3_suppl), S1–S47 (2017) — Clinical Practice Guideline: Benign Paroxysmal Positional Vertigo (Update)',
};

for (const item of IEMAP_STRUCTURES) {
  if (!item.sources || item.sources.length === 0) {
    const refs: string[] = [VERIFIED_ATLAS_CITATIONS.iemap2021];
    if (item.systemGroup !== 'bony_capsule') {
      refs.push(VERIFIED_ATLAS_CITATIONS.david2016);
    }
    refs.push(VERIFIED_ATLAS_CITATIONS.bppvGuideline2017);
    item.sources = refs;
  }
}

export function getPatientSystemSummary(groupId: SystemGroupId): {
  title: string;
  subtitle: string;
  roleNote: string;
} {
  switch (groupId) {
    case 'semicircular_ducts':
      return {
        title: 'Balance Loops (Semicircular Canals)',
        subtitle: 'Three fluid-filled loops that sense head turns and tilts',
        roleNote:
          'When tiny ear crystals slip out of the resting sac into one of these fluid loops (most often the back loop), tilting your head makes the crystals slide and briefly triggers a spinning sensation (vertigo).',
      };
    case 'ampullae_cupulae':
      return {
        title: 'Balance Motion Sensors (Ampullae & Cupulae)',
        subtitle: 'Soft gel sensor flaps at the end of each balance loop',
        roleNote:
          'Each balance loop has a soft gel flap (cupula) that bends when fluid moves. In vertigo (BPPV), sliding crystals pull fluid like a plunger and bend this flap until the crystals settle.',
      };
    case 'otolith_vestibule':
      return {
        title: 'Crystal Resting Sacs (Utricle & Saccule)',
        subtitle: 'Gravity sensors where ear crystals normally belong',
        roleNote:
          'Tiny calcium crystals normally sit inside these sacs to help you feel gravity and straight-line motion. The Epley head-turn treatment guides loose crystals out of the balance loop and back home to the utricle sac.',
      };
    case 'cochlear_system':
      return {
        title: 'Hearing Organ (Cochlear Snail)',
        subtitle: 'Spiral fluid tunnels that turn sound vibrations into hearing',
        roleNote:
          'The snail-shaped cochlea sits right next to the balance organs in the inner ear, but its job is hearing rather than balance. Classic crystal vertigo (BPPV) does not damage your hearing.',
      };
    case 'bony_capsule':
      return {
        title: 'Protective Bone Shell (Bony Labyrinth)',
        subtitle: 'Hard skull bone that surrounds and cushions the inner ear',
        roleNote:
          'This dense bone shell forms a protective hollow casing inside the skull to shield the delicate balance loops and hearing snail.',
      };
  }
}

export const STRUCTURE_BY_MESH: Record<string, StructureOntologyItem> = Object.fromEntries(
  IEMAP_STRUCTURES.map((item) => [item.meshName, item])
);

export const DISSECTION_PRESETS: DissectionPreset[] = [
  {
    id: 'full_atlas_xray',
    title: 'Full Inner Ear Overview (X-Ray Shell)',
    badge: 'OVERVIEW',
    description:
      'All 25 inner ear balance loops, sensors, crystal sacs, and hearing chambers visible inside a see-through bony shell.',
    bonyPeelPercent: 80,
    microCutawayPercent: 35,
    explodePercent: 0,
    defaultSelectedMesh: 'ls_Hsapiens_Sp',
    states: {
      segT2_th1_07_Otsu: 'ghost',
      'segT2_th1.07_Otsu': 'ghost',
      seg_coch_outer_T2: 'hidden',
    },
  },
  {
    id: 'gate3_bppv_pathway',
    title: 'Vertigo (BPPV) Crystal Pathway',
    badge: 'VERTIGO PATH',
    description:
      'Highlights the Back Balance Loop, Balance Sensor, Shared Exit Tube, and Resting Sac where loose crystals travel during the Epley treatment.',
    bonyPeelPercent: 95,
    microCutawayPercent: 55,
    explodePercent: 0,
    defaultSelectedMesh: 'ls_Hsapiens_Sp',
    states: {
      ls_Hsapiens_Sp: 'visible',
      ls_Hsapiens_Ap: 'ghost',
      ls_Hsapiens_Post_Cup_Duct: 'visible',
      ls_Hsapiens_Post_Cup_Ut: 'visible',
      ls_Hsapiens_Post_Cup_Wall: 'visible',
      ls_Hsapiens_CCp: 'visible',
      ls_Hsapiens_utricle: 'visible',
      ls_Hsapiens_UCp: 'visible',
      ls_Hsapiens_Sa: 'ghost',
      ls_Hsapiens_Sl: 'ghost',
      ls_Hsapiens_CCa: 'ghost',
      ls_Hsapiens_SC: 'ghost',
      ls_Hsapiens_Aa: 'ghost',
      ls_Hsapiens_Al: 'ghost',
      ls_Hsapiens_Ant_Cup_Duct: 'hidden',
      ls_Hsapiens_Ant_Cup_Ut: 'hidden',
      ls_Hsapiens_Ant_Cup_Wall: 'hidden',
      ls_Hsapiens_Lat_Cup_Duct: 'hidden',
      ls_Hsapiens_Lat_Cup_Ut: 'hidden',
      ls_Hsapiens_Lat_Cup_Wall: 'hidden',
      mesh_david_sacculus: 'ghost',
      mesh_david_cochlea: 'ghost',
      seg_coch_inner_scala_vestibuli: 'hidden',
      seg_coch_inner_scala_tympani: 'hidden',
      seg_coch_inner_cupula: 'hidden',
      'segT2_th1.07_Otsu': 'hidden',
      seg_coch_outer_T2: 'hidden',
    },
  },
  {
    id: 'cupula_micro_dissection',
    title: 'Inside the Balance Sensors (Cupulae)',
    badge: 'SENSORS',
    description:
      'Makes the outer sensor chambers see-through to reveal the delicate gel motion sensor flaps (cupulae) inside all three balance loops.',
    bonyPeelPercent: 100,
    microCutawayPercent: 85,
    explodePercent: 0,
    defaultSelectedMesh: 'ls_Hsapiens_Post_Cup_Duct',
    states: {
      ls_Hsapiens_Ap: 'ghost',
      ls_Hsapiens_Aa: 'ghost',
      ls_Hsapiens_Al: 'ghost',
      ls_Hsapiens_Post_Cup_Duct: 'visible',
      ls_Hsapiens_Post_Cup_Ut: 'visible',
      ls_Hsapiens_Post_Cup_Wall: 'visible',
      ls_Hsapiens_Ant_Cup_Duct: 'visible',
      ls_Hsapiens_Ant_Cup_Ut: 'visible',
      ls_Hsapiens_Ant_Cup_Wall: 'visible',
      ls_Hsapiens_Lat_Cup_Duct: 'visible',
      ls_Hsapiens_Lat_Cup_Ut: 'visible',
      ls_Hsapiens_Lat_Cup_Wall: 'visible',
      ls_Hsapiens_Sp: 'ghost',
      ls_Hsapiens_Sa: 'ghost',
      ls_Hsapiens_Sl: 'ghost',
      ls_Hsapiens_CCp: 'ghost',
      ls_Hsapiens_CCa: 'hidden',
      ls_Hsapiens_SC: 'hidden',
      ls_Hsapiens_utricle: 'ghost',
      ls_Hsapiens_UCp: 'ghost',
      mesh_david_sacculus: 'hidden',
      mesh_david_cochlea: 'hidden',
      seg_coch_inner_scala_vestibuli: 'hidden',
      seg_coch_inner_scala_tympani: 'hidden',
      seg_coch_inner_cupula: 'hidden',
      'segT2_th1.07_Otsu': 'hidden',
      seg_coch_outer_T2: 'hidden',
    },
  },
  {
    id: 'cochlear_scalae_cutaway',
    title: 'Inside the Hearing Snail (Cochlea)',
    badge: 'HEARING',
    description:
      'Makes the outer snail shell see-through to highlight the upper and lower sound tunnels (Scala Vestibuli & Scala Tympani).',
    bonyPeelPercent: 100,
    microCutawayPercent: 80,
    explodePercent: 0,
    defaultSelectedMesh: 'seg_coch_inner_scala_tympani',
    states: {
      mesh_david_cochlea: 'ghost',
      seg_coch_outer_T2: 'ghost',
      seg_coch_inner_scala_vestibuli: 'visible',
      seg_coch_inner_scala_tympani: 'visible',
      seg_coch_inner_cupula: 'visible',
      mesh_david_sacculus: 'visible',
      ls_Hsapiens_utricle: 'ghost',
      ls_Hsapiens_UCp: 'hidden',
      ls_Hsapiens_Sp: 'ghost',
      ls_Hsapiens_Sa: 'ghost',
      ls_Hsapiens_Sl: 'ghost',
      ls_Hsapiens_CCp: 'hidden',
      ls_Hsapiens_CCa: 'hidden',
      ls_Hsapiens_SC: 'hidden',
      ls_Hsapiens_Ap: 'hidden',
      ls_Hsapiens_Aa: 'hidden',
      ls_Hsapiens_Al: 'hidden',
      ls_Hsapiens_Post_Cup_Duct: 'hidden',
      ls_Hsapiens_Post_Cup_Ut: 'hidden',
      ls_Hsapiens_Post_Cup_Wall: 'hidden',
      ls_Hsapiens_Ant_Cup_Duct: 'hidden',
      ls_Hsapiens_Ant_Cup_Ut: 'hidden',
      ls_Hsapiens_Ant_Cup_Wall: 'hidden',
      ls_Hsapiens_Lat_Cup_Duct: 'hidden',
      ls_Hsapiens_Lat_Cup_Ut: 'hidden',
      ls_Hsapiens_Lat_Cup_Wall: 'hidden',
      'segT2_th1.07_Otsu': 'hidden',
    },
  },
  {
    id: 'exploded_27_assembly',
    title: 'Separated 27-Part View (Exploded)',
    badge: 'EXPLODED',
    description:
      'Gently separates all 27 inner ear parts outward with guide lines so every structure can be seen clearly without overlap.',
    bonyPeelPercent: 75,
    microCutawayPercent: 40,
    explodePercent: 65,
    defaultSelectedMesh: 'ls_Hsapiens_utricle',
    states: {
      'segT2_th1.07_Otsu': 'ghost',
      seg_coch_outer_T2: 'hidden',
    },
  },
];

// ============================================================================
// PHASE 4: HUMAN-READABLE DISPLAY NAMES FOR RAW FIDUCIAL & MESH IDS
// ============================================================================
export const RAW_ID_TO_DISPLAY_NAME: Record<string, string> = {
  // 3D Slicer Fiducial IDs (.fcsv raw labels & stripped variants)
  SSC_post_ampulla: 'Posterior ampulla',
  post_ampulla: 'Posterior ampulla',
  SSC_post_inf_limb: 'Posterior canal (inferior limb)',
  post_inf_limb: 'Posterior canal (inferior limb)',
  SSC_post_apex: 'Posterior canal (apex)',
  post_apex: 'Posterior canal (apex)',
  SSC_post_sup_limb: 'Posterior canal (superior limb)',
  post_sup_limb: 'Posterior canal (superior limb)',
  SSC_post_cc_junction: 'Posterior–common crus junction',
  post_cc_junction: 'Posterior–common crus junction',
  SSC_ant_ampulla: 'Anterior ampulla',
  ant_ampulla: 'Anterior ampulla',
  SSC_ant_apex: 'Anterior canal (apex)',
  ant_apex: 'Anterior canal (apex)',
  SSC_ant_cc_junction: 'Anterior–common crus junction',
  ant_cc_junction: 'Anterior–common crus junction',
  SSC_lat_ampulla: 'Lateral ampulla',
  lat_ampulla: 'Lateral ampulla',
  SSC_lat_apex: 'Lateral canal (apex)',
  lat_apex: 'Lateral canal (apex)',
  SSC_lat_utricle: 'Lateral–utricular junction',
  lat_utricle: 'Lateral–utricular junction',
  SSC_ccrus_sup: 'Common crus (superior)',
  ccrus_sup: 'Common crus (superior)',
  SSC_ccrus_mid: 'Common crus (mid)',
  ccrus_mid: 'Common crus (mid)',
  SSC_ccrus_utricle: 'Common crus (utricular base)',
  ccrus_utricle: 'Common crus (utricular base)',
  // Raw Mesh Names & Structure IDs (auto-populated from IEMAP_STRUCTURES below)
  ...Object.fromEntries(
    IEMAP_STRUCTURES.flatMap((item) => [
      [item.meshName, item.displayName],
      [item.structureId, item.displayName],
    ])
  ),
};

export const FIDUCIAL_TO_MESH_NAME: Record<string, string> = {
  SSC_post_ampulla: 'ls_Hsapiens_Ap',
  post_ampulla: 'ls_Hsapiens_Ap',
  SSC_post_inf_limb: 'ls_Hsapiens_Sp',
  post_inf_limb: 'ls_Hsapiens_Sp',
  SSC_post_apex: 'ls_Hsapiens_Sp',
  post_apex: 'ls_Hsapiens_Sp',
  SSC_post_sup_limb: 'ls_Hsapiens_Sp',
  post_sup_limb: 'ls_Hsapiens_Sp',
  SSC_post_cc_junction: 'ls_Hsapiens_CCp',
  post_cc_junction: 'ls_Hsapiens_CCp',
  SSC_ant_ampulla: 'ls_Hsapiens_Aa',
  ant_ampulla: 'ls_Hsapiens_Aa',
  SSC_ant_apex: 'ls_Hsapiens_Sa',
  ant_apex: 'ls_Hsapiens_Sa',
  SSC_ant_cc_junction: 'ls_Hsapiens_CCa',
  ant_cc_junction: 'ls_Hsapiens_CCa',
  SSC_lat_ampulla: 'ls_Hsapiens_Al',
  lat_ampulla: 'ls_Hsapiens_Al',
  SSC_lat_apex: 'ls_Hsapiens_Sl',
  lat_apex: 'ls_Hsapiens_Sl',
  SSC_lat_utricle: 'ls_Hsapiens_SC',
  lat_utricle: 'ls_Hsapiens_SC',
  SSC_ccrus_sup: 'ls_Hsapiens_CCp',
  ccrus_sup: 'ls_Hsapiens_CCp',
  SSC_ccrus_mid: 'ls_Hsapiens_CCp',
  ccrus_mid: 'ls_Hsapiens_CCp',
  SSC_ccrus_utricle: 'ls_Hsapiens_utricle',
  ccrus_utricle: 'ls_Hsapiens_utricle',
};

export function getFiducialMeshName(rawId: string, canalGroup?: string): string {
  if (FIDUCIAL_TO_MESH_NAME[rawId]) {
    return FIDUCIAL_TO_MESH_NAME[rawId];
  }
  const stripped = rawId.replace(/^SSC_/, '');
  if (FIDUCIAL_TO_MESH_NAME[stripped]) {
    return FIDUCIAL_TO_MESH_NAME[stripped];
  }
  if (canalGroup === 'anterior') return 'ls_Hsapiens_Sa';
  if (canalGroup === 'lateral') return 'ls_Hsapiens_Sl';
  if (canalGroup === 'common_crus') return 'ls_Hsapiens_CCp';
  return 'ls_Hsapiens_Sp';
}

export function getHumanReadableLabel(rawId: string): string {
  if (RAW_ID_TO_DISPLAY_NAME[rawId]) {
    return RAW_ID_TO_DISPLAY_NAME[rawId];
  }
  const stripped = rawId.replace(/^SSC_/, '');
  if (RAW_ID_TO_DISPLAY_NAME[stripped]) {
    return RAW_ID_TO_DISPLAY_NAME[stripped];
  }
  return rawId;
}

export const KEY_FIDUCIAL_IDS = new Set<string>([
  'SSC_post_apex',
  'SSC_post_ampulla',
  'SSC_ccrus_mid',
  'SSC_ant_apex',
  'SSC_lat_apex',
  'SSC_ccrus_utricle',
]);

export const KEY_STRUCTURE_MESH_NAMES = new Set<string>([
  'ls_Hsapiens_Sp',
  'ls_Hsapiens_Sa',
  'ls_Hsapiens_Sl',
  'ls_Hsapiens_CCp',
  'ls_Hsapiens_Ap',
  'ls_Hsapiens_utricle',
  'mesh_david_sacculus',
  'mesh_david_cochlea',
]);


