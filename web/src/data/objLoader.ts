import * as THREE from 'three';

/**
 * Fast Wavefront .obj parser tailored for the IE-Map v1.0.0 RAS triangulated meshes
 * and baked head context meshes. Supports `v`, `vn`, and `f` (with or without `//vn` indices).
 */
export function parseObjToBufferGeometry(objText: string): THREE.BufferGeometry {
  const verts: number[] = [];
  const norms: number[] = [];
  const outPositions: number[] = [];
  const outNormals: number[] = [];
  const flatVertIndices: number[] = [];

  const lines = objText.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length === 0 || line.charCodeAt(0) === 35 /* '#' */) continue;

    if (line.startsWith('v ')) {
      const parts = line.split(/\s+/);
      verts.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
    } else if (line.startsWith('vn ')) {
      const parts = line.split(/\s+/);
      norms.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
    } else if (line.startsWith('f ')) {
      const parts = line.split(/\s+/);
      const polyCount = parts.length - 1;
      if (polyCount < 3) continue;

      const vIdxs: number[] = [];
      const nIdxs: number[] = [];
      for (let k = 1; k <= polyCount; k++) {
        const token = parts[k];
        const slashPos = token.indexOf('/');
        if (slashPos === -1) {
          vIdxs.push(parseInt(token, 10) - 1);
          nIdxs.push(-1);
        } else {
          const vIdx = parseInt(token.slice(0, slashPos), 10) - 1;
          const lastSlash = token.lastIndexOf('/');
          const nStr = token.slice(lastSlash + 1);
          const nIdx = nStr.length > 0 ? parseInt(nStr, 10) - 1 : -1;
          vIdxs.push(vIdx);
          nIdxs.push(nIdx);
        }
      }

      for (let m = 1; m < polyCount - 1; m++) {
        const triV = [vIdxs[0], vIdxs[m], vIdxs[m + 1]];
        const triN = [nIdxs[0], nIdxs[m], nIdxs[m + 1]];
        for (let c = 0; c < 3; c++) {
          const vi = triV[c];
          const ni = triN[c];
          flatVertIndices.push(vi);
          outPositions.push(verts[vi * 3], verts[vi * 3 + 1], verts[vi * 3 + 2]);
          if (ni >= 0 && ni * 3 + 2 < norms.length) {
            outNormals.push(norms[ni * 3], norms[ni * 3 + 1], norms[ni * 3 + 2]);
          }
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();

  // If the OBJ already had matching vertex normals for all triangles and shared vertices,
  // build an indexed geometry so smooth shading and raycasting are fast and memory-compact.
  const numUniqueVerts = verts.length / 3;
  if (norms.length === verts.length && norms.length > 0) {
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(norms, 3));
    geometry.setIndex(flatVertIndices);
  } else if (numUniqueVerts > 0 && flatVertIndices.length > 0) {
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geometry.setIndex(flatVertIndices);
    geometry.computeVertexNormals();
  } else {
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(outPositions, 3));
    if (outNormals.length === outPositions.length) {
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(outNormals, 3));
    } else {
      geometry.computeVertexNormals();
    }
  }

  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
  return geometry;
}

export async function fetchObjGeometry(url: string): Promise<THREE.BufferGeometry> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch OBJ ${url}: ${res.status}`);
  }
  const text = await res.text();
  return parseObjToBufferGeometry(text);
}
