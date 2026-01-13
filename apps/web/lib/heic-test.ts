/**
 * Quick test to verify heic2any is working
 * Run this in browser console on /estimate page
 */

export async function testHEICSupport() {
  console.log('Testing HEIC support...');
  
  try {
    // Try to import heic2any
    const heicModule = await import('heic2any');
    const heic2any = heicModule.default || heicModule;
    console.log('✅ heic2any imported successfully');
    console.log('Type:', typeof heic2any);
    console.log('Is function:', typeof heic2any === 'function');
    
    // Check browser support
    const hasFileAPI = typeof File !== 'undefined';
    const hasBlob = typeof Blob !== 'undefined';
    const hasFileReader = typeof FileReader !== 'undefined';
    
    console.log('Browser support:');
    console.log('  File API:', hasFileAPI);
    console.log('  Blob:', hasBlob);
    console.log('  FileReader:', hasFileReader);
    
    return {
      imported: true,
      isFunction: typeof heic2any === 'function',
      browserSupport: hasFileAPI && hasBlob && hasFileReader,
    };
  } catch (error) {
    console.error('❌ heic2any test failed:', error);
    return {
      imported: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Make it available globally for testing
if (typeof window !== 'undefined') {
  (window as any).testHEICSupport = testHEICSupport;
}
