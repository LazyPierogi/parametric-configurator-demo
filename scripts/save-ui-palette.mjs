#!/usr/bin/env node
/**
 * Save global UI palette to public/config/wall-box-pallette.json
 * Usage examples:
 *   node scripts/save-ui-palette.mjs --handleBg=#f2f2f2 --borderHex=#666 --borderOpacity=0.2 --handleOpacity=0.9 \
 *     --ringHex=#000 --ringOpacity=0.25 --wallStroke=#e5e7eb --wallStrokeOpacity=0.8
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const target = path.join(root, 'public', 'config', 'wall-box-pallette.json');

const argv = process.argv.slice(2);
const args = {};
for (const arg of argv) {
  const m = arg.match(/^--([^=]+)=(.*)$/);
  if (m) args[m[1]] = m[2];
}

const clamp01 = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(0, Math.min(1, n));
};
const normHex = (v) => {
  if (typeof v !== 'string' || !v) return undefined;
  let s = v.trim();
  if (!s.startsWith('#')) s = `#${s}`;
  // Basic sanity: #RGB or #RRGGBB
  if (![4, 7].includes(s.length)) return s; // don't over-validate
  return s;
};

let existing = {
  handleBg: '#e5e7eb',
  borderHex: '#000000',
  borderOpacity: 0.15,
  handleOpacity: 1,
  ringHex: '#000000',
  ringOpacity: 0.28,
  wallStroke: '#e5e7eb',
  wallStrokeOpacity: 1,
};
try {
  if (fs.existsSync(target)) {
    const raw = fs.readFileSync(target, 'utf8');
    const parsed = JSON.parse(raw);
    existing = { ...existing, ...parsed };
  } else {
    const dir = path.dirname(target);
    fs.mkdirSync(dir, { recursive: true });
  }
} catch (err) {
  console.error('[save-ui-palette] Failed to read current palette:', err);
}

const next = { ...existing };
if (args.handleBg != null) next.handleBg = normHex(args.handleBg) ?? next.handleBg;
if (args.borderHex != null) next.borderHex = normHex(args.borderHex) ?? next.borderHex;
if (args.borderOpacity != null) next.borderOpacity = clamp01(args.borderOpacity) ?? next.borderOpacity;
if (args.handleOpacity != null) next.handleOpacity = clamp01(args.handleOpacity) ?? next.handleOpacity;
if (args.ringHex != null) next.ringHex = normHex(args.ringHex) ?? next.ringHex;
if (args.ringOpacity != null) next.ringOpacity = clamp01(args.ringOpacity) ?? next.ringOpacity;
if (args.wallStroke != null) next.wallStroke = normHex(args.wallStroke) ?? next.wallStroke;
if (args.wallStrokeOpacity != null) next.wallStrokeOpacity = clamp01(args.wallStrokeOpacity) ?? next.wallStrokeOpacity;

try {
  fs.writeFileSync(target, JSON.stringify(next, null, 2) + '\n', 'utf8');
  console.log('[save-ui-palette] Wrote', target);
  console.log(next);
} catch (err) {
  console.error('[save-ui-palette] Failed to write palette:', err);
  process.exitCode = 1;
}
