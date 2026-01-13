import { NextRequest, NextResponse } from 'next/server';
import { loadEnv } from '@curtain-wizard/shared/src/env';
import { segmentToPngAlpha } from '@curtain-wizard/core/src/services/segment';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const t0 = Date.now();
    const env = loadEnv();
    const ct = req.headers.get('content-type') || '';
    if (!ct.includes('multipart/form-data')) {
      return NextResponse.json({ error: "Expected multipart/form-data with 'image' file" }, { status: 400 });
    }
    const form = await req.formData();
    const file = form.get('image');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing 'image' file" }, { status: 400 });
    }
    const maxBytes = env.MAX_IMAGE_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      return NextResponse.json({ error: `File too large. Max ${env.MAX_IMAGE_MB}MB.` }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const wantLayers = (form.get('layers') || '') === '1';
    const debugDir = wantLayers ? await fs.mkdtemp(path.join(os.tmpdir(), 'cw-seg-')) : undefined;
    const { png, backend, inputBytes } = await segmentToPngAlpha(buf, debugDir);
    if (!wantLayers) {
      const elapsed = String(Date.now() - t0);
      const pngBody = new Uint8Array(png);
      return new NextResponse(pngBody, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'no-store',
          'X-Elapsed-MS': elapsed,
          'X-Segment-Backend': backend,
          'X-Input-Bytes': String(typeof inputBytes === 'number' ? inputBytes : file.size),
          'X-Input-Type': file.type || 'unknown',
        },
      });
    }
    // attempt to return a small set of debug artifacts if exist
    const read64 = async (name: string) => {
      try { const b = await fs.readFile(path.join(debugDir!, name)); return `data:image/png;base64,${b.toString('base64')}`; } catch { return null; }
    };
    const attached_on_wall = await read64('attached_on_wall.png');
    const proposal_union = await read64('proposal_union.png');
    const final_mask = `data:image/png;base64,${png.toString('base64')}`;
    const elapsed = Date.now() - t0;
    return NextResponse.json({
      attached_on_wall,
      proposal_union,
      final_mask,
      elapsed_ms: elapsed,
      backend,
      input_bytes: typeof inputBytes === 'number' ? inputBytes : file.size,
      input_type: file.type || null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Segmentation failed' }, { status: 500 });
  }
}
