#!/usr/bin/env node
// Remove the segmentation Python venv (useful if switching OS/platform)

import { rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

function locateVenv() {
  const dir = join(process.cwd(), 'services', 'segmentation', '.venv');
  return existsSync(dir) ? dir : null;
}
const venvDir = locateVenv();
if (!venvDir) {
  console.log('No segmentation venv found. Nothing to clean.');
  process.exit(0);
}
console.log('Removing venv:', venvDir);
try {
  rmSync(venvDir, { recursive: true, force: true });
  console.log('Done. Recreate with: npm run seg:venv:setup -- --transformers-only');
} catch (e) {
  console.error('Failed to remove venv:', e?.message || e);
  process.exit(1);
}
