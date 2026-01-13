#!/usr/bin/env node
// Simple status checker for BFF and local segmentation service

const DEFAULT_BFF = process.env.BFF_URL || 'http://localhost:3010';
const DEFAULT_SEG_URL = process.env.LOCAL_SEG_URL || 'http://127.0.0.1:8000/segment';

function getArg(name, def) {
  const ix = process.argv.indexOf(`--${name}`);
  if (ix >= 0 && process.argv[ix + 1]) return process.argv[ix + 1];
  return def;
}

const bff = getArg('bff', DEFAULT_BFF);
const segEndpoint = getArg('seg', DEFAULT_SEG_URL);

function baseOfSegment(u) {
  try {
    const url = new URL(u);
    url.pathname = '/';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return 'http://127.0.0.1:8000';
  }
}

const segBase = baseOfSegment(segEndpoint);

async function pingJson(url, { timeoutMs = 3000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const ct = res.headers.get('content-type') || '';
    const body = ct.includes('application/json') ? await res.json().catch(() => ({})) : await res.text();
    return { ok: res.ok, status: res.status, body };
  } catch (e) {
    return { ok: false, status: 0, body: { error: e?.message || String(e) } };
  } finally {
    clearTimeout(t);
  }
}

(async () => {
  console.log('Checking services...');
  const [seg, bffh] = await Promise.all([
    pingJson(`${segBase}/`),
    pingJson(`${bff}/api/healthz`),
  ]);

  const segOk = seg.ok && (typeof seg.body === 'object' ? !!seg.body.ok : true);
  const bffOk = bffh.ok && (typeof bffh.body === 'object' ? !!bffh.body.ok : true);

  console.log(`Segmentation @ ${segBase} -> ${segOk ? 'PASS' : 'FAIL'} ${segOk ? '' : `(status ${seg.status})`}`);
  if (!segOk) console.log('  details:', JSON.stringify(seg.body));

  console.log(`BFF @ ${bff} -> ${bffOk ? 'PASS' : 'FAIL'} ${bffOk ? '' : `(status ${bffh.status})`}`);
  if (!bffOk) console.log('  details:', JSON.stringify(bffh.body));

  if (!segOk) {
    console.log('\nTip: start segmentation with one of:');
    console.log('  npm run start:seg      # tries Docker on Linux (NVIDIA), else suggests venv');
    console.log('  npm run seg:venv:setup # prepare Python venv');
    console.log('  npm run seg:venv:start # run FastAPI locally');
  }
})();

