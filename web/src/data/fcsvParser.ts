export interface FiducialPointRAS {
  id: string;
  label: string;
  description: string;
  canalGroup: 'posterior' | 'anterior' | 'lateral' | 'common_crus';
  positionRAS: [number, number, number];
}

export interface PosteriorSplineSample {
  index: number;
  phi_deg: number;
  arc_length_mm: number;
  position_ras: [number, number, number];
  tangent_ras: [number, number, number];
  normal_ras: [number, number, number];
}

export interface PosteriorCanalPathData {
  coordinate_system: string;
  ear_side: string;
  units: string;
  canal_center_ras: [number, number, number];
  canal_radius_mm: number;
  total_arc_length_mm: number;
  landmarks_phi_deg: Record<string, number>;
  samples: PosteriorSplineSample[];
}

export function parseFcsvText(
  text: string,
  canalGroup: FiducialPointRAS['canalGroup']
): FiducialPointRAS[] {
  const points: FiducialPointRAS[] = [];
  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const cols = line.split(',');
    if (cols.length < 13) continue;
    const id = cols[0].trim();
    const x = parseFloat(cols[1]);
    const y = parseFloat(cols[2]);
    const z = parseFloat(cols[3]);
    const label = cols[11].trim();
    const description = cols[12].trim();
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
      points.push({
        id,
        label,
        description: description || label,
        canalGroup,
        positionRAS: [x, y, z],
      });
    }
  }
  return points;
}

export async function loadAllFiducials(): Promise<FiducialPointRAS[]> {
  const files: Array<{ url: string; group: FiducialPointRAS['canalGroup'] }> = [
    { url: '/assets/iemap/fcsv/SSC_post.fcsv', group: 'posterior' },
    { url: '/assets/iemap/fcsv/SSC_ant.fcsv', group: 'anterior' },
    { url: '/assets/iemap/fcsv/SSC_lat.fcsv', group: 'lateral' },
    { url: '/assets/iemap/fcsv/SSC_ccrus.fcsv', group: 'common_crus' },
  ];

  const results = await Promise.all(
    files.map(async ({ url, group }) => {
      const res = await fetch(url);
      if (!res.ok) return [];
      const text = await res.text();
      return parseFcsvText(text, group);
    })
  );

  return results.flat();
}

export async function loadPosteriorCanalPath(): Promise<PosteriorCanalPathData> {
  const res = await fetch('/assets/iemap/posterior_canal_path.json');
  if (!res.ok) {
    throw new Error(`Failed to load posterior_canal_path.json: ${res.status}`);
  }
  return (await res.json()) as PosteriorCanalPathData;
}
