#!/usr/bin/env node
/**
 * Generate Mock Artist Textures
 * Creates placeholder PNG maps for artist pipeline testing
 * 
 * Output: 4 families × 4 maps = 16 files
 * - wave-drape, wave-sheer, flex, double-flex
 * - pleatRamp, occlusion, translucency, normal
 */

import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '../public/textures/canvas');

const WIDTH = 1024;
const HEIGHT = 2048;

const FAMILIES = {
  'wave-drape': {
    pleats: 9,
    rampStyle: 'soft-wave',
    translucency: 0.2,
  },
  'wave-sheer': {
    pleats: 9,
    rampStyle: 'soft-wave',
    translucency: 0.7,
  },
  'flex': {
    pleats: 9,
    rampStyle: 'x-pinch',
    translucency: 0.3,
  },
  'double-flex': {
    pleats: 17,
    rampStyle: 'dense',
    translucency: 0.1,
  },
};

function createDirectory(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✓ Created: ${dir}`);
  }
}

function generatePleatRamp(spec) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  
  const pleatWidth = WIDTH / spec.pleats;
  
  for (let x = 0; x < WIDTH; x++) {
    const pleatPos = (x % pleatWidth) / pleatWidth;
    let intensity;
    
    if (spec.rampStyle === 'soft-wave') {
      // Sinusoidal wave
      intensity = (Math.sin(pleatPos * Math.PI * 2 - Math.PI / 2) + 1) / 2;
      intensity = 0.2 + intensity * 0.6; // Range 0.2-0.8
    } else if (spec.rampStyle === 'x-pinch') {
      // Sharp X pattern
      if (pleatPos < 0.15) {
        intensity = 0.15 + pleatPos * 3;
      } else if (pleatPos < 0.25) {
        intensity = 0.9 - (pleatPos - 0.15) * 4;
      } else {
        intensity = 0.5 + Math.sin((pleatPos - 0.25) * Math.PI * 2) * 0.3;
      }
    } else {
      // Dense uniform
      intensity = (Math.sin(pleatPos * Math.PI * 2) + 1) / 2;
      intensity = 0.3 + intensity * 0.4;
    }
    
    // Vertical gradient (header darker)
    for (let y = 0; y < HEIGHT; y++) {
      const headerFade = Math.min(1, y / (HEIGHT * 0.15));
      const finalIntensity = intensity * (0.7 + headerFade * 0.3);
      const value = Math.round(finalIntensity * 255);
      
      ctx.fillStyle = `rgb(${value},${value},${value})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  
  return canvas;
}

function generateOcclusion(spec) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  
  const pleatWidth = WIDTH / spec.pleats;
  
  for (let x = 0; x < WIDTH; x++) {
    const pleatPos = (x % pleatWidth) / pleatWidth;
    
    // AO is darkest in troughs
    let ao;
    if (spec.rampStyle === 'x-pinch') {
      ao = pleatPos < 0.2 ? 0.3 + pleatPos * 2 : 0.7 + Math.sin(pleatPos * Math.PI * 2) * 0.2;
    } else if (spec.rampStyle === 'dense') {
      ao = 0.5 + Math.sin(pleatPos * Math.PI * 2) * 0.3;
    } else {
      ao = 0.6 + Math.sin(pleatPos * Math.PI * 2) * 0.3;
    }
    
    for (let y = 0; y < HEIGHT; y++) {
      const value = Math.round(ao * 255);
      ctx.fillStyle = `rgb(${value},${value},${value})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  
  return canvas;
}

function generateTranslucency(spec) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  
  const baseTransmission = spec.translucency;
  const pleatWidth = WIDTH / spec.pleats;
  
  for (let x = 0; x < WIDTH; x++) {
    const pleatPos = (x % pleatWidth) / pleatWidth;
    
    // Transmission varies with fold depth
    const depthMod = Math.sin(pleatPos * Math.PI * 2) * 0.3;
    const transmission = baseTransmission + depthMod * (1 - baseTransmission);
    
    for (let y = 0; y < HEIGHT; y++) {
      const value = Math.round(transmission * 255);
      ctx.fillStyle = `rgb(${value},${value},${value})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  
  return canvas;
}

function generateNormal(spec) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  
  const pleatWidth = WIDTH / spec.pleats;
  
  for (let x = 0; x < WIDTH; x++) {
    const pleatPos = (x % pleatWidth) / pleatWidth;
    
    // Normal map encodes surface orientation
    // X = red (left-right), Y = green (up-down), Z = blue (out)
    const angle = pleatPos * Math.PI * 2;
    
    let nx, ny, nz;
    if (spec.rampStyle === 'x-pinch') {
      // Sharp diagonals in header
      nx = Math.cos(angle) * 0.7;
      ny = 0.1;
      nz = Math.sqrt(1 - nx * nx - ny * ny);
    } else {
      // Smooth curves
      nx = Math.cos(angle) * 0.5;
      ny = 0.0;
      nz = Math.sqrt(1 - nx * nx - ny * ny);
    }
    
    // Encode to RGB (tangent space: -1..1 -> 0..255)
    const r = Math.round((nx + 1) * 127.5);
    const g = Math.round((ny + 1) * 127.5);
    const b = Math.round((nz + 1) * 127.5);
    
    for (let y = 0; y < HEIGHT; y++) {
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  
  return canvas;
}

function saveCanvas(canvas, filepath) {
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(filepath, buffer);
  const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
  console.log(`  ✓ ${path.basename(filepath)} (${sizeMB} MB)`);
}

console.log('🎨 Generating Mock Artist Textures...\n');

for (const [family, spec] of Object.entries(FAMILIES)) {
  const familyDir = path.join(OUTPUT_DIR, family);
  createDirectory(familyDir);
  
  console.log(`\n📁 ${family} (${spec.pleats} pleats, ${spec.rampStyle})`);
  
  const pleatRamp = generatePleatRamp(spec);
  saveCanvas(pleatRamp, path.join(familyDir, 'pleatRamp.png'));
  
  const occlusion = generateOcclusion(spec);
  saveCanvas(occlusion, path.join(familyDir, 'occlusion.png'));
  
  const translucency = generateTranslucency(spec);
  saveCanvas(translucency, path.join(familyDir, 'translucency.png'));
  
  const normal = generateNormal(spec);
  saveCanvas(normal, path.join(familyDir, 'normal.png'));
}

console.log('\n✅ Mock textures generated successfully!');
console.log(`\n📦 Output: ${OUTPUT_DIR}/`);
console.log('   - wave-drape/    (4 maps)');
console.log('   - wave-sheer/    (4 maps)');
console.log('   - flex/          (4 maps)');
console.log('   - double-flex/   (4 maps)');
console.log('\n💡 Set NEXT_PUBLIC_EXPERIMENTAL_TEXTURES=artist to test!\n');
