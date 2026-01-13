#!/usr/bin/env node
/**
 * Quick test to verify LOCAL_SEG_LONG_SIDE is readable from process.env
 */

console.log('=== Environment Variable Test ===');
console.log('LOCAL_SEG_LONG_SIDE:', process.env.LOCAL_SEG_LONG_SIDE || '(not set)');
console.log('M2F_LONG_SIDE:', process.env.M2F_LONG_SIDE || '(not set)');
console.log('SEG_M2F_COMPOSE_FROM_RAW:', process.env.SEG_M2F_COMPOSE_FROM_RAW || '(not set)');
console.log('LOCAL_SEG_URL:', process.env.LOCAL_SEG_URL || '(not set)');
console.log('\n=== Next.js Env Loading Test ===');

try {
  // Try loading through the shared env module
  const { loadEnv } = await import('../packages/shared/src/env.ts');
  const env = loadEnv();
  console.log('✓ loadEnv() succeeded');
  console.log('LOCAL_SEG_LONG_SIDE from loadEnv():', env.LOCAL_SEG_LONG_SIDE);
  console.log('LOCAL_SEG_URL from loadEnv():', env.LOCAL_SEG_URL);
} catch (e) {
  console.error('✗ loadEnv() failed:', e.message);
}
