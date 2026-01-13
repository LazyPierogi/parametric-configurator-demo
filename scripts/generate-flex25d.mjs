#!/usr/bin/env node
/**
 * Flex 2.5D Pleat Map Generator (Canvas-agnostic, Node only)
 * ----------------------------------------------------------
 * Outputs 4 PNGs:
 *  - pleatRamp_flex.png       (grayscale 0..1, używasz do soft-light/multiply)
 *  - occlusion_flex.png       (grayscale 0..1, szeroka własna „AO”)
 *  - translucency_flex.png    (grayscale 0..1, 1 = więcej światła przez tkaninę)
 *  - normal_flex.png          (RGB, tangent-space normal; Z zrekonstruowany)
 *
 * Idea: proceduralny model fałdy „pinch (header) → belly (body) → fade (bottom)”
 * z wyraźnym „X” w nagłówku: dwa ramiona zbieżne do środka + centralny pinch.
 *
 * Requires: npm i pngjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

// ==================== PARAMETERS ====================
const params = {
  // Texture size (powers of two nie są wymagane)
  W: 1024,
  H: 2048,

  // Pleat layout across X
  pleatsPerWidth: 9,       // ile fałd mieści się na szerokości tekstury
  fullness: 2.1,           // 1.0 = brak marszczenia; 2.0..2.4 = zasłona „pełna”
  foldWidthPx: 130,        // uśredniona szerokość pojedynczej fałdy (wpływa na „brzuch”)

  // Header geometry (górna taśma + strefa X)
  headerPx: 0.12,          // % wysokości H zajęte przez header (0.10..0.16)
  transitionPx: 0.08,      // % wysokości H na wygaszenie efektu X
  xSpreadMax: 0.24,        // jak daleko ramiona X od środka przy samej górze (frakcyjnie pleata)
  xLineSigma: 0.028,       // grubość ramion X (0.02..0.05)
  pinchWidthFrac: 0.22,    // jak wąski centralny pinch u góry względem szerokości fałdy

  // Belly shape (środek fałdy)
  bellySigmaTop: 0.14,     // „promień” brzuszka u góry
  bellySigmaBottom: 0.52,  // i na dole (rośnie z Y)
  bellyStrength: 1.0,      // wpływ brzuszka na rampę/normal

  // Tone shaping
  shadowHeader: 0.65,      // ile cienia w header band
  aoStrength: 0.85,        // siła AO w całym przebiegu
  rampContrast: 1.08,      // globalny kontrast rampy
  rampBias: 0.0,           // lekkie przesunięcie  (-0.05..+0.05)

  // Translucency shaping
  transHeader: 0.05,       // transmisja w headerze (przy szwie praktycznie 0)
  transBelly: 0.55,        // w brzuszku
  transTrough: 0.22,       // między fałdami

  // Normal synthesis
  normalScaleTop: 0.35,
  normalScaleBottom: 1.0,

  // Noise/jitter
  ridgeJitter: 0.012,      // delikatna nieregularność grzbietów
  grain: 0.015             // ziarno tonów
};

// CLI overrides (optional)
process.argv.slice(2).forEach(arg => {
  const m = arg.match(/^--(\w+)=([\w.\-]+)$/);
  if (m) {
    const key = m[1];
    const val = Number.isNaN(Number(m[2])) ? m[2] : Number(m[2]);
    if (key in params) params[key] = val;
  }
});

const outDir = path.resolve(process.cwd(), 'public/textures/canvas/flex25d');
fs.mkdirSync(outDir, { recursive: true });

// ==================== MATH HELPERS ====================
const clamp = (v, a=0, b=1) => Math.max(a, Math.min(b, v));
const lerp  = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);            // smoothstep-like
const gauss = (d, sigma) => Math.exp(-0.5 * (d * d) / (sigma * sigma + 1e-8));
const fract = x => x - Math.floor(x);
const mix   = (a, b, t) => a*(1-t) + b*t;
const linstep = (edge0, edge1, x) => clamp((x - edge0) / (edge1 - edge0), 0, 1);

// periodic distance on [0,1)
const pdist = (a, b) => {
  const d = Math.abs(a - b);
  return Math.min(d, 1 - d);
};

// cheap rng
const rng = (x,y) => {
  const s = Math.sin(x*12.9898 + y*78.233) * 43758.5453;
  return fract(s);
};

// ==================== CORE SHAPES ====================
function headerFactor(v) {
  // v = 0..1 from top; header band + transition fade
  const h = params.headerPx;
  const t = params.transitionPx;
  if (v <= h) return 1.0;
  if (v >= h + t) return 0.0;
  return 1.0 - smooth((v - h) / t);
}

function bellySigma(v) {
  // grows towards bottom
  return lerp(params.bellySigmaTop, params.bellySigmaBottom, smooth(v));
}

function normalScale(v) {
  return lerp(params.normalScaleTop, params.normalScaleBottom, smooth(v));
}

function ridgeCenter(u, pleatIdx) {
  // u in [0,1) across whole width; get center of pleat in same [0,1)
  const p = params.pleatsPerWidth;
  const center = (pleatIdx + 0.5) / p;
  // jitter per column
  const j = (rng(pleatIdx * 3.17, 0.123) - 0.5) * params.ridgeJitter;
  return center + j;
}

function withinPleatPhase(u, pleatIdx) {
  const p = params.pleatsPerWidth;
  const span = 1 / p;
  const origin = pleatIdx / p;
  // local phase in [0,1)
  return (u - origin) / span;
}

function xArmsMask(phase, v, centerPhase) {
  // Two diagonals converging to center at top; spread shrinks with v
  const s = headerFactor(v);
  if (s <= 0) return 0;
  const spread = params.xSpreadMax * s;
  const left  = centerPhase - spread;
  const right = centerPhase + spread;
  const dL = pdist(phase, left);
  const dR = pdist(phase, right);
  const m = gauss(dL, params.xLineSigma) + gauss(dR, params.xLineSigma);
  return m * s; // stronger near the very top
}

function pinchMask(phase, v, centerPhase) {
  // Central narrow pinch at the seam; tighter near top
  const s = headerFactor(v);
  const pinchSigma = lerp(params.pinchWidthFrac * 0.6, params.pinchWidthFrac * 0.25, s);
  const d = pdist(phase, centerPhase);
  return gauss(d, pinchSigma) * s;
}

function bellyMask(phase, v, centerPhase) {
  // Round belly: distance to ridge with sigma growing with v
  const sigma = bellySigma(v);
  const d = pdist(phase, centerPhase);
  // make belly broader with fullness
  const f = clamp(params.fullness * 0.5, 0.6, 1.6);
  return gauss(d * f, sigma);
}

// ==================== FIELD SYNTHESIS ====================
function synthesizeFields() {
  const { W, H, pleatsPerWidth } = params;

  // Allocate buffers
  const ramp = new Float32Array(W * H);
  const ao   = new Float32Array(W * H);
  const trn  = new Float32Array(W * H);
  const nh   = new Float32Array(W * H); // height field for normal map (from belly primarily)

  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);       // 0..1 top->bottom
    const hFac = headerFactor(v);

    for (let x = 0; x < W; x++) {
      const u = x / (W - 1);
      const i = y * W + x;

      // which pleat column
      const pIdx = Math.floor(u * pleatsPerWidth);
      const centerU = ridgeCenter(u, pIdx);
      const phase   = withinPleatPhase(u, pIdx);       // 0..1 within the column
      const centerP = withinPleatPhase(centerU, pIdx); // local center phase

      // Masks
      const mX  = xArmsMask(phase, v, centerP);
      const mP  = pinchMask(phase, v, centerP);
      const mB  = bellyMask(phase, v, centerP);

      // -------- pleat RAMP (grayscale shading) --------
      // base: light belly (highlight), darker troughs, plus header shadow
      let r = 0.5;
      r +=  0.45 * mB;                    // belly highlight
      r -=  params.shadowHeader * hFac;   // header darkening band
      r -=  0.28 * (1 - mB);              // troughs darker
      r +=  0.45 * mX;                    // diagonal arms highlight
      r -=  0.55 * mP;                    // pinch shadow in center
      r +=  (rng(x*0.7, y*1.9) - 0.5) * params.grain;

      r = (r - 0.5) * params.rampContrast + 0.5 + params.rampBias;
      ramp[i] = clamp(r, 0.06, 0.97);

      // -------- Occlusion (broad AO) --------
      let o = 1.0;
      o -= 0.40 * (1 - mB);               // troughs occluded
      o -= 0.22 * mP;                     // central pinch occlusion
      o += 0.08 * mX * (1 - hFac);        // arms slightly lift AO except at very top
      o -= 0.06 * (1 - v);                // mild falloff from top band
      o = 1.0 - (1.0 - o) * params.aoStrength;
      ao[i] = clamp(o, 0.25, 1.0);

      // -------- Translucency (light transmission) --------
      // highest in belly, lowest in header & pinch
      let t = mix(params.transHeader, params.transBelly, smooth(v));
      t = mix(t, params.transTrough, (1 - mB));        // between pleats less transmission
      t -= 0.35 * mP;                                  // pinch closed
      t -= 0.15 * mX * hFac;                           // arms near top reduce transmission
      trn[i] = clamp(t, 0.06, 0.92);

      // -------- Height for normal map --------
      const h = params.bellyStrength * mB - 0.6 * mP + 0.15 * mX * (1 - hFac);
      nh[i] = h;
    }
  }
  return { ramp, ao, trn, nh };
}

function heightToNormal(nh, W, H) {
  const out = new Uint8Array(W * H * 3);
  const sx = 1 / W, sy = 1 / H;

  const get = (x, y) => nh[clamp(y, 0, H-1) * W + clamp(x, 0, W-1)];

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // central differences
      const hL = get(x-1, y), hR = get(x+1, y);
      const hU = get(x, y-1), hD = get(x, y+1);

      const dx = (hR - hL) / (2 * sx);
      const dy = (hD - hU) / (2 * sy);

      // scale with depth varying along v
      const v = y / (H-1);
      const scale = normalScale(v) * 0.75;

      // tangent space normal
      let nx = -dx * scale, ny = -dy * scale, nz = 1.0;
      const invLen = 1.0 / Math.max(Math.hypot(nx, ny, nz), 1e-6);
      nx *= invLen; ny *= invLen; nz *= invLen;

      const i = (y * W + x) * 3;
      out[i+0] = Math.round((nx * 0.5 + 0.5) * 255);
      out[i+1] = Math.round((ny * 0.5 + 0.5) * 255);
      out[i+2] = Math.round((nz * 0.5 + 0.5) * 255);
    }
  }
  return out;
}

function writeGrayPng(name, data, W, H) {
  const png = new PNG({ width: W, height: H, colorType: 0 }); // grayscale
  for (let i = 0; i < W*H; i++) {
    png.data[i] = Math.round(clamp(data[i], 0, 1) * 255);
  }
  png.pack().pipe(fs.createWriteStream(path.join(outDir, name)));
}

function writeRgbPng(name, data, W, H) {
  const png = new PNG({ width: W, height: H });
  for (let i = 0; i < W*H; i++) {
    png.data[i*4+0] = data[i*3+0];
    png.data[i*4+1] = data[i*3+1];
    png.data[i*4+2] = data[i*3+2];
    png.data[i*4+3] = 255;
  }
  png.pack().pipe(fs.createWriteStream(path.join(outDir, name)));
}

// ==================== RUN ====================
(function main(){
  console.log('[flex25d] generating fields…');
  const { W, H } = params;
  const { ramp, ao, trn, nh } = synthesizeFields();
  console.log('[flex25d] converting normals…');
  const normal = heightToNormal(nh, W, H);
  console.log('[flex25d] writing PNGs…', outDir);

  writeGrayPng('pleatRamp_flex.png', ramp, W, H);
  writeGrayPng('occlusion_flex.png', ao, W, H);
  writeGrayPng('translucency_flex.png', trn, W, H);
  writeRgbPng('normal_flex.png', normal, W, H);

  console.log('[flex25d] done ✔');
})();