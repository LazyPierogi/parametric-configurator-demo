#!/usr/bin/env node
// Send a segmentation request via BFF or directly to local service.

import { readFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { basename, resolve } from 'node:path';

function getArg(name, def) {
  const ix = process.argv.indexOf(`--${name}`);
  if (ix >= 0 && process.argv[ix + 1]) return process.argv[ix + 1];
  return def;
}

const file = getArg('file');
if (!file) {
  console.error('Usage: npm run test:seg -- --file path/to.jpg [--out mask.png] [--bff http://localhost:3010] [--direct 1]');
  process.exit(1);
}
const out = getArg('out', 'mask.png');
const bff = getArg('bff', process.env.BFF_URL || 'http://localhost:3010');
const direct = getArg('direct');
const segUrl = getArg('seg', process.env.LOCAL_SEG_URL || 'http://127.0.0.1:8000/segment');
const model = getArg('model', 'mask2former_ade20k');
const layers = getArg('layers');

async function viaBff(fp) {
  const buf = await readFile(fp);
  const fd = new FormData();
  const filename = basename(fp);
  fd.append('image', new Blob([buf], { type: 'application/octet-stream' }), filename);
  if (layers) fd.append('layers', '1');
  const res = await fetch(`${bff}/api/segment`, { method: 'POST', body: fd });
  if (!res.ok) throw new Error(`BFF error ${res.status}: ${await res.text()}`);
  if (layers) {
    const json = await res.json();
    const b64 = (json.final_mask || '').split(',')[1];
    if (!b64) throw new Error('No final_mask in response');
    createWriteStream(out).end(Buffer.from(b64, 'base64'));
    if (json.attached_on_wall) {
      createWriteStream('attached_on_wall.png').end(Buffer.from(json.attached_on_wall.split(',')[1], 'base64'));
    }
    if (json.proposal_union) {
      createWriteStream('proposal_union.png').end(Buffer.from(json.proposal_union.split(',')[1], 'base64'));
    }
  } else {
    const ab = await res.arrayBuffer();
    createWriteStream(out).end(Buffer.from(ab));
  }
}

async function viaDirect(fp) {
  const buf = await readFile(fp);
  const res = await fetch(segUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream', 'X-Model': model, 'X-Threshold': '0.6' },
    body: buf,
  });
  if (!res.ok) throw new Error(`SEG error ${res.status}: ${await res.text()}`);
  const ab = await res.arrayBuffer();
  createWriteStream(out).end(Buffer.from(ab));
}

(async () => {
  const abs = resolve(file);
  console.log(`Reading ${abs}`);
  if (direct) {
    console.log(`POST -> ${segUrl} (X-Model: ${model})`);
    await viaDirect(abs);
  } else {
    console.log(`POST -> ${bff}/api/segment${layers ? ' (layers=1)' : ''}`);
    await viaBff(abs);
  }
  console.log(`Saved ${out}`);
})();
