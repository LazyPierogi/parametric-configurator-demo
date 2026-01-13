import { NextResponse } from 'next/server';
import OAuth from 'oauth-1.0a';
import crypto from 'crypto-js';

type Payload = {
  quoteItemId: number;
  imageData: string;
  filename?: string;
};

function requireEnv(name: string): string {
  const value = (process.env[name] ?? '').trim();
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export async function POST(req: Request) {
  try {
    const url = (process.env.MAGENTO_ORDER_SCREENSHOT_URL ?? '').trim();
    if (!url) {
      return NextResponse.json(
        { ok: false, error: 'Screenshot upload is not configured (MAGENTO_ORDER_SCREENSHOT_URL is not set).' },
        { status: 501 },
      );
    }

    const body = (await req.json()) as Partial<Payload>;
    const quoteItemId = Number(body.quoteItemId);
    const imageData = typeof body.imageData === 'string' ? body.imageData : '';
    const filename = typeof body.filename === 'string' && body.filename.trim()
      ? body.filename.trim()
      : `order_${quoteItemId || 'unknown'}.png`;

    if (!Number.isFinite(quoteItemId) || quoteItemId <= 0) {
      return NextResponse.json({ ok: false, error: 'Invalid quoteItemId.' }, { status: 400 });
    }
    if (!imageData) {
      return NextResponse.json({ ok: false, error: 'Missing imageData.' }, { status: 400 });
    }
    if (imageData.length > 20_000_000) {
      return NextResponse.json({ ok: false, error: 'imageData too large.' }, { status: 413 });
    }

    const oauth = new OAuth({
      consumer: {
        key: requireEnv('MAGENTO_OAUTH_CONSUMER_KEY'),
        secret: requireEnv('MAGENTO_OAUTH_CONSUMER_SECRET'),
      },
      signature_method: 'HMAC-SHA256',
      hash_function(base_string, key) {
        return crypto.HmacSHA256(base_string, key).toString(crypto.enc.Base64);
      },
      nonce_length: 32,
    });

    const token = {
      key: requireEnv('MAGENTO_OAUTH_ACCESS_TOKEN'),
      secret: requireEnv('MAGENTO_OAUTH_ACCESS_TOKEN_SECRET'),
    };

    const upstreamBody = {
      order_id: quoteItemId,
      imageData,
      filename,
      quote_item_id: quoteItemId,
    };

    const requestData = {
      url,
      method: 'POST' as const,
      data: upstreamBody,
    };

    const authHeader = oauth.toHeader(oauth.authorize(requestData, token));
    const upstreamRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...authHeader,
      },
      body: JSON.stringify(upstreamBody),
    });

    if (!upstreamRes.ok) {
      const text = await upstreamRes.text().catch(() => '');
      return NextResponse.json(
        { ok: false, error: 'Upstream screenshot upload failed.', status: upstreamRes.status, details: text.slice(0, 2000) },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

