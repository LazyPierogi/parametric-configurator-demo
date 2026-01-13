#!/usr/bin/env node

/**
 * Test asymmetric panel pricing with Linen 300 example
 * Expected: 50cm + 222cm = 3 widths total (1 + 2)
 */

// Linen 300 fabric properties (from data.ts)
const fabric = {
  name: 'Linen 300',
  fabricWidthCm: 300,
  shrinkagePct: 2,
  fullnessByPleat: { wave: 2.2, microflex: 2.4, tunnel: 1.8 }
};

// Mock provider logic (simplified)
function calculateWidthsPerSegment(config) {
  const fullness = fabric.fullnessByPleat?.[config.pleatId] ?? 2.0;
  const shrinkagePct = fabric.shrinkagePct ?? 0;
  const fabricWidthCm = fabric.fabricWidthCm;

  console.log('\n📊 Fabric Details:');
  console.log(`   Name: ${fabric.name}`);
  console.log(`   Fabric Width: ${fabricWidthCm}cm`);
  console.log(`   Shrinkage: ${shrinkagePct}%`);
  console.log(`   Fullness (${config.pleatId}): ${fullness}×`);

  const shrinkFactor = 1 - (shrinkagePct / 100);
  const effectiveFabricWidthCm = fabricWidthCm * shrinkFactor;
  const finishedFabricWidthPerBolt = effectiveFabricWidthCm / fullness;

  console.log(`\n🧮 Calculations:`);
  console.log(`   Effective fabric width: ${fabricWidthCm} × (1 - ${shrinkagePct}%) = ${effectiveFabricWidthCm.toFixed(2)}cm`);
  console.log(`   Finished width per bolt: ${effectiveFabricWidthCm.toFixed(2)} / ${fullness} = ${finishedFabricWidthPerBolt.toFixed(2)}cm`);

  const widthsPerSegment = config.segmentWidthsCm.map((segWidth, idx) => {
    const requiredFlatWidth = segWidth * fullness;
    const widths = Math.max(1, Math.ceil(requiredFlatWidth / effectiveFabricWidthCm));
    
    console.log(`\n   Segment ${idx + 1} (${segWidth}cm):`);
    console.log(`      Required flat width: ${segWidth} × ${fullness} = ${requiredFlatWidth.toFixed(2)}cm`);
    console.log(`      Widths needed: ceil(${requiredFlatWidth.toFixed(2)} / ${effectiveFabricWidthCm.toFixed(2)}) = ${widths}`);
    
    return widths;
  });

  const totalWidths = widthsPerSegment.reduce((sum, w) => sum + w, 0);
  const maxCoverageOnTwoBolts = 2 * finishedFabricWidthPerBolt;

  console.log(`\n✅ Results:`);
  console.log(`   Widths per segment: [${widthsPerSegment.join(', ')}]`);
  console.log(`   Total widths (bolts): ${totalWidths}`);
  console.log(`   Maximum coverage on 2 bolts: ${maxCoverageOnTwoBolts.toFixed(1)}cm`);
  console.log(`   Total requested: ${config.segmentWidthsCm.reduce((a, b) => a + b, 0)}cm`);

  return { widthsPerSegment, totalWidths, finishedFabricWidthPerBolt };
}

// Test case from user's example
const testConfig = {
  fabricId: 'fab-linen-300',
  pleatId: 'wave',
  segmentWidthsCm: [50, 222],
  segments: 2
};

console.log('🧪 Testing Asymmetric Pricing: Linen 300');
console.log('=' .repeat(60));
console.log(`Configuration: ${testConfig.segmentWidthsCm.join('cm + ')}cm`);

const result = calculateWidthsPerSegment(testConfig);

console.log('\n' + '='.repeat(60));
console.log('📝 Expected vs Actual:');
console.log(`   Expected: 3 widths (1 + 2)`);
console.log(`   Actual:   ${result.totalWidths} widths (${result.widthsPerSegment.join(' + ')})`);
console.log(`   Status:   ${result.totalWidths === 3 ? '✅ CORRECT' : '❌ INCORRECT'}`);

// Test when first stitch line should appear
console.log('\n' + '='.repeat(60));
console.log('🪡 Stitch Line Analysis:');
const threshold = result.finishedFabricWidthPerBolt;
console.log(`   First stitch appears when segment > ${threshold.toFixed(1)}cm`);
console.log(`   Left segment (50cm): ${50 > threshold ? '✓ Has stitch' : '✗ No stitch'}`);
console.log(`   Right segment (222cm): ${222 > threshold ? '✓ Has stitch' : '✗ No stitch'}`);
console.log(`   Right at ${threshold.toFixed(1)}cm: transitions from 1 to 2 widths`);

// Test edge cases
console.log('\n' + '='.repeat(60));
console.log('🔍 Edge Cases:');

const edgeCases = [
  { widths: [50, 50], expected: 2, desc: 'Both small (symmetric)' },
  { widths: [50, 133], expected: 2, desc: 'Right at threshold (~133.6cm)' },
  { widths: [50, 134], expected: 3, desc: 'Right over threshold (needs 2nd width)' },
  { widths: [50, 267], expected: 3, desc: 'Right at max for 2 bolts (~267cm)' },
  { widths: [50, 268], expected: 4, desc: 'Right exceeds 2 bolts (needs 3rd width)' },
];

edgeCases.forEach(({ widths, expected, desc }) => {
  const test = calculateWidthsPerSegment({
    ...testConfig,
    segmentWidthsCm: widths
  });
  const status = test.totalWidths === expected ? '✅' : '❌';
  console.log(`   ${status} ${widths.join(' + ')}cm → ${test.totalWidths} widths (expected ${expected}) - ${desc}`);
});

console.log('\n✨ Test complete!\n');
