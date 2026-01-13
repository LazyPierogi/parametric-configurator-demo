import { NextResponse } from 'next/server';
import { loadEnv } from '@curtain-wizard/shared/src/env';

/**
 * Debug endpoint to check environment variables
 * IMPORTANT: Remove or protect this in production!
 */
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }
  try {
    const env = loadEnv();
    
    // Only expose non-sensitive config
    const safeConfig = {
      CATALOG_PROVIDER: env.CATALOG_PROVIDER,
      AI1_PROVIDER: env.AI1_PROVIDER,
      AI1_GEMINI_MODEL: env.AI1_GEMINI_MODEL,
      AI1_GPT_MODEL: env.AI1_GPT_MODEL,
      AI1_QWEN_MODEL: env.AI1_QWEN_MODEL,
      NEXT_PUBLIC_STOREFRONT_ORIGIN: env.NEXT_PUBLIC_STOREFRONT_ORIGIN,
      NEXT_PUBLIC_CONFIGURE_DEBUG_UI: process.env.NEXT_PUBLIC_CONFIGURE_DEBUG_UI,
      NEXT_PUBLIC_MEASURE_ENGINE_DEBUG: process.env.NEXT_PUBLIC_MEASURE_ENGINE_DEBUG,
      NEXT_PUBLIC_SUMMARY_FIELDS: process.env.NEXT_PUBLIC_SUMMARY_FIELDS,
      NODE_ENV: process.env.NODE_ENV,
      // Check if keys are set (without exposing them)
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      hasGoogleKey: !!process.env.GOOGLE_GENAI_API_KEY,
      hasQwenKey: !!process.env.QWEN_API_KEY,
      hasStorefrontToken: !!process.env.STOREFRONT_MAGENTO_TOKEN,
    };

    return NextResponse.json({
      success: true,
      config: safeConfig,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
