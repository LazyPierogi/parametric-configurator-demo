#!/usr/bin/env node
/**
 * Generate placeholder Canvas rendering textures
 * Task 1010+ - Canvas-based curtain rendering system
 * 
 * Generates 12 textures: 3 pleats × 4 asset types
 * - pleatRamp.png: grayscale vertical ramp simulating pleat shadows (512×2048)
 * - weaveDetail.png: tileable fabric weave pattern (256×256)
 * - translucencyMask.png: transmission mask for sheer fabrics (512×2048)
 * - occlusion.png: soft ambient occlusion multiplier (512×2048)
 * 
 * Usage: node scripts/generate-canvas-textures.mjs
 */

import { createCanvas } from 'canvas';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OUTPUT_DIR = join(__dirname, '../public/textures/canvas');
const PLEATS = ['wave', 'flex', 'doubleFlex'];

// Asset specifications
const ASSETS = {
  pleatRamp: { width: 512, height: 2048, description: 'Vertical pleat shadow ramp' },
  weaveDetail: { width: 256, height: 256, description: 'Tileable weave pattern' },
  translucencyMask: { width: 512, height: 2048, description: 'Transmission mask for sheers' },
  occlusion: { width: 512, height: 2048, description: 'Ambient occlusion' }
};

/**
 * Generate pleatRamp: vertical gradient simulating pleat shadows
 * Different wave patterns per pleat type
 */
function generatePleatRamp(pleat, width, height) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Fill with mid-gray base
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, width, height);
  
  // Create vertical wave pattern based on pleat type
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  // Pleat-specific parameters
  const params = {
    wave: { frequency: 8, amplitude: 0.35, offset: 0 },
    flex: { frequency: 6, amplitude: 0.28, offset: Math.PI / 4 },
    doubleFlex: { frequency: 12, amplitude: 0.42, offset: Math.PI / 6 }
  };
  
  const { frequency, amplitude, offset } = params[pleat];
  
  for (let y = 0; y < height; y++) {
    // Create sinusoidal wave along height
    const phase = (y / height) * Math.PI * 2 * frequency + offset;
    const wave = Math.sin(phase) * amplitude;
    
    // Base luminance (0.3 to 0.9 range)
    const baseLum = 0.5 + wave;
    const value = Math.floor(baseLum * 255);
    
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      data[idx] = value;     // R
      data[idx + 1] = value; // G
      data[idx + 2] = value; // B
      data[idx + 3] = 255;   // A
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Generate weaveDetail: tileable fabric texture
 * Simple cross-hatch pattern simulating weave
 */
function generateWeaveDetail(pleat, width, height) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Neutral mid-gray base
  ctx.fillStyle = '#7F7F7F';
  ctx.fillRect(0, 0, width, height);
  
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  // Create subtle weave pattern
  const threadSize = pleat === 'doubleFlex' ? 4 : 3;
  const weaveContrast = 0.08; // Subtle
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      
      // Checkerboard weave
      const warpThread = Math.floor(x / threadSize) % 2;
      const weftThread = Math.floor(y / threadSize) % 2;
      const weaveValue = (warpThread + weftThread) % 2 === 0 ? 1 : -1;
      
      const baseLum = 0.5 + weaveValue * weaveContrast;
      const value = Math.floor(baseLum * 255);
      
      data[idx] = value;
      data[idx + 1] = value;
      data[idx + 2] = value;
      data[idx + 3] = 255;
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Generate translucencyMask: transmission map for sheer fabrics
 * Darker where fabric is thicker (pleat folds)
 */
function generateTranslucencyMask(pleat, width, height) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Base transmission (lighter = more translucent)
  ctx.fillStyle = '#AAAAAA';
  ctx.fillRect(0, 0, width, height);
  
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  // Pleat-specific transmission variation
  const params = {
    wave: { frequency: 8, minTrans: 0.5, maxTrans: 0.85 },
    flex: { frequency: 6, minTrans: 0.45, maxTrans: 0.8 },
    doubleFlex: { frequency: 12, minTrans: 0.4, maxTrans: 0.75 }
  };
  
  const { frequency, minTrans, maxTrans } = params[pleat];
  
  for (let y = 0; y < height; y++) {
    const phase = (y / height) * Math.PI * 2 * frequency;
    const wave = (Math.sin(phase) + 1) / 2; // Normalize to 0-1
    const transmission = minTrans + wave * (maxTrans - minTrans);
    const value = Math.floor(transmission * 255);
    
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      data[idx] = value;
      data[idx + 1] = value;
      data[idx + 2] = value;
      data[idx + 3] = 255;
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Generate occlusion: soft ambient occlusion
 * Slightly darker in pleat folds
 */
function generateOcclusion(pleat, width, height) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Light base (occlusion is multiplicative, so bright = no occlusion)
  ctx.fillStyle = '#E0E0E0';
  ctx.fillRect(0, 0, width, height);
  
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  const params = {
    wave: { frequency: 8, aoStrength: 0.15 },
    flex: { frequency: 6, aoStrength: 0.18 },
    doubleFlex: { frequency: 12, aoStrength: 0.22 }
  };
  
  const { frequency, aoStrength } = params[pleat];
  
  for (let y = 0; y < height; y++) {
    const phase = (y / height) * Math.PI * 2 * frequency;
    const wave = Math.sin(phase); // -1 to 1
    // AO in valleys (negative wave)
    const ao = wave < 0 ? (1 - Math.abs(wave) * aoStrength) : 1.0;
    const value = Math.floor(ao * 255);
    
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      data[idx] = value;
      data[idx + 1] = value;
      data[idx + 2] = value;
      data[idx + 3] = 255;
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

// Generator map
const GENERATORS = {
  pleatRamp: generatePleatRamp,
  weaveDetail: generateWeaveDetail,
  translucencyMask: generateTranslucencyMask,
  occlusion: generateOcclusion
};

/**
 * Main generation loop
 */
function main() {
  console.log('🎨 Generating Canvas rendering textures...\n');
  
  let totalGenerated = 0;
  
  for (const pleat of PLEATS) {
    const pleatDir = join(OUTPUT_DIR, pleat);
    mkdirSync(pleatDir, { recursive: true });
    
    console.log(`📁 Pleat: ${pleat}`);
    
    for (const [assetName, spec] of Object.entries(ASSETS)) {
      const generator = GENERATORS[assetName];
      const canvas = generator(pleat, spec.width, spec.height);
      const buffer = canvas.toBuffer('image/png');
      
      const filename = `${assetName}.png`;
      const filepath = join(pleatDir, filename);
      writeFileSync(filepath, buffer);
      
      console.log(`  ✓ ${filename} (${spec.width}×${spec.height}) - ${spec.description}`);
      totalGenerated++;
    }
    
    console.log('');
  }
  
  console.log(`✅ Generated ${totalGenerated} textures in ${OUTPUT_DIR}`);
  console.log('\nNext steps:');
  console.log('1. Review generated textures in /public/textures/canvas/');
  console.log('2. Replace placeholders with production-quality assets');
  console.log('3. Ensure textures are seamless (especially weaveDetail)');
}

main();
