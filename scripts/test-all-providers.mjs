#!/usr/bin/env node
/**
 * Batch test all VLM providers against ground truth measurements
 * 
 * Usage:
 *   node scripts/test-all-providers.mjs
 *   node scripts/test-all-providers.mjs --providers qwen,googleai,openai
 *   node scripts/test-all-providers.mjs --files public/originals/sciana.jpg
 */

import { readFile } from 'fs/promises';
import { resolve } from 'path';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3010';

// Parse CLI args
const args = process.argv.slice(2);
const providersArg = args.find(a => a.startsWith('--providers='))?.split('=')[1];
const filesArg = args.find(a => a.startsWith('--files='))?.split('=')[1];

const PROVIDERS = providersArg 
  ? providersArg.split(',')
  : ['googleai', 'qwen', 'openai'];

const MODELS = {
  googleai: 'googleai/gemini-2.0-flash-001',
  qwen: 'qwen-vl-plus',
  openai: 'openai/gpt-4o-mini',
};

// Load ground truth
const groundTruthPath = resolve(process.cwd(), 'ground_truth.json');
let groundTruth;
try {
  const data = await readFile(groundTruthPath, 'utf-8');
  groundTruth = JSON.parse(data);
} catch (err) {
  console.error('❌ Failed to load ground_truth.json:', err.message);
  process.exit(1);
}

// Test files
const testFiles = filesArg
  ? filesArg.split(',')
  : groundTruth.map(gt => gt.file);

console.log('🧪 VLM Provider Batch Test');
console.log('========================\n');
console.log(`Providers: ${PROVIDERS.join(', ')}`);
console.log(`Test files: ${testFiles.length}`);
console.log(`API: ${API_URL}\n`);

// Results storage
const results = [];

// Test each file with each provider
for (const filename of testFiles) {
  const gt = groundTruth.find(g => g.file === filename);
  if (!gt) {
    console.warn(`⚠️  No ground truth for ${filename}, skipping`);
    continue;
  }

  console.log(`\n📷 Testing: ${filename}`);
  console.log(`   Ground truth: ${gt.widthCm}cm × ${gt.heightCm}cm`);
  console.log('   ' + '─'.repeat(60));

  // Try to load the file
  const possiblePaths = [
    resolve(process.cwd(), 'public', 'originals', filename),
    resolve(process.cwd(), 'public', filename),
    resolve(process.cwd(), filename),
  ];

  let imageBuffer;
  let imagePath;
  for (const path of possiblePaths) {
    try {
      imageBuffer = await readFile(path);
      imagePath = path;
      break;
    } catch {}
  }

  if (!imageBuffer) {
    console.error(`   ❌ File not found in: ${possiblePaths.join(', ')}`);
    continue;
  }

  // Convert to data URI
  const ext = filename.split('.').pop().toLowerCase();
  const mimeMap = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    heic: 'image/heic',
    heif: 'image/heif',
  };
  const mime = mimeMap[ext] || 'image/jpeg';
  const base64 = imageBuffer.toString('base64');
  const photoDataUri = `data:${mime};base64,${base64}`;

  for (const provider of PROVIDERS) {
    const model = MODELS[provider];
    
    try {
      const startTime = Date.now();
      
      const response = await fetch(`${API_URL}/api/measure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoDataUri,
          provider,
          model,
          bypassCache: true,
        }),
      });

      const elapsed = Date.now() - startTime;

      if (!response.ok) {
        const text = await response.text();
        console.log(`   ❌ ${provider.padEnd(10)} FAILED (${elapsed}ms)`);
        console.log(`      ${text.slice(0, 100)}`);
        
        results.push({
          file: filename,
          provider,
          model,
          groundTruth: { width: gt.widthCm, height: gt.heightCm },
          result: null,
          error: text.slice(0, 200),
          elapsedMs: elapsed,
        });
        continue;
      }

      const data = await response.json();
      const { wallWidthCm, wallHeightCm } = data;

      // Calculate error
      const widthError = Math.abs(wallWidthCm - gt.widthCm);
      const heightError = Math.abs(wallHeightCm - gt.heightCm);
      const widthErrorPct = (widthError / gt.widthCm) * 100;
      const heightErrorPct = (heightError / gt.heightCm) * 100;
      const avgErrorPct = (widthErrorPct + heightErrorPct) / 2;

      const status = avgErrorPct <= 10 ? '✅' : avgErrorPct <= 20 ? '⚠️ ' : '❌';
      
      console.log(`   ${status} ${provider.padEnd(10)} ${wallWidthCm}cm × ${wallHeightCm}cm  (±${avgErrorPct.toFixed(1)}%, ${elapsed}ms)`);

      results.push({
        file: filename,
        provider,
        model,
        groundTruth: { width: gt.widthCm, height: gt.heightCm },
        result: { width: wallWidthCm, height: wallHeightCm },
        widthError,
        heightError,
        widthErrorPct,
        heightErrorPct,
        avgErrorPct,
        elapsedMs: elapsed,
      });

    } catch (err) {
      console.log(`   ❌ ${provider.padEnd(10)} ERROR: ${err.message}`);
      
      results.push({
        file: filename,
        provider,
        model,
        groundTruth: { width: gt.widthCm, height: gt.heightCm },
        result: null,
        error: err.message,
      });
    }
  }
}

// Summary
console.log('\n\n📊 Summary');
console.log('========================\n');

for (const provider of PROVIDERS) {
  const providerResults = results.filter(r => r.provider === provider && r.result);
  
  if (providerResults.length === 0) {
    console.log(`${provider.toUpperCase()}: No successful measurements`);
    continue;
  }

  const avgError = providerResults.reduce((sum, r) => sum + r.avgErrorPct, 0) / providerResults.length;
  const avgTime = providerResults.reduce((sum, r) => sum + r.elapsedMs, 0) / providerResults.length;
  const successRate = (providerResults.length / results.filter(r => r.provider === provider).length) * 100;
  
  const excellent = providerResults.filter(r => r.avgErrorPct <= 10).length;
  const good = providerResults.filter(r => r.avgErrorPct > 10 && r.avgErrorPct <= 20).length;
  const poor = providerResults.filter(r => r.avgErrorPct > 20).length;

  console.log(`${provider.toUpperCase()} (${MODELS[provider]})`);
  console.log(`  Success rate: ${successRate.toFixed(0)}% (${providerResults.length}/${results.filter(r => r.provider === provider).length})`);
  console.log(`  Avg error: ±${avgError.toFixed(1)}%`);
  console.log(`  Avg time: ${avgTime.toFixed(0)}ms`);
  console.log(`  Accuracy: ✅ ${excellent} excellent (≤10%), ⚠️  ${good} good (10-20%), ❌ ${poor} poor (>20%)`);
  console.log('');
}

// Best performer
const successfulResults = results.filter(r => r.result);
if (successfulResults.length > 0) {
  const byProvider = {};
  for (const provider of PROVIDERS) {
    const providerResults = successfulResults.filter(r => r.provider === provider);
    if (providerResults.length > 0) {
      byProvider[provider] = {
        avgError: providerResults.reduce((sum, r) => sum + r.avgErrorPct, 0) / providerResults.length,
        avgTime: providerResults.reduce((sum, r) => sum + r.elapsedMs, 0) / providerResults.length,
      };
    }
  }

  const best = Object.entries(byProvider).sort((a, b) => a[1].avgError - b[1].avgError)[0];
  const fastest = Object.entries(byProvider).sort((a, b) => a[1].avgTime - b[1].avgTime)[0];

  console.log('🏆 Rankings');
  console.log('========================');
  console.log(`Most accurate: ${best[0]} (±${best[1].avgError.toFixed(1)}%)`);
  console.log(`Fastest: ${fastest[0]} (${fastest[1].avgTime.toFixed(0)}ms)`);
}

console.log('\n✅ Done!\n');
