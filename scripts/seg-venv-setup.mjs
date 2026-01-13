#!/usr/bin/env node
// Prepare Python venv for the segmentation FastAPI service.

import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

function locateAppDir() {
  const dir = join(process.cwd(), 'services', 'segmentation');
  if (!existsSync(dir)) {
    throw new Error('services/segmentation directory not found. Update your checkout or restore the service folder.');
  }
  return dir;
}
const appDir = locateAppDir();
const isWin = process.platform === 'win32';

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: appDir, stdio: 'inherit', ...opts });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed`);
}

function findPython() {
  const candidates = isWin ? ['py', 'python'] : ['python3', 'python'];
  for (const c of candidates) {
    const r = spawnSync(c, ['--version'], { stdio: 'ignore' });
    if (r.status === 0) return c;
  }
  throw new Error('Python not found. Install Python 3 and re-run.');
}

const transformersOnly = process.argv.includes('--transformers-only');

try {
  console.log('Setting up Python venv for services/segmentation...');
  const py = findPython();
  const venvDir = join(appDir, '.venv');
  const force = process.argv.includes('--force');
  const posixPy = join(venvDir, 'bin', 'python');
  const winPy = join(venvDir, 'Scripts', 'python.exe');
  const hasVenv = existsSync(venvDir);
  const layoutOk = process.platform === 'win32' ? existsSync(winPy) : existsSync(posixPy);
  if (!hasVenv || force || !layoutOk) {
    if (hasVenv && (force || !layoutOk)) {
      console.log('Removing existing venv (mismatched platform or --force)...');
      rmSync(venvDir, { recursive: true, force: true });
    }
    console.log('Creating venv...');
    run(py, ['-m', 'venv', '.venv']);
  } else {
    console.log('Venv already exists, reusing.');
  }
  const binPy = isWin ? winPy : posixPy;
  run(binPy, ['-m', 'pip', 'install', '--upgrade', 'pip']);
  const req = transformersOnly ? 'requirements-transformers.txt' : 'requirements.txt';
  console.log(`Installing Python dependencies from ${req} ...`);
  run(binPy, ['-m', 'pip', 'install', '-r', req]);
  console.log('\nDone. Start server with: npm run seg:venv:start');
  console.log('Tip (Apple Silicon): PyTorch MPS is auto-detected when available.');
  if (!transformersOnly && process.platform === 'darwin') {
    console.log('\nNote: On macOS you can avoid heavy mmcv/mmseg installs by running:');
    console.log('  npm run seg:venv:setup -- --transformers-only');
  }
} catch (e) {
  console.error('Setup failed:', e?.message || e);
  process.exit(1);
}
