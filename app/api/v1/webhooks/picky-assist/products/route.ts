import { NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/webhooks/picky-assist/products
//
// Picky Assist calls this endpoint whenever a product needs to be
// added, updated, or deleted in our system.
//
// Picky Assist will POST JSON with the event identifier + product payload.
// We authenticate with the shared secret configured as:
//   PICKY_ASSIST_WEBHOOK_SECRET  in .env.local
//
// Expected payload shape:
// {
//   "event": "add_product" | "update_product" | "delete_product",
//   "product": {
//     "stock_code":        string,   // mandatory — our stable product ID
//     "title":             string,
//     "description":       string,
//     "price":             number,
//     "mrp":               number,
//     "quantity":          number,
//     "category":          string,
//     "sub_category":      string,
//     "color":             string,
//     "cloth_type":        string,
//     "cover_image_url":   string,
//     "tags":              string[]
//   }
// }
// ─────────────────────────────────────────────────────────────────────────────

// ── In-memory rate limiter (replace with Redis/Upstash in production) ────────
const rateLimitMap = new Map<string, { count: number; lastReset: number }>();
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record) { rateLimitMap.set(ip, { count: 1, lastReset: now }); return true; }
  if (now - record.lastReset > RATE_LIMIT_WINDOW_MS) { rateLimitMap.set(ip, { count: 1, lastReset: now }); return true; }
  if (record.count >= RATE_LIMIT_MAX) return false;
  record.count++;
  return true;
}

// ── Auth helper ──────────────────────────────────────────────────────────────
function isAuthorized(request: Request, rawBody: string): boolean {
  const secret = process.env.PICKY_ASSIST_WEBHOOK_SECRET;
  const authHeader = request.headers.get('authorization');
  const staticToken = process.env.PICKY_ASSIST_API_TOKEN;

  // Method A: Static Bearer token (simplest — Picky Assist sends this header)
  if (staticToken && authHeader === `Bearer ${staticToken}`) return true;

  // Method B: HMAC-SHA256 signature (if Picky Assist supports signing)
  const signature = request.headers.get('x-picky-assist-signature');
  if (secret && signature) {
    const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
    try {
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  return false;
}

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';

  // 1. Rate Limiting
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }

  // 2. Read raw body once (needed for HMAC verification)
  const rawBody = await request.text();

  // 3. Auth
  if (!isAuthorized(request, rawBody)) {
    console.warn(`[Picky Assist] Unauthorized product webhook from IP: ${ip}`);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 4. Parse JSON
  let payload: { event: string; product: Record<string, any> };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { event, product } = payload;

  if (!event || !product) {
    return NextResponse.json(
      { error: 'Missing required fields: event and product' },
      { status: 400 }
    );
  }

  const stockCode = product.stock_code ? String(product.stock_code).trim() : null;
  if (!stockCode) {
    return NextResponse.json(
      { error: 'Missing required field: product.stock_code' },
      { status: 400 }
    );
  }

  // 5. Route by event type
  switch (event) {
    // ── ADD PRODUCT ──────────────────────────────────────────────────────────
    case 'add_product': {
      // Upsert — if stock_code already exists, treat it as an update
      const existing = await prisma.product.findUnique({ where: { stockCode } });
      if (existing) {
        console.warn(`[Picky Assist] add_product called for existing stock_code: ${stockCode}. Treating as update.`);
      }

      const data = buildProductData(product);

      // Ensure title is always present for create (required by Prisma schema)
      const titleForCreate: string = (data.title as string | undefined) || product.title || stockCode;

      await prisma.$transaction(async (tx) => {
        let targetId: string;

        if (existing) {
          await tx.product.update({ where: { stockCode }, data });
          targetId = existing.id;
        } else {
          // Spread data but override title to guarantee a non-undefined string
          const created = await tx.product.create({
            data: { stockCode, ...data, title: titleForCreate },
          });
          targetId = created.id;
        }

        await tx.inventoryLog.create({
          data: {
            productId: targetId,
            action: 'picky_assist_add',
            qtyChange: product.quantity ?? 1,
            qtyAfter: product.quantity ?? 1,
            note: `Picky Assist: add_product event for ${stockCode}`,
            source: 'picky_assist',
          },
        });
      });

      console.log(`[Picky Assist] ✅ add_product processed: ${stockCode}`);
      return NextResponse.json(
        { status: 'success', event, stock_code: stockCode, action: existing ? 'updated' : 'created' },
        { status: 200 }
      );
    }

    // ── UPDATE PRODUCT ───────────────────────────────────────────────────────
    case 'update_product': {
      const existing = await prisma.product.findUnique({ where: { stockCode } });
      if (!existing) {
        return NextResponse.json(
          { error: `Product not found: ${stockCode}` },
          { status: 404 }
        );
      }

      // Only update fields explicitly present in the payload (partial update)
      const data = buildProductData(product, /* partialOnly */ true);

      await prisma.product.update({ where: { stockCode }, data });

      await prisma.inventoryLog.create({
        data: {
          productId: existing.id,
          action: 'picky_assist_update',
          qtyChange: 0,
          qtyAfter: existing.quantity,
          note: `Picky Assist: update_product event for ${stockCode}`,
          source: 'picky_assist',
        },
      });

      console.log(`[Picky Assist] ✅ update_product processed: ${stockCode}`);
      return NextResponse.json(
        { status: 'success', event, stock_code: stockCode },
        { status: 200 }
      );
    }

    // ── DELETE PRODUCT ───────────────────────────────────────────────────────
    case 'delete_product': {
      const existing = await prisma.product.findUnique({ where: { stockCode } });
      if (!existing) {
        // Idempotent — already gone, that's fine
        return NextResponse.json(
          { status: 'success', event, stock_code: stockCode, action: 'not_found_noop' },
          { status: 200 }
        );
      }

      // Soft-delete: set status to ARCHIVED rather than hard-deleting
      await prisma.$transaction(async (tx) => {
        await tx.product.update({
          where: { stockCode },
          data: { status: 'ARCHIVED', quantity: 0 },
        });

        await tx.inventoryLog.create({
          data: {
            productId: existing.id,
            action: 'picky_assist_delete',
            qtyChange: -existing.quantity,
            qtyAfter: 0,
            note: `Picky Assist: delete_product event for ${stockCode}`,
            source: 'picky_assist',
          },
        });
      });

      console.log(`[Picky Assist] ✅ delete_product processed (soft-deleted): ${stockCode}`);
      return NextResponse.json(
        { status: 'success', event, stock_code: stockCode, action: 'archived' },
        { status: 200 }
      );
    }

    default:
      console.warn(`[Picky Assist] Unknown event type received: ${event}`);
      return NextResponse.json(
        { error: `Unknown event type: ${event}. Supported: add_product, update_product, delete_product` },
        { status: 400 }
      );
  }
}

// ── Field mapper ─────────────────────────────────────────────────────────────
// Maps Picky Assist's snake_case field names to our Prisma schema fields.
// When partialOnly=true, only fields explicitly present in the payload are included.
function buildProductData(product: Record<string, any>, partialOnly = false): Record<string, any> {
  const fieldMap: Record<string, string> = {
    title:            'title',
    description:      'description',
    price:            'price',
    mrp:              'mrp',
    quantity:         'quantity',
    color:            'color',
    cloth_type:       'clothType',
    cover_image_url:  'coverImageUrl',
    tags:             'tags',
    size:             'size',
    location:         'location',
    friendly_code:    'friendlyCode',
    design_number:    'designNumber',
    whatsapp_retail:  'whatsappRetail',
    whatsapp_catalogue_title: 'whatsappCatalogueTitle',
    instagram_caption: 'instagramCaption',
    status:           'status',
  };

  const data: Record<string, any> = {};

  for (const [paKey, prismaKey] of Object.entries(fieldMap)) {
    if (partialOnly) {
      // Only include if Picky Assist explicitly sent this field
      if (product[paKey] !== undefined) {
        data[prismaKey] = product[paKey];
      }
    } else {
      // Full create — include all with fallbacks
      if (product[paKey] !== undefined) {
        data[prismaKey] = product[paKey];
      }
    }
  }

  // Numeric coercions
  if (data.price !== undefined) data.price = parseFloat(data.price) || 0;
  if (data.mrp !== undefined) data.mrp = parseFloat(data.mrp) || 0;
  if (data.quantity !== undefined) data.quantity = parseInt(data.quantity, 10) || 0;

  return data;
}
