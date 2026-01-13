import { NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CATEGORY = 'tech';

function mimeFor(filePath: string): string {
  const ext = filePath.toLowerCase().split('.').pop() ?? '';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'svg') return 'image/svg+xml';
  return 'application/octet-stream';
}

type RouteContext = {
  params: Promise<{ asset?: string[] }>;
};

export async function GET(_req: Request, context: RouteContext) {
  const { asset } = await context.params;
  const segments = asset ?? [];
  const safeSegments = segments.filter((segment) => segment && !segment.includes('..'));
  if (!safeSegments.length) {
    return NextResponse.json({ error: 'Missing asset path' }, { status: 400 });
  }

  const relativePath = safeSegments.join('/');
  const repoRoot = path.resolve(process.cwd(), '..', '..');
  const absolutePath = path.join(repoRoot, 'public', CATEGORY, relativePath);

  try {
    const data = await fs.readFile(absolutePath);
    return new NextResponse(data, {
      headers: { 'Content-Type': mimeFor(absolutePath) },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Not found' }, { status: 404 });
  }
}
