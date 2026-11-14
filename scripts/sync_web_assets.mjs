#!/usr/bin/env node
/**
 * scripts/sync_web_assets.mjs
 *
 * Syncs canonical IE-Map v1.0.0 web runtime assets from `assets/iemap/`
 * into the gitignored `web/public/assets/iemap/` directory so fresh clones
 * can immediately run `npm run dev`, `npm run build`, `npm test`, and
 * `python3 scripts/test_canal_paths.py` without requiring Blender.
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

const SRC_IEMAP = join(REPO_ROOT, 'assets', 'iemap');
const DST_IEMAP = join(REPO_ROOT, 'web', 'public', 'assets', 'iemap');
const DST_OBJ = join(DST_IEMAP, 'obj');
const DST_FCSV = join(DST_IEMAP, 'fcsv');
const DST_RAD = join(DST_IEMAP, 'radiology');

function copyIfNeeded(src, dst) {
  if (!existsSync(src)) {
    throw new Error(`Missing required source asset: ${src}`);
  }
  if (existsSync(dst)) {
    const srcStat = statSync(src);
    const dstStat = statSync(dst);
    if (srcStat.size === dstStat.size && Math.floor(srcStat.mtimeMs) <= Math.floor(dstStat.mtimeMs)) {
      return false;
    }
  }
  copyFileSync(src, dst);
  return true;
}

function main() {
  const metaPath = join(SRC_IEMAP, 'iemap_Metadata.json');
  if (!existsSync(metaPath)) {
    throw new Error(`Missing metadata file: ${metaPath}`);
  }

  mkdirSync(DST_OBJ, { recursive: true });
  mkdirSync(DST_FCSV, { recursive: true });
  mkdirSync(DST_RAD, { recursive: true });

  let copied = 0;
  const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));

  for (const [meshName, info] of Object.entries(meta.meshes ?? {})) {
    const relObj = info?.obj;
    const srcObj = relObj ? join(REPO_ROOT, relObj) : join(SRC_IEMAP, 'obj', `${meshName}.obj`);
    const dstObj = join(DST_OBJ, `${meshName}.obj`);
    if (copyIfNeeded(srcObj, dstObj)) copied++;
  }

  const requiredFiles = [
    'iemap_Metadata.json',
    'look-config.json',
    'posterior_canal_path.json',
    'horizontal_canal_path.json',
    'anterior_canal_path.json',
    'eye_avatar.glb',
  ];

  for (const fname of requiredFiles) {
    if (copyIfNeeded(join(SRC_IEMAP, fname), join(DST_IEMAP, fname))) {
      copied++;
    }
  }

  const fcsvDir = join(SRC_IEMAP, 'fcsv');
  if (!existsSync(fcsvDir)) {
    throw new Error(`Missing FCSV directory: ${fcsvDir}`);
  }
  const fcsvFiles = readdirSync(fcsvDir).filter((f) => f.endsWith('.fcsv')).sort();
  if (fcsvFiles.length === 0) {
    throw new Error(`No .fcsv files found in ${fcsvDir}`);
  }
  for (const fname of fcsvFiles) {
    if (copyIfNeeded(join(fcsvDir, fname), join(DST_FCSV, fname))) {
      copied++;
    }
  }

  const radDir = join(SRC_IEMAP, 'radiology');
  let radCount = 0;
  if (existsSync(radDir)) {
    const radFiles = readdirSync(radDir).filter((f) => !f.startsWith('.')).sort();
    for (const fname of radFiles) {
      if (copyIfNeeded(join(radDir, fname), join(DST_RAD, fname))) {
        copied++;
      }
      radCount++;
    }
  }

  console.log(
    `[sync_web_assets] Web assets up to date (${Object.keys(meta.meshes ?? {}).length} OBJ meshes, ${fcsvFiles.length} FCSV, ${requiredFiles.length} core files, ${radCount} radiology files; copied ${copied} updated file(s)).`
  );
}

main();
