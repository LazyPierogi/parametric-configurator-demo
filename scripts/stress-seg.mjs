#!/usr/bin/env node
// Simple stress test for the BFF /api/segment endpoint.
// Sends multiple concurrent segmentation requests (mask2former + post-processing)
// and reports throughput and latency percentiles.

import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

function getArg(name, def) {
  const ix = process.argv.indexOf(`--${name}`);
  if (ix >= 0 && process.argv[ix + 1]) return process.argv[ix + 1];
  return def;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor((sorted.length - 1) * p);
  return sorted[idx];
}

function fmt(n) { return n != null ? Number(n).toFixed(1) : '—'; }

async function run() {
  const file = getArg('file');
  if (!file) {
    console.error('Usage: npm run stress:seg -- --file /path/to.jpg [--bff http://localhost:3010] [--total 100] [--concurrency 4] [--layers 0|1] [--ramp 0]');
    process.exit(1);
  }
  const bff = getArg('bff', process.env.BFF_URL || 'http://localhost:3010');
  const total = Number(getArg('total', '100'));
  const concurrency = Number(getArg('concurrency', '4'));
  const layers = getArg('layers', '0') === '1';
  const ramp = Number(getArg('ramp', '0')); // seconds to ramp up to full concurrency

  const abs = resolve(file);
  const buf = await readFile(abs);
  const filename = basename(abs);
  console.log(`Stress test: POST -> ${bff}/api/segment, total=${total}, concurrency=${concurrency}, layers=${layers ? 1 : 0}, file=${filename}`);

  let nextId = 0;
  let done = 0;
  let ok = 0;
  let fail = 0;
  const wallStart = Date.now();
  const clientLat = [];
  const serverLat = [];

  async function doOne(id) {
    const fd = new FormData();
    fd.append('image', new Blob([buf], { type: 'application/octet-stream' }), filename);
    if (layers) fd.append('layers', '1');

    const t0 = performance.now();
    let serverMs = null;
    try {
      const res = await fetch(`${bff}/api/segment`, { method: 'POST', body: fd });
      const t1 = performance.now();
      clientLat.push(t1 - t0);
      if (!res.ok) {
        fail++;
        // drain body text to avoid open handles
        try { await res.text(); } catch {}
        return;
      }
      const header = res.headers.get('X-Elapsed-MS');
      if (header) serverMs = Number(header);
      if (layers) {
        try {
          const json = await res.json();
          if (!serverMs && typeof json?.elapsed_ms === 'number') serverMs = json.elapsed_ms;
        } catch {}
      } else {
        // Drain body
        try { await res.arrayBuffer(); } catch {}
      }
      if (serverMs != null && !Number.isNaN(serverMs)) serverLat.push(serverMs);
      ok++;
    } catch (e) {
      fail++;
    } finally {
      done++;
      if (done % Math.max(10, Math.floor(total / 10)) === 0 || done === total) {
        const elapsed = (Date.now() - wallStart) / 1000;
        const rps = ok / Math.max(elapsed, 0.001);
        console.log(`[${done}/${total}] ok=${ok} fail=${fail} rps=${rps.toFixed(2)} avg_client=${fmt(clientLat.reduce((a,b)=>a+b,0)/Math.max(clientLat.length,1))}ms`);
      }
    }
  }

  async function worker(ix) {
    if (ramp > 0) {
      const delay = (ix * (ramp * 1000)) / Math.max(1, concurrency - 1);
      await sleep(delay);
    }
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const id = nextId++;
      if (id >= total) break;
      await doOne(id);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, (_, ix) => worker(ix)));
  const wallElapsed = (Date.now() - wallStart) / 1000;

  const stats = {
    total, ok, fail, wallElapsed,
    rps: ok / Math.max(wallElapsed, 0.001),
    client: {
      min: clientLat.length ? Math.min(...clientLat) : null,
      p50: percentile(clientLat, 0.50),
      p90: percentile(clientLat, 0.90),
      p95: percentile(clientLat, 0.95),
      p99: percentile(clientLat, 0.99),
      max: clientLat.length ? Math.max(...clientLat) : null,
    },
    server: serverLat.length ? {
      min: Math.min(...serverLat),
      p50: percentile(serverLat, 0.50),
      p90: percentile(serverLat, 0.90),
      p95: percentile(serverLat, 0.95),
      p99: percentile(serverLat, 0.99),
      max: Math.max(...serverLat),
    } : null,
  };

  console.log('\n=== Stress Test Summary ===');
  console.log(`Total: ${stats.total}, OK: ${stats.ok}, Fail: ${stats.fail}`);
  console.log(`Wall time: ${stats.wallElapsed.toFixed(2)}s, Throughput: ${stats.rps.toFixed(2)} req/s`);
  console.log(`Client latency (ms): min=${fmt(stats.client.min)} p50=${fmt(stats.client.p50)} p90=${fmt(stats.client.p90)} p95=${fmt(stats.client.p95)} p99=${fmt(stats.client.p99)} max=${fmt(stats.client.max)}`);
  if (stats.server) {
    console.log(`Server elapsed header (ms): min=${fmt(stats.server.min)} p50=${fmt(stats.server.p50)} p90=${fmt(stats.server.p90)} p95=${fmt(stats.server.p95)} p99=${fmt(stats.server.p99)} max=${fmt(stats.server.max)}`);
  } else {
    console.log('Server elapsed header (ms): N/A');
  }
}

run().catch((e) => {
  console.error(e?.stack || String(e));
  process.exit(1);
});
