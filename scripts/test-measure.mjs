#!/usr/bin/env node
// Send a measurement request to BFF with an image encoded as data URI.

import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';

function getArg(name, def) {
  const ix = process.argv.indexOf(`--${name}`);
  if (ix >= 0 && process.argv[ix + 1]) return process.argv[ix + 1];
  return def;
}

const file = getArg('file');
if (!file) {
  console.error('Usage: npm run test:measure -- --file path/to.jpg [--bff http://localhost:3010]');
  process.exit(1);
}
const bff = getArg('bff', process.env.BFF_URL || 'http://localhost:3010');

function mimeFor(path) {
  const ext = extname(path).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  return 'application/octet-stream';
}

(async () => {
  const abs = resolve(file);
  const buf = await readFile(abs);
  const b64 = Buffer.from(buf).toString('base64');
  const dataUri = `data:${mimeFor(abs)};base64,${b64}`;
  const res = await fetch(`${bff}/api/measure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photoDataUri: dataUri }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Measure error ${res.status}: ${txt}`);
  }
  const json = await res.json();
  console.log(JSON.stringify(json, null, 2));
})();

