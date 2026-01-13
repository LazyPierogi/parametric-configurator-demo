import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  // Placeholder pricing stub; to be replaced with real logic/integration
  return NextResponse.json({ ok: true, priceCents: 12345, currency: 'USD' });
}

