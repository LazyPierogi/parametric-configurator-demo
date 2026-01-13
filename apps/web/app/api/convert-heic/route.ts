import { NextResponse } from 'next/server';
import heicConvert from 'heic-convert';
import sharp from 'sharp';

export const runtime = 'nodejs';

const MAX_HEIC_BYTES = 30 * 1024 * 1024; // 30MB safeguard for server conversion

// HEIC optimization settings from env (with fallback defaults)
const MAX_OUTPUT_DIMENSION = parseInt(process.env.HEIC_MAX_DIMENSION || '2048', 10);
const JPEG_QUALITY = parseInt(process.env.HEIC_JPEG_QUALITY || '82', 10);

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let file: File | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const entry = formData.get('file');
      if (entry instanceof File) {
        file = entry;
      }
    } else {
      const buffer = await request.arrayBuffer();
      if (buffer.byteLength > 0) {
        file = new File([buffer], 'upload.heic', {
          type: contentType || 'application/octet-stream',
        });
      }
    }

    if (!file) {
      return NextResponse.json({ error: 'No HEIC file provided' }, { status: 400 });
    }

    if (file.size === 0) {
      return NextResponse.json({ error: 'Empty file cannot be converted' }, { status: 400 });
    }

    if (file.size > MAX_HEIC_BYTES) {
      return NextResponse.json(
        { error: 'HEIC file exceeds conversion size limit' },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    console.log(`[HEIC Conversion API] Converting HEIC (${file.size} bytes)`);
    console.log(`[HEIC Conversion API] Settings: maxDimension=${MAX_OUTPUT_DIMENSION}px, quality=${JPEG_QUALITY}%`);

    const started = performance.now();
    let optimizedJpeg: Buffer | null = null;

    const canUseSharpHeif = Boolean((sharp as unknown as { format?: Record<string, unknown> }).format?.heif);
    if (canUseSharpHeif) {
      try {
        const metadata = await sharp(buffer, { sequentialRead: true }).metadata();
        const width = metadata.width ?? 0;
        const height = metadata.height ?? 0;
        const longSide = Math.max(width, height);

        if (!width || !height) {
          throw new Error('Missing dimensions in HEIC metadata');
        }

        console.log(`[HEIC Conversion API] sharp metadata: ${width}x${height} (long side ${longSide})`);

        let pipeline = sharp(buffer, { sequentialRead: true }).rotate();

        if (longSide > MAX_OUTPUT_DIMENSION) {
          console.log(`[HEIC Conversion API] sharp resizing to max ${MAX_OUTPUT_DIMENSION}px`);
          pipeline = pipeline.resize(MAX_OUTPUT_DIMENSION, MAX_OUTPUT_DIMENSION, {
            fit: 'inside',
            withoutEnlargement: true,
          });
        } else {
          console.log('[HEIC Conversion API] sharp recompress only (already within target size)');
        }

        optimizedJpeg = await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();

        const elapsed = Math.round(performance.now() - started);
        const reduction = ((1 - optimizedJpeg.length / file.size) * 100).toFixed(1);
        console.log(`[HEIC Conversion API] sharp pipeline completed in ${elapsed}ms, final size: ${optimizedJpeg.length} bytes (${reduction}% vs original)`);
      } catch (sharpError) {
        const message = sharpError instanceof Error ? sharpError.message : String(sharpError);
        if (message.includes('Support for this compression format has not been built in')) {
          console.info('[HEIC Conversion API] sharp HEIF support unavailable, using heic-convert fallback');
        } else {
          console.warn('[HEIC Conversion API] sharp pipeline failed, falling back to heic-convert', message);
        }
      }
    } else {
      console.log('[HEIC Conversion API] sharp HEIF support unavailable, using heic-convert fallback');
    }

    if (!optimizedJpeg) {
      const fallbackStart = performance.now();
      const convertCandidate: unknown = (heicConvert as any)?.default ?? heicConvert;
      if (typeof convertCandidate !== 'function') {
        console.error('[HEIC Conversion API] heic-convert import did not yield a function');
        return NextResponse.json(
          { error: 'HEIC converter unavailable on the server' },
          { status: 500 },
        );
      }
      const convert = convertCandidate as typeof heicConvert;

      try {
        console.log('[HEIC Conversion API] Falling back to heic-convert → sharp');
        const rawBuffer = await convert({
          buffer,
          format: 'JPEG',
          quality: 0.9,
        });
        const initialJpeg = Buffer.isBuffer(rawBuffer) ? rawBuffer : Buffer.from(rawBuffer);

        const metadata = await sharp(initialJpeg).metadata();
        const width = metadata.width ?? 0;
        const height = metadata.height ?? 0;
        const longSide = Math.max(width, height);

        let pipeline = sharp(initialJpeg).rotate();
        if (longSide > MAX_OUTPUT_DIMENSION) {
          console.log(`[HEIC Conversion API] Resizing fallback JPEG from ${width}x${height} (long side ${longSide})`);
          pipeline = pipeline.resize(MAX_OUTPUT_DIMENSION, MAX_OUTPUT_DIMENSION, {
            fit: 'inside',
            withoutEnlargement: true,
          });
        } else {
          console.log('[HEIC Conversion API] Fallback image already within size, recompressing');
        }

        optimizedJpeg = await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();

        const totalFallback = Math.round(performance.now() - fallbackStart);
        const reduction = ((1 - optimizedJpeg.length / file.size) * 100).toFixed(1);
        console.log(`[HEIC Conversion API] Fallback pipeline completed in ${totalFallback}ms, final size: ${optimizedJpeg.length} bytes (${reduction}% vs original)`);
      } catch (fallbackError) {
        console.error('[HEIC Conversion API] Fallback conversion failed:', fallbackError);
        return NextResponse.json(
          { error: 'Failed to convert HEIC image on the server' },
          { status: 422 },
        );
      }
    }

    if (!optimizedJpeg) {
      return NextResponse.json(
        { error: 'HEIC conversion failed' },
        { status: 500 },
      );
    }

    const total = Math.round(performance.now() - started);
    const jpegBody = new Uint8Array(optimizedJpeg);
    return new NextResponse(jpegBody, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'no-store',
        'X-Original-Size': String(file.size),
        'X-Converted-Size': String(optimizedJpeg.length),
        'X-Conversion-Time': String(total),
      },
    });
  } catch (error) {
    console.error('[HEIC Conversion API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Unexpected error while converting HEIC image' },
      { status: 500 },
    );
  }
}
