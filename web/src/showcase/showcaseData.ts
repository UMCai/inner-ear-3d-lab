import {
  IEMAP_STRUCTURES,
  KEY_STRUCTURE_MESH_NAMES,
  LAB_PRESETS,
  STRUCTURE_BY_MESH,
  SYSTEM_GROUPS,
  type DissectionPreset,
  type StructureOntologyItem,
  type SystemGroupId,
} from '../data/ontology';
import {
  getAcousticLandmark,
  getCoordinatesForFrequency,
  getDistanceApexMm,
  greenwoodFrequency,
  greenwoodPosition,
} from '../data/greenwoodEngine';
import {
  RADIOLOGY_PLANES,
  SCDS_PARAMETERS,
  getLandmarkForDepth,
  getShaderClipUniforms,
  type CTWindowMode,
  type RadiologyPlaneId,
} from '../data/radiologyEngine';
import {
  EPLEY_STEPS,
  type CanalId,
} from '../physics/vestibularEngine';
import {
  CALORIC_CLINICAL_PRESETS,
  VHITImpulseBuffer,
  calculateJongkees,
  computeCaloricConvection,
} from '../physics/diagnosticVestibularEngine';
import {
  CI_CONSTANTS,
  computeCIInsertionKinematics,
  computeLabyrinthectomyAblation,
  computeNeurectomyElectrophysiology,
  evaluateScalaTympaniSpline,
  type KoosStage,
  type SurgicalProcedure,
} from '../physics/surgicalEngine';

export {
  CALORIC_CLINICAL_PRESETS,
  CI_CONSTANTS,
  EPLEY_STEPS,
  IEMAP_STRUCTURES,
  KEY_STRUCTURE_MESH_NAMES,
  LAB_PRESETS,
  RADIOLOGY_PLANES,
  SCDS_PARAMETERS,
  STRUCTURE_BY_MESH,
  SYSTEM_GROUPS,
  VHITImpulseBuffer,
  calculateJongkees,
  computeCIInsertionKinematics,
  computeCaloricConvection,
  computeLabyrinthectomyAblation,
  computeNeurectomyElectrophysiology,
  evaluateScalaTympaniSpline,
  getAcousticLandmark,
  getCoordinatesForFrequency,
  getDistanceApexMm,
  getLandmarkForDepth,
  getShaderClipUniforms,
  greenwoodFrequency,
  greenwoodPosition,
};

export type {
  CTWindowMode,
  CanalId,
  DissectionPreset,
  KoosStage,
  RadiologyPlaneId,
  StructureOntologyItem,
  SurgicalProcedure,
  SystemGroupId,
};

export type ShowcaseMode = 'anatomy' | 'hearing' | 'radiology' | 'vestibular' | 'surgical';
export type NoteState = 'collapsed' | 'compact' | 'expanded';
export type SidebarTab = 'note' | 'lab';
export type DrawerId = 'parts' | 'audiogram' | 'ct' | 'vor' | 'surgical' | 'gyro';
export type LabelDensity = 'off' | 'key' | 'all';
export type ReadingDepth = 'simple' | 'detailed';
export type ThemePreference = 'system' | 'light' | 'dark';
export type VestibularSubmode = 'bppv' | 'caloric' | 'vhit';
export type AudiogramPresetId = 'normal' | 'presbycusis' | 'noise_notch' | 'meniere' | 'scds';

export const MODE_LABELS: Record<ShowcaseMode, string> = {
  anatomy: 'Anatomy Atlas',
  hearing: 'Hearing & Tonotopy',
  radiology: 'Virtual Radiology',
  vestibular: 'Vestibular & VOR',
  surgical: 'Surgical Suites',
};

export const MODE_LAB_TAB_LABELS: Record<ShowcaseMode, string> = {
  anatomy: '27 Parts',
  hearing: 'Audiogram',
  radiology: 'CT Slice',
  vestibular: 'VOR & Gyro',
  surgical: 'Force Trace',
};

export const MODE_DEFAULT_MESH: Record<ShowcaseMode, string> = {
  anatomy: 'mesh_david_cochlea',
  hearing: 'mesh_david_cochlea',
  radiology: 'ls_Hsapiens_Sa',
  vestibular: 'ls_Hsapiens_Sp',
  surgical: 'seg_coch_inner_scala_tympani',
};

export function formatStructureHeadline(item: StructureOntologyItem): string {
  return item.displayName.replace(/\s*\(David Atlas\)\s*/i, '').trim();
}

export function getCompactNoteSentence(item: StructureOntologyItem): string {
  const src = item.patientSummary.trim();
  const match = src.match(/^[^.!?]+[.!?]/);
  return match ? match[0].trim() : src;
}

export interface AudiogramPresetProfile {
  id: AudiogramPresetId;
  label: string;
  caption: string;
  thresholdsDb: ReadonlyArray<{ freqHz: number; dbHl: number }>;
  highlightRangeX: [number, number] | null;
}

export const AUDIOGRAM_FREQUENCIES = [125, 250, 500, 1000, 2000, 3000, 4000, 6000, 8000] as const;

export const AUDIOGRAM_PRESETS: Record<AudiogramPresetId, AudiogramPresetProfile> = {
  normal: {
    id: 'normal',
    label: 'Normal',
    caption: 'Right Ear convention (red circles). Normative air conduction ≤ 15 dB HL across speech frequencies.',
    thresholdsDb: [
      { freqHz: 125, dbHl: 10 },
      { freqHz: 250, dbHl: 10 },
      { freqHz: 500, dbHl: 5 },
      { freqHz: 1000, dbHl: 5 },
      { freqHz: 2000, dbHl: 10 },
      { freqHz: 3000, dbHl: 10 },
      { freqHz: 4000, dbHl: 10 },
      { freqHz: 6000, dbHl: 15 },
      { freqHz: 8000, dbHl: 15 },
    ],
    highlightRangeX: null,
  },
  presbycusis: {
    id: 'presbycusis',
    label: 'Presbycusis',
    caption: 'High-frequency sloping sensorineural loss: stiff basal turn hair cell loss above 2 kHz.',
    thresholdsDb: [
      { freqHz: 125, dbHl: 15 },
      { freqHz: 250, dbHl: 15 },
      { freqHz: 500, dbHl: 20 },
      { freqHz: 1000, dbHl: 25 },
      { freqHz: 2000, dbHl: 40 },
      { freqHz: 3000, dbHl: 55 },
      { freqHz: 4000, dbHl: 65 },
      { freqHz: 6000, dbHl: 75 },
      { freqHz: 8000, dbHl: 80 },
    ],
    highlightRangeX: [greenwoodPosition(2000), 1.0],
  },
  noise_notch: {
    id: 'noise_notch',
    label: '4 kHz Notch',
    caption: 'Pathognomonic 4 kHz acoustic trauma notch (~8–10 mm from base) with partial 8 kHz recovery.',
    thresholdsDb: [
      { freqHz: 125, dbHl: 10 },
      { freqHz: 250, dbHl: 10 },
      { freqHz: 500, dbHl: 10 },
      { freqHz: 1000, dbHl: 15 },
      { freqHz: 2000, dbHl: 20 },
      { freqHz: 3000, dbHl: 45 },
      { freqHz: 4000, dbHl: 65 },
      { freqHz: 6000, dbHl: 50 },
      { freqHz: 8000, dbHl: 25 },
    ],
    highlightRangeX: [greenwoodPosition(2800), greenwoodPosition(5600)],
  },
  meniere: {
    id: 'meniere',
    label: 'Ménière',
    caption: 'Low-frequency rising curve: endolymphatic hydrops stiffens compliant apical basilar turn.',
    thresholdsDb: [
      { freqHz: 125, dbHl: 55 },
      { freqHz: 250, dbHl: 55 },
      { freqHz: 500, dbHl: 50 },
      { freqHz: 1000, dbHl: 35 },
      { freqHz: 2000, dbHl: 20 },
      { freqHz: 3000, dbHl: 20 },
      { freqHz: 4000, dbHl: 25 },
      { freqHz: 6000, dbHl: 25 },
      { freqHz: 8000, dbHl: 25 },
    ],
    highlightRangeX: [0.0, greenwoodPosition(750)],
  },
  scds: {
    id: 'scds',
    label: 'SSCD',
    caption: 'Low-frequency air-conduction pseudoconductive gap due to acoustic energy shunting via 3rd window.',
    thresholdsDb: [
      { freqHz: 125, dbHl: 40 },
      { freqHz: 250, dbHl: 35 },
      { freqHz: 500, dbHl: 30 },
      { freqHz: 1000, dbHl: 15 },
      { freqHz: 2000, dbHl: 10 },
      { freqHz: 3000, dbHl: 10 },
      { freqHz: 4000, dbHl: 10 },
      { freqHz: 6000, dbHl: 15 },
      { freqHz: 8000, dbHl: 15 },
    ],
    highlightRangeX: [0.0, greenwoodPosition(500)],
  },
};

export function sliderValueToFrequencyHz(sliderVal: number): number {
  // 0..1000 maps logarithmically across 20 Hz .. 20000 Hz
  const t = Math.max(0, Math.min(1, sliderVal / 1000));
  return Math.round(20 * Math.pow(1000, t));
}

export function frequencyHzToSliderValue(freqHz: number): number {
  const safe = Math.max(20, Math.min(20000, freqHz));
  const t = Math.log(safe / 20) / Math.log(1000);
  return Math.round(t * 1000);
}

export function formatFrequencyHz(freqHz: number): string {
  if (freqHz >= 1000) {
    const khz = freqHz / 1000;
    return `${khz >= 10 ? khz.toFixed(1) : khz.toFixed(2).replace(/\.?0+$/, '')} kHz`;
  }
  return `${Math.round(freqHz)} Hz`;
}

export function formatRAS(coords: Readonly<[number, number, number]>): string {
  return `[${coords[0].toFixed(1)}, ${coords[1].toFixed(1)}, ${coords[2].toFixed(1)}]`;
}

export function compactFluidLabel(fluid: StructureOntologyItem['fluidCompartment']): string {
  if (fluid.startsWith('Endolymph')) return 'Endolymph +80mV';
  if (fluid.startsWith('Perilymph')) return 'Perilymph 0 mV';
  if (fluid.startsWith('Gelatinous')) return 'Cupula Gel';
  return 'Otic Capsule';
}

const DUCT_METRIC_MAP: Record<string, { key: string; value: string }> = {
  ls_Hsapiens_Sp: { key: 'Coplanar Axis', value: 'LARP · r 2.85 mm' },
  ls_Hsapiens_Sa: { key: 'Coplanar Axis', value: 'RALP · Z +7.56' },
  ls_Hsapiens_Sl: { key: 'Coplanar Axis', value: 'Yaw 30° · +10.7' },
  ls_Hsapiens_CCp: { key: 'Return Arc', value: 'φ 112°–172° Crus' },
  ls_Hsapiens_CCa: { key: 'Return Arc', value: 'Ant. Common Limb' },
  ls_Hsapiens_SC: { key: 'Return Arc', value: 'Horiz. Return' },
};

export function getStructurePrimaryMetric(item: StructureOntologyItem): { key: string; value: string } {
  if (item.characteristicFrequencyRange) {
    return {
      key: 'Tonotopy',
      value: item.characteristicFrequencyRange.replace(/\s*\([^)]*\)/, '').trim(),
    };
  }
  if (DUCT_METRIC_MAP[item.meshName]) {
    return DUCT_METRIC_MAP[item.meshName];
  }
  if (item.systemGroup === 'semicircular_ducts') {
    return { key: 'Plane', value: 'Semilunar Conduit' };
  }
  if (item.systemGroup === 'ampullae_cupulae') {
    return { key: 'Hydrodynamics', value: 'ΔP Cupular Gate' };
  }
  if (item.systemGroup === 'otolith_vestibule') {
    return {
      key: 'Linear Vector',
      value: item.meshName.includes('sacculus') ? 'Vertical (±Z)' : 'Horiz. (X–Y)',
    };
  }
  return { key: 'Mesh Density', value: `${item.verticesCount.toLocaleString()} verts` };
}

export function getAnatomyHighlightPreset(presetId: string): DissectionPreset {
  return LAB_PRESETS.find((p) => p.id === presetId) ?? LAB_PRESETS[0];
}
