#!/usr/bin/env node

/**
 * Diagnostic tool for no-reference measurement accuracy
 * Analyzes measurement results and identifies likely failure modes
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ACCEPTABLE_ERROR_PCT = 10;
const TYPICAL_ROOM_DEPTH_CM = { min: 200, max: 600 };
const TYPICAL_WALL_ASPECT = { min: 1.5, max: 6.0 }; // width:height

async function loadGroundTruth(path) {
  const content = await readFile(path, 'utf-8');
  const data = JSON.parse(content);
  const map = new Map();
  for (const entry of data) {
    map.set(entry.file, { widthCm: entry.widthCm, heightCm: entry.heightCm });
  }
  return map;
}

async function loadMeasurement(debugDir, filename) {
  const base = filename.replace(/\.[^.]+$/, '').toLowerCase();
  const variants = [base, filename.replace(/\.[^.]+$/, '')];
  
  for (const variant of variants) {
    try {
      const path = join(debugDir, variant, 'measurement.json');
      const content = await readFile(path, 'utf-8');
      return JSON.parse(content);
    } catch {}
  }
  return null;
}

function diagnoseFailure(expected, measured, data) {
  const issues = [];
  const metrics = {};

  // Width error analysis
  const widthErrorPct = Math.abs((measured.wallWidthCm - expected.widthCm) / expected.widthCm * 100);
  const heightErrorPct = Math.abs((measured.wallHeightCm - expected.heightCm) / expected.heightCm * 100);
  
  metrics.widthErrorPct = widthErrorPct;
  metrics.heightErrorPct = heightErrorPct;
  
  if (widthErrorPct > ACCEPTABLE_ERROR_PCT) {
    if (measured.wallWidthCm > expected.widthCm * 2) {
      issues.push(`⚠️  Width MASSIVE OVERESTIMATE (+${widthErrorPct.toFixed(0)}%) - likely measuring entire frame or including side walls`);
    } else if (measured.wallWidthCm > expected.widthCm * 1.5) {
      issues.push(`⚠️  Width significant overestimate (+${widthErrorPct.toFixed(0)}%) - wall mask may include side walls`);
    } else if (measured.wallWidthCm < expected.widthCm * 0.5) {
      issues.push(`⚠️  Width underestimate (-${widthErrorPct.toFixed(0)}%) - wall detection too narrow`);
    }
  }

  if (heightErrorPct > ACCEPTABLE_ERROR_PCT) {
    issues.push(`⚠️  Height error ${heightErrorPct.toFixed(0)}% (acceptable: <${ACCEPTABLE_ERROR_PCT}%)`);
  }

  // Confidence calibration check
  if (measured.confidencePct > 70 && widthErrorPct > 50) {
    issues.push(`🚨 CONFIDENCE MISCALIBRATION: ${measured.confidencePct}% confidence but ${widthErrorPct.toFixed(0)}% error`);
  }

  // Aspect ratio check
  const measuredAspect = measured.wallWidthCm / measured.wallHeightCm;
  const expectedAspect = expected.widthCm / expected.heightCm;
  metrics.measuredAspect = measuredAspect;
  metrics.expectedAspect = expectedAspect;
  
  if (measuredAspect > TYPICAL_WALL_ASPECT.max) {
    issues.push(`⚠️  Aspect ratio too wide (${measuredAspect.toFixed(1)}:1) - likely measuring panoramic view`);
  } else if (measuredAspect < TYPICAL_WALL_ASPECT.min) {
    issues.push(`⚠️  Aspect ratio too narrow (${measuredAspect.toFixed(1)}:1) - wall detection too constrained`);
  }

  // Warning analysis
  const warnings = measured.warnings || [];
  if (warnings.some(w => w.includes('Segmentation fallback'))) {
    issues.push(`🔴 Segmentation service failed - using fallback (full-frame mask)`);
  }
  if (warnings.some(w => w.includes('No EXIF'))) {
    issues.push(`📷 No EXIF focal length - using 60° FOV assumption`);
  }
  if (warnings.some(w => w.includes('Floor mask missing'))) {
    issues.push(`⚠️  Floor detection failed - distance estimation unreliable`);
  }
  if (warnings.some(w => w.includes('Ceiling mask missing'))) {
    issues.push(`⚠️  Ceiling detection failed - vertical bounds unreliable`);
  }

  return { issues, metrics };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node diagnose-noreref.mjs <ground-truth.json> <debug-dir>');
    process.exit(1);
  }

  const [gtPath, debugDir] = args;
  
  console.log('🔍 No-Reference Measurement Diagnostic\n');
  console.log(`Ground truth: ${gtPath}`);
  console.log(`Debug dir: ${debugDir}\n`);

  const groundTruth = await loadGroundTruth(gtPath);
  
  let totalFiles = 0;
  let acceptableCount = 0;

  for (const [filename, expected] of groundTruth.entries()) {
    totalFiles++;
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📁 ${filename}`);
    console.log(`${'='.repeat(80)}`);
    
    const measured = await loadMeasurement(debugDir, filename);
    
    if (!measured) {
      console.log('❌ No measurement data found');
      continue;
    }

    console.log(`\n📏 Expected: ${expected.widthCm}cm × ${expected.heightCm}cm`);
    console.log(`📏 Measured: ${measured.wallWidthCm}cm × ${measured.wallHeightCm}cm`);
    console.log(`📊 Confidence: ${measured.confidencePct}%`);

    const { issues, metrics } = diagnoseFailure(expected, measured, measured);
    
    console.log(`\n📈 Metrics:`);
    console.log(`   Width error: ${metrics.widthErrorPct.toFixed(1)}%`);
    console.log(`   Height error: ${metrics.heightErrorPct.toFixed(1)}%`);
    console.log(`   Aspect ratio: ${metrics.measuredAspect.toFixed(2)}:1 (expected ${metrics.expectedAspect.toFixed(2)}:1)`);

    if (metrics.widthErrorPct <= ACCEPTABLE_ERROR_PCT && metrics.heightErrorPct <= ACCEPTABLE_ERROR_PCT) {
      console.log(`\n✅ ACCEPTABLE (errors within ${ACCEPTABLE_ERROR_PCT}%)`);
      acceptableCount++;
    } else {
      console.log(`\n❌ UNACCEPTABLE (errors exceed ${ACCEPTABLE_ERROR_PCT}%)`);
    }

    if (issues.length > 0) {
      console.log(`\n🔍 Diagnosed Issues:`);
      for (const issue of issues) {
        console.log(`   ${issue}`);
      }
    }

    if (measured.warnings && measured.warnings.length > 0) {
      console.log(`\n⚠️  Warnings from measurement:`);
      for (const warning of measured.warnings) {
        console.log(`   • ${warning}`);
      }
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 SUMMARY`);
  console.log(`${'='.repeat(80)}`);
  console.log(`Total files: ${totalFiles}`);
  console.log(`Acceptable (< ${ACCEPTABLE_ERROR_PCT}% error): ${acceptableCount} (${(acceptableCount/totalFiles*100).toFixed(0)}%)`);
  console.log(`Unacceptable: ${totalFiles - acceptableCount}`);
  
  console.log(`\n🎯 PRIMARY ISSUES TO FIX:`);
  console.log(`   1. Segmentation service not running (timeouts/failures)`);
  console.log(`   2. Wall mask includes side walls/entire frame`);
  console.log(`   3. Confidence model miscalibrated (high confidence on bad measurements)`);
  console.log(`   4. Distance estimation unreliable without floor/ceiling masks`);
  
  console.log(`\n💡 RECOMMENDED ACTIONS:`);
  console.log(`   1. Start segmentation service: cd services/segmentation && docker-compose up -d`);
  console.log(`   2. Add wall mask quality checks (size, edge touching, compactness)`);
  console.log(`   3. Implement vanishing point detection to isolate frontal wall`);
  console.log(`   4. Recalibrate confidence model with stricter penalties`);
  console.log(`   5. Add measurement sanity bounds (typical room dimensions)`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
