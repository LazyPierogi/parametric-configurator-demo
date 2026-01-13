#!/usr/bin/env node
/**
 * Flex Pleat Texture Generator (2.5D)
 *
 * Builds Flex pleat maps by modelling the fold as a parametric 2.5D shape:
 * - Header pinch (X) + spreading belly
 * - Outputs tone ramp, ambient occlusion, translucency, and a helper normal map
 *
 * Usage: node scripts/generate-flex-textures.mjs
 */

import { createCanvas } from 'canvas';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OUTPUT_DIR = join(__dirname, '../public/textures/canvas/flex');

const CONFIG = {
  width: 512,
  height: 2048,
  pleatsPerTile: 10,

  headerDrop: 0.12,
  headerPower: 1.2,
  pinchWidthTop: 0.24,
  pinchWidthBottom: 0.38,
  pinchSharpness: 2.6,

  diagSpread: 0.32,
  diagWidth: 0.14,
  diagPower: 1.15,
  diagGainRamp: 0.14,
  diagGainAO: 0.06,
  diagLossTrans: 0.18,

  bellyStart: 0.16,
  bellySigmaTop: 0.24,
  bellySigmaBottom: 0.46,
  bellySigmaCurve: 1.15,
  valleyPower: 1.7,

  rampBase: 0.45,
  rampCenterGain: 0.38,
  rampCenterPower: 1.25,
  rampValleyShadow: 0.34,
  rampValleyPower: 1.55,
  rampPinchHighlight: 0.22,
  rampHeaderShade: 0.08,
  rampBodyLift: 0.04,
  noiseRamp: 0.015,

  aoBase: 0.18,
  aoPinch: 0.52,
  aoPinchPower: 1.4,
  aoValley: 0.33,
  aoValleyPower: 1.6,
  aoBellyLift: 0.08,
  aoDiagLift: 0.05,
  aoMin: 0.18,
  noiseAO: 0.012,

  transHeader: 0.05,
  transBody: 0.64,
  transBodyPower: 1.1,
  transBellyBoost: 0.28,
  transBellyPower: 1.35,
  transPinchLoss: 0.42,
  transPinchPower: 1.1,
  transValleyLoss: 0.18,
  transValleyPower: 1.5,
  transMin: 0.04,
  transMax: 0.85,
  noiseTrans: 0.01,

  normalStrengthVertical: 3.4,
  normalStrengthHorizontal: 7.5,
};

// ---------------------------------------------------------------------------
// helpers
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};
const gaussian = (x, sigma) => Math.exp(-0.5 * (x / sigma) ** 2);
const fract = (n) => n - Math.floor(n);
const pseudoRandom = (x, y) => {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return fract(s);
};

// ---------------------------------------------------------------------------
function evaluateFlex(heightRatio, pleatCoord) {
  const u = fract(pleatCoord) - 0.5; // [-0.5, 0.5]
  const uNorm = u / 0.5; // [-1, 1]
  const absNorm = Math.abs(uNorm);

  const headerStrength = heightRatio < CONFIG.headerDrop
    ? Math.pow(1 - heightRatio / CONFIG.headerDrop, CONFIG.headerPower)
    : 0;
  const bodyProgress = smoothstep(CONFIG.bellyStart, 1.0, heightRatio);

  const pinchWidth = lerp(CONFIG.pinchWidthBottom, CONFIG.pinchWidthTop, headerStrength);
  const pinchRaw = clamp(1 - absNorm / pinchWidth, 0, 1);
  const pinch = headerStrength > 0
    ? Math.pow(pinchRaw, CONFIG.pinchSharpness) * headerStrength
    : 0;

  const diagSpread = CONFIG.diagSpread * (1 - headerStrength);
  const diagSigma = CONFIG.diagWidth * (0.45 + 0.55 * headerStrength);
  const diagLeft = gaussian(uNorm + diagSpread, diagSigma);
  const diagRight = gaussian(uNorm - diagSpread, diagSigma);
  const diag = headerStrength > 0
    ? Math.pow(diagLeft + diagRight, CONFIG.diagPower) * headerStrength
    : 0;

  const sigma = lerp(
    CONFIG.bellySigmaTop,
    CONFIG.bellySigmaBottom,
    Math.pow(bodyProgress, CONFIG.bellySigmaCurve)
  );
  const belly = gaussian(uNorm, sigma);
  const valley = Math.pow(clamp(1 - belly, 0, 1), CONFIG.valleyPower);

  const heightField = clamp(
    belly * (0.55 + 0.35 * bodyProgress) - pinch * 0.28 + diag * 0.08,
    0,
    1
  );

  let ramp = CONFIG.rampBase;
  ramp += CONFIG.rampCenterGain * Math.pow(belly, CONFIG.rampCenterPower);
  ramp -= CONFIG.rampValleyShadow * Math.pow(valley, CONFIG.rampValleyPower);
  ramp += CONFIG.rampPinchHighlight * pinch;
  ramp += CONFIG.diagGainRamp * diag;
  ramp -= CONFIG.rampHeaderShade * headerStrength;
  ramp += CONFIG.rampBodyLift * bodyProgress;
  ramp = clamp(ramp, 0, 1);

  let occlusion = 1 - CONFIG.aoBase;
  occlusion -= CONFIG.aoPinch * Math.pow(pinch, CONFIG.aoPinchPower);
  occlusion -= CONFIG.aoValley * Math.pow(valley, CONFIG.aoValleyPower);
  occlusion += CONFIG.aoBellyLift * Math.pow(belly, 1.2);
  occlusion += CONFIG.aoDiagLift * diag;
  occlusion = clamp(occlusion, CONFIG.aoMin, 1);

  const transBody = lerp(
    CONFIG.transHeader,
    CONFIG.transBody,
    Math.pow(bodyProgress, CONFIG.transBodyPower)
  );
  let translucency = transBody;
  translucency += CONFIG.transBellyBoost * Math.pow(belly, CONFIG.transBellyPower);
  translucency -= CONFIG.transPinchLoss * Math.pow(pinch, CONFIG.transPinchPower);
  translucency -= CONFIG.transValleyLoss * Math.pow(valley, CONFIG.transValleyPower);
  translucency -= CONFIG.diagLossTrans * diag;
  translucency = clamp(translucency, CONFIG.transMin, CONFIG.transMax);

  return { ramp, occlusion, translucency, height: heightField, belly, pinch, diag };
}

// ---------------------------------------------------------------------------
function generateMaps() {
  const { width, height } = CONFIG;
  const total = width * height;

  const rampBuffer = new Float32Array(total);
  const aoBuffer = new Float32Array(total);
  const transBuffer = new Float32Array(total);
  const heightBuffer = new Float32Array(total);

  for (let x = 0; x < width; x++) {
    const heightRatio = x / (width - 1);
    for (let y = 0; y < height; y++) {
      const pleatCoord = (y / height) * CONFIG.pleatsPerTile;
      const sample = evaluateFlex(heightRatio, pleatCoord);
      const idx = y * width + x;

      const noiseSeed = pseudoRandom(idx, sample.belly);
      const rampNoise = (noiseSeed - 0.5) * CONFIG.noiseRamp;
      const aoNoise = (pseudoRandom(idx + 19.3, sample.diag) - 0.5) * CONFIG.noiseAO;
      const transNoise = (pseudoRandom(idx + 73.1, sample.pinch) - 0.5) * CONFIG.noiseTrans;

      rampBuffer[idx] = clamp(sample.ramp + rampNoise, 0, 1);
      aoBuffer[idx] = clamp(sample.occlusion + aoNoise, 0, 1);
      transBuffer[idx] = clamp(sample.translucency + transNoise, 0, 1);
      heightBuffer[idx] = sample.height;
    }
  }

  return { rampBuffer, aoBuffer, transBuffer, heightBuffer };
}

function bufferToCanvas(buffer, width, height) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(width, height);
  for (let i = 0; i < buffer.length; i++) {
    const value = clamp(buffer[i], 0, 1) * 255;
    const idx = i * 4;
    imageData.data[idx] = value;
    imageData.data[idx + 1] = value;
    imageData.data[idx + 2] = value;
    imageData.data[idx + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function makeNormalMap(heightBuffer, width, height) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;

  const sx = CONFIG.normalStrengthVertical;
  const sy = CONFIG.normalStrengthHorizontal;

  for (let y = 0; y < height; y++) {
    const yPrev = (y - 1 + height) % height;
    const yNext = (y + 1) % height;
    for (let x = 0; x < width; x++) {
      const xPrev = Math.max(x - 1, 0);
      const xNext = Math.min(x + 1, width - 1);

      const idx = y * width + x;
      const idxXPrev = y * width + xPrev;
      const idxXNext = y * width + xNext;
      const idxYPrev = yPrev * width + x;
      const idxYNext = yNext * width + x;

      const dhdx = (heightBuffer[idxXNext] - heightBuffer[idxXPrev]) * sx;
      const dhdy = (heightBuffer[idxYNext] - heightBuffer[idxYPrev]) * sy;

      const nx = -dhdx;
      const ny = 1;
      const nz = -dhdy;
      const invLen = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);

      const r = clamp(nx * invLen * 0.5 + 0.5, 0, 1) * 255;
      const g = clamp(ny * invLen * 0.5 + 0.5, 0, 1) * 255;
      const b = clamp(nz * invLen * 0.5 + 0.5, 0, 1) * 255;

      const ptr = idx * 4;
      data[ptr] = r;
      data[ptr + 1] = g;
      data[ptr + 2] = b;
      data[ptr + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function writeOutputs({ rampBuffer, aoBuffer, transBuffer, heightBuffer }) {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const ramp = bufferToCanvas(rampBuffer, CONFIG.width, CONFIG.height);
  const ao = bufferToCanvas(aoBuffer, CONFIG.width, CONFIG.height);
  const trans = bufferToCanvas(transBuffer, CONFIG.width, CONFIG.height);
  const normal = makeNormalMap(heightBuffer, CONFIG.width, CONFIG.height);

  const files = [
    { canvas: ramp, name: 'pleatRamp.png', desc: 'tone ramp (pinch + belly)' },
    { canvas: ao, name: 'occlusion.png', desc: 'ambient occlusion (pinch wedges)' },
    { canvas: trans, name: 'translucencyMask.png', desc: 'transmission map (belly bloom)' },
    { canvas: normal, name: 'normal.png', desc: 'helper normal map from height field' },
  ];

  files.forEach(({ canvas, name, desc }) => {
    writeFileSync(join(OUTPUT_DIR, name), canvas.toBuffer('image/png'));
    console.log(`✓ ${name} (${CONFIG.width}×${CONFIG.height}) — ${desc}`);
  });
}

function main() {
  console.log('🎨 Generating Flex pleat maps (2.5D model)...\n');
  const buffers = generateMaps();
  writeOutputs(buffers);
  console.log('\nFlex features modelled:');
  console.log('  • Header pinch forms an explicit X');
  console.log('  • Belly bloom deepens towards the hem');
  console.log('  • Independent AO / translucency response');
  console.log('  • Helper normal map derived from height field');
}

main();
