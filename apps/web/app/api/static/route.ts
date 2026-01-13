import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function mimeFor(p: string): string {
  const ext = p.toLowerCase().split('.').pop() || '';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return 'application/octet-stream';
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams.get('p');
  if (!p) return NextResponse.json({ error: 'Missing p' }, { status: 400 });
  if (process.env.NODE_ENV !== 'production') {
    try {
      // eslint-disable-next-line no-console
      console.warn('[static-fallback] request', p);
    } catch {}
  }
  try {
    const repoRoot = path.resolve(process.cwd(), '..', '..');
    const abs = path.join(repoRoot, 'public', p);
    const data = await fs.readFile(abs);
    if (process.env.NODE_ENV !== 'production') {
      try {
        // eslint-disable-next-line no-console
        console.warn('[static-fallback] served', abs);
      } catch {}
    }
    return new NextResponse(data, { headers: { 'Content-Type': mimeFor(abs) } });
  } catch (e: any) {
    if (process.env.NODE_ENV !== 'production') {
      try {
        // eslint-disable-next-line no-console
        console.warn('[static-fallback] miss', p, e?.message);
      } catch {}
    }
    return NextResponse.json({ error: e?.message || 'Not found' }, { status: 404 });
  }
}

