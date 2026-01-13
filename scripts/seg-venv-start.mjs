#!/usr/bin/env node
// Start FastAPI segmentation service from local Python venv.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const isWin = process.platform === 'win32';
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
const py = isWin ? join(venvDir, 'Scripts', 'python.exe') : join(venvDir, 'bin', 'python');

if (!existsSync(venvDir)) {
  console.error('Venv not found. Run: npm run seg:venv:setup');
  process.exit(1);
}
if (!existsSync(py)) {
  console.error(`Python not found in venv (${py}). Re-run setup: npm run seg:venv:setup`);
  process.exit(1);
}

console.log('Starting FastAPI (uvicorn) on 127.0.0.1:8000 ... Ctrl+C to stop');
const p = spawn(py, ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8000', '--reload'], { cwd: appDir, stdio: 'inherit' });
p.on('exit', (code) => process.exit(code ?? 0));
