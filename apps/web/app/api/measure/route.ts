import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { measureFromImage } from '@curtain-wizard/core/src/services/measure';
import { loadEnv } from '@curtain-wizard/shared/src/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PolygonPointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

const BodySchema = z.object({
  photoDataUri: z.string().startsWith('data:image/'),
  provider: z.enum(['openai', 'googleai', 'qwen', 'localcv', 'noreref']).optional(),
  model: z.string().optional(),
  secondaryModel: z.string().optional(),
  localMeasureUrl: z.string().url().optional(),
  localDebug: z.boolean().optional(),
  localScaleLongSide: z.number().min(0).optional(),
  bypassCache: z.boolean().optional(),
  localRectifyEnabled: z.boolean().optional(),
  curtainPolygon: z.array(PolygonPointSchema).min(3).optional(),
});

export async function POST(req: NextRequest) {
  try {
    loadEnv();
    const body = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload. Expect { photoDataUri } as data URI.' }, { status: 400 });
    }
    try { console.log('[MEASURE] request received', { provider: parsed.data.provider, model: parsed.data.model }); } catch {}
    const out = await measureFromImage(parsed.data.photoDataUri, {
      provider: parsed.data.provider,
      model: parsed.data.model,
      secondaryModel: parsed.data.secondaryModel,
      localMeasureUrl: parsed.data.localMeasureUrl,
      localDebug: parsed.data.localDebug,
      localScaleLongSide: parsed.data.localScaleLongSide,
      localRectifyEnabled: parsed.data.localRectifyEnabled,
      curtainPolygon: parsed.data.curtainPolygon,
    });
    return NextResponse.json(out);
  } catch (e: any) {
    try { console.error('[MEASURE] error', e); } catch {}
    return NextResponse.json({ error: e?.message || 'Measure failed' }, { status: 500 });
  }
}
