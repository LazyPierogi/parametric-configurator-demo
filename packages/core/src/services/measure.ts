import { loadEnv } from '@curtain-wizard/shared/src/env';
import { measureLocalCV } from '../../../clients/src/measurement';
import type { CurtainPolygon, MeasureOutput, MeasureRequestOptions } from '../types/services';
import { bufferToDataUri, decodeDataUri } from '../lib/dataUri';
import { measureNoReference } from './measureNoReference';
import {
  buildPromptTemplate,
  buildUniversalPrompt,
  buildPolygonAwarePrompt,
  polygonInstructions,
  sanitizeCurtainPolygon,
  summarizeCurtainPolygon,
} from './measurePrompt';
import { measureWithFallback } from './measureFallback';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

// Dynamically import Genkit and providers to avoid bundling issues in non-Next contexts.
function detectProviderFromModel(model: string | undefined): 'googleai' | 'openai' {
  const m = String(model || '').toLowerCase();
  if (m.startsWith('models/') || m.startsWith('googleai/') || m.includes('gemini')) return 'googleai';
  return 'openai';
}

function normalizeModelForProvider(provider: 'googleai' | 'openai', model: string): string {
  if (provider === 'googleai') {
    // Normalize to 'googleai/<id>' (preferred)
    if (model.startsWith('googleai/')) return model;
    if (model.startsWith('models/')) return 'googleai/' + model.split('/').slice(1).join('/');
    if (model.startsWith('gemini')) return 'googleai/' + model;
    return model;
  }
  // OpenAI: prefer bare model id (strip optional 'openai/' prefix)
  if (model.startsWith('openai/')) return model;
  return `openai/${model}`;
}

async function createAi(provider: 'googleai' | 'openai', model: string) {
  const { genkit } = await import('genkit');
  const plugins: any[] = [];
  if (provider === 'googleai') {
    const mod: any = await import('@genkit-ai/googleai');
    const googleAI = (mod && (mod.googleAI || mod.default));
    if (typeof googleAI !== 'function') throw new Error('googleAI plugin not found');
    plugins.push(googleAI());
  } else {
    const mod: any = await import('genkitx-openai');
    const openai = (mod && (mod.openai || mod.default));
    if (typeof openai !== 'function') throw new Error('openai plugin not found');
    plugins.push(openai());
  }
  const ai = genkit({ plugins, model });
  try { console.log(`[MEASURE] primary provider=${provider} model=${model}`); } catch {}
  return { ai, provider, model } as const;
}

const HEIC_CACHE_DIR = join(os.tmpdir(), 'cw-heic-cache');
type ExifCandidate = { buffer: Buffer; mime?: string };

function hashBufferKey(buffer: Buffer): string {
  return createHash('sha1').update(buffer).digest('hex');
}

function uniqueCandidates(candidates: ExifCandidate[]): ExifCandidate[] {
  const seen = new Set<string>();
  const result: ExifCandidate[] = [];
  for (const cand of candidates) {
    if (!cand?.buffer || !cand.buffer.length) continue;
    const key = hashBufferKey(cand.buffer);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cand);
  }
  return result;
}

type NormalizedImage = {
  buffer: Buffer;
  mime: string;
  changed: boolean;
  exifFallback?: Buffer;
  exifFallbackMime?: string;
};

async function readCachedHeic(hash: string): Promise<Buffer | null> {
  try {
    const cached = await fs.readFile(join(HEIC_CACHE_DIR, `${hash}.jpg`));
    return cached.length ? cached : null;
  } catch {
    return null;
  }
}

export const __measureInternals = {
  sanitizePolygon: sanitizeCurtainPolygon,
  polygonInstructions,
  buildUniversalPrompt,
  buildPromptTemplate,
  summarizeCurtainPolygon,
};

async function writeCachedHeic(hash: string, data: Buffer): Promise<void> {
  try {
    await fs.mkdir(HEIC_CACHE_DIR, { recursive: true });
    await fs.writeFile(join(HEIC_CACHE_DIR, `${hash}.jpg`), data);
  } catch {
    // ignore cache write errors
  }
}

async function normalizeImageBuffer(buffer: Buffer, mime: string, maxLongSide?: number): Promise<NormalizedImage> {
  const lower = (mime || '').toLowerCase();
  let workingBuffer = buffer;
  let workingMime = mime;
  let wasChanged = false;
  
  // Step 1: Convert HEIC to JPEG if needed
  if (lower === 'image/heic' || lower === 'image/heif') {
    const hash = createHash('sha1').update(buffer).digest('hex');
    const cached = await readCachedHeic(hash);
    if (cached) {
      workingBuffer = cached;
      workingMime = 'image/jpeg';
      wasChanged = true;
    } else {
      const errors: string[] = [];
      try {
        const sharp = (await import('sharp')).default;
        try {
          const converted = await sharp(buffer).jpeg({ quality: 95 }).toBuffer();
          await writeCachedHeic(hash, converted);
          workingBuffer = converted;
          workingMime = 'image/jpeg';
          wasChanged = true;
        } catch (err) {
          errors.push((err as Error)?.message || String(err));
        }
      } catch (err) {
        errors.push((err as Error)?.message || String(err));
      }

      if (!wasChanged) {
        try {
          const heicConvert = (await import('heic-convert')).default as (opts: { buffer: Buffer; format: 'JPEG'; quality: number }) => Promise<Buffer>;
          const converted = await heicConvert({ buffer, format: 'JPEG', quality: 0.85 });
          await writeCachedHeic(hash, converted);
          workingBuffer = converted;
          workingMime = 'image/jpeg';
          wasChanged = true;
        } catch (err) {
          const reason = (err as Error)?.message || String(err);
          errors.push(reason);
          throw new Error(`Failed to convert HEIC image. Install libvips with libheif support or ensure heic-convert works. (${errors.join('; ')})`);
        }
      }
    }
  }

  // Step 2: Resize if maxLongSide is specified and image exceeds it
  if (maxLongSide && maxLongSide > 0) {
    try {
      const sharp = (await import('sharp')).default;
      const metadata = await sharp(workingBuffer).metadata();
      const width = metadata.width || 0;
      const height = metadata.height || 0;
      const longSide = Math.max(width, height);
      
      if (longSide > maxLongSide) {
        try { console.log(`[MEASURE] Resizing image from ${width}x${height} (long side: ${longSide}) to max ${maxLongSide}px`); } catch {}
        const resized = await sharp(workingBuffer)
          .resize(maxLongSide, maxLongSide, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 92 })
          .toBuffer();
        workingBuffer = resized;
        workingMime = 'image/jpeg';
        wasChanged = true;
        
        const newMeta = await sharp(resized).metadata();
        try { console.log(`[MEASURE] Resized to ${newMeta.width}x${newMeta.height}`); } catch {}
      } else {
        try { console.log(`[MEASURE] Image ${width}x${height} already within limit (${maxLongSide}px), no resize needed`); } catch {}
      }
    } catch (err) {
      try { console.warn(`[MEASURE] Resize failed: ${(err as Error)?.message || err}, using original`); } catch {}
    }
  }

  return { 
    buffer: workingBuffer, 
    mime: workingMime, 
    changed: wasChanged,
    exifFallback: (lower === 'image/heic' || lower === 'image/heif') ? buffer : undefined,
    exifFallbackMime: (lower === 'image/heic' || lower === 'image/heif') ? mime : undefined
  };
}

export async function measureFromImage(
  photoDataUri: string,
  overrides?: MeasureRequestOptions
): Promise<MeasureOutput> {
  const env = loadEnv();
  const requestedProvider = (overrides?.provider || env.AI1_PROVIDER) as 'googleai' | 'openai' | 'qwen' | 'localcv' | 'noreref';
  const curtainPolygon = sanitizeCurtainPolygon(overrides?.curtainPolygon);
  const getDefaultModel = (provider: 'googleai' | 'openai' | 'qwen'): string => {
    if (provider === 'googleai') return env.AI1_GEMINI_MODEL;
    if (provider === 'openai') return env.AI1_GPT_MODEL;
    return env.AI1_QWEN_MODEL;
  };
  
  // Determine max image size for VLM providers
  const maxLongSide = env.MEASURE_LONG_SIDE || 1536;
  try { console.log(`[MEASURE] Max image size: ${maxLongSide}px`); } catch {}
  
  const decodedImage = decodeDataUri(photoDataUri);
  const normalizedImage = await normalizeImageBuffer(decodedImage.buffer, decodedImage.mime, maxLongSide);
  const imageBuffer = normalizedImage.buffer;
  const normalizedDataUri = normalizedImage.changed
    ? bufferToDataUri(imageBuffer, normalizedImage.mime)
    : photoDataUri;
  const exifCandidateList: ExifCandidate[] = [];
  if (normalizedImage.exifFallback) {
    exifCandidateList.push({ buffer: normalizedImage.exifFallback, mime: normalizedImage.exifFallbackMime });
  }
  exifCandidateList.push({ buffer: decodedImage.buffer, mime: decodedImage.mime });
  if (normalizedImage.changed) {
    exifCandidateList.push({ buffer: imageBuffer, mime: normalizedImage.mime });
  }
  const exifCandidates = uniqueCandidates(exifCandidateList);
  const exifSource = exifCandidates.length ? exifCandidates[0].buffer : decodedImage.buffer;
  if (requestedProvider === 'localcv') {
    const url = overrides?.localMeasureUrl || env.LOCAL_MEASURE_URL;
    if (!url) {
      throw new Error('LOCAL_MEASURE_URL is not configured');
    }
    const debug = overrides?.localDebug ?? env.MEASURE_DEBUG;
    const scaleLongSide = overrides?.localScaleLongSide ?? undefined;
    const headers: Record<string, string> = {};
    if (overrides?.localRectifyEnabled != null) {
      headers['X-Rectify-Enabled'] = overrides.localRectifyEnabled ? '1' : '0';
    }
    if (curtainPolygon) {
      headers['X-Curtain-Polygon'] = JSON.stringify(curtainPolygon);
    }
    return measureLocalCV(imageBuffer, {
      url,
      debug,
      scaleLongSide: scaleLongSide == null ? undefined : scaleLongSide,
      headers: Object.keys(headers).length ? headers : undefined,
    });
  }
  if (requestedProvider === 'noreref') {
    return measureNoReference(imageBuffer, {
      debug: overrides?.localDebug ?? env.MEASURE_DEBUG,
      exifCandidates,
      curtainPolygon: curtainPolygon ?? undefined,
    });
  }
  
  // Handle Qwen provider as canonical opposite-wall estimator
  if (requestedProvider === 'qwen') {
    const model = overrides?.model || env.AI1_QWEN_MODEL;
    const baseUrl = env.QWEN_BASE_URL;
    const apiKey = env.QWEN_API_KEY;

    if (!apiKey) {
      throw new Error('QWEN_API_KEY is not set. Please configure your Alibaba Cloud API key.');
    }

    try {
      console.log(`[MEASURE] primary provider=qwen model=${model}`);

      // Qwen estimates the full opposite wall; polygon is applied via geometric scaling only.
      const userText = buildUniversalPrompt(null) +
        `Respond ONLY with a JSON object: { "wallWidthCm": number, "wallHeightCm": number }`;

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: userText },
                { type: 'image_url', image_url: { url: normalizedDataUri } }
              ]
            }
          ],
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        const txt = await response.text();
        throw new Error(`Qwen API request failed ${response.status}: ${txt}`);
      }

      const json = await response.json();
      try {
        console.log('[MEASURE][qwen] response:', JSON.stringify(json).slice(0, 400));
      } catch {}

      const content = json?.choices?.[0]?.message?.content;
      if (typeof content !== 'string') {
        throw new Error('Qwen response had no text content');
      }

      try {
        console.log('[MEASURE][qwen] raw_text:', content.slice(0, 240));
      } catch {}

      let parsed: any;
      try {
        parsed = JSON.parse(content);
      } catch (e: any) {
        throw new Error(`Qwen JSON parse failed: ${e?.message || e}`);
      }

      try {
        console.log('[MEASURE][qwen] parsed:', parsed);
      } catch {}

      const { z } = await import('genkit');
      const Output = z.object({
        wallWidthCm: z.number().positive(),
        wallHeightCm: z.number().positive(),
      });

      const result = Output.safeParse(parsed);
      if (!result.success || !(result.data.wallWidthCm > 0 && result.data.wallHeightCm > 0)) {
        throw new Error(`Qwen output validation failed: ${JSON.stringify(parsed)}`);
      }

      const base: MeasureOutput = {
        wallWidthCm: result.data.wallWidthCm,
        wallHeightCm: result.data.wallHeightCm,
      };

      if (curtainPolygon) {
        const scaled = measureWithFallback({ base, polygon: curtainPolygon });
        return scaled;
      }

      return base;
    } catch (e: any) {
      console.error('[MEASURE][qwen] primary failed', e?.message || e);
      // Fall through to Genkit provider below
    }
  }
  
  // For Genkit (googleai/openai) we may need to fall back from Qwen to a VLM provider.
  // If Qwen failed above, we treat Google Gemini as the primary Genkit provider instead
  // of trying to normalize the Qwen model name.
  const primaryProvider: 'googleai' | 'openai' =
    requestedProvider === 'qwen' ? 'googleai' : (requestedProvider as 'googleai' | 'openai');
  const primaryModelBase =
    requestedProvider === 'qwen'
      ? getDefaultModel(primaryProvider)
      : overrides?.model || getDefaultModel(primaryProvider);
  const primaryModel = normalizeModelForProvider(primaryProvider, primaryModelBase);
  // Provider-specific primary call
  if (primaryProvider === 'openai') {
    try {
      // Use Responses API with Structured Outputs (JSON Schema)
      const baseModel = primaryModel.replace(/^openai\//, '');
      try { console.log(`[MEASURE] primary provider=openai model=${baseModel}`); } catch {}
      try { console.log('[MEASURE][openai] using /v1/responses + json_schema'); } catch {}

      const { z } = await import('genkit');
      const Output = z.object({
        wallWidthCm: z.number().positive(),
        wallHeightCm: z.number().positive()
      });

      const key = process.env.OPENAI_API_KEY;
      if (!key) throw new Error('OPENAI_API_KEY is not set');

      // Use polygon-aware prompt for OpenAI
      const userText = buildPolygonAwarePrompt(null) +
        `Respond ONLY with a JSON object: { "wallWidthCm": number, "wallHeightCm": number }`;

      // Strict JSON Schema that forbids zeros and extra fields
      const wallSchema = {
        name: 'wall_measurement',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            wallWidthCm: { type: 'number', minimum: 1 },
            wallHeightCm: { type: 'number', minimum: 1 }
          },
          required: ['wallWidthCm', 'wallHeightCm']
        }
      } as const;

      // GPT-5-nano doesn't support temperature parameter
      const supportsTemperature = !baseModel.toLowerCase().includes('gpt-5-nano');
      
      const body: any = {
        model: baseModel, // e.g. "gpt-4o-mini" or "gpt-5-nano"
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: userText },
              // Data URI is passed directly as string per Responses API
              { type: 'input_image', image_url: normalizedDataUri }
            ]
          }
        ],
        text: {
          format: {
            type: 'json_schema',
            name: wallSchema.name,
            schema: wallSchema.schema,
            strict: wallSchema.strict
          }
        }
      };
      
      if (supportsTemperature) {
        body.temperature = 0;
      }

      const res = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`OpenAI request failed ${res.status}: ${txt}`);
      }

      const json = await res.json();

      try {
        console.log('[MEASURE][openai] response (truncated):', JSON.stringify(json).slice(0, 600));
      } catch {}

      // Robust extraction: prefer output_text, then search message blocks, handle arrays, lastly chat-style content
      const outputArray = Array.isArray(json?.output) ? json.output : [];
      const messageBlock = outputArray.find((entry: any) => entry?.type === 'message');
      const messageContent = Array.isArray(messageBlock?.content) ? messageBlock.content : undefined;
      const outputBlock = Array.isArray(messageContent) ? messageContent : Array.isArray(json?.output?.[0]?.content) ? json.output[0].content : undefined;
      const outputTextEntry = Array.isArray(outputBlock)
        ? outputBlock.find((c: any) => c?.type === 'output_text' && typeof c?.text === 'string')
        : undefined;
      const textCandidate =
        json?.output_text ??
        outputTextEntry?.text ??
        (Array.isArray(outputBlock) && typeof outputBlock?.[0]?.text === 'string' ? outputBlock[0].text : undefined) ??
        (Array.isArray(json?.content) && typeof json.content?.[0]?.text === 'string' ? json.content[0].text : undefined) ??
        json?.choices?.[0]?.message?.content;

      const text = Array.isArray(textCandidate) ? textCandidate.join('\n') : textCandidate;

      try { console.log('[MEASURE][openai] raw_text:', typeof text === 'string' ? text.slice(0, 240) : text); } catch {}

      if (typeof text !== 'string') throw new Error('OpenAI response had no text content');

      let parsed: any;
      try { parsed = JSON.parse(text); } catch (e: any) { throw new Error(`OpenAI JSON parse failed: ${e?.message || e}`); }

      try { console.log('[MEASURE][openai] parsed:', parsed); } catch {}

      const out = Output.safeParse(parsed);
      if (out.success && out.data.wallWidthCm > 0 && out.data.wallHeightCm > 0) {
        return out.data;
      }

      // === SECOND ATTEMPT: ask the model for A4 corners + wall bounds in pixels and compute cm locally ===
      try { console.warn('[MEASURE][openai] first pass invalid → trying corners mode'); } catch {}

      // Schema for second pass (pixel geometry, no cm)
      const cornerSchema = {
        name: 'wall_with_a4_geometry',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            a4Corners: {
              type: 'array', minItems: 4, maxItems: 4,
              items: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'number' } }
            },
            wallLeftX:   { type: 'number' },
            wallRightX:  { type: 'number' },
            wallTopY:    { type: 'number' },
            wallBottomY: { type: 'number' }
          },
          required: ['a4Corners','wallLeftX','wallRightX','wallTopY','wallBottomY']
        }
      } as const;

      const secondaryPolygonFocus = '';
      const cornersPrompt = `${secondaryPolygonFocus}Return precise pixel geometry only (no centimeters).\n` +
        `1) Detect the A4 paper (210mm × 297mm). List its 4 corners as [x,y] in clockwise order starting from top-left.\n` +
        `2) Identify the main opposite wall bounds as axis-aligned lines: wallLeftX, wallRightX, wallTopY, wallBottomY (in pixels).\n` +
        `3) Do not guess centimeters; only return the JSON fields requested.`;

      const cornersBody: any = {
        model: baseModel,
        input: [{
          role: 'user',
          content: [
            { type: 'input_text', text: cornersPrompt },
            { type: 'input_image', image_url: normalizedDataUri }
          ]
        }],
        text: {
          format: {
            type: 'json_schema',
            name: cornerSchema.name,
            schema: cornerSchema.schema,
            strict: cornerSchema.strict
          }
        }
      };
      
      if (supportsTemperature) {
        cornersBody.temperature = 0;
      }

      const cornersRes = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(cornersBody)
      });
      if (!cornersRes.ok) {
        const txt = await cornersRes.text();
        throw new Error(`OpenAI corners pass failed ${cornersRes.status}: ${txt}`);
      }
      const cornersJson = await cornersRes.json();
      const cornersText =
        cornersJson?.output_text ??
        cornersJson?.output?.[0]?.content?.find((c: any) => c?.type === 'output_text')?.text ??
        cornersJson?.choices?.[0]?.message?.content;

      if (typeof cornersText !== 'string') throw new Error('OpenAI corners pass had no text content');
      let cornersParsed: any;
      try { cornersParsed = JSON.parse(cornersText); } catch (e: any) { throw new Error(`OpenAI corners JSON parse failed: ${e?.message || e}`); }
      try { console.log('[MEASURE][openai] corners parsed:', cornersParsed); } catch {}

      // Compute cm from pixel geometry locally
      function dist(a: number[], b: number[]) { return Math.hypot((a[0]-b[0]), (a[1]-b[1])); }
      const c = cornersParsed.a4Corners as number[][];
      if (!Array.isArray(c) || c.length !== 4) throw new Error('Invalid a4Corners');
      // edges (assuming clockwise): 0-1,1-2,2-3,3-0
      const e01 = dist(c[0], c[1]);
      const e12 = dist(c[1], c[2]);
      const e23 = dist(c[2], c[3]);
      const e30 = dist(c[3], c[0]);
      const widthPx  = (e01 + e23) / 2;
      const heightPx = (e12 + e30) / 2;
      const ratioPx = widthPx / Math.max(1e-6, heightPx);
      // A4 ratios
      const R_LONG  = 297/210; // ≈1.414 when landscape width=297
      const R_SHORT = 210/297; // ≈0.707 when portrait width=210
      // choose orientation whose ratio is closer
      const dLong  = Math.abs(ratioPx - R_LONG);
      const dShort = Math.abs(ratioPx - R_SHORT);
      let pxPerCm: number;
      if (dLong <= dShort) {
        // width≈29.7cm, height≈21cm
        pxPerCm = ((widthPx / 29.7) + (heightPx / 21.0)) / 2;
      } else {
        // width≈21cm, height≈29.7cm
        pxPerCm = ((widthPx / 21.0) + (heightPx / 29.7)) / 2;
      }
      if (!isFinite(pxPerCm) || pxPerCm <= 0) throw new Error('Invalid pxPerCm');

      const wPx = Math.max(0, (cornersParsed.wallRightX as number) - (cornersParsed.wallLeftX as number));
      const hPx = Math.max(0, (cornersParsed.wallBottomY as number) - (cornersParsed.wallTopY as number));
      let wCm = wPx / pxPerCm;
      let hCm = hPx / pxPerCm;
      // round to 0.5 cm for stability
      wCm = Math.round(wCm * 2) / 2;
      hCm = Math.round(hCm * 2) / 2;
      if (!(wCm > 0 && hCm > 0)) throw new Error('Computed non-positive dimensions');

      try { console.log('[MEASURE][openai] computed from corners:', { wPx, hPx, pxPerCm, wCm, hCm }); } catch {}
      return { wallWidthCm: wCm, wallHeightCm: hCm };
    } catch (e) {
      try { console.error('[MEASURE][openai] primary failed', (e as any)?.message || e); } catch {}

      // Fallback to secondary below (duplicate of generic fallback to ensure path coverage)
      const secondary = overrides?.secondaryModel || (primaryProvider === 'openai' ? env.AI1_GEMINI_MODEL : env.AI1_GPT_MODEL);
      if (!secondary || secondary === primaryModel) throw e;

      const { genkit } = await import('genkit');
      const secProvider = detectProviderFromModel(secondary);
      const secModel = normalizeModelForProvider(secProvider, secondary);
      const plugins: any[] = [];
      if (secProvider === 'googleai') {
        const mod: any = await import('@genkit-ai/googleai');
        const googleAI = (mod && (mod.googleAI || mod.default));
        if (typeof googleAI !== 'function') throw new Error('googleAI plugin not found');
        plugins.push(googleAI());
      } else {
        const mod: any = await import('genkitx-openai');
        const openai = (mod && (mod.openai || mod.default));
        if (typeof openai !== 'function') throw new Error('openai plugin not found');
        plugins.push(openai());
      }
      const ai2 = genkit({ plugins, model: secModel });
      try { console.log(`[MEASURE] fallback provider=${secProvider} model=${secModel}`); } catch {}

      const { z } = await import('genkit');
      const Input = z.object({ photoDataUri: z.string() });
      const Output = z.object({ wallWidthCm: z.number(), wallHeightCm: z.number() });

      const fallbackPrompt = ai2.definePrompt({
        name: 'cw_estimateDimensions_fallback',
        input: { schema: Input },
        output: { schema: Output },
        prompt: buildPromptTemplate(null),
      });

      const { output } = await fallbackPrompt({ photoDataUri: normalizedDataUri });
      if (!output) return output as any;
      const baseOut = output as MeasureOutput;
      const warning = `Measurement fell back to secondary model ${secProvider}/${secondary} after OpenAI primary failure.`;
      const warnings = (baseOut.warnings ? [...baseOut.warnings] : []).concat([warning]);
      return {
        ...baseOut,
        warnings,
        usedFallback: true,
        fallbackProvider: secProvider,
      };
    }
  }

  const { ai, provider, model } = await createAi(primaryProvider, primaryModel);

  const { z } = await import('genkit');
  const Input = z.object({ photoDataUri: z.string() });
  const Output = z.object({ wallWidthCm: z.number(), wallHeightCm: z.number() });

  const prompt = ai.definePrompt({
    name: 'cw_estimateDimensions',
    input: { schema: Input },
    output: { schema: Output },
    prompt: buildPromptTemplate(null)
  });

  // Try primary model; if it fails, attempt secondary.
  const fromQwenFailure = requestedProvider === 'qwen';

  try {
    const { output } = await prompt({ photoDataUri: normalizedDataUri });
    try { console.log('[MEASURE][genkit] primary output:', output); } catch {}
    if (!output) return output as any;
    const baseOut = output as MeasureOutput;
    if (!fromQwenFailure) {
      return baseOut;
    }
    const warning = `Measurement fell back to ${provider} because primary provider=qwen failed.`;
    const warnings = (baseOut.warnings ? [...baseOut.warnings] : []).concat([warning]);
    return {
      ...baseOut,
      warnings,
      usedFallback: true,
      fallbackProvider: provider,
    };
  } catch (e: any) {
    try { console.error(`[MEASURE] primary failed provider=${provider} model=${model}`, e?.message || e); } catch {}
    // fallback to secondary model if configured
    const fallbackDefault = (() => {
      if (provider === 'googleai') return env.AI1_GPT_MODEL;
      if (provider === 'openai') return env.AI1_GEMINI_MODEL;
      return env.AI1_GEMINI_MODEL;
    })();
    const secondary = overrides?.secondaryModel || fallbackDefault;
    if (!secondary || secondary === model) throw e;
    const { genkit } = await import('genkit');
    const secProvider = detectProviderFromModel(secondary);
    const secModel = normalizeModelForProvider(secProvider, secondary);
    const plugins: any[] = [];
    if (secProvider === 'googleai') {
      const mod: any = await import('@genkit-ai/googleai');
      const googleAI = (mod && (mod.googleAI || mod.default));
      if (typeof googleAI !== 'function') throw new Error('googleAI plugin not found');
      plugins.push(googleAI());
    } else {
      const mod: any = await import('genkitx-openai');
      const openai = (mod && (mod.openai || mod.default));
      if (typeof openai !== 'function') throw new Error('openai plugin not found');
      plugins.push(openai());
    }
    const ai2 = genkit({ plugins, model: secModel });
    try { console.log(`[MEASURE] fallback provider=${secProvider} model=${secModel}`); } catch {}
    const fallbackPrompt = ai2.definePrompt({
      name: 'cw_estimateDimensions_fallback',
      input: { schema: Input },
      output: { schema: Output },
      prompt: buildPromptTemplate(null),
    });
    const { output } = await fallbackPrompt({ photoDataUri: normalizedDataUri });
    try { console.log('[MEASURE][genkit] fallback output:', output); } catch {}
    if (!output) return output as any;
    const baseOut = output as MeasureOutput;
    const warning = `Measurement fell back to secondary model ${secProvider}/${secondary} after ${provider}/${model} failure.`;
    const warnings = (baseOut.warnings ? [...baseOut.warnings] : []).concat([warning]);
    return {
      ...baseOut,
      warnings,
      usedFallback: true,
      fallbackProvider: secProvider,
    };
  }
}
