#!/usr/bin/env node
// Try to start segmentation service: prefer Docker on Linux with NVIDIA, otherwise suggest or start local venv.

import { spawnSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const isLinux = process.platform === 'linux';

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { stdio: 'inherit', shell: false, ...opts });
}

function which(cmd) {
  const probe = isWin ? spawnSync('where', [cmd], { encoding: 'utf8' }) : spawnSync('which', [cmd], { encoding: 'utf8' });
  return probe.status === 0;
}

function startDockerCompose() {
  console.log('Attempting: docker compose up segmentation -d');
  const hasDocker = which('docker');
  if (!hasDocker) {
    console.log('docker not found in PATH. Skipping Docker path.');
    return false;
  }
  if (isLinux) {
    // Optional: check nvidia-smi
    const hasNvidia = which('nvidia-smi');
    if (!hasNvidia) console.log('Warning: nvidia-smi not found. Ensure NVIDIA drivers + Container Toolkit are installed.');
  }
  const r = run('docker', ['compose', 'up', 'segmentation', '-d']);
  return r.status === 0;
}

function appBaseDir() {
  const dir = join(process.cwd(), 'services', 'segmentation');
  if (!existsSync(dir)) {
    console.error('services/segmentation directory not found. Update your checkout or restore the service folder.');
    process.exit(1);
  }
  return dir;
}

function venvPythonPath() {
  const base = join(appBaseDir(), '.venv');
  const posix = join(base, 'bin', 'python');
  const win = join(base, 'Scripts', 'python.exe');
  if (existsSync(posix)) return posix;
  if (existsSync(win)) return win;
  return null;
}

function startVenv() {
  const py = venvPythonPath();
  if (!py) {
    console.log('Local venv not found. Run: npm run seg:venv:setup');
    return false;
  }
  console.log('Starting FastAPI (uvicorn) from local venv... Ctrl+C to stop.');
  const appDir = appBaseDir();
  const p = spawn(py, ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8000', '--reload'], { cwd: appDir, stdio: 'inherit' });
  p.on('exit', (code) => process.exit(code ?? 0));
  return true;
}

(async () => {
  if (isLinux) {
    const ok = startDockerCompose();
    if (ok) return;
    console.log('Docker path failed or unsuitable. Falling back to local venv.');
    startVenv();
    return;
  }
  if (isMac || isWin) {
    console.log('On macOS/Windows, prefer the local Python venv path for segmentation.');
    console.log('If you intended to use Docker with NVIDIA GPU, run this on a Linux host.');
    if (!venvPythonPath()) {
      console.log('First-time setup:');
      console.log('  npm run seg:venv:setup -- --transformers-only  # faster on macOS');
      console.log('  # or full stack (includes mmcv/mmseg):');
      console.log('  npm run seg:venv:setup');
      return;
    }
    startVenv();
    return;
  }
  console.log('Unknown platform. Please start manually:');
  console.log('  docker compose up segmentation -d');
  console.log('  or');
  console.log('  npm run seg:venv:setup && npm run seg:venv:start');
})();
