import { NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Legacy route: serve the renamed palette file to maintain backward compatibility
const RELATIVE_PATH = 'config/wall-box-pallette.json';

export async function GET() {
  const repoRoot = path.resolve(process.cwd(), '..', '..');
  const absolutePath = path.join(repoRoot, 'public', RELATIVE_PATH);

  try {
    const data = await fs.readFile(absolutePath, 'utf-8');
    return new NextResponse(data, {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Not found' }, { status: 404 });
  }
}
