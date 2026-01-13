#!/usr/bin/env node
/**
 * Quick test to verify MEASURE_LONG_SIDE resizing is working
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const file = process.argv[2] || 'public/originals/sciana.jpg';
const provider = process.argv[3] || 'googleai';

console.log(`\n=== Testing Measurement Resize ===`);
console.log(`File: ${file}`);
console.log(`Provider: ${provider}\n`);

try {
  const imageBuffer = readFileSync(file);
  const base64 = imageBuffer.toString('base64');
  const mime = file.endsWith('.heic') || file.endsWith('.HEIC') ? 'image/heic' : 'image/jpeg';
  const dataUri = `data:${mime};base64,${base64}`;

  console.log(`Original file size: ${(imageBuffer.length / 1024).toFixed(1)} KB`);
  console.log(`Making request to /api/measure...\n`);

  const startTime = Date.now();
  
  const response = await fetch('http://localhost:3010/api/measure', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      photoDataUri: dataUri,
      provider: provider
    })
  });

  const elapsed = Date.now() - startTime;
  const result = await response.json();

  if (response.ok) {
    console.log(`✓ Success in ${(elapsed / 1000).toFixed(2)}s`);
    console.log(`Wall dimensions: ${result.wallWidthCm}cm × ${result.wallHeightCm}cm`);
    if (result.confidencePct) {
      console.log(`Confidence: ${result.confidencePct}%`);
    }
  } else {
    console.error(`✗ Failed: ${result.error}`);
  }
} catch (err) {
  console.error(`✗ Error: ${err.message}`);
}

console.log(`\nCheck the Next.js console for [MEASURE] resize logs!\n`);
