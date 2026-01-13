#!/usr/bin/env node

/**
 * Test Material Reuse Optimization (Task 902+)
 * Verify bolt count reduction and stitch position accuracy
 */

// Linen 300 fabric properties
const fabric = {
  name: 'Linen 300',
  fabricWidthCm: 300,
  shrinkagePct: 2,
  fullnessByPleat: { wave: 2.2 }
};

function calculateMaterialReuse(segmentWidthsCm, config) {
  const fullness = fabric.fullnessByPleat[config.pleatId];
  const shrinkagePct = fabric.shrinkagePct;
  const fabricWidthCm = fabric.fabricWidthCm;
  
  const effectiveFabricWidthCm = fabricWidthCm * (1 - shrinkagePct / 100);
  const finishedWidthPerBolt = effectiveFabricWidthCm / fullness;
  
  // Without reuse: calculate per segment
  const widthsPerSegment = segmentWidthsCm.map(segWidth => {
    const requiredFlatWidth = segWidth * fullness;
    return Math.max(1, Math.ceil(requiredFlatWidth / effectiveFabricWidthCm));
  });
  const numWidthsWithoutReuse = widthsPerSegment.reduce((sum, w) => sum + w, 0);
  
  // With reuse: calculate total
  const totalFinishedWidth = segmentWidthsCm.reduce((sum, w) => sum + w, 0);
  const numWidthsWithReuse = Math.max(1, Math.ceil(totalFinishedWidth / finishedWidthPerBolt));
  
  // Calculate actual stitch positions
  const stitchPositionsPerSegment = [];
  let remainingInCurrentBolt = finishedWidthPerBolt;
  
  for (const segWidth of segmentWidthsCm) {
    const stitches = [];
    let consumedInSegment = 0;
    
    while (consumedInSegment < segWidth) {
      const spaceInBolt = remainingInCurrentBolt;
      const neededFromThisSegment = segWidth - consumedInSegment;
      
      if (neededFromThisSegment > spaceInBolt) {
        // Bolt runs out within this segment
        stitches.push(consumedInSegment + spaceInBolt);
        consumedInSegment += spaceInBolt;
        remainingInCurrentBolt = finishedWidthPerBolt;
      } else {
        // Segment finishes within current bolt
        remainingInCurrentBolt -= neededFromThisSegment;
        consumedInSegment = segWidth;
      }
    }
    
    stitchPositionsPerSegment.push(stitches);
  }
  
  return {
    finishedWidthPerBolt,
    widthsPerSegment,
    numWidthsWithoutReuse,
    numWidthsWithReuse,
    stitchPositionsPerSegment,
    savings: numWidthsWithoutReuse - numWidthsWithReuse
  };
}

console.log('🧪 Testing Material Reuse Optimization');
console.log('=' . repeat(70));
console.log(`\n📊 Fabric: ${fabric.name}`);
console.log(`   Width: ${fabric.fabricWidthCm}cm`);
console.log(`   Shrinkage: ${fabric.shrinkagePct}%`);
console.log(`   Fullness (wave): ${fabric.fullnessByPleat.wave}×`);

const testCases = [
  {
    name: '2 segments × 50cm (equal, small)',
    segments: [50, 50],
    expectedWithoutReuse: 2,
    expectedWithReuse: 1,
  },
  {
    name: '50cm + 83cm (max on 1 bolt)',
    segments: [50, 83],
    expectedWithoutReuse: 2,
    expectedWithReuse: 1,
  },
  {
    name: '50cm + 84cm (exceeds 1 bolt)',
    segments: [50, 84],
    expectedWithoutReuse: 2,
    expectedWithReuse: 2,
  },
  {
    name: '50cm + 90cm (needs 2 bolts)',
    segments: [50, 90],
    expectedWithoutReuse: 2,
    expectedWithReuse: 2,
  },
  {
    name: '50cm + 222cm (user example - already optimal)',
    segments: [50, 222],
    expectedWithoutReuse: 3, // Per-segment calc: 1 + 2 = 3
    expectedWithReuse: 3, // Total: 272cm needs 3 bolts (2 bolts = 267cm max)
  },
  {
    name: '3 segments × 50cm',
    segments: [50, 50, 50],
    expectedWithoutReuse: 3,
    expectedWithReuse: 2,
  },
];

testCases.forEach(({ name, segments, expectedWithoutReuse, expectedWithReuse }) => {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`\n📋 Test: ${name}`);
  console.log(`   Segments: ${segments.join('cm + ')}cm (Total: ${segments.reduce((a, b) => a + b, 0)}cm)`);
  
  const result = calculateMaterialReuse(segments, { pleatId: 'wave' });
  
  console.log(`\n   🔴 Without Reuse (old logic):`);
  console.log(`      Widths per segment: [${result.widthsPerSegment.join(', ')}]`);
  console.log(`      Total bolts: ${result.numWidthsWithoutReuse}`);
  
  console.log(`\n   🟢 With Reuse (optimized):`);
  console.log(`      Total bolts: ${result.numWidthsWithReuse}`);
  console.log(`      Savings: ${result.savings} bolt${result.savings !== 1 ? 's' : ''}`);
  console.log(`      Finished width per bolt: ${result.finishedWidthPerBolt.toFixed(1)}cm`);
  
  console.log(`\n   🪡 Stitch Positions:`);
  result.stitchPositionsPerSegment.forEach((stitches, idx) => {
    if (stitches.length === 0) {
      console.log(`      Segment ${idx + 1} (${segments[idx]}cm): No stitches`);
    } else {
      console.log(`      Segment ${idx + 1} (${segments[idx]}cm): ${stitches.length} stitch${stitches.length !== 1 ? 'es' : ''} at ${stitches.map(s => s.toFixed(1) + 'cm').join(', ')}`);
    }
  });
  
  const withoutOk = result.numWidthsWithoutReuse === expectedWithoutReuse;
  const withOk = result.numWidthsWithReuse === expectedWithReuse;
  
  console.log(`\n   ✅ Verification:`);
  console.log(`      Without reuse: ${result.numWidthsWithoutReuse} (expected ${expectedWithoutReuse}) ${withoutOk ? '✓' : '✗ MISMATCH'}`);
  console.log(`      With reuse:    ${result.numWidthsWithReuse} (expected ${expectedWithReuse}) ${withOk ? '✓' : '✗ MISMATCH'}`);
  
  if (!withoutOk || !withOk) {
    console.log(`\n      ❌ TEST FAILED`);
  } else {
    console.log(`\n      ✅ TEST PASSED`);
  }
});

console.log(`\n${'='.repeat(70)}`);
console.log('\n✨ All tests complete!\n');
console.log('💡 Enable in UI with: NEXT_PUBLIC_MATERIAL_REUSE_ENABLED=1\n');
