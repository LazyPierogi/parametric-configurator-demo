/**
 * Pleat sampling utilities shared across canvas pipelines.
 */

const TWO_PI = Math.PI * 2;
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export function wrap01(value: number): number {
  const wrapped = value % 1;
  return wrapped < 0 ? wrapped + 1 : wrapped;
}

const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);

const pseudoRandom = (i: number, j: number): number => {
  const s = Math.sin(i * 157.31 + j * 47.63) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1; // -1..1
};

type PleatSeed = {
  offset: number;
  phase: number;
  amplitude: number;
  diagonalTilt: number;
  waveTightness: number;
  gatherVariance: number;
};

const pleatSeedCache = new Map<number, PleatSeed>();

function getPleatSeed(pleatIndex: number): PleatSeed {
  let cached = pleatSeedCache.get(pleatIndex);
  if (cached) return cached;

  const offset = pseudoRandom(pleatIndex, 23) * 0.5; // keeps neighbouring pleats coherent
  const phase = pseudoRandom(pleatIndex, -17) * TWO_PI;
  const amplitude = 1 + pseudoRandom(pleatIndex, 91) * 0.35;
  const diagonalTilt = pseudoRandom(pleatIndex, 137) * 0.6;
  const waveTightness = 0.85 + pseudoRandom(pleatIndex, 211) * 0.25;
  const gatherVariance = pseudoRandom(pleatIndex, 311) * 0.2;

  const seed: PleatSeed = {
    offset,
    phase,
    amplitude,
    diagonalTilt,
    waveTightness,
    gatherVariance,
  };

  pleatSeedCache.set(pleatIndex, seed);
  return seed;
}

const valueNoise2D = (x: number, y: number): number => {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;

  const v00 = pseudoRandom(ix, iy);
  const v10 = pseudoRandom(ix + 1, iy);
  const v01 = pseudoRandom(ix, iy + 1);
  const v11 = pseudoRandom(ix + 1, iy + 1);

  const wx = fade(fx);
  const wy = fade(fy);

  const xa = v00 + wx * (v10 - v00);
  const xb = v01 + wx * (v11 - v01);

  return xa + wy * (xb - xa);
};

const fbm = (x: number, y: number): number => {
  let value = 0;
  let amplitude = 0.6;
  let frequency = 1;

  for (let i = 0; i < 3; i += 1) {
    value += valueNoise2D(x * frequency, y * frequency) * amplitude;
    frequency *= 2;
    amplitude *= 0.55;
  }

  return value;
};

function computePleatJitter(
  baseNormalized: number,
  crossAxis: number,
  seed: PleatSeed,
  strength: number,
  taperStrength: number
): number {
  if (strength <= 0) return 0;

  const basePhase = baseNormalized * TWO_PI;
  const crossPhase = crossAxis * TWO_PI;

  const edgeAmount = Math.min(baseNormalized, 1 - baseNormalized);
  const edgeFalloff = Math.pow(edgeAmount * 2, 1.25);
  const crossAxis01 = clamp01(crossAxis);

  const warp = fbm(
    baseNormalized * (2.2 + seed.waveTightness * 0.3) + crossAxis * 0.9 + seed.offset * 0.6,
    crossAxis * 1.8 + baseNormalized * 0.5 + seed.offset * 0.4
  ) * 0.6;

  const flow = fbm(
    baseNormalized * 3.4 + crossAxis * (1.4 + seed.diagonalTilt * 0.4),
    crossAxis * 5.2 + baseNormalized * 0.7 + seed.offset * 1.3
  );

  const gentleSweep =
    Math.sin(
      basePhase * (0.6 + seed.waveTightness * 0.3) +
        crossPhase * 0.22 +
        warp * 1.8 +
        seed.phase
    ) *
    (0.55 + seed.amplitude * 0.25);

  const diagonalSweep = Math.sin(
    basePhase * 1.45 - crossPhase * (0.4 + seed.diagonalTilt * 0.2) + flow * 1.3
  ) * 0.28;

  const meander = flow * 0.25 + warp * 0.18;
  const microRipple = Math.sin(basePhase * 2.6 + warp * 0.9 + seed.phase * 0.4) * 0.16;

  const combined = gentleSweep * 0.52 + diagonalSweep * 0.35 + meander + microRipple;

  const headerClamp = lerp(0.22, 0.38, 1 - Math.min(1, taperStrength));
  const headerEase = headerClamp + (1 - headerClamp) * Math.pow(crossAxis01, 0.75);
  const hemRelax = 1 + taperStrength * Math.pow(crossAxis01, 1.9) * 0.35;
  const verticalTaper = Math.max(0.18, headerEase) * hemRelax;

  return strength * edgeFalloff * combined * verticalTaper * 0.32;
}

function computePleatGather(
  baseNormalized: number,
  crossAxis: number,
  seed: PleatSeed,
  taperStrength: number
): number {
  if (taperStrength <= 0) return 0;

  const crossAxis01 = clamp01(crossAxis);
  const gatherCurve = taperStrength * Math.pow(1 - crossAxis01, 1.45) * 0.35;
  const relaxCurve = taperStrength * Math.pow(crossAxis01, 2.1) * 0.18;
  const centerBias = (0.5 - baseNormalized) * gatherCurve;
  const relaxedSpread = (baseNormalized - 0.5) * relaxCurve;
  const pleatVariance = seed.gatherVariance * gatherCurve;

  return centerBias + relaxedSpread + pleatVariance;
}

export type PleatSampleGrid = {
  pleatCoords: Float32Array;
  crossAxisValues: Float32Array;
};

export type PleatTextureOrientation = 'transposed' | 'natural';

export function mapPleatUV(
  orientation: PleatTextureOrientation,
  crossAxis: number,
  pleatCoord: number
): { u: number; v: number } {
  if (orientation === 'natural') {
    return { u: pleatCoord, v: crossAxis };
  }
  return { u: crossAxis, v: pleatCoord };
}

export function computePleatSampleGrid(
  width: number,
  height: number,
  textureScale: number,
  flipTexture: boolean,
  pleatJitterStrength: number,
  pleatTaperStrength: number
): PleatSampleGrid {
  const total = width * height;
  const pleatCoords = new Float32Array(total);
  const crossAxisValues = new Float32Array(total);
  const invWidth = width > 0 ? 1 / width : 0;
  const invHeight = height > 0 ? 1 / height : 0;
  const clampedTile = Math.max(1, textureScale);
  const invTile = 1 / clampedTile;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      const idx = rowOffset + x;
      const crossAxis = flipTexture ? x * invWidth : y * invHeight;
      const pleatBase = flipTexture ? y * invTile : x * invTile;
      const pleatIndex = Math.floor(pleatBase);
      const baseNormalized = pleatBase - pleatIndex;
      const seed = getPleatSeed(pleatIndex);
      const gather = computePleatGather(baseNormalized, crossAxis, seed, pleatTaperStrength);
      const jitter = computePleatJitter(
        baseNormalized,
        crossAxis,
        seed,
        pleatJitterStrength,
        pleatTaperStrength
      );

      pleatCoords[idx] = wrap01(pleatBase + gather + jitter);
      crossAxisValues[idx] = crossAxis;
    }
  }

  return { pleatCoords, crossAxisValues };
}

export function getPleatSampleCoords(
  x: number,
  y: number,
  invWidth: number,
  invHeight: number,
  tile: number,
  flipTexture: boolean,
  pleatJitterStrength: number,
  pleatTaperStrength: number
): { pleatCoord: number; crossAxis: number } {
  const clampedTile = Math.max(1, tile);
  const invTile = 1 / clampedTile;

  const crossAxis = flipTexture ? x * invWidth : y * invHeight;
  const pleatBase = flipTexture ? y * invTile : x * invTile;
  const pleatIndex = Math.floor(pleatBase);
  const baseNormalized = pleatBase - pleatIndex;
  const seed = getPleatSeed(pleatIndex);
  const gather = computePleatGather(baseNormalized, crossAxis, seed, pleatTaperStrength);
  const jitter = computePleatJitter(
    baseNormalized,
    crossAxis,
    seed,
    pleatJitterStrength,
    pleatTaperStrength
  );

  const pleatCoord = wrap01(pleatBase + gather + jitter);

  return { pleatCoord, crossAxis };
}
