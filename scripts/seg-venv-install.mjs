#!/usr/bin/env node
// Install packages into the segmentation venv (e.g., npm run seg:venv:install -- scipy)

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

function locateAppDir() {
  const dir = join(process.cwd(), 'services', 'segmentation');
  if (!existsSync(dir)) {
    console.error('services/segmentation directory not found. Update your checkout or restore the service folder.');
    process.exit(1);
  }
  return dir;
}
const appDir = locateAppDir();
const venvDir = join(appDir, '.venv');
const isWin = process.platform === 'win32';
const binPy = isWin ? join(venvDir, 'Scripts', 'python.exe') : join(venvDir, 'bin', 'python');

if (!existsSync(binPy)) {
  console.error('Venv not found. Run setup first: npm run seg:venv:setup -- --transformers-only');
  process.exit(1);
}

const pkgs = process.argv.slice(2).filter(Boolean);
if (pkgs.length === 0) {
  console.error('Usage: npm run seg:venv:install -- <package> [more ...]');
  process.exit(1);
}

const r = spawnSync(binPy, ['-m', 'pip', 'install', ...pkgs], { stdio: 'inherit', cwd: appDir });
process.exit(r.status || 0);
