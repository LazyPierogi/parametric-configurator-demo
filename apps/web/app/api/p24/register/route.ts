import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type OrderItem = {
  sellerId?: string;
  sellerCategory?: string;
  name: string;
  description?: string;
  quantity: number;
  price: number; // in cents or integer per provider contract
  number?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) || {};

    const sandbox = 1;

    // Environment-driven configuration (keep defaults for local testing)
    let MERCHANT_ID, POS_ID, CRC, API_KEY, URL_RETURN, URL_STATUS, P24_URL;

    if (sandbox) {
        MERCHANT_ID = Number(process.env.P24_MERCHANT_ID || 0);
        POS_ID = Number(process.env.P24_POS_ID || 0);
        CRC = process.env.P24_SANDBOX_CRC_KEY || '';
        API_KEY = process.env.P24_SANDBOX_API_KEY || '';
        URL_RETURN = process.env.P24_URL_RETURN || '';
        URL_STATUS = process.env.P24_URL_STATUS || '';
        P24_URL = process.env.P24_SANDBOX_URL || '';
    } else {
        MERCHANT_ID = Number(process.env.P24_MERCHANT_ID || 0);
        POS_ID = Number(process.env.P24_POS_ID || 0);
        CRC = process.env.P24_CRC_KEY || '';
        API_KEY = process.env.P24_API_KEY || '';
        URL_RETURN = process.env.P24_URL_RETURN || '';
        URL_STATUS = process.env.P24_URL_STATUS || '';
        P24_URL = process.env.P24_URL || '';
    }

    // Order input shape: allow the caller to pass most fields; fall back to sensible defaults
    const sessionId = body.sessionId || `s_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const amount = Number(body.amount ?? body.totalAmount ?? 0);
    const currency = body.currency || 'PLN';

    const payload: any = {
      merchantId: MERCHANT_ID,
      posId: POS_ID,
      sessionId: String(sessionId),
      amount: Number(amount),
      currency: String(currency),
      description: body.description || `Order ${sessionId}`,
      email: body.email || '',
      client: body.client || body.customerName || '',
      address: body.address || '',
      zip: body.zip || body.postcode || '',
      city: body.city || '',
      country: body.country || 'PL',
      phone: body.phone || '',
      language: body.language || 'pl',
      method: body.method ?? 0,
      urlReturn: body.urlReturn || URL_RETURN,
      urlStatus: body.urlStatus || URL_STATUS,
      timeLimit: body.timeLimit ?? 0,
      waitForResult: body.waitForResult ?? true,
      regulationAccept: body.regulationAccept ?? false,
      shipping: body.shipping ?? 0,
      transferLabel: body.transferLabel || '',
      mobileLib: body.mobileLib ?? 1,
      sdkVersion: body.sdkVersion || '',
      encoding: body.encoding || 'UTF-8',
      methodRefId: body.methodRefId || '',
    //   cart: Array.isArray(body.cart)
    //     ? body.cart
    //     : (Array.isArray(body.items)
    //         ? body.items.map((it: any) => ({
    //             sellerId: it.sellerId || '',
    //             sellerCategory: it.sellerCategory || '',
    //             name: it.name || it.title || 'item',
    //             description: it.description || it.name || '',
    //             quantity: Number(it.quantity || 1),
    //             price: Number(it.price || it.unitPrice || 0),
    //             number: it.number || it.sku || '',
    //           }))
    //         : []),
      additional: body.additional || body.meta || {},
    };

    // Compute sign according to spec: checksum of parameters {sessionId,merchantId,amount,currency,crc}
    // The JSON encoding should be unescaped for unicode and slashes. In JS, JSON.stringify does not
    // escape unicode characters by default and does not escape slashes, so using a canonical ordered
    // object is sufficient. We ensure key order here.
    const signObj = {
      sessionId: String(payload.sessionId),
      merchantId: Number(payload.merchantId),
      amount: Number(payload.amount),
      currency: String(payload.currency),
      crc: String(CRC),
    };

    const signString = JSON.stringify(signObj);

    const sign = crypto.createHash('sha384').update(signString, 'utf8').digest('hex');

    payload.sign = sign;

    const payloadJson = JSON.stringify(payload);

    // return NextResponse.json( { "json": payload },{ status: 200 });

    // P24 request
    if (P24_URL) {
      try {
        const auth = Buffer.from(`${String(MERCHANT_ID)}:${String(API_KEY)}`).toString('base64');
        const p24Res = await fetch(P24_URL + 'transaction/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${auth}`,
          },
          body: payloadJson,
        });

        const p24Json = await p24Res.json().catch(() => null);

        if (p24Res.ok && p24Json && Number(p24Json.responseCode) === 0 && p24Json.data?.token) {
          // Return provider token directly
          return NextResponse.json(
            { token: String(p24Json.data.token), responseCode: 0 },
            { 
              status: 200
            }
          );
        }
        // Fall through to local token fallback on non-success
      } catch (_err) {
        return NextResponse.json(
            { "error": (_err as any).message || String(_err), "responseCode": 1 },
            { 
                status: 500
            }
          );
      }
    }
  } catch (err: any) {
    const msg = err?.message || String(err);
    return NextResponse.json({ responseCode: 1, error: msg }, 
        { 
            status: 500  
        }      
        );
  }
}
