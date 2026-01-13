import { z } from 'zod';

export const EnvSchema = z.object({
  // AI #1 (measurement)
  AI1_PROVIDER: z.enum(['openai', 'googleai', 'qwen', 'localcv', 'noreref']).default('qwen'),
  AI1_GEMINI_MODEL: z.string().default('models/gemini-2.0-flash-lite'),
  AI1_GPT_MODEL: z.string().default('openai/gpt-4o-mini'),
  AI1_QWEN_MODEL: z.string().default('qwen3-vl-flash'),
  QWEN_API_KEY: z.string().optional(),
  QWEN_BASE_URL: z.string().default('https://dashscope-intl.aliyuncs.com/compatible-mode/v1'),
  LOCAL_MEASURE_URL: z.string().default('http://127.0.0.1:8000/measure'),
  MEASURE_DEBUG: z.coerce.boolean().default(false),
  MEASURE_LONG_SIDE: z.coerce.number().default(1536),
  MEASURE_DEFAULT_FOV_DEG: z.coerce.number().default(60),
  MEASURE_CAMERA_HEIGHT_CM: z.coerce.number().default(150),
  NEXT_PUBLIC_MEASURE_ENGINE_DEBUG: z.enum(['vlm', 'localcv', 'noreref', 'auto']).default('vlm'),

  // Curtain box control
  NEXT_PUBLIC_CURTAIN_BOX_HEIGHT_SOURCE: z.enum(['auto', 'mask', 'full']).default('auto'),

  // AI #2 (segmentation)
  LOCAL_SEG_URL: z.string().default('http://127.0.0.1:8000/segment'),
  LOCAL_SEG_LONG_SIDE: z.coerce.number().default(768),
  HF_TOKEN: z.string().optional(),

  // Upload limits
  MAX_IMAGE_MB: z.coerce.number().default(15),
  NEXT_PUBLIC_FLOW_AUTO_RETRIES: z.coerce.number().default(1),

  // Catalog provider
  CATALOG_PROVIDER: z.enum(['mock', 'storefront']).default('mock'),
  CATALOG_ASSET_BASE_URL: z.string().default(''),
  NEXT_PUBLIC_CATALOG_ASSET_BASE_URL: z.string().optional(),
  
  // Canvas textures (pleat maps, material weaves)
  NEXT_PUBLIC_CANVAS_TEXTURES_BASE_URL: z.string().default('/'),

  STOREFRONT_MAGENTO_URL: z.string().optional(),
  STOREFRONT_MAGENTO_TOKEN: z.string().optional(),
  STOREFRONT_MAGENTO_CART_ID: z.string().optional(),

  NEXT_PUBLIC_STOREFRONT_CART_URL: z.string().optional(),
  NEXT_PUBLIC_STOREFRONT_ORIGIN: z.string().default(''),
  NEXT_PUBLIC_STOREFRONT_TIMEOUT_MS: z.coerce.number().default(30000),

  // Pricing Multipliers (for testing/adjustment)
  NEXT_PUBLIC_PRICE_FABRIC_MULTIPLIER: z.coerce.number().default(1.0),
  NEXT_PUBLIC_PRICE_LABOR_MULTIPLIER: z.coerce.number().default(1.0),

  // Lighting (Task 881 — client-safe)
  NEXT_PUBLIC_LIGHTING_ENABLED: z.coerce.boolean().default(true),
  NEXT_PUBLIC_LIGHTING_MODE: z.enum(['off', 'lite', 'enhanced']).default('lite'),
  NEXT_PUBLIC_LIGHTING_OPACITY: z.coerce.number().default(0.35),
  NEXT_PUBLIC_LIGHTING_GRID_X: z.coerce.number().default(48),
  NEXT_PUBLIC_LIGHTING_GRID_Y: z.coerce.number().default(32),
  NEXT_PUBLIC_LIGHTING_THROTTLE_MS: z.coerce.number().default(120),
  NEXT_PUBLIC_STITCH_LINES_ENABLED: z.coerce.boolean().default(true),

  // Post-process parameters (Node only)
  SEG_LONG_SIDE: z.coerce.number().default(1024),
  SEG_FALLBACK_LONG_SIDE: z.coerce.number().optional(),
  SEG_FALLBACK_JPEG_QUALITY: z.coerce.number().optional(),
  SEG_FALLBACK_MAX_BYTES: z.coerce.number().optional(),
  SEG_WALL_MERGE_RADIUS: z.coerce.number().default(25),
  SEG_FILL_HOLES: z.string().optional().default('1'),
  SEG_HOLES_MAX_AREA_PCT: z.coerce.number().default(0.01),
  SEG_HOLES_BRIDGE_RADIUS: z.coerce.number().default(2),
  SEG_HOLES_BRIDGE_CAP: z.coerce.number().default(8),
  SEG_ATTACH_CONTACT_PCT: z.coerce.number().default(0.01),
  SEG_CONTACT_ANISO: z.string().optional().default('1'),
  SEG_SMOOTH: z.string().optional().default('1'),
  SEG_BYPASS_SUPPORT: z.string().optional().default('0'),
  SEG_MIN_AREA_PCT: z.coerce.number().optional(),
  SEG_MAX_AREA_PCT: z.coerce.number().optional(),
  SEG_HF_MIN_SCORE: z.coerce.number().optional(),

  // Compose from raw masks in local Mask2Former
  SEG_M2F_COMPOSE_FROM_RAW: z.string().optional().default('1'),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(): Env {
  // Map process.env (string index signature) to a typed object for zod
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.message}`);
  }
  return parsed.data;
}
